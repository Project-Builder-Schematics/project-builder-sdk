# Specs: stage-3-dry-run-exposure

**Spec version**: V2
**Status**: signed — V2, owner, 2026-07-06 (accessor name `dryRun` ratified per TW ruling)
**Change**: `stage-3-dry-run-exposure`
**Triage**: M

V2 — blind council feedback (business-analyst + tech-writer, both
approve-with-notes; orchestrator-deduped: 3 majors, 4 minors) applied. All V1
REQ-IDs preserved; ONE new REQ-ID added (REQ-DRE-04, doc discoverability).
Two domains: 1 NEW full spec (`dry-run-plan-exposure`), 1 MODIFIED delta
against the existing signed `dry-run-plan-skeleton` main spec. V2 remains a
DRAFT — owner signs after this revision.

## Upstream Ingest / Sync

`spec_source: internal` — Step 5b (upstream ingest) and Step 10b (upstream sync) do
not apply. This spec is authored directly from the proposal.

## V1 → V2 Changes (summary)

- **Cross-domain integration scenario (BA major)**: NEW REQ-DRE-01.5 — a run
  calling `find("src/gone.ts").remove()` yields
  `[{ verb: "remove", path: "src/gone.ts" }]` through the PUBLIC accessor,
  never `delete`. Neither the renderer-isolated decoy (REQ-04.4) nor the
  identity-verb happy path (REQ-DRE-01.1) could catch a mis-wired
  integration alone.
- **Doc discoverability (TW major)**: NEW REQ-DRE-04 — the accessor's
  defining-site JSDoc MUST carry an in-run `@example` reading `verb`/`path`,
  the temporal contract (still-pending only; empties after `read()`/flush),
  and the shape-level guarantee (no content/byte preview). Mirrors stage-2's
  REQ-AEC-04.3/REQ-AEC-03.2 doc-obligation convention; 3 testable scenarios.
- **Name ruling (TW major)**: provisional accessor name changed
  `dryRunPlan` → **`dryRun`** (consistent with `DryRunEntry`; zero collision
  with the internal renderer, no import alias needed; query-vs-action nuance
  resolved by the mandated `@example`). Owner's fallback recorded: keep
  `dryRunPlan()` public, rename the internal renderer to
  `renderDryRunPlan(snapshot)`. Still PROVISIONAL — owner ratifies at signing;
  REQ-IDs are name-free either way.
- **Scenario hardening (BA minors)**: REQ-DRE-01.1 ellipses replaced with
  concrete paths asserted in THEN; REQ-DRE-01.3's pre-/post-flush directives
  now differ in verb AND path (`create src/a.ts` → flush → `modify src/b.ts`)
  with the surviving entry asserted exactly — a count-only pass returning the
  wrong entry is no longer possible.
- **Outside-run message omission (BA+TW converged minor)**: inherit-the-
  `currentContext()`-error decision kept; NEW coordination point recorded in
  REQ-DRE-01 — the inherited message enumerates seven verbs and omits this
  accessor; design MUST resolve deliberately (extend enumeration / generalise
  message / register coordination to stage-2), never ship the omission by
  default.
