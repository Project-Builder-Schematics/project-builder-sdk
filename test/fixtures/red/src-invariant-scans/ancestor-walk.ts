// [red-fixture] REQ-FTG-06.1 — a deliberately reintroduced ancestor-walk idiom (a loop
// calling `dirname` upward searching for a marker file). Never imported by real code; read
// as TEXT by fit-43's clause (b) red-proof only.

import { dirname } from "node:path";

export function regrownAncestorWalk(startDir: string): string {
  let dir = dirname(startDir);
  for (;;) {
    const parent = dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}
