// [red-fixture] REQ-FTG-06.2 — mirrors `single-instance-probe.ts`'s shape: the allowlisted
// `packageRootFor` symbol PLUS a SECOND, deliberately reintroduced ancestor-walk function in
// the SAME file. Proves the allowlist is SYMBOL-scoped, not file-scoped: allowlisting
// `packageRootFor` here must not shadow `secondOffendingWalk`. Never imported by real code;
// read as TEXT by fit-43's clause (b)/(REQ-FTG-06.2) red-proof only.

import { dirname } from "node:path";

export function packageRootFor(filePath: string): string {
  let dir = dirname(filePath);
  for (;;) {
    const parent = dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}

export function secondOffendingWalk(filePath: string): string {
  let dir = dirname(filePath);
  for (;;) {
    const parent = dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}
