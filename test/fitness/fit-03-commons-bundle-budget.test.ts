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
const TYPESCRIPT_ENTRY = join(PROJECT_ROOT, "src/dialects/typescript/index.ts");

const BUDGET_BYTES = 50 * 1024; // 50 KB

// stage-5-first-dialect, REQ-FIT-03 (Amendments verify-plan-5 latitude ruling): /typescript's
// OWN budget, measured-and-pinned at S-002 apply time against a `--packages=external` build
// (measures OUR dialect code — ~6.8 KB at pin time — not ts-morph's pinned known weight,
// which the goldens already gate). Generous headroom, committed like the /commons budget.
const TYPESCRIPT_BUDGET_BYTES = 32 * 1024; // 32 KB

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
 * `packagesMode` controls dependency inlining: "bundle" (default, /commons — zero deps to
 * inline anyway) vs "external" (/typescript — measures OUR code, not ts-morph's weight,
 * REQ-FIT-03 Amendments verify-plan-5).
 */
function buildAndMeasure(
  entry: string,
  packagesMode: "bundle" | "external" = "bundle"
): { sizeBytes: number; output: string } {
  const outFile = join(PROJECT_ROOT, `.tmp-fit-03-bundle-${packagesMode}.js`);
  try {
    const result = spawnSync("bun", [
      "build", entry,
      "--target=node",
      "--minify",
      `--outfile=${outFile}`,
      `--packages=${packagesMode}`,
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

  // RED-PROOF (AST-lib specifier check): a fixture containing the "ts-morph" specifier string triggers the scan.
  it("[red-proof] a fixture importing ts-morph triggers the AST-lib specifier check", () => {
    const fixtureEntry = join(PROJECT_ROOT, ".tmp-fit-03-fixture.ts");
    writeFileSync(fixtureEntry, `
// Deliberate violation: embed a banned AST lib specifier string in the bundle output.
// We use a string literal (not a real import) so the test works without ts-morph installed.
// The scanner checks the BUNDLE OUTPUT for the specifier string.
const astLibName = "ts-morph";
export { astLibName };
`);

    try {
      const { output } = buildAndMeasure(fixtureEntry);
      const found = containsAstLibSpecifier(output);
      expect(found).toBe("ts-morph");
    } finally {
      if (existsSync(fixtureEntry)) unlinkSync(fixtureEntry);
    }
  });

  // RED-PROOF (budget dimension): a fixture that produces output > 50 KB triggers the budget check.
  it("[red-proof] a fixture with output > 50 KB triggers the budget size check", () => {
    const fixtureEntry = join(PROJECT_ROOT, ".tmp-fit-03-budget.ts");
    // Generate a module whose bundled output reliably exceeds 50 KB.
    // 60 KB of string literal content bundled as a single export easily exceeds the threshold.
    const padding = "x".repeat(60 * 1024);
    writeFileSync(fixtureEntry, `export const bigPayload = ${JSON.stringify(padding)};\n`);

    try {
      const { sizeBytes } = buildAndMeasure(fixtureEntry);
      expect(sizeBytes).toBeGreaterThanOrEqual(BUDGET_BYTES);
    } finally {
      if (existsSync(fixtureEntry)) unlinkSync(fixtureEntry);
    }
  });
});

describe("FIT-03 — /typescript payload budget (REQ-FIT-03, Amendments verify-plan-5)", () => {
  it("/typescript bundle (--packages=external) stays under its own committed budget", () => {
    const { sizeBytes } = buildAndMeasure(TYPESCRIPT_ENTRY, "external");
    expect(sizeBytes).toBeLessThan(TYPESCRIPT_BUDGET_BYTES);
  });

  it("the ts-morph specifier IS legitimately present in the /typescript external-output bundle (not a violation — scoped to commons only)", () => {
    const { output } = buildAndMeasure(TYPESCRIPT_ENTRY, "external");
    expect(output).toContain("ts-morph");
  });

  // RED-PROOF: a fixture whose /typescript-shaped bundle exceeds the pinned budget fires red.
  it("[red-proof] a fixture with output > the /typescript budget triggers the budget size check", () => {
    const fixtureEntry = join(PROJECT_ROOT, ".tmp-fit-03-typescript-budget.ts");
    const padding = "x".repeat(TYPESCRIPT_BUDGET_BYTES + 1024);
    writeFileSync(fixtureEntry, `export const bigPayload = ${JSON.stringify(padding)};\n`);

    try {
      const { sizeBytes } = buildAndMeasure(fixtureEntry, "external");
      expect(sizeBytes).toBeGreaterThanOrEqual(TYPESCRIPT_BUDGET_BYTES);
    } finally {
      if (existsSync(fixtureEntry)) unlinkSync(fixtureEntry);
    }
  });
});
