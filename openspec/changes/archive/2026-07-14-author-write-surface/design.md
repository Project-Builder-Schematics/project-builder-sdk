# Design: Author write surface — honest write-verb rename

**Spec version**: V4 (signed 2026-07-14) · **Triage**: L · **Persona lens**: none
**Architecture impact**: modifying

> **V4 amendment (2026-07-14, owner-directed scope reduction per post-design foresight gate,
> obs #2128)**: the importable `modify(handle, fn)` calling convention and its run-identity
> guard subsystem (`#origin`/`#bindOrigin` on `dialect-handle.ts`'s controller, §4.4) are
> DEFERRED out of this change — see `typescript-dialect` REQ-TSD-12's spec tombstone and
> `project/pending-changes` "foresight gate" section for the full rationale and prior-art
> pointer. This amendment removes the deferred rows from the File Changes (§4.2) and Test
> Derivation (§4.6) tables below and marks the run-identity mechanism section (§4.4) DEFERRED
> prior art. ADR-01/02/03 are UNCHANGED — none of the three ADRs concerned the importable form
> or run-identity mechanism.

## 4.1 Architecture Overview

A mechanical, clean-break rename of the author-facing write vocabulary, crossing no engine
boundary (wire IR byte-identical). Two names swap on the dialect `Handle` and the commons
`WriteOps`: the wholesale-replace verb `modify(content)` → `replaceContent(content)`, freeing
`modify` for the AST escape hatch `raw(fn)` → `modify(fn)`. Because both live on the SAME
handle, freeing and reassigning `modify` MUST happen in ONE commit — a state where `modify(fn)`
and `modify(content)` coexist is a duplicate-key compile error. The type (`define-dialect.ts`)
and its runtime wrapper (`dialect-handle.ts`) are the one atomic seam (type↔wrapper-keys
coupling); each rename moves type + runtime + FIT-04 baseline + tests in lockstep.

One seam beyond the rename: the `Handle` type is the ONE type `architecture.md` marks FROZEN —
unfreezing it is an explicit ADR, re-frozen by a NEW 10th FIT-04 `.d.ts` pair
(`core.define-dialect.d.ts`, the only file whose text shows `Handle`'s member shape).

(V4: a second seam — a NEW run-identity mechanism on the controller so a `Handle` reused across
runs rejects loudly rather than silently writing into the wrong run's session — was scoped here
for the importable `modify(handle, fn)` form (REQ-TSD-12.5). That form and its run-identity
mechanism are DEFERRED per the post-design foresight gate, obs #2128; see §4.4's "Run-identity
mechanism" subsection, now marked DEFERRED prior art.)

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/define-dialect.ts` | Modify | `DialectWriteOps.modify(content)`→`replaceContent`; `Handle` `raw(fn)`→`modify(fn:(ast)=>void)`; `RESERVED_HANDLE_NAMES` → **exported ordered 9-array** (+`replaceContent`), collision check `.includes`, `raw`-collision hint naming `.modify(fn)` |
| `src/core/dialect-handle.ts` | Modify | `runRaw`→`runModify(fn)` + tail `raw() on`→`modify() on`; `runModify(content)`→`runReplaceContent` + ADR-0039 message rewrite; base dispatchers `raw`/`modify`→`modify`/`replaceContent`; `isThenable` JSDoc `.raw`→`.modify` (V4: `#origin`/`#bindOrigin()` cross-run guard DEFERRED with REQ-TSD-12, obs #2128 — see §4.4) |
| `src/core/base-handle.ts` | Modify | `WriteOps.modify(content)`→`replaceContent` |
| `src/commons/index.ts` | Modify | 3 sites (build{Writable,Found}Handle method + top-level fn) + named export `modify`→`replaceContent`; 3 JSDoc `@example` |
| `src/core/handle-state.ts` | Modify | `WritableHandle` JSDoc `@example`/verb-list comments `modify`→`replaceContent` (no interface-body change; confirmed no `.d.ts` churn) |
| `src/dialects/typescript/index.ts` | Modify | module JSDoc `.raw()`→`.modify()` (V4: importable `export function modify(handle, fn)` DEFERRED with REQ-TSD-12, obs #2128 — see §4.4) |
| `src/dialects/typescript/ops.ts` | Modify | collision hint `…edit it with .raw().`→`.modify().` (REQ-TSD-01.3) |
| `src/conformance/index.ts` | Modify | `OpExercise.chain` step `{raw}`→`{modify}`; dispatch `"raw" in step ? handle.raw` → `"modify" in step ? handle.modify`; JSDoc |
| `docs/authoring-a-dialect.md` | Modify | `.raw()`→`.modify(fn)` (chained form only; importable form DEFERRED, obs #2128), `.modify(content)`→`.replaceContent`; two-realms/async sections (REQ-DAS-01) |
| `docs/authoring-verbs.md` | Modify | verb list `modify`→`replaceContent` + cross-ref line to `.modify(fn)`; wire-label rationale breadcrumb (REQ-AEC-13) |
| `docs/authoring-errors.md`, `docs/dry-run.md` | Modify | `verb` labels the WIRE mutation statement (REQ-AEC-13) |
| `docs/quickstart.md`, `README.md` | Modify | verb list `modify`→`replaceContent` |
| `SECURITY.md` | Modify | `.raw()`→`.modify(fn)` trust sentence + "conformance≠safety"; ZERO `.raw` remain (REQ-STD-01) |
| `ROADMAP.md` | Modify | 6 `.raw` mentions→`.modify` (5 paren-less L80/121/253/277/286 + L142) — nit 2 |
| `openspec/decisions/0039-*.md` | Modify | guard target `.modify()`/`runModify`→`.replaceContent()`/`runReplaceContent`, amend in place |
| `test/fitness/dts-baseline/core.define-dialect.d.ts` | Create | NEW 10th FIT-04 pair — MUST exhibit `Handle`: `replaceContent` + `modify(fn:…)`, ZERO `raw` member (REQ-FIT-04) |
| `test/fitness/dts-baseline/{commons.index,core.base-handle,typescript.index}.d.ts` | Modify | regen renamed members |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modify | `DTS_PAIRS` gains 10th entry |
| `test/core/define-dialect-collision.test.ts` | Modify | reserved loop drops `raw` (own test); +REQ-DG-02.6/.7/.8 (raw+replaceContent collide, `raw`-hint, modify collides, exact 9-array `toEqual`) |
| `test/core/dialect-handle.test.ts` | Modify | `.raw(`→`.modify(`; `.modify(`str→`.replaceContent(`; tail pins `raw() on`→`modify() on`; ADR-0039 reject byte-exact + absent-from-`.modify(fn)`; cross-run reject |
| `test/types/define-dialect.test.ts` | Modify | `.modify` fn-only, `.replaceContent` string-only, `.raw` absent (type + `'raw' in handle`) |
| `test/fitness/fit-raw-sweep` (new guard) + host | Create | REQ-KIT-03 repo sweeps: `\.raw\(` over src JSDoc; **substring `.raw`** over ROADMAP/SECURITY/docs; `modify(` free-call ban |
| ~12 more test/fixture files | Modify | call-site rename + pins: `test/e2e/{dialect-modify,toy-dialect-skeleton,author-to-tree}.e2e.test.ts`, `test/conformance/planted/*`, `test/golden-ir/*`, `test/dry-run/plan.test.ts`, `test/fitness/fit-{19,20}*.ts`, `test/docs/security-authoring-guard.test.ts`, `test/fixtures/red/dialect-generics/async-op-rejects.ts`, `test/skeleton/handle-chaining.test.ts` |

**Read-only refs**: `src/core/directive-factory.ts` (`factory.modify` name UNCHANGED, REQ-KIT-03), `src/core/wire.ts` (`{op:"modify"}` byte-identical), `src/core/authoring-error.ts`/dry-run (`AuthoringVerb` KEEPS `"modify"`, REQ-AEC-13), `src/core/context.ts` (`outside-run` `AuthoringError` reused).

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Dialect wholesale replace `.modify(content)` | Modify | REQ-KIT-03, REQ-MC-08 | `test/e2e/dialect-modify.e2e.test.ts` (extend) | verb → `.replaceContent(content)` |
| Dialect AST escape `.raw(fn)` | Modify | REQ-DG-03, REQ-TSD-01/04 | `test/e2e/dialect-modify.e2e.test.ts`, `toy-dialect-skeleton.e2e.test.ts` | verb → `.modify(fn)` (chained form only; importable form + REQ-TSD-12 DEFERRED, obs #2128) |
| Commons top-level `modify(path,content)` | Modify | REQ-KIT-03 | `test/e2e/author-to-tree.e2e.test.ts` | → `replaceContent(path,content)` |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/base-handle.ts` `WriteOps` | modify | commons wholesale verb rename | aligns |
| `commons/index.ts` (3 sites + export) | modify | rename propagates to author surface | aligns |
| `core/define-dialect.ts` `Handle`/`DialectWriteOps`/`RESERVED_HANDLE_NAMES` | modify | the FROZEN type: `raw` removed, `modify` polymorphism, reserve-both | **deviates → ADR-01** |
| `core/dialect-handle.ts` controller | modify | runtime dispatch rename + guard relocation (run-identity stamp DEFERRED, obs #2128) | aligns — kit-internal, executor latitude |
| `dialects/typescript/index.ts` | modify | module JSDoc `.raw()`→`.modify()` migration (importable `modify` export DEFERRED, obs #2128) | aligns |
| `conformance/index.ts` `OpExercise.chain` | modify | published chain-step contract `{raw}`→`{modify}` | **deviates → ADR-02** |
| `openspec/decisions/0039-*.md` | modify | guard target rename, amend in place | aligns — ADR-0037/0012 precedent (**ADR-03**) |
| FIT-04 baselines (+`core.define-dialect.d.ts`) | new | 10th pair gates `Handle`'s real shape | aligns — new pair in existing gate |

## 4.3 Data Model

No data model changes. No schema, no DB, no new wire shape — `{op:"modify"}` is byte-identical (out of scope).

## 4.4 Interface Contracts

**Dialect `Handle` (final shape, `define-dialect.ts`)**:
```ts
type DialectWriteOps<Ast, Ops> = {
  replaceContent(content: string): Edited<Ast, Ops>;   // was modify(content: string)
  rename(...): Edited; move(...): Edited; copy(...): Edited;
};
export type Handle<State, Ast, Ops> = ReadOps & DialectWriteOps<Ast, Ops>
  & { modify(fn: (ast: Ast) => void): Edited<Ast, Ops> }  // was { raw(fn): … }
  & OpMethods<Ast, Ops> & (State extends "found" ? { remove(): void } : {}) & PromiseLike<void>;
```
`modify` fn-only, `replaceContent` string-only — DISTINCT methods, no overload (REQ-DG-03.3 / REQ-MC-08.6 negative pins). `raw` absent at type AND runtime (`'raw' in handle === false`, satisfied because the base object literal loses its `raw` key).

**Commons `WriteOps` (`base-handle.ts`)**: `replaceContent(content: string): WritableHandleRef` (no `.modify` member → `handle.modify` fails to typecheck on commons handles, REQ-KIT-03). Named export `replaceContent` replaces `modify` → `import { modify } from ".../commons"` no longer resolves.

**`RESERVED_HANDLE_NAMES`**: exported ordered `readonly ["then","read","raw","modify","replaceContent","rename","move","copy","remove"]` (9). Was a private `Set`; becomes an exported array so REQ-DG-02.7 can `toEqual` it "as shipped"; `assertNoCompositionCollision` uses `.includes`. `raw`-name collision appends a hint clause naming `.modify(fn)` (REQ-DG-02.6); throws stay PLAIN `Error`, never `dialectError`/`isContained` (REQ-DG-02.4).

**Conformance `OpExercise.chain`**: `{op: string, args: readonly unknown[]} | {modify: (ast: unknown) => void}`; dispatch on discriminant key (`"modify" in step ? handle.modify(step.modify) : handle[step.op](...step.args)`), never misrouted (REQ-DC-02.2).

> ### DEFERRED prior art (V4, obs #2128) — Importable `modify` + Run-identity mechanism
>
> The two subsections below (importable `modify(handle, fn)` and the controller's
> `#origin`/`#bindOrigin` run-identity guard) described design for `typescript-dialect`
> REQ-TSD-12, which the owner DEFERRED at the post-design foresight gate (obs #2128) — it served
> ergonomics, not the honesty-rename problem this change answers, and was the single largest
> source of net-new complexity (a whole security subsystem) for a capability the chained
> `handle.modify(fn)` form already delivers in full. Neither is implemented in this change; both
> are preserved here as prior art for the standalone future change that ships the importable
> form. Cross-run handle-reuse posture returns to status quo for this change: `outside-run`
> already fails closed for any verb called with no active run (`authoring-error-contract`
> REQ-AEC-02); the "different active run B" case this mechanism additionally guarded against is
> NOT introduced by this change (the chained form was never spec'd to need it) and is not a new
> gap this change opens.
>
> **Importable `modify` (`typescript/index.ts`)** — trivial delegation, dialect-subpath ONLY, never kit-level (deferred REQ-TSD-12, REQ-DG-04 boundary):
> ```ts
> export function modify(handle: Handle<"found"|"writable", SourceFile, TypeScriptOps>,
>                        fn: (ast: SourceFile) => void): void { handle.modify(fn); }
> ```
> Void-returning; inherited coalescing, containment, cross-run guard IDENTICALLY (deferred REQ-TSD-12.1/.5/.6) because it would route through the same `controller.runModify(fn)`.
>
> **Run-identity mechanism (`dialect-handle.ts` — executor latitude)**.
> Problem: a `Handle` from run A reused during run B currently resolves `currentContext()` to B and silently buffers into B's session (`#registered`/`#live` already set from A). Mechanism: stamp the controller with its origin context at **first enqueue** and re-check every step:
> ```ts
> #origin: RunContext | undefined;
> #bindOrigin(): void {                       // called at the top of #chain, synchronously
>   const ctx = currentContext();             // no active run → throws outside-run (case 1)
>   if (this.#origin === undefined) this.#origin = ctx;
>   else if (this.#origin !== ctx)            // different active run (case 2)
>     throw new AuthoringError({ verb: undefined, path: this.#path,
>       reason: "outside-run", appliedCount: 0, message: <cross-run diagnostic> });
> }
> ```
> `#chain` would call `#bindOrigin()` FIRST — before `#tail`/`#registerOnce`/any buffer — so a cross-run reuse throws SYNCHRONOUSLY out of the author's `modify(h,fn)` call inside run B, propagating to `defineFactory`'s catch → discard (never a silent write; run B's batch carries nothing from `h`). Both lifetime cases would resolve to `reason:"outside-run"` per the deferred REQ-TSD-12 (case 1 falls out of the existing `currentContext()` throw unchanged; case 2 would add a diagnostic clause).
> - **Weighing**: a private **field** (not a WeakMap) — the origin is the controller's own state; a WeakMap would only be needed to key an EXTERNAL object (as `astHandlePaths` keys the live AST because ops can't reach the controller). **Synchronous** enqueue-time check (not inside the async `#tail` step) — loudness and no-silent-write both demand the throw pre-empt buffering; it also stays OUTSIDE containment (an author-structure error like the `withOps` collision), so it never touches the `#chain` poison flag or `dialectError`. Cost: one identity compare + one already-amortized ALS lookup per step. Would add an `AuthoringError` import to `dialect-handle.ts` — no fitness violation (not a kit re-export; FIT-21's `context.ts`→`dialect-handle.ts` no-import edge is untouched, direction is the reverse).
>
> Note — the orchestrator's brief suggested a "contained error" for cross-run reject; the V3 SIGNED spec (REQ-TSD-12 case 2) pinned `reason:"outside-run"` reusing case 1's family, so this design would have used `AuthoringError{outside-run}`, NOT a `dialectError`. Preserved for whichever future change resumes this.

Error taxonomy unchanged: `dialectError` (frozen `"dialect operation failed: "`, contained) for op/replaceContent-guard rejects; PLAIN `Error` for compose-time collisions; `AuthoringError{outside-run}` for the existing (unchanged, general) lifetime reject — calling any verb with no active run.

## 4.5 Architecture Decisions

### ADR-01: Honest write-verb rename on the frozen `Handle` type (NEW)
**Status**: Proposed.
**Context**: `.modify(content)` names wholesale replacement dishonestly; `.raw(fn)` exists only because `modify` was taken. `Handle` is the ONE type `architecture.md` marks FROZEN. Pre-1.0 (publish `--dry-run`, no consumers) is the last clean-break window with no deprecation machinery.
**Decision**: Unfreeze `Handle`, rename `modify(content)`→`replaceContent` and `raw(fn)`→`modify(fn)` as two DISTINCT non-overloaded methods, re-freeze via a NEW 10th FIT-04 pair `core.define-dialect.d.ts` (the only baseline whose text exhibits `Handle`'s members — the 9 existing pairs don't, verified live). Reserve-both: `RESERVED_HANDLE_NAMES` keeps `raw` blocked (muscle-memory guardrail; owner #2117) and adds `replaceContent`.
**Consequences**: (+) author vocabulary is honest; the load-bearing breaking edit is now gated. (−) ~20 call-site files break at once (mitigated by per-module slicing); a frozen type is deliberately unfrozen (justified by the pre-1.0 window). (enables) a future public dialect-kit plan inherits an honest surface.
**Alternatives**: keep `raw` — perpetuates the dishonest pair; **name it `edit`** — a third verb for a concept already owned by `modify`, no honesty gain; **`transform`** — implies a pure return-value, but the fn mutates in place; **polymorphic `modify(string|fn)`** — runtime type-sniffing, ambiguous errors, and forfeits the fn-only/string-only compile pins the spec mandates.

### ADR-02: `dialect-conformance` chain-step `{raw}`→`{modify}` (ADR-0012 amendment, in place)
**Status**: Proposed (amends Accepted ADR-0012).
**Context**: `ConformanceCase`/`OpExercise.chain`'s published discriminated-union step types the escape hatch as `{raw:(ast)=>void}` and dispatches `handle.raw`. Left unmigrated, the kit validates a verb that no longer exists.
**Decision**: Rename the discriminant key `{raw}`→`{modify}` and the dispatch target `handle.raw`→`handle.modify`, in lockstep with the same commit that renames the handle method; add a discriminant-misroute RED test (REQ-DC-02.2). Amend ADR-0012's prose in place (repo precedent), not a new decision.
**Consequences**: (+) conformance drives the real verb; misroute is now guarded. (−) a published type shape changes (pre-1.0, `./conformance` 0.x). (enables) third-party op-packs author against the honest step shape.
**Alternatives**: keep `{raw}` as a back-compat alias — reintroduces the dishonest name into a public contract this change exists to remove; dual-accept `{raw}|{modify}` — dead union member, no consumer.

### ADR-03: ADR-0039 guard relocation to `.replaceContent` (amendment, in place)
**Status**: Proposed (amends ADR-0039).
**Context**: ADR-0039's reject-while-pending guard (`runModify(content)` rejects when this handle's own AST-op directive is open) protects against silent last-write-wins. After the rename the wholesale verb is `.replaceContent`; the guard must follow the SEMANTICS (wholesale replace clobbering a pending structured edit), NOT the method name.
**Decision**: Move the guard into `runReplaceContent`; rewrite its message to the byte-exact REQ-MC-08.1 text (note: it DROPS "on the same handle" — not a pure verb swap) and PROVE it ABSENT from the new `.modify(fn)` (REQ-MC-08.5, the highest-integrity-risk negative). A characterisation test pins prior last-write-wins first (GREEN), then REQ-MC-08's reject scenarios replace it in the same slice.
**Consequences**: (+) the guard tracks meaning, not spelling; the silent-data-loss window stays closed and is now proven closed for `.modify(fn)`. (−) message text is load-bearing (byte-exact pins move). (enables) `.modify(fn)` chains coalesce freely, never swallowed as a conflict.
**Alternatives**: attach the guard to `.modify(fn)` — would reject legitimate coalescing AST edits (the exact bug REQ-MC-08.5 guards); drop the guard — restores silent last-write-wins.

## 4.6 Test Derivation

Strict TDD: **adapt-first** = literal swap in an existing green test, same commit as the source rename (rename + its call-sites are one mechanical unit); **RED-first** = new behaviour, failing test precedes code.

| REQ-ID | Scenario | Level | Test | Mode |
|---|---|---|---|---|
| REQ-KIT-03 | `replaceContent` author surface + `import{modify}` gone + `.modify` absent on commons | unit/type | `test/skeleton/*`, `test/types/*`, e2e `author-to-tree` | adapt-first |
| REQ-GIR-02 | `create-then-modify` fixture: author `.replaceContent`, wire `op:"modify"` | integration | `test/golden-ir/*` | adapt-first |
| REQ-FIT-04 | 10th pair exhibits `replaceContent`+`modify(fn)`, zero `raw`; 9 pairs regen | architectural | `fit-04-dts-semver-gate.test.ts` + baselines | RED-first (new pair) |
| REQ-STD-01 | SECURITY.md `.modify(fn)` sentence + caveat; zero `.raw` | architectural | `test/docs/security-authoring-guard.test.ts` | RED-first (absence) |
| REQ-DG-02 (.1–.8) | reserve-both collide, `raw`-hint, `modify` collide, exact 9-array `toEqual`, plain-Error | integration/type | `define-dialect-collision.test.ts`, `test/types/*` | RED-first (.6/.7/.8) / adapt (.1–.5) |
| REQ-DG-03 (.1–.4) | `.modify(fn)` coalesces; fn-only; `.raw` absent type+runtime | integration/type | `dialect-handle.test.ts`, `test/types/*` | RED-first (.3/.4) / adapt (.1/.2) |
| REQ-DG-04.1 | TS dialect imports only sanctioned surface | architectural | fit-08 (inherited) | adapt-first |
| REQ-DG-05 (.1–.4) | throwing/async `.modify(fn)` contained; tail `modify() on "{path}" threw`; no `.cause`/leak | integration | `dialect-handle.test.ts` | adapt-first (tail pins) |
| REQ-DG-06 (.1–.6) | `runOp` parity; deliberate-reject passthrough; foreign coincidental-prefix wrapped fresh | integration | `dialect-handle.test.ts` | adapt-first; **.6 tail asserts full `{op}() on "{path}" threw`** (nit 1) |
| REQ-DG-07 (.1–.3) | fail-closed after `.replaceContent` reject / collision; chained-after surfaces original | integration | `dialect-handle.test.ts`, fit-19/20 | adapt-first |
| REQ-MC-01/02/03/06 | coalesce/split/read-routing/run-end join over `.modify(fn)` | integration | `test/dialects/typescript/*`, `dialect-handle.test.ts` | adapt-first |
| REQ-MC-08 (.1–.6) | `.replaceContent` reject byte-exact, zero batches, before-buffer; absent from `.modify(fn)`; string-only | integration/type | `dialect-handle.test.ts`, `test/types/*` | RED-first (.1 strengthened/.5/.6) / char-first |
| REQ-TSD-01 (.1–.4) | op-set unchanged; collision hint `.modify()`; module JSDoc `.modify()` | integration | `ops-exact-set`, `ops-declarations*`, `.raw` sweep | adapt-first |
| REQ-TSD-03 (.1–.10) | edge rows incl `.modify(fn)` coalescing, idempotent addImport | integration | `test/dialects/typescript/*` | adapt-first |
| REQ-TSD-04 (.1–.2) | real ts-morph parse/print failure contained | integration | `print-failure.test.ts`, `dialect.test.ts` | adapt-first |
| REQ-DC-02 (.1–.2) | chain `{modify}` fidelity; discriminant-misroute RED | integration | `typescript-conformance.test.ts`, planted | RED-first (.2) |
| REQ-DC-03 / REQ-DC-04 | coalesce content-verified; `.modify(fn)` smuggling fails suite | integration | `typescript-conformance.test.ts`, planted `*.ts` | adapt-first |
| REQ-DAS-01 (.1–.3) | doc names shipped API only (chained form; importable form deferred, obs #2128); two-realms/async sections | architectural | `test/docs/*` guard | adapt-first |
| REQ-AEC-13 (.1–.3) | failed `.replaceContent` reports `verb:"modify"`; documented in 3 places | unit | `test/dry-run/*`, `test/docs/*` | RED-first (.3 doc) / adapt |

Every Create/Modify flow (4.2b) has ≥1 e2e row (`dialect-modify`, `toy-dialect-skeleton`, `author-to-tree`).

## 4.7 Fitness Functions

- **FIT-04 10th pair** `core.define-dialect.d.ts`: gates `Handle`'s member shape forever; content must exhibit `replaceContent`+`modify(fn:…)` and ZERO `raw` member (REQ-FIT-04).
- **`.raw` repo sweep (REQ-KIT-03 V3)**: `\.raw\(` over `src/**` JSDoc + `README`/`SECURITY`; **substring `.raw` (paren-less)** over `ROADMAP.md`/`SECURITY.md`/`docs/**` — the widened predicate (nit 2) catches ROADMAP L80/121/253/277/286 the `\.raw\(` regex misses.
- **`modify(` free-call sweep (REQ-KIT-03 V2/V4)**: bans the old commons string-form `modify(path,content)`; EXCLUDES `.modify(fn)`, `factory.modify(`. (V4: the V3 `modify(handle` importable-form doc-snippet exclusion is REMOVED — moot, since the importable form is DEFERRED, obs #2128.)
- **Wire-op pin (unchanged)**: `{op:"modify"}` byte-identical; `AuthoringVerb`/`DryRunVerb` KEEP `"modify"` (REQ-AEC-13) — an architectural/golden pin that a rename must NOT touch.
- **FIT-08 (inherited)**: no kit-symbol re-export from `./typescript` — unchanged, exercised only against the chained-form surface this change ships (the importable `modify` export and its FIT-08 exercise are DEFERRED with REQ-TSD-12, obs #2128).

## 4.8 Migration / Rollout

Source-only, pre-1.0, no data/migration/backfill. Recommended slice order (sdd-slice owns final cut, target 4–7):
1. **Walking skeleton — escape-hatch + wholesale rename vertical** (ATOMIC, one commit on the type↔wrapper seam): `define-dialect.ts` + `dialect-handle.ts` both renames together (freeing+reassigning `modify` in one commit — a split leaves a duplicate-`modify` compile error), tail literal, base dispatchers, `RESERVED_HANDLE_NAMES` array, FIT-04 10th pair, core type pins, `typescript/index.ts` JSDoc. End-to-end `.modify(fn)`→committed directive. (V4: run-identity `#origin`/`#bindOrigin` + importable `modify` export DEFERRED with REQ-TSD-12, obs #2128 — dropped from this slice's scope.)
2. **ADR-0039 guard slice**: `runReplaceContent` message rewrite + REQ-MC-08.1 strengthened + REQ-MC-08.5 absent-from-`.modify(fn)` negative + characterisation test.
3. **Commons surface**: `base-handle.ts`, `commons/index.ts`, `handle-state.ts` + their tests/baselines.
4. **Conformance**: `conformance/index.ts` `{raw}`→`{modify}` + misroute RED + planted fixtures.
5. **Docs + sweeps**: `authoring-a-dialect`/`authoring-verbs`/`authoring-errors`/`dry-run`/`quickstart`/`README`/`SECURITY`/`ROADMAP` + ADR-0039 file + the `.raw`/`modify(` guard tests.

**Merge order**: this change lands BEFORE `ts-dialect-backend-ops` resumes (shared `typescript/{ops,index}.ts` + `conformance/index.ts`); sequence after that change's rebase.

## 4.9 Performance

No significant impact — a mechanical rename. (V4: the run-identity check's cost note is moot — that mechanism is DEFERRED, obs #2128; see §4.4.)

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: two `deviates` touchpoints (4.2c) — the FROZEN `Handle` type's members rename (ADR-01) and the published `conformance` chain-step contract shape changes (ADR-02) — make parts of the baseline (`architecture.md`'s `.raw`/`.modify(content)` descriptions, the "5 subpaths" op-surface prose) outdated. No boundary removed, pattern intact, wire IR/subpath-count unchanged → not `breaking`; existing frozen members rename rather than only-add → not `additive`. Post-verify `arch_refresh_post_verify` should refresh the `Handle`/dialect-surface prose.

## 4.11 Open Questions

None.

## Carried-nit dispositions (obs #2125)

1. **REQ-DG-06.6 tail shorthand** — the scenario's `{op}() threw` is shorthand; the SHIPPED/authoritative tail is `{op}() on "{path}" threw` (REQ-DG-05, same-file REQ-DG-05.3). Disposition: **implementation note** — tests assert the full tail; no signed-spec edit.
2. **ROADMAP `.raw` sweep** — the `\.raw\(` predicate misses ROADMAP's 5 paren-less `.raw` (L80/121/253/277/286). Disposition: **design-actioned** — migrate all 6 ROADMAP mentions and widen the prose-doc sweep arm to substring `.raw` (4.7); no signed-spec edit (refines REQ-KIT-03's INTENT, already "zero `.raw`").
3. **foundations-skeleton L40 exclusion-list grammar** — cosmetic parenthetical in a SIGNED spec. Disposition (SUPERSEDED, V4): the spec was unfrozen anyway for the V4 scope reduction (owner-directed, obs #2128), so this nit was fixed in passing, co-located with the exclusion-clause edit it sat inside — no separate unfreeze cost incurred.
4. **V4 scope reduction — importable `modify(handle, fn)` + run-identity guard subsystem DEFERRED** (obs #2128, post-design foresight gate). Disposition: **owner-directed, actioned** — `typescript-dialect` REQ-TSD-12 RETIRED (tombstoned, not renumbered); `dialect-authoring-standards` REQ-DAS-01's importable-form doc mandate and its cross-run-reuse clause REMOVED; `foundations-skeleton` REQ-KIT-03's now-moot `modify(handle` sweep exclusion REMOVED; `authoring-error-contract` REQ-AEC-13's parenthetical updated (substance unchanged); design.md's importable-`modify`/run-identity sections (§4.4) marked DEFERRED prior art, File Changes/Test Derivation/Flow Changes/Touchpoints tables updated accordingly. ADR-01/02/03 untouched — none concerned the deferred piece. V3 text and the `#origin`/`#bindOrigin` mechanism are preserved as prior art (this file's history + engram obs #2119/#2126) for the standalone future change.
