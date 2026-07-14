/**
 * FIT-08: No author subpath re-exports a kit symbol beyond its own per-path allowlist
 * (ADR-0009, ADR-0034 guard 2).
 *
 * Per-path allowlist data model (REQ-TES-03): each scanned path carries its own
 * `valueAllow`/`typeAllow` symbol lists. `.`, `./commons`, `./conformance` keep the
 * original full ban (empty allowlists — unchanged behaviour). `./testing` gets a narrow
 * allowlist: VALUE `runFactoryForTest` only, TYPE-ONLY `Batch`/`Directive` — `defineFactory`
 * is NO LONGER on this allowlist (bare-factory-migration, S-006, REQ-TES-03/REQ-TES-08); every
 * OTHER kit symbol, `ContractFake` included (as a value OR as a type, SEC-M3), stays banned
 * there too. A per-path allowlist relaxes ONLY the kit-symbol/`../core`-re-export ban;
 * locally-declared non-kit exports (e.g. `RunResult`) are outside this guard's universe and
 * need no allowlist entry (ARCH-M1).
 *
 * Wildcard ban by form (SEC-M1, design rev 4/GAP-4): ANY `export *`/`export * as ns`
 * statement on any scanned path is a violation BY FORM regardless of specifier — allowlisted
 * paths enumerate names exhaustively, so a wildcard can never be validated against one — with
 * EXACTLY ONE specifier-exact grandfathered exemption: `src/index.ts`'s pre-existing
 * `export * from "./commons/index.ts"` umbrella re-export.
 *
 * Strategy: per scanned path, scan for (a) any wildcard re-export statement (banned by form,
 * minus the one exemption) and (b) any named export brace list containing a KIT_SYMBOL_NAMES
 * entry not present in that path's allow list for its export form (value vs type-only).
 *
 * Red-proof: a fixture re-exporting a non-allowlisted kit symbol, or `ContractFake` in either
 * form, or a wildcard on a non-exempt path/specifier, is caught.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../src", import.meta.url).pathname;

interface ScannedPath {
  path: string;
  valueAllow: string[];
  typeAllow: string[];
}

// Per-path allowlist data model (REQ-TES-03): the FIT-08 equivalent of the old flat
// AUTHOR_SUBPATHS list, now with per-path value/type allowances. `./testing` MUST be a
// member of this set (REQ-TES-03.3) — allowlisted, never removed from scanning.
const SCANNED: ScannedPath[] = [
  { path: join(ROOT, "commons/index.ts"), valueAllow: [], typeAllow: [] },
  { path: join(ROOT, "index.ts"), valueAllow: [], typeAllow: [] },
  { path: join(ROOT, "conformance/index.ts"), valueAllow: [], typeAllow: [] },
  {
    path: join(ROOT, "testing/index.ts"),
    valueAllow: ["runFactoryForTest"],
    typeAllow: ["Batch", "Directive"],
  },
  // REQ-DG-04.1 (stage-5-first-dialect): the new ./typescript dialect subpath is a full-ban
  // path, same as commons/index/conformance — it imports ONLY defineDialect/defineOpPack/
  // withOps (already sanctioned, not re-exported from here) + its own AST library.
  { path: join(ROOT, "dialects/typescript/index.ts"), valueAllow: [], typeAllow: [] },
];

const UMBRELLA_PATH = join(ROOT, "index.ts");
const UMBRELLA_EXEMPT_SPECIFIER = "./commons/index.ts";

// Kit symbols that must NOT appear in a scanned path's exports, unless allowlisted for
// that path and that export form (value vs type-only).
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

const WILDCARD_PATTERN = /export\s+\*(?:\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]/g;
const NAMED_EXPORT_PATTERN = /export\s+(type\s+)?\{([^}]+)\}/g;

/**
 * Wildcard-ban-by-form (SEC-M1): any `export *`/`export * as ns` statement on a scanned
 * path is a violation regardless of specifier — allowlisted paths enumerate their export
 * names exhaustively, so a wildcard can never be validated against one. The ONE
 * specifier-exact grandfathered exemption: `src/index.ts` re-exporting from EXACTLY
 * `./commons/index.ts` (GAP-4).
 */
function findWildcardViolations(source: string, filePath: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(WILDCARD_PATTERN)) {
    const specifier = match[1] ?? "";
    const isUmbrellaExemption = filePath === UMBRELLA_PATH && specifier === UMBRELLA_EXEMPT_SPECIFIER;
    if (!isUmbrellaExemption) {
      violations.push(`wildcard re-export banned by form: ${match[0].trim()}`);
    }
  }
  return violations;
}

