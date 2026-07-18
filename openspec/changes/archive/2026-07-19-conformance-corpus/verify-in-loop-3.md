# Verify In-Loop Result

**Change**: conformance-corpus
**Iteration**: 1/3 (this batch — global artefact sequence: verify-in-loop-3, following S-000's verify-in-loop-1/2)
**Scope**: S-001 (m2-modify), S-002 (m2-delete), S-003 (m2-rename-move), S-004 (m2-create-composition) — PR#2, commit range `c80fd7d..45b7dae` on `feat/conformance-corpus`
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All four slices' acceptance criteria are met, all four commits are independently fail-closed
(verified in isolated worktrees), the full suite/typecheck/build are green at HEAD, and the
working tree was left byte-identical (only the pre-existing unstaged housekeeping files remain).
One design-elaboration question was investigated in depth per the orchestrator's brief and ruled
**legitimate** (with a documentation-debt WARNING, not a HALT). Two additional WARNINGs surfaced
during the audit; none are blocking.

- Tasks in scope complete: 20/20 (S-001.1-4, S-002.1-4, S-003.1-4, S-004.1-5)
- Affected tests (fit-40 + full suite) passed: 2033/2033 at HEAD; 39/42/45/47 passing incrementally
  at each of the 4 SHAs
- Spec compliance for scope (REQ-CFX-04/06/07/08/09/10/12/13, CCR-04/05.1): all COMPLIANT
- Assertion audit: clean — no tautological/banned patterns in the new test blocks
- Fail-closed at every SHA: confirmed via isolated worktree checkout, not inferred

---

## Adjudicated Question 1 — Case-level `factory` override generalized to all four fixtures

**Ruling: legitimate design elaboration, not architectural-conflict / spec-source-drift.**
Escalation is NOT warranted; a documentation-fidelity WARNING is registered instead.

**Evidence chain (read from the artefacts, not the executor's apply-progress prose):**

1. REQ-CFX-10.1 (`specs/conformance-fixtures/spec.md:288-292`) explicitly pins that `m2-modify`'s
   not-found-twin's own seed is `{target.txt, sibling.txt}` — i.e. the SAME shared seed as the
   positive case, not an omit-the-target seed variant. This is a signed-spec constraint, not an
   implementation choice: it forecloses the "vary the seed, keep one default factory" alternative
   that would otherwise avoid a schema extension.
2. REQ-CFX-07/08's fixture-level "Seed:" lines are stated once per REQ and apply uniformly across
   all of that fixture's cases; the landed repo confirms this literally — each of `m2-modify`,
   `m2-delete`, `m2-rename-move` ships exactly ONE `seed/` directory referenced by every case's
   `"seed": "seed"` field (verified: `find conformance/m2-*/seed -type f`).
3. Given (1)+(2), each twin MUST author a literal target absent from / structurally distinct in
   that SAME shared seed (`missing.txt`, `adir`, `occupied.txt`) — a genuinely different code path
   than the positive case's hardcoded target.
4. The `Case` TS interface (design.md §4.3, `interface Case`) has exactly one differentiation
   field beyond `name`/`seed`/`expected`: the ADR-0065 `factory?` override. `Manifest.input` is
   fixture-level only, confirmed absent from `Case`. There is no other schema mechanism, before or
   after ADR-0065, to select a different code path per case.
5. Conclusion: the same structural gap ADR-0065's Context section describes for
   `m2-create-composition` ("the handoff's manifest schema pins ONE fixture-level `factory` and
   offers NO per-case discriminator") applies identically, for the identical reason, to every twin
   in the corpus — not only to composition's create-vs-modify split. Generalizing the mechanism
   was mechanically necessary given (1)-(4), not gratuitous scope creep.
6. The handoff's ACCEPTED block (`CONFORMANCE-CORPUS-HANDOFF.md:84-96`) grants the schema
   capability generically and unconditionally ("a `cases[]` entry MAY carry its own `factory`
   ... overriding the fixture-level `factory` for THAT case only") — the composition-specific
   paragraph that follows is the MOTIVATING EXAMPLE (it was the fixture under the HARD GATE), not
   a scope restriction on the grant itself. The engine's Go-loader description in that same block
   is fixture-agnostic (`file://…/conformance/<id>/factory.ts#<name>`), so no additional
   engine-side work or unconfirmed behavior is introduced by the other three fixtures' usage.
7. Question 2's strict-decoding key audit (below) confirms every case-level `factory` object
   matches the documented `{module, export}` shape exactly — no unknown-key risk from the
   generalization.

**What IS a real gap (registered as WARNING, not a blocker):**

- **design.md's ADR-0065 is titled and scoped, in prose, to "the multi-behaviour composition
  fixture" only** — its Context/Decision/Consequences text discusses composition exclusively and
  never mentions that the SAME mechanism would be needed by 3 more fixtures. A reader of the
  design artifact alone would not learn that 5 of 12 cases (not 1) depend on this cross-repo
  schema delta. **Recommend**: amend ADR-0065's scope statement (or add a short addendum) to
  reflect the actual usage, so the design record matches what shipped.
- **slices.md's HARD GATE was placed only at S-004**, not at S-001 (the first actual consumer of
  the schema delta). Practically de-risked — the executor independently re-verified the engine's
  ACCEPTED sign-off before starting S-001, not only before S-004 (apply-progress, "S-004 hard
  gate" section) — but the plan itself under-scoped the dependency. **Recommend**: fold into the
  same ADR-0065 amendment so a future planner doesn't repeat the under-scoping.

Routing: **WARNING / documentation debt**, not `architectural-conflict`. No re-design, no
re-implementation needed.

---

## Adjudicated Question 2 — Strict-decoding conformance (unknown-key audit)

**Ruling: CLEAN. No unknown keys found.**

Programmatically enumerated every key at every level (top-level, `factory`, `lowering`, each
`cases[]` entry, `outcome`, `transcript`, plus per-case `factory` overrides) across all 5
manifests (`m1-vehicle` + 4 `m2-*`) and `corpus.json`. Every key set matches the handoff's
documented schema (`CONFORMANCE-CORPUS-HANDOFF.md` §manifest.json schema + the ACCEPTED
per-case-`factory` amendment) exactly:

- Top-level: `id, wireSpecVersion, class, factory, input, lowering, cases` — no extras.
- `factory`: `module, export` — no extras.
- `lowering`: `mode` (+ `schematicRoot` only where non-default; none of the 5 fixtures uses it).
- `cases[]`: `name, seed, expected, outcome, transcript` (+ `greetingVersion` only on
  `m1-vehicle`'s two cases, +`factory` only on the 5 case-level-override cases) — no extras.
- `outcome`: `exitCode, emitRejectionCode, failedIndex, writtenPaths` — no extras.
- `transcript`: `callbacks, singleCommit, forbidDiscard, emitBeforeCommit` — no extras.
- `corpus.json`: `wireSpecVersion, fixtures` — no extras.

Given the engine's loader is `DisallowUnknownFields` at every level, this was the correct thing
to verify exhaustively, and it holds.

---

## Adjudicated Question 3 — Fail-closed at every SHA

**Ruling: PASS at all 4 commits.** Verified in an isolated `git worktree` (not the main working
tree), `bun install --frozen-lockfile` run once, then `git checkout --detach` to each SHA in turn:

| SHA | Slice | fit-40 | `conformance-pr-gate.ts pr2 c80fd7d` |
|---|---|---|---|
| `d134000` | S-001 (m2-modify) | 39 pass / 0 fail | PASS — 1 commit checked |
| `381c1a8` | S-002 (m2-delete) | 42 pass / 0 fail | PASS — 2 commits checked |
| `883c482` | S-003 (m2-rename-move) | 45 pass / 0 fail | PASS — 3 commits checked |
| `45b7dae` | S-004 (m2-create-composition) | 47 pass / 0 fail | PASS — 4 commits checked |

Confirms REQ-CCR-04 (commit-atomic slice + corpus.json entry landing together) genuinely holds
at every intermediate SHA, not only at the range's HEAD. Worktree removed after use; main
working tree left untouched throughout.

---

## Adjudicated Question 4 — Transcript/outcome shapes vs ADR-0064's frozen contract

**Ruling: CLEAN. All 5 reject-twin cases match the frozen shape exactly.**

| Fixture / twin | `callbacks[]` | `forbidDiscard` | `exitCode` | `emitRejectionCode` | `failedIndex` |
|---|---|---|---|---|---|
| m2-modify / not-found-twin | `[ir.emit, ir.discard]` | `false` | 2 | `not-found` (directive) | `0` |
| m2-delete / not-found-twin | `[ir.emit, ir.discard]` | `false` | 2 | `not-found` (directive) | `0` |
| m2-delete / dir-target-twin | `[ir.emit, ir.discard]` | `false` | 2 | `unrepresentable` (batch) | `null` |
| m2-rename-move / collision-twin | `[ir.emit, ir.discard]` | `false` | 2 | `collision` (directive) | `0` |
| m2-rename-move / dir-source-twin | `[ir.emit, ir.discard]` | `false` | 2 | `unrepresentable` (batch) | `null` |
| m2-create-composition / wire-create-reject-twin | `[ir.emit, ir.discard]` | `false` | 2 | `unrepresentable` (batch) | `null` |

Directive-level codes (`not-found`, `collision`) all carry integer `failedIndex: 0`; the sole
batch-level code (`unrepresentable`) always carries `failedIndex: null` — REQ-CFX-04.1/.2 hold
across all 6 reject cases. `wire-create-reject-twin` is frozen to the emit-branch
`[ir.emit, ir.discard]` per ADR-0064's resolution (exit 2, not the exit-1 branch) — matches.
`writtenPaths` pins also hold: `[]` for all three pure-wire-mutation positives, `["generated.txt"]`
exactly for the schematic-lowered composition positive (REQ-CFX-12).

---

## Additional findings (surfaced during the audit, not in the four adjudication questions)

### WARNING — REQ-CFX-02's create-scan couples file-wide text search with a case's export-null
check (`test/fitness/fit-40-conformance-corpus-integrity.test.ts:222-231`)

The corpus-wide "exactly one create" scan flags a case as create-authoring only if BOTH (a) the
resolved factory FILE's stripped source contains a `create(` call ANYWHERE, and (b) that specific
case resolves to a non-null (named) export. This is correct for the current 5-fixture corpus (only
`m2-create-composition/factory.ts` contains any `create(` call at all), but it is not a per-export
check — a future named-export probe added to `m2-create-composition/factory.ts` that does NOT
itself call `create()` would still be flagged as a false-positive violation purely because the file
happens to contain `createRejectProbe`'s `create()` call elsewhere. Low risk today (verified: no
false positive at HEAD, suite green), but worth tightening to scan only the specific exported
function's body before the corpus grows further. Non-blocking.

### WARNING — Self-check never verifies a case-level `factory.export` string names a real export

`checkFactoryModuleResolution` (`test/support/conformance-validators.ts:98-103`) validates only
the FIXTURE-level `factory.module` file existence; no validator checks that a case-level
`factory.export` (now used by 5 of 12 cases: `notFoundProbe` ×2, `dirTargetProbe`,
`collisionProbe`, `dirSourceProbe`, `createRejectProbe`) actually names an export present in
`factory.ts`. Verified by manual read that all 5 current export strings correctly match their
factory.ts's actual `export function` names — no live defect — but a future typo in either the
manifest string or the function name would pass `fit-40`/typecheck silently and surface only
engine-side (cross-repo, deferred). Given ADR-0065's mechanism is now corpus-wide rather than
composition-only (per Question 1's ruling), this gap's blast radius is larger than when it was
scoped to one case. Recommend a fast-follow validator. Non-blocking — REQ-CSC-02.2's literal text
covers module resolution only, not export-name existence, so this is not a spec violation.

### Clean — `dist/conformance` build-output false-alarm ruled out

`bun run build` legitimately produces `dist/conformance/{index,run-vehicle}.{js,d.ts}` — this is
the PRE-EXISTING published `src/conformance/**` dialect-conformance kit (ADR-0012), a same-named
but unrelated neighbour per the corpus README's 4-way disambiguation. Confirmed no root-corpus
marker files or fixture-id directories (`manifest.json`, `factory.ts`, `corpus.json`, `m1-vehicle`,
`m2-*`) anywhere under `dist/`. REQ-CFX-14.1 holds.

### Clean — TDD RED evidence spot-check

For each of the 4 commits, confirmed via `git show --stat` that the fixture's full artefact set
(`manifest.json`, `factory.ts`, `seed/`, `expected/`, and for S-004 `schematic/`) and its
`fit-40` `describe("REQ-CFX-0N...")` block landed in the SAME commit — matching apply-progress's
"double-loop RED→GREEN per slice" claim at the git-history level (Method 1,
`strict-tdd-verify.md`), independent of the prose claims in apply-progress.md.

---

## Real Execution Evidence (this verify pass, run directly — not trusted from apply-progress)

| Check | Result |
|---|---|
| Full suite (`bun test`, main working tree, HEAD = `45b7dae`) | **2033 pass / 0 fail**, 4379 `expect()` calls, 188 files |
| `bun run typecheck` (`tsc --noEmit`) | Clean |
| `bun run build` | Green; `find dist -iname manifest.json -o -iname factory.ts -o -iname corpus.json -o -iname "m1-vehicle" -o -iname "m2-*"` → empty |
| `git add --renormalize .` dry-check at HEAD | Only residual diff: the pre-existing, orchestrator-owned `.sdd/state/conformance-corpus.json` (untouched by this change) |
| Working tree after verify | Byte-identical to pre-verify state (`git status --porcelain -uall` unchanged: same 1 modified + 3 untracked housekeeping files) |

---

## Spec Compliance Matrix (scope: S-001..S-004)

| Requirement | Test | Result |
|---|---|---|
| REQ-CFX-06.1/.2 | fit-40 `REQ-CFX-06` block | ✅ COMPLIANT |
| REQ-CFX-07.1/.2 + not-found sibling | fit-40 `REQ-CFX-07` block | ✅ COMPLIANT |
| REQ-CFX-08.1/.2 + dir-source sibling | fit-40 `REQ-CFX-08` block | ✅ COMPLIANT |
| REQ-CFX-09.1/.2/.3 | fit-40 `REQ-CFX-09` block | ✅ COMPLIANT |
| REQ-CFX-04.1/.2 | `checkOutcomeTripleConsistency`, cross-checked manually across all 6 reject cases | ✅ COMPLIANT |
| REQ-CFX-10.1 | `checkZeroEffectSeed` + manual seed-content read | ✅ COMPLIANT |
| REQ-CFX-12.2 | manual `writtenPaths` read across all 4 positives | ✅ COMPLIANT |
| REQ-CFX-13.1/.2/.3/.4 | manual transcript-table cross-check (Question 4) | ✅ COMPLIANT |
| REQ-CFX-02.1 | fit-40 `REQ-CFX-02` block | ✅ COMPLIANT (with WARNING on scan precision, above) |
| REQ-CFX-03.1 | fit-40 `REQ-CFX-03.1` | ✅ COMPLIANT |
| REQ-CFX-14.1 | `bun run build` + manual dist scan | ✅ COMPLIANT |
| REQ-CCR-04.1 | `conformance-pr-gate.ts pr2` at all 4 SHAs | ✅ COMPLIANT |
| REQ-CCR-05.1 | fit-40 `REQ-CCR-05.1` (5/12 gate now live) | ✅ COMPLIANT |
| REQ-CDT-02 | `git add --renormalize .` dry-check | ✅ COMPLIANT |

---

Orchestrator action: **exit loop for S-001..S-004** — proceed toward `/evaluate` (mode=final)
covering the whole `conformance-corpus` change (S-000 + S-001..S-004) before archive. Register
the two WARNINGs above as followups (ADR-0065 scope-documentation amendment;
factory-export-existence validator) rather than blocking this batch.