- **`DryRunVerb` union flag (TW minor)**: noted under REQ-DRE-02 — public
  `DryRunEntry.verb: string` hides the six-verb runtime guarantee; design
  decides whether to narrow via a LOCAL union in `src/dry-run/**` (never
  imported from stage-2's `authoring-error.ts`). Spec mandates the decision,
  not the narrowing.

## Domain: dry-run-plan-exposure (NEW)

> Full spec: `specs/dry-run-plan-exposure/spec.md`. REQ-DRE-01 (zero-argument
> `./commons` accessor reflecting the run's buffered directives ambiently —
> happy path with concrete paths, empty-buffer, post-flush temporal contract
> with distinguishable entries, outside-run propagation + message-omission
> coordination point, cross-domain e2e `remove` proof) · REQ-DRE-02 (public
> surface returns `DryRunEntry[]` only; wire `readonly Directive[]` never
> reaches the public `.d.ts`; `DryRunVerb` narrowing flagged for design)
> · REQ-DRE-03 (additive named export from `./commons`; no new subpath —
> `package.json#exports` stays `[".", "./commons", "./conformance"]`)
> · REQ-DRE-04 (defining-site JSDoc: in-run `@example`, temporal contract,
> shape-level guarantee). Accessor name PROVISIONAL: `dryRun` (TW ruling;
> owner fallback `dryRunPlan` + renderer rename recorded) — owner ratifies at
> signing.

## Domain: dry-run-plan-skeleton (MODIFIED)

> Full delta: `specs/dry-run-plan-skeleton/spec.md`. UNCHANGED: REQ-03
> (read-only pending buffer snapshot), REQ-05 (AST import prohibition).
> MODIFIED: REQ-04 (renderer MUST emit author vocabulary for every op — the
> `delete` op renders `verb: "remove"`, never the wire tag `"delete"`; frozen
> six-row wire→author map; decoy scenario REQ-04.4 pins the negative
> assertion on the delete op specifically). Retires the "design §4.4"
> wire-tag rationale in `plan.ts`'s header comment and `plan.test.ts`'s doc
> comment — no such exception exists in the main spec's own REQ-04 wording.
> V2 adds cross-references only (REQ-DRE-01.5 e2e proof; conditional
> `DryRunVerb` landing site) — no REQ content change from V1.

## Cross-Cutting Notes (read before reviewing individual domains)

1. **Owner-ratified inputs are binding, not re-litigated.** D3's exposure shape
   (fold into `./commons`, no new subpath) and its vocabulary half (render
   `remove`, never wire tag `delete` — stage-2 `AuthoringError` precedent) are
   inputs to this spec, not open questions.
2. **Vocabulary map is duplicated, not shared.** The wire→author translation
   lives ONLY inside `dryRunPlan` (`dry-run-plan-skeleton` domain, REQ-04). It
   does NOT import from stage-2's `src/core/authoring-error.ts` — that would
   couple two independently-scheduled builds. A single-source extraction is a
   registered followup for after both stages merge, not this change's scope.
   The same no-coupling rule applies to the conditional `DryRunVerb` union
   (design flag under REQ-DRE-02).
3. **Stage-3 is read-only on `Session`.** No REQ in either domain touches
   `Session.buffer`/`flush`/`commit`/`discard` — REQ-DRE-01 consumes the
   existing `pendingSnapshot()` unchanged. Any REQ that appeared to need
   `flush()`/attribution changes would be out-of-scope drift into stage-2's
   lane; none does.
4. **No-active-run behaviour is inherited, not invented.** REQ-DRE-01.4
   requires the accessor to propagate whatever `currentContext()` raises for
   any other verb outside a run — it does not pin the exact error shape (that
   may change independently under stage-2, in parallel). The verb-enumeration
   omission in that message is a recorded design-phase coordination point
   (REQ-DRE-01), not a spec-level pin — this keeps the two stages decoupled
   at the spec level while forbidding a silent ship of the omission.
5. **Plan stays shape-level.** Neither domain adds content/byte preview —
   `DryRunEntry` remains `{ verb, path }`. Enrichment beyond that shape is an
   invariant breach, not a scope decision for this change. REQ-DRE-04.3
   obligates stating this guarantee in the accessor's JSDoc.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | REQ-DRE-02, REQ-DRE-03 | Yes — `package.json#exports` is a registered sensitive area; additive-only, confirmed by REQ-DRE-03's exact-subpath scenario |

No auth/payments/privacy/security/data-migration surface touched — matches triage's
"not triggered" list (Security, DBA, UX).

## REQ-ID Stability (V2 vs V1)

- Preserved: REQ-DRE-01, REQ-DRE-02, REQ-DRE-03; delta domain REQ-03, REQ-04,
  REQ-05 (6 of 6 from V1).
- Modified content (IDs stable): REQ-DRE-01 (scenarios .1/.3 hardened;
  scenario .5 added; outside-run coordination point added; provisional name
  reference updated), REQ-DRE-02 (`DryRunVerb` design flag added).
- Newly added: REQ-DRE-04 (doc discoverability).
- Marked REMOVED: none.

## Open Items Carried to Sign-Off

- **Accessor name** (`dryRun`, provisional per TW ruling) — owner ratifies at
  signing; fallback alternative (`dryRunPlan` public + internal renderer
  rename) recorded in the domain spec's Accessor Naming section. REQ-IDs do
  not embed the name.
- **Spec-vs-design contradiction resolution** — the MODIFIED REQ-04 block
  retires the "design §4.4" wire-tag note; confirm no other artefact still
  cites it as authoritative before sign-off.
- **For design (not sign-off blockers)**: outside-run message-omission
  resolution (REQ-DRE-01 coordination point); `DryRunVerb` union narrowing
  decision (REQ-DRE-02 flag).

## Next Step

Surface V2 to the owner for sign-off. If approved, orchestrator marks
status=signed and proceeds to `sdd-design`. If feedback given, orchestrator
re-invokes `sdd-spec` with feedback.