/**
 * Per-path named-kit-symbol ban: scans every `export { ... }`/`export type { ... }` brace
 * list for a KIT_SYMBOL_NAMES entry that is not present in this path's allow list for its
 * export form (value vs type-only). A re-export of an allowlisted symbol from ../core is
 * permitted on its path; every other kit symbol — ContractFake included, value or type
 * (SEC-M3) — stays banned.
 */
function findNamedKitBleed(source: string, entry: ScannedPath): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(NAMED_EXPORT_PATTERN)) {
    const isTypeOnly = match[1] !== undefined;
    const exported = match[2] ?? "";
    const allowList = isTypeOnly ? entry.typeAllow : entry.valueAllow;
    for (const kitSymbol of KIT_SYMBOL_NAMES) {
      const symbolPattern = new RegExp(`\\b${kitSymbol}\\b`);
      if (symbolPattern.test(exported) && !allowList.includes(kitSymbol)) {
        violations.push(
          `kit symbol leaked: ${kitSymbol} in export ${isTypeOnly ? "type " : ""}{ ${exported.trim()} }`
        );
      }
    }
  }
  return violations;
}

function scanPath(source: string, entry: ScannedPath): string[] {
  return [...findWildcardViolations(source, entry.path), ...findNamedKitBleed(source, entry)];
}

