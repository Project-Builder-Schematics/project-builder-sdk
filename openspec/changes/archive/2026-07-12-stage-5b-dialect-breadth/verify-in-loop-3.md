# Verify In-Loop Result

**Change**: stage-5b-dialect-breadth
**Iteration**: 3/3 (batch B3 first-pass — this is in-loop iteration 3 of the overall change's
3-max loop, but the FIRST verify pass over batch B3; batches B1/B2 each passed their own
in-loop check, B2 needed one internal fix cycle reported inline in
`verify-in-loop-2.md`)
**Scope**: S-003 (`addVariable`+`addClass` ± export + exact op-set gate), S-004 (`withOps`
eager collision + reserved-name diagnostic)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit for this batch; B4 (S-005) may proceed.

- Tasks in scope complete: S-003 8/8, S-004 5/5
- Affected tests passed: full suite 844/844 (real execution, not filtered — ran the complete
  suite since the delta touches shared surface: `ops.ts`, `index.ts`, `define-dialect.ts`)
- Typecheck: `bunx tsc --noEmit` clean
- Build: `bun run build` clean
- Spec compliance for scope: 9/9 REQ-IDs covered (TSD-01.1, TSD-10.1–10.4, TSD-11.1–11.4,
  DG-02.1 restate, DG-02.2–02.5)
- Assertion audit (delta test files): clean — no banned patterns in
  `ops-declarations-cuttable.test.ts`, `ops-exact-set.test.ts`,
  `define-dialect-collision.test.ts`, `test/types/define-dialect.test.ts` delta, or the
  delta lines of `security-authoring-guard.test.ts`
- Mutation-resistance spot check: 3/3 load-bearing assertions killed their mutants (see below)

---

## Execution Evidence (real, this pass)

| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | **844 pass / 0 fail**, 1530 `expect()` calls, 105 files, 16.09s |
| Typecheck | `bunx tsc --noEmit` | clean, exit 0 |
| Build | `bun run build` | clean, exit 0 (tsc -p tsconfig.build.json + codegen bin bundle) |
| FIT-04 + FIT-14 | `bun test test/fitness/fit-04-dts-semver-gate.test.ts test/fitness/fit-14-package-surface.test.ts` | 28 pass / 0 fail |
| All fitness (incl. FIT-06 JSDoc example scan) | `bun test test/fitness/` | 232 pass / 0 fail |
| Tarball reproducibility | `bun pm pack --dry-run` | 112 files, 225.75KB unpacked — consistent with FIT-14's passing tarball-diff assertion |

Matches `apply-progress.md`'s claimed Batch 3 delta (829 → 844, +15) exactly: baseline before
this batch (`a64bd5d`, verify-in-loop-2 PASS state) was 829; current HEAD is 844.

---

## Acceptance Criteria — Individually Evidenced

| Criterion | Evidence | File:line |
|---|---|---|
| `addVariable("PI","3.14159")` → `const PI = 3.14159;` | golden byte content confirmed: `const·PI·=·3.14159;␊` | `test/dialects/typescript/golden/add-variable-non-exported.txt` |
| `addClass("Point", "  x = 0;", {export:true})` → begins `export class Point` | golden confirmed: `export·class·Point·{␊  x·=·0;␊}␊` | `test/dialects/typescript/golden/add-class-exported.txt` |
| Sorted `Object.keys` exact-set gate == five-op list | `toEqual(["addClass","addFunction","addImport","addVariable","removeImport"])`, own file, survives cut by array edit | `test/dialects/typescript/ops-exact-set.test.ts:35` |
| Disjoint real packs compose silently | `expect(() => withOps(...)).not.toThrow()` against two REAL `SourceFile`-typed packs | `test/core/define-dialect-collision.test.ts:16-29` |
| Same-name packs throw synchronously naming the op | `.toThrow('op-pack composition failed: duplicate op "annotate" declared by more than one pack.')` — plus a SEPARATE case for collision against `base.ops` | `test/core/define-dialect-collision.test.ts:41-60` |
| `then` pack throws reserved-vocabulary message | `.toThrow('op-pack composition failed: op "then" collides with a reserved handle verb')`, plus all 7 other reserved verbs individually asserted | `test/core/define-dialect-collision.test.ts:62-82` |

