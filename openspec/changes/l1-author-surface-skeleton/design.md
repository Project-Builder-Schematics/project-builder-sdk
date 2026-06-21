# Design: L1 Author Surface — Walking Skeleton

**Change**: `l1-author-surface-skeleton` · **Triage**: M · **Parent**: `l1-author-surface` (#1 of 4)
**Spec version**: V1 (signed) · **Persona lens**: architect
**Architecture impact**: modifying

## 4.1 Architecture Overview

This skeleton threads four seams thinly through the existing single-layer library
(`src/commons/` author verbs → `src/core/` Session/context → `src/core/engine-client.ts` port →
contract fake). It adds **two new modules** inside the established boundaries and **modifies one
established contract**:

- **SEAM-01** (`create<S>`): a type-level-only generic overload in `src/commons/index.ts`. No
  runtime change, no new module — a signature widening that narrows `options` for one schema key.
- **SEAM-02** (dry-run renderer): a NEW author-side module `src/dry-run/plan.ts` that consumes a
  read-only `Directive[]` snapshot and renders author vocabulary. It is **AST-blind and core-blind**
  by construction (REQ-05) — it imports only the `Directive` type from `wire.ts`, nothing from
  `src/core/**` runtime.
- **SEAM-03** (commit/discard): **reverses** the documented partial-write contract in
  `context.ts:33-37` AND **grows the `EngineClient` port** with `commit()`/`discard()`. The
  staging→commit boundary is an ENGINE concern, not an SDK one — directives are already emitted to
  the engine's staging mid-run (`session.ts:27` `read()` flushes before reading, for
  read-your-own-writes / REQ-KIT-02), so "don't emit on throw" is impossible; the engine must STAGE
  emitted ops and commit/discard them transactionally. The SDK declares the two new port methods the
  engine §6 will fulfill; the fake models them now. `defineFactory`'s `finally` becomes
  commit-on-success / discard-on-throw, delegating through `Session.commit()`/`Session.discard()`
  (which own `#client`). The fake grows a committed-tree phase as a test-only assertion surface. See
  ADR-01 (commit boundary + port growth) and ADR-02 (scope of the "frozen port" — `emit`'s signature,
  not the member set).
- **SEAM-04** (error attribution): a NEW thin wrap module `src/core/authoring-error.ts` defining
  `AuthoringError` and a translate function, applied at the `Session.flush` emit call site. See ADR-02.

The seam that matters architecturally is SEAM-03: it crosses the `Session ↔ EngineClient` boundary,
**adds two members to the `EngineClient` port** (`commit`/`discard`), and changes a published-in-JSDoc
behavioural contract. The real transactional commit is an engine §6 deliverable; the skeleton
**models** it in the fake and marks the engine dependency — it does not invent a transaction in
`src/`. Port growth is ADDITIVE: `emit(batch)`/`read(path)` signatures are untouched, so the wire
contract (`wire.ts` `Directive`/`Batch`) and FAKE-01..06 fidelity are unaffected.

## 4.2 File Changes (CONTRACT WITH SLICE)

