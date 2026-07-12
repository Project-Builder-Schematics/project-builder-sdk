# Exploration: Op breadth + collision diagnostic + conformance tail (stage-5b-dialect-breadth)

**Triage**: L
**Persona lens**: none (council personas run separately)

## Cross-Change Lessons Consulted

- `stage-5-first-dialect`: ts-morph@28 strips leading BOM via `getFullText()` — owned at the `ast.ts` binding layer (WeakMap re-prepend), never at the op layer.
- `stage-5-first-dialect`: ts-morph's parser is fault-tolerant — real syntax-error detection needs `getSyntacticDiagnostics()`, not a thrown exception.
- `stage-5-first-dialect`: async author callbacks under a `=> void` type escape sync try/catch — any new op accepting a callback-shaped arg needs the same await-inside-containment treatment `.raw()` already got (this is row 137's `runOp` gap, confirmed live below).
- `stage-5-first-dialect`: cross-branch ADR/FIT number collisions — reserve a range up front for this change's new ADRs.
No prior `pattern`/`discovery` entries specific to op-pack collisions or unused-import pruning — this ground is new.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Typed removeImport/pruneUnusedImports on an existing file | none (only addImport covered) | Modify `test/e2e/dialect-modify.e2e.test.ts` |
| Typed addFunction/addVariable/addClass ± export | none (`.raw()` only) | Create |
| Two real op-packs collide on a name via `withOps` | none | Create |
| Conformance kit adversarial/leaf/real-base-dialect rules | `test/conformance/typescript-conformance.test.ts` (CORE only) | Modify |

## Current State

`src/dialects/typescript/ops.ts` ships exactly one op, `addImport`, a pure `(ast, name, from) => void` function. `index.ts` composes it as a single pack via `withOps(baseDialect, addImportPack)` — no second pack exists, so REQ-DG-02.2's collision diagnostic has never been exercised. `ast.ts` deliberately avoids ts-morph's language-service **formatter** only (REQ-TSD-02 text; the module comment reads broader — "no language-service API anywhere" — a stricter self-imposed bar than the spec literally requires).

**Row 136 evidence (mandatory design input).** `dialect-handle.ts`'s `runOp`/`runRaw` both route through `#ensureOpen()`, which registers exactly ONE lazy `modify` directive per open chain (identity-checked against `session.pendingSnapshot()`). `runModify(content)` (the inherited raw write verb, design §4.3 "Q2/ADR-0037 1b") is a **separate path**: it calls `#bufferDirective`, which buffers its OWN immediate `factory.modify({path, content})` directive — bypassing `#ensureOpen()` entirely. `Session.buffer()` just pushes (no path dedup); `flush()` emits `#pending` verbatim in array order. So `find(p).addImport(x).modify(rawContent)` buffers **two** `modify` directives for the same path; `ContractFake` applies instructions "eager array-order" (session.ts comment) — the raw `modify` wins, silently discarding the AST edit. This is exactly the "silent data loss on forgotten discipline" pattern ADR-0037 rejected for the await problem ("correctness must not hinge on... author discipline") — design should weigh a symmetric fix (reject at `runModify`/`runOp` time if the other path is already open) against documenting it as scoped UB like same-path concurrency.

**Row 137 evidence.** `runOp`'s `fn(this.#live as Ast, ...args)` call is NOT wrapped the way `runRaw` wraps its `fn` (try/catch + `isThenable` await). An op literal typed `(ast, ...args) => void` that is actually `async` compiles today (void-return compatibility) and its rejection floats uncontained.

**Collision-diagnostic topology.** ADR-0012/REQ-TSD-07 forbid proving conformance against anything but the real `ContractFake`/real dialect ("no conformance theatre"); the S-001 toy-dialect fixture was explicitly retired from conformance after S-001. A same-name collision therefore needs two op-packs typed over the REAL `SourceFile` Ast — either (a) splitting this change's own new ops into ≥2 shipped packs (which by construction won't collide) plus a dedicated test-fixture pack pair that DOES collide, both typed against `SourceFile`, or (b) a second real dialect (explicitly OUT of scope).

