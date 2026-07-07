# Apply Progress: stage-3-dry-run-exposure

**Change**: stage-3-dry-run-exposure · **Triage**: M · **Mode**: Strict TDD
**Last run**: 2026-07-07 — scope `slice:S-002`

## Slice Status

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 10/10 |
| S-001 | happy-path | complete | 1/1 |
| S-002 | happy-path | complete | 1/1 |

## S-000 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dry-run/plan.ts` | Modified | Exported frozen `WIRE_TO_AUTHOR_VERB` map (`Record<Directive["op"], DryRunVerb>`, delete→remove, identity elsewhere; test-only reach, not barrel-re-exported); `export type DryRunVerb` (six frozen members) with exhaustive-switch/`never`-arm `@example` + frozen-growth prose; `DryRunEntry.verb` narrowed `string`→`DryRunVerb` with defining-site `@example`; `dryRunPlan` renders through the map; header rewritten to the frozen table (retired "§4.4 wire-tag" rationale, added `dryRun()` back-pointer) |
| `src/dry-run/index.ts` | Modified | Barrel gains `export type { DryRunVerb }`; deliberately does NOT re-export `WIRE_TO_AUTHOR_VERB` |
| `src/commons/index.ts` | Modified | Appended at file END: runtime `import { dryRunPlan } from "../dry-run/index.ts"`, type imports from `../dry-run/plan.ts` DEFINING SITE (FIT-06 single-hop), two-step `export type { DryRunEntry, DryRunVerb }`, and `dryRun(): DryRunEntry[]` = `dryRunPlan(currentContext().session.pendingSnapshot())` with full REQ-DRE-04 JSDoc (all four §4.4 elements incl. outside-run `@throws`) |
| `test/dry-run/plan.test.ts` | Modified | REQ-04.2 rebaselined delete→remove; REQ-04.4 decoy added (verb EXACTLY "remove", NOT "delete"); doc comment rewritten to frozen table; inline `Directive` literals kept |
| `test/dry-run/vocabulary-consistency.test.ts` | Created | D3 consistency: runtime `toEqual` on the exported map + compile-time `expectTypeOf<DryRunVerb>` + values-bridge, anchored to test-local `RATIFIED_AUTHOR_VERBS` |
| `test/e2e/dry-run.e2e.test.ts` | Created | REQ-DRE-01.1 (seed `{"src/b.ts": "old"}`, never `src/a.ts`) + REQ-DRE-01.5 (seed `src/gone.ts`); raw `ContractFake` + `defineFactory`, in-fn `expect` |
| `test/skeleton/dry-run-public-contract.test.ts` | Created | `.d.ts` baseline scans (REQ-DRE-02.1/.2, REQ-DRE-03.1) + JSDoc token scans (REQ-DRE-04.1–.3 + (d)) |
| `test/types/dry-run-verb.test.ts` | Created | Narrowing pin + never-arm exhaustive switch; type-only imports from public `src/commons/index.ts`; teeth at `bun run typecheck` |
| `test/fitness/dts-baseline/commons.index.d.ts` | Regenerated | `bun run build` + cp; adds `dryRun`/`DryRunEntry`/`DryRunVerb`, names neither `Directive` nor `pendingSnapshot` |
| `test/fitness/dts-baseline/index.d.ts` | Regenerated | Umbrella `export *` propagation captured (zero `src/index.ts` edit, PKG-01) |

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| plan.ts flip | `plan.test.ts::REQ-04.2 — all six ops map correctly` | unit | `expected "remove", received "delete"` (toEqual diff on src/c.ts entry) | yes | six-op aggregate + decoy | none needed |
| REQ-04.4 decoy | `plan.test.ts::REQ-04.4 — delete op never emits the wire tag [decoy]` | unit | `Expected: "remove" / Received: "delete"` | yes | negative assertion pair | none needed |
| D3 consistency | `vocabulary-consistency.test.ts::WIRE_TO_AUTHOR_VERB is exactly the six frozen rows` | unit | `SyntaxError: Export named 'WIRE_TO_AUTHOR_VERB' not found in module 'src/dry-run/plan.ts'` (import failure — the design-pinned RED locus for the unexported map, §4.6b rev 3) | yes | map `toEqual` + values-bridge + `expectTypeOf` | none needed |
| dryRun accessor + e2e | `dry-run.e2e.test.ts::REQ-DRE-01.1/-01.5` | e2e | `SyntaxError: Export named 'dryRun' not found in module 'src/commons/index.ts'` | yes | 2 scenarios (identity verbs + delete→remove through accessor) | none needed |
| REQ-DRE-03.1 export presence | `dry-run-public-contract.test.ts::dryRun is a named export of the commons .d.ts baseline` | architectural | `expect(dts).toMatch(/export declare function dryRun\(/)` failed against pre-regen baseline | yes (post-regen) | n/a — presence pin | none needed |
| REQ-DRE-02.1/.2 + 04.* scans | same file | architectural | [characterization] — target text cannot exist before the same slice writes it (design rev 5 per-assertion split); 02.2 + all 04.* observed failing pre-implementation as a side effect | yes | n/a | none needed |
| DryRunVerb narrowing | `dry-run-verb.test.ts` | contract | [characterization] RED at `bun run typecheck`: `TS2305 no exported member 'DryRunEntry'/'DryRunVerb'` + `TS2322 any not assignable to never` (file green under `bun test` as pinned) | yes | narrowing + exhaustive-switch pair | none needed |
| barrel export | `src/dry-run/index.ts` | — | [characterization] — type-only re-export, no runtime observable | yes | n/a | none needed |
| permanent fixtures | FIT-04 / FIT-06 / FIT-09 / `no-import.test.ts` | architectural | [permanent-fixture] reconfirmed green post-change | yes | n/a | n/a |