| Path | Action | Purpose |
|---|---|---|
| `src/commons/index.ts` | Modify | Add type-level `create<S>` generic overload narrowing `options` to one schema-derived key; keep bare-`JsonValue` overload (REQ-01). Runtime body unchanged (REQ-02). |
| `src/dry-run/plan.ts` | Create | `dryRunPlan(snapshot: Directive[]): DryRunEntry[]`; maps each op to `{verb, path}` in author vocabulary; imports ONLY `type Directive` from `../core/wire.ts` (REQ-04, REQ-05). |
| `src/core/engine-client.ts` | Modify | Grow the port: add `commit(): Promise<void>` and `discard(): Promise<void>` to the `EngineClient` interface (ADR-01). ADDITIVE only — `emit`/`read` signatures unchanged (ADR-02). The two methods declare the engine §6 transactional boundary the SDK depends on; the fake implements them now, the real client later. |
| `src/core/session.ts` | Modify | Add `pendingSnapshot(): Directive[]` returning a defensive copy of `#pending` (REQ-03). Wrap the `#client.emit` call in `flush()` with the attribution translate (REQ-12). Add `commit(): Promise<void>` / `discard(): Promise<void>` thin wrappers delegating to `#client` (Session owns `#client`; keeps `defineFactory` off direct transport access — ADR-01). |
| `src/core/context.ts` | Modify | `defineFactory`: commit-on-success / discard-on-throw via `session.commit()` / `session.discard()`; reword partial-write JSDoc to all-or-nothing (REQ-06, REQ-07, REQ-09). |
| `src/core/authoring-error.ts` | Create | `AuthoringError` class (`verb`, `path`) + `toAuthoringError(raw, directive)` translate; author vocabulary only, no engine strings leaked (REQ-10, REQ-11, REQ-12). |
| `test/support/contract-fake.ts` | Modify | Implement the two new `EngineClient` port members `commit()`/`discard()` (now `Promise<void>` to satisfy the interface) over a `#committed` tree; `read()` keeps reading the staging `#tree` (read-your-own-writes preserved). Committed tree is a separate assertion surface only (REQ-08). |
| `src/dry-run/index.ts` | Create | Re-export `dryRunPlan` + `DryRunEntry` from the dry-run module (subpath surface seed; NOT added to package exports this change). |
| `test/types/typed-create.test.ts` | Create | `expect-type` positive proof (REQ-01.1) + untyped backward-compat case (REQ-01.3). |
| `test/types/permissive-proof.ts` | Modify | Add the `create<S>` excess-field negative proof case (REQ-01.2). |
| `test/dry-run/plan.test.ts` | Create | Unit: all-six-ops mapping, primary-path extraction, write-only-chain equality (REQ-04.1/.2/.3). |
| `test/dry-run/no-import.test.ts` | Create | Fitness: trace `src/dry-run/**` import graph — no `src/core/**` runtime, no AST package (REQ-05.1 / FIT-01 extension). |
| `test/skeleton/session.test.ts` | Modify | Add `pendingSnapshot` reflects-buffer + isolation-from-mutation cases (REQ-03.1, REQ-03.2). Gap-#1 sweep: `makeOrderedClient` (~L18) + inline (~L45) `EngineClient` literals gain `commit`/`discard` (stub) so they typecheck against the grown port. |
| `test/skeleton/read-your-own-write.test.ts` | Modify | Gap-#1 sweep (iter-3): the `observeCallOrder` wrapper (~L16) forwards `commit`/`discard` to its inner `EngineClient`. |
| `test/skeleton/handle-chaining.test.ts` | Modify | Gap-#1 sweep (iter-3): the `makeSpy` literal (~L21) gains `commit`/`discard` (forward if wrapping an inner client, else no-op stubs). |
| `test/skeleton/commit-discard.test.ts` | Create | Cross-boundary: success commits full batch; throw leaves committed empty + staging discarded; forced-rejection discard; JSDoc source-scan (REQ-06, REQ-07, REQ-09). |
| `test/skeleton/write-only-factory.test.ts` | Modify | **Reverse** the partial-write assertion at lines 40-51: a throwing factory MUST leave the committed tree empty (was: `src/partial.ts` readable). Aligns the suite with the new contract (REQ-07, REQ-09). |
| `test/fake/commit-discard.test.ts` | Create | FAKE unit: `commit()` promotes staging→committed + clears staging; `discard()` clears staging, committed untouched; committed independence after re-stage (REQ-08.1/.2/.3). |
| `test/skeleton/error-attribution.test.ts` | Create | Cross-boundary, fake unmocked both sides: forced collision → `AuthoringError{verb,path}`, no `ContractFake:`/`OpMove` text; committed empty (REQ-10, REQ-11, REQ-12, REQ-13). |
| `src/index.ts` | Read-only | Confirm umbrella re-export scope unchanged — dry-run NOT added to the public surface this change. |

## 4.2b Flow Changes

**Flow Changes: not applicable** — `@pbuilder/sdk` is a library with no UI/CLI/HTTP user-visible
flows. The "user surface" is the TypeScript API and its compile-time + runtime behaviour, covered by
`unit`, `contract`, `integration` (cross-boundary), `type-level`, and `architectural` tests. There is
no E2E flow harness in this project (architecture baseline: 0 REST/GraphQL/WS/gRPC). Cross-boundary
seam tests (fake unmocked both sides) are the integration-level proof in lieu of E2E.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/commons/` (author verbs) | extend | `create<S>` type-level overload; new verb-shape, same module | aligns |
| `src/dry-run/` (author-side renderer) | new | author-vocabulary plan render; new module in EXISTING lib layer, AST-blind | aligns |
| `src/core/engine-client.ts` (port) | extend | add `commit()`/`discard()` members; `emit`/`read` signatures unchanged | deviates → ADR-01 |
| `src/core/` Session | extend | `pendingSnapshot()` accessor + attribution wrap at emit site + `commit()`/`discard()` delegating wrappers | aligns |
| `src/core/authoring-error.ts` | new | error-attribution type + translate; new module in EXISTING core kit | aligns |
| Session ↔ EngineClient boundary (commit contract) | modify | partial-write JSDoc contract reversed to all-or-nothing; commit/discard now flows port→Session→defineFactory | deviates → ADR-01 |
| Error vocabulary at the seam | modify | engine strings translated to author vocabulary before crossing to `defineFactory` | deviates → ADR-02 |
| `test/support/contract-fake.ts` | extend | committed/staging two-phase model for commit/discard assertions | aligns |

Three `deviates` rows: two map to ADR-01 (the port-member addition and the commit-contract reversal
are one decision — the all-or-nothing boundary — so they share ADR-01), one maps to ADR-02 (error
vocabulary translation). All `new` rows join the EXISTING single-layer library — no new architectural
layer is introduced, so they are `aligns`.

## 4.3 Data Model

```ts
// src/core/engine-client.ts (PORT GROWTH — additive, ADR-01)
export interface EngineClient {
  emit(batch: Batch): Promise<void>;   // unchanged
  read(path: string): Promise<string>; // unchanged
  commit(): Promise<void>;             // NEW: promote staged ops to durable; all-or-nothing
  discard(): Promise<void>;            // NEW: drop staged ops; committed state untouched
}

