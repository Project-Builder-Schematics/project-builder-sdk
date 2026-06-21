/**
 * FIT-06: Every public export carries a JSDoc @example tag.
 * Scans the public author subpaths (commons, conformance) for exported declarations.
 * Any declaration missing @example and not tagged @internal → fail.
 *
 * Re-export resolution: `export type { Foo } from './x'` and the two-step
 * `import type { Foo } from './x'; export type { Foo }` patterns are followed
 * to the origin module so that re-exported types (e.g. FoundHandle, WritableHandle
 * re-exported through src/commons/index.ts) are checked at their defining JSDoc.
 *
 * Activates in S-004 (build pipeline exists to produce public surface).
 *
 * Red-proof: a public export (incl. a re-exported type) missing @example → caught.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = new URL("../../src", import.meta.url).pathname;

// Public author subpaths to scan (kit excluded per ADR-0009)
const PUBLIC_PATHS = [
  join(ROOT, "commons/index.ts"),
  join(ROOT, "conformance/index.ts"),
];

// Matches a JSDoc tag at the start of a JSDoc line: `* @tagname` or `* @tagname value`
function hasJsDocTag(jsdoc: string, tag: string): boolean {
  const pattern = new RegExp(`(?:^|\\*|\\s)\\s*\\${tag}(?:\\s|$)`, "m");
  return pattern.test(jsdoc);
}

/**
 * Parses a TypeScript source file and returns one entry per top-level exported symbol.
 * Skips re-export statements (those are resolved in resolveReExportedNames).
 */
function extractPublicExports(source: string): Array<{ name: string; hasExample: boolean; isInternal: boolean }> {
  const results: Array<{ name: string; hasExample: boolean; isInternal: boolean }> = [];
  const lines = source.split("\n");

  let jsdocLines: string[] = [];
  let inJsdoc = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("/**")) {
      jsdocLines = [trimmed];
      if (trimmed.includes("*/")) {
        inJsdoc = false;
      } else {
        inJsdoc = true;
      }
      continue;
    }

    if (inJsdoc) {
      jsdocLines.push(trimmed);
      if (trimmed.includes("*/")) {
        inJsdoc = false;
      }
      continue;
    }

    // Re-exports: skip — handled by resolveReExportedNames()
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

    if (trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
      jsdocLines = [];
    }
  }

  // Overload signatures appear as multiple `export function NAME` declarations for one
  // logical export; the JSDoc (with @example) sits on the first signature only. Collapse
  // same-name declarations into one entry — documented/internal if ANY declaration is.
  const merged = new Map<string, { name: string; hasExample: boolean; isInternal: boolean }>();
  for (const entry of results) {
    const existing = merged.get(entry.name);
    if (existing) {
      existing.hasExample ||= entry.hasExample;
      existing.isInternal ||= entry.isInternal;
    } else {
      merged.set(entry.name, { ...entry });
    }
  }
  return [...merged.values()];
}

/**
 * Builds a map of `name → absolute origin file path` for all re-exported names
 * in a barrel file. Handles two patterns:
 *
 * (a) Direct re-export: `export type { Foo, Bar } from './path'`
 * (b) Two-step: `import type { Foo } from './path'` + `export type { Foo }`
 */
function buildReExportMap(source: string, fromFile: string): Map<string, string> {
  const fileDir = dirname(fromFile);
  const map = new Map<string, string>();

  // (a) Direct re-export with `from` clause
  const directPattern = /^export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = directPattern.exec(source)) !== null) {
    const nameList = m[1];
    const specifier = m[2];
    if (!nameList || !specifier) continue;
    const names = nameList.split(",").map((n) => (n.trim().split(/\s+as\s+/)[0] ?? "").trim()).filter(Boolean);
    let originPath = resolve(fileDir, specifier);
    if (!originPath.endsWith(".ts")) originPath += ".ts";
    for (const name of names) map.set(name, originPath);
  }

  // (b) Two-step: build import map first, then match against export { ... } (no `from`)
  const importMap = new Map<string, string>();
  const importPattern = /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
  while ((m = importPattern.exec(source)) !== null) {
    const nameList = m[1];
    const specifier = m[2];
    if (!nameList || !specifier) continue;
    const names = nameList.split(",").map((n) => (n.trim().split(/\s+as\s+/)[0] ?? "").trim()).filter(Boolean);
    let originPath = resolve(fileDir, specifier);
    if (!originPath.endsWith(".ts")) originPath += ".ts";
    for (const name of names) importMap.set(name, originPath);
  }

  // Now find `export type { Foo }` or `export { Foo }` WITHOUT a `from` clause
  const exportNoFromPattern = /^export\s+(?:type\s+)?\{([^}]+)\}(?!\s+from)/gm;
  while ((m = exportNoFromPattern.exec(source)) !== null) {
    const nameList = m[1];
    if (!nameList) continue;
    const names = nameList.split(",").map((n) => (n.trim().split(/\s+as\s+/)[0] ?? "").trim()).filter(Boolean);
    for (const name of names) {
      if (importMap.has(name)) {
        map.set(name, importMap.get(name)!);
      }
    }
  }

  return map;
}

