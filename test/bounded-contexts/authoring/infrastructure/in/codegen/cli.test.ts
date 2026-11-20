/**
 * cli.ts core unit coverage — the generate() function (discover -> read
 * -> parse -> emit -> write). S-000 scope only: this proves the core is correct; the full
 * CLI argv/exit/stream matrix (TFO-03/04/05, FPS-01/05) is S-001's `codegen-cli.test.ts`,
 * spawning the built artifact — this file drives the function directly instead.
 */
import { describe, it, expect, afterEach, spyOn } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSchema, runCli } from "../../../../../../src/bounded-contexts/authoring/infrastructure/in/codegen/cli.ts";
import { computeSchemaDigest } from "../../../../../../src/bounded-contexts/authoring/domain/services/schema/schema-digest.ts";
import { GENERATED_HEADER } from "../../../../../../src/bounded-contexts/authoring/infrastructure/in/codegen/emit-type.ts";

let workDir: string | undefined;

afterEach(() => {
  if (workDir !== undefined) {
    rmSync(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

describe("generateSchema", () => {
  it("reads the adjacent schema.json, writes schema.generated.ts with the correct digest", () => {
    workDir = mkdtempSync(join(tmpdir(), "pbuilder-codegen-"));
    const schemaRaw = JSON.stringify({
      properties: { port: { type: "number", label: "Server port", required: true } },
    });
    writeFileSync(join(workDir, "schema.json"), schemaRaw, "utf-8");

    const result = generateSchema(workDir);

    const outputPath = join(workDir, "schema.generated.ts");
    expect(result.outputPath).toEqual(outputPath);
    expect(result.digest).toEqual(computeSchemaDigest(schemaRaw));

    const written = readFileSync(outputPath, "utf-8");
    expect(written).toContain(GENERATED_HEADER);
    expect(written).toContain(`// @schema-digest sha256:${computeSchemaDigest(schemaRaw)}`);
    expect(written).toContain("port: number;");
  });
});

describe("runCli — an enum with a choice that is not a string", () => {
  it("exits non-zero naming the property and writes no type", () => {
    workDir = mkdtempSync(join(tmpdir(), "codegen-enum-"));
    writeFileSync(join(workDir, "schema.json"), JSON.stringify({ properties: { mode: { type: "enum", label: "Mode", choices: [1, 2] } } }));
    const errors: string[] = [];
    const spy = spyOn(console, "error").mockImplementation((...args: unknown[]) => void errors.push(args.join(" ")));
    // runCli refuses to write outside the working directory, so it runs from the package.
    const cwd = process.cwd();
    let code: number;
    try {
      process.chdir(workDir);
      code = runCli(["."]);
    } finally {
      process.chdir(cwd);
      spy.mockRestore();
    }
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain('enum property "mode" has a choice that is not a string');
    expect(existsSync(join(workDir, "schema.generated.ts"))).toBe(false);
  });
});