// src/core/authoring-error.ts
export type AuthoringVerb = "create" | "modify" | "delete" | "rename" | "move" | "copy";
export class AuthoringError extends Error {
  readonly verb: AuthoringVerb;
  readonly path: string;
  // Gap-#2 (plan-verify iter-3): message is a FRESH author-vocabulary string built
  // from verb+path; the raw engine message is DISCARDED. The skeleton sets NO `.cause`
  // and embeds no raw engine string — so the no-engine-text guarantee (REQ-11/12.2/13.1)
  // holds for the WHOLE error object, not only `.message`. Cause-chaining / rich context
  // is deferred to #3 (attribution freeze).
}
export function toAuthoringError(raw: unknown, directive: Directive): AuthoringError;

// src/dry-run/plan.ts
export interface DryRunEntry { verb: AuthoringVerb; path: string; }
export function dryRunPlan(snapshot: Directive[]): DryRunEntry[];

// src/core/session.ts (additions)
pendingSnapshot(): Directive[];   // defensive copy of #pending
commit(): Promise<void>;          // delegates to #client.commit() — Session owns transport
discard(): Promise<void>;         // delegates to #client.discard()

// test/support/contract-fake.ts (implements the grown EngineClient port)
#committed: Map<string, string>;          // empty until commit()
async commit(): Promise<void>;   // atomically promote #tree → #committed, clear #tree
async discard(): Promise<void>;  // clear #tree, leave #committed untouched
committedTree(): ReadonlyMap<string, string>;  // test-only assertion accessor (NOT on the port)
```

No wire-contract change: `Directive`/`Batch` in `wire.ts` are untouched, and `emit`/`read` signatures
are unchanged — `commit`/`discard` are NEW members on `EngineClient`, not modifications to existing
ones. `AuthoringError` is an in-process SDK type, not a wire shape. `committedTree()` stays a
fake-only accessor — it is NOT added to the `EngineClient` port (assertion surface, not transport).

## 4.4 Interface Contracts

- **`create<S>`** — single generic overload, **NO named `OptionsOf<S>` helper this change** (gap #2 pinned). The `options` field is the bare INLINE mapped type `{ [K in keyof S]: S[K] }` written directly in the overload signature. Exact surface:
  ```ts
  // src/commons/index.ts — type-level only, runtime body unchanged
  export function create<S>(
    path: string,
    opts: { template: string; options: { [K in keyof S]: S[K] }; force?: boolean }
  ): WritableHandle;
  // plus the existing bare overload, retained for backward-compat (REQ-01.3):
  export function create(
    path: string,
    opts: { template: string; options: JsonValue; force?: boolean }
  ): WritableHandle;
  ```
  - **"a schema `S`" at the type level for this skeleton** = any object type; the thin proof uses a single-field object, e.g. `type S = { name: string }`, making `options` resolve to `{ name: string }`. The `expect-type` positive proof (REQ-01.1) asserts `create<{ name: string }>(…, { template, options: { name: "x" } })` compiles; the negative proof (REQ-01.2) asserts an EXTRA field (`{ name: "x", extra: 1 }`) is a compile error via excess-property checking on the mapped type.
  - **Why no named helper**: program SEAM-01 explicitly assigns the full `OptionsOf<S>` derivation (schema-aware option typing — defaults, optionality, nested shapes) to sub-change **#2**. Naming the alias here would imply a derivation contract this skeleton does not implement and #2 owns. The bare inline mapped type is the minimal type-level seam: it proves the overload narrows `options` to the schema's keys, nothing more. `{ [K in keyof S]: S[K] }` is an identity mapped type over `S` — chosen over plain `S` so the seam is visibly a mapped type (the shape #2 replaces with `OptionsOf<S>`), not a bare type parameter that #2 would have to restructure.
- **`dryRunPlan`** — pure: `Directive[] → DryRunEntry[]`. Primary path per op: `pathTemplate` (create), `path` (modify/delete/rename/move), `from` (copy). Verb vocabulary is the six wire op kinds (`create/modify/delete/rename/move/copy`) per REQ-04.2/REQ-10 — note the author surface verb for wire `delete` is `remove`, but the renderer and `AuthoringError` fix the verb set to the wire op kinds.
- **`AuthoringError`** — error taxonomy surfaced to the factory author: exactly one variant this change, carrying `verb` + `path`. `appliedBoundary` and per-op coverage deferred to #3.
- **Attribution extraction (REQ-12)** — at `Session.flush`, the wrap catches the error from `#client.emit(batch)` and calls `toAuthoringError(raw, attributedDirective)`. **Extraction strategy**: the skeleton attributes to the **first instruction of the flushed batch** (`batch.instructions[0]`). Rationale: the engine error is opaque (the fake throws a bare `Error` with no op index), so the skeleton cannot recover WHICH directive failed mid-chain. The single-directive forced-rejection case (REQ-11/REQ-13) makes first-instruction attribution exact; mid-chain applied-boundary attribution (knowing op N failed) is explicitly deferred to #3 `error-and-commit-contract`. This fallback is the load-bearing decision the spec's "first failing directive" wording (REQ-12.1) maps onto — documented here so #3 replaces it deliberately, not by surprise.

