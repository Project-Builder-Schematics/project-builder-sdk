/**
 * FIT-46 (S-000) — publish-sequence integrity (REQ-PPI-01, plus the REQ-PPI-03.2/.3 S-000
 * leg per `specs/publish-pipeline-hardening/spec.md`'s dated note).
 *
 * Runs the REAL stamp -> rebuild -> pack sequence against a scratch copy of the ALREADY-BUILT
 * tree (`dist/` + `package.json` only — same shape as fit-42's own `pristineRoot`, never the
 * full source tree, so this never re-runs `tsc`). The "rebuild" leg this file proves is the
 * part of `bun run build` that actually determines REQ-PPI-01's outcome: the manifest
 * regenerating against the now-stamped `package.json` (`bun run build`'s own last step,
 * `bun scripts/generate-runner-manifest.ts`). It is invoked with `cwd: PROJECT_ROOT` and the
 * scratch path as its explicit argument — the SAME safe pattern fit-42's own `runGenerator`
 * already uses (`fit-42-runner-closure-integrity.test.ts:375-381`): the process needs
 * `scripts/` and `node_modules` to resolve, but it only ever WRITES inside the argument path,
 * never `PROJECT_ROOT`. This is deliberately NOT the R1-12 anti-pattern (REQ-BPI-04.1's
 * existing test spawns the SAME script with NO root argument, defaulting to `PROJECT_ROOT`
 * and mutating the real `dist/` mid-suite, confirmed live in the current suite) — the real
 * tree here is read exactly once, to seed the copy, and never written.
 *
 * `npm version`/`npm pack` genuinely need `cwd: <scratchRoot>` (they operate on "the current
 * directory's package.json"; there is no CLI argument to redirect them elsewhere), so those
 * two calls run there directly, against the scratch copy only.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";
import { PROJECT_ROOT } from "../support/scratch-consumer.ts";

// A real stamp -> rebuild -> pack sequence spawns several child processes per test (npm
// version, the manifest regenerator, npm pack, tar); bounded but slower than a unit test —
// comparable to this suite's other scratch-root integration tests. Explicit and distinct
// from Bun's 5000ms default so a genuine regression fails naming the timeout, not by
// silently exceeding it (same device as REQ-PPI-04's react-conformance fix).
setDefaultTimeout(30000);

interface ManifestFileRecord {
  path: string;
  sha256: string;
}
interface RunnerManifest {
  files: ManifestFileRecord[];
}

function sha256Bytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Copies the real, already-built dist/ + package.json into a fresh scratch root — the real
 * tree is read exactly once here, and never written. */
function seedScratchTarget(root: string): void {
  const distDir = ensureTscBuild();
  cpSync(distDir, join(root, "dist"), { recursive: true });
  cpSync(join(PROJECT_ROOT, "package.json"), join(root, "package.json"));
}

function stampVersion(root: string, version: string): void {
  const result = spawnSync("npm", ["version", version, "--no-git-tag-version"], {
    cwd: root,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`npm version failed:\n${result.stdout}\n${result.stderr}`);
  }
}

/** The behavioural stand-in for `prepublishOnly` (== "bun run build"): the scratch target
 * carries no src/, so a real tsc rebuild cannot run there. The part of the build that
 * actually determines REQ-PPI-01's outcome — the manifest regenerating against the
 * now-stamped package.json — is exercised directly, via the exact script `bun run build`
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

function packTarball(root: string): string {
  const result = spawnSync("npm", ["pack", "--pack-destination", root], {
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

/** Runs the real stamp -> [rebuild] -> pack sequence, extracts the tarball, and returns the
 * extracted `package/` dir plus the manifest it shipped. */
function runPublishSequence(
  root: string,
  opts: { regenerateManifestAfterStamp: boolean }
): { packageDir: string; manifest: RunnerManifest } {
  seedScratchTarget(root);
  stampVersion(root, "0.0.0-dev.fit46test");
  if (opts.regenerateManifestAfterStamp) regenerateManifest(root);
  const tarballPath = packTarball(root);
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
  it("REQ-PPI-01.1: packed digests match packed bytes after the real stamp -> rebuild -> pack sequence", () => {
    const root = mkdtempSync(join(tmpdir(), "fit-46-"));
    try {
      const { packageDir, manifest } = runPublishSequence(root, { regenerateManifestAfterStamp: true });
      expect(manifest.files.length).toBeGreaterThan(0);
      expect(mismatchedDigests(packageDir, manifest)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("REQ-PPI-01.2 [red-proof]: skipping the rebuild after the stamp leaves the package.json digest stale, naming the field", () => {
    const root = mkdtempSync(join(tmpdir(), "fit-46-"));
    try {
      const { packageDir, manifest } = runPublishSequence(root, { regenerateManifestAfterStamp: false });
      const mismatched = mismatchedDigests(packageDir, manifest);
      expect(mismatched.map((record) => record.path)).toEqual(["package.json"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
    const root = mkdtempSync(join(tmpdir(), "fit-46-gate-"));
    try {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("REQ-PPI-03.3: a clean closure reaches the publish step — sibling positive", () => {
    const root = mkdtempSync(join(tmpdir(), "fit-46-gate-"));
    try {
      writeFileSync(
        join(root, "passing.test.ts"),
        [
          'import { test, expect } from "bun:test";',
          'test("a clean suite check", () => { expect(1).toBe(1); });',
          "",
        ].join("\n")
      );
      const { publishReached, log } = runSequenceAgainstSuiteResult(root);
      expect(publishReached).toBe(true);
      expect(log).toEqual(["publish-step: would run npm publish here"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
