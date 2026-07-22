# Slices: Copy/CopyIn Conformance Fixtures

**Triage**: L
**Spec version**: V2 (signed 2026-07-22)
**Design**: rev 3 (architect APPROVE, architecture_impact: additive)
**Total slices**: 6 (1 walking skeleton + 5 SPIDR)
**Rev 2** (plan-verify iteration 1, Judge B gap fix): pinned values quoted in-line from signed
spec V2 / design rev 3 into every slice (kills Q1–Q8); added Executor Context + Branch/Commit
Mechanics sections (kills Q9–Q12). No slice added/removed/reordered; no spec/design touched;
Judge A's problem/scope verdict (clean) is unaffected by this rev.
**Rev 3** (plan-verify iteration 2, Judge B down to 7 facts-in-no-artifact): pinned the
commit/merge workflow, S-000's own-PR placement, SHA-based engine-pinnability, held-branch
push+draft-PR durability, the verbatim ADR-0074 debt-row content, the ASAP/no-deadline note, and
the all-six-slices acceptance bar — reworded away any "deferrable-by-default" phrasing. Surgical
pass over Executor Context + Branch & Commit Mechanics + S-005; slice IDs/structure/seam
unchanged; Judge A's clean verdict unaffected.
**Rev 4 (final)** (plan-verify iteration 3, ceiling reached — owner-ruled READY after this pin):
pinned the last 4 execution-environment facts — merge authority/process, remote/host +
credentials, owner + escalation channel, and toolchain confirmation (resolves the S-000.8
"or `tsc --noEmit`" hedge). Surgical pass over Executor Context + Branch & Commit Mechanics
only; nothing else changed.

---

## Executor Context (read before S-000)

**Problem** (from `triage.md`): The engine's `copy-wire-inclusion` change is hard-gated — its
owner will not merge while its conformance test skips, and the engine repo structurally cannot
author its own fixtures (`TestConformance_FixturesAreSDKOwned`, engine ADR-D). Today a schematic
author calling the SDK's public `copy()`/`copyIn()` verbs gets zero bytes on disk because the
engine ingestion layer rejects both as unrepresentable. The engine is planning
`copy-wire-inclusion` NOW, so the SDK-owned `m2-copy` fixture must land and be pinnable BEFORE
that engine change merges — SDK PR cadence gates an engine milestone; `m2-copyin` is authored in
parallel (SDK-side authoring is engine-independent) but banked for a later, separate engine
milestone (`copyIn` wire-inclusion, not yet scheduled).

**Two done-definitions** (REQ-CCR-09, verbatim intent — neither substitutes for the other):

| | `m2-copy` (critical path) | `m2-copyin` (banked arm) |
|---|---|---|
| Done means | Merged to `main`, own commit, own `corpus.json` entry, `fit-40` green at 6 fixtures/18 cases, engine-pinnable | Fully authored (manifest, factory, `assets/`, `expected*`, 5 cases) + committed on a named, UNMERGED branch, `fit-40` green in ISOLATION at 7 fixtures/23 cases, registered at archive as an authored-but-held debt row (branch name, un-hold trigger, 5-item re-validation checklist) |
| Held-unmerged is | N/A — already merged | The INTENDED success state per ADR-0074 — not a red flag, not unfinished work. "Fully authored + branch-held" IS done for this arm in THIS change. |

**Priority ordering** (binding for build order — NOT a license to skip): **S-000 → S-001 →
S-002 are the protected critical path** — they unblock the engine's `copy-wire-inclusion`
milestone and are built first, always. **S-003 → S-004 → S-005 are the banked arm** — equally
in-scope, built second. The ordering exists so the critical path is never put at risk by the
banked arm's timing (never the reverse); it is NOT a statement that the banked arm is optional.

**Deadline** (owner-answered, 2026-07-22): no firm date — ASAP. The critical path is priority-1
by ORDERING, not by calendar pressure; there is no deadline forcing a cutoff before the banked
arm is attempted. The banked arm is NOT deferred from the outset — building it is the default
plan for this change.

**Acceptance bar for this change** (owner bundle ruling): this change is DELIVERED when ALL SIX
slices are complete — S-000 through S-005, critical path AND banked arm. Landing only the
critical path (S-000–S-002) is NOT, by itself, a complete delivery of this change; it is a
partial state. Deferring the banked arm (registering `m2-copyin` as an ADR-0074 debt row without
authoring it) is an EMERGENCY VALVE ONLY — it requires an explicit owner decision taken at build
time (never a silent default, never inferred from time pressure alone) and must be recorded as
such, not presented as the plan succeeding as designed.

