/**
 * Installed-consumer-vantage e2e (S-004 [stage-5], REQ-TES-06/08, ADR-0036; extended S-000
 * [stage-6], REQ-LC-01/04/05, ADR-0041): proves reachability AND the two founding-bug
 * scenarios from a REAL installed/linked consumer's own vantage — build, then EITHER
 * `bun pm pack` + install the tarball (tarball leg) OR `bun run link:sdk` + `bun link` (link
 * leg), into a scratch dir, `import(...)` BY PACKAGE NAME (never a relative `dist` path). A
 * relative import never exercises the `exports` map — the exact gap this proves.
 *
 * Both legs share `test/support/scratch-consumer.ts`'s build/pack/install/link +
 * `runScratchScript` seam (design §4.1 "de-forking rather than duplicating") — each leg's
 * scratch consumer is built ONCE (memoized) and reused across its own scenarios; installing
 * is the expensive step, the small check scripts each scenario writes and runs against it
 * are cheap.
 *
 * Each scenario spawns a small `.mjs` script INSIDE the scratch consumer (so its imports
 * resolve through the consumer's OWN `node_modules`, never the repo's `src`) and reports its
 * findings back as one line of JSON on stdout. Identity-sensitive checks (`instanceof
 * AuthoringError`) run INSIDE that script, against the installed/linked package's OWN class
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
 * removes both scratch dirs (tarball lives inside the tarball-leg's dir, so one `rm -rf`
 * covers both) and releases the bun-link leg's global link-store registration.
 *
 * The `bun link` leg is ADDITIVE (REQ-LC-01/REQ-LC-03) — it never replaces the tarball leg,
 * which remains the release-shape verification vehicle.
 */
import { describe, it, expect, afterAll } from "bun:test";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROJECT_ROOT,
  ensurePackedConsumer,
  ensureLinkedConsumer,
  unlinkSdk,
  cleanScratchDir,
  runScratchScript,
  parseLastJsonLine,
  hashFile,
  repoLockfileHashAtPackTime,
} from "../support/scratch-consumer.ts";
import { spawnCapture } from "../support/canary.ts";

// REQ-LC-04: a structural bin-executability check, shared by both legs' bin-exec scenarios
// AND REQ-LC-04.3's red-proof — never a bare "spawn and check exit code", so a missing bin
// or a malformed shebang can be asserted on directly.
function checkBinExecutable(binPath: string): { ok: boolean; reason?: string } {
  if (!existsSync(binPath)) {
    return { ok: false, reason: `bin not found at ${binPath}` };
  }
  const firstLine = readFileSync(binPath, "utf-8").split("\n")[0];
  if (firstLine !== "#!/usr/bin/env node") {
    return { ok: false, reason: `malformed shebang at ${binPath}: ${JSON.stringify(firstLine)}` };
  }
  return { ok: true };
}

const PACK_SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-testing-e2e");
const LINK_SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-link-e2e");
const REPO_LOCKFILE = join(PROJECT_ROOT, "bun.lock");

// Golden committed-tree fixture (REQ-TES-06.2, the write-only founding-bug case).
const GOLDEN_PATH = "golden/greeting.ts";
const GOLDEN_CONTENT = "export const greeting = 'hello';";

// Colliding-batch fixture (REQ-TES-06.3, the all-or-nothing rejection case — ATH-03's shape).
const COLLIDING_PATH = "a.ts";
const COLLIDING_SEED = "old";
const COLLIDING_TEMPLATE = "new";

// Shared scenario bodies (REQ-LC-02.3 parity by construction): the tarball leg and the
// bun-link leg run the SAME four checks against their own scratch dir — only the install
// vehicle differs, never the assertions.

