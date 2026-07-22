# Exploration: m2-copy / m2-copyin conformance fixtures (copy-copyin-conformance-fixtures)

**Triage**: L
**Persona lens**: none

## Cross-Change Lessons Consulted

- `openspec/lessons-learned.md` "From `conformance-corpus` (2026-07-19)": (a) a fixture's first
  live contact with `dist/` can surface a real shipped bug — budget time to investigate; (b)
  judgment-day's blind pass found 3 real defects verify missed on this same corpus — treat as a
  structural, not incidental, pattern for this L change too; (c) ADR numbering is OWNERSHIP-based,
  not archive-order — 0068-0069 are already reserved for `context-singleton-fix`; 0070-0072 are
  now used by `ts-addimport-collision`. Next free ADR number for this change: **0073**.
- `openspec/pending-changes.md` row 227 (copy) + row 268/269 (BRC-02/BRC-08, copyIn): confirms
  in writing that `copy`/`copyIn` are emit-only today — "green tests ≠ files copied" — the real
  engine drops both ops until its apply pass (PC-PROTO-01) lands. Directly grounds triage's
  landing-sequence risk.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Schematic author calls `copy()`/`copyIn()` → SDK buffers wire directive → engine (separate repo, pinned submodule) drives the real Go runner against this corpus → bytes land or rejection is declared | none in this repo (honesty boundary, REQ-CFX-11 — no runner-driven path here) | Modify (extends the corpus this flow already runs against; verb contracts unchanged) |

## Current State

Corpus has 5 fixtures (`corpus.json`), each `manifest.json{id, wireSpecVersion, class, factory,
input, lowering, cases[]}` + `factory.ts`. `m2-rename-move` (3 cases: positive, `collision-twin`
no-force reject, `dir-source-twin` unrepresentable) is the direct structural precedent for
`m2-copy` — same `class: wire-mutation`, same collision-capable-op shape. `copy(from,to,{force})`
(`src/commons/index.ts:356`) requires source to exist (`ContractFake` `#requireExists`,
`src/testing/contract-fake.ts:225-235`) and rejects collision without force — mirrors
rename/move. `copyIn(from,to,{force})` (`:286`) returns `void`, never a `WritableHandle`
(REQ-FEH-04.3) — no fake-tree write ever happens for it, collision-only check
(`contract-fake.ts:243-248`). `copyIn`'s missing-source/containment-escape rejections
(`source-not-found`/`source-outside-package`, `package-root-containment` REQ-PRC-04/07) are
**SDK-side, pre-emit, `AuthoringError.origin: "authoring-rejected"` → exit 1** (`exit-codes.ts:24`)
— structurally different from every existing corpus twin, which are all engine-side `EmitRejection`
→ exit 2. `fit-40` (`test/fitness/fit-40-conformance-corpus-integrity.test.ts`) hard-codes a
two-checkpoint cadence keyed on `corpus.fixtures.length` (`===1` / `===5`, REQ-CCR-05.1/.3); adding
2 fixtures makes both checks silently vacuous — a 3rd checkpoint (7 fixtures / N cases) plus new
`REQ-CFX-15`/`REQ-CFX-16` behavioral-contract `describe` blocks (mirroring `REQ-CFX-05..09`) are
needed for this fixture pair to get the same enforcement the other 5 have.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `conformance/` root layer | extend | 2 new fixture dirs + `corpus.json` entries | aligns (ADR-0063 layer already exists for exactly this) |
| `test/fitness/fit-40-*.test.ts` | modify | new checkpoint + REQ-CFX-15/16 blocks (test/, not src/) | aligns (fit-40 is explicitly designed as the corpus's structural self-check, extension is its normal growth path) |
| `conformance/README.md` | modify | representable-ops sentence update (in scope) | aligns |
| `src/**` (verb contracts) | read-only | confirm `copy`/`copyIn` signatures unchanged — out of scope | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `conformance/m2-copy/{manifest.json,factory.ts,seed/,expected/}` | Created | new fixture, 4(-5) cases |
| `conformance/m2-copyin/{manifest.json,factory.ts,seed/,expected/}` | Created | new fixture, case set TBD in spec |
| `conformance/corpus.json` | Modified | REQ-CCR-04 atomicity — same commit as each fixture's full set |
| `conformance/README.md` | Modified | representable-ops sentence |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modified | 3rd checkpoint + 2 new REQ-CFX behavioral blocks |
| `src/commons/index.ts`, `src/core/wire.ts`, `src/testing/contract-fake.ts` | Read-only | confirmed verb contracts / fake behavior, no src change |
| `openspec/decisions/` | Created (in design) | ADR(s) starting at 0073, if design ratifies new case shapes |

## Sensitive Areas Crosscheck

No sensitive-areas match — `conformance/` is not in `openspec/sensitive-areas.md` (confirmed at
triage, re-confirmed here by reading the registry).

## Approaches

### 1. Mirror `m2-rename-move` exactly; take triage's 4 named scenarios literally
**Description**: `m2-copy` = positive, `collisionProbe` (force=true → exit 0 overwrite, a NEW
outcome shape never demonstrated as a *positive* twin elsewhere in the corpus), `dirSourceProbe`
(unrepresentable, batch-level — matches `m2-rename-move`/`m2-delete` precedent exactly),
`copyThenModifyProbe` (one batch: `copy` then `modify` on the same destination — proves array-order
sequential apply, final content = modify's, `writtenPaths: []` per the wire-mutation-class
precedent). No plain no-force collision-rejects twin.
**Pros**: matches triage scope exactly; smallest case count; each case teaches something the
corpus hasn't shown yet (force-success, sequencing).
**Cons**: breaks the corpus's established twin symmetry (every other collision-capable op shows
BOTH directions); a reviewer/engine team member may read "no plain collision case for copy" as
an omission rather than a deliberate choice.
**Effort**: Medium. **Pattern fit**: matches `m2-rename-move` (ADR-0065 mechanism), 4 cases.

