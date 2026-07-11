// Locates a factory package's adjacent schema.json (design §4.2, REQ-FPS-01.1, ADR-0031),
// and (S-004) its reserved-lifecycle-name siblings (REQ-RLN-01, ADR-0028). No configuration
// surface — the canonical shapes are fixed and discoverable from the package directory alone.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_LIFECYCLE_NAMES } from "./schema-model.ts";
import { isErrnoException } from "../fs-errors.ts";

export const SCHEMA_FILENAME = "schema.json";

export function schemaPathFor(packageDir: string): string {
  return join(packageDir, SCHEMA_FILENAME);
}

const RESERVED_EXTENSIONS = [".ts", ".js"];

// Strips a recognized extension (case-insensitively) so `pre-execute.ts`, `PRE-EXECUTE.TS`,
// and the dir-form entry `pre-execute` (no extension at all) all normalize to the same
// lowercase kebab token before comparison (ADR-0028: case-insensitive, strip-extension).
function normalizeEntry(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of RESERVED_EXTENSIONS) {
    if (lower.endsWith(ext)) return lower.slice(0, -ext.length);
  }
  return lower;
}

/**
 * Scans a factory package's OWN DIRECTORY ENTRIES (never resolved run-time inputs and
 * never `schema.json` field names — REQ-RLN-01) for a reserved-lifecycle-name sibling: a
 * `pre-execute`/`post-execute` file (`.ts`/`.js`, case-insensitive) or directory (dir-form,
 * e.g. `pre-execute/index.ts`). Returns the matched reserved name, or `undefined` for a
 * clean package. A non-existent package directory (ENOENT) is not a failure — returns
 * `undefined`, same as "no reserved siblings" (mirrors RBV-03's opt-out posture); any other
 * read error (EACCES/EPERM/EISDIR) FAILS CLOSED — thrown, never silently downgraded
 * (constraint 4, SEC-3).
 */
export function findReservedSibling(packageDir: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(packageDir);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return undefined;
    throw err;
  }

  for (const entry of entries) {
    const normalized = normalizeEntry(entry);
    const match = RESERVED_LIFECYCLE_NAMES.find((name) => name === normalized);
    if (match !== undefined) return match;
  }
  return undefined;
}