## 4.4b defineFactory Control Flow (commit/discard sequence — gap #3)

Exact sequence the executor transcribes. The current `try { run } finally { flush }` shape (a `finally`
that ALWAYS flushes) is REPLACED — `finally` cannot distinguish success from throw, and the new
contract needs that distinction (commit vs discard). The final flush moves **inside the `try`** so a
flush-time engine rejection routes to the discard + re-throw path (REQ-07.3 / REQ-12 — the forced
rejection happens at emit, inside `flush`).

```
return async (o, { client }) => {
  const ctx = { session: new Session(client), factory: new DirectiveFactory() };
  try {
    await als.run(ctx, () => fn(o));   // run factory in ALS run-context
    await ctx.session.flush();         // emit any remaining buffered #pending
                                       //   - mid-run read()s already flushed earlier (REQ-KIT-02)
                                       //   - a flush rejection here is ALREADY an AuthoringError
                                       //     (Session.flush wraps the emit call — ADR-02), so it
                                       //     propagates to catch as an AuthoringError
    await ctx.session.commit();        // success path: promote staged → committed (all-or-nothing)
  } catch (err) {
    await ctx.session.discard();       // throw/reject path: drop staged, committed stays empty
    throw err;                         // re-throw the original/attributed error (never swallow)
  }
};
```

Key points:
- **No `finally`.** Success and failure are different paths (commit vs discard), so the branch is
  `try { run; flush; commit } catch { discard; throw }`. There is no code that must run on both paths.
- **The final `flush()` is INSIDE the `try`**, BEFORE `commit()`. A flush-time `emit` rejection (the
  forced-rejection REQ-07.3 / REQ-12 path) is thrown out of `flush()`, skips `commit()`, and lands in
  `catch` → `discard()` → re-throw. So a rejected flush commits NOTHING (REQ-07).
- **Attribution already happened in `flush`** (ADR-02 wraps the `#client.emit` call site), so the value
  reaching `catch` is already an `AuthoringError` for the emit-rejection case (REQ-12.1). A throw
  raised by the factory body BEFORE flush is re-thrown as-is (it is the author's own error, not an
  engine error) — still routes through `discard()` (REQ-12.2 / REQ-07.1).
- **`discard()` then re-throw** preserves the error identity; `defineFactory` never converts or
  swallows it (REQ-11.2 — the `AuthoringError` propagates, not a generic `Error`).

Consistency check against signed REQs:
- REQ-06 (success commits full batch): `flush()` emits all `#pending`, then `commit()` promotes the
  full staged set — ✓.
- REQ-07 (throw commits nothing): any throw (factory body OR flush rejection) → `catch` → `discard()`,
  `commit()` never runs, committed tree stays empty — ✓.
- REQ-09 (JSDoc all-or-nothing): the reworded JSDoc states success commits the full set, any throw
  commits nothing — matches the control flow — ✓.
- REQ-12.2 (discard fires after AuthoringError): the `AuthoringError` from `flush` lands in `catch`,
  which calls `discard()` before re-throwing — ✓.

## 4.5 Architecture Decisions

### ADR-01: All-or-Nothing Commit — Reverses the Partial-Write Contract AND Grows the EngineClient Port (SEAM-03)

**Status**: Accepted (amended 2026-06-21, plan-verify iter-2 resolution)

**Context**: `context.ts:33-37` JSDoc documents a *partial-write* contract — a factory that throws
after buffering still emits buffered directives, no rollback. The existing test
`write-only-factory.test.ts:40-51` asserts exactly this (a thrown factory leaves `src/partial.ts`
readable). The L1 release contract (program SEAM-03) requires all-or-nothing: success → full commit,
throw → full discard, commit nothing.

