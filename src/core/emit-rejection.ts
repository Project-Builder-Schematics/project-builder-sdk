// SEAM-04 port-internal rejection shape (ADR-0022). `EmitRejection` carries WHICH
// directive failed (`failedIndex`, directive-level only) and how many already applied,
// classified by a closed `code` — never by message text (REQ-ERM-01 ban on string
// parsing). It is a contributor-kit concern (ADR-0009): never re-exported from
// `src/core/index.ts`, never crosses to `./commons`. FIT-10 extends its structural port
// guard to this identifier; the only consumers are `authoring-error.ts` (translation)
// and the allow-listed `test/support/contract-fake.ts` (the one legitimate thrower).

export type EmitRejectionCode = "collision" | "not-found" | "unrepresentable" | "cap";

/**
 * Port-contract precondition (ADR-0022 — binding on every EngineClient implementation,
 * including the Stage 6 real engine): a DIRECTIVE-level rejection (`code: "collision" |
 * "not-found"`) MUST carry a `failedIndex` in range of the emitted batch's instructions.
 * A thrower that violates this yields `verb`/`path` `undefined` on the translated
 * `AuthoringError` BY CONTRACT — the translation does not guess an offender, and the
 * message template is selected BY REASON (REQ-AEC-06), never by verb/path presence, so
 * no fallback masks the violation.
 */
export class EmitRejection extends Error {
  readonly code: EmitRejectionCode;
  // Directive-level only — absent for a batch-level rejection (no directive to blame).
  readonly failedIndex?: number;
  // Directive-level: === failedIndex (every earlier directive in this batch applied).
  // Batch-level: 0 (rejected before the apply loop starts).
  readonly appliedCount: number;

  constructor(
    code: EmitRejectionCode,
    message: string,
    pos?: { failedIndex: number; appliedCount: number }
  ) {
    super(message);
    this.name = "EmitRejection";
    this.code = code;
    this.failedIndex = pos?.failedIndex;
    this.appliedCount = pos?.appliedCount ?? 0;
  }
}
