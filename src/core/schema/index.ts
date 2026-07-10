// Barrel for the shared schema cluster (design §4.1): parse/validate/discover/digest/
// reject. Consumed by both the bin (bin/pbuilder-codegen.ts, bin/emit-type.ts) and the
// runtime (context.ts) — the one seam that keeps compile-time and run-time in parity.

export type { Schema, SchemaProperty, SchemaKind } from "./schema-model.ts";
export { RESERVED_LIFECYCLE_NAMES } from "./schema-model.ts";
export { parseSchema, SchemaParseFailure } from "./schema-parse.ts";
export type { SchemaParseFailureInfo } from "./schema-parse.ts";
export { schemaPathFor, SCHEMA_FILENAME } from "./schema-discovery.ts";
export { computeSchemaDigest } from "./schema-digest.ts";
export { validateInput } from "./schema-validate.ts";
export type { ValidationFinding } from "./schema-validate.ts";
export { rejectionFor } from "./input-rejection.ts";
