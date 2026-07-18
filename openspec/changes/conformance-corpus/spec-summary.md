# Spec Summary: conformance-corpus

**Spec version**: V3
**Status**: SIGNED — V3 re-signed by the owner 2026-07-18. (History: V2 was signed, then a blind
architect design-review verified V2 pinned values contradicting the actual runner code, justifying
an evidence-driven unfreeze; the owner re-signed V3 with design rev 2 + the handoff amendment as
context.)
**Triage**: L

Four New Capabilities, four full domain specs under `specs/`:

| Domain | File | REQs | Scenarios |
|---|---|---|---|
| `conformance-corpus` | `specs/conformance-corpus/spec.md` | REQ-CCR-01..08 (8) | 14 |
| `conformance-fixtures` | `specs/conformance-fixtures/spec.md` | REQ-CFX-01..14 (14) | 27 |
| `conformance-self-check` | `specs/conformance-self-check/spec.md` | REQ-CSC-01..06 (6) | 11 |
| `corpus-determinism` | `specs/corpus-determinism/spec.md` | REQ-CDT-01..07 (7) | 8 |
| **Total** | | **35** | **60** |

V1 totals were 29 REQs / 40 scenarios; V2 was 34 REQs / 54 scenarios. V3 adds ONE new REQ-ID
(CCR-08) and 6 new scenarios (CCR-05.3, CCR-08.1, CCR-08.2, CSC-02.3, CFX-13.3, CFX-13.4); zero
REQ-IDs were removed or renumbered — REQ-ID stability audit passed (all 34 V2 IDs present
unchanged in V3, plus CCR-08 newly assigned).

## Change Log — V2 → V3 (blind architect design-review corrections, evidence-verified)

A blind architect design-review found V2 pinned several values that CONTRADICT the actual runner
code. Each correction below was independently re-verified against the cited source before being
applied — none taken on the review's word alone.

| # | Severity | Correction | REQ(s) touched | Evidence anchor (verified) |
|---|---|---|---|---|
| 1 | Blocker | Six reject-twin transcript rows were WRONG: `defineFactory`'s catch unconditionally calls `ctx.session.discard()` on ANY `fn`/`flush`/`commit` rejection, and `Session.discard()` issues an `ir.discard` reverse callback via the client. Corrected `callbacks[]` to end in `ir.discard` (not halt at the rejected `ir.emit`) and `forbidDiscard: false` for all six twins (`m2-modify/not-found-twin`; `m2-delete/not-found-twin`+`dir-target-twin`; `m2-rename-move/collision-twin`+`dir-source-twin`; `m2-create-composition/wire-create-reject-twin`, refined to a dual-branch form since that row's exit path stays unresolved). Struck the false claims "the run halts before any subsequent callback" and "no fixture ... exercises an `ir.discard` call". Confirmed no factory among the six calls `.read()` before its rejected directive. | REQ-CFX-13 (rewritten), REQ-CFX-09 (transcript cross-ref + Open Technical Questions bullet updated) | `src/core/context.ts:339-361` (`defineFactory` catch); `src/core/session.ts:51-53` (`Session.discard`); `src/transport/stdio-engine-client.ts:283-284` (`ir.discard` issuance); `src/transport/wire-protocol.ts:6` (`REVERSE_CALLBACK_METHODS` includes `ir.discard`) |
| 2 | Blocker | `src/transport/runner.ts:309-310` unconditionally passes `packageDir` to `defineFactory` for every fixture; `resolvePackageRoot` (`src/core/context.ts:144-162`, ADR-0046) throws `AuthoringError{invalid-input}` (exit 1) if no `collection.json` ancestor exists — without a marker, EVERY fixture (except `greeting-mismatch-twin`, which fails at the pre-`defineFactory` greeting check) would fail before its factory ever runs. Added `conformance/collection.json` as a required presence-only, engine-loader-invisible marker; extended REQ-CSC-02's self-check to assert it resolves; added it to REQ-CCR-03's PR#1 scaffolding list. | REQ-CCR-08 (new), REQ-CSC-02 (extended), REQ-CCR-03 (wording extended) | `src/transport/runner.ts:309-310`; `src/core/context.ts:144-162` (`resolvePackageRoot`) + `:316-323` (unconditional call when `packageDir` given); `src/core/authoring-error.ts:107-122` (`invalid-input` → `authoring-rejected` origin); `src/transport/exit-codes.ts:22-25` (`authoring-rejected` → exit 1) |
| 3 | Correction | The wire version constant `WIRE_PROTOCOL_VERSION` lives in `src/transport/wire-protocol.ts` (a zero-import pure-constants module), NOT `src/core/wire.ts` — that file holds the distinct `Batch.protocolVersion` (IR field, same current value `1` but a separate constant with a separate meaning). Fixed the REQ's file reference; the invariant (all values equal, currently `1`) is unchanged. | REQ-CCR-07 | `src/transport/wire-protocol.ts:4` (`export const WIRE_PROTOCOL_VERSION = 1`, comment: "DISTINCT from Batch.protocolVersion (IR)"); `src/core/wire.ts:49` (`Batch.protocolVersion`) |
| 4 | Correction | fit-40's inventory check must be DERIVED FROM `corpus.json`'s own declared list so it is green at BOTH PR#1 (1 fixture) and PR#2 (5/12) — the absolute 5-fixture/12-case count is a POST-PR#2 gate only, and must not be evaluated (or fail) against the PR#1 state. Added a new scenario (CCR-05.3) making the PR#1 checkpoint explicit. | REQ-CCR-05 (rewritten with two-checkpoint cadence) | Process/wording correction — no code anchor; derived from REQ-CCR-03's existing two-PR delivery split |
| 5 | Minor | DO-NOT-COPY header's required content restructured as an explicit 5-clause list, folding in (d) the engine refuses the batch at emit (`unrepresentable`) and (e) what to copy instead (the positive default-export pattern). Clause (d)'s wording is deliberately hedged against REQ-CFX-09's still-open exit-path question (1 vs 2) rather than asserting "exit 2" as literal settled fact — asserting a specific exit code here would freeze an unresolved ADR question inside a code comment; flagged as a deliberate refinement of the requested wording. | REQ-CFX-03 (restructured) | Internal consistency check against REQ-CFX-09 (no code evidence needed — this is a self-consistency correction between two requested V3 items) |
| 6 | Minor | Every fixture run emits a "no schema.json found" warning to stderr: `validateAtRunBoundary` checks for `schema.json` ADJACENT to the factory's own directory (`schemaPathFor` = `join(packageDir, "schema.json")`); none of this corpus's fixtures place one there — the two `lowering: schematic` fixtures' `schema.json` lives at `schematic/schema.json`, a different path this check never consults. Added an informative (non-normative) note so the engine team does not misread this expected warning as a defect. | conformance-fixtures (informative note after REQ-CFX-11.2, not a new REQ) | `src/core/context.ts:206-217` (`validateAtRunBoundary`, `noSchemaWarning`); `src/core/schema/schema-discovery.ts:10-14` (`SCHEMA_FILENAME = "schema.json"`, `schemaPathFor`) |

