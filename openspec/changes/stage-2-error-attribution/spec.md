# Specs: stage-2-error-attribution

**Spec version**: V2
**Status**: signed (owner, 2026-07-05 — V2; 2.4 proof-substitution ratified: origin discriminant frozen in type, v1 proof via outside-run, dialect-family proof deferred to Stage 5 / ADR-0012)
**Change**: `stage-2-error-attribution`
**Triage**: L

V2 — council feedback (qa-engineer + business-analyst + tech-writer, blind;
orchestrator-synthesised) applied: 3 blockers, 14 majors, 5 minors folded in.
All V1 REQ-IDs preserved; two NEW REQ-IDs added (REQ-AEC-06 message contract,
REQ-RT-03 doc discoverability). Four domains: 3 NEW full specs, 1 MODIFIED
delta against the existing `error-attribution-skeleton` main spec.

## Upstream Ingest / Sync

`spec_source: internal` — Step 5b (upstream ingest) and Step 10b (upstream
sync) do not apply. This spec is authored directly from the proposal.

## V1 → V2 Changes (summary)

- **Port discriminant (QA blocker)**: `{failedIndex, appliedCount}` alone
  could not derive 4 of 6 reason values. REQ-ERM-01 now defines
  `EmitRejection { code, failedIndex?, appliedCount }` with a closed
  port-internal `code` set (`collision|not-found|unrepresentable|cap`) set at
  each fake throw site; `toAuthoringError` maps code→reason; message-text
  classification is BANNED.
- **Renames (TW)**: `too-many-changes`→`changes-too-large` (cap is bytes);
  `target-not-found`→`path-not-found` (parallel to path-collision);
  origin `authoring-misuse`→`authoring-rejected` (parallel to write-rejected;
  survives Stage 5 dialect family without a MAJOR rename).
- **Message contract frozen (TW blocker)**: NEW REQ-AEC-06, 3-row template
  table (directive-level / batch-level / outside-run); batch-level never
  interpolates undefined; unknown's message states the SDK could not classify.
- **Helper named**: `classifyContent` + exported `ContentState` union
  (REQ-RT-01); doc-discoverability REQs added (REQ-AEC-04 additions,
  NEW REQ-RT-03).