**Owner & escalation channel** (execution-environment fact): the owner is Daniel (GitHub
`Hyperxq`), present in the interactive session driving this build. The emergency-valve decision
above and any halt escalate to him via the session checkpoint — never decided unilaterally by
the executor.

---

## S-000: Walking Skeleton — fit-40's derived-count + two-leg determinism mechanism, proven on the EXISTING corpus

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-CCR-05.1, REQ-CCR-05.5, REQ-CDT-06.1/.2 (ADR-0075/ADR-03, B1/B2/N4)
**Requires**: nothing
**Test layers**: architectural (fit-40)
**Priority**: protected critical path (see Executor Context)

Riskiest shared mechanism first: every later fixture slice's RED-first TDD depends on this
rewrite already being correct. Proves the mechanism (not a UI path — this corpus has none) at
the EXISTING corpus, before any new fixture exists — no new data required.

**Pinned values**:
- Derived-count source (design §4.2/ADR-0075): `sum(manifest.cases.length)` over EVERY id
  currently in `corpus.json#fixtures` — never a literal. Pre-change state: `corpus.json` lists
  `["m1-vehicle","m2-modify","m2-delete","m2-rename-move","m2-create-composition"]` = **5
  fixtures**; case sum = 2+2+3+3+2 = **12 cases**. The rewritten check must derive and equal
  this SAME 5/12 figure with zero hardcoded literal anywhere in the assertion.
- REQ-CDT-06 loop, exact form (design §4.2 row, ADR-0075):
  `[...listSubdirectories(f.dir).filter(s => s.startsWith("expected") || s === "assets"), (f.manifest.lowering.schematicRoot ?? "schematic") + "/files"]`,
  each array entry `existsSync`-guarded before reading.
- FORBIDDEN: adding `s === "schematic"` to leg 1 — it would recurse into the legitimately-varying
  `schema.json` (B2 trap, design §4.7).
- DELETE (not merely bypass): the two dead literal gates currently in the file —
  `if (corpus.fixtures.length !== 1) return` and `if (corpus.fixtures.length !== 5) return`
  (REQ-CCR-05.5 forbids leaving either as vacuous dead code).

**Acceptance**:
- GIVEN the existing 5-fixture/12-case corpus, unmodified
- WHEN `fit-40` runs after the rewrite
- THEN it is GREEN, the derived check equals 5/12 with no literal, zero `!==1`/`!==5` gates
  remain, and the REQ-CDT-06 loop is exactly the union form above

### Tasks
- [x] S-000.1 Delete `corpus.fixtures.length !== 1` / `!== 5` early-return gates in the REQ-CCR-05 describe block.
- [x] S-000.2 Replace with the derived check: loaded-set === `corpus.json#fixtures` + `sum(manifest.cases.length)` — must equal 5/12 pre-change, no literal (REQ-CCR-05.1).
- [x] S-000.3 Leave REQ-CCR-05.2 (`checkOrphanDirectories`) untouched.
- [x] S-000.4 Rewrite the REQ-CDT-06 loop to the exact two-leg union quoted above, `existsSync`-guarded per leg.
- [x] S-000.5 Comment the `s === "schematic"` recursion trap — do NOT add it.
- [x] S-000.6 `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` — GREEN at 5/12.
- [x] S-000.7 `rg -n '!==\s*1|!==\s*5' test/fitness/fit-40-conformance-corpus-integrity.test.ts` — confirms no absolute-count gate remains.
- [x] S-000.8 `bun run typecheck` (or `tsc --noEmit`) over the edited file.