---

## Load-Bearing Literals — Byte-Exact Verification

| Literal | Design/slices source | Code | Match |
|---|---|---|---|
| Add-op collision template | slices.md L106-108 / design.md §4.4 | `src/dialects/typescript/ops.ts:55-58` (`assertNoCollision`), reused at 3 call sites (`addFunction`:82, `addVariable`:104, `addClass`:131) | ✅ byte-exact, `dialectError()`-branded |
| Compose-time duplicate-op | slices.md L109-111 (period INSIDE backtick) | `src/core/define-dialect.ts:138` — `` `op-pack composition failed: duplicate op "${name}" declared by more than one pack.` `` | ✅ matches slices.md verbatim (trailing period present) |
| Compose-time reserved-verb | slices.md L109-111 (no trailing period) | `src/core/define-dialect.ts:136` — `` `op-pack composition failed: op "${name}" collides with a reserved handle verb` `` | ✅ matches slices.md verbatim (no trailing period) |

**Deviation 4 ruling** (trailing-period divergence between slices.md and design.md prose): slices.md's own "Load-bearing literals (copy exactly)" section places the period INSIDE the
backtick-quoted duplicate-op literal; design.md §4.4's prose places it OUTSIDE as sentence
punctuation (arguably not part of the literal). The task brief calls this deviation's own
resolution ("slices.md wins over design.md per its own 'copy exactly' rule") — verified: I
independently re-read both source documents byte-for-byte and confirm that reading is
accurate (slices.md L109-111 genuinely contains the period inside the backticks; design.md
L111 genuinely does not). **RULING: ACCEPT.** slices.md is the executor-facing "copy exactly"
artifact and is unambiguous on its own text; design.md's prose-punctuation placement is
reasonably read as sentence-final punctuation, not part of the literal. Code matches
slices.md exactly at both call sites. No test asserts the OPPOSITE (no-period) reading of the
duplicate-op message, so there is no internal contradiction in the shipped suite either.

---

## Constraint 6 — Guard-Loop Audit

