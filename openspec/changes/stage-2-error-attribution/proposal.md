# Proposal: Stage 2 — error-to-author attribution (stage-2-error-attribution)

**Triage**: L · **Persona lens**: synthesis (architect / qa / pm / ba / tech-writer folded in)

## Intent

An author whose schematic is rejected today cannot tell WHICH verb failed or WHY: `Session.flush`
attributes every emit rejection to `instructions[0]` (a silently-shipping bug with zero red-proof),
`toAuthoringError` discards the engine's raw text with nothing structured in its place (`_raw` unused),
a failed `remove()` surfaces wire jargon `verb: "delete"` contradicting ADR-0013, mid-chain failures
never report what already applied, and `AuthoringError` is not importable from any public subpath — an
author cannot even `instanceof`-check it. Stage 1 landed three rejection families marked
RAW-UNTIL-STAGE-2.1; this stage freezes the error contract that Stages 3–6 build on.

**Owner-ratified 2026-07-05 (binding)**: ★D2 = option (b) — `AuthoringError.reason` is a closed
SDK-owned enum (collision | not-found | cap-exceeded | serialization | …; exact set fixed at spec), NO
engine string anywhere in the error object, with a whole-object leak scan (FIT-11) as safety net.
`AuthoringError` is promoted PUBLIC via `./commons` re-export (no new subpath), verb vocabulary
corrected to author verbs (`remove`, never `delete`); the design ADR records the ADR-0009 boundary
crossing and the semver-frozen field set.

## Scope

### In Scope
- **2.1** Full attribution coverage: every verb, actual failing directive (not `instructions[0]`), mid-chain applied-boundary, flush-vs-commit timing, structured rejection at the emit seam (`session.ts` + `authoring-error.ts`)
- **2.2** D2 structured cause: closed `reason` enum on `AuthoringError` + ADR
- **2.3** Read-trichotomy helper in commons (CQ-1 debt) — **droppable final slice**; must never hold the error-contract freeze hostage
- **2.4** Error-origin taxonomy (engine vs SDK) + ADR — discriminant now, SDK-origin dialect family reserved as a forward-compat slot (unimplemented until Stage 5)
- `AuthoringError` public promotion via `./commons` + author-verb vocabulary fix; FIT-11 whole-object leak scan
- Close or re-defer the 4 registered Stage-2.1 rows in `openspec/pending-changes.md`

### Out of Scope
- Stage 3 dry-run · Stage 4 typed options · Stage 5 conformance-kit property + dialect implementation (2.4 reserves the slot only) · Stage 6 real-engine cap + live publish · any real engine client
- Attribution of genuine read transport failures — the fake's `read` never rejects; declared an intentional non-site alongside commit-time (unreachable with the fake) and `remove` (never rejects). Read-not-found stays a VALUE (`undefined`, ADR-0016), never an error
- Re-deciding D2 or the public-export decision (owner-ratified — implementation only)

## Capabilities (contract with sdd-spec)

### New Capabilities
- `authoring-error-contract`: public frozen `AuthoringError` — closed `reason` enum (D2), origin discriminant with reserved SDK-origin slot (2.4), applied-boundary fields, author-verb vocabulary, `./commons` re-export, FIT-11 leak scan — 2 ADRs at design
- `emit-rejection-metadata`: structured rejection at the `EngineClient.emit` seam carrying failed-directive identity + applied count; PORT vocabulary in `src/core`, never crosses to `./commons` (FIT-10 interplay)
- `read-trichotomy-helper`: commons helper making the `read()` trichotomy (content / absent / empty) branchable without manual `=== undefined` discipline — CQ-1; droppable

### Modified Capabilities
- `error-attribution-skeleton`: attribution grows from single forced-rejection to full coverage — actual failing directive, every verb + rejection family, applied-boundary reporting, intentional non-sites declared; REQ-10 verb list corrected to author vocabulary; REQ-12.1's "first failing directive" wording superseded

## Approach

Decide the two contracts FIRST, then rewrite: both ★ ADRs (D2 reason enum + `./commons` crossing;
2.4 origin taxonomy) are formalized at design before any `session.ts`/`authoring-error.ts` code
changes, since every test in the change pins vocabulary those ADRs freeze. The rejection-identification
mechanism follows exploration's recommendation **#2 — error-subtype metadata, no port-signature
change**: `emit(): Promise<void>` stays as ratified; the rejection's error object carries
`{failedIndex, appliedCount}` computed from the loop the fake already runs. This upgrades
`contract-fake.ts` from explore's read-only to modify (its throw sites attach the metadata — a
consequence of adopting explore's own recommendation), while ADR-0018/0019 envelope contracts stay
untouched. D2's `reason` and 2.4's origin discriminant are designed on top of the SAME rejection
shape — one contract question, not two.

Two attribution contracts are kept DISTINCT and never forced into one: directive-level rejections
(D1 collision families) carry verb + primary path + applied-boundary; batch-level rejections
(serialization, cap, round-trip fidelity) carry a reason but no fabricated offending verb — cap has
no offending directive by construction. Applied-boundary semantics (cumulative-run vs per-batch
under multiple flushes) is surfaced as an explicit spec-level decision with both scenarios pinned.