## Verification at Slice Boundary (S-000)

- `bun test`: 258 pass / 0 fail (was 243 pre-slice; +15)
- `bun run typecheck`: clean
- FIT-04 green post-regen; FIT-06 resolves `DryRunEntry`/`DryRunVerb` to `plan.ts` defining-site JSDoc; FIT-09 key set unchanged; `no-import.test.ts` green (map is pure data + type-only import)

## Deviations from Design (S-000)

None — implementation matches design rev 5 (§4.3 data model, §4.4 JSDoc tokens, §4.6b pinned idioms, §4.8 constraints 1–6 all honored in-slice).

## Notes (S-000)

- Cross-change guard honored: `src/core/context.ts` and `src/core/session.ts` untouched.
- REQ-04.4 decoy needed an explicit `string` widening (`const verb: string = ...`) because the narrowed `DryRunVerb` type structurally excludes `"delete"` — the negative assertion would not typecheck against the narrowed literal union otherwise.

---

## S-001 — Outside-Run Propagation (REQ-DRE-01.4)

**Files Changed**

| File | Action | What Was Done |
|---|---|---|
| `test/skeleton/dry-run-accessor.test.ts` | Created | REQ-DRE-01.4 case only: calls `dryRun()` outside any `defineFactory` run and asserts it throws the standard outside-run substring — no accessor-specific try/catch, no harness |

**TDD Cycle Evidence — S-001**

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| outside-run propagation | `dry-run-accessor.test.ts::throws the standard outside-run error when called with no active run` | unit | [TEETH-DEVIATION, see below] `Expected substring: "this substring does not appear in the real error" / Received message: "@pbuilder/sdk: file verbs (create, find, modify, remove, rename, move, copy) can only be used while a schematic is running — call them inside your factory function, not at module load time."` | yes | n/a — pure pass-through of `currentContext()`'s existing throw, no conditional/iterative/computational logic in scope | none needed |

**RED-posture taxonomy deviation (recorded, not silent)**

The slice's task is tagged `[must-fail-first]` in slices.md, but a genuine pre-implementation
RED was not possible: `dryRun()` already shipped in S-000 as
`dryRunPlan(currentContext().session.pendingSnapshot())` — outside-run propagation is
*inherited* from `currentContext()` (`src/core/context.ts:20-24`, read-only), not new logic
this slice introduces. There is no code left to write for this task; it pins already-shipped
behaviour.

Per the strict-TDD honesty guidance, RED evidence was manufactured honestly instead of faked:
the test was first written asserting a deliberately wrong substring
(`"this substring does not appear in the real error"`), run, and observed to fail for the
right reason (an assertion failure quoting the real error verbatim — not an import/syntax
error). This proves the assertion is discriminating: it does not pass for free. The substring
was then corrected to the spec's exact wording (`"can only be used while a schematic is
running"`) and the test went GREEN. No production code changed between RED and GREEN — the
"implementation" step is a no-op by design (S-000 already did it).

Taxonomy classification: retroactively this task behaves as **[characterization]**, not
**[must-fail-first]**, despite the slices.md tag inherited from planning. Recorded here per
the deviation-over-theatre rule rather than silently reclassifying slices.md's tag or
fabricating a false RED against broken code.

**Verification at Slice Boundary (S-001)**