describe("FIT-08 — no author subpath re-exports a kit symbol beyond its allowlist (ADR-0009)", () => {
  for (const entry of SCANNED) {
    it(`${entry.path.replace(ROOT, "src")} exports only its allowlist`, () => {
      const source = readFileSync(entry.path, "utf-8");
      const violations = scanPath(source, entry);
      expect(violations).toEqual([]);
    });
  }

  // RED-PROOF: a fixture source re-exporting Session from core is caught (empty-allowlist path).
  it("[red-proof] re-exporting Session from core is detected as kit bleed", () => {
    const fixtureSource = `
import { find } from "./internals.ts";
export { Session } from "../core/session.ts";
export { find };
`;
    const entry = SCANNED.find((e) => e.path === join(ROOT, "commons/index.ts"))!;
    const violations = scanPath(fixtureSource, entry);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("Session"))).toBe(true);
  });

  // RED-PROOF: re-exporting defineFactory under an alias is caught on an empty-allowlist path.
  it("[red-proof] re-exporting defineFactory (renamed) from core is caught on a full-ban path", () => {
    const fixtureSource = `
export { defineFactory as runFactory } from "../core/context.ts";
`;
    const entry = SCANNED.find((e) => e.path === join(ROOT, "commons/index.ts"))!;
    const violations = scanPath(fixtureSource, entry);
    expect(violations.length).toBeGreaterThan(0);
  });

  describe("REQ-TES-03 — ./testing per-path allowlist", () => {
    const testingEntry = SCANNED.find((e) => e.path === join(ROOT, "testing/index.ts"))!;

    it("REQ-TES-03.1: ./testing permits only its allowlist — no violation for the three sanctioned exports", () => {
      const fixtureSource = `
export type { Batch, Directive };
export async function runFactoryForTest() {}
`;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations).toEqual([]);
    });

    it("[red-proof] REQ-TES-03.1b: defineFactory re-exported from ./testing is now a violation", () => {
      const fixtureSource = `
export type { Batch, Directive };
export { defineFactory } from "../core/context.ts";
export async function runFactoryForTest() {}
`;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations.some((v) => v.includes("defineFactory"))).toBe(true);
    });

    it("[red-proof] REQ-TES-03.2: ./testing still bans a non-allowlisted kit symbol (Session)", () => {
      const fixtureSource = `
export type { Batch, Directive };
export { Session } from "../core/session.ts";
`;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes("Session"))).toBe(true);
    });

    it("REQ-TES-03.3: ./testing's source path is a member of the scanned-path set", () => {
      const scannedPaths = SCANNED.map((e) => e.path);
      expect(scannedPaths).toContain(join(ROOT, "testing/index.ts"));
    });

    it("[red-proof] REQ-TES-03.4: ContractFake is banned regardless of export form (value AND type-only)", () => {
      const fixtureSource = `
export type { Batch, Directive };
export { ContractFake } from "./contract-fake.ts";
export type { ContractFake as ContractFakeType } from "./contract-fake.ts";
`;
      const violations = scanPath(fixtureSource, testingEntry);
      const contractFakeViolations = violations.filter((v) => v.includes("ContractFake"));
      expect(contractFakeViolations.length).toEqual(2);
    });

    it("[red-proof] REQ-TES-03.3 (shallow-fix rejection): narrowing the allowlist cannot be achieved by removing ./testing from the scanned-path set", () => {
      // The shallow fix of dropping ./testing from SCANNED entirely would also make this
      // suite "pass" — this test pins that the path stays present AND its allowlist is the
      // real, narrow one (not an absence of scanning).
      const scannedPaths = SCANNED.map((e) => e.path);
      expect(scannedPaths).toContain(join(ROOT, "testing/index.ts"));
      expect(testingEntry.valueAllow).toEqual(["runFactoryForTest"]);
      expect(testingEntry.valueAllow).not.toContain("defineFactory");
    });
  });

  describe("REQ-DG-04.1 — ./typescript imports only the sanctioned dialect-author surface", () => {
    const typescriptEntry = SCANNED.find((e) => e.path === join(ROOT, "dialects/typescript/index.ts"))!;

    // RED-PROOF: a planted fixture re-exporting Session from ./typescript is caught — proves
    // FIT-08's existing scan is EXERCISED against the new subpath, not merely inherited by
    // text (REQ-DG-04.1's own red-proof obligation).
    it("[red-proof] a fixture re-exporting Session from src/dialects/typescript is detected as kit bleed", () => {
      const fixtureSource = `
import { find } from "./index.ts";
export { Session } from "../../core/session.ts";
export { find };
`;
      const violations = scanPath(fixtureSource, typescriptEntry);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes("Session"))).toBe(true);
    });

    it("[red-proof] a fixture re-exporting DirectiveFactory or EngineClient from ./typescript is detected", () => {
      const fixtureSource = `
export { DirectiveFactory } from "../../core/directive-factory.ts";
export type { EngineClient } from "../../core/engine-client.ts";
`;
      const violations = scanPath(fixtureSource, typescriptEntry);
      expect(violations.some((v) => v.includes("DirectiveFactory"))).toBe(true);
      expect(violations.some((v) => v.includes("EngineClient"))).toBe(true);
    });
  });

  describe("REQ-ATH-01.3 — ContractFake is not exported by name from ./testing", () => {
    const testingEntry = SCANNED.find((e) => e.path === join(ROOT, "testing/index.ts"))!;

    it("[red-proof] REQ-ATH-01.3: a fixture re-exporting ContractFake as a value is flagged", () => {
      const fixtureSource = `export { ContractFake } from "./contract-fake.ts";`;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations.some((v) => v.includes("ContractFake"))).toBe(true);
    });

    it("[red-proof] REQ-ATH-01.3: a fixture re-exporting ContractFake as a type is flagged", () => {
      const fixtureSource = `export type { ContractFake } from "./contract-fake.ts";`;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations.some((v) => v.includes("ContractFake"))).toBe(true);
    });
  });

  describe("SEC-M1 — wildcard re-export banned by form (GAP-4 specifier-exact exemption)", () => {
    it("[red-proof] a facade wildcard re-export of the fake is flagged", () => {
      const fixtureSource = `export * from "./contract-fake.ts";`;
      const testingEntry = SCANNED.find((e) => e.path === join(ROOT, "testing/index.ts"))!;
      const violations = scanPath(fixtureSource, testingEntry);
      expect(violations.some((v) => v.includes("wildcard"))).toBe(true);
    });

    it("[red-proof] an umbrella wildcard to a NON-./commons/index.ts specifier is flagged (exemption is specifier-exact)", () => {
      const fixtureSource = `export * from "./core/index.ts";`;
      const umbrellaEntry = SCANNED.find((e) => e.path === UMBRELLA_PATH)!;
      const violations = scanPath(fixtureSource, umbrellaEntry);
      expect(violations.some((v) => v.includes("wildcard"))).toBe(true);
    });

    it("the umbrella's real, pre-existing `export * from \"./commons/index.ts\"` is exempted", () => {
      const source = readFileSync(UMBRELLA_PATH, "utf-8");
      const violations = findWildcardViolations(source, UMBRELLA_PATH);
      expect(violations).toEqual([]);
    });
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

  // Boundary (ARCH-M1): RunResult is a locally-DECLARED non-kit export — outside this
  // guard's universe entirely, needs no allowlist entry.
  it("RunResult is NOT in the kit symbol list (locally-declared, outside FIT-08's universe)", () => {
    expect(KIT_SYMBOL_NAMES).not.toContain("RunResult");
  });
});
