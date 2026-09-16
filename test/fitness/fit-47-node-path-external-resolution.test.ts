/**
 * FIT-47: the published package shape stays resolvable through `NODE_PATH` (SDK #91).
 *
 * The engine spawns the real runner with `NODE_PATH=<verified dir>/node_modules` so a
 * factory living OUTSIDE the workspace can resolve `@pbuilder/sdk` (engine ADR-0064
 * `external-factory-node-path`, engine #212; CLI #94). Bun's `NODE_PATH` leg does not
 * consult the `exports` map — it consults `main`. A package declaring `exports` and no
 * `main` is therefore unresolvable on BOTH legs the runner depends on: the factory's own
 * ESM bare-specifier `import`, and the `createRequire(anchorUrl).resolve()` that
 * `probeSingleInstance` performs before it.
 *
 * Fixture discipline (the reason this file exists rather than an assertion on
 * package.json alone): the engine's real-Bun e2e fixtures model the SDK as a CJS,
 * `main`-based package and carry no `exports` map, so they were green throughout the
 * outage — honest tests whose fixture differed from the published package in the one
 * attribute that decides the outcome. The fixture below therefore DERIVES `type`, `main`
 * and `exports` from this repo's real package.json instead of hardcoding a shape, so it
 * cannot drift from what ships.
 *
 * The negative control (`main` deleted, everything else identical) is not decoration: it
 * is what proves this test measures `main` rather than passing for free (FIT-27).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

// Only the umbrella entry is modelled, and `"."` is a fixed key rather than an index
// signature — under `noUncheckedIndexedAccess` an index signature would make every read
// `| undefined` and push non-null assertions into the fixture builder, where a wrong shape
// must fail loudly rather than be asserted away.
interface ShippedShape {
  type: string;
  main?: string;
  exports: { ".": { types: string; import: string; default: string } };
}

const shipped = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as ShippedShape;

// Mirrors the engine's spawn envelope (engine `internal/adapter/bunipc/sidecar.go`):
// an empty environment carrying a single NODE_PATH, cwd = workspace root. `env` given
// explicitly is NOT merged with the parent's, so this IS `env -i`.
//
// `--no-install` is a determinism guard, not the mechanism under test: `@pbuilder/sdk` is
// a REAL published name, so without it a failed resolution falls through to Bun's global
// cache and the run "succeeds" from a foreign copy. The resolved-path assertions below
// close that hole independently — a cache hit resolves outside `workspace/`.
function runProbe(root: string): { resolved: string | null; imported: string | null; raw: string } {
  const workspace = join(root, "workspace");
  const result = spawnSync(
    process.execPath,
    ["--no-install", join(workspace, "node_modules/@pbuilder/sdk/entry.mjs"), join(root, "external/foo/factory.mjs")],
    {
      cwd: workspace,
      encoding: "utf-8",
      env: { NODE_PATH: join(workspace, "node_modules") },
    }
  );
  const raw = `${result.stdout}${result.stderr}`;
  const pick = (label: string): string | null => {
    const line = raw.split("\n").find((l) => l.startsWith(`${label} `));
    if (line === undefined) return null;
    const value = line.slice(label.length + 1).trim();
    return value.startsWith("FAIL") ? null : value;
  };
  return { resolved: pick("resolve"), imported: pick("import"), raw };
}

// Builds `<root>/workspace/node_modules/@pbuilder/sdk` (the real shipped package shape)
// plus `<root>/external/foo/factory.mjs` — an anchor with no `node_modules` ancestor, so
// NODE_PATH is the only route by which it can reach the SDK.
function buildFixture(options: { withMain: boolean }): string {
  // realpath: on macOS `tmpdir()` is the /var -> /private/var symlink, and the resolver
  // reports the real path — the same reason `single-instance-probe.ts` normalises.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "fit-47-")));
  const pkgRoot = join(root, "workspace/node_modules/@pbuilder/sdk");
  mkdirSync(join(pkgRoot, "dist"), { recursive: true });
  mkdirSync(join(root, "external/foo"), { recursive: true });

  const pkg: Record<string, unknown> = {
    name: "@pbuilder/sdk",
    version: "0.0.0-fixture",
    type: shipped.type,
    exports: { ".": shipped.exports["."] },
  };
  if (options.withMain) pkg.main = shipped.main;
  writeFileSync(join(pkgRoot, "package.json"), JSON.stringify(pkg, null, 2));

  // Resolution-only test: the entry point never needs the real implementation, but it must
  // live at the path the shipped `main`/`exports` point to, or the resolver is being asked
  // a different question than production asks.
  writeFileSync(join(pkgRoot, "dist/index.js"), "export const create = () => {};\nexport const dryRun = () => {};\n");

  writeFileSync(
    join(root, "external/foo/factory.mjs"),
    'import { create, dryRun } from "@pbuilder/sdk";\nexport default () => `${typeof create},${typeof dryRun}`;\n'
  );

  // Runs from INSIDE the workspace SDK copy, as the real runner does, and exercises both
  // legs: the probe's `createRequire(...).resolve` and the factory's own ESM import.
  writeFileSync(
    join(pkgRoot, "entry.mjs"),
    [
      'import { createRequire } from "node:module";',
      "const url = new URL(`file://${process.argv[2]}`).href;",
      'try { console.log("resolve", createRequire(url).resolve("@pbuilder/sdk")); }',
      'catch (e) { console.log("resolve FAIL", e.code); }',
      'try { const m = await import(url); console.log("import", m.default()); }',
      'catch (e) { console.log("import FAIL", e.code); }',
      "",
    ].join("\n")
  );
  return root;
}

describe("FIT-47 — NODE_PATH resolves the SDK for a factory outside the workspace (SDK #91)", () => {
  it('package.json declares "main", the only field Bun\'s NODE_PATH leg consults', () => {
    expect(shipped.main).toBeDefined();
  });

  it('"main" and the "." export resolve to the same entry point — one umbrella entry, not two', () => {
    expect(shipped.main).toBe(shipped.exports["."].import);
  });

  it("an external factory resolves the workspace SDK copy on BOTH legs (probe + ESM import)", () => {
    const root = buildFixture({ withMain: true });
    const { resolved, imported, raw } = runProbe(root);

    expect(resolved, `probe leg did not resolve.\n${raw}`).toBe(join(root, "workspace/node_modules/@pbuilder/sdk/dist/index.js"));
    expect(imported, `import leg did not resolve.\n${raw}`).toBe("function,function");
  });

  it("negative control: the SAME fixture without `main` fails on both legs (proves `main` is the variable)", () => {
    const root = buildFixture({ withMain: false });
    const { resolved, imported, raw } = runProbe(root);

    expect(resolved, `expected no resolution without "main".\n${raw}`).toBeNull();
    expect(imported, `expected no import without "main".\n${raw}`).toBeNull();
  });
});