- `bun test test/skeleton/dry-run-accessor.test.ts`: 1 pass / 0 fail
- `bun test` (full suite): 259 pass / 0 fail (was 258 pre-slice; +1)
- `bun run typecheck`: clean

**Deviations from Design (S-001)**

None beyond the RED-posture taxonomy deviation above (a testing-process deviation, not a
design/implementation deviation — `dryRun()`'s behaviour matches design rev 5 exactly, no
production code touched this slice).

**Notes (S-001)**

- Cross-change guard honored: `src/core/context.ts` and `src/core/session.ts` untouched.
- Touched only the new test file + progress/slice artefacts, per assignment constraint.

---

## S-002 — Buffer-State Variants (REQ-DRE-01.2, REQ-DRE-01.3)

**Files Changed**

| File | Action | What Was Done |
|---|---|---|
| `test/skeleton/dry-run-accessor.test.ts` | Modified | Extended with two cases: REQ-DRE-01.2 (empty buffer → `[]`, `makeSpyClient()` no seed) and REQ-DRE-01.3 (post-flush temporal — `makeSpyClient({ "src/b.ts": "old" })`, in-fn `create(a)` → `await find(a).read()` (flush) → `modify(b)` → assert single `modify` entry, `a` absent) |

**TDD Cycle Evidence — S-002**

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| empty buffer | `dry-run-accessor.test.ts::returns an empty array when the run has buffered no directive (REQ-DRE-01.2)` | unit | [TEETH-DEVIATION, see below] deliberately-wrong expectation `[{verb:"create",path:"src/deliberately-wrong.ts"}]` failed with `Received []` (real `Expected - 6 / Received + 1` diff) | yes | n/a — pure pass-through of `dryRunPlan([])`, no conditional/iterative logic in scope | none needed |
| post-flush temporal | `dry-run-accessor.test.ts::reflects only directives buffered since the last flush (REQ-DRE-01.3)` | unit | [TEETH-DEVIATION, see below] naive both-entries expectation `[{verb:"create",path:"src/a.ts"},{verb:"modify",path:"src/b.ts"}]` failed — `create` entry absent from the real (correct) result, proving the assertion discriminates the post-flush snapshot from the whole-run history | yes | n/a — single sequence pins the temporal contract; no class-of-inputs variation implied by the scenario | none needed |

**RED-posture taxonomy deviation (recorded, not silent)**

Both tasks are tagged `[must-fail-first]` in slices.md, but — same as S-001 — a genuine
pre-implementation RED was not possible: `dryRun()`'s buffer-reflection behaviour (including
the empty case and the post-flush snapshot) shipped complete in S-000
(`dryRunPlan(currentContext().session.pendingSnapshot())`, `Session.flush()`'s splice-to-empty,
`session.ts:53/56`). There is no production code left to write for either case.

Per the S-001 precedent, RED evidence was manufactured honestly: each test was first written
with a deliberately wrong expectation, run, and observed to fail for the right reason (an
assertion-diff failure quoting the real output verbatim — not an import/syntax error). For
REQ-DRE-01.3 specifically, the wrong-expectation variant asserted BOTH the `create` and
`modify` entries (the naive "no flush happened" reading) — this is the discriminating mutant
called out in the assignment: it fails precisely because the real implementation already
flushed `src/a.ts` out of the buffer, proving the assertion has teeth against a plausible wrong
implementation, not just against a random wrong literal. Both assertions were then corrected to
the spec's exact expectations and went GREEN. No production code changed between RED and GREEN.

Taxonomy classification: retroactively both tasks behave as **[characterization]**, not
**[must-fail-first]**, despite the slices.md tag inherited from planning — recorded per the
deviation-over-theatre rule rather than silently reclassifying slices.md's tag or fabricating a
false RED against broken code.

**Verification at Slice Boundary (S-002)**

- `bun test test/skeleton/dry-run-accessor.test.ts`: 3 pass / 0 fail
- `bun test` (full suite): 261 pass / 0 fail (was 259 pre-slice; +2)
- `bun run typecheck`: clean

**Deviations from Design (S-002)**

None beyond the RED-posture taxonomy deviation above (a testing-process deviation, not a
design/implementation deviation — `dryRun()`'s behaviour matches design rev 5 exactly, no
production code touched this slice).

**Notes (S-002)**

- Cross-change guard honored: `src/core/context.ts` and `src/core/session.ts` untouched.
- Touched only the existing test file + progress/slice artefacts, per assignment constraint.

## Next

All 3 slices (S-000, S-001, S-002) complete — 19/19 design §4.6 Test Derivation rows covered.
`/evaluate` (verify final) is the next recommended phase for `stage-3-dry-run-exposure`.
