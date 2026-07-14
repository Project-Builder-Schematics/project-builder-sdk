# Exploration: honest write-verb rename — replaceContent / modify(fn) (author-write-surface)

**Triage**: L
**Persona lens**: none (orchestrator-run exploration)

## Cross-Change Lessons Consulted

- Pattern `#2086` (`stage-6-release-shape`/`author-emulation-e2e-scaffold`): reserve fitness-guard numbers at plan time for concurrent changes — relevant if this change adds a new FIT-04 baseline pair (see Open Questions).
- Discovery `#2101` (in-flight explore, `ts-dialect-backend-ops` Group 1): a concurrent change is adding 7 import/export ops to `src/dialects/typescript/ops.ts`/`index.ts` and touches `./conformance` — same files this change edits. No API-rename-specific lesson found; nothing under `type: pattern|discovery` matched "rename"/"modify"/"raw" keywords directly.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Dialect wholesale text replace via `.modify(content)` | `test/e2e/dialect-modify.e2e.test.ts` | Modify — verb becomes `.replaceContent(content)` |
| Dialect AST escape hatch via `.raw(fn)` | `test/e2e/dialect-modify.e2e.test.ts`, `test/e2e/toy-dialect-skeleton.e2e.test.ts` | Modify — verb becomes `.modify(fn)` |
| Commons top-level wholesale replace via `modify(path, content)` | `test/e2e/author-to-tree.e2e.test.ts` | Modify — renamed to `replaceContent(path, content)` |

## Current State

Two independent write surfaces both use the name `modify` today: (1) commons (`src/commons/index.ts`, `src/core/base-handle.ts` `WriteOps`) — `modify(content)` does wholesale text replacement, inherited by `FoundHandle`/`WritableHandle`; (2) the dialect `Handle` (`src/core/define-dialect.ts`) — `modify(content)` (same wholesale semantics) plus `.raw(fn: (ast) => void)`, the universal AST escape hatch. `RESERVED_HANDLE_NAMES` (`define-dialect.ts:124`) reserves `raw`/`modify` today; verified collision-free for a swap — no shipped op (`addImport`/`addFunction`/`addVariable`/`addClass`/`removeImport`) is named `raw` or `replaceContent`.

ADR-0039 (`runModify` in `dialect-handle.ts:307`) rejects `.modify(content)` while an AST-op directive is pending — this **already resolved** `pending-changes.md` row-136 ("last-write-wins", stage-5-first-dialect followup) in favor of reject, at stage-5b. The row is stale text, not a live decision; this change only renames the guarded verb (`runModify`→`runReplaceContent`), it does not re-litigate reject-vs-document.

`./conformance`'s `ConformanceCase.chain` (`src/conformance/index.ts:61,146`) types a chain step as `{op, args} | {raw: (ast) => void}` and dispatches `handle.raw(step.raw)` — this published type must migrate in lockstep with the rename (triage-flagged gap, confirmed real).

`docs/authoring-a-dialect.md` and `test/core/define-dialect-collision.test.ts:103` (`RESERVED_HANDLE_NAMES` iteration) are the doc/test precedents needing updates.

