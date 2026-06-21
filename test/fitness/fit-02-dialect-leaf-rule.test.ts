/**
 * FIT-02: No dialect imports another dialect (leaf rule).
 * Dialects live under src/dialects/<name>/. A dialect must not import from
 * a sibling dialect directory. Violations are detected via static import scanning.
 *
 * No dialects exist yet at S-004. The scan returns zero violations for the current tree.
 * The rule is wired now so that when dialects land it fires automatically.
 *
 * Red-proof: a fixture with a cross-dialect import is caught by the scanner.
 * Activates in S-004.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const DIALECTS_DIR = new URL("../../src/dialects", import.meta.url).pathname;
const SRC_DIR = new URL("../../src", import.meta.url).pathname;

/**
 * Returns the names of all dialect directories under src/dialects/.
 * Returns [] when the directory does not exist (no dialects yet).
 */
function listDialects(): string[] {
  if (!existsSync(DIALECTS_DIR)) return [];
  return readdirSync(DIALECTS_DIR).filter((entry) => {
    return statSync(join(DIALECTS_DIR, entry)).isDirectory();
  });
}

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
 * Returns any cross-dialect imports found in a source file belonging to `ownerDialect`.
 * A cross-dialect import is a relative import that navigates into a sibling dialect directory.
 */
function findCrossDialectImports(
  source: string,
  ownerDialect: string,
  allDialects: string[]
): string[] {
  const violations: string[] = [];
  const importPattern = /(?:import\s+(?:type\s+)?(?:[^'"]*from\s+)?|import\s*\()['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    const specifier = match[1] ?? "";
    // Only check relative imports
    if (!specifier.startsWith(".")) continue;

    // Check if the specifier navigates into a sibling dialect
    for (const dialect of allDialects) {
      if (dialect === ownerDialect) continue;
      // e.g. ../../dialects/ts-morph or ../ts-morph (when inside the dialect dir itself)
      if (specifier.includes(`dialects/${dialect}`) || specifier.includes(`/${dialect}/`)) {
        violations.push(specifier);
      }
    }
  }

  return violations;
}

describe("FIT-02 — no dialect imports another dialect (leaf rule)", () => {
  it("no cross-dialect imports exist in src/dialects/**", () => {
    const dialects = listDialects();

    // No dialects yet — scan returns no violations; rule is pre-wired for when they land.
    if (dialects.length === 0) {
      // Explicitly assert the directory is absent or empty: the rule is ready to enforce.
      expect(dialects).toEqual([]);
      return;
    }

    const violations: Array<{ file: string; specifier: string; ownerDialect: string }> = [];

    for (const dialect of dialects) {
      const dialectDir = join(DIALECTS_DIR, dialect);
      const files = collectTs(dialectDir);

      for (const filePath of files) {
        const source = readFileSync(filePath, "utf-8");
        const crossImports = findCrossDialectImports(source, dialect, dialects);

        for (const specifier of crossImports) {
          violations.push({
            file: filePath.replace(SRC_DIR, "src"),
            specifier,
            ownerDialect: dialect,
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  // RED-PROOF: a fixture simulating a cross-dialect import is caught.
  it("[red-proof] a simulated cross-dialect import is detected", () => {
    // Fixture: a file in 'src/dialects/ts-morph/' importing from 'src/dialects/postcss/'
    const fixtureSource = `
import { parseCSS } from "../../dialects/postcss/index.ts";
import type { Project } from "ts-morph";

export function processFile(path: string) {}
`;

    const allDialects = ["ts-morph", "postcss"];
    const ownerDialect = "ts-morph";

    const crossImports = findCrossDialectImports(fixtureSource, ownerDialect, allDialects);

    expect(crossImports).toContain("../../dialects/postcss/index.ts");
  });

  // RED-PROOF: an import from commons is NOT a cross-dialect violation.
  it("[red-proof] importing from commons is not a cross-dialect violation", () => {
    const fixtureSource = `
import { find } from "../../commons/index.ts";
import { currentContext } from "../../core/context.ts";
`;

    const allDialects = ["ts-morph", "postcss"];
    const ownerDialect = "ts-morph";

    const crossImports = findCrossDialectImports(fixtureSource, ownerDialect, allDialects);

    expect(crossImports).toEqual([]);
  });
});
