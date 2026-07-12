# Apply Progress: Stage 5b — Dialect Breadth

**Batch**: 1 of N (S-000 walking skeleton only) · **Mode**: Strict TDD · **Suite**: 765 → 806
(bun test, +41) · `bunx tsc --noEmit`: CLEAN · `bun run build`: CLEAN · **Branch**:
`feat/stage-5b-dialect-breadth`

---

## Batch 4 — S-005: Conformance Tail (Adversarial Samples, Leaf Rule, Real-Base Probe)

**Mode**: Strict TDD · **Suite**: 844 → 848 (bun test, +4: +1 REQ-DC-06.1 spy test, +1
REQ-DC-07.1 documentation-pointer test, +1 REQ-DC-08.1 identity-fixture RED, +1 REQ-DC-06.2
compile-pin) · `bunx tsc --noEmit`: CLEAN · `bun run build`: CLEAN · **Branch**:
`feat/stage-5b-dialect-breadth`

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-005 | edge-case | complete | 5/5 |

### Commits

1. `b011d83` feat(conformance): S-005 — mandatory adversarial samples, real-base probe, shared deepEqual
2. `4d79c53` docs(dialect): S-005 — leaf-rule documented-limit statement
3. `da0d022` chore(sdd): stage-5b — mark S-005 slice tasks complete

### TDD Cycle Evidence — S-005

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Six mandatory adversarial samples + real-base probe | `typescript-conformance.test.ts::REQ-DC-06.1: all six mandatory samples run even when the fixture's own samples array is empty` | integration | `expect(parseCalls).toBe(6)` — "Expected: 6, Received: 0" (fixture.samples was empty, no injection existed yet) | ✅ | n/a — single deterministic injected-set count, not a class of varying inputs | none needed |
| Real-base structural probe (REQ-DC-08) | `typescript-conformance.test.ts::[permanent-fixture] REQ-DC-08.1: an identity parse/print fixture fails BEFORE the round-trip assertion could vacuously pass` | integration | "Expected promise that rejects, Received promise that resolved" (identity parse/print passed the round-trip vacuously, pre-implementation) | ✅ | 2 cases: the identity-fixture RED case above, plus the PRE-EXISTING REQ-DC-01.1 real-TypeScript-dialect test (unchanged, still green) as the positive control proving the probe doesn't false-positive on a real AST | none needed |
| `deepEqual` extraction to `src/core/deep-equal.ts` | full suite (no dedicated new test — behavior-preserving refactor of an already-tested function; `assertSerializable`'s existing REQ-DC-04 tests and `ContractFake`'s existing boundary REQ-01/02 tests both continue to pass unchanged, proving the extraction is behavior-identical) | — | n/a — pure extraction, not a RED/GREEN-driven behavior change | ✅ | n/a | none needed |
| REQ-DC-07.1 documentation-pointer assertion | `typescript-conformance.test.ts::REQ-DC-07.1: FIT-01's transitive import-graph walk is the shipped dialect's leaf-isolation proof` | architectural | passed immediately on first run — investigated per Strict TDD's "passes immediately" rule: this is a DELIBERATE documentation-pointer assertion (design's own characterization, "no duplicate import-graph scan authored here"), not a behavior-driving test; its only job is to fail if FIT-01's file is ever moved/removed without updating the pointer, which is exactly what it does (verified by temporarily renaming the FIT-01 file — the assertion failed as expected — then reverting) | ✅ | n/a | none needed |
| REQ-DC-06.2 opt-out compile-pin | `test/conformance/planted/opt-out-attempt.test.ts::attempting to disable mandatory-sample injection is a compile error` | contract | N/A (compile-time) — `DialectFixture` has never had an opt-out field, in either direction of this slice's change, so the excess-property check + `@ts-expect-error` combination was true both before and after; verified live by temporarily removing the `@ts-expect-error` comment — `tsc --noEmit` failed with `TS2353: Object literal may only specify known properties` as expected, confirming the check is real, then restored | ✅ | n/a | none needed |

### Deviations from Design

1. **Injection scoped to `testDialect` only, not `testOpPack`** (design §4.1/§4.5 prose says
   "testDialect/testOpPack" together): slices.md's own Task 1 text, the Acceptance criteria, and
   the ENTIRE Test Derivation table (§4.6) for REQ-DC-06/07/08 name only `testDialect` and
   `typescript-conformance.test.ts` — no `ops-*`/exercise-level test file is listed anywhere.
   `testOpPack`'s `OpExercise` shape (seed + op chain + expected byte-exact output) has no
   generic slot a kit-injected "adversarial sample" could occupy without knowing the concrete
   op being exercised — injecting there would require synthesizing expected outputs per
   op-pack, which no task or REQ text calls for. Scoped the implementation to `testDialect`,
   matching the concrete, testable acceptance criteria.
2. **"Duplicate-target" sample interpretation** (REQ-DC-06 names it without defining it, and no
   other precedent in this codebase uses that exact phrase for a round-trip sample): chose a
   source string with two import statements sharing one module specifier (`import { a } from
   "m"; import { b } from "m";`) — a `testDialect`-appropriate adversarial round-trip case (the
   dialect must round-trip it byte-exact without merging or de-duplicating on print, since
   round-trip is presentation-preserving, not semantic). Verified empirically against the real
   `src/dialects/typescript/ast.ts` parse/print pair before committing to it (all six samples,
   including this one, independently confirmed byte-exact round-trip).
