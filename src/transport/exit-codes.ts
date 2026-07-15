// REQ-EXC-01/EXC-02: classifies a run's terminal error into the runner's exit-code
// taxonomy. Mutually exclusive by construction (spec's own framing): `AuthoringError.origin`
// is a closed derived enum and `TransportFault` is a distinct class, so no precedence rule
// is needed between them.
//
// REQ-EXC-02: classification reads ONLY the error's own identity (instanceof checks) — it
// NEVER consults `.cause`. `context.ts`'s defineFactory already attaches a double-fault (E2,
// e.g. a failed discard()) as E1's `.cause` and re-throws E1 unchanged; because this
// classifier never looks past the error it is handed, E2 can never override E1's class —
// preservation falls out of the classifier's own narrowness, not a special case.

import { AuthoringError } from "../core/authoring-error.ts";
import { TransportFault, IntentRejectedError } from "./stdio-engine-client.ts";

export type ExitCode = 0 | 1 | 2 | 3 | 4;

// REQ-EXC-01 table: 1 validation-failure, 2 emit-rejection, 3 transport-fault,
// 4 crash (the fallback for anything unclassified, including a non-Error thrown value —
// never throws while classifying). IntentRejectedError is code 2 by the table's own text:
// "the host refused a write or an advisory commit/discard intent" — the host-refusal
// family, distinct from a wire-level fault (3) and from an unclassified crash (4).
export function classifyExitCode(err: unknown): 1 | 2 | 3 | 4 {
  if (err instanceof AuthoringError) {
    return err.origin === "authoring-rejected" ? 1 : 2;
  }
  if (err instanceof IntentRejectedError) {
    return 2;
  }
  if (err instanceof TransportFault) {
    return 3;
  }
  // EXC-01 code-1 / BRB-01.2: a bridge contract version mismatch is a validation failure.
  // NAME-based (not instanceof): importing bootstrap-bridge.ts here would close a cycle
  // (bootstrap-bridge → runner → exit-codes), and the class already pins its own `name`.
  if (err instanceof Error && err.name === "BridgeVersionMismatchError") {
    return 1;
  }
  return 4;
}
