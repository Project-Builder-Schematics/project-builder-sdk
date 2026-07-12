/**
 * FIT-01: commons imports zero AST libs — TRANSITIVELY (S-000, REQ-FIT-01, verify-plan-5
 * latitude ruling).
 *
 * Rebuilt from a per-file direct-specifier scan into a relative-import-closure GRAPH WALK:
 * starting at every file under src/commons/**, the walk follows every RELATIVE import edge
 * to any depth — including legitimate non-core SDK-internal targets (e.g. ../dry-run/*,
 * commons-local modules) — and fails on any BARE non-builtin specifier reached anywhere in
 * that reachable graph. The invariant is "zero external packages reachable from commons",
 * NOT "commons only imports core" — a target-allow-list reading was explicitly REJECTED
 * (verify-plan-5) because it would flag today's legitimate ../dry-run imports as violations.
 *
 * Red-proof: a fixture source importing ts-morph is caught by the scanner (direct case,
 * pre-existing). A PLANTED two-file fixture (leaf.ts → helper.ts → ts-morph) additionally
 * proves the TRANSITIVE case a direct-only scanner could not see (permanent fixture, below).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";

const COMMONS_DIR = new URL("../../src/commons", import.meta.url).pathname;
const ROOT_SRC = new URL("../../src", import.meta.url).pathname;
const TRANSITIVE_FIXTURE_DIR = new URL("../fixtures/red/fit-01-transitive", import.meta.url).pathname;

// Builtin Node/Bun module prefixes
const BUILTIN_PREFIXES = [
  "node:",
  "bun:",
];

// Known-internal relative paths: imports from commons itself or from ../core stay allowed.
// Any bare specifier (npm package) not in the allow-list is a violation.
function isBuiltin(specifier: string): boolean {
  return BUILTIN_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

// Strips block (/* ... */) and line (// ...) comments before specifier extraction — a
// JSDoc @example block showing a SAMPLE import as prose (e.g. authoring-error.ts's
// `@example import { AuthoringError } from "@pbuilder/sdk/commons";`) is not a real import
// edge and must never register as a violation or a traversal edge. Naive but sufficient:
// this repo's source has no "//" inside string literals that would need protecting.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Scans a TypeScript source for ALL import specifiers (static and dynamic) — both bare
 * and relative, AND re-export specifiers (`export { x } from "..."` / `export * from
 * "..."`) — the walker needs re-export edges to follow commons' own barrel-style
 * re-exports (e.g. `export { classifyContent } from "./classify-content.ts"`). Per-file
 * bare-only checks (the red-proof tests) filter this down via `extractBareImports`.
 */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const withoutComments = stripComments(source);
  // Match: import/export ... from 'specifier' / import('specifier') / require('specifier')
  const pattern =
    /(?:(?:import|export)\s+(?:type\s+)?(?:[^'"]*from\s+)?|import\s*\(|require\s*\()['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    specifiers.push(match[1] ?? "");
  }
  return specifiers;
}

/**
 * Scans a TypeScript source for BARE import specifiers only (unchanged behaviour from the
 * pre-S-000 direct-only scanner — the three original red-proof tests below still exercise
 * this exact function against inline source strings).
 */
function extractBareImports(source: string): string[] {
  return extractImportSpecifiers(source).filter((specifier) => !isRelative(specifier));
}

interface ImportViolation {
  file: string;
  specifier: string;
}

/** Resolves a relative import specifier (always carries its own `.ts` extension in this repo). */
function resolveRelativeImport(fromFile: string, specifier: string): string {
  return resolve(dirname(fromFile), specifier);
}

/**
 * Transitive import-graph walk (S-000, REQ-FIT-01, verify-plan-5 latitude ruling): starting
 * from `entryFiles`, follows every RELATIVE import edge to any depth — traversal edges
 * leaving commons (e.g. into ../core, ../dry-run) are legitimate, not violations — and
 * reports every BARE non-builtin specifier reached anywhere in that graph.
 */
function walkTransitiveImports(entryFiles: readonly string[]): ImportViolation[] {
  const visited = new Set<string>();
  const queue: string[] = [...entryFiles];
  const violations: ImportViolation[] = [];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      // An unresolvable edge is not this scanner's concern — fs errors surface elsewhere.
      continue;
    }

    for (const specifier of extractImportSpecifiers(source)) {
      if (isRelative(specifier)) {
        queue.push(resolveRelativeImport(file, specifier));
      } else if (!isBuiltin(specifier)) {
        violations.push({ file, specifier });
      }
    }
  }

  return violations;
}

/**
 * Collect all .ts files under a directory recursively.
 */
function collectTs(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectTs(full));
    } else if (extname(full) === ".ts") {
      files.push(full);
    }
  }
  return files;
}

describe("FIT-01 — commons imports zero AST libs", () => {
  // [characterization] — the invariant (zero violations) already held under the old
  // direct-only scanner; only the ENFORCEMENT MECHANISM deepens here (RED waived — the
  // new mechanism's failing case is proven by the permanent-fixture test below instead).
  it("src/commons/** has no bare imports outside Node/Bun builtins, at ANY transitive depth", () => {
    const entryFiles = collectTs(COMMONS_DIR);
    const violations = walkTransitiveImports(entryFiles).map((v) => ({
      file: v.file.replace(ROOT_SRC, "src"),
      specifier: v.specifier,
    }));

    expect(violations).toEqual([]);
  });

  // Bare non-builtin specifiers in a single source — extractBareImports already excludes
  // relative specifiers, so builtin-ness is the only remaining filter.
  function violationsIn(source: string): string[] {
    return extractBareImports(source).filter((s) => !isBuiltin(s));
  }

  // RED-PROOF: a fixture that imports an AST lib is detected.
  it("[red-proof] a fixture importing ts-morph is caught", () => {
    const fixtureSource = `
import { Project } from "ts-morph";
import { readFileSync } from "node:fs";

export function parseAst(path: string) {
  const project = new Project();
  return project.addSourceFileAtPath(path);
}
`;

    expect(violationsIn(fixtureSource)).toContain("ts-morph");
  });

  // RED-PROOF: Node builtins are NOT flagged.
  it("[red-proof] node: builtins are not flagged as violations", () => {
    const fixtureSource = `
import { readFileSync } from "node:fs";
import { join } from "node:path";
`;

    expect(violationsIn(fixtureSource)).toEqual([]);
  });

  // RED-PROOF: relative imports to ../core are not flagged.
  it("[red-proof] relative imports (../core) are not flagged as violations", () => {
    const fixtureSource = `
import type { JsonValue } from "../core/wire.ts";
import { currentContext } from "../core/context.ts";
`;

    expect(violationsIn(fixtureSource)).toEqual([]);
  });
});

describe("[permanent-fixture] FIT-01 transitive red-proof — leaf imports helper imports ts-morph", () => {
  const leafPath = join(TRANSITIVE_FIXTURE_DIR, "leaf.ts");
  const helperPath = join(TRANSITIVE_FIXTURE_DIR, "helper.ts");

  it("leaf.ts alone has no direct violation — a per-file scanner would miss this", () => {
    const source = readFileSync(leafPath, "utf-8");
    expect(extractBareImports(source)).toEqual([]);
  });

  it("the graph walk reaches the transitive ts-morph import through helper.ts", () => {
    const violations = walkTransitiveImports([leafPath]);

    expect(violations).toEqual([{ file: helperPath, specifier: "ts-morph" }]);
  });
});
