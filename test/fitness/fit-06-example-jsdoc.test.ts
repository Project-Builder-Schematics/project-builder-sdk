/**
 * FIT-06: Every public export carries a JSDoc @example tag.
 * Scans the public author subpaths (commons, umbrella) for exported declarations.
 * Any declaration missing @example and not tagged @internal → fail.
 * Activates in S-004 (build pipeline exists to produce public surface).
 *
 * Red-proof: a fixture source file with a public export missing @example → caught.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../src", import.meta.url).pathname;

// Public author subpaths to scan (kit excluded per ADR-0009)
const PUBLIC_PATHS = [
  join(ROOT, "commons/index.ts"),
];

// Matches a JSDoc tag at the start of a JSDoc line: `* @tagname` or `* @tagname value`
// Also handles inline single-line JSDoc: /** @tagname ... */
function hasJsDocTag(jsdoc: string, tag: string): boolean {
  // Match `@tag` preceded by start-of-block, whitespace, or `*`
  const pattern = new RegExp(`(?:^|\\*|\\s)\\s*\\${tag}(?:\\s|$)`, "m");
  return pattern.test(jsdoc);
}

/**
 * Parses a TypeScript source file and returns one entry per top-level exported symbol.
 * Strategy: walk line by line, accumulating JSDoc blocks, then emit on each
 * `export (function|class|interface|type NAME =|const|let|var)` declaration.
 * Re-export statements (`export { X }` / `export * from`) are skipped — they carry
 * no author-facing declaration in the barrel and their origin source bears the doc.
 */
function extractPublicExports(source: string): Array<{ name: string; hasExample: boolean; isInternal: boolean }> {
  const results: Array<{ name: string; hasExample: boolean; isInternal: boolean }> = [];
  const lines = source.split("\n");

  // State machine: accumulate JSDoc lines, emit when we see an export declaration.
  let jsdocLines: string[] = [];
  let inJsdoc = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // JSDoc start (may also close on the same line — single-line JSDoc)
    if (trimmed.startsWith("/**")) {
      jsdocLines = [trimmed];
      if (trimmed.includes("*/")) {
        // Single-line JSDoc: e.g. /** @internal Foo. */ — don't enter multi-line mode
        inJsdoc = false;
      } else {
        inJsdoc = true;
      }
      continue;
    }

    // JSDoc continuation / end
    if (inJsdoc) {
      jsdocLines.push(trimmed);
      if (trimmed.includes("*/")) {
        inJsdoc = false;
      }
      continue;
    }

    // Re-exports: `export { X }` / `export * from` / `export type { X }` — skip
    if (/^export\s+(type\s+)?\{/.test(trimmed) || /^export\s+\*/.test(trimmed)) {
      jsdocLines = [];
      continue;
    }

    // Named export declaration: export [declare] function/class/interface/type NAME/const NAME
    const declMatch = trimmed.match(
      /^export\s+(?:declare\s+)?(?:(?:function|class|abstract\s+class)\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*[=<]|(?:const|let|var)\s+(\w+))/
    );
    if (declMatch) {
      const name = declMatch[1] ?? declMatch[2] ?? declMatch[3] ?? declMatch[4] ?? "";
      const jsdoc = jsdocLines.join("\n");
      const hasExample = hasJsDocTag(jsdoc, "@example");
      const isInternal = hasJsDocTag(jsdoc, "@internal");
      results.push({ name, hasExample, isInternal });
      jsdocLines = [];
      continue;
    }

    // Any non-blank, non-comment line that is not an export clears accumulated JSDoc.
    if (trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
      jsdocLines = [];
    }
  }

  return results;
}

describe("FIT-06 — every public export carries a JSDoc @example", () => {
  for (const filePath of PUBLIC_PATHS) {
    it(`${filePath.replace(ROOT, "src")} — all public exports have @example`, () => {
      const source = readFileSync(filePath, "utf-8");
      const exports = extractPublicExports(source);

      const violations = exports.filter((e) => !e.isInternal && !e.hasExample);

      expect(violations.map((v) => v.name)).toEqual([]);
    });
  }

  // RED-PROOF: a fixture source with a public function missing @example fires the check.
  it("[red-proof] a public export without @example is detected as a violation", () => {
    // Note: the description MENTIONS @example-tag text; the parser must only detect real JSDoc tags.
    const fixtureSource = `
/** This export lacks an at-example JSDoc tag. */
export function undocumentedPublicFn(path: string): void {}

/**
 * @example
 * documentedFn("foo");
 */
export function documentedFn(path: string): void {}
`;

    const exports = extractPublicExports(fixtureSource);
    const violations = exports.filter((e) => !e.isInternal && !e.hasExample);

    // Should flag undocumentedPublicFn but not documentedFn
    expect(violations.map((v) => v.name)).toEqual(["undocumentedPublicFn"]);
  });

  // RED-PROOF: an export with NO JSDoc at all is also flagged.
  it("[red-proof] a public export with no JSDoc at all is flagged as a violation", () => {
    const fixtureSource = `
export function bareExport(path: string): void {}
`;

    const exports = extractPublicExports(fixtureSource);
    const violations = exports.filter((e) => !e.isInternal && !e.hasExample);

    expect(violations.map((v) => v.name)).toEqual(["bareExport"]);
  });

  // RED-PROOF: @internal skips the check even when @example is absent.
  it("[red-proof] an @internal export without @example is NOT flagged", () => {
    const fixtureSource = `
/** @internal Placeholder — not part of public API. */
export function internalStub(): void {}
`;

    const exports = extractPublicExports(fixtureSource);
    const violations = exports.filter((e) => !e.isInternal && !e.hasExample);

    expect(violations).toEqual([]);
  });
});
