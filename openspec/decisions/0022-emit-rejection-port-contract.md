# ADR-0022: `EmitRejection` port-internal rejection contract

- Status: Accepted
- Date: 2026-07-06
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0015 (`EngineClient` port); ADR-0018/0019 (Stage-1-frozen `emit()` envelope);
  ADR-0016 (message-parsing rejected — twice now).
- Origin: change `stage-2-error-attribution` (2026-07-06).

## Context

Attribution needs to know WHICH directive failed and how many applied, without changing
`emit(): Promise<void>` (the Stage-1-frozen envelope). String-parsing the fake's messages
would tie the SDK to fake wording and break under any real engine.

## Decision

The rejection object thrown across the `EngineClient.emit` seam is an `EmitRejection extends
Error` carrying `{ code, failedIndex?, appliedCount }` with a closed `EmitRejectionCode`
(`"collision" | "not-found" | "unrepresentable" | "cap"`); `code` is set locally at each throw
site. Directive-level rejections carry `failedIndex` + `appliedCount === failedIndex`;
batch-level rejections carry `appliedCount: 0` and NO `failedIndex`. `toAuthoringError`
(in `src/core/authoring-error.ts`) maps `code → reason`; message-text classification is BANNED.

`EmitRejection` is **port-internal to `src/core`**: FIT-10's structural guard extends to the
identifier; only `toAuthoringError` and the allow-listed `test/support/contract-fake.ts` touch
it. It is deliberately NOT re-exported from the `src/core/index.ts` kit barrel — it is not kit
surface for dialect authors; direct-module-import-only keeps FIT-10's guard meaningful. This is
a **recorded deviation** from the "new core primitive → kit barrel" convention
(`openspec/architecture.md` Conventions).

## Consequences

- (+) Origin-agnostic, no message parsing; satisfies mid-chain attribution + applied-boundary
  reporting; envelope contracts untouched.
- (−) Commits the unbuilt real engine (Stage 6, ROADMAP §6) to this rejection convention —
  **flagged as a Stage-6 revisit**: the real client must either enforce the directive-level
  `failedIndex`-in-range precondition or degrade to `reason: "unknown"` (see pending-changes
  ledger, Stage-6 gating row).
- (−) `ContractFake` carries metadata at every throw site (messages composed from the shared
  `test/support/rejection-messages.ts` fragments module, which FIT-11 also imports).

## Alternatives Considered

- **Port-signature change** (explore approach #1: `emit()` returns a result object) —
  rejected: unneeded weight, larger forward commitment.
- **Message-parsing** (explore approach #3) — rejected (ADR-0016 precedent): ties the SDK to
  fake wording, breaks for any real engine.

## Related

ADR-0015 (port), ADR-0018/0019 (envelope), ADR-0020 (the `code → reason` consumer).
