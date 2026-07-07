/**
 * FIT-04: Public .d.ts semver gate.
 * Diffs the current built .d.ts surface against the committed baseline in
 * test/fitness/dts-baseline/. A breaking export change (removed export, changed
 * signature) without a version bump → fail.
 *
 * "Breaking" is defined conservatively: any line present in the baseline but absent
 * from the current .d.ts counts as a breaking removal. Additive changes (new exports)
 * are allowed without a bump.
 *
 * Unconditional rebuild (W7): every run does `bun run build` before diffing — no mtime
 * gate. A mtime-based freshness check trusts the filesystem clock, which a stale/clean
 * checkout, a touched-but-unchanged file, or clock skew across a rebase can silently
 * defeat (dist looking "fresh" against a src it does not actually reflect). Rebuilding
 * every time trades a few hundred ms for removing that whole failure class.
 *
 * Baseline regeneration (manual, no script exists): `bun run build`, then copy each
 * `dist/**\/*.d.ts` over its committed counterpart in `test/fitness/dts-baseline/`
 * (`dist/commons/index.d.ts` → `commons.index.d.ts`, `dist/core/base-handle.d.ts` →
 * `core.base-handle.d.ts`, `dist/core/handle-state.d.ts` → `core.handle-state.d.ts`).
 *
 * Red-proof: simulating a baseline drift (a removed export) triggers the gate.
 * Activates in S-004 (build pipeline produces .d.ts; baseline committed here).
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_DIR = join(PROJECT_ROOT, "test/fitness/dts-baseline");
const DIST_DIR = join(PROJECT_ROOT, "dist");

beforeAll(() => {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(
      `FIT-04: bun run build failed — cannot diff .d.ts without a fresh build.\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
});

// Strips comment lines and blank lines from a .d.ts string, returning only
// declaration lines for diffing. Strips single-line comments (// ...), JSDoc block
// comment lines (lines starting with * or /**), and sourcemap comments.
// This ensures @example or prose edits do not trip the semver gate (A2).
function normalizeDeclarations(dts: string): string[] {
  return dts
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length === 0) return false;
      if (l.startsWith("//")) return false;
      if (l.startsWith("*")) return false;
      if (l.startsWith("/**")) return false;
      return true;
    });
}

/**
 * Returns lines present in baseline but absent in current (broken removals).
 */
function findBreakingRemovals(baseline: string[], current: string[]): string[] {
  const currentSet = new Set(current);
  return baseline.filter((line) => !currentSet.has(line));
}

// Pairs of (baseline file, dist file) for the public subpaths.
// Includes core/handle-state and core/base-handle because FoundHandle/WritableHandle
// appear by bare name in dist/commons/index.d.ts but their method signatures live in
// these core .d.ts files — A1: handle method signature changes must be caught.
// Same rationale for core/authoring-error (AuthoringError's field shape + the
// reason/origin/verb union literals live there, re-exported by bare name from commons —
// the union-growth flag ADR-0020/spec note 4 assigns to FIT-04 only works if this file
// is diffed) and commons/classify-content (ContentState + the helper's signature).
const DTS_PAIRS: Array<{ baselineFile: string; distFile: string; label: string }> = [
  {
    baselineFile: join(BASELINE_DIR, "commons.index.d.ts"),
    distFile: join(DIST_DIR, "commons/index.d.ts"),
    label: "commons",
  },
  {
    baselineFile: join(BASELINE_DIR, "index.d.ts"),
    distFile: join(DIST_DIR, "index.d.ts"),
    label: "umbrella",
  },
  {
    baselineFile: join(BASELINE_DIR, "conformance.index.d.ts"),
    distFile: join(DIST_DIR, "conformance/index.d.ts"),
    label: "conformance",
  },
  {
    baselineFile: join(BASELINE_DIR, "core.handle-state.d.ts"),
    distFile: join(DIST_DIR, "core/handle-state.d.ts"),
    label: "core/handle-state",
  },
  {
    baselineFile: join(BASELINE_DIR, "core.base-handle.d.ts"),
    distFile: join(DIST_DIR, "core/base-handle.d.ts"),
    label: "core/base-handle",
  },
  {
    baselineFile: join(BASELINE_DIR, "core.authoring-error.d.ts"),
    distFile: join(DIST_DIR, "core/authoring-error.d.ts"),
    label: "core/authoring-error",
  },
  {
    baselineFile: join(BASELINE_DIR, "commons.classify-content.d.ts"),
    distFile: join(DIST_DIR, "commons/classify-content.d.ts"),
    label: "commons/classify-content",
  },
];

