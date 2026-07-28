# Design: Positive Create Conformance

**Change**: `positive-create-conformance`
**Spec version**: V1 (merged, signed)
**Triage**: M
**Persona lens**: none

## 4.1 — Architecture Overview

This design adds exactly one new positive `create`-authoring case, quarantined inside the
existing sanctioned file (`conformance/m2-create-composition/factory.ts`), and relaxes the
cardinality wording of REQ-CFX-02 from "exactly one case corpus-wide" to "any number of cases,
but only inside one sanctioned file's quarantine." No `src/**` production code changes. No new
fixture id, no new file, no widening of `fit-40`'s structural checks — the file-level
`SANCTIONED_SITE` scan and `checkCreateQuarantine` (already generalized per named-export block,
per module — verified in `test/support/conformance-validators.ts:207`) both require zero code
change under this shape. The only genuinely new engineering decision — resolved below via
ADR-0078 — is whether `wire-create-reject-twin`'s factory call needs a `force: true` addition to
remain a valid rejection once the engine's `sdk-wire-create` change lands; reading
`docs/create-templates.md` confirms `template` is literal Go-template TEXT forwarded
byte-for-byte to the engine (never a keyword the engine specially recognizes), so the string
`"unrepresentable"` renders as ordinary, representable content once the new engine can render
`create` at all — the twin's current rejection depends entirely on the OLD engine's blanket
"reject every create" policy, not on anything intrinsic to its template text. That policy
disappears when `sdk-wire-create` lands, so the twin needs an explicit, engine-confirmed
rejection trigger to stay valid.

## 4.1b — Pattern Check

