/**
 * FIT-38 (react-dialect S-000, ADR-01): `new Project(` — ts-morph's parser/project
 * constructor — appears ONLY inside a dialect's own `ast.ts` file (i.e. `src/dialects/
 * <name>/ast.ts`), repo-wide across the whole source tree. Retro-covers the shipped
 * TypeScript dialect (`src/dialects/typescript/ast.ts`), which predates this guard,
 * alongside the new React dialect leaf. Complements FIT-37 (import-specifier scan): this is
 * a call-SITE scan, so it also catches a hypothetical `new Project(` reached via a
 * re-exported constructor rather than a direct import.
 *
 * Red-proof: a fixture constructing `new Project(` outside any `ast.ts` file is caught.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const SRC_DIR = new URL("../../src", import.meta.url).pathname;

const PROJECT_CONSTRUCTION_PATTERN = /\bnew\s+Project\s*\(/;

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

// Only src/dialects/<name>/ast.ts is an authorized construction site.
function isAuthorizedAstFile(relativePath: string): boolean {
  return /^dialects\/[^/]+\/ast\.ts$/.test(relativePath);
}

interface ConstructionSite {
  file: string;
}

function findUnauthorizedConstructions(files: readonly string[]): ConstructionSite[] {
  const violations: ConstructionSite[] = [];
  for (const file of files) {
    const relativePath = relative(SRC_DIR, file);
    if (isAuthorizedAstFile(relativePath)) continue;
    const source = readFileSync(file, "utf-8");
    if (PROJECT_CONSTRUCTION_PATTERN.test(source)) {
      violations.push({ file: `src/${relativePath}` });
    }
  }
  return violations;
}

describe("FIT-38 — new Project( appears only in src/dialects/*/ast.ts", () => {
  it("no source file outside src/dialects/*/ast.ts constructs `new Project(`", () => {
    const files = collectTs(SRC_DIR);
    const violations = findUnauthorizedConstructions(files);
    expect(violations).toEqual([]);
  });

  it("both shipped dialects' ast.ts files DO construct new Project( (non-vacuous: the rule has authorized sites)", () => {
    const files = collectTs(SRC_DIR).filter((f) => isAuthorizedAstFile(relative(SRC_DIR, f)));
    const withConstruction = files.filter((f) => PROJECT_CONSTRUCTION_PATTERN.test(readFileSync(f, "utf-8")));
    const labels = withConstruction.map((f) => relative(SRC_DIR, f)).sort();
    expect(labels).toEqual(["dialects/react/ast.ts", "dialects/typescript/ast.ts"]);
  });

  // RED-PROOF: a fixture constructing `new Project(` outside any ast.ts file is caught.
  it("[red-proof] a fixture file outside ast.ts constructing new Project( is caught", () => {
    const fixtureSource = `
import { Project } from "ts-morph";
export function rogue() {
  return new Project();
}
`;
    expect(PROJECT_CONSTRUCTION_PATTERN.test(fixtureSource)).toBe(true);
  });

  // RED-PROOF: an unrelated `.project(` method call (not the ts-morph constructor) is not
  // false-positive flagged — the pattern requires the `new` keyword immediately before it.
  it("[red-proof] a same-named method call without `new` is not flagged", () => {
    const fixtureSource = `const p = someFactory.Project();`;
    expect(PROJECT_CONSTRUCTION_PATTERN.test(fixtureSource)).toBe(false);
  });
});