`test/docs/security-authoring-guard.test.ts` REQ-DAS-01.1 loop (line 76-86) now names exactly:
`defineDialect`, `defineOpPack`, `withOps`, `.raw`, `addImport`, `removeImport`, `addFunction`,
`addVariable`, `addClass` — the 4 kit verbs + exactly the 5 shipped dialect ops. Grepped the
full `docs/authoring-a-dialect.md` and `src/dialects/typescript/**`: no unshipped op name
(e.g. `addMethod`, `addInterface`, `pruneUnusedImports` — the deferred op per triage Owner
Ruling #2) appears anywhere in guard assertions or prose as a named, callable verb. Confirmed
constraint satisfied.

---

## Cuttable Separation (Constraint 3) — Verified

- `test/dialects/typescript/ops-declarations-cuttable.test.ts` — sole owner of all 8
  REQ-TSD-10.x/11.x scenarios; would be deleted WHOLE on cut.
- `test/dialects/typescript/ops-exact-set.test.ts` — separate file, own file confirmed by
  `fd`/`rg`; its allow-list array is the only edit needed on cut (mutation-tested below: it
  correctly fails when `addClass` is absent from the shipped set).
- `rg -l "addVariable|addClass" test/` returns exactly 4 files: the two above, plus
  `security-authoring-guard.test.ts` (loop-entry strings only — trivially deletable on cut)
  and the FIT-04 `.d.ts` baseline (regenerable via the documented procedure on cut). No
  leakage into `ops-declarations.test.ts` (S-001/addFunction-only) or
  `ops-removeImport.test.ts` (S-002).
- Goldens: all 6 new fixtures are `add-variable-*`/`add-class-*` named, S-003-owned, no
  cross-op sharing.

All cuttable-isolation claims in slices.md's S-003 "Cuttable" block hold.

---

## Cut-Lever Measurement Audit

Reproduced independently:

```
git diff --numstat 57ce4d1..HEAD -- src/ | awk '{add+=$1; del+=$2} END {print add, del, add-del, add+del}'
→ added: 395  removed: 49  net: 346  gross: 444
```

**Matches the executor's claimed figures exactly** (395/49/346/444 in `apply-progress.md`).
Neither stop-condition met: gross 444 ≪ 1,200-line L-band ceiling; new-ADR count is 1
(`ADR-0039`; the other 3 are amendments to already-Accepted ADRs 0037/0010/0012, not new
ADRs by any reasonable reading) — even counting all 4 design.md `### ADR-` headings as "new,"
4 ≪ 6. **Cut-lever audit: CONFIRMED — neither trigger fired; S-003 was correctly built as
planned (not cut).**

---

## S-004 Mechanics

- **Eager + synchronous**: `assertNoCompositionCollision` runs unconditionally inside
  `withOps`, before the function returns — no promise, no deferred check
  (`src/core/define-dialect.ts:161-165`). Confirmed by test structure: every collision
  assertion in `define-dialect-collision.test.ts` wraps the `withOps(...)` CALL itself in
  `expect(() => ...).toThrow(...)`, not a subsequent `.read()`/run — proves the throw fires
  at composition, not first-run.
- **`base.ops` cross-check included**: `assertNoCompositionCollision(Object.keys(base.ops),
  packs)` seeds the `claimed` set from `base.ops` (`define-dialect.ts:170`); explicitly
  tested — "a pack colliding with base.ops also throws"
  (`define-dialect-collision.test.ts:48-59`).
- **Throws are plain Errors, NOT `dialectError()`-branded**: `src/core/define-dialect.ts:136`
  and `:138` both use `new Error(...)` directly, never importing/calling `dialectError`.
  Structural confirmation: `define-dialect.ts` has no import from `./dialect-error.ts`
  (`rg -n "isContained" define-dialect.ts` returns only a documentation comment, not a call).
  There is no test asserting `isContained(caught) === false` for these throws — see
  Findings below (non-blocking).
- **Red fixture typed over real `SourceFile`, outside `src/conformance/**`**: confirmed —
  `test/fixtures/red/dialect-generics/colliding-op-packs.ts` imports `SourceFile` from
  `ts-morph` and `defineOpPack` from `../../../../src/core/define-dialect.ts`; lives under
  `test/fixtures/red/**`, not `src/conformance/**`.

---

## Deviation Rulings

**(a) `handlePath!` non-null assertion replacing `as string`.**
Applied at all three `assertNoCollision` call sites (`addFunction`, `addVariable`,
`addClass` — verified at `ops.ts:82,104,131`). A non-null assertion only strips
`| undefined` from a type already known to include `string`, whereas `as string` could mask
an unrelated type mismatch. Strictly tighter, applied consistently across all reuse sites.
**RULING: ACCEPT.**

**(b) Exact-set test mechanism via `Object.keys(handle)` filtered against base surface,
instead of a new `dialect.ops` export.**
Verified against design §4.2 File Changes row for `index.ts`: "Compose the expanded shipped
pack; widen the exported op-type + `find` return type to the six-op set" — no `dialect.ops`
public export is called for anywhere in the row. The chosen mechanism reuses the SAME
approach the retired V4 REQ-TSD-01.1 test used (per the test file's own docstring, citing
commit `bc073d2`). Mutation-tested live (see below): correctly RED when `addClass` is
removed from the shipped op-pack. Equivalent assertion power, no new public surface
introduced. **RULING: ACCEPT.**

**(c) Bare `OpPack` (not `OpPack<unknown>`) for the composition-collision helper's parameter,
due to `Op<Ast>` contravariance.**
Verified: `src/core/define-dialect.ts` line 133,
`function assertNoCompositionCollision(baseOpNames: readonly string[], packs: readonly
OpPack[])`. The file's own top-of-file comment (lines 5-9) already documents this EXACT
pattern for other bare usages: "Bare (no type-argument) usage of `Dialect`/`OpPack`/`Handle`
resolves via default type parameters to `<any, OpPack<any>>` ... `Op<Ast>`'s `ast` parameter
is CONTRAVARIANT". `OpPack<Ast = any>` (line 23) confirms the default. This is the
established convention in this exact file, not a new one invented for this task.
**RULING: ACCEPT.**

**(d) Trailing-period literal ruling.**
See "Load-Bearing Literals" section above. **RULING: ACCEPT** — slices.md wins, code matches
slices.md verbatim at both call sites.

---

## JSDoc Braces Contrast (Owner CQ-D condition)

Verified in shipped code (`src/dialects/typescript/ops.ts`):
- `addFunction` (lines 67-73): *"`source` INCLUDES the function's `{ … }` braces — contrast
  `addClass`, whose `source` EXCLUDES them"* + `@example` showing
  `addFunction("hi", "(): void {}")` with an inline comment cross-referencing `addClass`.
- `addClass` (lines 116-122): *"`source` EXCLUDES the class's `{ … }` braces — contrast
  `addFunction`, whose `source` INCLUDES them"* + `@example` showing
  `addClass("Point", "  x = 0;")` with an inline comment cross-referencing `addFunction`.

Both directions present, both cross-reference each other by name, both match `design.md`
§4.2's verify-final obligation row verbatim in spirit. `docs/authoring-a-dialect.md` also
carries the same contrast in prose (git diff confirmed). FIT-06 (JSDoc example scan) passes
(232/232 fitness tests green, includes `fit-06-example-jsdoc.test.ts`).

---

## FIT-04 / FIT-14 Baseline Freshness

- `test/fitness/dts-baseline/typescript.index.d.ts` diff confirmed: `AddImportOps` →
  `TypeScriptOps` rename, `addVariable`/`addClass` signatures added — matches a fresh
  `bun run build`'s emitted `dist/dialects/typescript/index.d.ts` (FIT-04 test passed, which
  diffs against the LIVE build output, not a stale copy).
