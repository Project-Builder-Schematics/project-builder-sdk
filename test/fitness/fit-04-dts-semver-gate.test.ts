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
 * Unconditional rebuild (W7, updated ARCH-m4): every run consumes `shared-build.ts`'s
 * `ensureTscBuild()` — a memoized, module-singleton `bun run build`, run AT MOST ONCE per
 * `bun test` process and shared with the installed-consumer e2e (their build inputs are
 * identical). This preserves W7's original invariant (never trust a stale `dist/` via a
 * mtime-based freshness check, which a stale/clean checkout, a touched-but-unchanged file, or
 * clock skew across a rebase can silently defeat) while removing the per-test-file rebuild
 * this file used to trigger on its own.
 *
 * Baseline regeneration (manual, no script exists): `bun run build`, then copy each
 * `dist/**\/*.d.ts` over its committed counterpart in `test/fitness/dts-baseline/`
 * (`dist/commons/index.d.ts` → `commons.index.d.ts`, `dist/core/base-handle.d.ts` →
 * `core.base-handle.d.ts`, `dist/core/handle-state.d.ts` → `core.handle-state.d.ts`,
 * `dist/testing/index.d.ts` → `testing.index.d.ts`, `dist/dialects/typescript/index.d.ts` →
 * `typescript.index.d.ts`, `dist/dialects/react/index.d.ts` → `react.index.d.ts`).
 *
 * Red-proof: simulating a baseline drift (a removed export) triggers the gate.
 * Activates in S-004 (build pipeline produces .d.ts; baseline committed here).
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_DIR = join(PROJECT_ROOT, "test/fitness/dts-baseline");
const DIST_DIR = join(PROJECT_ROOT, "dist");