**Pattern**: existing — matches `conformance/m2-copy/manifest.json` and
`conformance/m2-copyin/manifest.json` (ADR-0065 per-case `factory` override mechanism, 6
established uses; this change is the 7th and 8th, since the twin's own call also changes). The
`expected-<suffix>` sibling-directory layout for a case whose declared bytes differ from the
fixture's canonical `expected/` also matches these two fixtures exactly
(`expected-force/`, `expected-modify/`, `expected-verbatim/`).

## 4.2 — File Changes

| Path | Action | Purpose |
|---|---|---|
| `conformance/m2-create-composition/manifest.json` | Modify | Add new case entry `create-composite` (factory override → named export `createComposite`); `wire-create-reject-twin`'s entry is UNCHANGED (outcome/transcript/factory pointer stay byte-identical — only its factory.ts call body changes) |
| `conformance/m2-create-composition/factory.ts` | Modify | Add named export `createComposite` (new positive case, composite options); add `force: true` to `createRejectProbe`'s `create()` call (ADR-0078); reword DO-NOT-COPY clauses (a)/(d)/(e) for the quarantine invariant + force-triggered rejection + new copy-pattern pointer |
| `conformance/m2-create-composition/expected-composite/` | Create | New sibling `expected-*` directory (m2-copy/m2-copyin precedent) — byte-exact declared output for `create-composite.txt` |
| `conformance/README.md` | Modify | Reword the "create appears exactly once" sentence (lines 30-32) to describe the quarantine invariant, not a cardinality ceiling |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modify | (1) Update `CLAUSE_KEYWORDS["(a)"]` regex to match the reworded clause (a); (2) add `it("REQ-CFX-09.4 ...")` asserting the new case's manifest contract; (3) add `it("REQ-CFX-09.5 ...")` asserting `createRejectProbe`'s source carries `force: true`; (4) add `it("REQ-CFX-02.2 ...")` asserting README no longer states "exactly once" and states the quarantine wording; (5) update the stale "at most one" prose comment above the REQ-CFX-02/03 describe block |
| `openspec/decisions/0078-reject-twin-force-disposition-under-sdk-wire-create.md` | Create | New ADR — resolves REQ-CFX-09.5 |
| `openspec/decisions/0064-wire-create-reject-twin-outcome-triple-frozen.md` | Modify | Append an "Amendment" section pointing to ADR-0078 (outcome triple stays byte-identical; cause reclassified) |
| `openspec/changes/positive-create-conformance/specs/conformance-fixtures/spec.md` | Read-only | Already drafted (signed); REQ-CFX-09.5's scenario wording is decision-agnostic and needs no re-edit — this design's resolution (`force: true`) fits it verbatim |
| `test/support/conformance-validators.ts` | Read-only | Confirmed `checkCreateQuarantine` needs no change (already sums `create()` calls across every case-referenced named-export block per module) |
| `conformance/corpus.json` | Read-only | No new fixture id under this approach |
| `openspec/pending-changes.md` | Read-only | Row 500 confirmed stays OPEN (not closed by this change); the NEW force-removal followup (`wire.ts` `force?: boolean` type + `docs/create-templates.md` §"Overwrite behavior") is registered by `sdd-archive` at close, not edited during design/apply — see Migration/Rollout below |

## 4.2b — Flow Changes

Flow Changes: not applicable — no author-facing runtime surface, no user-visible flow (confirmed
by explore; unchanged at design time).

## 4.2c — Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `conformance/` authoring corpus (fixture registry, baseline obs #652/#768 — additive) | extend | new case + named export inside the existing sanctioned quarantine file | aligns |
| `openspec/specs/conformance-fixtures/spec.md` (delta) | modify | REQ-CFX-02/02.1/03/09/12/13 wording — already drafted, signed | aligns |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` + `conformance-validators.ts` | extend (new `it` blocks) / modify (one regex constant) | admit + assert the new positive site; no structural predicate change | aligns |
| `src/**` (production authoring surface) | none | `create()`/`encodeOptions`/`forceEntry` already support everything both cases need (`force` was already part of `CreateArgs`) | aligns |

No `deviates` rows — confirms and closes explore's Architecture Touchpoints table unchanged.

## 4.3 — Data Model

New `manifest.json` case entry (shape per `test/support/conformance-fixture-loader.ts`'s `Case`
type — no schema change):

```jsonc
{
  "name": "create-composite",
  "seed": "seed",                     // reuse the fixture's existing shared seed dir (unused by this case, resolves per REQ-CSC-02.1)
  "expected": "expected-composite",   // new sibling dir, NOT the fixture's canonical expected/
  "factory": { "module": "factory.ts", "export": "createComposite" },
  "outcome": {
    "exitCode": 0,
    "emitRejectionCode": null,
    "failedIndex": null,
    "writtenPaths": ["create-composite.txt"]   // genuinely new path, no collision with any pinned path in REQ-CFX-12's table
  },
  "transcript": {
    "callbacks": ["ir.emit", "ir.commit"],
    "singleCommit": true,
    "forbidDiscard": true,
    "emitBeforeCommit": true
  }
}
```

New named export signature (`factory.ts`, pseudo-code — literal template text/options left to
`sdd-apply`, constrained to: ≥1 top-level array-or-plain-object option value, exercising
`encodeOptions`'s JSON-stringify branch per REQ-TOE-01):

```ts
export function createComposite(_input: Record<string, never>): void {
  create("create-composite.txt", { template: /* Go-template text */, options: /* composite value, e.g. { tags: [...] } */ });
}
```

`createRejectProbe`'s call gains one field (ADR-0078):

```ts
create("wire-create-reject-probe.txt", { template: "unrepresentable", options: {}, force: true });
```

`wire-create-reject-twin`'s manifest entry (outcome/transcript/factory pointer) is **unchanged** —
`CreateArgs.force` already exists in `src/core/directive-factory.ts` and `forceEntry` already
omits/includes the key correctly; no `src/**` change needed.

## 4.4 — Interface Contracts

No external interface changes. `create()`'s public signature (`src/commons/index.ts:187-204`)
already accepts `force`; nothing in `src/**` is modified.

## 4.5 — Architecture Decisions (ADRs)

### ADR-0078: `wire-create-reject-twin` Gains Explicit `force: true` To Stay Valid Under `sdk-wire-create`

See `openspec/decisions/0078-reject-twin-force-disposition-under-sdk-wire-create.md` (full text).
Amends ADR-0064: outcome triple stays byte-identical `(2, "unrepresentable", null)`; the CAUSE
reclassifies from "engine rejects every create unconditionally" (old) to "engine rejects any
force-bearing create explicitly" (new, engine ADR-0028 amendment, obs #1695).

## 4.6 — Test Derivation (outside-in)

| REQ-ID | Scenario (G/W/T ref) | Level | Test (name/path) | Flow ref |
|---|---|---|---|---|
| REQ-CFX-02.1 | Every `create()`-authoring case lies inside the sanctioned file's quarantined blocks | architectural | `test/fitness/fit-40-conformance-corpus-integrity.test.ts` — existing `checkCreateQuarantine` call (no code change; new case's export is a second quarantined block, already summed) | — |
| REQ-CFX-02.2 (NEW) | README + DO-NOT-COPY clause (a) + fit-40's clause-(a) regex describe the quarantine invariant in the same commit | architectural | fit-40: NEW `it("REQ-CFX-02.2 ...")` (README text check, no stale "exactly once") + updated `it("REQ-CFX-03.1 ...")` (`CLAUSE_KEYWORDS["(a)"]` regex, RED until factory.ts's clause (a) is reworded — strict-TDD red-first) | — |
| REQ-CFX-03 | DO-NOT-COPY 5-clause comment conveys the quarantine + force-rejection + copy-pointer | architectural | fit-40: existing `it("REQ-CFX-03.1 ...")`, `CLAUSE_KEYWORDS` updated for (a)/(d)/(e) | — |
| REQ-CFX-09.1 | Positive case declares one commit, two composed halves (unchanged from V4) | architectural | fit-40: existing `it("REQ-CFX-09.1 ...")`, no change | — |
| REQ-CFX-09.2/.3 | `wire-create-reject-twin`'s outcome triple pinned to ADR-0064-resolved values | architectural | fit-40: existing `it("REQ-CFX-09.2/.3 ...")`, no change (manifest fields unchanged) | — |
| REQ-CFX-09.4 (NEW) | New case authors a quarantined create with composite options, `export` ≠ null/`"createRejectProbe"`, exit 0, byte-exact output | architectural | fit-40: NEW `it("REQ-CFX-09.4 ...")` inside the existing REQ-CFX-09 describe block — RED until manifest + factory + `expected-composite/` land (strict-TDD red-first) | — |
| REQ-CFX-09.5 (NEW) | `wire-create-reject-twin` stays valid under the new engine semantics | architectural | fit-40: NEW `it("REQ-CFX-09.5 ...")` — asserts `createRejectProbe`'s source contains `force: true` — RED until ADR-0078's factory edit lands (strict-TDD red-first) | — |
| REQ-CFX-12.3 (NEW) | New case pins a genuinely new `writtenPaths` entry, no collision | architectural | fit-40: covered by the same NEW `it("REQ-CFX-09.4 ...")` assertion (`outcome.writtenPaths === ["create-composite.txt"]`) | — |
| REQ-CFX-13.6 (NEW) | New case's transcript is single-emit-single-commit | architectural | fit-40: covered by the same NEW `it("REQ-CFX-09.4 ...")` assertion (`transcript` equality) | — |

All 9 REQ-ID/scenario rows from the signed spec's Requirements section are covered. No REQ-ID is
uncovered.

## 4.7 — Fitness Functions

- `create()` is authored ONLY inside `m2-create-composition/factory.ts`'s quarantined
  named-export blocks: enforced by the EXISTING `checkCreateQuarantine`
  (`test/support/conformance-validators.ts:207`) — no new rule, no code change; the new case's
  export is simply a second quarantined block it already sums over.
- DO-NOT-COPY clause completeness (5 clauses, keyword-resistant to rewording): enforced by the
  existing `CLAUSE_KEYWORDS` check in `fit-40`, with clause (a) updated for the new invariant
  wording.

## 4.8 — Migration / Rollout

No migration needed — declarative fixture corpus, single-commit landability (Success Criterion).

**Archive-time note (not a design/apply action)**: the engine handoff (obs #1695, "Learned")
registers a non-blocking follow-up out of this change's scope — `wire.ts`'s `force?: boolean`
type on the create directive and `docs/create-templates.md` §"Overwrite behavior (force)"'s
promise of overwrite semantics both need correction once the engine's fail-closed `force`
behavior is confirmed live. `sdd-archive` MUST register this as a new `openspec/pending-changes.md`
row at close (not yet registered anywhere in the file, confirmed by direct read) — it is
explicitly OUT of scope here per the proposal.

## 4.9 — Performance Considerations

No significant performance impact expected — static fixture files, no runtime code path change.

## 4.10 — Architecture Impact

**Architecture impact**: additive
**Rationale**: Architecture Touchpoints (4.2c) — all rows `aligns`, action `extend`/`modify`
within the existing `conformance/` authoring layer (baseline obs #652, characterized as an
additive fixture-registry surface by the sibling `conformance-corpus` change's CLEAN audit,
obs #768). One ADR is written (ADR-0078, amending ADR-0064) but it is triggered by
"alternatives with explicit tradeoffs," not by a new abstraction/dependency/pattern-change/
data-ownership shift — consistent with `additive`, not `modifying` or `breaking`: nothing in the
baseline's layers, boundaries, or dependency directions changes; a new fixture-registry entry
(named export + manifest case) joins an EXISTING layer without altering it.

## 4.11 — Open Questions

None.
