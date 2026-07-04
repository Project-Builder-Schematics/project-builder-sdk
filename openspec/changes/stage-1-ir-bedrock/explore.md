# Exploration: Stage 1 — IR bedrock: wire correctness & fake fidelity (stage-1-ir-bedrock)

**Triage**: L
**Persona lens**: none (synthesis pass; architect/qa/ba/pm framing folded in)

## Cross-Change Lessons Consulted

- `openspec/lessons-learned.md` (canonical, hybrid-mirrored) + targeted `mem_search` for
  "engine boundary port guard fitness" and "batch cap size limit flush" — no hits beyond the file.
- Pattern from `typed-options-and-read`: "prove + freeze an existing contract before adding a new
  mechanism" — directly reused below for the empty-batch semantics point (1.4).
- Discovery from `l1-author-surface-skeleton`: "a migration/behavior prediction must be
  apply-verified" and "lifecycle guarantees need a REQ+GWT, not a JSDoc comment" — both apply to
  1.5's double-fault fix (no test today exercises `discard()` itself rejecting).

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author calls `move`/`handle.move` with/without `force` | none (only golden-IR shape + fake fidelity, no `force` variant yet) | Modify |
| Write-only factory reaches run-end and commits | `test/skeleton/write-only-factory.test.ts` | Modify (add empty-batch case) |
| Factory throws AND the run-end/flush-time discard also rejects (double fault) | none found | Create |
| Author emits a batch exceeding the (currently undefined) cap | none found | Create |
| A module outside `src/core` attempts to reach the port/wire directly | none found (no FIT-10) | Create |

## Current State

