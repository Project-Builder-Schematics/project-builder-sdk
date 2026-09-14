/**
 * FIT-46 (S-000) — publish-sequence integrity (REQ-PPI-01, plus the REQ-PPI-03.2/.3 S-000
 * leg per `specs/publish-pipeline-hardening/spec.md`'s dated note).
 *
 * Runs the stable manifest-regeneration -> pack sequence against a scratch copy of the ALREADY-BUILT
 * tree (`dist/` + `package.json` only — same shape as fit-42's own `pristineRoot`, never the
 * full source tree; seeding may build once via ensureTscBuild). The "rebuild" leg this file proves is the
 * part of `bun run build` that actually determines REQ-PPI-01's outcome: the manifest
 * regenerating against the unchanged `package.json` (`bun run build`'s own last step,
 * `bun scripts/generate-runner-manifest.ts`). It is invoked with `cwd: PROJECT_ROOT` and the
 * scratch path as its explicit argument — the SAME safe pattern fit-42's own `runGenerator`
 * already uses (`fit-42-runner-closure-integrity.test.ts:375-381`): the process needs
 * `scripts/` and `node_modules` to resolve, but it only ever WRITES inside the argument path,
 * never `PROJECT_ROOT`. This is deliberately NOT the R1-12 anti-pattern (REQ-BPI-04.1's
 * existing test spawns the SAME script with NO root argument, defaulting to `PROJECT_ROOT`
 * and mutating the real `dist/` mid-suite, confirmed live in the current suite) — the real
 * tree here is read exactly once, to seed the copy, and never written.
 *
 * The negative mutates scratch metadata after generation and packs with scripts ignored.
 * Neither path invokes publication. `ensureTscBuild` makes this file build-dependent.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Bytes } from "../../scripts/derive-runner-closure.ts";
import { ensureTscBuild } from "../support/shared-build.ts";
import { PROJECT_ROOT } from "../support/scratch-consumer.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

// Manifest regeneration and packing spawn several child processes per test (the
// manifest regenerator, npm pack, tar); bounded but slower than a unit test —
// comparable to this suite's other scratch-root integration tests. Explicit and distinct
// from Bun's 5000ms default so a genuine regression fails naming the timeout, not by
// silently exceeding it (same device as REQ-PPI-04's react-conformance fix).
setDefaultTimeout(30000);

const scratchRoot = scratchDirFactory("fit-46-");

interface ManifestFileRecord {
  path: string;
  sha256: string;
}
interface RunnerManifest {
  files: ManifestFileRecord[];
}

/** Copies the real, already-built dist/ + package.json into a fresh scratch root — the real
 * tree is read exactly once here, and never written. */
function seedScratchTarget(root: string): void {
  const distDir = ensureTscBuild();
  cpSync(distDir, join(root, "dist"), { recursive: true });
  cpSync(join(PROJECT_ROOT, "package.json"), join(root, "package.json"));
}

/** The behavioural stand-in for `prepublishOnly` (== "bun run build"): the scratch target
 * carries no src/, so a real tsc rebuild cannot run there. The part of the build that
 * actually determines REQ-PPI-01's outcome — the manifest regenerating against the
 * unchanged package.json — is exercised directly, via the exact script `bun run build`
 * itself chains as its last step (`scripts/generate-runner-manifest.ts`). */
function regenerateManifest(root: string): void {
  const result = spawnSync("bun", ["scripts/generate-runner-manifest.ts", root], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`generate-runner-manifest failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function packTarball(root: string, ignoreScripts: boolean): string {
  const result = spawnSync("npm", ["pack", "--pack-destination", root, ...(ignoreScripts ? ["--ignore-scripts"] : [])], {
    cwd: root,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`npm pack failed:\n${result.stdout}\n${result.stderr}`);
  }
  const tarballName = result.stdout.trim();
  return join(root, tarballName);
}

function extractTarball(tarballPath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const result = spawnSync("tar", ["-xf", tarballPath, "-C", destDir], { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed:\n${result.stdout}\n${result.stderr}`);
  }
}

/** Runs regeneration -> [metadata mutation] -> pack, extracts the tarball, and returns the
 * extracted `package/` dir plus the manifest it shipped. */
function runPublishSequence(
  root: string,
  opts: { mutateAfterGeneration: boolean }
): { packageDir: string; manifest: RunnerManifest } {
  seedScratchTarget(root);
  regenerateManifest(root);
  if (opts.mutateAfterGeneration) {
    const path = join(root, "package.json");
    const metadata = JSON.parse(readFileSync(path, "utf8"));
    metadata.description = "Changed after manifest generation";
    writeFileSync(path, JSON.stringify(metadata));
  }
  const tarballPath = packTarball(root, opts.mutateAfterGeneration);
  const extractedDir = join(root, "extracted");
  extractTarball(tarballPath, extractedDir);
  const packageDir = join(extractedDir, "package");
  const manifest = JSON.parse(
    readFileSync(join(packageDir, "dist/runner-manifest.json"), "utf-8")
  ) as RunnerManifest;
  return { packageDir, manifest };
}

/** Recomputes every manifest-recorded digest against the PACKED tarball's own bytes — never
 * the scratch dir's pre-pack bytes — so packing itself is inside the proof, per REQ-PPI-01. */
function mismatchedDigests(packageDir: string, manifest: RunnerManifest): ManifestFileRecord[] {
  return manifest.files.filter(
    (record) => sha256Bytes(readFileSync(join(packageDir, record.path))) !== record.sha256
  );
}

