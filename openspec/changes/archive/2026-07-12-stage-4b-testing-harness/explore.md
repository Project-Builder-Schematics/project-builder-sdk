# Exploration: Testing Harness (`stage-4b-testing-harness`)

**Triage**: L
**Persona lens**: none (orchestrator-run explore)
**Ground truth**: `main@413b2aa` — this worktree's branch diffs zero vs `main`. Stage-4's typed-options CODE (`feat/stage-4-typed-options`, unmerged) is absent here; its PLANNING artefacts (spec/design/ADR drafts 0027-0031) already merged to main via `8dfedbc` and are read as reference only.

## Cross-Change Lessons Consulted

- Triage decision (obs #807): both sensitivity overrides (public-api, supply-chain) fired independently; owner expected M, not adopted.
- No `pattern`/`discovery`/`bugfix` engram hits for "defineFactory/ContractFake/testing harness" keywords (3 searches, all empty) — this is genuinely new ground for the project.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author writes `factory.ts`, wants to unit/e2e-test it via an installed `@pbuilder/sdk` | none — dead end today (`defineFactory` unreachable, `ContractFake` repo-internal) | Create |
| Author proves the factory runs end-to-end through the *published* entry (installed-consumer-vantage) | none — no test in repo builds+imports as a real consumer | Create |

## Current State

`defineFactory` (`src/core/context.ts:38`) is exported only from `src/core/index.ts`, the ADR-0009 internal kit barrel — never from `src/index.ts` or `src/commons/index.ts`. `ContractFake` (`test/support/contract-fake.ts`, 277 lines) is the ONE normative `EngineClient`, consumed by **25 test files** (fitness FIT-07/10/11, `test/e2e/*` ×3, `test/skeleton/*` ×6, `test/fake/*` ×7, `test/support/spy-client.ts`, `rejection-capture.ts`) — zero production consumers. `package.json#exports` has exactly `.`, `./commons`, `./conformance`; `./core` is unmapped (confirmed absent) though its files ship inside `dist/` via `files:["dist"]` (architecture.md Notes) — unreachable via subpath resolution regardless.

**FIT-08** (no-kit-bleed) is a flat scan: fixed `AUTHOR_SUBPATHS` array (3 files) × flat `KIT_SYMBOL_NAMES` list — no per-path allowlist mechanism exists today. **FIT-09** hardcodes the exact expected subpath SET and asserts it has exactly 3 keys, `./core` absent. **FIT-04** diffs a fixed `DTS_PAIRS` array after an unconditional `bun run build`. **FIT-03** builds only `src/commons/index.ts` — isolated, untouched by a new subpath. **FIT-07** globs `src/core/**` only (not `src/testing/**`) for the ADR-0008 no-tree-in-core rule — its comment notes ContractFake was *moved out* of core specifically to dodge this rule; a future `src/testing/` module holding a path-keyed tree must stay outside any FIT-07 glob expansion. **FIT-10**'s `EngineClient` port guard hardcodes `ALLOW_LISTED_PATH = "test/support/contract-fake.ts"` as a string literal.

**Build config is a hard constraint**: `tsconfig.build.json` has `rootDir: "./src"` and `exclude: ["test"]` — `src/` cannot import from `test/support/` in the published build as-is. README.md today has **no** qualifying-line (it lands only when stage-4 merges); "revert" is a task sequenced *after* stage-4 merges, not executable now.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `package.json#exports` | extend | add `./testing` (never `./core` — ADR-0009 forbids it) | aligns |
| new `src/testing/` module | new | facade wrapping `ContractFake` + `defineFactory`; where `ContractFake` physically lives is the design gate | aligns (mirrors `src/conformance/`, `src/dry-run/`) |
| FIT-08 no-kit-bleed | modify | needs a per-path allowlist, not a blanket exemption | deviates — no per-path data model exists |
| FIT-09 + FIT-04 (exports-entry / dts baseline) | modify | extend fixed arrays to include `./testing` | aligns — same pattern, wider fixtures |
| new dev-only bundle guard | new | assert test-only code never reaches `.`/`./commons`/`./conformance` dist | aligns (mirrors FIT-03's build-and-scan) |
| ADR-0009 | amend | record third audience (author-testing); next free ADR # is 0032 (0027-0031 reserved, DRAFT, by stage-4) | deviates — no author-testing carve-out exists yet |
| new installed-consumer-vantage e2e | new | spawn-build then prove reachability through the published entry | deviates — no build→import mechanic precedent (FIT-04 only text-diffs) |
| README.md | modify | revert qualifying-line | aligns, but sequencing-dependent on stage-4 merge |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `package.json` | Modify | add `./testing` export entry |
| `src/testing/index.ts` (new) | Created | facade: wraps `ContractFake` + `defineFactory`, no name re-exports |
| `test/support/contract-fake.ts` | Modify (relocate) or Read-only | ownership decision — see Approaches |
| `src/core/index.ts`, `src/core/context.ts` | Read-only | confirm no core change needed; `defineFactory` semantics stay as-is |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modify | path-scoped allowlist |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts`, `fit-04-dts-semver-gate.test.ts` | Modify | extend fixed arrays |
| new `test/fitness/fit-1X-testing-dev-only-bundle.test.ts` | Created | dev-only guard |
| `test/fitness/fit-03-commons-bundle-budget.test.ts` | Read-only | confirm untouched (constraint) |
| `test/fitness/fit-07-no-tree-in-core.test.ts`, `fit-10-engine-client-port-guard.test.ts` | Read-only or Modify | FIT-07 comment/assumption re dist; FIT-10's hardcoded path string, IF relocated |
| new `test/e2e/*installed-consumer*.e2e.test.ts` | Created | outcome-proof e2e |
| `openspec/decisions/0009-two-audiences-contributor-kit.md` | Modify | amendment |
| `README.md` | Modify | revert qualifying-line (sequencing risk) |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| public-api (contract) | `package.json#exports`, `.d.ts` | Yes |
| security (supply-chain) | new `./testing` entry ships in npm tarball | Yes |

No escalation needed.

## Approaches

### A. ContractFake ownership: relocate to `src/testing/`
**Description**: physically move `test/support/contract-fake.ts` into `src/testing/`, update the 25 existing importers' paths (incl. FIT-10's hardcoded allow-list string).
**Pros**: no build-config change (`tsconfig.build.json`'s `rootDir:"./src"`/`exclude:["test"]` stays valid); `ContractFake` becomes a normal built `src/` module; the dev-only guard's job is a clean "never in `.`/`./commons`/`./conformance`" check.
**Cons**: 25-file mechanical churn; the fake formally enters the published tree (raises the guard's stakes); FIT-07's "not compiled into dist" comment becomes stale and needs a note.
**Effort**: Medium-High. **Pattern fit**: matches existing sibling-module pattern; first time test-owned code becomes src-owned.

### B. ContractFake ownership: stays in `test/support/`, facade re-exports it
**Description**: `src/testing/index.ts` imports across the `test/`→`src/` boundary as-is.
**Pros**: zero churn on 25 importers; preserves "fake is test infrastructure" framing.
**Cons**: **not viable under the current build config** — `rootDir`/`exclude` reject it outright; fixing requires widening the build root, which every FIT-04/FIT-09 dist-shape assumption is implicitly keyed to `src`-only.
**Effort**: Medium (small config edit, high verification cost). **Pattern fit**: new pattern, fights the grain of an existing invariant.

**Recommendation**: **A** — B is blocked by a real, not stylistic, constraint (`rootDir`); A's cost is bounded and mechanical.

### C. Outcome-proof e2e mechanics: dist-relative import vs pack-and-install
**C1 — spawn build, `import()` `dist/testing/index.js` by relative path** (mirrors FIT-04). Pros: cheap, reuses existing pattern. Cons: never exercises the `exports` map itself — the exact gap the owner's amendment targets.
**C2 — spawn build, `bun pm pack`, install into a scratch dir, `import("@pbuilder/sdk/testing")` by package name.** Pros: the only approach that actually proves "installed-consumer-vantage." Cons: heavier, no repo precedent, needs scratch-dir lifecycle discipline.
**Recommendation**: **C2** — the owner's 2026-07-10 scope amendment is explicit that a relative-path import doesn't prove what it needs to; the mechanics (pack command, scratch-dir cleanup) are a technical question for design.

## Risks

- Blast radius: 25 files import `test/support/contract-fake.ts` today — Approach A touches all of them (mechanical, but real diff size).
- FIT-07's "ContractFake not compiled into dist" comment goes stale under Approach A; needs an explicit note, not silent drift.
- Sequencing: the README-revert task cannot execute until stage-4 actually merges with the qualifying-line landed — building 4b before that merge leaves this one slice undoable.
- FIT-08's current flat data model has no per-path allowlist; this is new machinery, not a config tweak — underestimating it risks a shallow "just skip `./testing`" fix that reopens the symbol-scoped hole constraint #2 was written to close.
- Dev-only bundle guard is a NEW fitness function with no direct precedent (closest analog is FIT-03) — must be built carefully to not silently pass.

## Open Questions

- type: product
  question: "Is 4b blocked from building/merging until `feat/stage-4-typed-options` merges (so the README qualifying-line actually exists to revert), or should the README-revert slice be deferred/dropped if sequencing doesn't land in time?"
  why_it_matters: "Building 4b now (main@413b2aa) cannot include a real revert of a line that doesn't exist yet; assuming an order without owner confirmation risks a slice that's undoable or silently skipped."
- type: product
  question: "Should the ADR-0009 amendment name a literal third audience ('author-testing') as the triage scope states, or frame it as a testing MODE of the existing AUTHOR audience? This is externally-visible language a tech-writer/PM call should settle before design drafts the ADR."
  why_it_matters: "ADR-0009's audience taxonomy is a stable public artefact; picking the wrong frame now costs a rewrite later, not just a wording tweak."
- type: technical
  question: "For Approach C2 (pack-and-install e2e), what's the concrete scratch-dir strategy — `bun pm pack` + `file:` dependency vs a manual tarball extraction — and where does cleanup happen on test failure?"
  why_it_matters: "No repo precedent exists; design needs to pick a concrete mechanic before slicing, or S-000/S-001 will stall on infrastructure instead of behavior."

## Ready for Proposal

**Status**: partial
**Reason**: Codebase grounding is solid and both design gates (ContractFake ownership, e2e mechanics) have a clear technical recommendation each. What's outstanding are two product-level open questions (sequencing against stage-4's merge; ADR audience framing) that materially shape scope — proposal can proceed but must carry both forward explicitly rather than assume an answer.
**Recommended action**: surface the two product open questions to the owner before `sdd-propose`; technical question (C2 mechanics) can be resolved at `sdd-design`.
