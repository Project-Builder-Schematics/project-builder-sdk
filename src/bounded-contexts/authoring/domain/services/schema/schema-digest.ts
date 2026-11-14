// SHA-256 of a schema.json's raw bytes (design §4.2). The bin embeds this in the
// generated header's `// @schema-digest sha256:<...>` line; FIT-12 (S-002) recomputes it
// against the committed schema.json to detect drift without a text diff.

import { createHash } from "node:crypto";

export function computeSchemaDigest(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