**prune-unused-imports mechanism.** Two ts-morph paths exist: (1) a purely syntactic identifier-walk (`getDescendantsOfKind(Identifier)` minus the import specifiers themselves) — no type-checker, no language service, matches the `getSyntacticDiagnostics` precedent already in `ast.ts`; (2) `ImportSpecifier#findReferencesAsNodes()` — internally backed by ts-morph's `Project`-level LanguageService. (1) is deterministic, cheap, and self-consistent with the module's own "no language-service API anywhere" comment; (2) is more accurate (handles shadowing, type-only usage) but its "language service" classification is the exact thing the module's own doc-comment disclaims. Recommend (1), flagged as an open question below since it trades detection accuracy for posture-consistency.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/typescript/ops.ts` | extend | 5+ new op functions, same shape as `addImport` | aligns |
| `src/dialects/typescript/index.ts` | extend | compose new op-pack(s) via `withOps` | aligns |
| `src/dialects/typescript/ast.ts` | extend | possible pure syntactic-identifier helper for prune | aligns |
| `src/core/dialect-handle.ts` | modify | resolve row-136 last-write-wins; row-137 `runOp` containment; row-145 closure clear | aligns |
| `src/core/define-dialect.ts` | modify | `withOps` collision diagnostic (ADR-0010's own anticipated work) | aligns |
| `src/core/session.ts` | modify | `pendingSnapshot()` → `isPending()` (row 141, perf) | aligns |
| `src/conformance/index.ts` | extend | adversarial samples, leaf rule, real-base-dialect rule (ADR-0012 tail) | aligns |
| `src/testing/contract-fake.ts` | modify | `deepEqual` extraction to shared module (row 146) | aligns |

No `deviates` rows — this change extends the ONE bounded context stage-5 already established (op-authoring pattern, `withOps` composition, conformance-kit shape); it opens no new topology, consistent with triage's L-not-XL call.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modify | removeImport, pruneUnusedImports (gated), addFunction/addVariable/addClass ± export |
| `src/dialects/typescript/index.ts` | Modify | compose new pack(s), possibly split for collision topology |
| `src/dialects/typescript/ast.ts` | Modify | syntactic identifier-walk helper if prune ships |
| `src/core/dialect-handle.ts` | Modify | row 136/137/145 |
| `src/core/define-dialect.ts` | Modify | withOps collision diagnostic |
| `src/core/session.ts` | Modify | pendingSnapshot → isPending |
| `src/core/context.ts` | Read-only | confirm run-boundary join needs no change for new ops |
| `src/conformance/index.ts` | Modify | conformance tail + new op exercises + deepEqual extraction |
| `src/testing/contract-fake.ts` | Modify | deepEqual extraction |
| `test/dialects/typescript/**`, `test/conformance/**`, `test/fitness/fit-01-*` | Modify/Create | new op tests, collision fixture, FIT-01 extensionless-import fix (row 141) |
| `test/types/define-dialect.test.ts` | Modify | collision compile-error pin if design picks type-level diagnostic |
| `package.json` / `typescript.index.d.ts` FIT-04 baseline | Modify | new op signatures added to the frozen `./typescript` subpath, no new subpath |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution) | `src/dialects/typescript/**`, `src/core/dialect-handle.ts` | Yes |
| security (third-party trust) | ts-morph realm (new ops all execute inside it) | Yes |
| public-api (contract) | `package.json#exports` `./typescript` (new op signatures, frozen subpath) | Yes |

