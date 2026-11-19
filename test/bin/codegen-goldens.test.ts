/**
 * P-CG (S0c, proposal section 5): pbuilder-codegen's output for every schema.json under
 * test/fixtures/, compared byte for byte with the committed goldens. A schema codegen refuses
 * has its failure text as the golden. Each schema is copied into a scratch package, so the
 * committed schema.generated.ts files are never rewritten. Rewrite the goldens with
 * P_CG_WRITE=1 only for an intended change.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { generateSchema } from "../../src/bounded-contexts/authoring/infrastructure/in/codegen/cli.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const FIXTURES = join(ROOT, "test/fixtures");
const GOLDENS = join(import.meta.dir, "fixtures/codegen-goldens");
const WRITE = process.env.P_CG_WRITE === "1";

function schemaDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return schemaDirs(path);
    return entry.name === "schema.json" ? [relative(FIXTURES, dir)] : [];
  });
}

function generate(fixture: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "p-cg-"));
  try {
    copyFileSync(join(FIXTURES, fixture, "schema.json"), join(scratch, "schema.json"));
    try {
      const { outputPath } = generateSchema(scratch);
      return readFileSync(outputPath, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return `refused\n${message.split(scratch).join("<package>")}\n`;
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const goldenPath = (fixture: string): string => join(GOLDENS, fixture, "schema.generated.ts.golden");
const fixtures = schemaDirs(FIXTURES).sort();
const actual = new Map<string, string>();

beforeAll(() => {
  for (const fixture of fixtures) actual.set(fixture, generate(fixture));
  if (WRITE) {
    rmSync(GOLDENS, { recursive: true, force: true });
    for (const [fixture, text] of actual) {
      mkdirSync(dirname(goldenPath(fixture)), { recursive: true });
      writeFileSync(goldenPath(fixture), text);
    }
  }
});

describe("P-CG — pbuilder-codegen output matches the goldens", () => {
  it("every fixture schema has a golden and every golden has a schema", () => {
    expect(fixtures.length).toBeGreaterThan(5);
    const goldens = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? goldens(join(dir, entry.name)) : [relative(GOLDENS, dir)],
      );
    expect(existsSync(GOLDENS) ? goldens(GOLDENS).sort() : []).toEqual(fixtures);
  });

  it("each schema's output is byte-identical to its golden", () => {
    const diffs = fixtures.filter((fixture) => !existsSync(goldenPath(fixture)) || readFileSync(goldenPath(fixture), "utf-8") !== actual.get(fixture));
    expect(diffs).toEqual([]);
  });
});
