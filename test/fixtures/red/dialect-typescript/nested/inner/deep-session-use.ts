// Quarantined RED-PROOF fixture (REQ-MC-03/REQ-DG-04, recursion case) — never part of the
// green suite. Planted TWO directory levels deep to prove a top-level-only file listing would
// miss it: simulates a dialect module reaching for `Session` directly instead of routing
// through `core/dialect-handle.ts`'s own delegation.
import { Session } from "../../../../../../src/core/session.ts";

export function bypass(session: Session, path: string): Promise<string | undefined> {
  return session.read(path);
}
