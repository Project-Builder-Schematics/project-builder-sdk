# Design: Copy/CopyIn Conformance Fixtures

**Change**: `copy-copyin-conformance-fixtures` · **Triage**: L · **Spec**: V2 (signed 2026-07-22) · **Persona lens**: none
**Architecture impact**: additive

**Rev 2 (architect review, 2026-07-22)**: B1 — the byte-determinism guard now covers `assets/**` (a
verbatim byte-source the engine copies then byte-compares) alongside `expected*`, plus a direct
`assets/payload.txt == expected/dst.txt` byte-equality assertion in the REQ-CFX-16 block. N1 — ADR-0074
gains the pin-safe-first rejected alternative. N2 — ADR-0073's SEAM-reconciliation citation corrected to
REQ-CCR-09 item 4 (pin-advance harness), not item 5. N3 — an engine-team-visible
`CONFORMANCE-CORPUS-HANDOFF.md` addendum documents `assets/` as a tolerated layout kind. N4 — the
determinism-loop generalization is pinned to a readdir glob form, never an enumerated literal. No scope,
case-set, or `architecture_impact` change.

## 4.1 Architecture Overview

Two new declarative fixtures land in the root `conformance/` corpus layer (ADRs 0063-0067), each a
template-clone of the established `class: wire-mutation` + per-case `factory` override pattern
(`m2-rename-move`, ADR-0065). `m2-copy` (6 cases) is a pure clone — same seed, same manifest shape,
new outcome triples. `m2-copyin` (5 cases) is structurally novel: it introduces a **package-local
in-fixture source directory** (`assets/`) whose bytes `copyIn` references by-value-free, resolved
against the fixture's own `packageDir`; the engine's Go loader treats it as inert (owner-confirmed,
ruling 3c) — a [SEAM] flagged for engine-team awareness, needing zero schema keys under the strict
`DisallowUnknownFields` decoder.