### 2. Same, plus a 5th plain `collision` (no-force) twin for symmetry
**Description**: adds `collisionProbe` (no force, rejects) alongside `force`-overwrite.
**Pros**: full behavioral symmetry with every prior collision-capable fixture; closes the
"why is copy special" question before it's asked.
**Cons**: exceeds triage's literal scope (4 → 5 cases); triage's own file/line estimates were
already tie-broken toward L, not XL — inflating case count without an explicit scope amendment
risks re-litigating that classification.

## Recommendation

**Approach 1**, with the asymmetry surfaced explicitly as an open product question rather than
silently resolved — the triage owner named exactly 4 scenarios deliberately (SDK PR-cadence
pressure against an engine milestone), and `m2-rename-move`'s no-force collision behavior is
already proven elsewhere in the corpus; re-proving it isn't m2-copy's job. If BA/PM want the 5th
case for symmetry, that's a scope amendment at spec, not a default.

## Risks

- Forward-dated declarations: `copy`/`copyIn` are rejected `unrepresentable` by the engine TODAY
  (triage risk, confirmed by `pending-changes.md` rows 227/268/269) — positive-outcome cases in
  this fixture pair declare a state that only becomes true after the engine's own
  `copy-wire-inclusion` change lands. No schema field exists to mark "pending" — DisallowUnknownFields
  forbids inventing one. Mitigation is purely sequencing (submodule pin ratchet, owner-accepted).
- `copyIn`'s missing-source/containment-escape rejections are `authoring-rejected` → exit 1 with
  (likely) an EMPTY transcript — a case shape the corpus schema supports (m1-vehicle's
  greeting-mismatch-twin proves exit-1/empty-transcript is representable) but has never modeled
  for a factory-side throw before spec nails the exact transcript/outcome triple.
- `fit-40`'s two-checkpoint cadence needs a 3rd checkpoint or it silently stops asserting total
  fixture/case counts once this pair lands — an easy silent regression if design skips it.
- `{= =}` token rendering in `copyIn`'s `to` (ADR-0043) is engine-render-only [SEAM] — an SDK-side
  fixture can declare the post-render `expected/` path but proves nothing about the render itself.

## Open Questions

- type: product
  question: "Does m2-copy need a plain no-force `collision` twin (5th case) for corpus-wide
  symmetry, or does the triage-named 4-scenario set (positive/collision-with-force/dir-source/
  copy-then-modify) stand as scoped?"
  why_it_matters: "Changes case count, effort, and whether a future reviewer reads the omission
  as a gap; cheapest to decide once at spec, not discovered at verify."
- type: product
  question: "What is m2-copyin's exact case list? Candidates: positive, collision(-with-force),
  missing-source (exit 1, authoring-rejected — novel shape), containment-escape (exit 1, novel
  shape), `{= =}` token in `to`. Triage deferred this to spec explicitly — it is still open."
  why_it_matters: "Two of the candidate cases (missing-source, containment-escape) have NO
  precedent transcript/outcome-triple in the corpus today; getting them wrong costs a redesign
  cycle, not just a fixture edit."
- type: technical
  question: "Should `fit-40`'s checkpoint gate (REQ-CCR-05.1/.3, hard-coded to 1 and 5 fixtures)
  be extended with a literal 3rd checkpoint (7 fixtures / N cases), or generalized to stop
  hard-coding fixture counts?"
  why_it_matters: "Left unaddressed, adding 2 fixtures makes both existing checkpoint assertions
  silently vacuous — the corpus loses its own count-drift guard with no RED signal."

## Ready for Proposal

**Status**: yes
**Reason**: Structural precedent (`m2-rename-move`, ADR-0065) is directly reusable for `m2-copy`;
the engine-reachability risk is already triage-flagged and now grounded in written cross-repo
debt records (pending-changes.md); the two genuine unknowns (m2-copy's 5th-case symmetry,
m2-copyin's case list) are exactly what triage deferred to spec and are captured as explicit
product open questions, not silent assumptions. `fit-40`'s checkpoint gap is real but mechanical
— a design-phase task, not a blocker to proposing.
**Recommended action**: Proceed to `sdd-propose`, carrying both product open questions forward to
the user before spec, and the fit-40 checkpoint/REQ-CFX-15/16 task into design's file-changes table.
