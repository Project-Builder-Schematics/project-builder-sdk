/**
 * FIT-08: No author subpath re-exports a kit symbol (ADR-0009).
 * The author-facing subpaths (src/commons, src/index, src/conformance) MUST NOT
 * re-export symbols from the internal kit (src/core): EngineClient, Session,
 * DirectiveFactory, ContractFake, RunContext, defineFactory, currentContext, etc.
 * These are the contributor-kit boundary — they must stay behind src/core.
 *
 * Strategy: scan the author subpath sources for any export that points at ../core
 * or re-exports a known kit symbol name.
 *
 * Red-proof: a fixture that re-exports a kit symbol from a commons-like source is caught.
 * Activates in S-004 (subpaths established).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../src", import.meta.url).pathname;

// Public author subpaths (author surface — kit must not leak into these)
const AUTHOR_SUBPATHS = [
  join(ROOT, "commons/index.ts"),
  join(ROOT, "index.ts"),
  join(ROOT, "conformance/index.ts"),
];

// Kit symbols that must NOT appear in author subpath exports
const KIT_SYMBOL_NAMES = [
  "EngineClient",
  "Session",
  "DirectiveFactory",
  "ContractFake",
  "RunContext",
  "defineFactory",
  "currentContext",
  "defineDialect",
  "defineOpPack",
  "withOps",
  "ReadOps",
  "WriteOps",
  "WritableHandleRef",
];

/**
 * Detects kit symbol bleed in author subpath sources.
 * Checks:
 *   1. Any `export ... from "../core/..."` (re-exporting the core barrel or a specific core file)
 *   2. Any named export of a known kit symbol (e.g. `export { Session }`)
 */
function findKitBleed(source: string): string[] {
  const violations: string[] = [];

  // Check for re-exports pointing at ../core/
  const reExportPattern = /export\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"][^'"]*\/core[^'"]*['"]/g;
  const coreExportStarPattern = /export\s+\*\s+from\s+['"][^'"]*\/core[^'"]*['"]/g;

  for (const match of source.matchAll(reExportPattern)) {
    violations.push(match[0].slice(0, 80));
  }
  for (const match of source.matchAll(coreExportStarPattern)) {
    violations.push(match[0].slice(0, 80));
  }

  // Check for named exports of kit symbols (could be inline or re-export)
  // e.g. `export { Session }` or `export { Session as SomeAlias }`
  const namedExportPattern = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  for (const match of source.matchAll(namedExportPattern)) {
    const exported = match[1] ?? "";
    for (const kitSymbol of KIT_SYMBOL_NAMES) {
      // Match `Symbol` or `Symbol as Alias` but not `FoundHandle` etc.
      const symbolPattern = new RegExp(`\\b${kitSymbol}\\b`);
      if (symbolPattern.test(exported)) {
        violations.push(`kit symbol leaked: ${kitSymbol} in export { ${exported.trim()} }`);
      }
    }
  }

  return violations;
}

describe("FIT-08 — no author subpath re-exports a kit symbol (ADR-0009)", () => {
  for (const filePath of AUTHOR_SUBPATHS) {
    it(`${filePath.replace(ROOT, "src")} exports no kit symbols`, () => {
      const source = readFileSync(filePath, "utf-8");
      const violations = findKitBleed(source);
      expect(violations).toEqual([]);
    });
  }

  // RED-PROOF: a fixture source re-exporting Session from core is caught.
  it("[red-proof] re-exporting Session from core is detected as kit bleed", () => {
    const fixtureSource = `
import { find } from "./internals.ts";
export { Session } from "../core/session.ts";
export { find };
`;

    const violations = findKitBleed(fixtureSource);
    // Both the core re-export pattern and the named export check should fire
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("core") || v.includes("Session"))).toBe(true);
  });

  // RED-PROOF: re-exporting defineFactory under an alias is also caught.
  it("[red-proof] re-exporting defineFactory (renamed) from core is caught", () => {
    const fixtureSource = `
export { defineFactory as runFactory } from "../core/context.ts";
`;

    const violations = findKitBleed(fixtureSource);
    expect(violations.length).toBeGreaterThan(0);
  });

  // Boundary: FoundHandle/WritableHandle are author surface types, NOT kit symbols.
  it("FoundHandle/WritableHandle are NOT in the kit symbol list", () => {
    expect(KIT_SYMBOL_NAMES).not.toContain("FoundHandle");
    expect(KIT_SYMBOL_NAMES).not.toContain("WritableHandle");
  });

  // Boundary (ADR-0023): AuthoringError + its supporting types are author-facing DATA
  // types crossing core → commons, NOT kit MACHINERY (EngineClient/Session/
  // DirectiveFactory stay unexported) — mirrors the FoundHandle/WritableHandle pin above.
  it("AuthoringError/AuthoringVerb/AuthoringReason/AuthoringOrigin are NOT in the kit symbol list", () => {
    expect(KIT_SYMBOL_NAMES).not.toContain("AuthoringError");
    expect(KIT_SYMBOL_NAMES).not.toContain("AuthoringVerb");
    expect(KIT_SYMBOL_NAMES).not.toContain("AuthoringReason");
    expect(KIT_SYMBOL_NAMES).not.toContain("AuthoringOrigin");
  });
});
