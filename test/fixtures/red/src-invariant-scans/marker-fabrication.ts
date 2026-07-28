// [red-fixture] REQ-FTG-06(d) — a deliberately reintroduced marker-fabricating fixture
// helper (a write call whose path argument ends in `collection.json`). Never imported by
// real code; read as TEXT by fit-43's clause (d) red-proof only.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function seedMarker(dir: string): void {
  writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
}