3. **4 MiB sample construction**: reused the existing `REQ-TSD-03.7` precedent's technique (a
   block comment padded to size, `/*{padding}*/\nconst x = 1;\n`) rather than its exact
   byte-arithmetic (that test targets the SERIALIZED batch-cap boundary via `BATCH_CAP_BYTES`,
   which has no bearing on `testDialect`'s round-trip check — no batch is ever emitted there).
   Used a flat 4 MiB (`4 * 1024 * 1024`) of padding — empirically verified to round-trip
   byte-exact against the real dialect.

### Non-test LOC (cut-lever tripwire input)

Cumulative `git diff --numstat 57ce4d1..HEAD -- src/**` (57ce4d1 = the plan-merge commit, before
any apply work began) — this measured number supersedes the per-batch running estimates in
earlier sections of this file:

**Cumulative non-test source LOC this change (S-000 through S-005, full change complete)**: 430
lines added, 100 lines removed — net 330, gross 530. Well under the ~1,200-line L-band ceiling
(triage.md Criteria row 2); no cut-lever trigger condition met. **ADR count**: 4 total for this
change (unchanged since S-002 — S-005 fulfills ADR-0012's amendment, already counted, no new
ADR minted). **Cut-lever check result: NEITHER stop-condition triggered across the whole
change.**

### Test/typecheck/build evidence

- `bun test`: 848 pass / 0 fail (was 844 / 0 before this batch), 1534 `expect()` calls.
- `bunx tsc --noEmit`: clean, no errors.
- `bun run build`: clean (`tsc -p tsconfig.build.json` + codegen bin bundle).

---

### Batch 4 fix — verify-in-loop-4 CRITICAL + WARNING (S-005 mandatory-sample injection gap + probe triangulation)

**Mode**: Strict TDD fix (in-loop iteration 2/3) · **Suite**: 848 → 851 (+3) · `bunx tsc --noEmit`:
CLEAN · `bun run build`: CLEAN · **Branch**: `feat/stage-5b-dialect-breadth`

`verify-in-loop-4.md` CRITICAL finding #1: REQ-DC-06's chapeau ("into EVERY
`testDialect`/`testOpPack` run") was only half-implemented — `testOpPack` received ZERO of the
six mandatory adversarial samples, contradicting the un-hedged spec text (unlike REQ-DC-07/08,
REQ-DC-06 carries no "Design flag" granting latitude to narrow scope). Fixed per the verifier's
prescribed approach: extracted `testDialect`'s round-trip + real-base-probe loop into a shared
`runRoundTripProbe(dialectAst, samples, label)` helper (`src/conformance/index.ts:177-207`),
called from `testDialect` (unchanged behavior, against `fixture.dialect` + `fixture.samples` +
the mandatory set) and newly from `testOpPack` (against `fixture.baseDialect` + the mandatory set
only, independent of `fixture.exercises` — no per-op sample synthesis, exactly as the verifier
predicted). Added `typescript-conformance.test.ts::REQ-DC-06.3` (spy on `baseDialect.ast.parse`,
mirrors REQ-DC-06.1's technique) — RED first (`testOpPack` resolved with zero samples observed),
GREEN after wiring the helper into `testOpPack`.

**Structural conflict surfaced during implementation (resolved without redesign)**: injecting
the probe at the START of `testOpPack` (call order the verifier's writeup implied) broke 4
PRE-EXISTING `[permanent-fixture]` S-004 planted-violation tests (REQ-DC-03 coalescing,
REQ-DC-04.1 closure-smuggle, REQ-DC-04.2 live-node-smuggle, REQ-DC-05.2 read-split) — those
fixtures deliberately use identity/hand-rolled `baseDialect.ast` pairs to isolate ONE unrelated
failure mode, and the new probe's own REQ-DC-08/REQ-DC-01 checks rejected them first, masking
the violation each test exists to prove. Resolved by moving the probe call to the END of
`testOpPack` (after the exercise loop, `index.ts:328-338`): a fixture's own exercise failure
still surfaces for its own reason first, while the mandatory-sample probe still runs
unconditionally on every call whose exercises pass — satisfies REQ-DC-06's "regardless of what
samples the contributor's own fixture supplies" without touching any of the 4 signed-off S-004
fixtures. `REQ-DC-06.3`'s spy assertion was adjusted to read the LAST six recorded sources
(`seenSources.slice(-6)`) to match.

`verify-in-loop-4.md` WARNING finding #2: the real-base probe's 3-way OR
(`ast === null || ast === undefined || ast === sample`) only had a dedicated planted fixture for
the `ast === sample` (identity) branch. Added `test/conformance/planted/null-parse-violation.ts`
and `undefined-parse-violation.ts` (same `[permanent-fixture]` convention as
`identity-fixture-violation.ts`) plus `typescript-conformance.test.ts::REQ-DC-08.2`/`REQ-DC-08.3`
— both pass immediately against the existing (already-correct) guard, since no production code
change was needed for this finding; substituted a live mutation-kill proof for RED per Strict
TDD's "RED-first where possible" allowance.

**Mutation-kill proof #1 (Finding #1, live, this fix)**: commented out the
`runRoundTripProbe(fixture.baseDialect.ast, ...)` call at the end of `testOpPack` — `REQ-DC-06.3`
FAILED for the right reason (`seenSources.slice(-6)` was `[]`, expected the six mandatory
samples). Restored `src/conformance/index.ts` from a pre-mutation copy; `git diff --stat`
confirmed zero residual change; full suite re-ran 851/851 green.

**Mutation-kill proof #2 (Finding #2, live, this fix)**: weakened the guard to
`ast === sample` (dropping the `null`/`undefined` disjuncts) — `REQ-DC-08.2` and `REQ-DC-08.3`
BOTH failed for the right reason (rejected with REQ-DC-01 round-trip mismatch instead of
REQ-DC-08 real-base-dialect rule — the null/undefined checks no longer fired). Restored;
`git diff --stat` confirmed zero residual change; full suite re-ran 851/851 green.

### Test/typecheck/build evidence (fix)

- `bun test`: 851 pass / 0 fail (was 848 / 0 before this fix), 1538 `expect()` calls.
- `bunx tsc --noEmit`: clean, no errors.
- `bun run build`: clean (`tsc -p tsconfig.build.json` + codegen bin bundle).

---

## Batch 3 — S-003 (`addVariable`+`addClass`) + S-004 (`withOps` collision + reserved-names)

**Mode**: Strict TDD · **Suite**: 829 → 844 (bun test, +15 net: +9 S-003 [8 op scenarios + 1
exact-set gate], +6 S-004 [2 GREEN/standalone + 4 collision/reserved]) · `bunx tsc --noEmit`:
CLEAN · `bun run build`: CLEAN · **Branch**: `feat/stage-5b-dialect-breadth`

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-003 | happy-path | complete | 8/8 |
| S-004 | edge-case | complete | 5/5 |

### Commits

1. `e514928` feat(typescript-dialect): S-003 — addVariable + addClass ± export, exact op-set gate
2. `cde3ad2` chore(sdd): stage-5b — mark S-003 slice tasks complete
3. `148e15f` feat(core): S-004 — withOps eager collision + reserved-handle-verb diagnostic

(S-003's slices.md checkbox update landed as its own tiny chore commit, ahead of S-004's code,
to keep S-003's and S-004's tracking-artifact changes from mixing into either feature commit.)

### TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| addVariable + addClass | `ops-declarations-cuttable.test.ts` (8 cases, REQ-TSD-10.1–10.4, 11.1–11.4) | unit+integration | "ts.find(\"a.ts\").addClass is not a function" (and the addVariable analogue) | ✅ | 8 scenarios: non-exported/exported/collision/empty-file-seed × 2 ops, `kind` variety (const default, `let` exported, `var` explicit) | none needed |
| REQ-TSD-01.1 exact-set gate | `ops-exact-set.test.ts::sorted Object.keys...EQUALS the exact five-op allow-list` | unit | Would have failed pre-S-003 (four-op set); written and run only after both new ops existed, per the slice's own dependency (own scenario is trivially GREEN once addVariable/addClass compose) — investigated per Strict TDD's "passes immediately" rule: not vacuous, the assertion is `toEqual` on the literal 5-element array, would fail RED against any 4-or-6-element actual | ✅ | n/a — single deterministic set comparison | none needed |

### TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| withOps cross-pack duplicate | `define-dialect-collision.test.ts::two op-packs declaring the same op name throw...` | integration | "Received function did not throw" | ✅ | 2 cases (cross-pack duplicate, collision against `base.ops`) | none needed |
| withOps reserved-name | `define-dialect-collision.test.ts::throws synchronously, naming \`then\`...` | integration | "Received function did not throw" | ✅ | 7 cases (one per `RESERVED_HANDLE_NAMES` member: read/raw/modify/rename/move/copy/remove, plus `then` itself) | none needed |
| withOps disjoint GREEN + defineOpPack standalone | `define-dialect-collision.test.ts` (REQ-DG-02.2/02.3, 2 cases) | unit+integration | N/A — these are the negative-control/positive-baseline cases (assert NO throw / standalone shape), written alongside the RED cases to prove the check doesn't over-fire | ✅ | n/a | none needed |

### Deviations from Design

1. **`assertNoCollision`'s `handlePath` cast tightened (S-003, verify-standing SUGGESTION)**:
   the standing verify note flagged `handlePath as string` (an arbitrary-type cast) at
   `addFunction`'s call site. Since `handlePath` is structurally required to stay an optional
   5th parameter (the S-001 trailing-arg threading trick — `OpMethods` derives the
   author-facing type from the op-pack's own declared type, not the function's real, wider
   signature), the cast itself can't be removed, but a cleaner alternative exists: `handlePath!`
   (non-null assertion) only strips `| undefined`, whereas `as string` could silently mask an
   unrelated type mismatch. Applied at all three call sites (`addFunction`, and the two new
   `addVariable`/`addClass` sites) for consistency.
2. **`ops-exact-set.test.ts` mechanism (S-003)**: REQ-TSD-01.1's scenario text says
   `Object.keys(dialect.ops)`, which would require a new export of the `Dialect` object (or its
   `.ops` field) from `src/dialects/typescript/index.ts` — not called for anywhere in design's
   File Changes row for that file. Used the SAME mechanism the retired REQ-TSD-01.1 V4 test
   used instead (`Object.keys(handle)` filtered against the base-handle-surface set, sorted) —
   equivalent assertion power, no new public export introduced.
3. **`withOps`'s composition-collision helper typed via bare `OpPack` (S-004)**: an initial
   `readonly OpPack<unknown>[]` parameter failed to typecheck — `OpPack<Ast>` is not assignable
   to `OpPack<unknown>` because `Op<Ast>`'s `ast` parameter is contravariant (the same variance
   trap this file's own top-of-file comment already documents for the bare-generic-erasure
   case). Retyped as `readonly OpPack[]` (bare, defaulting to `OpPack<any>` per the type's own
   default parameter) — matches the file's established `any`-erasure convention rather than
   introducing a second one.
4. **Load-bearing literal period placement (S-004)**: slices.md's "Load-bearing literals" block
   and design.md §4.4/§4.5 render the duplicate-op compose-time message with the trailing
   period placed differently (slices.md: period INSIDE the backtick-quoted literal; design.md:
   period as prose punctuation OUTSIDE it). Followed slices.md verbatim per this batch's
   explicit "load-bearing literals VERBATIM" instruction — the shipped message is
   `op-pack composition failed: duplicate op "{name}" declared by more than one pack.` (with a
   literal trailing period); the reserved-name message has no trailing period, matching both
   documents.

### Non-test LOC (cut-lever tripwire input)

Cumulative `git diff --numstat 57ce4d1..HEAD -- src/**` (57ce4d1 = the plan-merge commit, before
any apply work began) — this measured number supersedes the per-batch running estimates in
earlier sections of this file:

**Cumulative non-test source LOC this change (S-000 through S-004)**: 395 lines added, 49 lines
removed — net 346, gross 444. Well under the ~1,200-line L-band ceiling (triage.md Criteria row
2); no cut-lever trigger condition met. **ADR count**: 4 total for this change (ADR-0039 new;
amendments to ADR-0037/0010/0012) — unchanged since S-002, under the 6-new-ADR standing
tripwire. **Cut-lever check result: NEITHER stop-condition triggered — S-003 built as planned,
no HALT.**

---

## Batch 2 — S-001 (`addFunction`) + S-002 (`removeImport` + row-136 + registry)

**Mode**: Strict TDD · **Suite**: 806 → 828 (bun test, +22 net: +8 addFunction, +1 REQ-DG-07.2
two-handle, -1 stale REQ-TSD-01.1, +4 REQ-MC-08, +4 removeImport, +2 REQ-TSD-08.4/08.6, +1
REQ-DG-07.1, +1 mixed-chain, +2 registry guard) · `bunx tsc --noEmit`: CLEAN · `bun run build`:
CLEAN · **Branch**: `feat/stage-5b-dialect-breadth`

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-001 | happy-path | complete | 7/7 |
| S-002 | happy-path | complete | 13/13 |

### Commits

1. `000243a` feat(typescript-dialect): S-001 — addFunction ± export, collision-namespace guard
2. `8867d42` test(core): S-001 fix — REQ-DG-07.2's two-handle case asserts commit boundary
3. `769f455` test(core): S-002 commit 1/2 — characterize today's row-136 silent last-write-wins
4. `ce48427` feat(core): S-002 commit 2/2 — row-136 reject (ADR-0039), replaces LWW characterization
5. `e955d55` feat(typescript-dialect): S-002 — removeImport op + REQ-DG-07.1/mixed-chain proofs
6. `7831143` docs(dialect): S-002 — registry promotion, guard-loop flip, authoring doc update

### TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| addFunction + assertNoCollision | `ops-declarations.test.ts` (8 cases, REQ-TSD-09.1–09.8) | unit+integration | "addFunction is not a function" | ✅ | 8 scenarios: non-exported, exported, cross-kind collision, comment-only seed, CRLF, run-twice, import-binding collision, type-alias non-collision | none needed |
| REQ-DG-07.2 (single handle) | `dialect-handle.test.ts::an addFunction collision reject fails the run closed, zero batches (single handle)` | integration | "addFunction is not a function" (via the same RED as ops-declarations) | ✅ | — | none needed |
| REQ-DG-07.2 (two handles, commit boundary) | `dialect-handle.test.ts::REQ-DG-07.2: an EARLIER handle...` | integration | First attempt asserted `collectModifies(emitted)` == 0 and FAILED for the right reason ("Received length: 1") — a genuine architectural discovery (session.read() globally flushes before the collision is detected), not a test-authoring slip caught before running. Fixed to assert `committedTree()`/`stagingTree()` instead | ✅ | 2 cases (single-handle, two-handle) | none needed |

### TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| row-136 characterization | `dialect-handle.test.ts::[characterization] TODAY: .modify() after an open, undrained AST op...` | integration | N/A — a characterization test by definition (asserts EXISTING behavior); confirmed it passed against pre-change code before any implementation edit, per constraint 2 | ✅ (pre-change baseline) | n/a | none needed |
| row-136 reject (runModify) | `dialect-handle.test.ts` REQ-MC-08.1–08.4 (4 cases), REPLACING the characterization test in the SAME commit | integration | "Expected: rejects... Received: resolves" (characterization test's own assertion now describes the WRONG behavior once the reject expectation replaces it) | ✅ | 4 cases (reject-while-pending, unaffected-when-none-pending, read-drains-then-succeeds, reverse-order-unaffected) | none needed |
| removeImport | `ops-removeImport.test.ts` (4 cases, REQ-TSD-08.1/08.2/08.3/08.5) | unit+integration | "removeImport is not a function" | ✅ | 4 scenarios: sibling survives, last-binding deletes statement, alias matched by exported name, dryRun preview | none needed |
| REQ-TSD-08.4/08.6 | `dialect-handle.test.ts` (2 cases) | integration | Passed immediately on first run — investigated per Strict TDD's halt rule: the mutation-gate (S-000) and #tail sequencing (pre-existing) already deliver zero-directive no-ops and RYOW generically; these tests close a genuine coverage gap for the CONCRETE removeImport trigger, not a vacuous assertion (mirrors S-000's own "pre-existing behavior already correct" precedent) | ✅ | n/a — mechanism proof, not branching logic | none needed |
| REQ-DG-07.1 (concrete trigger) | `dialect-handle.test.ts::a row-136 reject on a LATER handle commits nothing for an EARLIER, otherwise-clean handle` | integration | Written directly with the commit-boundary assertion (informed by the REQ-DG-07.2 discovery above) — passed on first run since the underlying poison-flag/discard mechanism is unchanged; verified deliberately, not assumed | ✅ | n/a | none needed |
| mixed old+new-op chain | `dialect-handle.test.ts::addImport + addFunction + removeImport in one chain coalesce to exactly one modify` | integration | Exact byte output unknown in advance — ran once, observed actual ts-morph formatting, corrected the expected literal twice (blank-line placement) before it passed for the right reason | ✅ | n/a | none needed |
| registry guard (sensitive-areas.md) | `security-authoring-guard.test.ts` (2 new cases) | doc-guard | "Expected to not contain: removeImport" (pre-existing negative test, deleted per constraint 6) — new registry assertions written against the ALREADY-EDITED sensitive-areas.md, so they passed on first run; investigated (not vacuous — verified by temporarily reverting sensitive-areas.md's edit and re-running, confirming the assertions do fail against the pre-promotion text) | ✅ | n/a | none needed |

### Deviations from Design

1. **Path threading through `runOp` (S-001, touches S-000-owned `dialect-handle.ts`)**: the
   add-op collision message template (design §4.4, "Load-bearing literals") requires `on
   "{path}"`, but `Op<Ast>`/`DialectAst.parse()` give an op function NO channel to the
   author-facing path (ts-morph's own `SourceFile.getFilePath()` is a constant internal virtual
   path, `ast.ts`'s own module doc confirms this is deliberate). Resolved by having `runOp`
   append `this.#path` as a TRAILING, OPTIONAL runtime argument after the author's own args —
   existing ops (`addImport`) ignore it silently (JS drops unclaimed trailing args); `addFunction`
   declares an extra optional 5th parameter to receive it, invisible to the public call
   signature (`OpMethods` derives the author-facing type from the op-pack's own type annotation,
   not the function's real, wider parameter list — verified both by `tsc --noEmit` passing and
   by the mechanism being additive/backward-compatible for every existing op and test). Reusable
   by S-003's `addVariable`/`addClass`, which share `assertNoCollision`.
2. **Stale pre-existing test retired (S-001)**: `test/dialects/typescript/dialect.test.ts`'s
   REQ-TSD-01.1 test ("ops is EXACTLY addImport") asserted spec V4's now-superseded scenario;
   composing `addFunction` broke it immediately. Not listed in slices.md's file inventory as an
   S-001 touch — removed as an unavoidable, narrowly-scoped consequence of landing the op
   (its replacement, the exact 5-op set assertion, is explicitly owned by S-003's
   `ops-exact-set.test.ts` per design's Test Derivation table) rather than left permanently
   false or updated every slice.
3. **Golden fixture directory (S-001/S-002)**: placed new fixtures in the EXISTING
   `test/dialects/typescript/golden/` (singular) directory with the existing `golden()` helper,
   not a new plural `goldens/` directory as slices.md/design.md's prose names it — no
   functional need for a second directory was cited anywhere, and the singular directory +
   helper is the established pattern.
4. **removeImport's whole-statement-deletion guard (S-002)**: added a defensive check (never
   delete the whole import declaration if it ALSO carries a default or namespace import
   alongside the matched named binding) — not scenario-tested (out of REQ-TSD-08's stated
   scope), but prevents silent corruption of a declaration shape the REQ text explicitly
   excludes rather than leaving it unguarded.

### Non-test LOC (cut-lever tripwire input)

Cumulative `git diff --numstat` on `src/**` from before S-000 through end of this batch:
- S-000 (reported previously): ~150 added/modified
- S-001 contribution: `dialect-handle.ts` +13/-1, `index.ts` +12/-6, `ops.ts` +58/-0
- S-002 contribution: `dialect-handle.ts` +14 (net, row-136 reject), `index.ts` +2/-1,
  `ops.ts` +23/-0

**Cumulative non-test source LOC this change (S-000+S-001+S-002)**: 294 lines added, 45 lines
removed (`git diff --numstat` on `src/**` from the pre-change base through HEAD) — net ~249,
gross ~339. Well under the ~1,200-line L-band ceiling (triage.md Criteria row 2); no cut-lever
trigger condition met. 4 ADRs exist for this change total (0039 new, amendments to 0037/0010/0012)
— under the 6-new-ADR standing tripwire.

---

### Batch 2 fix — verify-in-loop-2 CRITICAL (Strict TDD triangulation gap)

**Mode**: Strict TDD fix (in-loop iteration 2/3) · **Suite**: 828 → 829 (+1) · `bunx tsc --noEmit`:
CLEAN · **Branch**: `feat/stage-5b-dialect-breadth`

`verify-in-loop-2.md` CRITICAL finding #1: `removeImport`'s whole-statement-deletion guard
(`ops.ts:98-99`) has a `getDefaultImport() === undefined && getNamespaceImport() === undefined`
conjunct with zero triangulating tests. Fixed per the verifier's recommended option (i): added
`test/dialects/typescript/ops-removeImport.test.ts::"default import survives when its sibling
named binding is the last one removed"` — seeds `import def, { a } from "m";`, calls
`removeImport("a", "m")`, asserts byte-exact `import def from "m";\n` (the default import
survives; the declaration is NOT deleted).

Only the `getDefaultImport()` conjunct is reachable: TypeScript's import-clause grammar never
allows a `NamespaceImport` to coexist with `NamedImports` on the same declaration (only `import *
as ns from "m"` XOR `import { a } from "m"`, either optionally paired with a default), so
`getNamespaceImport()` is always `undefined` whenever `getNamedImports().length > 0` — ts-morph
cannot parse a fixture that would exercise that conjunct as false. Documented inline in the test
file rather than manufacturing an impossible fixture.

**Mutation-kill proof (live, this fix)**: weakened the guard to
`decl.getNamedImports().length === 1` (dropping both defensive conjuncts) — the new test FAILED
for the right reason (`Expected "import def from "m";\n", Received ""`  — the whole declaration
was deleted instead of the default import surviving). Restored `src/dialects/typescript/ops.ts`
via `git checkout --`; `git diff --stat` confirmed zero residual change; full suite re-ran
829/829 green.

---

## Batch 1 — S-000: Walking Skeleton (Contained-Invoke, Kit-Internal Modules, Fail-Closed Mechanism)

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 11/11 |

### Commits

1. `feat(core): S-000 — dialect-error + deep-equal kit-internal modules, shared runOp/runRaw containment, fail-closed poison flag`

(single commit — see rationale in "Commit granularity" below)

### TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| dialect-error.ts | `dialect-error.test.ts::isContained() is true for an error minted by dialectError()` | unit | "Cannot find module '../../src/core/dialect-error.ts'" | ✅ | 6 cases (prefix, no-cause, contained, foreign-with-matching-prefix, non-Error, distinct-instances) | none needed |
| deep-equal.ts | `deep-equal.test.ts::arrays are equal element-wise` | unit | "Cannot find module '../../src/core/deep-equal.ts'" | ✅ | 10 cases (primitives, NaN/-0, arrays, array-vs-object, objects, nested, undefined-key) | none needed |
| session.ts isPending | `session-is-pending.test.ts::is true for a directive that was buffered` | unit | "session.isPending is not a function" | ✅ | 4 cases (absent, present, identity-not-value, drained) | none needed |
| dialect-handle.ts #invokeContained (runOp) | `dialect-handle.test.ts::REQ-DG-06.1 sync throw from a named op is contained` | integration | "Expected \"dialect operation failed: ...\", Received \"planted native sync boom\"" | ✅ | REQ-DG-06.2/06.3/06.4/06.5 + SENTINEL leak case force async-await, resolve-ordering, and brand-passthrough generalisation | none needed |
| dialect-handle.ts poison flag | `dialect-handle.test.ts::REQ-DG-07.3b DIFFERENT handle is never attempted as a fresh operation` | integration | "Expected ... Received \"planted native sync boom\"" (poison flag absent, foreign op ran uncontained) | ✅ | 3 cases (same-handle, different-handle, post-death read()) | none needed |
| dialect-handle.ts mutation-gated #ensureOpen | `dialect-handle.test.ts::a true no-op (idempotent addImport) never registers a directive` | integration | "Expected [], Received [{verb:\"modify\",path:\"a.ts\"}]" | ✅ | 2nd case (an op that DOES mutate still registers) forces the gate to distinguish, not just always-skip | none needed |
| no-reparse spy | `dialect-handle.test.ts::parse is called exactly once per handle` | unit | pre-existing behaviour already correct — new proof only (see note below) | ✅ | n/a — single deterministic count, no branching | none needed |
| print-failure.test.ts | `print-failure.test.ts::a real ts-morph print failure is contained` | integration | pre-existing behaviour already correct — new proof only (see note below) | ✅ | n/a — single scenario per REQ-TSD-04.2 | none needed |
| fit-21 F2 guard | `fit-21-context-no-dialect-handle-import.test.ts::context.ts does not import dialect-handle.ts` | architectural | fitness-function style (characterization + red-proof, matches FIT-02/FIT-15 precedent — not a behaviour-driving RED/GREEN cycle) | ✅ | n/a | none needed |

**Note on "pre-existing behaviour already correct"**: the no-reparse spy and the print-failure
test both passed on first run. Investigated before accepting (per Strict TDD's "test passes
immediately → HALT and investigate" rule): `#printContained()`'s try/catch and the
single-parse-per-handle behaviour were UNCHANGED by this slice's edits (git diff confirms
`#printContained` byte-identical to HEAD) — these tests close a genuine COVERAGE gap
(pending-changes rows 137/140: "no real proof existed yet"), not a behaviour gap. Accepted as
legitimate per the TDD module's own halt-condition text ("the behaviour already exists" is one
of the two named reasons a first-try pass is investigated, not automatically rejected — the
other being a vacuous assertion, ruled out by reading the assertions).

### Implementation approach

- **`src/core/dialect-error.ts`** (Create) — `dialectError(tail)` factory + `isContained(err)`
  predicate, backed by a module-private `WeakSet<Error>`. The sole containment discriminator
  (F1, ADR-0037 amendment) — never a message-prefix match.
- **`src/core/deep-equal.ts`** (Create) — kit-internal `deepEqual`, copied from the existing
  `src/conformance/index.ts`/`src/testing/contract-fake.ts` duplicate (extraction onto this
  module is S-005's job, not this one's — this slice only stands the shared module up).
  Retyped the internal object-narrowing away from `Record<string, ...>` to an index-signature
  object type to avoid a FIT-07 false positive once the file moved under `src/core/**` (see
  Deviations).
- **`src/core/dialect-handle.ts`** (Modify) — the load-bearing rewrite:
  - `#invokeContained(fn, foreignTail)`: shared by `runOp`/`runRaw`; awaits a thenable result
    inside the try, discriminates caught errors via `isContained()`.
  - `runOp` gains an `opName` parameter (supplied by `createDialectHandle`'s per-op
    dispatcher closure) for its foreign-wrap tail.
  - Execution order changed: `#ensureLive()` → `#invokeContained(fn)` → `#ensureOpen()` (was
    `#ensureOpen()` BEFORE `fn`) — required so the mutation gate can compare the op's actual
    effect against the pre-op baseline.
  - `#ensureOpen()` gained the mutation gate: the FIRST registration only fires if
    `#printContained() !== #lastEmittedText`; the orphan-guard re-registration (FIT-19) stays
    unconditional once a directive has ever been open.
  - `#lastEmittedText` new field, seeded from `#ensureLive()`'s own read (not a redundant
    print-after-parse).
  - `#chain()` gained the F2 poison-flag wrapper (`ctx.runFailure`, first-wins, checked at
    every step/read() entry) — the run-scoped mechanism that makes a chained op on a
    DIFFERENT handle literally never execute after any rejection, not merely uncommitted.
  - `lazyModifyDirective()`'s `resolve` closure is nulled immediately after its one use
    (row-145) instead of tracked via a separate boolean flag.
- **`src/core/session.ts`** (Modify) — `isPending(directive)`, an identity membership check
  against the live buffer (no defensive copy), replacing `pendingSnapshot().includes(...)` in
  `#ensureOpen`'s orphan-guard call site.
- **`src/core/context.ts`** (Modify) — additive `RunContext.runFailure?: { reason: unknown }`
  field. No new import — `context.ts` still imports nothing from `dialect-handle.ts`.
- **`src/dialects/typescript/ast.ts`** (Modify) — row-139 investigated and found already
  satisfied (doc-comment note added, no functional change — see slices.md task note).
- **`createDialectHandle`**'s op-dispatcher closure now passes `opName` (the `Object.keys(ops)`
  loop variable it already had) through to `controller.runOp`.

### Deviations from Design

1. **FIT-14 tarball rows for `dialect-error.ts`** (not explicitly named in the slices.md
   task list, which only discussed `deep-equal.ts`'s rows): `bun run build` confirmed
   `dialect-error.ts` also emits `dist/core/dialect-error.{js,d.ts,d.ts.map}`, caught by the
   tarball diff for the same reason as deep-equal's rows (kit-internal module inside the
   `files: ["dist"]` glob). Added all 6 rows (3 per module) to `baseline.tarball`, verified
   against the actual build output rather than assumed.
2. **FIT-07 false positive on `deep-equal.ts`**: the original `Record<string, unknown>` type
   cast (copied from the pre-existing duplicate in `src/conformance/index.ts`/
   `src/testing/contract-fake.ts`, neither of which is scanned by FIT-07's `src/core/**`-only
   glob) textually tripped FIT-07's path-keyed-collection heuristic once the code moved into
   `src/core/`. Retyped via an index-signature object type (`{ [key: string]: unknown }`) —
   behaviorally identical, no semantic path-keyed content store was ever present. FIT-07
   itself was NOT modified.
3. **Pre-existing test assertion updated**: `test/core/dialect-handle.test.ts`'s
   REQ-MC-05.1 test asserted `printCalls === 0` mid-chain / `=== 1` at run-end, encoding the
   OLD "print only at flush" invariant. The mutation gate now probes print once on the
   FIRST op that opens a directive (ADR-0037 amendment's own documented Consequences: "a
   bounded relaxation of 'serialize once at flush'"). Updated the assertions to `1` mid-chain
   / `2` at run-end with an inline comment explaining the two distinct print call sites (the
   mutation-gate probe + the flush-time memoized resolve) — this is a design-mandated
   contract change to a pre-existing test, not a modification to force one of THIS slice's
   own tests green.
4. **Row-139 (`ast.ts`)**: no functional code change. Investigated via `git log`/`git show` —
   the "own-property/stack-shape heuristic" this task describes sweeping out does not exist
   anywhere in the current codebase; `parse()` already classifies off the real
   `getSyntacticDiagnostics()` diagnostic object (landed in S-002's `bc073d2`, before this
   change existed). Added a traceability doc-comment instead of manufacturing a no-op diff.
5. **F2 fitness guard numbered fit-21**: the design/slices text does not assign it a FIT
   number; `fit-01` through `fit-20` are all taken, so it landed as
   `test/fitness/fit-21-context-no-dialect-handle-import.test.ts`.

### Commit granularity

Landed as one commit — S-000 is explicitly justified in slices.md's own "Risks" section as
"one indivisible mechanism" (contained-invoke + fail-closed poison flag + mutation-gate are
one seam), and every file in this batch is load-bearing for every other (the poison flag
needs `#invokeContained`'s discrimination to distinguish an already-contained vs. foreign
throw; the mutation gate needs the reordered invoke-then-open sequencing). Splitting further
would produce intermediate non-compiling or behaviorally-incomplete commits.

### Test/typecheck/build evidence

- `bun test`: 806 pass / 0 fail (was 765 / 0 before this batch), 1432 `expect()` calls.
- `bunx tsc --noEmit`: clean, no errors.
- `bun run build`: clean (`tsc -p tsconfig.build.json` + codegen bin bundle).

### Non-test LOC (cut-lever tripwire input)

Source (non-test) diff for this batch, `git diff --numstat` on `src/**`:
- `src/core/dialect-error.ts`: +30 (new file)
- `src/core/deep-equal.ts`: +35 (new file)
- `src/core/dialect-handle.ts`: +85/-33 (net +52)
- `src/core/session.ts`: +7
- `src/core/context.ts`: +8
- `src/dialects/typescript/ast.ts`: +5

**Cumulative non-test source LOC this change**: ~150 added/modified lines (S-000 only — first
slice of the change). Well under the ~1,200-line L-band ceiling (triage.md Criteria row 2);
no cut-lever trigger condition met.

## Final-verify fix (post-build, pre-judgment-day)

Council found one shipped defect (QA F-1, architect converged MEDIUM) plus two closures.

1. **Fix 1 (CRITICAL, QA F-1 / architect MEDIUM)**: `dialect-handle.ts`'s `runOp` threaded
   `this.#path` as a TRAILING positional arg (`fn(this.#live, ...args, this.#path)`). All
   three add-ops declare `handlePath?` AFTER `options?`; when the author omits `options`
   (the common form, used in the spec's own scenarios) the path landed in the `options`
   slot instead, rendering the pinned collision message as `on "undefined"`. RED-confirmed
   empirically first (strengthened `REQ-TSD-09.3`/`10.3`/`11.3` + the `REQ-DG-07.2` site
   from loose `toContain` to the FULL pinned message including `on "<path>"` — all four
   failed with literal `on "undefined"`).
   Root-cause fix: replaced the positional trailing-arg channel with a **WeakMap keyed by
   the live AST instance** (`astHandlePaths`, set once in `#ensureLive`), exposed via an
   exported `handlePathFor(ast)`. This is fully arity-independent — no coupling to how many
   optional trailing args the author supplied. Considered the task's own suggested
   alternative first (`fn(ast, this.#path, ...args)`, ops re-declared as
   `(ast, handlePath, name, source, options?)`) and REJECTED it empirically: it breaks
   `defineOpPack<SourceFile, TypeScriptOps>(...)`'s assignability in `index.ts` (confirmed
   via an isolated `tsc --strict` repro) — `TypeScriptOps`'s frozen author-facing type has 3
   required params (`ast`, `name`, `source`), a required `handlePath` in position 2 needs 4,
   and TS rejects the excess-required-parameter mismatch (`options`/`source` type collision
   at position 3). The WeakMap channel sidesteps this entirely: the three ops' concrete
   signatures shrank back to an EXACT match with `TypeScriptOps` (no `handlePath` param at
   all), so the assignability is now trivial. `ops.ts` imports `handlePathFor` from
   `../../core/dialect-handle.ts` — a core (not cross-dialect) import, same category as the
   pre-existing `dialectError` import; no fitness function (FIT-02 cross-dialect leaf rule,
   FIT-08 kit-bleed re-export ban, FIT-10 EngineClient port guard) restricts it.
2. **Fix 2 (QA F-2)**: added a collision scenario seeding `class Foo {}` and asserting
   `addFunction("Foo")` rejects with the full pinned message — proven a genuine mutant-kill
   via a throwaway experiment (removed the `getClass` conjunct in `assertNoCollision`, test
   failed with `caught === undefined`; restored cleanly, `bun test` back to green).
3. **Fix 3 (standing SUGGESTION closure)**: added explicit `isContained(caught) === false`
   assertions for the duplicate-op and reserved-verb `withOps` compose-time throws in
   `test/core/define-dialect-collision.test.ts` — passes immediately (structurally
   guaranteed, `withOps` never calls `dialectError`), converting the guarantee into a pinned
   regression guard.
4. **Fix 4 (tech-writer MEDIUM)**: `docs/authoring-a-dialect.md`'s conformance section now
   documents the six mandatory adversarial samples (`testDialect`/`testOpPack`) and the
   stub/identity-`parse` rejection this change's own deliverables ship.
5. **Fix 5 (tech-writer LOW)**: `ops.ts`'s `@example` blocks renamed `ast` → `ts` to match
   `docs/authoring-a-dialect.md`'s own convention (landed together with Fix 1's edits to the
   same functions).
6. **Fix 6 (QA observation)**: added one sentence to `docs/authoring-a-dialect.md` stating
   `addFunction`/`addVariable`/`addClass`'s `source`/`initializer` strings are inserted
   verbatim, never validated — mirrors `.raw()`'s trust contract.

Explicitly out of scope (per the fix-batch instructions, orchestrator owns followups):
reserved-verb message wording, `Object.prototype` reserved-name hardening, REQ-DG-07
emit-vs-commit spec wording, DAS-01.1 derive-from-type, real-base probe non-identity-fake
gap, mutation-gate double-print, e2e dialect-modify extension.

### Commit granularity

Fix 1+2 landed as one commit (same mechanism file `dialect-handle.ts` + same op file
`ops.ts` + their test files) — Fix 5's `@example` rename is inside the same
`addFunction`/`addVariable`/`addClass` edits as Fix 1, so it rides along in that commit
rather than forcing a second touch of the same lines. Fixes 3/4/6 landed as one
docs/test-only commit (no source changes, no shared mechanism with Fix 1/2).

### Test/typecheck/build evidence (final-verify fix batch)

- `bun test`: 854 pass / 0 fail (was 851 / 0 before this batch — 3 new tests: Fix 2's
  mutant-kill scenario + Fix 3's two `isContained` pins), 1538 `expect()` calls.
- `bunx tsc --noEmit`: clean, no errors.
- `bun run build`: clean (`tsc -p tsconfig.build.json` + codegen bin bundle).
- Baselines byte-identical: `git status --short test/fitness/dts-baseline
  test/fitness/pkg-surface-baseline.json` — no output (public surface untouched, as
  required: `TypeScriptOps` in `index.ts` was never touched, and `handlePathFor` is an
  internal core export never re-exported from any public subpath).
