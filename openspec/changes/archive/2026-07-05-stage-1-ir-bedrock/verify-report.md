# Verification Report

**Change**: stage-1-ir-bedrock
**Mode**: final (Strict TDD)
**Spec version**: V2 (signed, owner, 2026-07-04)
**Triage**: L · **Architecture impact**: modifying
**Branch**: feat/stage-1-ir-bedrock · **Baseline**: main (4a902ec) · **Head**: 5abfc10
**Verified**: 2026-07-05

---

## Verdict: pass-with-followups

All 19 REQ-IDs COMPLIANT with meaningful, mutant-resistant assertions backed by real passing
tests. Full suite green (237/237), typecheck clean, Step 11b code audit clean (zero gating
findings), architecture conformant to baseline. Three SUGGESTION-tier followups (doc-status
hygiene + a test-helper dedup) do not block archive.

**adversarial_review: required** — triage is L (per skill Step 11b Stage B: `required` when
triage = L OR a sensitive area is touched). No sensitive area is touched; the L classification
alone mandates the blind judgment-day pass before archive.

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 7 (S-1.3, S-1.4, S-1.7, S-1.1, S-1.5/1.6, S-1.8, S-1.9) |
| Slices complete | 7 |
| Tasks total | 27 (all `[x]`) |
| Tasks complete | 27 |

All slice tasks ticked in `slices.md`; no incomplete cleanup tasks.

## Build & Tests Execution (run by verifier)

- **Full suite**: `bun test` → **237 pass / 0 fail / 0 skipped**, 377 expect() calls, 42 files, 1.77s
- **Typecheck**: `bunx tsc --noEmit` → exit 0 (clean)
- **FIT-04 gate**: passes with unconditional `bun run build` before diff (W7) — no breaking `.d.ts`
  removals; `move` `{force?}` surface confirmed additive (present in regenerated baselines).

## Strict TDD (final audit)

**Verdict**: pass

- **TDD Cycle Adherence** — Method: file-pairing + apply-progress TDD-evidence tables + commit
  prefixes (`test:`/`feat:`). Every apply-progress artifact (s11, s14, s1516, s17, s18, s19, main)
  carries a RED→GREEN evidence table with real failure strings (e.g. batch-cap:
  `"Expected promise that rejects, Received promise that resolved"`). s14 documents the
  RED-posture nuance correctly (REQ-01.1 permissive-path passes immediately; REQ-01.2/.3 fail for
  the right reason = genuine RED). No anti-TDD (impl-before-test) pattern found.
- **Assertion Quality** — All change test files scanned. No banned patterns (no bare
  `.toBeDefined()`/`.toBeTruthy()` as sole assertion, no `objectContaining` as whole assertion, no
  `.not.toThrow()`-only, no auto-recorded snapshots). Assertions specify concrete expected values
  (content strings, exact directive shapes, byte-length invariants, spy counts).
- **Triangulation** — Conditional/iterative logic triangulated: cap boundary (exactly-at-cap +
  over-cap + SDK-no-prevalidate), fail-closed move (m1 reject / m2 op-force / m3 envelope-force /
  m4 self-move), round-trip families (silent-drop function/undefined/Symbol + throw BigInt/circular),
  double-fault (reject+cause / contrast-no-cause). In-loop iter-1's lone triangulation gap was fixed
  before iter-2. No open gaps.
- **Mutation Testing** — Not configured in sdd-init (no stryker/equivalent). Skipped cleanly.
  Mutant-killer coverage is instead achieved by design: REQ-01.2 asserts the fixture property
  `rawContentBytes < cap < serializedBytes` (kills the raw-content-measurer mutant), multi-byte
  PREFIX distinguishes the UTF-16 mutant, FAKE-07.3 kills the seed-only existence mutant, KIT-03.2
  kills the free-function-only-threading mutant.
- **REQ-ID Coverage** — 19/19 REQs have ≥1 referencing test (matrix below). 0 uncovered.