beforeAll(() => {
  // ensureTscBuild() returns this same DIST_DIR — the call's purpose here is triggering
  // the shared, memoized build, not sourcing the path (needed at module-eval time above,
  // before beforeAll runs).
  ensureTscBuild();
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
  {
    // REQ-TES-05: entry-only baseline (ADR-0034 guard 5) — the type-only Batch/Directive
    // re-export lines live in this file's index.d.ts, so entry-only still catches their
    // removal (REQ-TES-05.2) without churning on internal fake refactors.
    baselineFile: join(BASELINE_DIR, "testing.index.d.ts"),
    distFile: join(DIST_DIR, "testing/index.d.ts"),
    label: "testing",
  },
  {
    // stage-5-first-dialect, REQ-FIT-04: the ./typescript subpath's FIRST baseline — its
    // first commit is additive by definition (a brand-new subpath); this pair gates every
    // subsequent change to it the same as every other public surface.
    baselineFile: join(BASELINE_DIR, "typescript.index.d.ts"),
    distFile: join(DIST_DIR, "dialects/typescript/index.d.ts"),
    label: "typescript",
  },
  {
    // react-dialect, S-000, REQ-FIT-04: the ./react subpath's FIRST baseline — additive by
    // definition (a brand-new subpath), pins `find`'s JSDoc incl. the trust line.
    baselineFile: join(BASELINE_DIR, "react.index.d.ts"),
    distFile: join(DIST_DIR, "dialects/react/index.d.ts"),
    label: "react",
  },
  {
    // author-write-surface, S-000, REQ-FIT-04: `core/define-dialect.ts`'s FIRST baseline —
    // `Handle` is the ONE type architecture.md marks FROZEN; ADR-0050 unfreezes it for the
    // `.raw(fn)`->`.modify(fn)` / `.modify(content)`->`.replaceContent(content)` rename, and
    // this pair re-freezes it. The baseline's content must exhibit both `replaceContent` and
    // `modify(fn:...)` among `Handle`'s members, with ZERO occurrences of `raw`.
    baselineFile: join(BASELINE_DIR, "core.define-dialect.d.ts"),
    distFile: join(DIST_DIR, "core/define-dialect.d.ts"),
    label: "core/define-dialect",
  },
];

// Companion negative declaration-scan (SEC-M2, ADR-0034 guard 6): FIT-10 scans SOURCES only
// and FIT-04 above is removal-only, so declaration emit could resurface a port-internal name
// undetected by either. Housed here because this file already reads dist/testing/index.d.ts
// via ensureTscBuild().
const PORT_SYMBOL_PATTERN = /\b(?:EngineClient|EmitRejection)\b/;

describe("FIT-04 — public .d.ts semver gate (baseline diff)", () => {
  for (const { baselineFile, distFile, label } of DTS_PAIRS) {
    it(`${label}: no breaking removals vs committed baseline`, () => {
      const baseline = normalizeDeclarations(readFileSync(baselineFile, "utf-8"));
      const current = normalizeDeclarations(readFileSync(distFile, "utf-8"));

      const removals = findBreakingRemovals(baseline, current);

      expect(removals).toEqual([]);
    });
  }

  // SEC-M2 companion assert: dist/testing/index.d.ts must never resurface a port-internal
  // name — declaration emit is a distinct surface from FIT-10's source scan and FIT-04's
  // removal-only diff above, so neither alone would catch it.
  it("testing: dist/testing/index.d.ts does not resurface EngineClient or EmitRejection", () => {
    const dts = readFileSync(join(DIST_DIR, "testing/index.d.ts"), "utf-8");
    expect(PORT_SYMBOL_PATTERN.test(dts)).toBe(false);
  });

  // REQ-TES-05.3 (bare-factory-migration, S-000): the ./testing baseline's SIGNATURE regen
  // is paired with a POSITIVE assertion proving the current dts reflects
  // runFactoryForTest's NEW bare-fn + optional {seed, packageDir} shape — a removal-only
  // diff (this file's removal-only check above) would pass even if the signature had been
  // silently laundered into something else entirely, as long as no baseline line survived
  // unmatched; this pins the actual replacement shape.
  it("REQ-TES-05.3: dist/testing/index.d.ts reflects runFactoryForTest's new bare-fn + options-bag signature", () => {
    const dts = readFileSync(join(DIST_DIR, "testing/index.d.ts"), "utf-8");
    expect(dts).toContain(
      "export declare function runFactoryForTest<O>(fn: (input: O) => void | Promise<void>, input: O, options?: {"
    );
    expect(dts).toContain("seed?: Record<string, string>;");
    expect(dts).toContain("packageDir?: string | URL;");
  });

  // RED-PROOF: a fixture .d.ts naming the port symbol is caught by the negative scan.
  it("[red-proof] a fixture dts naming EngineClient is caught by the negative declaration-scan", () => {
    const fixtureDts = `export declare function makeClient(): EngineClient;`;
    expect(PORT_SYMBOL_PATTERN.test(fixtureDts)).toBe(true);
  });

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

  // Non-vacuousness pin for the core/define-dialect baseline (verify-final followup): the
  // pair above is a FIRST-commit baseline (S-000, ADR-0050 rename), so its removal-only diff
  // is vacuously true — it can never catch a resurfaced `.raw(fn)` member because there is no
  // PRIOR baseline to diff against. This describe asserts the baseline's actual CONTENT
  // directly instead, so a regression that reintroduces a live `raw(` handle member (or drops
  // `replaceContent`/`modify(fn)`) still fails even on this first commit.
  describe("core/define-dialect.d.ts baseline content pin (S-000, ADR-0050 rename)", () => {
    const defineDialectBaseline = readFileSync(join(BASELINE_DIR, "core.define-dialect.d.ts"), "utf-8");

    it("contains the replaceContent wholesale-replace member", () => {
      expect(defineDialectBaseline).toContain("replaceContent");
    });

    it("contains the modify(fn) AST escape-hatch member", () => {
      expect(defineDialectBaseline).toContain("modify(fn:");
    });

    it("does not contain a live raw( method member on Handle", () => {
      // `\braw\(` is call/method-member SHAPED (requires the paren immediately after the
      // word): it would match a resurfaced live `raw(fn: ...)` handle member, but NOT the
      // quoted string literal `"raw"` inside `RESERVED_HANDLE_NAMES`'s array (there, `raw` is
      // followed by a comma and closing quote, never a paren) — so that array literal staying
      // in the baseline is expected and must never trip this assertion.
      expect(defineDialectBaseline).not.toMatch(/\braw\(/);
    });

    it("[red-proof] a fixture reintroducing a live raw( member is caught by the pattern", () => {
      const fixture = "export type Handle = { raw(fn: (ast: Ast) => void): Edited };";
      expect(fixture).toMatch(/\braw\(/);
    });

    it("[red-proof] the RESERVED_HANDLE_NAMES string literal alone does not false-positive", () => {
      const fixture =
        'export declare const RESERVED_HANDLE_NAMES: readonly ["then", "read", "raw", "modify"];';
      expect(fixture).not.toMatch(/\braw\(/);
    });
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
