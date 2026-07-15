/**
 * fit-32 (design § 4.7, cap-single-source — S-001, stdio-engine-client change):
 * `BATCH_CAP_BYTES` is imported from `src/core/wire.ts` and never re-declared as a numeric
 * literal, and the `>` cap comparison lives ONLY inside `wire.ts`'s `exceedsBatchCap` —
 * across transport (`src/transport/**`), the fake (`src/testing/contract-fake.ts`), and the
 * harness (`test/fake/**`). `wire.ts` itself is outside the scanned scope (it lives in
 * `src/core/`), so no exemption list is needed: the one legitimate `>` comparison and the
 * one legitimate numeric literal both live structurally outside what this check scans.
 *
 * Red-proof: inline planted fixtures (fit-10/fit-29/fit-30's established no-fixture-file
 * pattern).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles } from "../support/import-scan.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const TRANSPORT_DIR = join(PROJECT_ROOT, "src/transport");
const CONTRACT_FAKE_FILE = join(PROJECT_ROOT, "src/testing/contract-fake.ts");
const HARNESS_DIR = join(PROJECT_ROOT, "test/fake");

// `>` (optionally spaced) immediately adjacent to BATCH_CAP_BYTES, in either operand
// position — a re-derived comparison, never the shared `exceedsBatchCap` call.
const REDERIVED_COMPARISON_PATTERNS: readonly RegExp[] = [/>\s*BATCH_CAP_BYTES\b/, /\bBATCH_CAP_BYTES\s*</];
// The cap's numeric value, spelled out instead of imported — matches the literal in either
// its decimal or `4 * 1024 * 1024`-style multiplication form.
const LITERAL_CAP_PATTERNS: readonly RegExp[] = [/\b4194304\b/, /4\s*\*\s*1024\s*\*\s*1024\b/];

function capSourceViolations(source: string, relPath: string): string[] {
  const violations: string[] = [];
  for (const pattern of REDERIVED_COMPARISON_PATTERNS) {
    if (pattern.test(source)) violations.push(`re-derived cap comparison (${pattern.source}): ${relPath}`);
  }
  for (const pattern of LITERAL_CAP_PATTERNS) {
    if (pattern.test(source)) violations.push(`cap value spelled as a literal (${pattern.source}): ${relPath}`);
  }
  return violations;
}

function scanDir(dir: string): { file: string; violations: string[] }[] {
  return collectTsFiles(dir).map((file) => ({
    file,
    violations: capSourceViolations(readFileSync(file, "utf-8"), file.replace(PROJECT_ROOT, "")),
  }));
}

describe("fit-32 — cap-single-source (BATCH_CAP_BYTES imported, exceedsBatchCap the sole comparison)", () => {
  it("the walk reaches the real transport/fake/harness modules (non-vacuous)", () => {
    const transportFiles = collectTsFiles(TRANSPORT_DIR);
    expect(transportFiles).toContain(join(TRANSPORT_DIR, "framing.ts"));
    expect(transportFiles).toContain(join(TRANSPORT_DIR, "frame-reader.ts"));
    expect(transportFiles).toContain(join(TRANSPORT_DIR, "stdio-engine-client.ts"));
    expect(collectTsFiles(HARNESS_DIR)).toContain(join(HARNESS_DIR, "batch-cap-fixtures.ts"));
  });

  describe("production scan — src/transport/**", () => {
    for (const { file, violations } of scanDir(TRANSPORT_DIR)) {
      it(`${file.replace(PROJECT_ROOT, "")} holds no re-derived cap comparison or spelled-out literal`, () => {
        expect(violations).toEqual([]);
      });
    }
  });

  it("src/testing/contract-fake.ts holds no re-derived cap comparison or spelled-out literal", () => {
    const source = readFileSync(CONTRACT_FAKE_FILE, "utf-8");
    expect(capSourceViolations(source, "src/testing/contract-fake.ts")).toEqual([]);
  });

  describe("harness scan — test/fake/**", () => {
    for (const { file, violations } of scanDir(HARNESS_DIR)) {
      it(`${file.replace(PROJECT_ROOT, "")} holds no re-derived cap comparison or spelled-out literal`, () => {
        expect(violations).toEqual([]);
      });
    }
  });

  // RED-PROOF: a planted re-derived `>` comparison is caught, in either operand order.
  it("[red-proof] a planted `size > BATCH_CAP_BYTES` comparison is flagged", () => {
    const fixture = `export function check(size: number) { return size > BATCH_CAP_BYTES; }`;
    expect(capSourceViolations(fixture, "src/transport/sneaky-cap-check.ts").length).toBeGreaterThan(0);
  });

  it("[red-proof] a planted `BATCH_CAP_BYTES < size` comparison (reversed operand order) is flagged", () => {
    const fixture = `export function check(size: number) { return BATCH_CAP_BYTES < size; }`;
    expect(capSourceViolations(fixture, "src/transport/sneaky-cap-check-2.ts").length).toBeGreaterThan(0);
  });

  // RED-PROOF: a planted spelled-out literal (either form) is caught.
  it("[red-proof] a planted literal 4194304 is flagged", () => {
    const fixture = `export const LOCAL_CAP = 4194304;`;
    expect(capSourceViolations(fixture, "src/transport/sneaky-literal.ts").length).toBeGreaterThan(0);
  });

  it("[red-proof] a planted `4 * 1024 * 1024` literal is flagged", () => {
    const fixture = `export const LOCAL_CAP = 4 * 1024 * 1024;`;
    expect(capSourceViolations(fixture, "src/transport/sneaky-literal-2.ts").length).toBeGreaterThan(0);
  });

  // RED-PROOF (no false positive): importing/using BATCH_CAP_BYTES without a `>`/`<`
  // comparison or a spelled-out literal is clean — e.g. passing it through unchanged, or
  // calling the shared exceedsBatchCap/isOversizeDeclaredLength wrappers.
  it("[red-proof] importing BATCH_CAP_BYTES and calling the shared wrapper is NOT flagged", () => {
    const fixture = `
import { exceedsBatchCap, BATCH_CAP_BYTES } from "../core/wire.ts";
export function check(size: number) { return exceedsBatchCap(size); }
export function describe() { return \`cap is \${BATCH_CAP_BYTES} bytes\`; }
`;
    expect(capSourceViolations(fixture, "src/transport/clean-usage.ts")).toEqual([]);
  });
});
