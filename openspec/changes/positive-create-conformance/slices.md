# Slices: Positive Create Conformance

**Triage**: M
**Spec version**: V1 (merged, signed)
**Total slices**: 3 (1 walking skeleton + 2 SPIDR)

**Landability**: build batches, not landing commits — lands on `main` as one squashed commit
(engine pins SHA). No slice boundary is main-visible.

**Global guard rails** (all slices): no `src/**` edits; no `wire.ts`/`docs/create-templates.md`
force-removal (registered by `sdd-archive` at close, design §4.8); no closure of
`pending-changes.md` row 500; no typed-options-feeder work; `conformance-validators.ts`,
`corpus.json`, and the delta spec are READ-ONLY throughout.

---

## S-000: Walking Skeleton — Author `create-composite`, the corpus's first positive wire-`create` case

**Scope**: walking-skeleton · **Dimension**: — · **Covers**: REQ-CFX-09.4, REQ-CFX-12.3,
REQ-CFX-13.6 (one case satisfies all three) · **Requires**: nothing

**Acceptance**: GIVEN the existing quarantine in `m2-create-composition/factory.ts` — WHEN a new
named export `createComposite` calls `create()` with ≥1 composite (array/object) option value and
`manifest.json` gains a `create-composite` case (`expected: "expected-composite"`, exit 0,
`emitRejectionCode: null`, `writtenPaths: ["create-composite.txt"]`,
`[ir.emit, ir.commit]`/`forbidDiscard:true`) — THEN fit-40's new `it("REQ-CFX-09.4 ...")` passes
byte-exact against `expected-composite/`.

**Red→Green**: add RED `it("REQ-CFX-09.4 ...")` first; then add manifest case + export +
`expected-composite/create-composite.txt` until GREEN. Reword DO-NOT-COPY clause (e) to point at
this export (existing `/move\/copy\/copyIn/` keyword still matches — no regex change).

**Tests after**: REQ-CFX-09.4 GREEN; REQ-CFX-09.5/REQ-CFX-02.2 not authored yet. Run
`bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` only — full suite not green
yet.

### Tasks
- [x] S-000.1 RED `it("REQ-CFX-09.4 ...")` in fit-40's REQ-CFX-09 block
- [x] S-000.2 Add `create-composite` case to `manifest.json`
- [x] S-000.3 Add `createComposite` export to `factory.ts`; reword clause (e)
- [x] S-000.4 Create `expected-composite/create-composite.txt`
- [x] S-000.5 fit-40 targeted GREEN; `tsc --noEmit`

---

## S-001: Rule — `wire-create-reject-twin` stays valid under `force: true` (ADR-0078)

**Scope**: edge-case · **Dimension**: R (force-triggered rejection) · **Covers**: REQ-CFX-09.5 ·
**Requires**: nothing (build after skeleton per skill rule, not content-coupled)

**Acceptance**: GIVEN `createRejectProbe`'s call omits `force` — WHEN `force: true` is added
(manifest entry UNCHANGED — outcome triple stays byte-identical `(2,"unrepresentable",null)` per
ADR-0078/ADR-0064-amendment, both already on disk from design — verify, do not rewrite) — THEN
fit-40's new `it("REQ-CFX-09.5 ...")` passes, asserting the probe's source contains `force: true`.

**Red→Green**: add RED `it("REQ-CFX-09.5 ...")` first; then add `force: true` to the call and
reword clause (d) to name the force-triggered cause (existing `/unrepresentable/` keyword still
holds — no regex change, code name unchanged).

**Tests after**: REQ-CFX-09.4 still GREEN; REQ-CFX-09.5 now GREEN; REQ-CFX-02.2 not authored yet.
Targeted fit-40 run only — full suite not green yet.

### Tasks
- [ ] S-001.1 RED `it("REQ-CFX-09.5 ...")` in fit-40's REQ-CFX-09 block
- [ ] S-001.2 Verify ADR-0078 + ADR-0064 amendment already match design — no rewrite
- [ ] S-001.3 Add `force: true` to `createRejectProbe`'s call; reword clause (d)
- [ ] S-001.4 fit-40 targeted GREEN; `tsc --noEmit`

---

## S-002: Rule — Sync quarantine-cardinality wording (README, clause (a), fit-40 regex)

**Scope**: edge-case · **Dimension**: R (cardinality wording, mirrors REQ-CFX-17's sync-site
discipline) · **Covers**: REQ-CFX-02.2, REQ-CFX-03 (clause a), REQ-CFX-02.1 (existing, unchanged)
· **Requires**: S-000 (clause (a)/README read most clearly once the new case proves "any number"
— sequencing convenience, not a hard dependency)

**Acceptance**: GIVEN the invariant relaxed from "exactly one create corpus-wide" to "any number,
quarantined to one sanctioned file" — WHEN README (~lines 30-32), clause (a), and
`CLAUSE_KEYWORDS["(a)"]` are read together — THEN all three describe the quarantine invariant in
this slice, and fit-40's stale "at most one" prose comment (~line 233-235) is updated to match.

**Red→Green**: add RED `it("REQ-CFX-02.2 ...")` (README check) first; updating
`CLAUSE_KEYWORDS["(a)"]` also turns the EXISTING `it("REQ-CFX-03.1 ...")` RED until clause (a)'s
text matches. Land README + clause (a) + regex + prose comment together to restore GREEN on both.

**Tests after**: REQ-CFX-09.4/09.5 GREEN (untouched); REQ-CFX-02.2 GREEN (new); REQ-CFX-03.1 GREEN
(regex matches reworded clause). **Full `bun test` + `tsc --noEmit` green — final slice.**

### Tasks
- [ ] S-002.1 RED `it("REQ-CFX-02.2 ...")` in fit-40's REQ-CFX-02/03 block
- [ ] S-002.2 Update `CLAUSE_KEYWORDS["(a)"]` regex (turns REQ-CFX-03.1 RED until clause (a) text
      matches)
- [ ] S-002.3 Reword README's cardinality sentence
- [ ] S-002.4 Reword `factory.ts` DO-NOT-COPY clause (a)
- [ ] S-002.5 Update stale "at most one" prose comment above REQ-CFX-02/03 describe block
- [ ] S-002.6 Full `bun test` + `tsc --noEmit` GREEN

---

## Build Order

1. S-000 (skeleton — implicit blocker for all)
2. S-001 — build after skeleton, not content-coupled to it
3. S-002 — sequenced last; full suite green only here

## Distribution

| Scope | Count | Slice IDs |
|---|---|---|
| walking-skeleton | 1 | S-000 |
| edge-case | 2 | S-001, S-002 |
| **Total** | **3** | |

## SPIDR Dimensions Used

| Dimension | Count |
|---|---|
| Rule | 2 (S-001, S-002) |

## Anti-Pattern Check

✅ Pass — no horizontal/layer-named slices; every slice covers ≥1 REQ-ID; no slice cross-cuts two
SPIDR dimensions; dependency depth ≤ 1 per slice.