No unflagged sensitive touch found. Note: `openspec/sensitive-areas.md` on disk still reads "4 keys" (pre-stage-5); engram `project/sensitive-areas` (#646) already has 5 — filesystem mirror is stale, a known stage-5 lesson ("openspec architecture mirror skips when refreshes stay engram-only"). Not a blocker; flag for archive-time refresh.

## Approaches

### 1. Sequential breadth-first (single growing pack)
One `defineOpPack` composed via `withOps(baseDialect, allNewOpsPack)`; collision diagnostic proven separately via a dedicated test-fixture pack pair; conformance tail as its own slice.
**Pros**: minimal structural change, lowest risk. **Cons**: manufactures a throwaway collision topology instead of using production shape; misses a chance to exercise `withOps` with >1 real pack the way a community dialect-author actually would.
**Effort**: Medium. **Pattern fit**: matches `addImportPack`.

### 2. Op-pack-split from day one (recommended)
Split new ops into ≥2 real shipped packs (e.g., `importOpsPack` = removeImport + pruneUnusedImports; `declarationOpsPack` = addFunction/addVariable/addClass), composed together via `withOps(baseDialect, importOpsPack, declarationOpsPack)`. The collision-diagnostic proof then adds one deliberately colliding test-fixture pack, also typed over the real `SourceFile` Ast, composed in a dedicated test.
**Pros**: the real ≥2-pack topology the collision diagnostic needs comes from the SHIPPED shape, not a manufactured one — "no conformance theatre" honored twice over; validates `withOps`'s multi-pack composition for the first time under real conditions. **Cons**: one more design decision (pack boundaries) than approach 1.
**Effort**: Medium. **Pattern fit**: extends ADR-0010 as designed (multi-pack composition), first real exercise of it.

### 3. Narrow-first (owner's standing deferral lever, not exercised now)
Ship only addFunction/addVariable/addClass ± export + the import pack (closes the named pain); defer removeImport/pruneUnusedImports/collision-diagnostic if apply-time size trends toward stage-5's own XL estimate.
**Pros**: fastest path to closing CQ-4's founding claim. **Cons**: leaves the collision diagnostic and prune op deferred a second time — the exact "recipe stays half-proven" risk stage-5's reckoning flagged.
**Effort**: Low. **Pattern fit**: n/a — a scope lever, not a technical approach.

## Recommendation

Approach 2 (op-pack-split). It is the only option that produces the collision diagnostic's proof topology as a side effect of the real, shipped op breadth rather than a synthetic fixture-only exercise — directly satisfying the triage's "no conformance theatre" condition — while costing only one extra design decision (where the pack boundary falls) over approach 1. Approach 3 stays the documented XL tripwire response, not a competing default.

## Risks

- Row 136 (last-write-wins): if design picks "document" without a runtime guard, this ships a silent-data-loss footgun in a correctness-sensitive tool — the same class of risk ADR-0037 explicitly rejected for the await problem. Recommend design lean toward a guard.
- Row 137 (`runOp` async containment): latent today, zero tests catch it — treat as a real gap, not cosmetic.
- prune-unused-imports (syntactic detector): false-positive risk on type-only/re-export usage — needs adversarial fixtures; flagged as a product risk-acceptance call below.
- Collision-diagnostic fixture packs MUST type against the real `SourceFile` Ast, never the retired toy-dialect fixture (ADR-0012 amendment forbids reviving it in conformance code).
- XL tripwires stay armed (6+ ADRs at design, or apply-time size trending toward stage-5's own XL estimate) — carried forward from triage, not new.

## Open Questions

- type: technical
  question: "Row 136 — should `.modify(content)` after an open AST op on the same handle reject (throw) or ship as documented last-write-wins UB?"
  why_it_matters: "Confirmed live (see Current State) that today it silently drops the AST edit; both stage-5 judgment-day judges already flagged this as unresolved. Design must decide before S-000."
- type: technical
  question: "Should the `withOps` collision diagnostic be a compile-time type error (`expectTypeOf` negative pin) or a runtime diagnostic thrown at composition time?"
  why_it_matters: "ADR-0010 promised 'a readable diagnostic' without committing to compile-time vs runtime; the choice determines whether `test/types/define-dialect.test.ts` or a new runtime unit test carries the proof."
- type: technical
  question: "Confirm the syntactic identifier-walk (no language-service) is the ratified mechanism for prune-unused-imports, not `findReferencesAsNodes` (language-service-backed)."
  why_it_matters: "The two mechanisms trade accuracy for posture-consistency with the module's own no-language-service comment; picking wrong means either a spec-adjacent violation or reopening false-positive risk late."
- type: product
  question: "Is a purely syntactic (non-type-aware) unused-import detector's false-positive/negative risk (shadowing, type-only positions, re-exports) acceptable for a v1 `pruneUnusedImports` op, or should it ship narrower-scoped / experimental?"
  why_it_matters: "This op can silently DELETE code the author still needs; the risk tolerance here is a product call, not purely technical — wrong default could cause real author-facing breakage."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: All four gated/mandatory items (rows 136, collision topology, prune mechanism, and the sensitivity crosscheck) have concrete evidence and a recommended direction; none are blockers — they are technical/product questions correctly deferred to spec/design per the triage's own gating language. No unflagged sensitive area surfaced. No architecture deviation found.
**Recommended action**: Proceed to `sdd-propose`; carry the four open questions and the op-pack-split recommendation into propose/spec framing; surface the one `type: product` question to the user before propose per the harness contract.