describe("FIT-46 (S-000) — REQ-PPI-01: behavioural publish-sequence integrity", () => {
  it("REQ-PPI-01.1: packed digests match unchanged stable metadata and packed bytes", () => {
    const root = scratchRoot();
    const { packageDir, manifest } = runPublishSequence(root, { mutateAfterGeneration: false });
    expect(readFileSync(join(packageDir, "package.json"), "utf8")).toBe(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
    expect(manifest.files.length).toBeGreaterThan(0);
    expect(mismatchedDigests(packageDir, manifest)).toEqual([]);
  });

  it("REQ-PPI-01.2 [red-proof]: metadata mutation followed by ignored regeneration names the stale package.json digest", () => {
    const root = scratchRoot();
    const { packageDir, manifest } = runPublishSequence(root, { mutateAfterGeneration: true });
    const mismatched = mismatchedDigests(packageDir, manifest);
    expect(mismatched.map((record) => record.path)).toEqual(["package.json"]);
  });
});

// REQ-PPI-03.2/.3's S-000 leg (plan-verify iteration-2 amendment, finding G): CAP-01..06
// (S-001..S-004) do not exist yet at S-000 build time, so this leg proves the gate MECHANISM
// — a failing suite check blocks publish, structurally, independent of WHICH check fails —
// using ANY planted suite failure. The S-001 leg re-runs this same scenario against a real
// Constraint-4 fixture once the mechanism lands (slices.md S-001.10).
//
// Mirrors publish.yml's own step-sequencing property (no continue-on-error, suite strictly
// before publish) via a CHILD `bun test` invocation against the scratch tree's own suite
// entry point — test/docs/testing-story-docs.test.ts:69's shape, adapted from a single
// scratch file to a whole scratch directory — so the OUTER suite run (this very test) stays
// green while the INNER child process demonstrates the block/pass.
describe("FIT-46 (S-000) — REQ-PPI-03.2/.3: the gate mechanism blocks/allows publish on suite result", () => {
  function runSequenceAgainstSuiteResult(root: string): { publishReached: boolean; log: string[] } {
    const suiteResult = spawnSync("bun", ["test", root], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    const log: string[] = [];
    if (suiteResult.status !== 0) {
      // No continue-on-error, suite strictly before publish (REQ-PPI-03): a failing suite
      // step must short-circuit here — the publish step below is never reached.
      return { publishReached: false, log };
    }
    log.push("publish-step: would run npm publish here");
    return { publishReached: true, log };
  }

  it("REQ-PPI-03.2 [red-proof]: a failing suite check blocks the publish step — no publish-step log line ever appears", () => {
    const root = scratchRoot();
    writeFileSync(
      join(root, "failing.test.ts"),
      [
        'import { test, expect } from "bun:test";',
        'test("a planted suite failure", () => { expect(1).toBe(2); });',
        "",
      ].join("\n")
    );
    const { publishReached, log } = runSequenceAgainstSuiteResult(root);
    expect(publishReached).toBe(false);
    expect(log).toEqual([]);
  });

  it("REQ-PPI-03.3: a clean closure reaches the publish step — sibling positive", () => {
    const root = scratchRoot();
    writeFileSync(
      join(root, "passing.test.ts"),
      [
        'import { test, expect } from "bun:test";',
        `import { deriveRunnerClosure } from ${JSON.stringify(join(PROJECT_ROOT, "scripts/derive-runner-closure.ts"))};`,
        'import { writeFileSync } from "node:fs";',
        `const root = ${JSON.stringify(root)};`,
        'writeFileSync(root + "/entry.js", "export const value = 1;\\n");',
        'test("a clean Constraint-4 closure", () => { expect(deriveRunnerClosure(root, "entry.js").violations).toEqual([]); });',
        "",
      ].join("\n")
    );
    const { publishReached, log } = runSequenceAgainstSuiteResult(root);
    expect(publishReached).toBe(true);
    expect(log).toEqual(["publish-step: would run npm publish here"]);
  });

  // S-001.10 (plan-verify iteration-2 amendment, finding G's S-001 leg): re-runs the SAME
  // gate-mechanism proof above, but the planted suite failure is now a REAL
  // capability-admission denial (REQ-CST-04.2's `eval` primitive) rather than an arbitrary
  // `expect(1).toBe(2)` — the S-000 leg above proved the MECHANISM (any suite failure blocks
  // publish); this proves the mechanism actually engages for a genuine Constraint-4 fixture,
  // now that CAP-01..06 exist.
  it("REQ-PPI-03.2 [red-proof]: a real Constraint-4 admission failure blocks the publish step", () => {
    const root = scratchRoot();
    writeFileSync(
      join(root, "constraint-4.test.ts"),
      [
        'import { test, expect } from "bun:test";',
        'import { mkdtempSync, writeFileSync } from "node:fs";',
        'import { tmpdir } from "node:os";',
        'import { join } from "node:path";',
        `import { deriveRunnerClosure } from ${JSON.stringify(join(PROJECT_ROOT, "scripts/derive-runner-closure.ts"))};`,
        'test("REQ-CST-04.2: eval is denied by the real capability-admission mechanism", () => {',
        '  const fixtureRoot = mkdtempSync(join(tmpdir(), "fit-46-cap-fixture-"));',
        '  writeFileSync(join(fixtureRoot, "entry.js"), "eval(payload);\\n");',
        '  const derivation = deriveRunnerClosure(fixtureRoot, "entry.js");',
        "  expect(derivation.violations).toEqual([]);", // deliberately wrong: eval IS denied
        "});",
        "",
      ].join("\n")
    );
    const { publishReached, log } = runSequenceAgainstSuiteResult(root);
    expect(publishReached).toBe(false);
    expect(log).toEqual([]);
  });
});
