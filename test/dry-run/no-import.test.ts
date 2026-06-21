/**
 * S-002.3 — FIT-dry-run-no-import: import-graph scan of src/dry-run/**.
 * Ensures the renderer module has no runtime import from src/core/** and no AST package.
 * Mirrors the FIT-01 scan approach (fit-01-commons-no-ast.test.ts).
 *
 * type-only imports (import type ...) are ALLOWED — only runtime imports are forbidden.
 * REQ-05.1: the dry-run module must be AST-blind and core-blind by construction.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const DRY_RUN_DIR = new URL("../../src/dry-run", import.meta.url).pathname;
const ROOT_SRC = new URL("../../src", import.meta.url).pathname;

// Known AST packages that must never appear in the dry-run renderer.
const BANNED_AST_PACKAGES = [
  "ts-morph",
  "@typescript-eslint/typescript-estree",
  "typescript",
  "recast",
  "babel",
  "@babel/",
  "postcss",
  "cheerio",
  "acorn",
];

/**
 * Collects all .ts files under a directory recursively.
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

/**
 * Extracts RUNTIME import specifiers from a TypeScript source file.
 * Type-only imports (import type ...) are excluded — they are erased at compile time
 * and cannot introduce a runtime dependency.
 */
function extractRuntimeImports(source: string): string[] {
  const runtime: string[] = [];
  // Match runtime imports: `import { ... } from 'x'` or `import 'x'` but NOT `import type ...`
  const runtimeImportPattern =
    /^import\s+(?!type\s+)(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = runtimeImportPattern.exec(source)) !== null) {
    const specifier = match[1] ?? "";
    runtime.push(specifier);
  }
  return runtime;
}

/**
 * Returns true if the specifier is a relative path into src/core/.
 */
function isCoreRuntimeImport(specifier: string): boolean {
  // Relative imports to ../core or similar paths that resolve to src/core/
  return specifier.startsWith("../core") || specifier.startsWith("./core");
}

/**
 * Returns true if the specifier is a banned AST package.
 */
function isAstPackage(specifier: string): boolean {
  return BANNED_AST_PACKAGES.some((pkg) => specifier === pkg || specifier.startsWith(pkg));
}

describe("FIT-dry-run-no-import — renderer has no core runtime or AST imports (REQ-05.1)", () => {
  const dryRunFiles = collectTs(DRY_RUN_DIR);

  it("src/dry-run/** contains at least one file to scan", () => {
    expect(dryRunFiles.length).toBeGreaterThan(0);
  });

  it("src/dry-run/** has no runtime import from src/core/**", () => {
    const violations: Array<{ file: string; specifier: string }> = [];

    for (const filePath of dryRunFiles) {
      const source = readFileSync(filePath, "utf-8");
      const runtimeImports = extractRuntimeImports(source);

      for (const specifier of runtimeImports) {
        if (isCoreRuntimeImport(specifier)) {
          violations.push({ file: filePath.replace(ROOT_SRC, "src"), specifier });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("src/dry-run/** has no AST package imports", () => {
    const violations: Array<{ file: string; specifier: string }> = [];

    for (const filePath of dryRunFiles) {
      const source = readFileSync(filePath, "utf-8");
      const runtimeImports = extractRuntimeImports(source);

      for (const specifier of runtimeImports) {
        if (isAstPackage(specifier)) {
          violations.push({ file: filePath.replace(ROOT_SRC, "src"), specifier });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  // RED-PROOF: a source with a runtime import from ../core/session is detected.
  it("[red-proof] a runtime import from ../core/session is flagged as a violation", () => {
    const fixtureSource = `import { Session } from "../core/session.ts";`;
    const runtimeImports = extractRuntimeImports(fixtureSource);
    const violations = runtimeImports.filter(isCoreRuntimeImport);
    expect(violations).toContain("../core/session.ts");
  });

  // RED-PROOF: a type-only import from ../core/wire is NOT flagged (type imports are erased).
  it("[red-proof] a type-only import from ../core/wire is NOT flagged", () => {
    const fixtureSource = `import type { Directive } from "../core/wire.ts";`;
    const runtimeImports = extractRuntimeImports(fixtureSource);
    const violations = runtimeImports.filter(isCoreRuntimeImport);
    expect(violations).toEqual([]);
  });

  // RED-PROOF: a ts-morph import is caught by the AST package check.
  it("[red-proof] a ts-morph import is caught as a banned AST package", () => {
    const fixtureSource = `import { Project } from "ts-morph";`;
    const runtimeImports = extractRuntimeImports(fixtureSource);
    const violations = runtimeImports.filter(isAstPackage);
    expect(violations).toContain("ts-morph");
  });
});