**Refinement beyond the literal correction request**: item 1's fix for `wire-create-reject-twin`
(the 6th reject-twin row) could not be a flat `callbacks: [ir.emit, ir.discard]` copy-paste like
the other five, because that row's exit path is STILL UNRESOLVED (REQ-CFX-09). Verified that
`defineFactory`'s try block covers `fn` execution AND `flush`/`commit` identically, so
`ir.discard` fires under EITHER candidate resolution (authoring-time or emit-time) — only whether
`ir.emit` precedes it differs. Applied the dual-branch form (`[ir.discard]` vs `[ir.emit,
ir.discard]`) instead of a single fixed value, and added Scenario REQ-CFX-13.4 to cover it
explicitly.

**HALT check**: no code evidence found that contradicts any of the six corrections above.
`resolvePackageRoot` has no opt-out when `packageDir` is passed (line 316-323, unconditional), and
`defineFactory`'s discard-on-error path has no exception carved out for emit rejections
specifically — both corrections proceed as evidence-verified, not merely evidence-consistent.

## Change Log — V1 → V2 (blind-review findings applied)

Two independent blind reviews (BA, QA) ran against V1. Where both named the same defect, the
stricter wording was applied. All findings below are APPLIED — none deferred.

| Finding ID | Severity | Summary | REQ(s) touched |
|---|---|---|---|
| QA-B1 | Blocker | `wire-create-reject-twin`'s ENTIRE outcome triple (not just exit code) is contingent on the unresolved authoring-time-vs-emit-time path; needs precondition + fail-closed clause + escalation note | REQ-CFX-09 (rewritten), REQ-CFX-13 (conditional `callbacks[]` row) |
| QA-B2 ≡ BA-M1 | Blocker | Every case's manifest must carry a full `transcript` object (positive AND twins); self-check must validate its shape | REQ-CFX-13 (new), REQ-CSC-03 (extended) |
| BA-M2 | Major | `wireSpecVersion` must agree across `corpus.json`, every manifest, and `WIRE_PROTOCOL_VERSION` | REQ-CCR-07 (new) |
| BA-M3 ≡ QA-M6 | Major | Honesty boundary generalized to ALL runner-driven outcomes (not just schematic bytes); CFX-05..09 scenarios reframed as artefact assertions | REQ-CFX-11 (broadened), REQ-CFX-05..09 (scenarios reframed) |
| QA-M1 | Major | Collision-twin `failedIndex` pinned to `0` (was "present") | REQ-CFX-08 |
| QA-M2 | Major | Self-check must assert `factory.module` resolves to an existing file | REQ-CSC-02 (extended) |
| QA-M3 | Major | CDT-03..06 need a named fail-closed enforcement owner (self-check), not free-floating prose MUSTs | REQ-CSC-06 (extended) |
| QA-M4 + QA-M5 | Major | Byte-exactness oracle restated as a concrete machine-verifiable rule (no trailing `\n`); scope extended to `schematic/files/**` | REQ-CDT-06 (rewritten) |
| QA-M7 | Major | `writtenPaths` rule defined + pinned for all positive cases (no contradiction found vs. handoff — no HALT needed) | REQ-CFX-12 (new) |
| BA (minor) | Minor | CDT-04 wording bug ("MUST begin with a BOM" → "MUST NOT begin with a BOM") | REQ-CDT-04 |
| QA-m1 | Minor | Declare corpus 100% UTF-8 text so CR/BOM scans apply uniformly | REQ-CDT-07 (new) |
| QA-m2 | Minor | CCR-03.1/CCR-04.1 marked as one-time PR-gate/CI checks, not suite tests | REQ-CCR-03, REQ-CCR-04 (notes added) |
| QA-m3 | Minor | CFX-04.1's rejection-code enumeration scoped as corpus-scoped, not the full wire enum | REQ-CFX-04 (scenario note) |
| QA-m4 | Minor | Design-confirmation note: does the engine clean pre-staged schematic files on greeting-time exit 1? | conformance-fixtures Open Technical Questions |
| BA (minor) | Minor | CFX-01's I/O ban framed as SDK-imposed determinism guard, not handoff-derived | REQ-CFX-01 (provenance note) |
| BA (minor) | Minor | CFX-03 DO-NOT-COPY framed as in-repo hygiene, owner may demote | REQ-CFX-03 (provenance note) |
| BA (optional) | Minor | Pin handoff delivery-item 2 (build green, factory.ts outside build output) + `export default` convention | REQ-CFX-14 (new) |

