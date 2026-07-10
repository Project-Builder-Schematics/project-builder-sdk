/**
 * bin/pbuilder-codegen.ts core unit coverage — the generate() function (discover -> read
 * -> parse -> emit -> write). S-000 scope only: this proves the core is correct; the full
 * CLI argv/exit/stream matrix (TFO-03/04/05, FPS-01/05) is S-001's `codegen-cli.test.ts`,
 * spawning the built artifact — this file drives the function directly instead.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSchema } from "../../bin/pbuilder-codegen.ts";
import { computeSchemaDigest } from "../../src/core/schema/schema-digest.ts";
import { GENERATED_HEADER } from "../../bin/emit-type.ts";

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
