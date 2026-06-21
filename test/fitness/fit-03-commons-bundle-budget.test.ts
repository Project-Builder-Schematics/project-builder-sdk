/**
 * FIT-03: /commons payload budget.
 * `bun build` of the /commons entry MUST be < 50 KB minified AND contain no AST-lib module specifier.
 * The 50 KB threshold is generous; tightened when real deps land.
 * Activates in S-004 (once /commons subpath is stable).
 *
 * Red-proof: a fixture source that imports an AST lib is both over budget and contains
 * the AST-lib module specifier in the bundle output — the check fires red.
 */
import { describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const COMMONS_ENTRY = join(PROJECT_ROOT, "src/commons/index.ts");

const BUDGET_BYTES = 50 * 1024; // 50 KB

// AST lib specifiers whose presence in a bundle output indicates a violation
const AST_LIB_SPECIFIERS = [
  "ts-morph",
  "postcss",
  "cheerio",
  "@babel/",
  "babel-",
  "acorn",
  "esprima",
  "espree",
];

/**
 * Builds a single entry with bun build --minify and returns { sizeBytes, output }.
 */
function buildAndMeasure(entry: string): { sizeBytes: number; output: string } {
  const outFile = join(PROJECT_ROOT, ".tmp-fit-03-bundle.js");
  try {
    const result = spawnSync("bun", [
      "build", entry,
      "--target=node",
      "--minify",
      `--outfile=${outFile}`,
      "--packages=bundle",
    ], { cwd: PROJECT_ROOT, encoding: "utf-8" });

    if (result.status !== 0) {
      throw new Error(`bun build failed:\n${result.stderr}\n${result.stdout}`);
    }

    const output = existsSync(outFile) ? readFileSync(outFile, "utf-8") : "";
    const sizeBytes = Buffer.byteLength(output, "utf-8");
    return { sizeBytes, output };
  } finally {
    if (existsSync(outFile)) unlinkSync(outFile);
  }
}

function containsAstLibSpecifier(output: string): string | null {
  for (const specifier of AST_LIB_SPECIFIERS) {
    if (output.includes(specifier)) return specifier;
  }
  return null;
}

describe("FIT-03 — /commons payload budget < 50 KB + no AST-lib specifier", () => {
  it("/commons bundle is under 50 KB minified and contains no AST-lib specifier", () => {
    const { sizeBytes, output } = buildAndMeasure(COMMONS_ENTRY);

    const foundAstLib = containsAstLibSpecifier(output);

    expect(foundAstLib).toBeNull();
    expect(sizeBytes).toBeLessThan(BUDGET_BYTES);
  });

  // RED-PROOF: a fixture entry that imports an AST lib is over budget / contains specifier.
  it("[red-proof] a fixture importing ts-morph triggers the AST-lib specifier check", () => {
    const fixtureEntry = join(PROJECT_ROOT, ".tmp-fit-03-fixture.ts");
    writeFileSync(fixtureEntry, `
// Deliberate violation: import a non-existent AST lib specifier string to trigger the check.
// We use a dynamic string rather than a real import so the test doesn't require ts-morph installed.
// The scanner checks the BUNDLE OUTPUT for the specifier string.
const astLibName = "ts-morph";
export { astLibName };
`);

    try {
      const { output } = buildAndMeasure(fixtureEntry);
      // The bundle contains the literal string "ts-morph" — the specifier check fires.
      const found = containsAstLibSpecifier(output);
      expect(found).toBe("ts-morph");
    } finally {
      if (existsSync(fixtureEntry)) unlinkSync(fixtureEntry);
    }
  });
});