- `test/fitness/pkg-surface-baseline.json`: confirmed byte-identical (no diff) between
  `a64bd5d` and `HEAD` — correctly needed no update (no new dist file paths, no
  export/dependency change from S-003/S-004). `bun pm pack --dry-run` run live: 112 files,
  225.75KB, consistent with the passing FIT-14 tarball-diff assertion.

---

## Mutation-Resistance Spot Check (live, this pass — 3/3 killed, cleanly restored)

| # | Mutation | Assertion killed | Restoration verified |
|---|---|---|---|
| 1 | Removed `"then"` from `RESERVED_HANDLE_NAMES` in `define-dialect.ts` | `define-dialect-collision.test.ts` REQ-DG-02.5 `then` case failed for the right reason ("Received function did not throw") | `git checkout --`, re-ran — 5/5 other cases in file still passed pre-restore, confirming isolation |
| 2 | Removed `addClass` from the composed `opsPack` in `index.ts` | `ops-exact-set.test.ts` failed for the right reason (`toEqual` diff showing `"addClass"` missing) | `git checkout --`, re-ran full suite: 844/844 green |
| 3 | Removed `assertNoCollision(...)` call from `addClass` in `ops.ts` | `ops-declarations-cuttable.test.ts` REQ-TSD-11.3 failed for the right reason (`caught` was `undefined`, expected `Error`) | `git checkout --`, re-ran full suite: 844/844 green |

Working tree confirmed clean after each mutation (`git diff --stat` showed zero residual
change to `src/`); final full-suite re-run after all three restorations: 844/844.

---

## Findings

| # | Severity | REQ-ID | Evidence | File:Line | Detail |
|---|---|---|---|---|---|
| 1 | SUGGESTION | REQ-DG-02.4/02.5 (adjacent) | `rg -n "isContained" test/core/define-dialect-collision.test.ts` returns zero matches | `test/core/define-dialect-collision.test.ts` | No test explicitly asserts `isContained(caught) === false` for the S-004 compose-time throws. The non-branding property is structurally guaranteed today (the throws are plain `new Error(...)`, never routed through `dialectError()`, and `define-dialect.ts` has no import from `dialect-error.ts`) — not a functional gap, no scenario requires it. An explicit assertion would strengthen the discriminator invariant against future refactors (e.g. someone routing these throws through a shared helper later) but is not REQ-mandated and does not block this batch. |

