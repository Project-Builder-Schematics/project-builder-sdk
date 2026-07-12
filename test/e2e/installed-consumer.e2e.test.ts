/**
 * Installed-consumer-vantage e2e (S-004, REQ-TES-02/06, ADR-0036): proves reachability AND
 * the two founding-bug scenarios from a REAL installed consumer's own vantage — build,
 * `bun pm pack`, install the tarball into a scratch dir, `import(...)` BY PACKAGE NAME (never
 * a relative `dist` path). A relative import never exercises the `exports` map — the exact
 * gap this proves.
 *
 * The scratch consumer is packed + installed ONCE (memoized via `ensureInstalledConsumer`)
 * and reused across every scenario below — installing is the expensive step; the small check
 * scripts each scenario writes and runs against it are cheap.
 *
 * Each scenario spawns a small `.mjs` script INSIDE the scratch consumer (so its imports
 * resolve through the consumer's OWN `node_modules`, never the repo's `src`) and reports its
 * findings back as one line of JSON on stdout. Identity-sensitive checks (`instanceof
 * AuthoringError`) run INSIDE that script, against the installed package's OWN class
 * reference — a check from outside would compare against the wrong module instance.
 *
 * Hardening (ADR-0036, SEC-m2): `bun install --ignore-scripts` blocks lifecycle-script network
 * egress (the actual supply-chain concern) — the strongest remaining guard once a real
 * dependency exists. Originally paired with a non-routable `BUN_CONFIG_REGISTRY` for
 * belt-and-suspenders zero-deps-era hardening (SEC-m2's ORIGINAL text); stage-5-first-dialect
 * is the FIRST change to give this package a real runtime dependency (ts-morph, REQ-TSD-06,
 * D5) — the scratch install now legitimately needs registry access to resolve it, so the
 * non-routable override was removed (it would fail EVERY install now, not just an accidental
 * one). `--ignore-scripts` alone still catches the attack this guard exists for: a malicious
 * postinstall script phoning home. The scratch install gets its OWN lockfile inside the
 * scratch dir — the repo's lockfile hash is asserted unchanged before/after. `afterAll` always
 * removes the scratch dir (tarball lives inside it, so one `rm -rf` covers both).
 */
