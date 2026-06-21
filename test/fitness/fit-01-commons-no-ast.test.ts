/**
 * FIT-01: commons imports zero AST libs.
 * Scans the import graph of src/commons/** using a static import-specifier scanner.
 * Allow-list = { SDK's own core public symbols, Node/Bun builtins }.
 * Any other import (esp. ts-morph/postcss/cheerio/babel) → fail.
 * Activates in S-004 (once /commons subpath exists as a stable surface).
 *
 * Red-proof: a fixture source importing ts-morph is caught by the scanner.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const COMMONS_DIR = new URL("../../src/commons", import.meta.url).pathname;
const ROOT_SRC = new URL("../../src", import.meta.url).pathname;

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

/**
 * Scans a TypeScript source for import specifiers (static and dynamic).
 * Returns the set of bare module specifiers found.
 */
function extractBareImports(source: string): string[] {
  const bare: string[] = [];
  // Match: import ... from 'specifier' / import('specifier') / require('specifier')
  const pattern = /(?:import\s+(?:type\s+)?(?:[^'"]*from\s+)?|import\s*\(|require\s*\()['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const specifier = match[1] ?? "";
    if (!isRelative(specifier)) {
      bare.push(specifier);
    }
  }
  return bare;
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
  it("src/commons/** has no bare imports outside Node/Bun builtins", () => {
    const commonsFiles = collectTs(COMMONS_DIR);
    const violations: Array<{ file: string; specifier: string }> = [];

    for (const filePath of commonsFiles) {
      const source = readFileSync(filePath, "utf-8");
      const bare = extractBareImports(source);

      for (const specifier of bare) {
        if (!isBuiltin(specifier)) {
          violations.push({ file: filePath.replace(ROOT_SRC, "src"), specifier });
        }
      }
    }

    expect(violations).toEqual([]);
  });

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

    const bare = extractBareImports(fixtureSource);
    const violations = bare.filter((s) => !isBuiltin(s) && !isRelative(s));

    expect(violations).toContain("ts-morph");
  });

  // RED-PROOF: Node builtins are NOT flagged.
  it("[red-proof] node: builtins are not flagged as violations", () => {
    const fixtureSource = `
import { readFileSync } from "node:fs";
import { join } from "node:path";
`;

    const bare = extractBareImports(fixtureSource);
    const violations = bare.filter((s) => !isBuiltin(s) && !isRelative(s));

    expect(violations).toEqual([]);
  });

  // RED-PROOF: relative imports to ../core are not flagged.
  it("[red-proof] relative imports (../core) are not flagged as violations", () => {
    const fixtureSource = `
import type { JsonValue } from "../core/wire.ts";
import { currentContext } from "../core/context.ts";
`;

    const bare = extractBareImports(fixtureSource);
    const violations = bare.filter((s) => !isBuiltin(s) && !isRelative(s));

    expect(violations).toEqual([]);
  });
});