describe("FIT-04 — public .d.ts semver gate (baseline diff)", () => {
  for (const { baselineFile, distFile, label } of DTS_PAIRS) {
    it(`${label}: no breaking removals vs committed baseline`, () => {
      const baseline = normalizeDeclarations(readFileSync(baselineFile, "utf-8"));
      const current = normalizeDeclarations(readFileSync(distFile, "utf-8"));

      const removals = findBreakingRemovals(baseline, current);

      expect(removals).toEqual([]);
    });
  }

  // RED-PROOF: simulating a baseline with an export the current dist does not have → violation detected.
  it("[red-proof] a removed export is detected as a breaking change", () => {
    // Simulate: baseline has `export declare function vanishedExport(path: string): void;`
    // but current dist does not.
    const simulatedBaseline = `export declare function find(path: string): FoundHandle;
export declare function vanishedExport(path: string): void;`;

    const simulatedCurrent = `export declare function find(path: string): FoundHandle;`;

    const baseline = normalizeDeclarations(simulatedBaseline);
    const current = normalizeDeclarations(simulatedCurrent);
    const removals = findBreakingRemovals(baseline, current);

    expect(removals).toContain("export declare function vanishedExport(path: string): void;");
  });

  // RED-PROOF: additive changes (new exports in current) are NOT flagged.
  it("[red-proof] an additive export in current does NOT trigger the gate", () => {
    const simulatedBaseline = `export declare function find(path: string): FoundHandle;`;
    const simulatedCurrent = `export declare function find(path: string): FoundHandle;
export declare function newHelper(path: string): void;`;

    const baseline = normalizeDeclarations(simulatedBaseline);
    const current = normalizeDeclarations(simulatedCurrent);
    const removals = findBreakingRemovals(baseline, current);

    expect(removals).toEqual([]);
  });

  // RED-PROOF (A1): a breaking handle write-op signature change is detected.
  it("[red-proof] a removed handle method signature is detected as a breaking change", () => {
    const simulatedBaseline = `export interface WriteOps {
    modify(content: string): WritableHandleRef;
    rename(newName: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
    move(toDir: string): WritableHandleRef;
    copy(to: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
}`;
    // Simulate removing the rename method.
    const simulatedCurrent = `export interface WriteOps {
    modify(content: string): WritableHandleRef;
    move(toDir: string): WritableHandleRef;
    copy(to: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
}`;

    const baseline = normalizeDeclarations(simulatedBaseline);
    const current = normalizeDeclarations(simulatedCurrent);
    const removals = findBreakingRemovals(baseline, current);

    expect(removals.some((l) => l.includes("rename"))).toBe(true);
  });

  // RED-PROOF (A2): a doc-only @example edit does NOT trip the gate.
  it("[red-proof] a JSDoc @example change does NOT trigger the gate", () => {
    const simulatedBaseline = `/**
 * @example
 * const h = modify("src/config.ts", "v2");
 */
export declare function modify(path: string, content: string): WritableHandle;`;
    const simulatedCurrent = `/**
 * @example
 * const h = modify("src/new.ts", "v3"); // updated example
 */
export declare function modify(path: string, content: string): WritableHandle;`;

    const baseline = normalizeDeclarations(simulatedBaseline);
    const current = normalizeDeclarations(simulatedCurrent);
    const removals = findBreakingRemovals(baseline, current);

    expect(removals).toEqual([]);
  });
});
