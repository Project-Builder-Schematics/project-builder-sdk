/**
 * fit-39 (design § 4.7, single-encode-site — S-003, typed-options-feeder): the options-encode
 * transform (`encodeOptions` by name, or an options-targeting `JSON.stringify` call) lives
 * ONLY in `src/core/directive-factory.ts` (the definition) and
 * `src/scaffold/classify-transport.ts` (the CCL-02.4 budget-estimate call site) — never a
 * second, independent encode call site anywhere else in `src/`. Explicitly asserts absence
 * from `src/commons/index.ts` and `src/scaffold/expander.ts` — the two verb-layer files that
 * funnel through the factory instead of encoding themselves (design §4.1).
 *
 * Tolerates: a comment or a bare import mentioning the name (no `(` call syntax following
 * it) outside the allow-list. Does NOT tolerate: an actual `encodeOptions(...)` call, or an
 * independent `JSON.stringify(...options...)` call, outside the allow-list.
 *
 * Red-proof: inline planted fixtures (fit-10/fit-29/fit-30/fit-32's established no-fixture-file
 * pattern).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles, stripComments } from "../support/import-scan.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = join(PROJECT_ROOT, "src");
const DIRECTIVE_FACTORY_FILE = join(SRC_DIR, "core", "directive-factory.ts");
const CLASSIFY_TRANSPORT_FILE = join(SRC_DIR, "scaffold", "classify-transport.ts");
const COMMONS_FILE = join(SRC_DIR, "commons", "index.ts");
const EXPANDER_FILE = join(SRC_DIR, "scaffold", "expander.ts");
const ALLOWED_FILES = new Set([DIRECTIVE_FACTORY_FILE, CLASSIFY_TRANSPORT_FILE]);

// An options-targeting JSON.stringify call — a second, independent encode site bypassing
// the shared `encodeOptions` helper entirely (the case a bare `encodeOptions`-name scan
// would miss).
const OPTIONS_STRINGIFY_PATTERN = /JSON\.stringify\([^)]*\boptions\b/;
// A genuine CALL to encodeOptions — comments and bare import specifiers are tolerated
// (stripComments removes comments below; an import with no trailing "(" never matches).
const ENCODE_OPTIONS_CALL_PATTERN = /\bencodeOptions\s*\(/;

function siteViolations(source: string): string[] {
  const code = stripComments(source);
  const violations: string[] = [];
  if (ENCODE_OPTIONS_CALL_PATTERN.test(code)) violations.push("calls encodeOptions");
  if (OPTIONS_STRINGIFY_PATTERN.test(code)) violations.push("options-targeting JSON.stringify call");
  return violations;
}

describe("fit-39 — single-encode-site (encodeOptions confined to directive-factory.ts + classify-transport.ts)", () => {
  it("the walk reaches the real src/ tree (non-vacuous)", () => {
    const files = collectTsFiles(SRC_DIR);
    expect(files).toContain(DIRECTIVE_FACTORY_FILE);
    expect(files).toContain(CLASSIFY_TRANSPORT_FILE);
    expect(files).toContain(COMMONS_FILE);
    expect(files).toContain(EXPANDER_FILE);
  });

  it("directive-factory.ts DOES define encodeOptions (sanity — the allow-list isn't vacuously empty)", () => {
    expect(readFileSync(DIRECTIVE_FACTORY_FILE, "utf-8")).toContain("export function encodeOptions");
  });

  it("classify-transport.ts DOES call encodeOptions (sanity — the S-003 CCL-02.4 wiring is present)", () => {
    expect(ENCODE_OPTIONS_CALL_PATTERN.test(readFileSync(CLASSIFY_TRANSPORT_FILE, "utf-8"))).toBe(true);
  });

  describe("full src/ scan — no encode site outside the allow-list", () => {
    for (const file of collectTsFiles(SRC_DIR)) {
      if (ALLOWED_FILES.has(file)) continue;
      it(`${file.replace(PROJECT_ROOT, "")} holds no encode site`, () => {
        expect(siteViolations(readFileSync(file, "utf-8"))).toEqual([]);
      });
    }
  });

  it("src/commons/index.ts holds no encode site (verb layer funnels through the factory)", () => {
    expect(siteViolations(readFileSync(COMMONS_FILE, "utf-8"))).toEqual([]);
  });

  it("src/scaffold/expander.ts holds no encode site (verb layer funnels through the factory)", () => {
    expect(siteViolations(readFileSync(EXPANDER_FILE, "utf-8"))).toEqual([]);
  });

  // RED-PROOF: a planted call to encodeOptions outside the allow-list is caught.
  it("[red-proof] a planted encodeOptions(...) call outside the allow-list is flagged", () => {
    const fixture = `import { encodeOptions } from "../core/directive-factory.ts";\nexport const x = encodeOptions({});`;
    expect(siteViolations(fixture)).not.toEqual([]);
  });

  // RED-PROOF: a planted options-targeting JSON.stringify bypassing encodeOptions by name.
  it("[red-proof] a planted options-targeting JSON.stringify (bypassing encodeOptions by name) is flagged", () => {
    const fixture = `export function sneaky(options: unknown) { return JSON.stringify(options); }`;
    expect(siteViolations(fixture)).not.toEqual([]);
  });

  // RED-PROOF (no false positive): a mere comment/import mention, never called, is tolerated.
  it("[red-proof] a bare comment/import reference to encodeOptions (never called) is NOT flagged", () => {
    const fixture = `// see encodeOptions in directive-factory.ts for the encode contract\nimport { encodeOptions } from "../core/directive-factory.ts";\nexport { encodeOptions };`;
    expect(siteViolations(fixture)).toEqual([]);
  });

  // RED-PROOF (no false positive): an unrelated JSON.stringify call (whole directive/batch,
  // or an unrelated field like `include`/`exclude`) is NOT flagged.
  it("[red-proof] an unrelated JSON.stringify call (whole directive, unrelated field) is NOT flagged", () => {
    const fixture = `
export function unrelated(directive: unknown, include: string[]) {
  const size = Buffer.byteLength(JSON.stringify(directive), "utf8");
  const msg = \`include: \${JSON.stringify(include)}\`;
  return size + msg.length;
}`;
    expect(siteViolations(fixture)).toEqual([]);
  });
});