## Owner Rulings Echoed (hard constraints, not re-litigated)

1. Delivery: ONE SDD change, full plan for all 5 fixtures, TWO PRs — PR#1 = `m1-vehicle` + ALL
   cross-cutting scaffolding (self-check, `.gitattributes`, README, `corpus.json` listing ONLY
   `m1-vehicle`); PR#2 = the four `m2-*` fixtures (REQ-CCR-03). Supersedes an earlier
   single-PR/"accepted-risk: M1 delay" note — that note is OBSOLETE.
2. `.gitattributes * eol=lf` repo-wide (REQ-CDT-01), closing pending-changes row 306, with a
   renormalization dry-check (REQ-CDT-02).
3. `m1-vehicle` = walking skeleton (reflected in slice ordering guidance, not a spec REQ).

## Open Technical Questions (routed to `sdd-design`, NOT resolved here)

- `wire-create-reject-twin` real exit path — authoring-time exit 1 vs emit-time exit 2. V2
  reframes this from a soft "correctness-grade flag" to a hard PRECONDITION on REQ-CFX-09's
  outcome triple (QA-B1) — design MUST resolve via ADR before implementation freezes the triple;
  a resolution to exit-1 makes the handoff's exit-2 claim unsatisfiable and requires cross-repo
  escalation.
- Self-check implementation shape — test file placement/naming (REQ-CSC series pin WHAT it
  checks; design owns HOW it's wired into the test layer).
- `tsconfig.json` treatment of `conformance/**/*.ts` — strict typecheck sweep vs `exclude`.
- `wireSpecVersion` pin mechanics vs `WIRE_PROTOCOL_VERSION` (REQ-CCR-07 pins WHAT must agree;
  design owns the mechanism).
- NEW (V2): does the engine clean pre-staged schematic files on a greeting-time exit-1 (e.g.
  `m1-vehicle`'s `greeting-mismatch-twin` pre-stages `out.txt` via schematic lowering before the
  greeting check runs, yet declares `expected: "empty"`)? Design must confirm whether "empty"
  describes the committed workspace only or the full disk state.

## Sensitive Areas

No sensitive areas covered by any domain — `security (IPC)` (the one low-confidence row
touching this area) was confirmed NOT touched during `sdd-explore`: zero production code changes
in `src/transport/**`, `src/core/wire.ts`, or `docs/engine-sdk-wire-spec.md`. All four domains
add/verify plain data files and a structural, non-spawning test.

## Drift Check Results

N/A — `spec_source = internal`. Step 9b (upstream drift check) skipped per the sdd-spec skill
contract (no upstream source to compare against).

## Upstream Sync

N/A — `spec_source = internal`. No upstream sync target.

## Word Budget Deviation (carried forward + worsened in V2, worsened again in V3)

`conformance-fixtures` was already over the ~800-word/domain guideline in V1 (~1432 words,
flagged explicitly rather than silently cut) and reached ~2899 words in V2. V3's evidence-driven
BLOCKER repair of REQ-CFX-13 (the six-row transcript correction, two new scenarios) and the
REQ-CFX-03 clause-list expansion push it further still. `conformance-corpus` also grows with the
new REQ-CCR-08 (collection.json marker, two scenarios) and REQ-CCR-05's rewritten two-checkpoint
cadence. This is a deliberate completeness-over-budget tradeoff, now compounded by a THIRD round
of correctness-grade evidence: V2's blockers came from an independent QA blind review; V3's
blockers came from a blind architect design-review that caught the signed spec pinning values
that CONTRADICT the actual runner code (`ir.discard` never fires; every fixture would exit 1
without a `collection.json` marker). Trimming either V3 correction would re-sign a spec asserting
facts the runner code disproves. Flagged for the owner's review at re-sign time, not silently
absorbed.
