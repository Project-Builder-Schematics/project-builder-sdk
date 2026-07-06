# Slices: Stage 2 — Error-to-Author Attribution

**Triage**: L · **Spec**: V2 signed · **Design**: rev 2 · **Total slices**: 5 (1 skeleton +
4 SPIDR, 1 droppable). **Revision**: 2 — plan-verify iteration 1, Judge B (executor
self-sufficiency): Executor Context appendix added; slice content untouched (rev 1: initial).
**Test**: `bun test <path>` · full `bun test` · types `bunx tsc --noEmit`.

## Executor Context (mandatory)

> Handoff-plumbing appendix, mandated by plan-verify gap routing. The ≤800-word artifact
> budget governs the slice blocks (unchanged); this section is exempt — deviation noted, not
> silent.

### Mandatory reading list (read BEFORE any slice)

REQ-IDs and constraint numbers in this file resolve against those artefacts; **this file is
the build ORDER, those are the build CONTENT** (the 49 scenario texts live in the specs):

1. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/spec.md`
2. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/specs/authoring-error-contract/spec.md`
3. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/specs/emit-rejection-metadata/spec.md`
4. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/specs/error-attribution-skeleton/spec.md`
5. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/specs/read-trichotomy-helper/spec.md`
6. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/openspec/changes/stage-2-error-attribution/design.md` — esp. §4.3 (data model), §4.4 (message contract), §4.7 (fitness functions), §4.8 (binding sequencing)
7. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/test/support/contract-fake.ts` — the 11 throw sites S-000 rewires

### Binding constraints (verbatim — violating any is a slicing/build defect)

1. The `./commons` export of `AuthoringError` (+ `@example`s for the type aliases) lands NO
   LATER than the slice introducing the author-facing instanceof/e2e tests; the walking
   skeleton crosses port→core→author surface.
2. Literal-message pins (`batch-cap.test.ts:67`, `error-attribution.test.ts` replacement,
   `context.test.ts:12`) land in the SAME slice as the message-format change — unsplittable.
3. 2.3 (`classifyContent` + `ContentState` + `find()` JSDoc pointer +
   `classify-content.test.ts` incl. REQ-RT-03 assertions) = ONE formally droppable FINAL
   slice; no other slice may reference it; its drop re-registers CQ-1 in the ledger.
4. `originFor` exhaustive switch + `test/types/authoring-reason.test.ts` never-arm pin lands
   with the type shape, not after.
5. `test/support/rejection-messages.ts` (shared fragments) must exist before or with FIT-11
   — the scan imports it.
6. `context.ts` double-fault machinery untouched (REQ-16 non-site).

Plus the suite-boundary rule: every slice leaves the suite GREEN and `tsc` clean at its
boundary (no broken intermediate states).

### RED-posture taxonomy (definitions)

- **[must-fail-first]** — write the test, watch it fail for the right reason, then implement.
- **[characterization]** — pins existing behavior; RED waived with justification.
- **[RED-phase-gate]** — suite-level gate proving the red phase ran.
- **[permanent-fixture]** — a planted red-proof that stays in the suite forever (e.g. the
  FIT-11 leak plants).

### Load-bearing literals (copied exactly from the signed spec — do not paraphrase)

- **`AuthoringReason` (six values)**: `"path-collision" | "path-not-found" |
  "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown"`
- **`AuthoringOrigin` (two values)**: `"write-rejected" | "authoring-rejected"`. Mapping:
  `outside-run` → `"authoring-rejected"`; all others INCLUDING `unknown` →
  `"write-rejected"` (deliberate — spec cross-cutting note 7).
- **`EmitRejectionCode`**: `"collision" | "not-found" | "unrepresentable" | "cap"`.
  Code→reason map (total): `collision`→`path-collision`, `not-found`→`path-not-found`,
  `unrepresentable`→`unrepresentable-content`, `cap`→`changes-too-large`;
  absent/unrecognized code → `unknown`. Message-text classification is BANNED.
- **Message templates (REQ-AEC-06 — selected BY REASON, three-way, never by verb/path
  presence)**:
  - Directive-level (`path-collision`, `path-not-found`): `"{verb} failed at {path}: {reason}"`
  - Batch-level (`unrepresentable-content`, `changes-too-large`, `unknown`):
    `"changes could not be applied: {reason}"` — MUST NOT interpolate `verb`/`path`;
    `unknown` additionally states the SDK could not classify the failure
  - `outside-run`: the existing prose, preserved — contains "can only be used while a
    schematic is running" (the third template, not an exception to the contract)
- **`AuthoringVerb` (six values)**: `"create" | "modify" | "remove" | "rename" | "move" |
  "copy"`. Verb-map: wire op `"delete"` → author verb `"remove"`, NEVER `"delete"`
  (REQ-10.2, translation-layer assertion).
- **The 5 declared non-sites (REQ-16)**: commit-time rejection (`ContractFake#commit()`
  never rejects); `remove` (wire `delete` — idempotent, never rejects, ADR-0017); read
  transport (not-found is a VALUE, `undefined`, ADR-0016); template-render rejection
  (engine-origin, unobservable until Stage 6); `context.ts` double-fault (E1/E2) machinery
  (pre-existing documented limitation — OUT of scope).