function assertWriteOnlyCommit(scratchDir: string): void {
  const stdout = runScratchScript(
    scratchDir,
    "check-write-only.mjs",
    [
      'import { runFactoryForTest } from "@pbuilder/sdk/testing";',
      'import { create } from "@pbuilder/sdk/commons";',
      "",
      "const run = () => {",
      `  create(${JSON.stringify(GOLDEN_PATH)}, { template: ${JSON.stringify(GOLDEN_CONTENT)}, options: {} });`,
      "};",
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
}

function assertAllOrNothingRejection(scratchDir: string): void {
  const stdout = runScratchScript(
    scratchDir,
    "check-collision.mjs",
    [
      'import { runFactoryForTest } from "@pbuilder/sdk/testing";',
      'import { create, AuthoringError } from "@pbuilder/sdk/commons";',
      "",
      "const run = () => {",
      `  create(${JSON.stringify(COLLIDING_PATH)}, { template: ${JSON.stringify(COLLIDING_TEMPLATE)}, options: {} });`,
      "};",
      "",
      `const result = await runFactoryForTest(run, undefined, { seed: { ${JSON.stringify(COLLIDING_PATH)}: ${JSON.stringify(COLLIDING_SEED)} } });`,
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

  // Consumer-side AuthoringError narrowing via the installed/linked package's own export.
  expect(treeSize).toEqual(0);
  expect(isAuthoringError).toBe(true);
  expect(verb).toEqual("create");
  expect(path).toEqual(COLLIDING_PATH);
  expect(reason).toEqual("path-collision");
}

// REQ-LC-04: both legs check bin-executability the same way (checkBinExecutable) before
// spawning it — a missing bin or a malformed shebang is asserted on directly either way.
function assertCodegenBinRuns(scratchDir: string): void {
  writeFileSync(
    join(scratchDir, "schema.json"),
    JSON.stringify({
      properties: { port: { type: "number", label: "Server port", required: true } },
    }),
    "utf-8"
  );

  const binPath = join(scratchDir, "node_modules", ".bin", "pbuilder-codegen");
  expect(checkBinExecutable(binPath)).toEqual({ ok: true });

  const result = spawnCapture(binPath, ["."], { cwd: scratchDir });

  expect(result.status).toEqual(0);
  expect(result.stdout).toContain("pbuilder-codegen: wrote schema.generated.ts");

  const generated = readFileSync(join(scratchDir, "schema.generated.ts"), "utf-8");
  expect(generated).toContain("port: number;");
}

function assertDryRunNonEmpty(scratchDir: string): void {
  const stdout = runScratchScript(
    scratchDir,
    "check-dry-run.mjs",
    [
      'import { runFactoryForTest } from "@pbuilder/sdk/testing";',
      'import { create, dryRun } from "@pbuilder/sdk/commons";',
      "",
      "let planLength;",
      "const run = () => {",
      '  create("plan-probe.ts", { template: "export const x = 1;", options: {} });',
      "  planLength = dryRun().length;",
      "};",
      "",
      "await runFactoryForTest(run, undefined);",
      "console.log(JSON.stringify({ planLength }));",
      "",
    ].join("\n")
  );

  const { planLength } = parseLastJsonLine(stdout) as { planLength: number };

  // Non-empty-plan assertion, not mere key presence (the red-proof group below fences the
  // weaker, key-presence-only check).
  expect(planLength).toBeGreaterThan(0);
}

// REQ-TES-06.4: a stale `defineFactory` NAMED import must fail to resolve — proving the
// removal is a compile-time/link-time signal, not merely a documentation change. Unlike the
// dynamic `import()` + `"x" in mod` probe above (a namespace-membership check that would
// never throw even if `defineFactory` were absent), a STATIC `import { defineFactory } from
// "..."` against a module that doesn't export it is a SyntaxError at link time in both Node
// and Bun ESM — this writes exactly that script and asserts it fails, never using
// `runScratchScript` (which throws on non-zero exit — the wrong shape for a scenario whose
// whole point IS a non-zero exit).
function assertDefineFactoryImportFailsToResolve(scratchDir: string): void {
  const fileName = "check-stale-import.mjs";
  writeFileSync(
    join(scratchDir, fileName),
    [
      'import { defineFactory } from "@pbuilder/sdk/testing";',
      "console.log(typeof defineFactory);",
      "",
    ].join("\n")
  );

  const result = spawnCapture("bun", ["run", fileName], { cwd: scratchDir });

  expect(result.status).not.toEqual(0);
  expect(result.stderr).toContain("defineFactory");
}

afterAll(() => {
  cleanScratchDir(PACK_SCRATCH_DIR);
  cleanScratchDir(LINK_SCRATCH_DIR);
  unlinkSdk();
});

describe("e2e — installed-consumer-vantage, tarball leg (REQ-TES-06/08, ADR-0036)", () => {
  it("REQ-TES-06.1/REQ-TES-08.1/REQ-LC-03.1: defineFactory is unreachable via ./testing; ./commons resolves without it; ./typescript resolves; ./core stays unresolvable", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);

    // The scratch install must never touch the repo's own lockfile.
    expect(hashFile(REPO_LOCKFILE)).toEqual(repoLockfileHashAtPackTime());

    const stdout = runScratchScript(
      PACK_SCRATCH_DIR,
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
        '  typescript: await probe("@pbuilder/sdk/typescript"),',
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

    // TES-08.1: defineFactory is NOT among ./testing's resolved exports.
    expect(results.testing?.resolved).toBe(true);
    expect(results.testing?.hasDefineFactory).toBe(false);
    expect(results.root?.resolved).toBe(true);
    expect(results.root?.hasDefineFactory).toBe(false);
    expect(results.commons?.resolved).toBe(true);
    expect(results.commons?.hasDefineFactory).toBe(false);
    expect(results.conformance?.resolved).toBe(true);
    expect(results.conformance?.hasDefineFactory).toBe(false);

    // REQ-LC-03.1: the probe set extends to ./typescript, additive to the pre-existing set.
    expect(results.typescript?.resolved).toBe(true);
    expect(results.typescript?.hasDefineFactory).toBe(false);

    // TES-06.1: @pbuilder/sdk/core remains unresolvable by subpath.
    expect(results.core?.resolved).toBe(false);
  });

  it("REQ-TES-06.2: a write-only factory commits to a golden tree through the published entry (founding bug)", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);
    assertWriteOnlyCommit(PACK_SCRATCH_DIR);
  });

  it("REQ-TES-06.3: an all-or-nothing rejection surfaces an author-assertable AuthoringError through the published entry", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);
    assertAllOrNothingRejection(PACK_SCRATCH_DIR);
  });

  it("REQ-LC-04.1: pbuilder-codegen runs from the tarball-installed consumer's node_modules/.bin against a schema.json fixture", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);
    assertCodegenBinRuns(PACK_SCRATCH_DIR);
  });

  it("REQ-LC-05.2: tarball leg invokes dryRun() via ./commons and returns a non-empty plan", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);
    assertDryRunNonEmpty(PACK_SCRATCH_DIR);
  });

  it("REQ-TES-06.4: a stale defineFactory import fails to resolve through the published entry", async () => {
    await ensurePackedConsumer(PACK_SCRATCH_DIR);
    assertDefineFactoryImportFailsToResolve(PACK_SCRATCH_DIR);
  });
});