Crucially, **"don't emit on throw" is impossible**: `session.ts:27` `read()` calls `flush()` BEFORE
delegating to `#client.read()` (read-your-own-writes, REQ-KIT-02), and `flush()` (`session.ts:33-41`)
`splice`s `#pending` and `emit`s mid-run. So by the time a later factory line throws, directives are
already emitted to the engine's staging. The all-or-nothing boundary therefore CANNOT live in "decide
whether to emit" — it must be a transactional **staging → commit / discard** boundary OWNED BY THE
ENGINE. The SDK's job is to declare that boundary on its transport port and invoke it; the real
transactional commit is an unbuilt engine §6 deliverable; only the fake exists today.

The current `EngineClient` port (`engine-client.ts:6-9`) exposes only `emit`/`read` — it has no
commit boundary. `defineFactory` receives `{ client: EngineClient }` (`context.ts:41`), so any commit
call it makes must be a member of `EngineClient`, or it will not typecheck. The port MUST grow.

**Decision** (two coupled parts, one boundary):

1. **Grow the `EngineClient` port** (`engine-client.ts`) with `commit(): Promise<void>` and
   `discard(): Promise<void>`. This is ADDITIVE — `emit(batch)`/`read(path)` signatures are untouched.
   The engine stages emitted ops and commits/discards them transactionally; the SDK declares the
   contract the engine §6 fulfills and the fake models now.
2. **Reverse the contract at the SDK seam.** `defineFactory`'s `finally` becomes: `fn` resolved →
   `session.flush()` (emit any remaining buffered `#pending`) then `session.commit()`; `fn` threw (or
   a flush rejected) → `session.discard()`, then re-throw the original/attributed error, so the
   committed tree stays empty. `Session.commit()`/`Session.discard()` are thin wrappers delegating to
   `#client` — see the WHERE decision below.

Model commit/discard in `ContractFake` via a `#committed` tree promoted only on `commit()`. Reword the
JSDoc to all-or-nothing. Mark the real-engine transaction as a §6 dependency — do NOT implement a
transaction in `src/`.

**WHERE the commit/discard calls originate** — through `Session.commit()`/`Session.discard()` thin
wrappers, NOT `client.commit()` directly in `defineFactory`. Reasoning: `defineFactory` today never
names `client` after `new Session(client)` (`context.ts:44`) — all transport flows through
`ctx.session` (`session.flush()` at `context.ts:52`). `Session` is the sole owner of `#client`.
Calling `client.commit()` directly from `defineFactory` would introduce a NEW direct
`defineFactory → EngineClient` coupling that does not exist today; the Session wrapper preserves the
established seam (defineFactory orchestrates run-lifecycle, Session owns transport). Boring,
pattern-matching, no new edge in the dependency graph.

**Consequences**:
- (+) The release's all-or-nothing guarantee is exercised by a real forced rejection from day one (obs 648 lesson: lifecycle guarantees tested, not JSDoc-only).
- (+) #3 `error-and-commit-contract` extends a working commit/discard slot rather than inventing one.
- (+) The port now expresses the engine's real transactional shape — #2/#3/#4 build against a stable surface, not a leaky `emit`-only port that hides the commit boundary.
- (−) The existing partial-write test MUST be reversed — a behavioural test change, not just additive. The suite gains a deliberately-flipped assertion (tracked in File Changes).
- (−) The fake now carries a two-phase model the real engine must eventually match; divergence risk until §6 lands (mitigated by marking the dependency).
- (−) The port grows two members the real Go client must implement before §6; the contract fake is the conformance anchor until then.

**Alternatives Considered**:
- **Keep partial-write, defer all-or-nothing to #3**: rejected — the skeleton's whole purpose is to thread the seam where foundations-skeleton's masked criticals lived; deferring leaves the most dangerous seam unexercised in the spine.
- **Implement a real transaction in `src/` now**: rejected — invents an engine §6 deliverable the SDK does not own; violates "model the dependency, don't invent it."
- **Buffer-and-replay rollback in the Session**: rejected — duplicates transactional semantics the engine will own; two sources of truth for the commit boundary. Also impossible cleanly given mid-run `read()` already flushed to staging.
- **"Just don't `emit` on throw"** (no port growth): rejected — IMPOSSIBLE. `read()` flushes mid-run for read-your-own-writes, so directives are already staged before a later throw; there is nothing left to withhold.
- **`commit()` called directly on `client` in `defineFactory`**: rejected — introduces a new `defineFactory → EngineClient` direct coupling absent today; the Session wrapper keeps transport ownership in one place (the WHERE decision above).

### ADR-02: Thin Error-Attribution Wrap at the emit Call Site (SEAM-04)

**Status**: Accepted (amended 2026-06-21, plan-verify iter-2 resolution)