**FIT-04 verified live** (built `dist/`, diffed `.d.ts` output): of the 9 gated baseline pairs, `typescript.index.d.ts` does **not** inline `Handle`'s shape — it only imports the type (`import { type Handle } from "../../core/define-dialect.ts"`) and instantiates it generically; the same is true wherever `Handle` is consumed. The actual `Handle`/`DialectWriteOps` shape (where `raw`/`modify` literally appear) lives only in `dist/core/define-dialect.d.ts` — **not one of FIT-04's 9 baseline pairs**. `commons.index.d.ts` and `core.base-handle.d.ts` DO churn (literal `modify(...)` lines). `core.handle-state.d.ts` does NOT churn (its JSDoc `@example` mentions are comments, stripped by `normalizeDeclarations`; the interface bodies only `extends`).

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/base-handle.ts` (`WriteOps`) | modify | `modify(content)`→`replaceContent(content)` | aligns |
| `commons/index.ts` (3 call sites + top-level verb) | modify | rename propagates to `buildWritableHandle`/`buildFoundHandle`/`modify()` | aligns |
| `core/define-dialect.ts` (`Handle` type, `DialectWriteOps`, `RESERVED_HANDLE_NAMES`) | modify | `Handle` is the one type `architecture.md` calls FROZEN; `raw` removed, `modify` polymorphism added | **deviates** — frozen-type change, ADR required (triage already flags this) |
| `core/dialect-handle.ts` (`runModify`/`runRaw`, base dispatchers) | modify | `runModify`→`runReplaceContent` (keeps ADR-0039 guard); `runRaw` becomes the new `runModify` (AST fn) | aligns — kit-internal, executor latitude per architecture.md |
| `conformance/index.ts` (`ConformanceCase.chain`, dispatch) | modify | published `{raw}` chain-step shape migrates | **deviates** — published contract shape change, needs its own FIT-04 pair review |
| `test/fitness/dts-baseline/*` (FIT-04, 9 pairs) + possible new `core.define-dialect.d.ts` pair | modify/new | 9 existing pairs regen; `core/define-dialect.d.ts` is currently ungated and is the ONLY file whose text shows `Handle`'s real shape | **deviates** — gap in existing fitness coverage, not just a snapshot refresh |
| `openspec/decisions/0039-*.md` | modify | guard target renamed; ADR text names `.modify()`/`runModify` verbatim throughout | aligns — amendment-in-place is the established pattern (ADR-0037/0012 precedent) |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/base-handle.ts` | Modify | `WriteOps.modify`→`replaceContent` |
| `src/core/handle-state.ts` | Read-only | inherits via `extends`; confirmed no textual `.d.ts` churn |
| `src/commons/index.ts` | Modify | 3 call sites (`buildWritableHandle`, `buildFoundHandle`, top-level `modify()`) + JSDoc |
| `src/core/define-dialect.ts` | Modify | `Handle` type, `DialectWriteOps`, `RESERVED_HANDLE_NAMES` swap |
| `src/core/dialect-handle.ts` | Modify | `runModify`→`runReplaceContent`, `runRaw`→ new `runModify`, base object dispatchers, JSDoc |
| `src/dialects/typescript/index.ts` | Modify | JSDoc `.raw()` mention; candidate host for importable `modify(handle, fn)` (open question) |
| `src/dialects/typescript/ops.ts` | Modify | one JSDoc reference to `.raw()` (collision error text, line 73) |
| `src/conformance/index.ts` | Modify | `chain` union type + dispatch line, planted-fixture impact |
| `test/core/dialect-handle.test.ts` | Modify | 13 `.modify(` + 12 `.raw(` call sites |
| `test/core/define-dialect-collision.test.ts` | Modify | reserved-verb array swap |
| `test/types/define-dialect.test.ts` | Modify | `.raw` presence pin → `replaceContent`/`modify(fn)` pins |
| ~18 more files (`test/dialects/typescript/{coalescing,dialect,ops-declarations*,print-failure}.test.ts`, `test/e2e/{dialect-modify,toy-dialect-skeleton}.e2e.test.ts`, `test/conformance/planted/*`, `test/skeleton/handle-chaining.test.ts`, `test/golden-ir/*`, `test/dry-run/plan.test.ts`, `test/docs/security-authoring-guard.test.ts`, `test/fixtures/red/dialect-generics/async-op-rejects.ts`, `test/fitness/fit-19/fit-20*.ts`, `docs/authoring-a-dialect.md`, `docs/authoring-verbs.md`, `SECURITY.md`, `ROADMAP.md`) | Modify | enumerated via `rg` for `.modify(`/`.raw(`; full list exceeds table budget, grep commands in this artefact's session are reproducible |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution) | `src/dialects/typescript/**`, `src/core/dialect-handle.ts` (`.raw`→`.modify(fn)` redesign) | Yes |
| public-api (contract) | `package.json#exports` (`./typescript`, `./conformance` `.d.ts`), FIT-04 baselines | Yes |

No new sensitive-area touch found beyond what triage already flagged.

## Approaches

### 1. Mechanical clean-break rename following existing kit-internal-amendment pattern
**Description**: Rename call sites per the ratified decision (#2109) and re-cut scope; treat the `Handle` type change as its own explicit ADR (not folded into ADR-0039, which governs rejection semantics, not naming); amend ADR-0039's prose in place (the repo's established pattern for renamed/superseded mechanisms — see ADR-0037/ADR-0012 amendments). Add a new FIT-04 baseline pair for `core/define-dialect.d.ts` so the actual breaking change is gated, not just the 9 pre-existing pairs.
**Pros**: Matches every existing precedent in this repo (in-place ADR amendments, `RESERVED_HANDLE_NAMES` swap pattern, `.d.ts` baseline regen ritual); closes a real, verified fitness-coverage gap instead of shipping it silently.
**Cons**: Widens this change's touch on `test/fitness/` beyond what triage assumed ("regenerate 7 snapshots" — actually 9 pairs exist, and none currently show the load-bearing diff).
**Effort**: Medium (rename is mechanical; the FIT-04 pair addition + ADR write-ups are the judgment-requiring parts).
**Pattern fit**: matches existing `openspec/decisions/003*-*-amendment` precedent + `test/fitness/fit-04-dts-semver-gate.test.ts`'s existing pair structure.

No second viable approach exists for the rename itself — the API shape was already ratified (#2109) and re-cut (#2114); inventing an alternative naming/shape here would relitigate a decided question.

## Recommendation

Proceed with Approach 1. Two placement decisions are genuinely open (not resolvable at explore-depth without design's fuller context) and are carried forward as technical open questions below rather than guessed. Recommend, without mandating: house the importable `modify(handle, fn)` form in each dialect's own module (e.g. `src/dialects/typescript/index.ts`, alongside `find`) rather than a generic kit-level export — ADR-0009 scopes the AUTHOR surface to `commons` + per-dialect subpaths only, and this change's own re-cut just deferred reopening that boundary; a kit-level generic helper would reopen it through the back door even though FIT-08 would not mechanically catch it (`Handle`/`Dialect`/`OpPack` are not in `KIT_SYMBOL_NAMES`).

## Risks

- FIT-04 coverage gap: none of the 9 existing baseline pairs' literal text shows `Handle`'s structure — the rename's actual breaking surface could pass the semver gate with zero detected diff unless a new pair is added (verified live, not speculative).
- ADR-0039's file text names `.modify()`/`runModify` verbatim throughout — needs an explicit amendment, or the committed ADR becomes misleading documentation of a mechanism that no longer has that name.
- Concurrent in-flight exploration `ts-dialect-backend-ops` (engram `#2101`) edits the same `src/dialects/typescript/{ops,index}.ts` and `src/conformance/index.ts` — coordinate merge order to avoid rebase conflicts on the op-pack/conformance surface.
- Clean break, no deprecation: every caller (docs, e2e fixtures, `./conformance`'s published chain contract) breaks simultaneously — ~20+ files touch `.modify(`/`.raw(`; slice sequencing should group rename + call-site + doc updates per module to avoid a half-migrated intermediate state failing CI mid-slice.
- `RESERVED_HANDLE_NAMES` swap is collision-free against everything shipped today, but is a genuine behavior change for any third-party op-pack (pre-1.0, none exist yet) that named an op `raw`.

## Open Questions

- type: technical
  question: "Where does the importable `modify(handle, fn)` form live — a per-dialect module export (duplicated per dialect) or a generic kit-level export (crossing the ADR-0009 author/contributor boundary this change's own re-cut deferred)?"
  why_it_matters: "Design commits to one; guessing either invents a shipped public-API location without an explicit ADR, and the wrong choice reopens the deferred ADR-0009 boundary or creates avoidable per-dialect duplication."
- type: technical
  question: "Should FIT-04's `DTS_PAIRS` gain a 10th entry for `core/define-dialect.d.ts` (the only file whose `.d.ts` text actually shows `Handle`'s shape), given the other 9 pairs verified live do not catch this change's core breaking edit?"
  why_it_matters: "Without it, the rename's most load-bearing change (Handle's raw/modify shape) ships with no fitness-function evidence it was even gated, undermining the stated purpose of 'FIT-04 dts-baseline regeneration' in scope."

## Ready for Proposal

**Status**: yes
**Reason**: All six "Notes for Next Phase" items resolved: call sites enumerated (commons, dialect-handle, define-dialect, conformance, docs, ~20+ test files); doc/ADR precedents read; Handle-freeze rationale confirmed (only `find` + `Handle` type frozen, unfreezing needs an explicit ADR — already anticipated by triage); `RESERVED_HANDLE_NAMES` verified collision-free; FIT-04 mapped precisely (9 pairs, 2 real churners confirmed live, 1 coverage gap discovered); pending-changes row-136 confirmed already resolved (reject, via ADR-0039) — this change only renames the guarded verb, no new decision needed. No sensitive-area escalation beyond what triage flagged; no architectural conflict — the one `deviates` row (Handle type) was already anticipated and gated by triage's own ADR requirement.
**Recommended action**: Proceed to `sdd-propose`.
