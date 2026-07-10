// CLI: parse a factory's adjacent schema.json -> emit schema.generated.ts (design §4.1/
// §4.4, ADR-0027). S-000 scope: the core generate() function only (discover/read/parse/
// emit/write) — write-containment (TFO-05/SEC-4), usage/exit/stream discipline
// (TFO-03/04, FPS-01/05), and the built-artifact spawn tests all land in S-001.
//
// Lives OUTSIDE src/ (FIT-15: bin->core only, never core->bin) and imports the shared
// schema cluster.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSchema } from "../src/core/schema/schema-parse.ts";
import { computeSchemaDigest } from "../src/core/schema/schema-digest.ts";
import { schemaPathFor } from "../src/core/schema/schema-discovery.ts";
import { emitInputType } from "./emit-type.ts";

export const GENERATED_FILENAME = "schema.generated.ts";
export const SUCCESS_LINE = "pbuilder-codegen: wrote schema.generated.ts";

export interface GenerateResult {
  outputPath: string;
  digest: string;
}

/**
 * Reads `<packageDir>/schema.json`, parses it, and writes `<packageDir>/schema.generated.ts`
 * — the bin's fixed, non-configurable output location (REQ-TFO-05.1/FPS-01).
 */
export function generateSchema(packageDir: string): GenerateResult {
  const schemaPath = schemaPathFor(packageDir);
  const raw = readFileSync(schemaPath, "utf-8");
  const schema = parseSchema(raw);
  const digest = computeSchemaDigest(raw);
  const output = emitInputType(schema, digest);
  const outputPath = join(packageDir, GENERATED_FILENAME);
  writeFileSync(outputPath, output, "utf-8");
  return { outputPath, digest };
}

if (import.meta.main) {
  const packageDir = process.argv[2];
  if (packageDir === undefined) {
    console.error("pbuilder-codegen: usage: pbuilder-codegen <package-dir>");
    process.exit(1);
  }
  generateSchema(packageDir);
  console.log(SUCCESS_LINE);
}
