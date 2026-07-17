/**
 * FIT-37 (react-dialect S-000, ADR-01): `src/core/**` and `src/commons/**` import ZERO AST
 * libraries, transitively — the boundary ADR-01 refused to breach (fidelity-glue primitives
 * are DUPLICATED into each dialect's own `ast.ts`, never hoisted into core) was previously
 * enforced only by convention. This guards it mechanically, repo-wide across both directories,
 * complementing FIT-01 (commons-only, ALL bare imports) and FIT-38 (`new Project(` call-site
 * confinement).
 *
 * Same transitive relative-import-graph-walk shape as FIT-01, filtered to a known AST-library
 * specifier list instead of "every bare import" — core legitimately imports other bare
 * builtins-adjacent internals none of which are AST libraries, so a bare-import-blanket ban
 * (FIT-01's stricter commons-only rule) would be the wrong shape here.
 *
 * Red-proof: a fixture importing ts-morph directly is caught (direct case). A PLANTED
 * two-file fixture (leaf -> helper -> ts-morph) proves the TRANSITIVE case.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";

const CORE_DIR = new URL("../../src/core", import.meta.url).pathname;
const COMMONS_DIR = new URL("../../src/commons", import.meta.url).pathname;
const ROOT_SRC = new URL("../../src", import.meta.url).pathname;
const TRANSITIVE_FIXTURE_DIR = new URL("../fixtures/red/fit-37-transitive", import.meta.url).pathname;

// Known AST-parsing/mutation libraries — ts-morph (the shipped dependency, must stay
// leaf-isolated to src/dialects/*/ast.ts per ADR-01) plus the exploration spike's rejected
// alternatives (REQ-RXD-14) and a few common peers, so a future accidental reach for any of
// them from core/commons fails loud instead of silently widening the boundary.
const AST_LIBRARIES = [
  "ts-morph",
  "@babel/parser",
  "@babel/generator",
  "@babel/types",
  "@babel/traverse",
  "recast",
  "magic-string",
  "acorn",
  "espree",
  "esprima",
];

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const withoutComments = stripComments(source);
  const pattern =
    /(?:(?:import|export)\s+(?:type\s+)?(?:[^'"]*from\s+)?|import\s*\(|require\s*\()['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    specifiers.push(match[1] ?? "");
  }
  return specifiers;
}

function matchedAstLibrary(specifier: string): string | undefined {
  return AST_LIBRARIES.find((lib) => specifier === lib || specifier.startsWith(`${lib}/`));
}

interface AstLibViolation {
  file: string;
  specifier: string;
}

function resolveRelativeImport(fromFile: string, specifier: string): string {
  return resolve(dirname(fromFile), specifier);
}

function walkForAstLibraries(entryFiles: readonly string[]): AstLibViolation[] {
  const visited = new Set<string>();
  const queue: string[] = [...entryFiles];
  const violations: AstLibViolation[] = [];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    for (const specifier of extractImportSpecifiers(source)) {
      if (isRelative(specifier)) {
        queue.push(resolveRelativeImport(file, specifier));
        continue;
      }
      const matched = matchedAstLibrary(specifier);
      if (matched !== undefined) {
        violations.push({ file, specifier });
      }
    }
  }

  return violations;
}

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

describe("FIT-37 — src/core/** and src/commons/** import zero AST libraries", () => {
  it("no AST-library import is reachable from src/core/**, at any transitive depth", () => {
    const entryFiles = collectTs(CORE_DIR);
    const violations = walkForAstLibraries(entryFiles).map((v) => ({
      file: v.file.replace(ROOT_SRC, "src"),
      specifier: v.specifier,
    }));
    expect(violations).toEqual([]);
  });

  it("no AST-library import is reachable from src/commons/**, at any transitive depth", () => {
    const entryFiles = collectTs(COMMONS_DIR);
    const violations = walkForAstLibraries(entryFiles).map((v) => ({
      file: v.file.replace(ROOT_SRC, "src"),
      specifier: v.specifier,
    }));
    expect(violations).toEqual([]);
  });

  // RED-PROOF: a fixture directly importing ts-morph is caught.
  it("[red-proof] a fixture importing ts-morph directly is caught", () => {
    const fixtureSource = `
import { Project } from "ts-morph";
import { readFileSync } from "node:fs";
`;
    const violations = extractImportSpecifiers(fixtureSource)
      .filter((s) => !isRelative(s))
      .map(matchedAstLibrary)
      .filter((m): m is string => m !== undefined);
    expect(violations).toContain("ts-morph");
  });

  // RED-PROOF: an unrelated bare import (e.g. a hypothetical utility) is NOT flagged — this
  // guard is AST-library-specific, unlike FIT-01's blanket commons rule.
  it("[red-proof] a non-AST bare import is not flagged", () => {
    const fixtureSource = `import { z } from "some-schema-lib";`;
    const violations = extractImportSpecifiers(fixtureSource)
      .filter((s) => !isRelative(s))
      .map(matchedAstLibrary)
      .filter((m): m is string => m !== undefined);
    expect(violations).toEqual([]);
  });
});

describe("[permanent-fixture] FIT-37 transitive red-proof — leaf imports helper imports ts-morph", () => {
  const leafPath = join(TRANSITIVE_FIXTURE_DIR, "leaf.ts");
  const helperPath = join(TRANSITIVE_FIXTURE_DIR, "helper.ts");

  it("leaf.ts alone has no direct violation — a per-file scanner would miss this", () => {
    const source = readFileSync(leafPath, "utf-8");
    const violations = extractImportSpecifiers(source)
      .filter((s) => !isRelative(s))
      .map(matchedAstLibrary)
      .filter((m): m is string => m !== undefined);
    expect(violations).toEqual([]);
  });

  it("the graph walk reaches the transitive ts-morph import through helper.ts", () => {
    const violations = walkForAstLibraries([leafPath]);
    expect(violations).toEqual([{ file: helperPath, specifier: "ts-morph" }]);
  });
});
