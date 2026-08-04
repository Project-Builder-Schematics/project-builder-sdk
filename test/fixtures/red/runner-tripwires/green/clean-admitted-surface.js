// Mandatory green sibling (design.md §6d): structurally similar to the deny-scan/ corpus —
// imports, calls, member paths — but every reference resolves through an admitted origin.
// Non-vacuity proof: the deny-scan corpus's own denial is not an artefact of "any file with
// imports and calls fails."
import { existsSync } from "node:fs";
import { join } from "node:path";

function helper(root, name) {
  return existsSync(join(root, name));
}

export const found = helper(process.cwd(), "package.json");