**Delivered** (2026-07-22): branch `fit-40-manifest-derived-inventory`, commit `de90b23`, PR
[#43](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/43) opened against
`main`, review/merge requested from Daniel (`Hyperxq`) — not merged by the executor. `bun test`
48/48 green (file); full suite 2135/2135 green (no regressions); `rg` gate empty; `tsc --noEmit`
clean.

---

## S-001: `m2-copy` lands its full behavioral contract on `main`

**Scope**: happy-path
**Dimension**: D (Data)
**Covers**: REQ-CFX-15.1–.6, REQ-CFX-12.2, REQ-CFX-13.1/.5, REQ-CCR-04
**Requires**: S-000
**Test layers**: architectural (fit-40)
**Priority**: protected critical path (see Executor Context)

Template-clone of `m2-rename-move` (ADR-0065). `corpus.json` entry lands in the SAME slice as
the fixture (REQ-CCR-04 commit-atomicity maps to same-slice atomicity here).

**Pinned seed bytes** (mirrors `m2-rename-move`'s seed): `src.txt = "payload"`,
`occupied.txt = "taken"`, `adir/child.txt = "x"`.

**Pinned factory exports** (design §4.4, imports `{ copy, replaceContent }` from `../../src/index.ts`):

| Export | Call |
|---|---|
| `default` (positive) | `copy("src.txt","dst.txt")` |
| `collisionWithForceProbe` | `copy("src.txt","occupied.txt",{force:true})` |
| `collisionNoForceProbe` | `copy("src.txt","occupied.txt")` |
| `missingSourceProbe` | `copy("missing.txt","dst.txt")` |
| `dirSourceProbe` | `copy("adir","bdir")` |
| `copyThenModifyProbe` | `copy("src.txt","dst2.txt"); replaceContent("dst2.txt","final")` — ONE batch, two directives |

**Pinned outcome triples + transcripts** (REQ-CFX-15, REQ-CFX-12.2, REQ-CFX-13 table) — every
case's `writtenPaths: []` (pure wire-mutation, REQ-CFX-12):

| Case | exitCode | emitRejectionCode | failedIndex | expected/ disk state | transcript `callbacks` | `forbidDiscard` |
|---|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt="payload"`, **`src.txt="payload"` still EXISTS** (source intact), `occupied.txt="taken"`, `adir/child.txt="x"` | `[ir.emit, ir.commit]` | true |
| collision-with-force | 0 | null | null | `occupied.txt="payload"` (overwritten), `src.txt` unchanged | `[ir.emit, ir.commit]` | true |
| collision-no-force-twin | 2 | `"collision"` | 0 | `"zero-effect"` | `[ir.emit, ir.discard]` | false |
| missing-source-twin | 2 | `"not-found"` | 0 | `"zero-effect"` | `[ir.emit, ir.discard]` | false |
| dir-source-twin | 2 | `"unrepresentable"` | null | `"zero-effect"` | `[ir.emit, ir.discard]` | false |
| copy-then-modify | 0 | null | null | `dst2.txt="final"` (the modify's bytes, never the copy's intermediate) | `[ir.emit, ir.commit]` **exactly once** (single flush, sequential array order — NOT doubled) | true |

**Load-bearing mutation-resistant assertion** (REQ-CFX-15.1, inverse of `m2-rename-move`
fit-40:516): `existsSync(join(fixture.dir, "expected", "src.txt")) === true` — copy, unlike
rename, must NOT remove the source.

**Acceptance**:
- GIVEN `m2-copy`'s manifest/factory/seed/expected* do not yet exist
- WHEN the REQ-CFX-15 fit-40 block above is authored first (strict `not.toBeUndefined` form)
- THEN it is RED; landing the fixture + `corpus.json` entry turns it GREEN at 6 fixtures/18
  cases, with every triple/transcript/byte value above pinned exactly

### Tasks
- [x] S-001.1 Author the REQ-CFX-15 fit-40 block RED-first (all 6 triples/transcripts above, plus the `existsSync(expected/src.txt)===true` assertion) against the absent `m2-copy` manifest.
- [x] S-001.2 Create `conformance/m2-copy/manifest.json` (6 cases per the table above, per-case `factory` overrides).
- [x] S-001.3 Create `conformance/m2-copy/factory.ts` per the export table above.
- [x] S-001.4 Create `conformance/m2-copy/seed/{src.txt,occupied.txt,adir/child.txt}` with the pinned bytes above.
- [x] S-001.5 Create `conformance/m2-copy/{expected,expected-force,expected-modify}/**` per the disk-state column above.
- [x] S-001.6 Modify `conformance/corpus.json` — `fixtures[] += "m2-copy"` (same slice, REQ-CCR-04).
- [x] S-001.7 `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` — GREEN at 6/18.
- [x] S-001.8 `bun run typecheck` over `factory.ts`.

**Delivered** (2026-07-22): branch `copy-copyin-fixtures-critical-path`, commit `52952a9`, PR
[#44](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/44) opened against
`main`, review/merge requested from Daniel (`Hyperxq`) — not merged by the executor. Same commit
as S-002 (REQ-CCR-04 atomicity).

---

## S-002: `copy` joins every representable-ops sync site, same commit as `m2-copy`

**Scope**: happy-path
**Dimension**: R (Rule)
**Covers**: REQ-CFX-17.1, REQ-CFX-03.1, REQ-CFX-02.1 (unaffected)
**Requires**: S-000
**Test layers**: architectural (fit-40) + review
**Priority**: protected critical path (see Executor Context) — MUST land in the literal same
commit as S-001 (see Branch & Commit Mechanics below)

Independent of S-001's fixture bytes (pure text edits) but MUST land in the same commit as
S-001 — REQ-CFX-17 forbids deferring the regex tighten to a later cleanup commit.

**Pinned before/after** (spec REQ-CFX-17, current `fit-40` source at `CLAUSE_KEYWORDS["(e)"]`):
- **Before**: `/modify\/delete\/rename\/move/` — a PREFIX regex that stays green whether or not
  `copy` is present (illusory enforcement, verified by reading the check).
- **After**: MUST positively require `copy`'s presence — e.g. `/move\/copy/` or an equivalent
  form that goes RED if `copy` is absent from the matched clause text. `copyIn` must NOT be
  required yet (that is S-004, branch-only).
- README step-1: the representable-ops sentence gains `copy` ONLY (no `copyIn`).
- Clause (e) text (`m2-create-composition/factory.ts`): gains `copy` ONLY, no branch-hold
  language of any kind (REQ-CFX-03 spec-internal clarification — the shipped comment states
  current fact, never roadmap).

**Acceptance**:
- GIVEN `fit-40`'s clause-(e) regex not yet requiring `copy`
- WHEN the regex is tightened FIRST to the "after" form above
- THEN it goes RED against the current (pre-widen) README/clause text; updating both text sites
  to add `copy` turns it GREEN — all three sync sites name `copy` in the same commit as `m2-copy`

### Tasks
- [x] S-002.1 Tighten `fit-40`'s `CLAUSE_KEYWORDS["(e)"]` from `/modify\/delete\/rename\/move/` to a form requiring `copy` (e.g. `/move\/copy/`) — confirm RED first.
- [x] S-002.2 Update `conformance/README.md` representable-ops sentence `+= copy` only.
- [x] S-002.3 Update `m2-create-composition/factory.ts` DO-NOT-COPY clause (e) text `+= copy` only — no `copyIn`, no branch-hold noise.
- [x] S-002.4 `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` — GREEN.
- [x] S-002.5 Review check: confirm all three sync sites land in the literal same commit as S-001 (REQ-CFX-17.1).

**Delivered** (2026-07-22): branch `copy-copyin-fixtures-critical-path`, commit `52952a9`
(literal same commit as S-001), PR
[#44](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/44) opened against
`main`, review/merge requested from Daniel (`Hyperxq`) — not merged by the executor. Regex
tightened to `/move\/copy/`; README + clause (e) text both gain `copy` only, no `copyIn`
mention.

---

## S-003: `m2-copyin` lands its full engine-plane contract on the held branch

**Scope**: happy-path
**Dimension**: D (Data)
**Covers**: REQ-CFX-16.1–.5, REQ-CFX-12.2, REQ-CFX-13, REQ-CCR-09.4
**Requires**: S-001, S-002
**Test layers**: architectural (fit-40)
**Priority**: banked arm — in-scope, required for delivery (see Executor Context); deferral is
an emergency valve requiring an explicit owner decision at build time, never a default

Structurally novel: introduces the package-local `assets/` source dir (ADR-0073). `assets/` is
raw source bytes the FACTORY's `copyIn(from, …)` call reads by path, resolved against
`packageDir` = the fixture's own directory — it is NOT copied into the destination workspace
pre-run, and it is NOT an `expected*` directory (a distinct fixture-subdir kind, alongside
`seed/`/`expected/`/`schematic/`). Branch-held — its `corpus.json` entry never lands on `main`
in this change (hard seam).

**Pinned assets/seed bytes**: `assets/payload.txt = "by-reference-payload"` (used by `positive`,
`collision-with-force`, `dest-dir-twin`); `assets/verbatim.txt = "Hello {= name =}!"` (a
REQ-FSC-05-shaped token, used only by `verbatim-content`); `seed/occupied.txt = "taken"`;
`seed/existing-dir/child.txt = "x"` (a pre-existing DIRECTORY at the path `dest-dir-twin` targets).

**Pinned factory exports** (design §4.4, imports `{ copyIn }`):

| Export | Call |
|---|---|
| `default` (positive) | `copyIn("assets/payload.txt","dst.txt")` |
| `verbatimContentProbe` | `copyIn("assets/verbatim.txt","dst2.txt")` |
| `collisionWithForceProbe` | `copyIn("assets/payload.txt","occupied.txt",{force:true})` |
| `collisionNoForceProbe` | `copyIn("assets/payload.txt","occupied.txt")` |
| `destDirProbe` | `copyIn("assets/payload.txt","existing-dir")` |

**Pinned outcome triples + transcripts** (REQ-CFX-16, REQ-CFX-12.2) — every case's
`writtenPaths: []`, INCLUDING `positive` whose destination is a genuinely NEW path (schematic
lowering never runs for `lowering:none` — path novelty is irrelevant):

| Case | exitCode | emitRejectionCode | failedIndex | expected/ disk state | transcript `callbacks` | `forbidDiscard` |
|---|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt="by-reference-payload"`; `occupied.txt`/`existing-dir/child.txt` unchanged | `[ir.emit, ir.commit]` | true |
| verbatim-content | 0 | null | null | `dst2.txt="Hello {= name =}!"` byte-identical to `assets/verbatim.txt`; BOTH must assert the literal `{= name =}` sequence PRESENT (token-presence, not equality alone — an unrelated-but-equal pair would otherwise pass) | `[ir.emit, ir.commit]` | true |
| collision-with-force | 0 | null | null | `occupied.txt="by-reference-payload"` (overwritten) | `[ir.emit, ir.commit]` | true |
| collision-no-force-twin | 2 | `"collision"` | 0 | `"zero-effect"` | `[ir.emit, ir.discard]` | false |
| dest-dir-twin | 2 | `"collision"` (**NOT** `"unrepresentable"` — owner-confirmed engine behaviour, item 5 of the un-hold checklist) | 0 | `"zero-effect"` | `[ir.emit, ir.discard]` | false |

**Assets↔expected byte-equality tie** (REQ-CFX-16.1, B1 defense-in-depth): assert
`assets/payload.txt` bytes === `expected/dst.txt` bytes directly, in addition to the REQ-CDT-06
determinism-loop coverage from S-000 — a stray byte in `assets/` must go RED locally.

**Acceptance**:
- GIVEN `m2-copyin`'s manifest/factory/assets/seed/expected* do not yet exist (on the branch)
- WHEN the REQ-CFX-16 fit-40 block above is authored first (strict `not.toBeUndefined` +
  byte-equality + token-presence assertions)
- THEN it is RED; landing the fixture + branch-local `corpus.json` entry turns it GREEN in
  ISOLATION at 7 fixtures/23 cases (REQ-CCR-09.4) — never merged to `main`

### Tasks
- [x] S-003.1 On the held branch: author the REQ-CFX-16 fit-40 block RED-first (all 5 triples/transcripts + the byte-equality + token-presence assertions above).
- [x] S-003.2 Create `conformance/m2-copyin/manifest.json` (5 cases per the table above).
- [x] S-003.3 Create `conformance/m2-copyin/factory.ts` per the export table above.
- [x] S-003.4 Create `conformance/m2-copyin/assets/{payload.txt,verbatim.txt}` with the pinned bytes above (ADR-0073).
- [x] S-003.5 Create `conformance/m2-copyin/seed/{occupied.txt,existing-dir/child.txt}` with the pinned bytes above.
- [x] S-003.6 Create `conformance/m2-copyin/{expected,expected-verbatim,expected-force}/**` per the disk-state column above.
- [x] S-003.7 Modify `conformance/corpus.json` on the BRANCH ONLY — `fixtures[] += "m2-copyin"`.
- [x] S-003.8 `bun test` on the branch worktree — GREEN in isolation at 7/23 (REQ-CCR-09.4); `bun run typecheck` over `factory.ts`.

**Delivered** (2026-07-22): branch `m2-copyin-banked-arm` (cut from post-merge `main` at
`6b68aaa`), commit `7a03b62`, draft PR
[#45](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/45) opened against
`main` — NOT merged, never to be merged within this change (ADR-0074 banked arm). Same commit as
S-004. RED confirmed first (5/5 REQ-CFX-16 assertions failed against the absent fixture, 54
pass/5 fail), then GREEN at 7 fixtures/23 cases (59/59) after authoring. Full suite 2146/2146
green (no regressions vs. main's 2135 baseline + this run's 11 new fit-40 assertions); `tsc
--noEmit` clean. `main` at HEAD verified unchanged — `corpus.json`, README, and clause (e) text
remain copyIn-silent.

---

## S-004: `copyIn` joins every representable-ops sync site, branch-only

**Scope**: happy-path
**Dimension**: R (Rule)
**Covers**: REQ-CFX-17.1 (extended), REQ-CFX-17.2, REQ-CCR-09.2
**Requires**: S-001, S-002
**Test layers**: architectural (fit-40) + review
**Priority**: banked arm — in-scope, required for delivery (see Executor Context); co-lands with
S-003 on the held branch; deferral is an emergency valve requiring an explicit owner decision at
build time, never a default

Mirrors S-002 for `copyIn`, staying entirely on the held branch — `main`'s three sync sites
MUST NOT mention `copyIn` until a future (out-of-this-change) un-hold commit.

**Pinned before/after**: branch's regex already requires `copy` (from S-002); tighten it FURTHER
to ALSO require `copyIn`'s presence (design/spec REQ-CFX-17). README step-2: representable-ops
sentence gains `copyIn` (branch only). Clause (e) text gains `copyIn` (branch only).

**Acceptance**:
- GIVEN the branch's `fit-40` regex already requiring `copy` (from S-002, carried onto the branch)
- WHEN it is further tightened to ALSO require `copyIn`
- THEN it goes RED until the branch's README + clause (e) text add `copyIn`; `main`'s copies of
  these three sites remain untouched, still `copyIn`-silent (REQ-CFX-17.2, REQ-CCR-09.2)

### Tasks
- [x] S-004.1 On the branch: tighten `fit-40`'s clause-(e) regex to ALSO require `copyIn` — confirm RED first.
- [x] S-004.2 Update the branch's `conformance/README.md` sentence `+= copyIn`.
- [x] S-004.3 Update the branch's `m2-create-composition/factory.ts` clause (e) text `+= copyIn`.
- [x] S-004.4 `bun test` on the branch worktree — GREEN.
- [x] S-004.5 Review check: confirm `main` at HEAD still shows none of the three sites mentioning `copyIn` (REQ-CFX-17.2/REQ-CCR-09.2).

**Delivered** (2026-07-22): branch `m2-copyin-banked-arm`, commit `7a03b62` (literal same commit
as S-003), draft PR
[#45](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/45) opened against
`main` — NOT merged, never to be merged within this change. Regex tightened to
`/move\/copy\/copyIn/`; RED confirmed first (REQ-CFX-03.1 failed: clause (e) missing, 58 pass/1
fail) against the still-`copyIn`-silent clause text; README + clause (e) text both widened `+=
copyIn`, turning it GREEN (59/59). `git show main:...` confirms all three sync sites on `main` at
HEAD remain exactly as landed by PR #44 — no `copyIn` mention anywhere, `corpus.json` still lists
6 fixtures.

---

## S-005: Engine-team SEAM record — `assets/` addendum to the HANDOFF doc

**Scope**: spike
**Dimension**: S (Spike)
**Covers**: ADR-0073 (N3)
**Requires**: S-003
**Test layers**: none (documentation only — not fit-40-checked)
**Priority**: banked arm — in-scope, required for delivery (see Executor Context); rides the
S-003/S-004 held-branch commit or a same-branch follow-on; deferral is an emergency valve
requiring an explicit owner decision at build time, never a default

Output is a memo, not code: no production code, no test coverage.

**Content summary to add** (cross-referencing ADR-0073): `assets/` is a NEW package-local
in-fixture source-directory convention — the engine's Go fixture loader treats unknown
files/dirs inside a fixture directory as INERT (owner-confirmed fact 3(c)), so an in-fixture
`assets/` source needs ZERO schema changes and is safe for the loader to encounter, same posture
as the existing `collection.json` marker note. Flag this explicitly for engine-team awareness.

**ADR-0074 Debt-Row Content (for `sdd-archive`)** — quoted VERBATIM from the signed spec
(`conformance-corpus` delta, REQ-CCR-09), not paraphrased:

Un-hold trigger (verbatim): "Engine `copyIn` wire-inclusion in flight" (owner-accepted un-hold
trigger, REQ-CCR-09).

Un-hold re-validation checklist (verbatim, 5 items):
1. Rebase and re-validate `m2-copyin`'s commit against the THEN-current `conformance/` schema
   and REQ set (schema/REQs may have changed while held).
2. `fit-40` green at the THEN-current manifest-derived checkpoint (REQ-CCR-05) — not
   necessarily the 7-fixture/23-case figure frozen at authoring time, which may itself have
   shifted if further fixtures landed while `m2-copyin` was held.
3. Add `copyIn` to ALL `conformance-fixtures` REQ-CFX-17 sync sites (the README sentence, the
   DO-NOT-COPY clause (e) text, AND its regex) IN the un-hold commit — cross-referenced
   explicitly here because an un-hold executor reading only this row, not REQ-CFX-17 itself,
   must not miss it.
4. Confirm the engine's `copyIn` wire-inclusion is ACTUALLY in flight (the un-hold trigger
   itself) before merging.
5. Re-verify the two owner-pinned-but-engine-unconfirmed rejection codes against ACTUAL engine
   behaviour before treating them as settled: `m2-copy`'s `missing-source-twin`
   (`"not-found"`) AND `m2-copyin`'s `dest-dir-twin` (`"collision"`) — both are owner-confirmed
   CODE-READING declarations (ruling 3 / its 2026-07-22 extension), not yet
   engine-harness-proven.

The debt row must ALSO carry the held branch's name and its draft PR URL (see Branch & Commit
Mechanics below).

**Acceptance**:
- GIVEN `m2-copyin`'s `assets/` convention lands in S-003
- WHEN `CONFORMANCE-CORPUS-HANDOFF.md` is read
- THEN it carries the addendum above, cross-referencing ADR-0073

### Tasks
- [x] S-005.1 Add the `assets/` addendum (content summary above) to `CONFORMANCE-CORPUS-HANDOFF.md`, cross-referencing ADR-0073.
- [x] S-005.2 Review check: confirm the addendum rides the SAME held-branch commit as S-003 (or a same-branch follow-on) — no bun-test assertion applies.

**Delivered** (2026-07-22): branch `m2-copyin-banked-arm`, same-branch follow-on commit
`d4f1ce2`, draft PR
[#45](https://github.com/Project-Builder-Schematics/project-builder-sdk/pull/45) opened against
`main` — NOT merged, never to be merged within this change. Extended the existing
"corpus-root ambiguity guard" note in `CONFORMANCE-CORPUS-HANDOFF.md` (the ~line-108
assets-adjacent inertness note) with the fixture-level `assets/` inertness fact, cross-referencing
ADR-0073 — no duplication, no contradiction with the pre-existing note. Documentation-only; no
bun-test gate applies. This completes ALL SIX slices (S-000 through S-005) of
`copy-copyin-conformance-fixtures` — critical path (S-000-S-002, merged on `main`) AND banked arm
(S-003-S-005, held on `m2-copyin-banked-arm`) are both delivered per the owner's all-six acceptance
bar.

---

## Branch & Commit Mechanics

**Workflow (owner-answered, 2026-07-22): PR per commit-group, never direct-to-main.** Sequencing:

1. **S-000 lands via its OWN prior PR** to `main` — merged and green at 5 fixtures/12 cases
   BEFORE `m2-copy` is authored. It is NEVER folded into the S-001+S-002 commit; it is its own,
   first-in-sequence PR/commit.
2. **S-001 + S-002 land via a second PR** to `main`. **"Same commit" is a LITERAL single
   commit** (REQ-CCR-04 atomicity) — concretely, the squash-merge commit this PR produces when
   it merges, not an "eventually consistent within the PR" convention. Wherever this artifact
   says S-001/S-002 (or S-003/S-004) "assemble into ONE commit", that commit IS the group's PR
   squash-merge result.
3. **The held branch is cut FROM `main` AFTER the S-001+S-002 PR merges** — its base therefore
   already includes `main`'s post-landing `corpus.json`, README, and clause-(e) state (6
   fixtures/18 cases, `copy` present at all three sync sites).
4. **S-003 + S-004 (and optionally S-005) commit on the held branch**, which is then **pushed to
   `origin`** (durability + discoverability, never local-only) and opened as a **DRAFT PR** —
   visible, durable, reviewable, unmerged. S-005 may ride that same commit or land as a
   same-branch follow-on. The un-hold trigger (checklist item 4 in S-005's debt-row content
   above) is what converts the draft to ready-for-review; it is never merged within this change.

**"Engine-pinnable" operationalized** (owner-answered): the engine's git submodule pins the
`main` commit's **SHA** directly — no tag, no version publish, no release action of any kind is
in scope for this change. In the Two done-definitions table above, "engine-pinnable" means
exactly: the merged `main` commit exists and its SHA is available for the engine to point its
submodule at.

**Held-branch durability**: pushed to `origin` (never local-only-held), plus the draft PR from
step 4 above. Branch name is executor-chosen at apply time and MUST be recorded verbatim —
together with the draft PR's URL — in the ADR-0074 debt row at archive (full required debt-row
content, quoted verbatim from the signed spec, is under S-005 above).

**TDD ordering note** (design §4.6, unchanged from rev 2): RED-first authoring (each fit-40
assertion block) happens in the WORKTREE, before the commit in question is finalized — every
commit that lands (S-000's own PR, S-001+S-002's PR, S-003+S-004's held-branch commit) is always
all-green, never a RED intermediate state.

**Merge authority & process** (owner-ruled, execution-environment fact): single-owner repo —
Daniel (GitHub `Hyperxq`) reviews and merges the two `main` PRs himself (the two serialization
points: post-S-000, post-S-001+S-002); existing repo CI checks must be green before either
merge; no external review latency. The executor's job at each serialization point is to OPEN
the PR and REQUEST Daniel's merge — never to merge it themselves.

**Remote/host & credentials**: GitHub, repo `Project-Builder-Schematics/project-builder-sdk`,
remote `origin`. The build environment's `gh` CLI is authenticated with push + PR-create
rights — branch pushes and draft-PR creation (step 4 above) are available to the executor
directly; no separate credential request is needed.

**Toolchain confirmed** (resolves the S-000.8 "or `tsc --noEmit`" hedge — read wherever it
appears as one confirmed command, not a choice between alternatives): `bun test` is the real
test runner, pinned in `openspec/config.yaml:19-20` (`test.framework: "bun test"`,
`test.command: "bun test"`); `tsc --noEmit` is the real typechecker, pinned in
`openspec/config.yaml:24-26` (`typecheck.tool: tsc`, `typecheck.command: "tsc --noEmit"`).
`package.json:65-66` confirms both as scripts — `"test": "bun test"`, `"typecheck": "tsc
--noEmit"` — so `bun run typecheck` IS `tsc --noEmit`, the same command via its script alias,
never an alternative tool.

## Executor Context Map

| Need | Where |
|---|---|
| Authoritative REQ text (Given/When/Then, all CFX/CCR IDs) | `openspec/changes/copy-copyin-conformance-fixtures/specs/{conformance-fixtures,conformance-corpus}/spec.md` (V2 signed) |
| Design contracts: File Changes §4.2, Flow Changes §4.2b, ADR-0073/0074/0075 (§4.5), Test Derivation §4.6, Fitness Functions §4.7 | `openspec/changes/copy-copyin-conformance-fixtures/design.md` (rev 3) |
| Template ground truth (per-case `factory` override pattern, ADR-0065) | `conformance/m2-rename-move/{manifest.json,factory.ts,seed/,expected/}` |
| Current fit-40 source (exact lines to rewrite: REQ-CCR-05 block, REQ-CDT-06 loop, REQ-CFX-05..09 block shape to mirror for REQ-CFX-15/16) | `test/fitness/fit-40-conformance-corpus-integrity.test.ts` |
| Corpus registry + sync sites | `conformance/corpus.json`, `conformance/README.md`, `conformance/m2-create-composition/factory.ts` (DO-NOT-COPY clause) |
| Engine-team SEAM doc | `CONFORMANCE-CORPUS-HANDOFF.md` (existing `assets`-adjacent inertness note at line ~108 — extend, don't duplicate) |
| Verb signatures (read-only confirmation) | `src/commons/index.ts` (`copy` :356, `copyIn` :286) |
| `listSubdirectories` helper (already generic — no support-file changes needed) | `test/support/conformance-fixture-loader.ts:92` |
| Honesty boundary framing (REQ-CFX-11) — every scenario is a DECLARATION, never a runtime-verb claim | `conformance/README.md` "Honesty boundary" section |

## Build Order

| Order | Slice | Depends on | Parallelizable |
|---|---|---|---|
| 1 | S-000 (skeleton) | — | no — implicit blocker |
| 2 | S-001 (happy-path, Data — critical path) | S-000 | yes, with S-002 |
| 2 | S-002 (happy-path, Rule — critical path) | S-000 | yes, with S-001 — MUST land in the same commit as S-001 |
| 3 | S-003 (happy-path, Data — banked arm) | S-001, S-002 | yes, with S-004 |
| 3 | S-004 (happy-path, Rule — banked arm) | S-001, S-002 | yes, with S-003 — MUST land in the same held-branch commit as S-003 |
| 4 | S-005 (spike — banked arm) | S-003 | no |

## Anti-Pattern Check

Pass — no anti-patterns detected:
- No horizontal/layer-named slices (each names a user-visible/engine-visible deliverable).
- No slice cross-cuts two SPIDR dimensions (Data slices carry fixture bytes; Rule slices carry
  sync-site enforcement — kept separate on purpose since they're independently buildable text
  edits, joined only by same-commit landing).
- Every slice cites ≥1 REQ-ID (S-005 cites the ADR the ID-less HANDOFF doc traces to).
- 6 total, 5 excluding skeleton — within the L target (4-7), not under- or over-decomposed.
- No slice depends on >2 others (max is 2: S-003/S-004 on S-001+S-002).
- The hard seam holds: S-000/S-001/S-002 never reference `m2-copyin`; S-003/S-004/S-005 never
  touch `main`'s `corpus.json`.

## Upstream Publication

`spec_source: internal` — Step 8b is a no-op; no Confluence/Jira artefacts are created for this
change.
