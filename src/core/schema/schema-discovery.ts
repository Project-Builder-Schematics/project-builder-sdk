// Locates a factory package's adjacent schema.json (design §4.2, REQ-FPS-01.1, ADR-0031).
// No configuration surface — the canonical shape is fixed: schema.json sits next to
// factory.ts, discoverable from the package directory alone.

import { join } from "node:path";

export const SCHEMA_FILENAME = "schema.json";

export function schemaPathFor(packageDir: string): string {
  return join(packageDir, SCHEMA_FILENAME);
}