describe("e2e — installed-consumer-vantage, bun-link leg (S-000/S-001, REQ-LC-01/02/04/05, ADR-0041)", () => {
  it("REQ-LC-01.1/REQ-LC-01.2: all five subpaths resolve via bun link; ./core stays unresolvable", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);

    const stdout = runScratchScript(
      LINK_SCRATCH_DIR,
      "check-resolution.mjs",
      [
        "async function probe(spec) {",
        "  try {",
        "    await import(spec);",
        "    return { resolved: true };",
        "  } catch {",
        "    return { resolved: false };",
        "  }",
        "}",
        "const results = {",
        '  root: await probe("@pbuilder/sdk"),',
        '  commons: await probe("@pbuilder/sdk/commons"),',
        '  conformance: await probe("@pbuilder/sdk/conformance"),',
        '  testing: await probe("@pbuilder/sdk/testing"),',
        '  typescript: await probe("@pbuilder/sdk/typescript"),',
        '  core: await probe("@pbuilder/sdk/core"),',
        "};",
        "console.log(JSON.stringify(results));",
        "",
      ].join("\n")
    );

    const results = parseLastJsonLine(stdout) as Record<string, { resolved: boolean }>;

    // REQ-LC-01.1: all five public subpaths resolve by package name.
    expect(results.root?.resolved).toBe(true);
    expect(results.commons?.resolved).toBe(true);
    expect(results.conformance?.resolved).toBe(true);
    expect(results.testing?.resolved).toBe(true);
    expect(results.typescript?.resolved).toBe(true);

    // REQ-LC-01.2: @pbuilder/sdk/core remains unresolvable by subpath.
    expect(results.core?.resolved).toBe(false);
  });

  it("REQ-LC-04.2: pbuilder-codegen runs from the bun-link-installed consumer's node_modules/.bin against a schema.json fixture", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);
    assertCodegenBinRuns(LINK_SCRATCH_DIR);
  });

  it("REQ-LC-05.1: bun-link leg invokes dryRun() via ./commons and returns a non-empty plan", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);
    assertDryRunNonEmpty(LINK_SCRATCH_DIR);
  });

  it("REQ-LC-02.1: a write-only factory commits to a golden tree through the bun-link-installed entry (founding bug parity)", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);
    assertWriteOnlyCommit(LINK_SCRATCH_DIR);
  });

  it("REQ-LC-02.2: an all-or-nothing rejection surfaces an author-assertable AuthoringError through the bun-link-installed entry (founding bug parity)", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);
    assertAllOrNothingRejection(LINK_SCRATCH_DIR);
  });

  it("REQ-TES-06.4: a stale defineFactory import fails to resolve through the bun-link-installed entry", async () => {
    await ensureLinkedConsumer(LINK_SCRATCH_DIR);
    assertDefineFactoryImportFailsToResolve(LINK_SCRATCH_DIR);
  });
});

