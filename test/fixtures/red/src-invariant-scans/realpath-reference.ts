// [red-fixture] REQ-FTG-06.3 — a deliberately reintroduced `realpathSync`/`realpath`
// reference (code AND comment forms), OUTSIDE any allowlisted symbol. Never imported by
// real code; read as TEXT by fit-43's clause (f) red-proof only.

import { realpathSync } from "node:fs";

// A stray comment mentioning realpath resolution too.
export function regrownRealpathResolve(p: string): string {
  return realpathSync(p);
}