> **Scope note (iter-2 reconciliation with ADR-01)**: where this ADR calls `EngineClient` the
> "frozen transport port", "frozen" means **the `emit(batch)` / `read(path)` SIGNATURES do not
> change** — not that the interface gains no members. ADR-01 ADDITIVELY grows the port with
> `commit()`/`discard()`; that is consistent with this ADR, which only rejects changing `emit`'s
> RETURN/PARAM shape to carry a structured error. The two ADRs do not conflict: ADR-01 owns the
> commit boundary (and the additive members), ADR-02 owns error vocabulary and keeps `emit`'s
> signature stable.

**Context**: `ContractFake` throws raw `ContractFake: …` / `OpMove` strings (engine-internal
vocabulary) straight to the factory author. The release contract requires author-vocabulary errors
(`AuthoringError{verb, path}`). The engine error is opaque — no structured op-index, just a message
string — so the SDK cannot recover which directive failed from the error alone.

**Decision**: Define `AuthoringError` in a new `src/core/authoring-error.ts`. Wrap the single
`#client.emit(batch)` call site in `Session.flush` with a try/catch that translates the raw error via
`toAuthoringError(raw, batch.instructions[0])`, attributing to the **first instruction of the flushed
batch**. Re-throw the `AuthoringError` (never swallow) so `defineFactory` still propagates it and
triggers discard (REQ-07 integration). Cover the read call site (`Session.read`) only in #3 — the
skeleton scopes the wrap to `emit`.

**Consequences**:
- (+) Authors never see engine vocabulary for the forced-rejection case; the seam is real, not mocked (REQ-13).
- (+) #3 extends the wrap to every verb, the read site, and mid-chain applied-boundary attribution into a working slot.
- (−) First-instruction attribution is correct ONLY for single-directive or first-failing batches; a mid-chain failure would mis-attribute until #3 adds op-index recovery. Scoped and documented, not hidden.
- (−) A new error type joins the public-ish surface area; must stay out of the umbrella export until the contract is frozen by #3.
- **Gap-#2 resolution (plan-verify iter-3)**: `toAuthoringError` builds a FRESH author message and does NOT chain the raw error via `.cause` in the skeleton — so the no-engine-text guarantee holds for the whole error object, not only `.message`. This removes the ambiguity an executor would face between sanitizing `.message` vs the full chain. Rich error context (cause access) is a deliberate #3 deliverable.

**Alternatives Considered**:
- **Parse the engine error string to recover verb/path**: rejected — couples the SDK to engine message formatting; brittle, and the spec forbids leaking engine text anyway.
- **Attach the raw error as `.cause` for debuggability (skeleton)**: rejected for the skeleton — a test serializing the full error chain (`.cause`) could still observe `ContractFake:`/`OpMove`, and REQ-11/13 demand no engine text in THE ERROR. Fresh-message-no-cause makes the guarantee whole-object and unambiguous. #3 may reintroduce structured cause access once attribution is frozen and the assertion contract is explicit.
- **Attribute at `defineFactory` instead of `Session.flush`**: rejected — `defineFactory` has no view of the failing directive; the Session owns `#pending` and the emit call, so attribution belongs there (REQ-12 fixes the call site).
- **Make `EngineClient.emit` return a structured error**: rejected — this changes `emit`'s SIGNATURE (its return shape) and the engine §6 wire contract; out of skeleton scope. (Note: ADR-01's ADDITIVE `commit`/`discard` members do NOT change any existing signature, so they are not barred by this rejection — see the Scope note above.)

## 4.6 Test Derivation (outside-in)

