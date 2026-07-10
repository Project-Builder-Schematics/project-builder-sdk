// Maps a validation finding -> a thrown rejection (design §4.2). INTERIM (S-000..S-005,
// Option A / ADR-0029): a plain `Error` — the interim `AuthoringError{origin:
// "authoring-rejected"}` is UNCONSTRUCTIBLE against Stage-2's closed `reason` enum
// (ADR-0021) until the two new members land. S-006 is the ONLY slice that upgrades this
// throw to `AuthoringError{origin,reason}` (constraint 1/6) — this file stays the sole
// Stage-2-coupled module, and only from S-006 onward.
//
// Message literal is REQ-AEC-09's single source of truth (slices Load-bearing literals):
// `invalid input: {field} must be {expectedType}`.

import type { ValidationFinding } from "./schema-validate.ts";

export function rejectionFor(finding: ValidationFinding): Error {
  switch (finding.kind) {
    case "missing":
      return new Error(`invalid input: ${finding.field} must be ${finding.expectedType}`);
  }
}