/**
 * Extracts the named symbols from a source file (only those matching targetNames).
 */
function extractNamedExports(
  source: string,
  targetNames: Set<string>
): Array<{ name: string; hasExample: boolean; isInternal: boolean }> {
  return extractPublicExports(source).filter((e) => targetNames.has(e.name));
}

describe("FIT-06 — every public export carries a JSDoc @example", () => {
  for (const filePath of PUBLIC_PATHS) {
    it(`${filePath.replace(ROOT, "src")} — all public exports have @example`, () => {
      const source = readFileSync(filePath, "utf-8");
      const directExports = extractPublicExports(source);
      const directViolations = directExports.filter((e) => !e.isInternal && !e.hasExample);

      // Follow re-exported names to their origin files and check defining JSDoc there.
      const reExportMap = buildReExportMap(source, filePath);
      const reExportViolations: string[] = [];

      // Group by origin file to batch reads.
      const byOrigin = new Map<string, string[]>();
      for (const [name, origin] of reExportMap) {
        if (!byOrigin.has(origin)) byOrigin.set(origin, []);
        byOrigin.get(origin)!.push(name);
      }

      for (const [originPath, names] of byOrigin) {
        let originSource: string;
        try {
          originSource = readFileSync(originPath, "utf-8");
        } catch {
          reExportViolations.push(...names.map((n) => `${n} (origin unresolved: ${originPath})`));
          continue;
        }

        const originExports = extractNamedExports(originSource, new Set(names));
        for (const name of names) {
          const entry = originExports.find((e) => e.name === name);
          if (!entry) continue; // May be a type-only alias without a named declaration; skip.
          if (!entry.isInternal && !entry.hasExample) {
            reExportViolations.push(name);
          }
        }
      }

      const allViolations = [
        ...directViolations.map((v) => v.name),
        ...reExportViolations,
      ];

      expect(allViolations).toEqual([]);
    });
  }

  // RED-PROOF: a public export without @example is detected as a violation.
  it("[red-proof] a public export without @example is detected as a violation", () => {
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

  // RED-PROOF: a re-exported type missing @example in its defining source is caught.
  it("[red-proof] a re-exported type without @example in its defining source is flagged", () => {
    // Simulate the two-step barrel pattern: import + export (no `from` in export line).
    const barrelSource = [
      `import type { UndocumentedHandle } from '../core/handle-def';`,
      `export type { UndocumentedHandle };`,
    ].join("\n");

    const originSource = `
/** No example here. */
export interface UndocumentedHandle {
  read(): Promise<string>;
}
`;

    const reExportMap = buildReExportMap(barrelSource, "/fake/commons/index.ts");
    const byOrigin = new Map<string, string[]>();
    for (const [name, origin] of reExportMap) {
      if (!byOrigin.has(origin)) byOrigin.set(origin, []);
      byOrigin.get(origin)!.push(name);
    }

    const violations: string[] = [];
    for (const [, names] of byOrigin) {
      const originExports = extractNamedExports(originSource, new Set(names));
      for (const name of names) {
        const entry = originExports.find((e) => e.name === name);
        if (entry && !entry.isInternal && !entry.hasExample) violations.push(name);
      }
    }

    expect(violations).toEqual(["UndocumentedHandle"]);
  });
});