- **Scenario hardening (QA)**: exact reason value asserted per family across
  all six verbs and both rename/copy/move failure forms; unrepresentable
  split into stringify-throw vs round-trip-drop scenarios; REQ-14.1 offender
  uses a different verb than index 0; REQ-14.3 pins public
  `appliedCount: 0`; REQ-15.1 precondition stated (B's path seeded);
  REQ-15.2 asserts the STAGING tree; FIT-11 gains non-enumerable-plant and
  cyclic-cause red-proof fixtures; ERM-03 gains `throw undefined` /
  `throw 42` scenarios.
- **Framing fixes (BA)**: REQ-10.2 reframed as a translation-layer verb-map
  assertion (remove never rejects — REQ-16 contradiction removed);
  origin-contrast scenario added (REQ-AEC-02.3); REQ-17 author now
  switches on reason and takes a distinct branch; appliedCount JSDoc must
  state diagnostic-not-persistence (REQ-AEC-03); template-render added to
  REQ-16's non-site ledger; proposal.md `REQ-RD-01`→`REQ-RT-01` reference
  fixed; unknown→write-rejected rationale recorded (note 7 below).

## Cross-Cutting Notes (read before reviewing individual domains)

1. **Owner-ratified inputs are binding, not re-litigated.** ★D2 (closed
   `reason` enum, zero engine strings, FIT-11 as safety net) and the
   `AuthoringError` `./commons` public-export decision are inputs to this
   spec, not open questions — this spec formalizes their exact membership
   and shape.
2. **REQ-10/11/12/13 live in `error-attribution-skeleton`, NOT
   `foundations-skeleton`.** Verified by reading both main specs: the
   flat `REQ-10..13` sequence the proposal references is entirely inside
   `openspec/specs/error-attribution-skeleton/spec.md`; `foundations-skeleton`
   uses a domain-prefixed scheme (`REQ-KIT-*`, `REQ-FIT-*`, ...) and has no
   `REQ-10..13` at all. The delta in this change targets
   `error-attribution-skeleton` exclusively.
3. **FIT-11 naming quirk (mirrors the FIT-09/FIT-10 precedent from Stage 1).**
   The whole-object leak scan's stable REQ-ID is `authoring-error-contract`
   REQ-AEC-05 — it does NOT extend `foundations-skeleton`'s own
   `REQ-FIT-*` sequence (which stops at `REQ-FIT-09`, per Stage 1's own
   cross-cutting note). The test file may still land as
   `test/fitness/fit-11-*.test.ts` (11th fitness file, continuing the flat
   file-count convention) — file name ≠ REQ-ID.
4. **Enum growth semver stance.** Adding a member to any of the three closed
   unions (`reason`, `origin`, `ContentState`) is a MAJOR change under this
   SDK's semver policy: authors are expected to write exhaustive
   `switch` statements over these fields, and TypeScript's exhaustiveness
   check breaks such a switch on a new member even though nothing breaks at
   runtime. FIT-04 MUST treat union growth on these fields as breaking, not
   additive. Record this verbatim in the D2 ADR at design.
5. **`context.ts` double-fault (E1/E2) machinery is OUT OF SCOPE.** No REQ in
   this spec requires touching it (`error-attribution-skeleton` REQ-16 names
   it as a non-site). The ONE `context.ts` change in scope is
   `currentContext()`'s misuse throw becoming an `AuthoringError`
   (`authoring-error-contract` REQ-AEC-02).
6. **Port type identifiers frozen.** `EmitRejection` / `EmitRejectionCode`
   are exact identifiers (REQ-ERM-01/02) so FIT-10's structural scan can
   target them; the `toAuthoringError` translation lives in
   `src/core/authoring-error.ts`, invoked from `Session.flush`.
7. **`unknown` → `origin: "write-rejected"` is deliberate.** An
   unclassifiable rejection necessarily arrived through the emit/write seam
   (the only place `toAuthoringError` runs), so the write side is the honest
   attribution — record in the 2.4 ADR (REQ-AEC-02 prose carries the same
   note).
8. **RED-posture taxonomy** (four-posture convention, per stage-1 precedent):
   (a) **must-fail-first** — REQ-14 (mid-batch attribution), REQ-15
   (multi-flush appliedCount), REQ-ERM-01/03 (structured rejection +
   degradation), REQ-AEC-06 (batch-level message — today's template prints
   "undefined failed at undefined") — all fail red against today's
   `instructions[0]` hardcode, metadata-less fake throws, and single message
   template; (b) **RED-PHASE GATE** — none identified as transient-only in
   this change; (c) **permanent-fixture** — REQ-AEC-05's planted-leak scans
   (enumerable cause, non-enumerable plant, cyclic cause — like
   FIT-01/FIT-08); (d) **characterization/RED-waived** — REQ-10.1, REQ-RT-01
   happy-path scenarios (proving already-intended shape, not a bug fix).

## Domain: authoring-error-contract (NEW)

> Full spec: `specs/authoring-error-contract/spec.md`. REQ-AEC-01 (closed
> `reason` enum, ★D2 — values `path-collision | path-not-found |
> unrepresentable-content | changes-too-large | outside-run | unknown`) ·
> REQ-AEC-02 (`origin: "write-rejected" | "authoring-rejected"`, 2.4, with
> contrast scenario) · REQ-AEC-03 (applied-boundary field + JSDoc
> diagnostic-not-persistence obligation) · REQ-AEC-04 (public promotion via
> `./commons`, `.d.ts`-frozen `| undefined` arms, ADR-0009 crossing, doc
> discoverability) · REQ-AEC-05 (FIT-11 whole-object leak scan;
> permanent-fixture red-proofs incl. non-enumerable plant + cyclic cause) ·
> REQ-AEC-06 (frozen 3-template message contract).

## Domain: emit-rejection-metadata (NEW)

> Full spec: `specs/emit-rejection-metadata/spec.md`. REQ-ERM-01
> (`EmitRejection { code, failedIndex?, appliedCount }` at the `emit` seam,
> closed port-internal code set, code→reason mapping, no message-text
> classification) · REQ-ERM-02 (port-internal, never crosses to `./commons`,
> FIT-10 extends to the `EmitRejection` identifier) · REQ-ERM-03 (non-Error /
> malformed rejection degrades to `reason: "unknown"` — string, metadata-less
> Error, `undefined`, and number scenarios).

## Domain: read-trichotomy-helper (NEW — DROPPABLE)

> Full spec: `specs/read-trichotomy-helper/spec.md`. REQ-RT-01
> (`classifyContent` + exported `ContentState = "absent" | "empty" |
> "present"`) · REQ-RT-02 (falsy-trio mutant killers: `"0"`, `"false"`,
> whitespace) · REQ-RT-03 (doc discoverability: @example + find() JSDoc
> pointer). Independent capability — droppable without touching the
> error-contract freeze (CQ-1 debt, Stage 2.3).

## Domain: error-attribution-skeleton (MODIFIED)

> Full delta: `specs/error-attribution-skeleton/spec.md`. UNCHANGED: REQ-11,
> REQ-13. ADDED: REQ-14 (every-verb + rejection-family coverage with exact
> reason values; offender verb differs from index 0), REQ-15
> (mid-chain/multi-flush applied-boundary; staging-tree discard proof),
> REQ-16 (five intentional non-sites incl. template-render), REQ-17 (full
> e2e proof incl. switch-on-reason branch). MODIFIED: REQ-10 (verb
> vocabulary `delete`→`remove`; REQ-10.2 is a translation-layer verb-map
> assertion), REQ-12 (attribution via structured rejection metadata instead
> of `instructions[0]`). Also carries the Pin Dispositions table for the
> three literal-message pins this change touches.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | REQ-AEC-04 (new `./commons` export), REQ-AEC-06 (frozen message contract) | Yes — triage's risk list flags `AuthoringError` as public/exported; tech-writer persona invoked for this reason |

No auth/payments/privacy/security/data-migration surface touched — matches
triage's "not triggered" list (Security, DBA, UX).

## Pending-Changes Disposition (informational — file edit is design/archive work, not this phase's Write)

The proposal's In Scope names "close or re-defer the 4 registered Stage-2.1
rows in `pending-changes.md`." This spec establishes the disposition each
row carries into design:

| Row (from `pending-changes.md`) | Disposition |
|---|---|
| Attribution granularity — carry offending directive/index, treat `authoring-error.ts` as in-scope | **CLOSED** by REQ-ERM-01 + REQ-14 + MODIFIED REQ-12 |
| Non-Error E1 + rejecting `discard()` silently drops E2; context-ts guard limitation | **RE-DEFERRED** — explicitly OUT of scope (`error-attribution-skeleton` REQ-16 non-site); carried forward, not closed |
| Round-trip/cap messages could name the offending directive/field (nice-to-have) | **CLOSED as will-not-implement** — REQ-14.3 structurally forbids fabricating a verb/path for batch-level rejections; the `reason` value + REQ-AEC-06 batch-level message are the improvement delivered instead |
| FIT-04 gate blind to intentional-surface slices regenerating baselines in the same change | **CARRIED FORWARD as a design-time obligation** — `authoring-error-contract` REQ-AEC-04 IS such a slice (new `./commons` export); design must argue additivity out-of-band per this pre-existing caveat |

## REQ-ID Stability (V2 vs V1)

- Preserved: ALL V1 IDs — REQ-AEC-01..05, REQ-ERM-01..03, REQ-RT-01..02,
  REQ-14..17, MODIFIED REQ-10/REQ-12 (16 of 16).
- Modified content (IDs stable): REQ-AEC-01 (renames + scenario split),
  REQ-AEC-02 (origin rename + contrast scenario + unknown rationale),
  REQ-AEC-03 (JSDoc obligation), REQ-AEC-04 (type freeze + docs),
  REQ-AEC-05 (two new red-proof fixtures), REQ-ERM-01 (code discriminant),
  REQ-ERM-02 (identifier freeze + attribution site), REQ-ERM-03 (two new
  scenarios), REQ-RT-01 (named + ContentState), REQ-14 (exact reasons +
  verb-differs hardening + public appliedCount pin), REQ-15 (precondition +
  staging assertion), REQ-16 (fifth non-site), REQ-17 (switch branch),
  REQ-10 (10.2 reframed).
- Newly added: REQ-AEC-06 (message contract), REQ-RT-03 (doc
  discoverability).
- Marked REMOVED: none.

## Resolved in V2 (was "Undecided" in V1)

The `origin` and `reason` value names are now COUNCIL-CONFIRMED, not
proposals: tech-writer confirmed `path-collision`, `unrepresentable-content`,
`outside-run`, `unknown`, the case labels `absent/empty/present`, and the
field names `verb/path/reason/origin/appliedCount` as-is, and ratified the
three renames (`changes-too-large`, `path-not-found`, `authoring-rejected`).
No open naming questions remain.

## Next Step

Surface to human for review (owner sign-off). If approved, orchestrator
marks status=signed and proceeds to `sdd-design`. If feedback given,
orchestrator re-invokes `sdd-spec` with feedback.
