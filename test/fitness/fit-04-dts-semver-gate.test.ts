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
 * Red-proof: simulating a baseline drift (a removed export) triggers the gate.
 * Activates in S-004 (build pipeline produces .d.ts; baseline committed here).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_DIR = join(PROJECT_ROOT, "test/fitness/dts-baseline");
const DIST_DIR = join(PROJECT_ROOT, "dist");

/**
 * Strips comment lines (// ... and /** ... *\/) and blank lines from a .d.ts string,
 * returning a stable set of declaration lines for diffing.
 * Also strips sourcemap comments.
 */
function normalizeDeclarations(dts: string): string[] {
  return dts
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
}

/**
 * Returns lines present in baseline but absent in current (broken removals).
 */
function findBreakingRemovals(baseline: string[], current: string[]): string[] {
  const currentSet = new Set(current);
  return baseline.filter((line) => !currentSet.has(line));
}

// Pairs of (baseline file, dist file) for the public subpaths
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
});
