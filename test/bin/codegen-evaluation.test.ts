/**
 * A-120 / A-122: codegen reads the role from the Collection definition entry and, for
 * `evaluation`, emits the Findings Result and the scope inputs, and refuses a schema.json that
 * declares either.
 */
import { afterEach, expect, it } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GENERATED_FILENAME } from "../../src/bounded-contexts/authoring/infrastructure/in/codegen/cli.ts";
import { emitInputType } from "../../src/bounded-contexts/authoring/infrastructure/in/codegen/emit-type.ts";
import { parseSchema } from "../../src/bounded-contexts/authoring/domain/services/schema/schema-parse.ts";
import { computeSchemaDigest } from "../../src/bounded-contexts/authoring/domain/services/schema/schema-digest.ts";

const cli = resolve(import.meta.dir, "../../bin/pbuilder-codegen.ts");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function project(schema: object, registration: object) {
  const root = fs.mkdtempSync(join(tmpdir(), "codegen-evaluation-"));
  roots.push(root);
  const pkg = join(root, "check");
  fs.mkdirSync(pkg);
  fs.writeFileSync(join(pkg, "schema.json"), JSON.stringify(schema));
  fs.writeFileSync(join(pkg, "factory.ts"), "export default () => {};\n");
  fs.writeFileSync(join(root, "project-builder.json"), JSON.stringify({ collections: { app: { check: { path: "./check", ...registration } } } }));
  const child = Bun.spawnSync([process.execPath, cli, "--project", root], { cwd: root });
  const output = join(pkg, GENERATED_FILENAME);
  return {
    code: child.exitCode,
    stderr: child.stderr.toString(),
    generated: fs.existsSync(output) ? fs.readFileSync(output, "utf8") : undefined,
  };
}

const STRICT = { properties: { strict: { type: "boolean", label: "Strict" } } };

it("A-120 / A-122: emits the Findings Result and the scope inputs for the role evaluation", () => {
  const ran = project(STRICT, { role: "evaluation" });
  expect(ran.code).toBe(0);
  expect(ran.generated).toContain(
    [
      "export type Input = {",
      "  /** Strict */",
      "  strict: boolean;",
      "  /** Globs or literal paths to check */",
      "  include?: string[];",
      "  /** Globs or literal paths to skip */",
      "  exclude?: string[];",
      "};",
    ].join("\n")
  );
  expect(ran.generated).toContain(
    'export type Findings = { items: Array<{ rule: string; message: string; severity: "error" | "warning"; path?: string; ' +
      "range?: { start: { line: number; column: number }; end?: { line: number; column: number } }; " +
      "fix?: { schematic: string; inputs?: { [key: string]: unknown } } }> };"
  );
  expect(ran.generated).toContain("export type Result = Findings;");
}, 30_000);

it("A-120: refuses an evaluation schematic whose schema.json declares a Result", () => {
  const ran = project({ ...STRICT, result: { type: "string" } }, { role: "evaluation" });
  expect(ran.code).toBe(1);
  expect(ran.stderr).toContain("an evaluation schematic declares a Result, which the role fixes as Findings");
  expect(ran.generated).toBeUndefined();
}, 30_000);

for (const input of ["include", "exclude"]) {
  it(`A-122: refuses an evaluation schematic that declares the input ${input}`, () => {
    const ran = project({ properties: { [input]: { type: "string", label: input } } }, { role: "evaluation" });
    expect(ran.code).toBe(1);
    expect(ran.stderr).toContain(`an evaluation schematic declares the input \\"${input}\\", which the role imposes`);
    expect(ran.generated).toBeUndefined();
  }, 30_000);
}

it("keeps a generator's output, with or without the role field, as before", () => {
  const schema = { properties: { include: { type: "string", label: "Include" } }, result: { type: "string" } };
  const expected = emitInputType(parseSchema(JSON.stringify(schema)), computeSchemaDigest(JSON.stringify(schema)));
  expect(project(schema, {}).generated).toBe(expected);
  expect(project(schema, { role: "generator" }).generated).toBe(expected);
}, 30_000);