// REQ-LC-02.3 parity, made STRUCTURAL: a hand-typed pair of literal arrays can only ever
// disagree with itself, never with the actual test code. Now that FIX-3 above extracted the
// five shared scenario bodies, real parity means both legs' `describe` blocks actually CALL
// every one of them, plus exactly one leg-specific subpath-resolution scenario each — so this
// scans THIS file's own source rather than asserting a second copy of the scenario list.
const SHARED_SCENARIO_HELPERS = [
  "assertWriteOnlyCommit",
  "assertAllOrNothingRejection",
  "assertCodegenBinRuns",
  "assertDryRunNonEmpty",
  "assertDefineFactoryImportFailsToResolve",
] as const;

// Splits this file's own source into per-top-level-`describe`-block chunks (0-indent
// `describe(` calls — this file's own consistent formatting) and returns the one whose
// TITLE LINE contains `titleFragment` — matching anywhere in the chunk would also hit
// later blocks that mention the title as a string argument.
function extractDescribeBlock(source: string, titleFragment: string): string {
  const chunks = source.split(/\n(?=describe\()/);
  const chunk = chunks.find(
    (c) => c.startsWith("describe(") && c.slice(0, c.indexOf("\n")).includes(titleFragment)
  );
  if (chunk === undefined) {
    throw new Error(`missing a top-level describe block containing "${titleFragment}"`);
  }
  return chunk;
}

// Counts the block's DIRECT `it(` children (2-space indent — one level of describe nesting).
function countTopLevelIts(block: string): number {
  return [...block.matchAll(/^ {2}it\(/gm)].length;
}

describe("e2e — installed-consumer-vantage, cross-leg red-proofs (REQ-LC-02.3/04.3/05.3, S-001.3)", () => {
  it("[red-proof] REQ-LC-02.3: the bun-link leg's scenario-group count matches the tarball leg's", () => {
    const selfSource = readFileSync(new URL(import.meta.url).pathname, "utf-8");
    const tarballBlock = extractDescribeBlock(selfSource, "tarball leg (REQ-TES-06/08, ADR-0036)");
    const bunLinkBlock = extractDescribeBlock(
      selfSource,
      "bun-link leg (S-000/S-001, REQ-LC-01/02/04/05, ADR-0041)"
    );

    // Both legs call every one of the five shared scenario bodies — never a reduced subset.
    for (const helper of SHARED_SCENARIO_HELPERS) {
      expect(tarballBlock).toContain(`${helper}(`);
      expect(bunLinkBlock).toContain(`${helper}(`);
    }

    // Each leg has exactly ONE scenario beyond the five shared ones: its own
    // subpath-resolution probe (leg-specific import specifiers, never de-forked).
    expect(countTopLevelIts(tarballBlock)).toEqual(SHARED_SCENARIO_HELPERS.length + 1);
    expect(countTopLevelIts(bunLinkBlock)).toEqual(SHARED_SCENARIO_HELPERS.length + 1);
  });

  // RED-PROOF (REQ-LC-04.3): a missing bin or a malformed shebang is caught by name.
  it("[red-proof] REQ-LC-04.3: a missing bin entry is caught", () => {
    const missingBinPath = join(LINK_SCRATCH_DIR, "node_modules", ".bin", "does-not-exist");
    expect(checkBinExecutable(missingBinPath)).toEqual({
      ok: false,
      reason: `bin not found at ${missingBinPath}`,
    });
  });

  it("[red-proof] REQ-LC-04.3: a malformed shebang is caught", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const scratchDir = mkdtempSync(join(tmpdir(), "fit-bin-shebang-"));
    const brokenBinPath = join(scratchDir, "broken-bin");
    writeFileSync(brokenBinPath, "#!/bin/sh -e\nconsole.log('not a real shebang');\n");

    const result = checkBinExecutable(brokenBinPath);
    rmSync(scratchDir, { recursive: true, force: true });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("malformed shebang");
  });

  // RED-PROOF (REQ-LC-05.3): a key-presence-only assertion is insufficient — it would pass
  // even against a broken dryRun() that returns an empty plan, which is exactly what
  // REQ-LC-05.1/.2's real-invocation, non-empty-plan assertions above are designed to catch.
  it("[red-proof] REQ-LC-05.3: a key-presence-only check does not catch a broken (empty-plan) dryRun()", () => {
    const keyPresenceOnly = (namespaceKeys: string[]): boolean => namespaceKeys.includes("dryRun");
    const brokenNamespaceKeys = ["dryRun"]; // the key is present...
    const brokenPlan: unknown[] = []; // ...but calling it actually returns an empty plan.

    expect(keyPresenceOnly(brokenNamespaceKeys)).toBe(true); // fooled — key-presence is too weak
    expect(brokenPlan.length).toBe(0); // the actual broken behavior a real invocation would surface
  });
});