`fit-40` (the corpus's structural self-check, ADR-0066) gains two hand-authored behavioral-contract
blocks (REQ-CFX-15/16, mirroring REQ-CFX-05..09), has its dead hardcoded checkpoint gates replaced
by a manifest-derived count (row 502 discharge), and has its clause-(e) prefix regex tightened per
landing step. The change refuses to cross into `src/**` (verb contracts read-only) or the engine
repo. The single architectural seam is the `assets/` convention (ADR-0073).

The two fixtures land on **different schedules** (REQ-CCR-09): `m2-copy` merges to `main` (green at
6 fixtures / 18 cases); `m2-copyin` is fully authored but its commit stays branch-held (green in
isolation at 7 / 23) until the engine's `copyIn` wire-inclusion is in flight. REQ-CCR-04
commit-atomicity holds at EACH step.

## 4.2 File Changes (per-commit manifest — the contract with sdd-slice)

Commit 1 = `m2-copy` → `main`. Commit 2 = `m2-copyin` → branch-held (unmerged).

| Path | Commit | Action | Purpose |
|---|---|---|---|
| `conformance/m2-copy/manifest.json` | 1 | Create | 6 cases, per-case `factory` overrides, outcome triples per REQ-CFX-15 |
| `conformance/m2-copy/factory.ts` | 1 | Create | default `positive` + 5 named probe exports (see 4.4) |
| `conformance/m2-copy/seed/{src.txt,occupied.txt,adir/child.txt}` | 1 | Create | `"payload"` / `"taken"` / `"x"` (mirrors `m2-rename-move` seed) |
| `conformance/m2-copy/{expected,expected-force,expected-modify}/**` | 1 | Create | three distinct exit-0 disk states (4.3); `zero-effect` twins need none |
| `conformance/corpus.json` | 1 | Modify | `fixtures[] += "m2-copy"` (same commit, REQ-CCR-04) |
| `conformance/README.md` | 1 | Modify | representable-ops sentence `+= copy` (sync site a) |
| `conformance/m2-create-composition/factory.ts` | 1 | Modify | DO-NOT-COPY clause (e) text `+= copy` (sync site b) — no `copyIn`, no branch-hold noise (REQ-CFX-03) |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | 1 | Modify | delete dead `!==1`/`!==5` gates → manifest-derived count (REQ-CCR-05.1/.5); add REQ-CFX-15 block; tighten clause-(e) regex `+= copy` (sync site c); generalize REQ-CDT-06 determinism loop to the **UNION of two legs** — `[...listSubdirectories(f.dir).filter(s => s.startsWith("expected") \|\| s === "assets"), (f.manifest.lowering.schematicRoot ?? "schematic") + "/files"]`, each guarded by `existsSync` — the readdir-glob leg covers multi-positive `expected*` dirs + `m2-copyin/assets/` (B1/N4, never an enumerated literal), and the **retained `schematic/files` leg** keeps the ONLY determinism guard for `m1-vehicle`/`m2-create-composition`'s lowered templates (B2 — the pure-filter form dropped it silently-vacuous; do NOT add `s === "schematic"` — that recurses into the legitimately-varying `schema.json`) |
| `conformance/m2-copyin/manifest.json` | 2 | Create | 5 engine-plane cases per REQ-CFX-16 |
| `conformance/m2-copyin/factory.ts` | 2 | Create | default `positive` + 4 named probe exports (see 4.4) |
| `conformance/m2-copyin/assets/{payload.txt,verbatim.txt}` | 2 | Create | package-local source (`"by-reference-payload"` / `"Hello {= name =}!"`) — ADR-0073 |
| `conformance/m2-copyin/seed/{occupied.txt,existing-dir/child.txt}` | 2 | Create | `"taken"` / `"x"` — collision + dest-dir destinations |
| `conformance/m2-copyin/{expected,expected-verbatim,expected-force}/**` | 2 | Create | three exit-0 disk states (4.3) |
| `conformance/corpus.json` | 2 | Modify | `fixtures[] += "m2-copyin"` (branch only, REQ-CCR-04) |
| `conformance/README.md` | 2 | Modify | representable-ops sentence `+= copyIn` (sync site a, branch only) |
| `conformance/m2-create-composition/factory.ts` | 2 | Modify | clause (e) text `+= copyIn` (sync site b, branch only) |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | 2 | Modify | add REQ-CFX-16 block (incl. **`assets/payload.txt` bytes === `expected/dst.txt` bytes** byte-equality, B1 defense-in-depth mirroring the verbatim guard); tighten clause-(e) regex `+= copyIn` (sync site c, branch only) |
| `CONFORMANCE-CORPUS-HANDOFF.md` | 2 | Modify | addendum documenting `assets/` as a new TOLERATED on-disk fixture-layout kind (engine loader treats unknown in-fixture dirs as inert, owner fact 3c) — the engine-team-visible SEAM record; rides the un-hold commit where `assets/` first lands, so the note appears exactly when the engine advances the pin past it (N3) |
| `openspec/decisions/007{3,4,5}-*.md` | archive | Create | ADR-0073/0074/0075 promoted from §4.5 |
| `src/commons/index.ts` (`copy` :356, `copyIn` :286) | — | Read-only | confirm verb signatures unchanged |
| `conformance/m2-rename-move/**` | — | Read-only | structural template |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author calls `copy()`/`copyIn()` → SDK buffers wire directive → engine (separate repo) drives real Go runner against this corpus | Modify | REQ-CFX-15/16, REQ-CFX-12/13 | none in-repo — **REQ-CFX-11 honesty boundary** | This repo ships DECLARATIONS only; there is NO runner-driven path here by construction. The real E2E is the engine's Go harness at submodule pin-advance (cross-repo). In-repo verification is structural (`fit-40`). |

The "≥1 e2e row per Modify flow" rule is deliberately not met: REQ-CFX-11 forbids an in-repo
runtime-proving path (see 4.6 note). This is a spec-level constraint, not a design gap.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `conformance/` corpus layer | extend | 2 new fixture dirs + `corpus.json` entries | aligns (ADR-0063 layer exists for exactly this) |
| `conformance/` fixture structure | new | `m2-copyin/assets/` package-local source dir — a fixture subdir kind the baseline does not list (seed/expected/schematic only) | aligns (within-layer declarative data; convention formalized by ADR-0073) |
| `test/fitness/fit-40-*.test.ts` | modify | new REQ-CFX-15/16 blocks; derived-count rewrite; clause-(e) regex + REQ-CDT-06 loop tightened | aligns (fit-40 is the corpus's designed extension point) |
| `conformance/README.md`, `m2-create-composition/factory.ts` | modify | representable-ops sync sites (a)(b) | aligns |
| `src/commons/**` (verb contracts) | — | read-only confirmation, no change | aligns |

No `deviates` rows. `assets/` is `new` structure joining the EXISTING `conformance/` layer → `aligns`
per 4.2c's new-in-existing-layer rule; its convention still earns ADR-0073 as a substantive decision.

## 4.3 Data Model

No schema keys added (strict decoder honored). Manifest reuses the frozen shape
(`{id, wireSpecVersion:1, class:"wire-mutation", factory, input:{}, lowering:{mode:"none"}, cases[]}`).
Multi-positive fixtures are the first to need **multiple `expected` directories** (one exit-0 case =
one disk state); the `cases[].expected` field already accepts any POSIX-relative dir name.

`m2-copy` exit-0 disk states (source ALWAYS retained — the copy invariant): `expected/` = `src.txt="payload"`,
`dst.txt="payload"`, `occupied.txt="taken"`, `adir/child.txt="x"`; `expected-force/` = `src.txt="payload"`,
`occupied.txt="payload"`, `adir/child.txt="x"`; `expected-modify/` = `src.txt="payload"`, `dst2.txt="final"`,
`occupied.txt="taken"`, `adir/child.txt="x"`. All three `(2,…)` twins → `expected:"zero-effect"`.

`m2-copyin` exit-0 disk states: `expected/` = `dst.txt="by-reference-payload"`, `occupied.txt="taken"`,
`existing-dir/child.txt="x"`; `expected-verbatim/` = `dst2.txt="Hello {= name =}!"` (token verbatim, unrendered),
`occupied.txt="taken"`, `existing-dir/child.txt="x"`; `expected-force/` = `occupied.txt="by-reference-payload"`,
`existing-dir/child.txt="x"`. Both `(2,"collision",…)` twins → `"zero-effect"`. All files (seed, `assets/`, every `expected*/`) are
LF-only, no BOM, no trailing newline. `assets/payload.txt` is a **verbatim byte-source the engine copies
then byte-compares** against `expected/dst.txt`, so the two MUST be byte-identical (`"by-reference-payload"`,
no stray `\n`) — the determinism loop (§4.7) and a direct fit-40 byte-equality assertion (§4.6 REQ-CFX-16.1)
both guard this. Every exit-0 case pins `outcome.writtenPaths: []` (REQ-CFX-12 — no schematic lowering).

## 4.4 Interface Contracts

No external interface changes. Fixture factory exports (probe naming = README `<behaviour>Probe` convention,
verified against `m2-rename-move`):

- `m2-copy/factory.ts`, imports `{ copy, replaceContent }`: `default`(positive) `copy("src.txt","dst.txt")`;
  `collisionWithForceProbe` `copy("src.txt","occupied.txt",{force:true})`; `collisionNoForceProbe`
  `copy("src.txt","occupied.txt")`; `missingSourceProbe` `copy("missing.txt","dst.txt")`; `dirSourceProbe`
  `copy("adir","bdir")`; `copyThenModifyProbe` `copy("src.txt","dst2.txt"); replaceContent("dst2.txt","final")` (ONE batch).
- `m2-copyin/factory.ts`, imports `{ copyIn }`: `default`(positive) `copyIn("assets/payload.txt","dst.txt")`;
  `verbatimContentProbe` `copyIn("assets/verbatim.txt","dst2.txt")`; `collisionWithForceProbe`
  `copyIn("assets/payload.txt","occupied.txt",{force:true})`; `collisionNoForceProbe`
  `copyIn("assets/payload.txt","occupied.txt")`; `destDirProbe` `copyIn("assets/payload.txt","existing-dir")`.

## 4.5 Architecture Decisions

### ADR-01 (→ promoted 0073): `assets/` — Package-Local In-Fixture Source Directory for `copyIn`

**Status**: Proposed. **Context**: `copyIn` copies bytes that live inside the fixture package; the
corpus loader documents only `seed/`/`expected/`/`schematic/` subdirs and the strict decoder forbids a
new manifest key. The source bytes need a home resolved against the fixture's `packageDir`.
**Decision**: place them in a package-local `assets/` directory (no manifest key, referenced as a
relative path in the factory's `copyIn(from,…)` call). The Go loader treats unknown in-fixture
files/dirs as inert (owner-confirmed 3c) — a [SEAM] recorded for engine-team awareness, same posture as
`collection.json` (ADR-0067). **Consequences**: (+) zero schema change, strict decoder honored, umbrella
boundary (REQ-CFX-01) intact; (−) a NEW fixture-subdir convention future fixtures must learn; (−)
loader-inertness is engine-authoritative — its actual proof is the engine harness run at pin-advance,
gated by REQ-CCR-09 item **4** (item 5 covers the two owner-pinned rejection codes, not `assets/`
inertness), and surfaced to the engine team via the `CONFORMANCE-CORPUS-HANDOFF.md` addendum (N3).
**Alternatives**:
new manifest `source` key — rejected (breaks `DisallowUnknownFields`); reuse `seed/` — rejected (`seed/`
is the destination tree's pre-state, wrong resolution root); corpus-root file — rejected (pollutes the
`collection.json` package-anchor surface).

### ADR-02 (→ promoted 0074): Authored-But-Held Branch Landing as a Distinct Debt Type

**Status**: Proposed. **Context**: `m2-copy` must land on `main` to unblock the engine milestone, but a
`m2-copyin` positive on `main` ratchets the engine's submodule pin before `copyIn` is wire-included.
**Decision**: author `m2-copyin` fully in THIS change but hold its commit on an unmerged branch;
register it at archive as an **authored-but-held debt row** (distinct from a normal followup) carrying
branch name, un-hold trigger, and the REQ-CCR-09 5-item re-validation checklist. **Consequences**: (+)
`m2-copy` critical path is never hostage to `copyIn` timing; (+) "fully authored" is testable
(REQ-CCR-09.4, green in isolation at 7/23); (−) archive closes with half the scope branch-held —
honesty burden on the debt row; (−) first instance of a recurring cross-repo pattern (issue #42).
**Alternatives**: `m2-copyin` as its own change (PM preference) — rejected by owner (SDK authoring is
engine-independent; bundle keeps the pair coherent); land on `main` + roll the pin back on-demand —
rejected (pin-ratchet is one-way in practice); land `m2-copyin` with pin-safe cases FIRST and add the
engine-plane cases later — rejected: the only pin-safe cases are the descoped, non-gating SDK-plane twins
(`(1,null,null,[])`), so a pin-safe-first fixture would be an empty placeholder declaring green while
proving nothing about `copyIn` landing bytes (QA finding).

### ADR-03 (→ promoted 0075): Manifest-Derived Fitness Counts (amends ADR-0066)

**Status**: Proposed. **Context**: `fit-40`'s checkpoint gates hardcode `corpus.fixtures.length ===1`/
`===5`; adding fixtures makes both silently vacuous (dead code that can never go RED) — pending-changes
row 502. **Decision**: replace the hardcoded gates with a count DERIVED from `corpus.json#fixtures` at
check time (loaded-set equals declared-list + case-sum from manifests), and DELETE the dead early-return
guards (REQ-CCR-05.5). **Consequences**: (+) green at every checkpoint (6/18 on main, 7/23 on branch)
with no literal edit; (+) discharges row 502; (−) the derived sum is self-referential (an
orphan/consistency guard, NOT a behavioral guard — the REQ-CFX-15/16 blocks are load-bearing).
**Alternatives**: add a literal 3rd checkpoint (`===7`) — rejected (re-introduces the vacuous-on-next-
fixture problem); keep gates, add derived alongside — rejected (REQ-CCR-05.5 forbids leaving dead code).

## 4.6 Test Derivation

Level `architectural` = a `fit-40` structural assertion (no runner spawn, REQ-CFX-11). Level `review` =
a PR-gate / commit-sequencing / archive check `fit-40` structurally cannot make (it reads only the
current worktree, never git history). No `e2e`/`integration` rows exist by design — REQ-CFX-11 forbids
an in-repo runtime path; the engine Go harness at pin-advance is the (cross-repo) runtime oracle.

| REQ-ID | Scenario | Level | Test / check | RED-first condition |
|---|---|---|---|---|
| REQ-CFX-15.1 | positive: exact-bytes copy, **source intact** | architectural | fit-40 REQ-CFX-15 block: `outcome/transcript.toEqual`, `expected/dst.txt`="payload", **`existsSync(expected/src.txt)===true`** (inverse of rename fit-40:516 — most mutation-resistant) | block authored against absent/stub `m2-copy` manifest → RED |
| REQ-CFX-15.2 | collision-with-force overwrites, exit 0 | architectural | fit-40: `expected-force/occupied.txt`="payload", `src.txt` unchanged | wrong triple/bytes → RED |
| REQ-CFX-15.3 | collision-no-force twin `(2,collision,0)` | architectural | fit-40: exact `toEqual` triple + `"zero-effect"` | " |
| REQ-CFX-15.4 | missing-source twin `(2,not-found,0)` | architectural | fit-40: exact triple | " |
| REQ-CFX-15.5 | dir-source twin `(2,unrepresentable,null)` | architectural | fit-40: exact triple | " |
| REQ-CFX-15.6 | copy-then-modify collapses to modify bytes | architectural | fit-40: `expected-modify/dst2.txt`="final"; transcript `[ir.emit,ir.commit]` once | " |
| REQ-CFX-16.1 | copyIn positive, new-path dest, `writtenPaths:[]` | architectural | fit-40 REQ-CFX-16 block (branch): `expected/dst.txt`="by-reference-payload", triple, AND **`assets/payload.txt` bytes === `expected/dst.txt` bytes** (B1 — ties the verbatim byte-source to the declared output; a stray `\n` in `assets/` → RED locally, not silently at pin-advance) | block authored against absent `m2-copyin` → RED |
| REQ-CFX-16.2 | verbatim: token present, unrendered, BOTH sides | architectural | fit-40: `expected-verbatim/dst2.txt`===`assets/verbatim.txt` bytes AND both `.includes("{= name =}")` (anti-tautology) | missing/rendered token → RED |
| REQ-CFX-16.3 | collision-with-force exit 0 | architectural | fit-40: `expected-force/occupied.txt`="by-reference-payload" | " |
| REQ-CFX-16.4 | collision-no-force twin `(2,collision,0)` | architectural | fit-40: exact triple | " |
| REQ-CFX-16.5 | dest-dir twin `(2,collision,0)` — NOT unrepresentable | architectural | fit-40: exact triple, code=`collision` | " |
| REQ-CFX-17.1 | `copy` in all 3 sync sites in m2-copy's commit | architectural + review | fit-40 REQ-CFX-03.1 tightened (e) regex requires `copy`; README + clause text by PR review | regex un-tightened stays green w/o copy → RED after tighten |
| REQ-CFX-17.2 | `copyIn` absent from sync sites while held | review | commit-sequencing ONLY — no fit-40 guard (by spec) | n/a (sequencing) |
| REQ-CFX-02.1 | exactly one wire `create` corpus-wide | architectural | fit-40 REQ-CFX-02 block (manifest-derived scan) | 2nd create anywhere → RED |
| REQ-CFX-03.1 | DO-NOT-COPY 5 clauses, (e)=current set | architectural | fit-40 REQ-CFX-03.1 CLAUSE_KEYWORDS, (e) tightened per step | clause (e) stale → RED |
| REQ-CFX-12.1 | schematic-lowered pins its path | architectural | fit-40 REQ-CFX-05.1 (m1-vehicle `["out.txt"]`, existing) | pre-covered |
| REQ-CFX-12.2 | wire-mutation/by-ref exit-0 → `[]` regardless of novelty | architectural | fit-40 REQ-CFX-15/16 blocks assert `writtenPaths:[]` incl. copyIn positive new path | non-empty → RED |
| REQ-CFX-13.1 | positive transcript single-emit-commit | architectural | fit-40 REQ-CFX-15/16 exact transcript rows | wrong callbacks → RED |
| REQ-CFX-13.2 | directive twin ends in discard | architectural | fit-40: twin transcript `[ir.emit,ir.discard]`, `forbidDiscard:false` | " |
| REQ-CFX-13.3 | batch twin discards identically | architectural | fit-40: dir-source-twin `failedIndex:null` transcript | " |
| REQ-CFX-13.4 | reject twin discards (both resolutions) | architectural | fit-40 REQ-CFX-09.2 (existing) | pre-covered |
| REQ-CFX-13.5 | 2-directive batch = single flush | architectural | fit-40 REQ-CFX-15: copy-then-modify `[ir.emit,ir.commit]` once | doubled emit → RED |
| REQ-CCR-09.1 | m2-copy PR references no m2-copyin artefact | review | PR diff / import scan | n/a (review) |
| REQ-CCR-09.2 | m2-copyin unmerged, main corpus.json unchanged | review | commit-sequencing | n/a |
| REQ-CCR-09.3 | archive registers authored-but-held debt + checklist | review | sdd-archive → pending-changes | n/a |
| REQ-CCR-09.4 | held branch green in isolation at 7/23 | architectural | fit-40 full suite on branch worktree (derived count + REQ-CFX-16) | incomplete fixture → RED |
| REQ-CCR-05.1 | derived case-count, no hardcoded absolute | architectural | fit-40 rewritten check: loaded-set===declared-list + case-sum | hardcoded literal remains → REQ-CCR-05.5 fail |
| REQ-CCR-05.2 | no orphan directory | architectural | fit-40 REQ-CCR-05.2 (existing `checkOrphanDirectories`) | orphan dir → RED |
| REQ-CCR-05.3 | each checkpoint vs its own count | architectural | inherent in derivation (no cross-checkpoint literal) | — |
| REQ-CCR-05.4 | fixture count never decreases | review | PR-gate git-log scan (cadence note — not bun-test) | n/a |
| REQ-CCR-05.5 | no dead hardcoded gates remain | architectural + review | commit-1 diff deletes `!==1`/`!==5`; derived check has no length literal | gate left in → review RED |

## 4.7 Fitness Functions

- **Manifest-derived inventory** (ADR-03): counts DERIVED from `corpus.json#fixtures`, never a literal;
  no dead early-return gate — enforced in `fit-40` REQ-CCR-05.1.
- **Clause-(e) regex tightened per landing step** (REQ-CFX-17): `fit-40` clause-(e) keyword must
  positively match the current representable set (`+copy` commit 1, `+copyIn` commit 2) — a widened
  prose clause without the regex tighten does NOT satisfy the REQ.
- **Byte-determinism generalized to a two-leg UNION** (B1 + N4 + B2): the REQ-CDT-06 loop iterates
  `[...listSubdirectories(f.dir).filter(s => s.startsWith("expected") || s === "assets"), (f.manifest.lowering.schematicRoot ?? "schematic") + "/files"]`,
  each leg guarded by `existsSync`. Leg 1 (readdir glob) is NEVER an enumerated literal
  (`["expected","expected-force",…]`) — that would silently miss the next fixture's new dir and reintroduce
  the vacuous-guard class this change exists to close; covering `assets/` guards the verbatim byte-source
  (`assets/payload.txt`) the engine copies and byte-compares (B1 — `"by-reference-payload\n"` would ship
  green locally and fail engine-side). Leg 2 is the **RETAINED `schematic/files` leg** — the ONLY
  determinism guard for `m1-vehicle`/`m2-create-composition`'s lowered templates
  (`schematic/files/out.txt`, `.../generated.txt`); the B1/N4 rewrite must PRESERVE it, not replace the
  original iteration set (B2). Do NOT add `s === "schematic"` to leg 1 — that recurses into the
  legitimately-varying `schema.json`; only `schematic/files/**` is byte-pinned.
- **`assets/` byte-source pinned to its declared output**: fit-40 REQ-CFX-16.1 asserts
  `assets/payload.txt` bytes === `expected/dst.txt` bytes (defense in depth beyond the determinism loop).

## 4.8 Migration / Rollout

No migration. Fixtures are additive declarative data outside `src/`, `package.json#files`/`#exports`
(never built, never shipped). Rollback = `git revert` the fixture commit (corpus.json entry rides the
same commit, REQ-CCR-04 — no dangling pointer). Landing ORDER is load-bearing: `m2-copy` merges first
(engine pins it); `m2-copyin` stays branch-held until engine `copyIn` wire-inclusion is in flight.

## 4.9 Performance Considerations

No significant impact. `fit-40` gains two describe blocks and a generalized subdir walk over a handful of
small files; parse/filesystem cost is negligible.

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: The dominant change is the `new` `assets/` in-fixture source-dir convention joining the
EXISTING `conformance/` layer (4.2c row 2, `aligns`; ADR-0073) — the baseline GAINS a fixture-subdir
kind, nothing in it becomes wrong. All other touchpoints are `extend`/`modify`-of-test `aligns` rows.
ADR-03's derived-count rewrite is an intra-`fit-40` evolution, not a shift of any documented
architectural boundary/layer/dependency-direction, so it does not push impact to `modifying`. Drives
`arch_refresh_post_verify` (additive → prompt to record the `assets/` convention in the baseline).

## 4.11 Open Questions

None.