## Adversarial Quality Gate (Step 11b)

**Code audit (pre-pr mode)**: **Clean — 0 gating findings** (0 Bug / 0 MAJOR / 0 Architecture /
0 Rollout). Groups run against the full `main...HEAD` diff + signed spec V2 + design rev 3 +
architecture baseline:

- G1 (Spec/Req alignment): 19/19 REQs trace to signed clauses and to referencing tests; each
  scenario has implementing code + asserting test. `spec_source: internal` → no upstream-drift axis.
- G2 (Architecture): no layer violation (production edits confined to `src/core` + `src/commons`,
  established commons→core direction); no ADR contradiction — the change IMPLEMENTS ADR-0017/0018/0019
  (cap lives at the fake's `emit`, `Session.flush` carries no size branch — ADR-0018 honored); SSOT
  honored (`BATCH_CAP_BYTES` single constant, fixtures parametrize on it); no sensitive area.
- G3 (Code quality): zero `as any`/`@ts-ignore`/`eslint-disable`/`TODO`/`FIXME` in production
  `src/`. Test-only casts (`unsafeOptions`, spy `mock.calls` cast, guarded `deepEqual` narrowing)
  are intentional, documented, and typeof/null-guarded. `RAW-UNTIL-STAGE-2.1` markers (5) are
  spec-sanctioned stage-boundary forward-pointers (design §4.4), not deferred-work TODOs.
- G4 (Scope): production diff = exactly the 5 files in design's File-Changes table
  (`wire.ts`, `directive-factory.ts`, `base-handle.ts`, `context.ts`, `commons/index.ts`). No
  scope creep, no migration.

**Live-app pass**: N/A — no UI files (library/SDK; no run target for behavioural UI driving).

**Adversarial review (judgment-day)**: required — triage L. Orchestrator runs it blind after this
pass, before archive.

## Spec Compliance Matrix (19 REQs)

| Requirement | Scenario(s) | Test | Result |
|---|---|---|---|
| REQ-GIR-01 | move ±force exact-key, six ops | `test/golden-ir/golden-ir.test.ts` (+`fixtures.ts` `GOLDEN_MOVE_FORCE`) | ✅ COMPLIANT |
| REQ-GIR-02 | rename→move, create→modify chained batch vs hand-written fixture (emit spy) | `test/golden-ir/chained-batch.test.ts` | ✅ COMPLIANT |
| REQ-GIR-03 | twice-run byte-identical + committed golden string, key order | `test/golden-ir/determinism.test.ts` | ✅ COMPLIANT |
| REQ-FAKE-04 | m1 reject / m2 op-force / m3 envelope-force / m4 self-move identity | `test/fake/move-fail-closed.test.ts` | ✅ COMPLIANT |
| REQ-FAKE-07 | .1 reject-untouched / .2 seeded-ok / .3 intra-batch create→modify staging | `test/fake/modify-existence.test.ts` | ✅ COMPLIANT |
| REQ-FIT-09 | planted-bypass flagged / contract-fake allow-listed / Directive-only clean / EventEmitter false-positive killed / production scan clean | `test/fitness/fit-10-engine-client-port-guard.test.ts` | ✅ COMPLIANT |
| REQ-KIT-03 | .1 free-fn thread / .2 BOTH handle forms / .3 omit force | `test/golden-ir/chained-batch.test.ts` + `test/golden-ir/golden-ir.test.ts` | ✅ COMPLIANT |
| REQ-10 | .1 cause+E1 / .2 RED-PHASE GATE (historical post-fix) / .3 contrast no-cause | `test/skeleton/double-fault.test.ts` | ✅ COMPLIANT |
| batch-cap REQ-01 | .1 at-cap passes / .2 over-cap rejects + raw<cap<serialized property / .3 SDK no-prevalidate | `test/fake/batch-cap.test.ts` (+`batch-cap-fixtures.ts`) | ✅ COMPLIANT |
| batch-cap REQ-02 | .1 `string` type pin (`expectTypeOf` + FIT-04 baseline) | `test/types/wire-content-string.test.ts` | ✅ COMPLIANT |
| batch-cap REQ-03 | .1 empty-batch: emit spy 0, commit spy 1 | `test/skeleton/write-only-factory.test.ts` | ✅ COMPLIANT |
| boundary REQ-01 | .1 clean round-trip applies (false-rejection guard) | `test/fake/boundary-pass-through.test.ts` | ✅ COMPLIANT |
| boundary REQ-02 | .1 function / .2 undefined+Symbol / .3 BigInt+circular reject | `test/fake/boundary-pass-through.test.ts` | ✅ COMPLIANT |
| boundary REQ-03 | .1 odd path verbatim on emitted directive | `test/fake/boundary-pass-through.test.ts` | ✅ COMPLIANT (see spec-drift note) |
| boundary REQ-04 | .1 [create X, delete X]→absent / .2 [delete X, create X]→present | `test/fake/boundary-pass-through.test.ts` | ✅ COMPLIANT |
| pyramid REQ-01 | four-layer table → real populated dirs | `test/pyramid/pyramid-codification.test.ts` | ✅ COMPLIANT |
| pyramid REQ-02 | decision table covers 4 change kinds | `test/pyramid/pyramid-codification.test.ts` | ✅ COMPLIANT |
| pyramid REQ-03 | CI covers every mapped dir (+ red-proof) | `test/pyramid/pyramid-codification.test.ts` | ✅ COMPLIANT |
| pyramid REQ-04 | .1 e2e factory→defineFactory→fake→golden committed tree | `test/e2e/author-to-tree.e2e.test.ts` | ✅ COMPLIANT |

**Compliance summary**: 19/19 requirements COMPLIANT (all scenarios). Every ✅ is backed by a test
that PASSED in the full-suite run this verifier executed.

## Spec-Drift Assessment

Implemented behavior matches signed spec V2. One phrasing note adjudicated:

- **boundary REQ-03.1 — "a read of the literal key returns the content"** is asserted in the test
  via `fake.committedTree().get("../escaped.ts")` rather than `fake.read(...)`. **Not drift —
  acceptable adaptation.** REQ-03.1's normative subject is the EMITTED WIRE DIRECTIVE captured at
  `emit` (the test spies `emit` and asserts `directive.create.pathTemplate === "../escaped.ts"`
  byte-equal — the core property). The secondary "a read returns the content" clause is a
  stored-key observation; because the scenario runs through a real `defineFactory` (required to
  prove the SDK path applies no normalization) and `commit()` clears staging that `read()` binds
  to, `committedTree().get()` is the correct post-run observation of the same literal key. The
  behavioral property (literal path stored unmodified) is fully verified. Flagged by
  verify-in-loop-4; adjudicated here as sound.

Stage-boundary discipline confirmed: no `AuthoringError`/attribution vocabulary and no
`instructions[0]`-attribution assertion anywhere in the src/test delta (the two `instructions[0]`
occurrences are test array-indexing to read a directive for assertions, not error attribution).
SEAM-04 (AuthoringError translation, `src/core/authoring-error.ts`) is Stage 2.1's territory per
the architecture baseline and is correctly NOT implemented — the five raw `ContractFake:` throw
sites carry `RAW-UNTIL-STAGE-2.1` markers for Stage 2.1 to upgrade.

## Coherence (Design rev 3)

| Decision | Followed? | Notes |
|---|---|---|
| Thread `force?` through wire→factory→base-handle→commons | ✅ | 5 production files exactly as §4.2 |
| Cap at fake `emit` only, `Session.flush` no size branch (D8c) | ✅ | REQ-01.3 spies emit invoked; no session.ts edit |
| `BATCH_CAP_BYTES` single constant (ADR-0019 provenance) | ✅ | in `wire.ts`; fixtures parametrize on it |
| Double-fault: try/catch around `discard()`, E2 as `E1.cause`, re-throw E1 | ✅ | `context.ts` exactly as §4.2 |
| Self-move identity exclusion (ADR-0017 amendment) | ✅ | `dst === src` short-circuit; ordering preserves file |
| FIT-09 path allow-list (not structural exception) | ✅ | exact-relPath allow-list; reachability gate kills EventEmitter FP |
| Round-trip structural compare (not trust-non-throw) | ✅ | hand-rolled `deepEqual` catches key-omission/null-array |

No rejected alternative accidentally implemented. File changes match design's File-Changes table.

## Architecture Conformance (vs baseline)

**Impact confirmed: modifying** (matches design's declaration). Baseline layering/port rules upheld:

- **Single `EngineClient` port** — preserved and now STRUCTURALLY guarded by REQ-FIT-09 (was
  convention-only). No second port introduced.
- **SDK never touches target tree / never validates** — cap + round-trip + fail-closed + existence
  all live in `test/support/contract-fake.ts` (the engine stand-in), not in `src/`. `Session.flush`
  unchanged. ADR-0018 honored.
- **AST never crosses the seam** — `directive-factory.ts` stays AST-blind (only threads `force`);
  no AST import added anywhere.
- **Additive-only public surface** — FIT-04 `.d.ts` semver gate green proves `move(…, {force?})`
  adds no breaking removal. No boundary removed.

Post-verify refresh (design §4.10): baseline Testing section should add `test/e2e`, `test/pyramid`,
`fit-10` and the `move` wire `force?` note — impact is `modifying`, so the refresh is prompted (not
mandatory). Orchestrator hook `arch_refresh_post_verify`.

## In-Loop History

| Iteration | Verdict | Issues |
|---|---|---|
| 1 | NEEDS_FIX | Strict-TDD `concerns`: one triangulation gap (LOCAL, fixed next iter) |
| 2 | PASS | — |
| 3 | PASS | — |
| 4 | PASS | Raised the REQ-03.1 `committedTree()` phrasing note (adjudicated above) |
| 5 | PASS | — |

## Issues Found

**CRITICAL** (block archive): None.
**WARNING** (should fix): None.
**SUGGESTION** (followups — register in pending-changes, non-blocking):
1. Domain delta spec files (`specs/batch-cap-contract`, `specs/boundary-pass-through`,
   `specs/test-pyramid-codification`, and the `foundations-skeleton`/`commit-discard-contract`
   deltas) carry `Status: draft` while the parent `spec.md` is `signed` — archive's spec-sync
   should normalize the status label. Cosmetic; no content divergence.
2. Near-duplicate inline `EngineClient` spy helper across `test/golden-ir/chained-batch.test.ts`
   (`makeSpy`) and `test/golden-ir/determinism.test.ts` (inline client) — extract a shared
   `test/support` spy helper. Nit-tier duplication.
3. `design.md` §4.5 labels ADR-0019 and the ADR-0017 amendment `Status: Proposed`, while the
   committed `openspec/decisions/0019-*.md` is `Status: Accepted` — align the design prose at
   archive. Cosmetic.

## Followups (routed)

| # | Followup | Route |
|---|---|---|
| 1 | Normalize domain-spec `Status: draft` → signed on sync | sdd-archive (spec-sync step) / pending-changes |
| 2 | Extract shared EngineClient spy helper for golden-ir tests | pending-changes (project/pending-changes) |
| 3 | Align design §4.5 ADR status labels with committed ADRs | sdd-archive / pending-changes |
| — | Refresh architecture baseline Testing section (e2e/pyramid/fit-10 + move force note) | orchestrator `arch_refresh_post_verify` (modifying → prompt) |

## Verdict

**pass-with-followups** — 19/19 REQs compliant with meaningful assertions and real passing tests
(237/237), typecheck clean, Step 11b code audit clean (zero gating findings), architecture
conformant, Strict TDD discipline verified across all slices. Three cosmetic/nit followups
registered; none block archive. adversarial_review: required (triage L) — judgment-day blind pass
must run before archive.
