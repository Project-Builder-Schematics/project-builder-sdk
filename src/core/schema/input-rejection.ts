// Maps a validation finding -> a thrown rejection (design §4.2). INTERIM (S-000..S-005,
// Option A / ADR-0029): a plain `Error` — the interim `AuthoringError{origin:
// "authoring-rejected"}` is UNCONSTRUCTIBLE against Stage-2's closed `reason` enum
// (ADR-0021) until the two new members land. S-006 is the ONLY slice that upgrades these
// throws to `AuthoringError{origin,reason}` (constraint 1/6) — this file stays the sole
// Stage-2-coupled module, and only from S-006 onward. Both this cluster's throw sites
// (run-boundary validation AND reserved-lifecycle-name rejection, S-004) live here so the
// eventual S-006 upgrade has one place to touch.
//
// Message literals are REQ-AEC-09's single source of truth (slices Load-bearing literals):
// `invalid input: {field} must be {expectedType}` (missing/wrong-type);
// `invalid input: {field} is a reserved or disallowed key` (excess/reserved-input-key/
// proto-key — branch→template mapping, all three collapse to one template);
// `reserved lifecycle name: {name} is reserved and cannot be declared by a factory module`
// (RLN-02.1, distinguishable-in-kind from the two templates above by literal text alone).

import type { ValidationFinding } from "./schema-validate.ts";

export function rejectionFor(finding: ValidationFinding): Error {
  switch (finding.kind) {
    case "missing":
    case "wrong-type":
      return new Error(`invalid input: ${finding.field} must be ${finding.expectedType}`);
    case "disallowed-key":
      return new Error(`invalid input: ${finding.field} is a reserved or disallowed key`);
  }
}

export function rejectionForReservedName(name: string): Error {
  return new Error(`reserved lifecycle name: ${name} is reserved and cannot be declared by a factory module`);
}
