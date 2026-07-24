# North Star — modify-e2e-extensible (Foresight, post-design)

**Checkpoint**: foresight | **Triage**: L | **Verdict**: aligned (with conscience questions)
**Held against**: the ORIGINAL `problem_statement`, not the spec.

## The outcome we are chasing (one sentence)

A maintainer can add e2e coverage for the next dialect operator as an XS/S increment — one
coverage-table row plus two byte files (plus, for a genuinely new op, one tiny factory function) —
never another L, with a fail-closed fitness guard (fit-42) that makes a missing or silently-dropped
cell impossible, proven concretely by React `.modify(fn)` landing as pure data.

## This is what we're going to do (outcome terms, not implementation)

Turn the one-off, hand-written "golden-committed-tree" e2e idiom into a *named, reusable seam* so that
proving a dialect operator reaches committed bytes stops being an ad-hoc L-sized effort and becomes a
data-table row. Close the one real coverage hole (React `.modify(fn)` has zero e2e today) *through* that
seam — so the closing of the hole doubles as the proof the seam works. Make the "future operator = XS/S"
promise a machine-enforced invariant, not a hope, via fit-42's cover-XOR-declared-gap partition.

## How it fits (architecture)

Purely additive, confined to `test/**`, zero `src/**` diff. The `test/e2e/` golden idiom is generalized
in place; the `test/support/` and `test/fitness/` clusters GAIN modules (seam + fit-42). The one baseline
deviation — fit-42 is a coverage-COMPLETENESS fitness, a novel KIND vs fit-41's parity — is recorded in
ADR-02. The root `conformance/` wire-directive layer is untouched by construction (ADR-03 layer boundary;
REQ-CFX-01 bars dialect-leaf imports there). Execution surface (factories run in CI) is guarded by a
fail-closed import allow-list + path containment (ADR-04), justified by the security (code-execution)
sensitive-area floor on `src/dialects/**`.

## Result → problem map

| Problem fragment | Deliverable that serves it | Traces? |
|---|---|---|
| "hard requirement: future operator = XS/S, never another L" | `dialect-e2e-coverage-seam` (Tier-A table + one iterating e2e) + `dialect-coverage-fitness` (fit-42 enforcement) | YES — mechanism + enforcement |
| "Modify … spans two dialects" — React had zero coverage | `react-dialect-modify-e2e` (React `.modify` as pure Tier-A row, zero new factory) | YES — closes the real hole AND is the extensibility proof |
| "modify is the next big one" (harden what exists) | `dialect-modify-e2e-robustness` (3 QA assertions on the existing TS modify e2e) | YES |
| "missing: rename, replaceContent, delete" | Explicitly OUT of scope; enumerated as honest declared gaps + tracked followups, enforced by fit-42 | Deferred honestly (per scope + user ruling 2) |

No deliverable exists that does not trace to the problem. No fragment of the problem is silently dropped —
the deferred operators are held as fail-closed declared gaps, not forgotten.

## The premise reframe — honesty check

The problem statement read "missing operator coverage: … modify". Explore discovered TS `.modify()` e2e
ALREADY EXISTS (S-002), surfaced it as a PRODUCT open question, and the user ruled (ruling 1): TS modify
counts as delivered; the new payload is seam + React mirror + fit-42 + TS QA fixes. This reframe is
reflected honestly and consistently across proposal Intent, spec, and design — it does NOT re-author
already-passing TS coverage as "new work", and it does NOT quietly widen. The DMR QA set was narrowed
5→3+2-followups by PM ruling, documented in the proposal (struck-through supersession) and the DMR spec
Followups table. No promise↔delivery drift at foresight.

## Journey simulation — the maintainer adding the NEXT operator

Concrete walk (e.g. covering `{typescript, addFunction}`, today a declared gap):
1. Add a small factory fn in `factory.ts` (`({dialect,seedPath}) => DIALECTS[dialect].find(seedPath).addFunction(...)`).
2. Add one `CoverageRow` to `ROWS` in `table.ts`.
3. Drop two byte files under `test/e2e/dialect-coverage/golden/typescript/`; run `scripts/regen-…`.
4. Remove the cell from `DECLARED_GAPS`; `bun test` — the iterating e2e auto-picks the row, fit-42 flips it
   from gap→covered.

The mechanical path IS XS/S and is *guided* by fit-42's declared-gap list (the maintainer sees exactly
what's missing) and *guarded* against the two forgetting-modes (a cell that is both row-and-gap fails the
XOR; a required cell downgraded to a gap fails). Friction points, both documented: the `seedGolden` vs
`seedPath` distinction (REQ-DCS-03 mandates the seam module document it) and the regen-script discipline
(REQ-DCS-04). The person who was hurting — the SDK maintainer facing an L per operator — is served: the
next operator is a row, not a project.

## Outputs-without-outcome check

NOT triggered. The React cell + the scripted diff oracle (REQ-RME-05) are a *concrete, verified* proof of
the extensibility outcome, not vanity infrastructure; fit-42 is durable enforcement, not ceremony. The seam
is exercised by real green cells (TS + React modify).

## Conscience questions carried into reckoning (human-only — worth/significance)

1. **Sufficiency of the extensibility proof.** The concrete, oracle-verified proof binds to the CHEAPEST
   case — React `.modify(fn)`, which needs ZERO new factory because `.modify` is dialect-agnostic core and
   the factory is already generic (REQ-RME-03 states this plainly). A *genuinely new* operator needs a
   (small) new factory function this change never lands end-to-end. Suspicion (not a verdict): the mechanism
   is sound and the new-factory delta is plausibly tiny — but the demonstration is the weakest case. Does the
   user accept this as proof that "future operator = XS/S"?

2. **Significance of an enablement-heavy L.** Triage records that architect + PM independently read this as
   M; it is L only via the security override. Net NEW *coverage* delivered is one React cell + 3 TS
   assertions — the bulk of the value is ENABLEMENT (the seam) + ENFORCEMENT (fit-42), with breadth
   (rename/replaceContent/delete and all structured ops) deferred as honest gaps per user ruling 2. This is
   a defensible "build the factory, not the widget" investment — but the user should consciously affirm the
   L's worth lives in enablement + enforcement, NOT in coverage breadth, since a naive reading of "missing
   operator coverage" might expect breadth.

Neither question is a design failure — the design reaches its stated outcome. They are judgments of worth
the human must own. Reckoning will hold the delivered result against this memo.