- **FIT-04 baseline regen mechanism**: `bun run build` (tsc -p tsconfig.build.json →
  `dist/**/*.d.ts`), then copy each dist file over its committed baseline:
  `dist/commons/index.d.ts` → `test/fitness/dts-baseline/commons.index.d.ts`,
  `dist/index.d.ts` → `test/fitness/dts-baseline/index.d.ts`. No regen script exists.

### Settled product decisions (DECIDED — not options)

- **S-004 is IN scope and built by default.** Droppable ONLY under schedule pressure; a drop
  re-registers CQ-1 in the ledger (owner foresight CQ-4, 2026-07-05).
- **The S1+S2 merge into S-000 is settled** (design §4.8 sanctioned it; constraint 1 holds
  either way).

---

## Walking Skeleton Decision (design's S1+S2 merged)

Design's S1 (`EmitRejection` metadata + FIT-10) alone delivers **zero** observable author
behavior — "old translation ignores it, suite stays green" (§4.8) — a horizontal/plumbing
anti-pattern unless folded into its consumer. Merged with S2 it is the one true skeleton:
port → core (translation, `originFor`, degradation) → author surface (`./commons`,
`instanceof`). Constraint 1 holds either way; merging is the cut where both halves clear the
demoable-value bar.

---

## S-000: Walking Skeleton — Structured Rejection Reaches the Public `AuthoringError`

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers** (24): REQ-ERM-01.1–.3, REQ-ERM-02.1, REQ-ERM-03.1–.4, REQ-AEC-01.1–.5,
REQ-AEC-02.2, REQ-AEC-03.1, REQ-AEC-04.1–.2, REQ-AEC-06.1–.3, REQ-10.1–.2, REQ-12.1–.2

**Acceptance**: GIVEN a `ContractFake` collision rejection WHEN caught via `AuthoringError`
from `@pbuilder/sdk/commons` THEN `instanceof` holds, fields are correct, message follows
template.

### Tasks
- [x] [must-fail-first] `emit-rejection.ts` + `rejection-messages.ts`; wire 11 fake throw
  sites; extend FIT-10; `test/fake/emit-rejection.test.ts`
- [x] [must-fail-first] Rewrite `authoring-error.ts` (shape, code→reason, exhaustive
  `originFor` + never-arm pin per constraint 4, 3-template messages, ERM-03 degradation,
  delete→remove map, `@example`s per FIT-06); `test/skeleton/authoring-error.test.ts`
- [x] `session.ts` flush — pass whole batch + `failedIndex`; SEAM-04 comment
- [x] `engine-client.ts` — docs-only rejection-convention note
- [x] `commons/index.ts` — two-step re-export + 5-verb JSDoc cross-refs
- [x] Replace `error-attribution.test.ts` (thin cross-boundary run) + rewrite
  `batch-cap.test.ts:67` pin (constraint 2)
- [x] Regen FIT-04 baselines (`commons.index`, `index`) — additive, keeps FIT-04 green
  immediately (stage-1 lesson)

---

## S-001: Origin Taxonomy — SDK Misuse vs Engine Rejection

**Scope**: happy-path · **Dimension**: P (Path — two distinct rejection origins) ·
**Requires**: S-000
**Covers** (2): REQ-AEC-02.1, REQ-AEC-02.3

**Acceptance**: GIVEN a call outside `defineFactory` WHEN it throws THEN
`AuthoringError{origin:"authoring-rejected",reason:"outside-run"}`, `:12` substring
preserved, AND one test contrasts it against an engine-origin case (origins differ).