import { describe, it, expect, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-testing-e2e");
const REPO_LOCKFILE = join(PROJECT_ROOT, "bun.lock");

// Golden committed-tree fixture (REQ-TES-06.2, the write-only founding-bug case).
const GOLDEN_PATH = "golden/greeting.ts";
const GOLDEN_CONTENT = "export const greeting = 'hello';";

// Colliding-batch fixture (REQ-TES-06.3, the all-or-nothing rejection case — ATH-03's shape).
const COLLIDING_PATH = "a.ts";
const COLLIDING_SEED = "old";
const COLLIDING_TEMPLATE = "new";

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function cleanScratch(): void {
  if (existsSync(SCRATCH_DIR)) rmSync(SCRATCH_DIR, { recursive: true, force: true });
}

function runScratchScript(fileName: string, source: string): string {
  writeFileSync(join(SCRATCH_DIR, fileName), source);
  const result = spawnSync("bun", ["run", fileName], { cwd: SCRATCH_DIR, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`scratch consumer script "${fileName}" failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function parseLastJsonLine(stdout: string): unknown {
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1] ?? "");
}

let repoLockfileHashBefore: string | undefined;
let installedConsumerReady: Promise<void> | undefined;

/**
 * Builds, packs, and installs the package into `.tmp-testing-e2e/` at most ONCE per process
 * (memoized) — every scenario below shares this one installed consumer rather than each
 * re-packing/re-installing.
 */
function ensureInstalledConsumer(): Promise<void> {
  if (installedConsumerReady !== undefined) {
    return installedConsumerReady;
  }

  installedConsumerReady = (async () => {
    ensureTscBuild();
    repoLockfileHashBefore = hashFile(REPO_LOCKFILE);

    cleanScratch();
    mkdirSync(SCRATCH_DIR, { recursive: true });

    // Pack the built package into a real tarball, written straight into the scratch dir.
    const packResult = spawnSync(
      "bun",
      ["pm", "pack", "--destination", SCRATCH_DIR, "--quiet"],
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    if (packResult.status !== 0) {
      throw new Error(`bun pm pack failed:\n${packResult.stdout}\n${packResult.stderr}`);
    }
    const tarballPath = packResult.stdout.trim();
    if (!existsSync(tarballPath)) {
      throw new Error(`bun pm pack did not produce a tarball at ${tarballPath}`);
    }

    // The scratch consumer gets its OWN package.json/lockfile — isolated from the repo's.
    writeFileSync(
      join(SCRATCH_DIR, "package.json"),
      JSON.stringify(
        {
          name: "installed-consumer-scratch",
          version: "0.0.0",
          private: true,
          type: "module",
          dependencies: { "@pbuilder/sdk": `file:${tarballPath}` },
        },
        null,
        2
      )
    );

    // `--ignore-scripts` (SEC-m2): blocks lifecycle-script network egress — the actual
    // supply-chain guard. The `file:` dependency itself never needs the registry, but its
    // OWN `ts-morph` dependency (this change's first real one) does; the registry is left at
    // its ambient default rather than forced non-routable (see file-header doc comment).
    const installResult = spawnSync("bun", ["install", "--ignore-scripts"], {
      cwd: SCRATCH_DIR,
      encoding: "utf-8",
      env: process.env,
    });
    if (installResult.status !== 0) {
      throw new Error(`scratch bun install failed:\n${installResult.stdout}\n${installResult.stderr}`);
    }
  })();

  return installedConsumerReady;
}

afterAll(() => {
  cleanScratch();
});

describe("e2e — installed-consumer-vantage (S-004, REQ-TES-02/06, ADR-0036)", () => {
  it("REQ-TES-02.1/REQ-TES-06.1: defineFactory resolves ONLY via ./testing; ./commons resolves without it; ./core stays unresolvable", async () => {
    await ensureInstalledConsumer();

    // The scratch install must never touch the repo's own lockfile.
    if (repoLockfileHashBefore === undefined) {
      throw new Error("ensureInstalledConsumer did not capture repoLockfileHashBefore");
    }
    expect(hashFile(REPO_LOCKFILE)).toEqual(repoLockfileHashBefore);

    const stdout = runScratchScript(
      "check-resolution.mjs",
      [
        "async function probe(spec) {",
        "  try {",
        "    const mod = await import(spec);",
        '    return { resolved: true, hasDefineFactory: "defineFactory" in mod };',
        "  } catch {",
        "    return { resolved: false, hasDefineFactory: false };",
        "  }",
        "}",
        "const results = {",
        '  root: await probe("@pbuilder/sdk"),',
        '  commons: await probe("@pbuilder/sdk/commons"),',
        '  conformance: await probe("@pbuilder/sdk/conformance"),',
        '  testing: await probe("@pbuilder/sdk/testing"),',
        '  core: await probe("@pbuilder/sdk/core"),',
        "};",
        "console.log(JSON.stringify(results));",
        "",
      ].join("\n")
    );

    const results = parseLastJsonLine(stdout) as Record<
      string,
      { resolved: boolean; hasDefineFactory: boolean }
    >;

    // TES-02.1: defineFactory present ONLY on ./testing's exports.
    expect(results.testing?.resolved).toBe(true);
    expect(results.testing?.hasDefineFactory).toBe(true);
    expect(results.root?.resolved).toBe(true);
    expect(results.root?.hasDefineFactory).toBe(false);
    expect(results.commons?.resolved).toBe(true);
    expect(results.commons?.hasDefineFactory).toBe(false);
    expect(results.conformance?.resolved).toBe(true);
    expect(results.conformance?.hasDefineFactory).toBe(false);

    // TES-06.1: @pbuilder/sdk/core remains unresolvable by subpath.
    expect(results.core?.resolved).toBe(false);
  });

  it("REQ-TES-06.2: a write-only factory commits to a golden tree through the published entry (founding bug)", async () => {
    await ensureInstalledConsumer();

    const stdout = runScratchScript(
      "check-write-only.mjs",
      [
        'import { defineFactory, runFactoryForTest } from "@pbuilder/sdk/testing";',
        'import { create } from "@pbuilder/sdk/commons";',
        "",
        "const run = defineFactory(() => {",
        `  create(${JSON.stringify(GOLDEN_PATH)}, { template: ${JSON.stringify(GOLDEN_CONTENT)}, options: {} });`,
        "});",
        "",
        "const result = await runFactoryForTest(run, undefined);",
        "console.log(JSON.stringify({",
        "  tree: Object.fromEntries(result.tree),",
        "  errorIsUndefined: result.error === undefined,",
        "}));",
        "",
      ].join("\n")
    );

    const { tree, errorIsUndefined } = parseLastJsonLine(stdout) as {
      tree: Record<string, string>;
      errorIsUndefined: boolean;
    };

    expect(errorIsUndefined).toBe(true);
    expect(tree).toEqual({ [GOLDEN_PATH]: GOLDEN_CONTENT });
  });

  it("REQ-TES-06.3: an all-or-nothing rejection surfaces an author-assertable AuthoringError through the published entry", async () => {
    await ensureInstalledConsumer();

    const stdout = runScratchScript(
      "check-collision.mjs",
      [
        'import { defineFactory, runFactoryForTest } from "@pbuilder/sdk/testing";',
        'import { create, AuthoringError } from "@pbuilder/sdk/commons";',
        "",
        "const run = defineFactory(() => {",
        `  create(${JSON.stringify(COLLIDING_PATH)}, { template: ${JSON.stringify(COLLIDING_TEMPLATE)}, options: {} });`,
        "});",
        "",
        `const result = await runFactoryForTest(run, undefined, { ${JSON.stringify(COLLIDING_PATH)}: ${JSON.stringify(COLLIDING_SEED)} });`,
        "const isAuthoringError = result.error instanceof AuthoringError;",
        "console.log(JSON.stringify({",
        "  treeSize: result.tree.size,",
        "  isAuthoringError,",
        "  verb: isAuthoringError ? result.error.verb : undefined,",
        "  path: isAuthoringError ? result.error.path : undefined,",
        "  reason: isAuthoringError ? result.error.reason : undefined,",
        "}));",
        "",
      ].join("\n")
    );

    const { treeSize, isAuthoringError, verb, path, reason } = parseLastJsonLine(stdout) as {
      treeSize: number;
      isAuthoringError: boolean;
      verb: string | undefined;
      path: string | undefined;
      reason: string | undefined;
    };

    // Consumer-side AuthoringError narrowing via the installed package's own export.
    expect(treeSize).toEqual(0);
    expect(isAuthoringError).toBe(true);
    expect(verb).toEqual("create");
    expect(path).toEqual(COLLIDING_PATH);
    expect(reason).toEqual("path-collision");
  });
});
