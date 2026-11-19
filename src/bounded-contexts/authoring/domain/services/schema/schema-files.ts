// Where a factory package keeps its schema.

import { join } from "node:path";

export const SCHEMA_FILENAME = "schema.json";

export function schemaPathFor(packageDir: string): string {
  return join(packageDir, SCHEMA_FILENAME);
}