| REQ-ID | Scenario (G/W/T ref) | Level | Test (name/path) | Flow ref |
|---|---|---|---|---|
| REQ-01.1 | Typed create compiles for matching single-field schema | type-level | `test/types/typed-create.test.ts` (`expect-type` positive) | — |
| REQ-01.2 | Extra field → compile error | type-level | `test/types/permissive-proof.ts` (inverted-exit negative proof) | — |
| REQ-01.3 | Untyped create still compiles for bare `JsonValue` | type-level | `test/types/typed-create.test.ts` | — |
| REQ-02.1 | Write-only typed factory buffers create; `options` == `{name:"x"}`; no compile error | integration | `test/skeleton/commit-discard.test.ts` (assert buffered directive `options`) | — |
| REQ-02.2 | Write-only path holds — no trailing `.read()`; committed contains created path | integration | `test/skeleton/write-only-factory.test.ts` (assert via committed tree, NOT a `.read()`) | — |
| REQ-03.1 | Snapshot reflects two buffered directives in order | unit | `test/skeleton/session.test.ts` | — |
| REQ-03.2 | Snapshot isolated from later buffer mutation | unit | `test/skeleton/session.test.ts` (assert length stays 1 after second buffer) | — |
| REQ-04.1 | Renderer maps create → `{verb:"create",path:"src/foo.ts"}` | unit | `test/dry-run/plan.test.ts` | — |
| REQ-04.2 | Renderer maps all six ops with correct verb + primary path | unit | `test/dry-run/plan.test.ts` | — |
| REQ-04.3 | Plan equals buffered directives for write-only chain | integration | `test/dry-run/plan.test.ts` (snapshot from real Session) | — |
| REQ-05.1 | Renderer module has no core/AST import | architectural | `test/dry-run/no-import.test.ts` (import-graph scan) | — |
| REQ-06.1 | Write-only success commits full batch; staging cleared | integration | `test/skeleton/commit-discard.test.ts` | — |
| REQ-06.2 | Multi-directive success commits all in order | integration | `test/skeleton/commit-discard.test.ts` | — |
| REQ-07.1 | Throw leaves committed empty + staging discarded + error propagates | integration | `test/skeleton/commit-discard.test.ts` | — |
| REQ-07.2 | Throw after multiple buffers commits nothing | integration | `test/skeleton/commit-discard.test.ts` | — |
| REQ-07.3 | Forced rejection from fake triggers discard | integration | `test/skeleton/commit-discard.test.ts` | — |
| REQ-08.1 | `commit()` promotes staging→committed, clears staging | unit | `test/fake/commit-discard.test.ts` | — |
| REQ-08.2 | `discard()` clears staging, committed untouched | unit | `test/fake/commit-discard.test.ts` | — |
| REQ-08.3 | Committed independent after re-stage + discard | unit | `test/fake/commit-discard.test.ts` | — |
| REQ-09.1 | JSDoc states all-or-nothing, no partial-write sentence | architectural | `test/skeleton/commit-discard.test.ts` (source-scan assertion on `context.ts` JSDoc) | — |
| REQ-10.1 | `AuthoringError` carries verb + path | unit | `test/skeleton/error-attribution.test.ts` | — |
| REQ-11.1 | Forced collision surfaces `AuthoringError`, no engine text | integration | `test/skeleton/error-attribution.test.ts` | — |
| REQ-11.2 | `AuthoringError` propagates through `defineFactory` (rejects, not generic Error) | integration | `test/skeleton/error-attribution.test.ts` | — |
| REQ-12.1 | Wrap intercepts emit error, re-throws `AuthoringError` w/ first-failing verb+path | integration | `test/skeleton/error-attribution.test.ts` | — |
| REQ-12.2 | Discard fires after `AuthoringError` (REQ-07 integration); committed empty | integration | `test/skeleton/error-attribution.test.ts` | — |
| REQ-13.1 | End-to-end forced-rejection cross-boundary; no mock on emit/attribution/commit | integration | `test/skeleton/error-attribution.test.ts` (fake unmocked both sides) | — |

Note (port growth): `commit()`/`discard()` are now `Promise<void>` members of the `EngineClient` port
(ADR-01), so all REQ-06/07/08/12 scenarios `await` them; `defineFactory` awaits `session.commit()` /
`session.discard()`. No scenario count or assertion changes — the behaviour (promote-on-commit,
clear-on-discard, committed-empty-on-throw) is identical, only the call shape is async.

All 13 REQs (24 scenarios) covered. Mutation-resistant assertions per obs-648: REQ-02.2 asserts via
the **committed tree**, NOT a trailing `.read()` (write-only path stays write-only); REQ-07/REQ-12.2
assert the discard guarantee through observed empty committed state, not JSDoc; REQ-11 asserts the
error message does NOT contain `ContractFake:`/`OpMove` (negative substring) AND the typed `verb`/`path`
(positive), so a no-op translate cannot pass.

## 4.7 Fitness Functions

- **FIT-dry-run-no-import**: `src/dry-run/**` imports no `src/core/**` runtime module and no AST
  package — enforced by `test/dry-run/no-import.test.ts` (REQ-05). Extends the FIT-01 import-graph
  scanner pattern to the dry-run module.
- **FIT-01 (commons-no-AST)**: existing; must stay green after the `create<S>` overload (the overload
  adds no imports). Re-run as regression, not modified.
- **No engine vocabulary in `AuthoringError`**: enforced as a test assertion in
  `test/skeleton/error-attribution.test.ts` (negative substring on `ContractFake:`/`OpMove`), not a
  standalone fitness scanner this change — promoted to a scanner in #3 when attribution covers every verb.

## 4.8 Migration / Rollout