Decisions for design to formalize: the two ★ ADRs; the exact `reason` enum membership + its growth
semantics (adding a member to an exported closed union affects exhaustive switches — semver stance
recorded); the `{failedIndex, appliedCount}` shape as a port-internal convention the real engine must
honor at Stage 6 (revisit noted in the ADR); whether `context.ts`'s misuse throw becomes the concrete
SDK-origin case proving 2.4's distinguishability test. Strict TDD: the multi-directive mid-chain
red-proof (fails on today's `instructions[0]` hardcode) is written before the fix.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/session.ts` | Modify | locate failing directive via rejection metadata, not `instructions[0]` |
| `src/core/authoring-error.ts` | Modify | `reason` enum, origin discriminant, applied-boundary, verb vocabulary fix; consumes structured rejection |
| `src/core/engine-client.ts` | Modify (docs/types) | document the structured rejection convention at the emit seam; signature unchanged |
| `src/core/context.ts` | Modify (maybe) | tag SDK-origin for `currentContext()` misuse per 2.4 taxonomy |
| `src/commons/index.ts` | Modify | re-export `AuthoringError` + public error types; add read-trichotomy helper |
| `test/support/contract-fake.ts` | Modify | throw sites attach `{failedIndex, appliedCount}` (upgraded from explore's read-only — see Approach) |
| `test/skeleton/error-attribution.test.ts` | Modify | every-verb + mid-chain + origin + applied-boundary coverage |
| `test/fake/batch-cap.test.ts` | Modify | literal message pin (`:67`, REQ-01.3) — explicit compat handling |
| `test/e2e/` | Create | first end-to-end rejection-path proof (author reads the error) |
| `test/fitness/` (FIT-11) | Create | whole-object leak scan across ALL rejection families, generalising fit-08/fit-10 |
| `openspec/decisions/` | Create | 2 ADRs: D2 reason enum + ADR-0009 crossing; 2.4 origin taxonomy |
| `openspec/pending-changes.md` | Modify | close/re-defer the 4 Stage-2.1 rows with recorded disposition |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `instructions[0]` fix unproven — no multi-directive red-proof exists today | High | Strict TDD: mid-chain red-proof written first, must fail on today's `session.ts` |
| Rejection-metadata shape commits the unbuilt real engine to a convention (ROADMAP §6) | Medium | Keep shape minimal (index + count), port-internal; ADR records Stage-6 revisit |
| Closed `reason` enum too coarse to debug real failures | Medium | Enum membership fixed at spec with owner sign-off; growth semantics in ADR; FIT-11 keeps the alternative (leaking text) off the table |
| Literal-message pins break (`batch-cap.test.ts:67`, REQ-11.x asserts) | High | Spec names each pin and its compat disposition explicitly |
| 2.4 provable only against a stand-in (dialect family unbuilt until Stage 5) | High | Reserve slot + prove with one concrete SDK-origin case (`currentContext()` misuse); ADR marks the family forward-compat |
| New public export = new semver surface (sensitive-areas `public-api` row) | Medium | Field set semver-frozen at design; FIT-04 confirms additive-only |
| Applied-boundary ambiguity: cumulative-run vs per-batch under multi-flush | Medium | Explicit spec-level decision; both scenarios pinned |
| 2.3 helper scope-creeps into the freeze path | Low | Own capability, droppable final slice by construction |

## Rollback Plan

Pre-publish window (live publish is Stage 6, no external consumer) — rollback is a clean branch revert,
validated stepwise:
1. Remove the `./commons` re-export of `AuthoringError`/error types and the trichotomy helper; regenerate the FIT-04 `.d.ts` baseline — it must return byte-identical to the pre-change commit (the same check that proved additivity forward).
2. Revert `session.ts`/`authoring-error.ts` to the `instructions[0]` + discarded-`_raw` version and `contract-fake.ts` to metadata-less throws — this restores the known Stage-1 baseline (with its documented attribution bug) rather than an undefined hybrid.
3. Delete FIT-11, the new e2e/skeleton attribution tests, the 2 ADRs, the `authoring-error-contract`/`emit-rejection-metadata`/`read-trichotomy-helper` delta specs; restore the literal-message pins; re-open the 4 pending-changes rows.
4. Validate: full suite green at the 243-test pre-change baseline; FIT-01..10 green; `.d.ts` baseline unchanged at the prior commit.

No step is irreversible; no data, migration, or published artifact exists in this window. Post-Stage-6
the public error contract becomes semver-locked — which is exactly why this stage freezes it now.

## Dependencies

- Owner ratifications 2026-07-05: D2 = closed reason enum (b); `AuthoringError` public via `./commons` with author-verb vocabulary — binding inputs, not open questions.
- Ratified ADRs relied on: 0013 (author vocabulary), 0016 (read-not-found is a value), 0017/0018/0019 (rejection families this stage attributes).
- No external dependency, service, or infrastructure change.

## Success Criteria

- [ ] Multi-directive batch failing at index k>0 → `AuthoringError` carries directive k's author verb + primary path, via a red-proof that fails on today's `session.ts`
- [ ] Every directive-level rejection family (create/rename/copy/move collision, modify-nonexistent) attributed per family; batch-level families (serialization, cap, fidelity) carry `reason` with NO fabricated verb — one test per family
- [ ] Applied-boundary reported per the ratified semantics, pinned for the multi-flush case
- [ ] `reason` ∈ the closed enum for every surfaced error; FIT-11 whole-object leak scan green across all families with a planted-leak red-proof; zero engine/fake vocabulary anywhere in the error object graph
- [ ] `AuthoringError` importable from `@pbuilder/sdk/commons`; `instanceof` works across the `defineFactory` boundary; failed `remove()` reports `verb: "remove"`; FIT-04 confirms additive-only
- [ ] Origin (engine vs SDK) distinguishable via the public discriminant without reading internals, proven against ≥1 concrete SDK-origin case; both ADRs merged
- [ ] Intentional non-sites (commit-time, `remove`, read-transport) declared in the spec as non-sites, not counted as coverage
- [ ] 2.3 helper covers the REQ-RT-01 trichotomy branchably OR is explicitly dropped with re-deferral; all 4 pending Stage-2.1 rows carry a recorded disposition