### Tasks
- [x] [must-fail-first] `context.ts` — `currentContext()` throws `AuthoringError` (prose
  moves to the 3rd template); double-fault block untouched (constraint 6)
- [x] Add `instanceof`/`origin`/`reason` assertion beside the `:12` pin in `context.test.ts`
- [x] Add origin-contrast test in `error-attribution.test.ts` (shared file with S-002 —
  sequence, no logical coupling)

---

## S-002: Full Attribution Coverage — Every Verb, Multi-Flush, E2E

**Scope**: happy-path · **Dimension**: D (Data — verb/flush-count variants over the existing
mechanism; no new logical path) · **Requires**: S-001 (soft — shared file, sequencing only)
**Covers** (6): REQ-14.1–.3, REQ-15.1–.2, REQ-17.1

**Acceptance**: GIVEN a 3-directive batch failing at index 2 WHEN it rejects THEN
attribution names the true offender, `appliedCount:2`; GIVEN a multi-flush run WHEN a later
flush fails THEN `appliedCount` is per-batch and the run discards; GIVEN the e2e path THEN
the author's `switch(reason)` reaches the correct arm.

### Tasks
- [ ] [must-fail-first] Extend `error-attribution.test.ts` — REQ-14 every-verb +
  non-first-index scenarios; REQ-15 multi-flush `appliedCount` + staging-discard proof
- [ ] [must-fail-first] `test/e2e/error-attribution.e2e.test.ts` — REQ-17 full journey +
  switch-branch assertion

---

## S-003: No-Leak Guarantee + Doc Discoverability

**Scope**: edge-case · **Dimension**: R (Rule — leak-scan + doc obligations are invariants,
not new paths/data) · **Requires**: S-000
**Covers** (8): REQ-AEC-05.1–.4, REQ-AEC-03.2, REQ-AEC-04.3–.4, REQ-16.1

**Acceptance**: GIVEN any rejection family or a planted-leak fixture WHEN the scan runs THEN
zero engine-text matches for real families, red for every plant; GIVEN emitted JSDoc THEN it
documents `appliedCount`, `@example`s, and the 5 verbs' cross-refs; GIVEN review THEN the 5
non-sites are named.

### Tasks
- [x] [permanent-fixture] `test/fitness/fit-11-*.test.ts` (3 planted-leak red-proofs; imports
  `rejection-messages.ts`, constraint 5)
- [x] [characterization] Pin `AuthoringError` family as not-kit in `fit-08-*.test.ts`
- [x] [characterization] `doc-discoverability.test.ts` (AEC-03.2/-04.3/-04.4/REQ-16.1 — JSDoc
  already in S-000, RED taxonomy (d))

---

## S-004: Read Trichotomy Helper — `classifyContent` (DROPPABLE, final)

**Scope**: edge-case · **Dimension**: D (Data — absent/empty/present classification
variants) · **Requires**: nothing (independent of the error-contract freeze)
**Covers** (9): REQ-RT-01.1–.4, REQ-RT-02.1–.3, REQ-RT-03.1–.2

**Droppability (constraint 3)**: dropping re-registers CQ-1 in the ledger; no other slice
references `classifyContent`/`ContentState`.

**Acceptance**: GIVEN `read()` results `undefined`/`""`/any string/`"0"`/`"false"`/`"   "`
WHEN classified THEN `"absent"`/`"empty"`/`"present"` per trichotomy; falsy-trio all
`"present"`.

### Tasks
- [ ] [characterization] `classify-content.ts` (+ `ContentState`), `classify-content.test.ts`,
  `content-state.test.ts` (never-arm pin)
- [ ] `commons/index.ts` — droppable re-export + `find()` JSDoc pointer; regen FIT-04
  baselines again (new exports, additive)

---

## Build Order

| Order | Slice | Note |
|---|---|---|
| 1 | S-000 | implicit blocker for all |
| 2a | S-001 | requires S-000 |
| 2b | S-003 | requires S-000; disjoint files — parallelizable |
| 2b | S-004 | independent; droppable; self-contained dts regen |
| 3 | S-002 | soft-requires S-001 (shared file, sequence to avoid churn) |

## Coverage Check

24+2+6+8+9 = **49/49** scenarios mapped, no orphans/duplicates. REQ-11/REQ-13 (unchanged)
excluded per spec note 2.