`src/core/wire.ts`'s `move` directive has no `force?` (create/rename/copy do); `directive-factory.ts`,
`commons/index.ts`, and `base-handle.ts`'s `WriteOps.move` all lack it too — confirmed by reading all
four. `test/support/contract-fake.ts#apply` silently overwrites on `move` collision (no `#exists(dst)`
check) and silently materializes `modify` of a non-existent path — both are exactly ADR-0017's two
unimplemented rules. No batch-cap constant or check exists anywhere in `src/` (`rg` confirms; the one
`Buffer.byteLength` hit is `fit-03`'s unrelated bundle-budget test). `Session.flush` (`session.ts:52-64`)
already no-ops on empty `#pending` and `defineFactory` (`context.ts:49-57`) already calls `commit()`
unconditionally after flush — the empty-batch run-end path is structurally already correct, just
unpinned by a test. `context.ts`'s catch block (`await ctx.session.discard(); throw err;`) has no
try/catch around `discard()` — a rejecting discard replaces `err`, confirming W6 live. No FIT-10 exists
(`test/fitness` stops at `fit-09`). `test/golden-ir/fixtures.ts` pins single-directive shapes only —
no multi-directive Batch fixture exists for "chained-handle programs." Phantom "ADR-0028" comments are
real (`wire.ts:1`, `directive-factory.ts:55`, both `test/golden-ir/*`) — no such ADR file exists; real
citations are ADR-0013/ADR-0017.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/wire.ts` (Directive shapes) | extend | `move` gains `force?` (1.3/ADR-0017) | aligns |
| `core/directive-factory.ts` + `commons/index.ts` + `base-handle.ts` (author surface) | extend | thread `force?` through `move()`/`.move` | aligns |
| `core/session.ts` (flush boundary) | modify | batch-cap enforcement (1.4) | **deviates** — SDK-side size judgment sits in tension with ADR-0018's "engine judges, SDK never validates"; needs a design-time ADR reconciling cap-as-wire-envelope-constant vs. author-content judgment |
| `core/context.ts` (run lifecycle) | modify | W6 double-fault preservation (1.5) | aligns |
| `test/support/contract-fake.ts` (normative counterpart) | modify | fail-closed move/modify (1.3), JSON round-trip + path/conflict fidelity (1.7), cap modeling (1.4) | aligns |
| `test/fitness/*` (fitness layer) | new (FIT-10) | structural port guard (1.8) | aligns — joins existing layer |
| docs/CONTRIBUTING (testing doc) | new | test-pyramid codification (1.9) | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/wire.ts` | Modify | `move` directive gains `force?` |
| `src/core/directive-factory.ts` | Modify | `move()` method gains `force?` |
| `src/commons/index.ts` | Modify | `move()` verb + handle `.move` gain opts |
| `src/core/base-handle.ts` | Modify | `WriteOps.move` signature gains opts |
| `src/core/session.ts` | Modify | batch-cap enforcement at flush |
| `src/core/context.ts` | Modify | W6 double-fault fix |
| `test/support/contract-fake.ts` | Modify | fail-closed move/modify, JSON round-trip, cap + conflict fidelity |
| `test/golden-ir/{fixtures.ts,golden-ir.test.ts}` | Modify | move ± force fixtures, chained-program fixtures, determinism proof |
| `test/fake/*.test.ts` (+ new wire-modeling file) | Modify/Create | pin new fail-closed rules, wire-modeling, cap |
| `test/fitness/fit-10-*.test.ts` | Create | structural port guard |
| `test/skeleton/context.test.ts` (or new file) | Modify | double-fault test |
| `openspec/decisions/00xx-batch-cap.md` + docs/CONTRIBUTING + phantom-ADR-0028 fixes + conformance/fit-04 debt (1.6) | Create/Modify | D8 ADR + test-pyramid doc + XS debt batch |

12 rows — within triage's ~18-22 file estimate once each row's 1-3 concrete files are counted; **no
re-triage trigger**.

## Sensitive Areas Crosscheck

Checked against `openspec/sensitive-areas.md` (all rows anticipated/low-confidence: publish
supply-chain, `.raw` AST escape, dialect trust, JSON-RPC IPC, deployment secrets, public-API
semver). None of Stage 1's touched paths hit publish/deploy/dialect-trust surfaces — `.github/workflows/ci.yml`
is read-only reference, `publish.yml` untouched (Stage 6). No sensitive areas touched.

## Approaches

### 1. FIT-10 mechanism (Stage 1.8)
**Description**: (a) static import-graph scanner mirroring `fit-01`/`fit-08` (regex-scan `src/**`
outside `src/core` for imports resolving to `engine-client.ts` or wire-encoding identifiers), vs
(b) extending FIT-08's re-export bleed list — insufficient, it only catches author-subpath
re-exports, not every module naming the port; vs (c) TypeScript-compiler-API transitive traversal —
zero precedent in this repo's 9 existing FIT tests (all regex-based), and W2 already earmarks
exactly this depth upgrade as Stage 5.0 debt for FIT-01, not now.
**Pros/Cons**: (a) Low effort, matches dominant pattern, inherits FIT-01's known non-transitive-scan
limitation (acceptable — W2 tracks the fix for Stage 5.0, not 1.8). (c) more robust but introduces a
new tooling pattern this codebase doesn't use anywhere yet.
**Effort**: Low (a) vs Medium-High (c). **Pattern fit**: (a) matches `fit-01`/`fit-08`; (c) new pattern.

### 2. Determinism proof mechanism (Stage 1.1)
**Description**: (a) run one factory twice, capture each emitted `Batch` (spy on `emit`, pattern
already used in `write-only-factory.test.ts`), assert `JSON.stringify(batch1) === JSON.stringify(batch2)`;
vs (b) `expect().toEqual()` structural comparison — proves equality, not byte-identity, weaker than
the problem statement's explicit "byte-identical" framing.
**Effort**: Low both. **Pattern fit**: (a) matches FIT-05's JSON-based reasoning; is the stronger claim.

### 3. Empty-batch run-end semantics (Stage 1.4)
**Description**: (a) no production change — `Session.flush` already no-ops on empty pending and
`defineFactory` already calls `commit()` unconditionally after; the "exists when" bar is met by
adding ONE pinning test. vs (b) add an explicit skip-commit-when-empty branch to `defineFactory` —
unrequested behavior change, no failing test or ADR demands it (scope creep against Boy Scout rule).
**Recommendation**: (a) — a direct "prove + freeze" repeat of the `typed-options-and-read` lesson.

## Recommendation

Proceed as ONE L change per triage. Honor the frozen order **1.3 → 1.4 → 1.7 → 1.1** (all four share
`test/support/contract-fake.ts`; 1.1's fixtures need the frozen `move`+`force` wire shape and the
frozen fake semantics first); 1.5/1.6/1.8/1.9 are independent of that cluster and can slice in
parallel. Take Approach 1a (FIT-10 scanner), 2a (byte-string determinism proof), 3a (test-only
empty-batch pin, zero production change).

## Risks

- `test/support/contract-fake.ts` is a shared bottleneck across 1.3/1.4/1.7 — sequencing (not
  parallel slicing) is required, matching triage's own risk note.
- Cap enforcement at `Session.flush` may structurally conflict with ADR-0018's pass-through
  invariant — needs a design-time ADR before 1.4 lands code (see Open Question 2).
- FIT-10's scanner will false-positive on `test/support/contract-fake.ts`'s own legitimate
  `import type { EngineClient }` unless explicitly allow-listed (see Open Question 3).
- 1.1's "chained-handle programs" fixtures are a NEW fixture shape — today's `test/golden-ir/fixtures.ts`
  only pins single directives, never a multi-directive `Batch` — effort could exceed the XS/S
  assumption implicit in triage's line estimate if the fixture format needs restructuring.
- No test today exercises a rejecting `discard()` (W6's exact failure mode) — 1.5 isn't provably
  fixed until that red-proof exists.

## Open Questions

- type: product
  question: "Batch-cap measurement unit (UTF-16 code units vs UTF-8 byte length via
  `Buffer.byteLength`, the pattern already used in `fit-03-commons-bundle-budget.test.ts`) AND
  `modify.content`'s encoding/binary posture (plain UTF-8 text only, or base64-wrapped binary?) —
  D8, unratified. Code evidence leans toward UTF-8 bytes: the wire is JSON-RPC over stdio
  (`architecture.md`) and ADR-0018 already models the wire via a JSON round-trip in the fake, so a
  code-unit-based cap would systematically under-count what actually crosses the seam for non-ASCII
  content. But whether `modify` supports binary at all is a product-scope call, not implementation."
  why_it_matters: "Without ratification, 1.4 cannot freeze a cap check — building against the wrong
  unit either false-rejects valid ASCII-only batches near the boundary or false-passes oversized
  non-ASCII ones; a later reversal is a wire-contract semver break."

- type: technical
  question: "Does cap enforcement belonging at `Session.flush` (SDK-side) contradict ADR-0018's
  'the SDK never validates; the engine judges' boundary-pass-through invariant, or is the cap a
  structural wire-envelope constant (like `protocolVersion`) the SDK may legitimately enforce
  without becoming an author-content judge?"
  why_it_matters: "Determines whether 1.4 needs its own ADR to carve out an explicit exception to
  D6, or whether it's already covered by D6's 'wire contract' framing — left unresolved, design
  either silently deviates from architecture or wrongly routes the cap check to the fake/engine
  side where ADR-0018 doesn't actually put it."

- type: technical
  question: "FIT-10's scanner (Stage 1.8) must allow the ONE legitimate `EngineClient` import in
  `test/support/contract-fake.ts` (`contract-fake.ts:9`) while still flagging every other module
  that names the port — what's the allow-list mechanism (path allow-list vs. 'implements
  EngineClient' structural exception)?"
  why_it_matters: "An unscoped scanner breaks CI on day one against the repo's own normative
  counterpart; the allow-list design is the difference between FIT-10 guarding real bypasses and
  FIT-10 being disabled/loosened to pass, which would silently weaken the guard it exists to provide."

## Ready for Proposal

**Status**: yes
**Reason**: All 9 in-scope items are groundable in real code with a clear file-level plan; the size
matches triage's L estimate (12 consolidated affected-area rows, ~18-22 concrete files once expanded —
no XL trigger). The frozen ordering triage flagged (1.3→1.4→1.7 before 1.1) is validated against the
actual shared-file dependency (`contract-fake.ts`). No sensitive-area or architectural-conflict
blocker. Two technical open questions and one product open question (D8) remain — normal
design/spec-time ratifications, not halts.
**Recommended action**: Surface the product open question (D8: cap unit + content encoding) to the
user before `sdd-propose`; carry the two technical open questions into `sdd-spec`/`sdd-design`;
register D8 in `openspec/objectives-plan.md`'s decision table (currently only lists D1-D7).