No DB, no runtime migration, no feature flag. The **fake migration** (REQ-08) is the only structural
change and is the primary risk — handled in §Fake Migration Plan below. `dist/core/**` tarball shape
(SEAM-06) is out of scope (owned by #4). The `src/dry-run/` module is NOT added to `package.json#exports`
this change — it is a seed surface, exposed deliberately by #4 `dry-run-and-release-shape`.

## 4.9 Performance Considerations

No significant performance impact. `pendingSnapshot()` is an O(n) defensive copy over the directive
buffer (bounded by directives-per-run, small). `dryRunPlan` is a single O(n) map. The fake's
committed tree doubles in-memory test state but is test-only.

## Fake Migration Plan (RISK #1 — load-bearing)

The existing tests read from the fake via `fake.emit(batch)` then `await fake.read(path)`, expecting
staged content immediately (e.g. `contract-fake.test.ts:53-64`, `fidelity.test.ts`, golden).
**`read()` currently observes the staging `#tree` directly — there is no commit step in the read path.**

Migration preserves this exactly:

1. **`read()` stays bound to `#tree` (staging).** Read-your-own-writes (REQ-KIT-02, architecture
   §Data flow) is unchanged: a directive emitted this run is readable this run BEFORE any commit. The
   committed tree is NEVER consulted by `read()`.
2. **`emit()` stays eager** — applies each directive to `#tree` as today (FAKE-01..06 untouched).
3. **`#committed` starts empty** and is mutated ONLY by `commit()` (promote `#tree` snapshot →
   `#committed`, then clear `#tree`) and read ONLY by the new `committedTree()` assertion accessor.
   `discard()` clears `#tree` and leaves `#committed` untouched.
4. **No existing test calls `commit()`/`discard()`** — they are additive methods. All FAKE-01..06,
   skeleton, golden, fidelity tests keep passing because their `emit→read` round-trips never touch the
   committed tree.
5. **Mapping current reads onto the new shape**: every current `await fake.read(p)` after `emit`
   resolves from `#tree` exactly as before. The ONLY new assertion surface is `committedTree()` /
   `commit()` / `discard()`, used solely by the new commit-discard + error-attribution tests.

The one **deliberate behavioural test change** is `write-only-factory.test.ts:40-51`: it currently
asserts a thrown factory leaves `src/partial.ts` readable (partial-write). Under ADR-01 that flips —
the design replaces it with: thrown factory leaves the **committed** tree empty. This is the contract
reversal, not a regression. Tracked explicitly in File Changes.

## 4.10 Architecture Impact

**Architecture impact**: modifying

**Rationale**: Three `deviates` touchpoints (4.2c): the `EngineClient` port grows two members
(`commit`/`discard`, ADR-01), the Session↔EngineClient commit contract is reversed from partial-write
to all-or-nothing (ADR-01), and error vocabulary at the seam is translated (ADR-02). These modify
established contracts (the partial-write behaviour documented in `context.ts` JSDoc; the `EngineClient`
port surface), making the baseline's §Data flow "Partial-write contract" line AND its `EngineClient`
port description (`emit`/`read` only) outdated — both MUST be refreshed post-build. The port growth is
ADDITIVE (no existing signature changes) and no layer is removed; the layered-modules-behind-an-IR-seam
pattern is intact, so this is `modifying`, not `breaking`. The new `src/dry-run/` and
`src/core/authoring-error.ts` modules are additive within the existing single layer (all `aligns`),
not new architectural layers.

## 4.11 Open Questions

None. The three plan-verify iter-2 gaps are resolved in this amendment:
- **Gap #1 (BLOCKER, commit/discard wiring)**: `EngineClient` port grows `commit()`/`discard()`
  (ADDITIVE — §4.2 / §4.3 / ADR-01); calls flow `defineFactory → Session.commit()/discard() →
  #client` (WHERE decision in ADR-01); ADR-01/ADR-02 reconciled ("frozen" = `emit` signature only).
- **Gap #2 (`OptionsOf<S>` shape)**: pinned to the bare inline mapped type `{ [K in keyof S]: S[K] }`,
  NO named helper this change (§4.4); `OptionsOf<S>` derivation deferred to #2 per SEAM-01.
- **Gap #3 (commit/discard ordering)**: explicit `try { run; flush; commit } catch { discard; throw }`
  control flow, final flush INSIDE the try so a flush rejection routes to discard + re-throw (§4.4b).

The two plan-verify iter-3 executor gaps are also resolved here:
- **Gap #1 (test `EngineClient`-literal sweep)**: growing the port with REQUIRED `commit`/`discard`
  breaks every hand-rolled literal implementing only `emit`/`read`. Fixed by a mechanical sweep
  (`session.test.ts` ×2, `read-your-own-write.test.ts`, `handle-chaining.test.ts` — §4.2) — wrappers
  forward to their inner client, standalone literals get no-op stubs. Port stays REQUIRED (optional
  members would make `Session.commit()`'s `#client.commit()` call silently skippable — unsound).
- **Gap #2 (`AuthoringError` message vs `.cause`)**: fresh author message, NO `.cause` chain in the
  skeleton, making the no-engine-text guarantee whole-object (§4.3 + ADR-02 consequence).
