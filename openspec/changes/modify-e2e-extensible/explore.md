# Exploration: Extensible E2E Harness + Modify Operator Coverage (modify-e2e-extensible)

**Triage**: L
**Persona lens**: none (synthesis; architect/qa-engineer/security-engineer angles folded in)

## Cross-Change Lessons Consulted

- Pattern #2086: FIT-guard numbering is one flat project-wide sequence with no reservation mechanism — two concurrent changes collided on FIT-23 before. Next available number today (checked across `main`, `m2-copyin-banked-arm`, `feat/react-dialect`, `fit-40-manifest-derived-inventory`) is **fit-42** — reserve it now.
- Archive report #2090 (`author-emulation-e2e-scaffold`): a THIRD golden idiom already exists in this repo — a committed IR-transcript corpus (`test/e2e/author-emulation/corpus/*.transcript.json`) with a `scenarios.ts` single-source registry and a `coverage-manifest.md` REQ-ID↔row ledger, guarded by FIT-24..28. Heavier machinery than this change needs (built for a 21-row scenario space); documented for comparison, not adopted.
- Sensitive-areas registry (#1998, mirrored 2026-07-12) is **stale**: it lists only `src/dialects/typescript/**` under `security (code execution)` and 5 public-API export keys. The live `openspec/architecture.md` baseline (refreshed 2026-07-21) already lists `src/dialects/react/**` at the same HIGH confidence and 6 export keys (`./react` included). Registry sync is a real gap, independent of this change.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| TS-dialect: chain ops -> single coalesced `modify`, order-invariance, mid-chain split, forgotten-await | `test/e2e/dialect-modify.e2e.test.ts` (S-002) | Extend — generalize under the new extensible seam, no behavior change |
| React-dialect: same four flows, using `setJsxProp`/`addImport` as the vehicle | none found | Create |
| Scaffold folder walk (create/copyIn only, no modify) | `test/e2e/scaffold.e2e.test.ts` | Read-only — confirms scaffold structurally cannot host `.modify()` coverage |
| Future operator gaining e2e coverage | none found (unenforced) | Create — extensibility contract + fitness guard |

## Current State

Two dialects exist: `src/dialects/typescript/**` (five ops + `.modify(fn)`) and `src/dialects/react/**` (`setJsxProp`+`addImport` + `.modify(fn)`). `.modify(fn)` is NOT dialect code — it lives once in `src/core/dialect-handle.ts`/`define-dialect.ts`, proven dialect-agnostic already by `test/e2e/toy-dialect-skeleton.e2e.test.ts` (S-001) and re-proven against the real TS dialect by `dialect-modify.e2e.test.ts` (S-002). No React-dialect equivalent exists. The one scaffolding e2e (`scaffold.e2e.test.ts`) only drives `create`/`scaffold`/`copyIn` — it never calls a dialect leaf, so it cannot exercise `modify` by construction.

Root `conformance/` fixtures (`m2-modify`, `m2-delete`, `m2-rename-move`, `m2-copy`) are **fully wired and enforced** (full `manifest.json`+`factory.ts`+cases, `fit-40` REQ-CFX-06/07/08/15 behavioral-contract checks) — not placeholders. `REQ-CFX-11`'s honesty boundary (engine-authoritative, never SDK-proven) applies equally to ALL of them; it is not a special "unfinished" state for these three. `m2-modify` fixture tests the wire-level `{op:"modify"}` directive (produced today by `replaceContent`) — content-source-agnostic, so it already exercises the same directive shape a dialect `.modify(fn)`/op would produce. This makes the conformance layer's "modify" coverage genuinely complete already; the real gap is one layer up, at the dialect-AST level, and only for React.

`copy-copyin-conformance-fixtures` (branch `m2-copyin-banked-arm`) is build-complete with `m2-copyin` fixture held off `main`/this worktree per ADR-0074 — this worktree's `corpus.json`/`conformance/` tree does not include it, so there is no live file collision today.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `test/e2e/` golden-committed-tree idiom | extend | generalize S-002's pattern into a named, reusable seam + add the React counterpart | aligns |
| `test/fitness/` guard cluster | new (fit-42, reserved) | operator×dialect e2e coverage matrix guard — no precedent enforces "every op has e2e in every dialect" today | aligns (mirrors FIT-02/FIT-41's scan-based precedent) |
| `src/dialects/react/**`, `src/dialects/typescript/**` | read-only | new/extended tests exercise existing ops; zero production diff | aligns |
| `conformance/` fixture corpus | read-only | wire-level `modify` already covered, dialect-agnostic — confirmed out of scope for this change | aligns |
| `openspec/sensitive-areas.md` (+ engram mirror) | flag only, no edit this change | stale vs. `architecture.md`'s own Notes (react already HIGH, 6 exports) — pre-existing drift, not introduced here | deviates (registry vs. baseline, not code vs. baseline) |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `test/e2e/dialect-modify.e2e.test.ts` | Modify (light) | wrap/rename under the new extensible seam; behavior unchanged |
| `test/e2e/dialect-modify-react.e2e.test.ts` (new name TBD) | Created | React mirror of S-002's four flows |
| `src/dialects/react/golden/*.txt` (new dir) | Created | golden fixtures mirroring `src/dialects/typescript/golden/` |
| `test/support/golden.ts` | Read-only | already accepts a `dir` override — no change needed for a second golden set |
| `test/fitness/fit-42-*.test.ts` (new, number reserved) | Created | the extensibility-contract fitness guard |
| `conformance/{m2-modify,m2-delete,m2-rename-move}` | Read-only | confirmed wired+enforced, wire-level, out of scope |
| `openspec/sensitive-areas.md` | Read-only this change | flagged for a follow-up sync, not this change's job |
| `project/lessons-learned` (#2086) | Read-only | reserve fit-42 now; re-check at slice/apply time before landing |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution) | `src/dialects/typescript/**` | Yes — forced L |
| security (code execution) | `src/dialects/react/**` | Yes — triage explicitly deferred the determination to explore; confirmed here via the live `architecture.md` baseline (already HIGH), not a new discovery |

No escalation needed — both touches were anticipated.

## Approaches

### 1. Generalize the existing golden-committed-tree idiom into a named, parameterized seam
**Description**: Formalize what S-002 already does (ContractFake + `golden()` + committed-tree assertions) into a small, reusable per-dialect flow set, add the React counterpart exercising the same four flows via `setJsxProp`/`addImport`, and add one new fitness guard (fit-42) that enumerates a data-driven operator×dialect matrix and fails when a declared cell has no matching e2e. Mirrors FIT-41's cross-dialect verdict-parity technique and FIT-02's scan-based enforcement.
**Pros**: Reuses a proven idiom exactly (zero new test-infra concepts); `.modify(fn)` is already dialect-agnostic core machinery, so React coverage is genuinely cheap once the seam exists — this is the concrete proof the "future operator = XS/S" requirement demands.
**Cons**: One upfront design cost (the matrix registry + guard) this L change must absorb once.
**Effort**: Medium (harness) + Low (React file itself).
**Pattern fit**: matches `test/e2e/author-to-tree.e2e.test.ts` / `dialect-modify.e2e.test.ts`.

### 2. Extend the conformance/ sync-site-enforcement pattern (m2-copy/m2-copyin precedent) to also govern dialect e2e presence
**Description**: Reuse fit-40's proven regex sync-site technique to also check that dialect e2e files exist.
**Pros**: Reuses a proven mechanism.
**Cons**: Structurally infeasible — `conformance/factory.ts` files import ONLY the public commons umbrella (`../../src/index.ts`, REQ-CFX-01), which does not re-export any dialect leaf. A conformance fixture cannot invoke `ts.find()`/`react.find()` at all, so this layer cannot express dialect-AST coverage by construction, not merely by convention.
**Effort**: N/A — rejected on structural grounds.

### 3. A new from-scratch harness in the IR-transcript scenario-matrix style (author-emulation-e2e-scaffold precedent)
**Description**: Build a `scenarios.ts` registry + `coverage-manifest.md` ledger + dedicated fitness guards, as that change did for a 21-row scaffold matrix.
**Pros**: Proven for exhaustive REQ-ID-mapped coverage at scale.
**Cons**: A fourth distinct test idiom in one repo (anti-regrowth) for a cell count (2 dialects × a handful of flows) far smaller than what motivated that idiom; over-engineered here.
**Effort**: High.

## Recommendation

**Approach 1.** It costs nothing structurally new (reuses S-002's exact idiom), and the fact that `.modify(fn)` already lives in dialect-agnostic core code — already proven generic by the toy-dialect e2e — is direct evidence that a matrix-guard-generalized version of this idiom satisfies the "future operator = XS/S" hard requirement without inventing new test-infra philosophy. Approach 2 is ruled out by a hard architectural constraint (REQ-CFX-01), not preference. Approach 3 is reserved for if the matrix grows past a handful of cells.

## Risks

- FIT-number collision (lesson #2086): reserve **fit-42** now; re-verify against `main` + all in-flight branches immediately before `sdd-slice`/`sdd-apply` land it, since `m2-copyin-banked-arm` and others may merge first.
- Scope ambiguity on "Modify": TS's `addFunction`/`addVariable`/`addClass`/`removeImport` have NO dedicated e2e today either (only `addImport` + `.modify()` are exercised in S-002) — if design silently expands scope to full structured-op parity across both dialects, the 5-7 slice target will not hold. Needs explicit spec-level scoping (see open questions).
- Sensitive-areas registry drift (`openspec/sensitive-areas.md` / engram #1998 vs. `architecture.md`): pre-existing, not caused by this change, but worth a follow-up sync recommendation at archive.
- React's two ops (`setJsxProp`, `addImport`) must be sufficient to reproduce all four of S-002's flows meaningfully (chain-coalesce, order-invariance, mid-chain-split, forgotten-await) — `setJsxProp` targeting is text-equality based, which may shape how the "split" and "order" scenarios get authored differently than TS's `addImport`-based versions.

## Open Questions

- type: product
  question: "Does the user accept that the existing TS-dialect `.modify()` e2e (`dialect-modify.e2e.test.ts`, S-002) already counts as delivered coverage — meaning this change's real NEW deliverable is (a) the extensibility seam + fitness guard and (b) the React-dialect equivalent — rather than 'Modify e2e is entirely missing'?"
  why_it_matters: "If unconfirmed, propose/spec could either duplicate/rewrite passing TS coverage as 'new' work (inflating scope and REQ-ID authorship over already-proven behavior) or under-scope the extensibility contract by treating TS as also needing to be built from scratch."
- type: technical
  question: "Should the operator×dialect coverage matrix (and the fit-42 guard) enumerate only the universal `.modify(fn)` escape hatch per dialect (narrow: 2 cells today), or every structured dialect op (TS's 5 + React's 2, most of which also lack dedicated e2e today)?"
  why_it_matters: "This is the single biggest lever on slice count — narrow keeps the 5-7 slice target; broad likely blows past it and may need the pre-agreed per-dialect-split fallback triage already flagged."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: The premise is reconciled (TS-dialect `.modify()` e2e exists; the real gaps are the named extensible seam, the React counterpart, and an enforcement mechanism), the layer disambiguation is resolved (wire-level `modify` is conformance-layer, dialect-agnostic, already covered; dialect-level `.modify(fn)` is the true target), fixture honesty is confirmed (m2-delete/m2-rename-move/m2-modify are wired, not placeholders), the extensibility mechanism has a concrete precedent-fit recommendation, and the concurrent-change collision surface is identified with a specific number reserved. Two open questions (one product, one technical) remain and should be surfaced before `sdd-propose` scopes the slice count.
**Recommended action**: Surface the product open question to the user; feed the technical one into `sdd-propose`/`sdd-spec` scope framing. Proceed to `sdd-propose`.
