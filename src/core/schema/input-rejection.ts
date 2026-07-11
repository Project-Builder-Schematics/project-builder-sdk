// Maps a validation finding -> a thrown rejection (design §4.2). S-006 (post
// stage-2-error-attribution archive + coordinated amendment, REQ-AEC-07/08/09): both throw
// sites construct `AuthoringError{origin:"authoring-rejected", reason}` via
// authoring-error.ts's public API — the constructor's `message` field overrides the
// derived template (authoring-error.ts's `messageFor` has no default for these two
// SDK-side reasons; see its own comment). This file stays the sole Stage-2-coupled module
// (constraint 1/6) — both this cluster's throw sites (run-boundary validation AND
// reserved-lifecycle-name rejection, S-004) live here, one place for the S-006 upgrade.
//
// Message literals are REQ-AEC-09's single source of truth (slices Load-bearing literals),
// UNCHANGED by this upgrade — only the thrown value's shape changed, not its text:
// `invalid input: {field} must be {expectedType}` (missing/wrong-type);
// `invalid input: {field} is a reserved or disallowed key` (excess/reserved-input-key/
// proto-key — branch→template mapping, all three collapse to one template);
// `reserved lifecycle name: {name} is reserved and cannot be declared by a factory module`
// (RLN-02.1, distinguishable-in-kind from the two templates above by literal text alone).

import { AuthoringError, type AuthoringReason } from "../authoring-error.ts";
import type { ValidationFinding } from "./schema-validate.ts";

function rejection(reason: AuthoringReason, message: string): AuthoringError {
  return new AuthoringError({ verb: undefined, path: undefined, appliedCount: 0, reason, message });
}

export function rejectionFor(finding: ValidationFinding): AuthoringError {
  switch (finding.kind) {
    case "missing":
    case "wrong-type":
      return rejection("invalid-input", `invalid input: ${finding.field} must be ${finding.expectedType}`);
    case "disallowed-key":
      return rejection("invalid-input", `invalid input: ${finding.field} is a reserved or disallowed key`);
  }
}

export function rejectionForReservedName(name: string): AuthoringError {
  return rejection(
    "reserved-name",
    `reserved lifecycle name: ${name} is reserved and cannot be declared by a factory module`
  );
}