No CRITICAL or WARNING findings in scope.

---

## Strict TDD (in-loop audit)

**Iteration**: 3
**Verdict**: ok
**Delta scope**: 5 test files touched (2 created — `ops-declarations-cuttable.test.ts`,
`ops-exact-set.test.ts`, `define-dialect-collision.test.ts`; 1 created fixture —
`colliding-op-packs.ts`; 2 modified — `security-authoring-guard.test.ts`,
`test/types/define-dialect.test.ts`), 2 impl files modified (`ops.ts`, `index.ts`,
`define-dialect.ts` — 3 impl files)

### Findings
None.

### Tolerated for now (flagged for final)
None beyond the SUGGESTION above (mutation-testing coverage, not a TDD-cycle concern).

### TDD Cycle Evidence (cross-checked against `apply-progress.md`'s own table)
- S-003 addVariable/addClass: RED evidence genuine ("addClass is not a function" /
  addVariable analogue) — confirmed plausible given the ops didn't exist pre-slice.
  Triangulation: 8 scenarios across non-exported/exported/collision/empty-file-seed × 2 ops
  — verified by reading the actual test file (8 `it()` blocks, matches).
- S-003 exact-set gate: investigated first-try-pass per Strict TDD's own rule (deterministic
  `toEqual`, correctly reasoned as not vacuous) — independently confirmed via mutation test
  #2 above (genuinely RED when `addClass` is absent).
- S-004 collision/reserved: RED evidence genuine ("Received function did not throw") —
  independently confirmed via mutation test #1 above.
- Regression: full suite green, no previously-passing test broken (844/844, up cleanly from
  829/829 at the B2 baseline, +15 matching the claimed net).

**Banned assertion patterns (delta only)**: none found in the delta's test files (single
pre-existing `toBeDefined()` at `security-authoring-guard.test.ts:136` predates this batch —
part of S-002's already-verified delta, not this batch's).

**Triangulation hint check**: `ops-declarations-cuttable.test.ts` has ≥2 test-cases per op
(4 each for addVariable/addClass); `define-dialect-collision.test.ts` has 2 cases for
cross-pack duplicate + 8 cases (7 reserved verbs + `then`) for reserved-name — no
single-test-for-conditional-logic gap.

**Regression check**: all previously-passing tests still pass (verified via the full 844/844
run, which is a superset of every prior batch's suite).

---

## Deviations Not Otherwise Covered

Apply-progress.md's Batch 3 section claims 4 deviations total; all 4 map onto the "Deviation
Rulings" (a)-(d) above — no additional undocumented deviations found in the diff review.

---

## Carry to Verify-Final

- The SUGGESTION above (isContained non-branding assertion for S-004 compose-time throws) —
  optional strengthening, not a blocker; final-mode assertion-quality audit may choose to
  request it or accept the structural guarantee as sufficient.
- S-005 (conformance tail) remains unbuilt — expected, not a finding; Build Order correctly
  requires S-003 complete first (final op-set + cut-lever decision settled), which this batch
  satisfies.
- Verify-final obligations already discharged by S-002 (sensitive-areas promotion,
  stale-paragraph fix) remain unaffected by this batch — re-confirm once more at final mode
  per the skill's own aggregation step, but no regression found here.
- Deviation (b)'s equivalence claim (mechanism swap for REQ-TSD-01.1) should be re-examined
  once more at final mode's full spec-compliance matrix pass, since it is a scenario-text
  interpretation call, not a pure implementation deviation — this in-loop pass accepts it on
  the strength of the design's own File Changes row and live mutation-testing, but final mode
  has the fuller context (all REQ-IDs, not just scope) to weigh in again if useful.

---

### Skill Resolution

injected (Craftsman preamble + repo rules provided in launch prompt; no project-specific
compact rules beyond the repo-rules line were injected — registry reported EMPTY, consistent
with `none` for project-specific skills).
