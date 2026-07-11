# Design: Stage 5 — First dialect: `modify` becomes real (stage-5-first-dialect)

**Spec version**: V2 (signed) · **Design rev**: 5 · **Triage**: L (owner-ruled thin scope) · **Persona lens**: architect + security-engineer
**Status**: ok · **Architecture impact**: modifying

> Rev 5 (targeted, plan-verify-4 Judge B — owner-authorized FINAL loop) resolves four residual
> items WITHOUT reopening scope, ADR count unchanged at 4:
> **(Q1, the real gap)** the conformance kit gains an op-invocation recipe: `OpPackFixture` grows
> ONE additive, REQUIRED field `exercises: readonly OpExercise[]` (new exported `OpExercise` type —
> `seed` + op `chain` (named ops and/or `.raw`) + BYTE-EXACT `expect`) so `testOpPack` can APPLY each
> op on a seeded target and assert per-op effects by full-output byte equality (REQ-DC-02..04). REQUIRED
> in the type → an exercise-less op-pack fixture does NOT compile; the kit never silently skips its
> load-bearing per-op assertions. `DialectFixture` is UNCHANGED (`samples` suffice for `testDialect`'s
> round-trip, REQ-DC-01). Freeze reconciliation: the V2 "shapes UNCHANGED" claim is now false for
> `OpPackFixture` — a compatible additive field, but still spec-visible (interface text + FIT-04
> `conformance.index.d.ts` baseline, regenerated in S-004) → V4 micro-unfreeze (§4.3, §4.4c, ADR-0012
> amendment "Op-invocation recipe" clause). **(Q2)** the not-found literal is unified QUOTED —
> `dialect operation failed: "{path}" does not exist — create it first in this run` — matching REQ-DG-05's
> three tails; design §4.4 + slices already quote it, so ONLY REQ-TSD-03.4 is unfrozen (spec-only, no
> design change). **(Q3)** REQ-TSD-03.1 modify-after-create is pinned as a commons `create(path,
> {template,options})` THEN dialect `find(path).addImport(...)` sequence: the dialect read-through sees
> the staged create via RYOW (REQ-MC-02.2), the run emits `create` + ONE coalesced `modify` whose content
> = created content + import, byte-exact (§4.4c; spec row re-worded, V4 micro-unfreeze). **(Q4)** the dist
> path is `dist/dialects/typescript/**` (tsconfig `rootDir: ./src` mirrors the tree into `dist`) — ADR-0014
> amendment already states the correct path; ONLY REQ-FPS-02.2 is unfrozen (spec-only, no design change).
>
> Rev 4 (targeted, plan-verify-3 Judge B) resolves four remaining execution-level questions
> WITHOUT reopening scope, ADR count unchanged at 4:
> **(Q1)** the conformance kit runs the REAL dialect through a MINIMAL kit-internal in-memory
> `EngineClient` (`src/conformance/run-vehicle.ts`, NOT exported from the subpath) — declared in
> §4.2 File Changes, a new `dist/conformance/run-vehicle.js` tarball entry (FIT-14 baseline
> regeneration; no spec-text unfreeze); it does NOT replace `test/`'s `ContractFake`, its fidelity
> is pinned by the kit's own assertions running the real dialect through it (ADR-0012 amendment,
> §4.5). **(Q2)** S-001's `toy-dialect-smoke.test.ts` is a TYPE-pin + expect-throw
> CHARACTERIZATION (the toy fixture type-checks against frozen `DialectFixture`; calling the
> still-stubbed `testDialect` throws the documented error, suite stays green) — REPLACED at S-004
> by the REAL TypeScript-dialect conformance run; the toy fixture is NOT carried into conformance
> (honors ratified slices constraint 2) (§4.5 ADR-0012 amendment). **(Q3)** an EAGER shadow-catch
> is attached synchronously at every op-enqueue, marking `#tail` handled before control yields —
> closing the `unhandledRejection` window; the real rejection is preserved on `#tail` (multi-branch)
> for both author-`await` and run-end `settle()` (§4.3 + §4.7 FIT-18). **(Q4)** the kit-internal
> handle-factory signature in `src/core/dialect-handle.ts` is EXECUTOR LATITUDE — no fitness scan
> or later slice pins it (§4.3).
>
> Rev 3 (targeted, plan-verify-2 Judge B) resolves three execution-level questions WITHOUT
> reopening scope: **(Q1)** `newLineKind` is a FROZEN per-parse DETECTION rule (the file's own
> dominant ending, LF fallback) — content-derived, never host-derived — reconciling REQ-TSD-02
> with REQ-TSD-03.8 (§4.4). **(Q2)** the inherited `WriteOps` verbs
> (`move`/`copy`/`rename`/`modify`) are re-implemented on the dialect handle, sequenced through
> `#tail` and returning the thenable writable dialect handle; every edit/relocation flips `State`
> `found`→`writable` (ADR-0004) (§4.3 + ADR-0034). **(Q3)** `testDialect`/`testOpPack` become
> `Promise<void>` — the frozen surface is the FIXTURE shapes, not the function return, and a real
> async coalescing run cannot be observed through a synchronous bypass (ADR-0012 amendment).
>
> Rev 2 incorporates the consolidated council review + owner ruling: the **run-boundary join**
> (RunContext drains outstanding dialect handles before `session.flush()`), the explicit
> thenable-handle promise-queue mechanism, the honest same-path concurrency scoping, print-at-flush
> containment reconciled with `toAuthoringError`, and the frozen guard strings.

## 4.1 Architecture Overview

Three collaborating layers, no new topology. (1) `src/core/define-dialect.ts` gains REAL generics
(`Ast` type param, `withOps` intersection, an open awaitable `Handle<State, Ast, Ops>`) and a
kit-internal coalescing **handle factory** (`src/core/dialect-handle.ts`). (2) The first dialect
`src/dialects/typescript/**` (ts-morph parse/print + a thin `addImport` op-pack + the universal
`.raw()`) composes against that generic surface, importing ONLY the sanctioned kit surface
(`defineDialect`/`defineOpPack`/`withOps`). (3) `src/conformance/index.ts` fills in real bodies for
the CORE assertion subset. `Session`/`DirectiveFactory`/`EngineClient` are **untouched** (KIT-02 /
ADR-0008 stay literally true). `src/core/context.ts`'s `RunContext` gains ONE additive field — an
**outstanding-dialect-handles registry** — drained at run end (owner ruling); the run-boundary
behaviour changes (join), the flush/commit topology does not.

**The seam (ADR-0034).** ADR-0006's flow — read-through → parse → hold ONE live AST → mutate →
serialize once at flush → one `modify` — is realised by an **async, chainable, thenable** handle
backed by an internal promise queue (`#tail`). The first op reads through `Session.read` (async,
flush-before-read + RYOW, ADR-0015), parses once, holds the live AST; each op mutates that same
instance; the buffered `modify` carries a **self-memoizing lazy getter** (`content = print(ast)`)
evaluated exactly once, at the flush that drains it. A mid-chain `Session.read` (on ANY path — the
flush is GLOBAL) drains the open directive; the handle detects the drain by identity against
`pendingSnapshot()` and re-registers a FRESH directive → the spec's exactly-two-modifies split.

**The run-boundary join (owner ruling).** Because dialect chains are async, an author who forgets to
`await` a chain would let `fn` return with the chain still in flight — the edit would be lost or
surface as an `unhandledRejection`. `RunContext` therefore carries a handle registry; `defineFactory`
**drains it (awaits every outstanding `#tail` and force-resolves each open directive) BEFORE
`session.flush()`**, routing any rejection through the existing catch (discard + contained re-throw).
`await` on the author side becomes OPTIONAL for correctness — it now only SEQUENCES reads for
read-your-own-writes; completion-before-commit is guaranteed by the join, not by the author.

**The async surface.** The handle is the FIRST thenable object on the author surface — one ergonomic
departure from the sync commons verbs (`await find(p).addImport(x).raw(f)`), inherent to an async
read-through, taught explicitly (REQ-DAS-01 Async-usage section).

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/define-dialect.ts` | Modify | Real generics: `Op<Ast>`/`OpPack<Ast>`, frozen `DialectDescriptor`, awaitable `Handle<State,Ast,Ops>` (`PromiseLike` via `#tail`), `withOps` intersection, `.raw` |
| `src/core/dialect-handle.ts` | Create | Coalescing handle factory: promise-queue (`#tail`), read-through-parse via `Session.read`, `ensureOpen` re-registration, memoized content getter, contained error wrapping, registry self-registration |
| `src/core/context.ts` | Modify | `RunContext` gains `dialects: DialectRegistry`; `defineFactory` drains it (await `#tail`s + force-resolve getters) BEFORE `session.flush()`; rejections route through the existing catch |
| `src/dialects/typescript/index.ts` | Create | Dialect module (namespace export exposing `find`); composes `defineDialect` + `addImportPack` via `withOps`; `find` carries an async `@example` (REQ-DAS-01, FIT-06) |
| `src/dialects/typescript/ast.ts` | Create | ts-morph parse/print pair; frozen `ManipulationSettings`; per-parse `newLineKind` DETECTED from source content (LF fallback), never host-OS (Q1, §4.4); exported pure `detectNewLineKind`; no language-service formatter |
| `src/dialects/typescript/ops.ts` | Create | `addImport(name, from)` op-pack (`defineOpPack`), merge-into-existing-clause idempotency |
| `src/conformance/index.ts` | Modify | Real bodies for `testDialect`/`testOpPack` — CORE subset; signatures become `Promise<void>` (rev-3 Q3, async real-run); `DialectFixture` shape unchanged, `OpPackFixture` gains ONE additive REQUIRED field `exercises: readonly OpExercise[]` + new exported `OpExercise` type (rev-5 Q1, §4.3/§4.4c) — the op-invocation recipe `testOpPack` consumes; `@example` on all four kit verbs; drives the run-vehicle below |
| `src/conformance/run-vehicle.ts` | Create | **Q1 (rev 4)**: MINIMAL kit-internal in-memory `EngineClient` (just the `stage`/`read`/`commit`/`discard` semantics the kit's five CORE assertions need) so `testDialect`/`testOpPack` drive a REAL coalescing run (ADR-0012 forbids mock/bypass). NOT exported from `./conformance` — internal use of the port only (FIT-08-clean: internal import is legal, re-export is not). Ships as `dist/conformance/run-vehicle.js` (FIT-14 tarball delta) |
| `package.json` | Modify | `exports += ./typescript`; `dependencies = { ts-morph: "<exact>" }`; `bin` unchanged |
| `bun.lock` | Create | Committed lockfile carrying ts-morph |
| `docs/authoring-a-dialect.md` | Modify | Stub → real content: kit-verbs ref, `.raw`+trust xref, coalescing observable shape, worked op-pack example, two-realms, two-audience split, **Async usage** (§4.4b verbatim) |
| `SECURITY.md` | Modify | `.raw()` trust sentence + "conformance ≠ safety" caveat (§4.4b verbatim, REQ-STD-01) |
| `openspec/decisions/0033-ts-morph-runtime-dependency.md` | Create | ADR-0033 (D5) |
| `openspec/decisions/0034-coalescing-seam-handle-owned.md` | Create | ADR-0034 (seam + join + same-path scoping) |
| `openspec/decisions/0014-single-package-subpath-shape.md` | Modify | ADR-0014 amendment (`./typescript` wired) |
| `openspec/decisions/0012-conformance-kit.md` | Modify | ADR-0012 amendment (core subset now, tail deferred) |
| `test/fitness/fit-01-commons-no-ast.test.ts` | Modify | Transitive import-GRAPH walk + transitive planted red-proof (S-000, before ts-morph) |
| `test/fitness/fit-03..05,14 + baselines` | Modify | FIT-03 `./typescript` budget; FIT-04 `typescript.index.d.ts` baseline (create) + `conformance.index.d.ts` baseline UPDATE (`void`→`Promise<void>` (rev-3 Q3) AND the `OpPackFixture.exercises` + `OpExercise` additions (rev-5 Q1), S-004); FIT-05 coalesced `modify`; FIT-14 4-exports/ts-morph-dep/tarball + `pkg-surface-baseline.json` (regenerated set gains `dist/conformance/run-vehicle.js`, Q1 rev 4 — the `files: ["dist"]` whole-dist ship carries it; drift-guard text unchanged) |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modify | Add `src/dialects/typescript/index.ts` to `PUBLIC_PATHS` — the new public subpath's `find` is @example-gated |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modify | Scan `./typescript` + planted Session-import red-proof (REQ-DG-04) |
| `test/fitness/fit-17-coalescing-orphan-guard.test.ts` | Create | Post-read re-registration, no edit lost, no double-buffer (ADR-0034) |
| `test/fitness/fit-18-unawaited-join-guard.test.ts` | Create | Join removed/broken → lost edit OR `unhandledRejection`; red-proof drops the drain |
| `test/dialects/typescript/dialect.test.ts` | Create | REQ-TSD-01/02/03 (byte-pairs, determinism spy, edge table .1–.10), REQ-TSD-04 containment |
| `test/dialects/typescript/coalescing.test.ts` | Create | REQ-MC-01/02/05 spy-on-emit count+content, split-by-read, cross-path, RYOW, dryRun, **unawaited-join + same-path** |
| `test/dialects/typescript/read-routing.test.ts` | Create | REQ-MC-03 / REQ-TSD-07 static scan (no direct `EngineClient.read`) + planted red-proof |
| `test/dialects/typescript/golden/` | Create | Committed goldens: coalesced-one, split-#1/#2, addImport before/after, CRLF, empty |
| `test/e2e/dialect-modify.e2e.test.ts` | Create | Author story: awaited chain, `.raw`, mid-chain read split, **forgotten-await still commits** |
| `test/conformance/typescript-conformance.test.ts` + `planted/` + `meta.test.ts` | Create/Modify | REQ-DC-01..05 real bodies + planted red-proofs (round-trip, single-op, N=1, closure-smuggle, live-node-smuggle, read-split); REQ-TSD-05 smoke |
| `test/types/define-dialect.test.ts` | Modify | REQ-DG-01.1 fifth-field error, REQ-DG-02.1 attached-only ±, REQ-DG-02.3 standalone pack, `.raw` presence, thenable-handle type |
| `test/docs/security-authoring-guard.test.ts` | Create | Substring guards: SECURITY.md `.raw()`+caveat, doc mandated sections + two-realms + Async-usage, provenance-in-workflow (REQ-STD-01, REQ-DAS-01/02, REQ-TSD-06.2) |

## 4.2b Flow Changes (A1)

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Chain typed dialect ops on one file → one `modify` | Create | REQ-MC-01, REQ-DG-03, REQ-TSD-01/03 | `test/e2e/dialect-modify.e2e.test.ts` | `addImport` + `.raw`, awaited chain |
| `.raw(ast=>…)` after/before a named op coalesces | Create | REQ-DG-03 | `test/e2e/dialect-modify.e2e.test.ts` | either order, same AST |
| Mid-chain read splits into exactly two `modify` | Create | REQ-MC-02 | `test/e2e/dialect-modify.e2e.test.ts` | same-path + cross-path (global flush) |
| Forgotten-await chain still completes + commits at run end | Create | REQ-MC-06 (V3) | `test/e2e/dialect-modify.e2e.test.ts` | run-boundary join; throwing chain rejects contained, no `unhandledRejection` |
| FIT-01 pre-gate rejects a TRANSITIVE AST import to commons | Modify | REQ-FIT-01 | `test/fitness/fit-01-commons-no-ast.test.ts` (extend) | S-000, before ts-morph lands |
| Conformance kit runs against the real dialect | Modify | REQ-DC-01..05 | `test/conformance/typescript-conformance.test.ts` (new) | replaces surface-only meta |

## 4.2c Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/define-dialect.ts` | extend | real generics + handle factory (ADR-0010) | aligns |
| `core/dialect-handle.ts` (new) | new | coalescing thenable handle; joins the existing `core/` kit layer | aligns |
| `core/context.ts` (RunContext) | extend | additive `dialects` registry + run-end drain (join); ambient-context pattern ADR-0011 unchanged | aligns |
| `core/session.ts` | (read-only) | reads route through `Session.read`; NO signature change | aligns |
| `src/dialects/typescript/**` (new) | new | first dialect; instantiates the documented-but-empty dialect layer (FIT-02/08 pre-wired) | aligns |
| `conformance/index.ts` | modify | frozen signatures get real core-subset bodies (ADR-0012) | aligns |
| `test/fitness/fit-01-*` | modify | direct-only scan → transitive import-graph walk (closes W2) | aligns |
| `package.json#exports` | extend | `./typescript` 4th subpath — ADR-0014 said "not wired" | **deviates → ADR-0014 amendment** |
| `package.json#dependencies` | new | first runtime dependency (ts-morph) — D5's open posture | **deviates → ADR-0033** |

## 4.3 Data Model

```ts
// src/core/define-dialect.ts
export type Op<Ast> = (ast: Ast, ...args: never[]) => void;
export type OpPack<Ast> = Record<string, Op<Ast>>;

export interface DialectDescriptor<Ast, Ops extends OpPack<Ast>> {
  extensions: string[];
  ast: { parse(source: string): Ast; print(ast: Ast): string };
  ops: Ops;                          // exact — a 5th top-level field is a compile error (REQ-DG-01.1)
}

type Bound<Ast, F> = F extends (ast: Ast, ...rest: infer R) => void ? (...rest: R) => void : never;

// Q2 (rev 3): every editing/relocating method flips State "found"→"writable" (ADR-0004: a write
// makes `remove` incoherent) and returns the SAME thenable dialect handle — NOT commons' sync,
// non-thenable `WritableHandleRef`.
type Edited<Ast, Ops extends OpPack<Ast>> = Handle<"writable", Ast, Ops>;
type OpMethods<Ast, Ops extends OpPack<Ast>> =
  { [K in keyof Ops]: (...a: Parameters<Bound<Ast, Ops[K]>>) => Edited<Ast, Ops> };

// The inherited commons `WriteOps` return `WritableHandleRef` (sync-shaped, non-thenable, no
// dialect ops). The dialect handle RE-DECLARES the same verb NAMES + param types with a dialect
// return, so `Handle` stays STRUCTURALLY a `WriteOps`/`WritableHandleRef` (covariant return —
// `Edited` <: `WritableHandleRef`) while authored chains keep the thenable dialect surface. This
// covariant refinement is fully sound — no deviation note needed.
type DialectWriteOps<Ast, Ops extends OpPack<Ast>> = {
  modify(content: string): Edited<Ast, Ops>;
  rename(newName: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  move(toDir: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  copy(to: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
};

export type Handle<State extends "found" | "writable", Ast, Ops extends OpPack<Ast>> =
  ReadOps
  & DialectWriteOps<Ast, Ops>        // Q2: sync WriteOps re-declared with the thenable dialect return
  & { raw(fn: (ast: Ast) => void): Edited<Ast, Ops> }
  & OpMethods<Ast, Ops>
  & (State extends "found" ? { remove(): void } : {})   // remove(): void — terminal (ADR-0004)
  & PromiseLike<void>;               // awaitable: `.then` delegates to the internal #tail

// src/core/context.ts — the run-boundary join registry (owner ruling)
export interface DialectRegistry {
  register(h: { readonly settle: () => Promise<void> }): void;
  drain(): Promise<void>;            // await every settle(); re-throw the FIRST rejection (allSettled → no unhandledRejection)
}
export interface RunContext { session: Session; factory: DirectiveFactory; dialects: DialectRegistry; }

// src/conformance/index.ts — op-invocation recipe (rev 5, Q1). DialectFixture is UNCHANGED.
export interface OpExercise {
  seed: string;                       // initial content seeded at `path` (flush-seed-rule, REQ-MC-04)
  path?: string;                      // optional; kit defaults to a stable name using baseDialect.extensions[0]
  chain: ReadonlyArray<               // ops applied in order: a named pack op, or the universal `.raw`
    | { readonly op: string; readonly args: readonly unknown[] }
    | { readonly raw: (ast: unknown) => void }
  >;
  expect: string;                     // BYTE-EXACT printed content of the coalesced `modify` after the chain
}
export interface OpPackFixture {      // was { opPack, baseDialect } — gains ONE additive REQUIRED field
  opPack: OpPack;
  baseDialect: Dialect;
  exercises: readonly OpExercise[];   // REQUIRED: without it testOpPack cannot exercise the pack (no silent skip)
}
```

`OpExercise.expect` is a FULL expected-output string, never a `contains` substring — strict-TDD
byte-exactness, and the only form that catches an over-broad mutation (REQ-DC-02's unchanged-elsewhere).
`OpExercise` stays non-generic (`unknown` at the op/raw boundary), matching the existing non-generic
`OpPackFixture`; the fixture author narrows as needed. Behaviour when `exercises` is absent: it CANNOT be
absent — REQUIRED at the type level makes an exercise-less op-pack fixture a compile error, the honest
fail-loud (a runtime skip of the kit's load-bearing per-op assertion would be theatre).

**Thenable-handle runtime mechanism (ADR-0034, load-bearing).** The handle owns a private
`#tail: Promise<void>` (starts resolved). Every op does `#tail = #tail.then(() => applyOp())` and
returns `this` (chaining). `then(onF, onR)` delegates to `#tail`, which is what makes the handle
awaitable. `settle()` (called by the drain) is `await #tail` followed by force-resolving the open
directive's getter. The FIRST op's link performs the read-through-parse + parse (contained) and holds
the live `Ast`; later links mutate that same instance synchronously inside their link.

**Eager handled-marking closes the `unhandledRejection` window (Q3, rev 4, load-bearing).** `#tail`
can reject while `fn` is still running (a throwing op), but `settle()` only attaches at the run-end
drain — many ticks later — so Node could report `unhandledRejection` in that window for a
forgotten-`await` chain. Mechanism: **every op-enqueue attaches an eager no-op shadow-catch to the
CURRENT `#tail` SYNCHRONOUSLY, in the same turn it chains the op, before returning `this`** —
`#tail = #tail.then(() => applyOp()); #tail.catch(() => {})`. The `.catch(() => {})` marks `#tail`
handled the instant it exists (before control yields to the event loop), so no `#tail` this handle
ever produces is unhandled. The shadow branch is SEPARATE from the main chain: the REAL rejection
stays on `#tail` and is re-observed independently by (a) author `await handle` (PromiseLike delegating
to `#tail`) and (b) `settle()`'s `await #tail` at drain — a settled rejected promise re-throws its
reason on every branch, so eager-marking DISCARDS nothing. Chosen over *store-the-rejection-and-rethrow-
at-settle*: that variant needs a `#rejection` field AND `#tail` to still reject for the author-await
path (so it keeps both anyway) — redundant state with two sources of truth to keep in sync; the
shadow-catch keeps `#tail` the single source. **No double-reporting**: the two RUN-level rejection
paths are mutually exclusive by construction (`defineFactory` sequences `als.run(ctx, fn)` → `drain()`
→ `flush()`). If the author `await`s a throwing chain and does not catch, `fn` rejects → `als.run`
rejects → drain is SKIPPED → the run rejects once via the existing catch. If the author does NOT
`await` (forgotten), `fn` resolves → `drain()` calls `settle()` → `await #tail` re-throws → the run
rejects once via the same catch. Either way the run rejects exactly once, contained, with no
`unhandledRejection`. (An author who `await`s AND locally `catch`es a dialect failure still has the
run reject at drain — all-or-nothing (ADR-01) forbids committing after a broken AST mutation; a
handled dialect throw cannot be swallowed into a successful commit. This is intended, not a double
report: the rejection surfaces once at the run boundary, its shadow-marked branches never reaching the
unhandled channel.)

**Kit-internal handle-factory signature is executor latitude (Q4, rev 4).** The factory that
constructs a handle in `src/core/dialect-handle.ts` (e.g. `createDialectHandle(dialect, path,
registry)` — shape illustrative, not binding) is kit-internal plumbing: it lives under `src/core/**`,
is never a public subpath, is never re-exported (FIT-08 lists no such symbol), and its `.d.ts` is NOT
FIT-04-baselined (FIT-04 pins only the public `./typescript` + `./conformance` surfaces). No fitness
scan, golden, or later slice depends on its exact parameter list or name — a `rg` over `test/`+`src/`
for `createDialectHandle`/`DialectHandle`/`dialect-handle` finds zero references. What IS pinned and
must not drift is the PUBLIC `find(path)` signature (§4.4) and the `Handle<State, Ast, Ops>` TYPE
(§4.3, `test/types/define-dialect.test.ts` + the `typescript.index.d.ts` baseline) — both already
frozen. The factory PRODUCING a `Handle` is free; the executor picks the shape that fits the handle's
private state (`#tail`, the memoized getter, registry self-registration).

**Inherited write verbs are sequenced through `#tail` (Q2, rev 3).** Registration of the open
`modify` directive happens INSIDE the first op's link (via `ensureOpen()`), so it and every
subsequent verb's `session.buffer(...)` are SEQUENCED on `#tail` in author order. This is why the
inherited write verbs CANNOT buffer synchronously (commons-style): a sync `move()` after
`addImport()` would push its `move` directive into `#pending` BEFORE the coalesced `modify` link
runs, inverting REQ-TSD-03.2/.9's required `[modify, move|copy]` order. Each of
`move`/`copy`/`rename`/`modify(content)`/`remove` therefore runs
`#tail = #tail.then(() => session.buffer(factory.<verb>(...)))` and returns the thenable writable
handle (`remove` returns `void` — terminal per ADR-0004). `move`/`copy`/`rename` do NOT touch the
AST (pure file directives); they only need to serialize AFTER the handle's open `modify`, which
`#tail` ordering guarantees — TSD-03.2/.9's coalesced `modify` targets the ORIGINAL path and the
trailing relocation directive follows it. A raw `modify(content)` interleaved with an open AST
`modify` is available (type-compatible) but its coalescing overlap is out of the tested scope for
this change — a tracked `stage-5b` followup, not a shipped-and-unspecified behaviour. `dryRun()`
mid-chain sees the ONE planned `modify` once the handle has been awaited to that point (its link
registered the getter-backed directive, pre-flush) — it reads `verb`/`path` only, never the content
getter (REQ-MC-05, zero getter calls).

Runtime: no persisted tree (ADR-0008). The buffered directive is a plain
`{ op:"modify"; modify:{ path; content } }` whose `content` is a memoized getter resolved to a plain
string the instant it is first read (at emit, or force-resolved at drain/seal).

## 4.4 Interface Contracts

```ts
export function defineDialect<Ast, Ops extends OpPack<Ast>>(d: DialectDescriptor<Ast, Ops>): Dialect<Ast, Ops>;
export function defineOpPack<Ast, Ops extends OpPack<Ast>>(ops: Ops): Ops;             // standalone (REQ-DG-02.3)
export function withOps<Ast, B extends OpPack<Ast>, P extends OpPack<Ast>[]>(
  base: Dialect<Ast, B>, ...packs: P
): Dialect<Ast, B & UnionToIntersection<P[number]>>;                                   // intersection (REQ-DG-02.1)

// src/dialects/typescript — namespace import surface (ADR-0003). Canonical shown form: ts.find(...)
export function find(path: string): Handle<"found", SourceFile, { addImport: (name: string, from: string) => void }>;
// addImport(name, from) → `import { name } from "from";` (NAMED import only — no default/namespace/type-only);
// merged into an existing same-module clause if present.
```

**TypeScript AST construction — `newLineKind` is a frozen per-parse DETECTION rule (Q1, rev 3).**
ts-morph exposes ONE global `ManipulationSettings.newLineKind` per `Project`; a single hard value
CANNOT satisfy both REQ-TSD-02 (explicit, frozen, never host-OS-derived) AND REQ-TSD-03.8 (an
import inserted into a CRLF file matches the file's CRLF). Reconciliation: `newLineKind` is a
FROZEN per-parse DETECTION RULE, not a global constant. `ast.parse(source)` constructs a FRESH
`Project` whose `manipulationSettings.newLineKind` is derived from the SOURCE CONTENT — never from
the host OS (`os.EOL`/`process.platform` appear NOWHERE in `src/dialects/typescript/**`).
Content-derivation is deterministic across WSL/CI/macOS: it is precisely the host-OS
NONDETERMINISM REQ-TSD-02 exists to forbid that this AVOIDS — file-content-derived is not
host-derived. The rule is a pure, exported `detectNewLineKind(source: string): NewLineKind` in
`ast.ts`:

- `crlf = count of "\r\n"`; `lf = (count of "\n") − crlf` (bare LFs, each CRLF holding one `\n`).
- CRLF (`NewLineKind.CarriageReturnLineFeed`) IFF `crlf > lf`; OTHERWISE LF
  (`NewLineKind.LineFeed`). The single comparison `crlf > lf` folds all three cases: the DOMINANT
  ending wins; a mixed-ending TIE (`crlf === lf`) resolves to LF; empty / single-line /
  newline-less content (`0 > 0` is false) resolves to LF. LF is the deterministic FALLBACK for
  indeterminate content.

`newLineKind` governs only NEWLY inserted text — ts-morph never rewrites existing newlines — so a
no-edit round-trip is byte-exact regardless of the file's endings (REQ-TSD-03.6 CRLF+BOM
preserved), while `addImport` on a CRLF file emits a CRLF import line (REQ-TSD-03.8) and on an LF
file an LF line; both are pinned against committed goldens (§4.2 CRLF + empty goldens — the golden
suite is the version-drift gate, REQ-TSD-02). A UTF-8 BOM is orthogonal (start-of-file, not a line
ending) and preserved by ts-morph independently. The rule lives INSIDE the frozen
`ast.parse(source): Ast` signature — the returned `SourceFile` carries its `Project`, so
`ast.print` honours the same settings with NO signature change. REQ-TSD-02.2's inspection assertion
observes the rule DIRECTLY: `detectNewLineKind` is called on an LF sample (→ LF), a CRLF-dominant
sample (→ CRLF), a tie and empty (both → LF), and a static scan proves no host-OS newline source
exists in the dialect tree. (Load-bearing ts-morph assumption — newLineKind affects insertions
only, not existing newlines — is validated by the CRLF-round-trip + CRLF+addImport goldens; if a
pinned ts-morph version violated it, those goldens fail RED.)

**Error taxonomy (interim, RATIFIED) — message tails carry `{op}` + `{path}`.** Every throw from
`ast.parse`/`ast.print`, a named op, or a `.raw()` callback is caught by the handle factory and
re-thrown as a plain `Error` with the frozen prefix `"dialect operation failed: "`. The tail is
STRUCTURED (author-side, leak-free) so the three failures are distinguishable:

| Failure | Message (frozen prefix + pinned tail) |
|---|---|
| `.raw()` throw | `dialect operation failed: raw() on "{path}" threw` |
| parse failure | `dialect operation failed: could not parse "{path}" as TypeScript` |
| print failure | `dialect operation failed: could not print "{path}"` |
| first-op not-found | `dialect operation failed: "{path}" does not exist — create it first in this run` |

The wrapper constructs a FRESH `Error(message)` at the wrap site (stack cleanliness by construction)
and sets NOTHING else — no `.cause`, no own prop carrying the native error (REQ-DG-05, the named leak
vector). The not-found tail's `"in this run"` is load-bearing: without it the author checks the disk;
it surfaces synchronously in chain terms via `Session.read` returning `undefined`, with the ADR-0017
fake run-end existence check as the engine-side backstop (REQ-MC-04 reconciled timing). Promotion to
`AuthoringError{origin:"authoring-rejected"}` is committed-next `stage-5b-dialect-breadth`.

**Print-at-flush containment (reconciled with the deferred getter + `toAuthoringError`).** The
content getter's body is `#printContained(ast, path)` — wrapping ts-morph `print` in try/catch,
throwing the frozen-prefix `Error` above on failure. `Session.flush` unconditionally routes an emit
rejection through `toAuthoringError`, which DISCARDS raw text and degrades to `reason:"unknown"`
(REQ-ERM-01) — so a getter throwing INSIDE `#client.emit`'s `JSON.stringify` would LOSE the frozen
prefix. Therefore a print-throw must never reach `emit`. Two catchers:

- **Run-end (who awaits at run-end)**: the drain's `settle()` force-resolves each open directive's
  getter AFTER awaiting `#tail` and BEFORE `session.flush()`. A print-throw here rejects the drain →
  the existing `defineFactory` catch → `discard()` + contained re-throw. Prefix intact;
  `toAuthoringError` never touched.
- **Handle-initiated split (`handle.read()`)**: the method force-resolves (SEALS) its own open
  directive to a plain string BEFORE delegating to `Session.read`; a print-throw rejects the read,
  propagating through `fn` → the same catch.
- **Foreign cross-path `Session.read`** (REQ-MC-02.3): the open directive is still a getter when the
  foreign flush serializes it. `#printContained` over a successfully-mutated ts-morph `SourceFile` is
  TOTAL (`getFullText` does not throw for a parsed+edited SourceFile) — no reachable print-throw for
  the shipped dialect. Defense-in-depth: on any print failure the getter MEMOIZES a sentinel and
  FLAGS the handle (never throws into `emit`); the flag surfaces as the contained rejection at the
  handle tail/drain, and all-or-nothing (ADR-01) discards the transient sentinel emit. This keeps
  `toAuthoringError` off the dialect-error path in every case. A future dialect whose `print` is
  PARTIAL inherits this as a tracked followup (`stage-5b`).

**Run-boundary join contract.** `defineFactory` runs `als.run(ctx, fn)` → `ctx.dialects.drain()` →
`session.flush()` → `commit()`; the drain awaits every registered handle's `settle()` and re-throws
the first rejection into the SAME catch. An unawaited (forgotten-`await`) chain therefore still
completes and commits; an unawaited THROWING chain rejects the run with the contained prefixed Error
and produces NO `unhandledRejection` — the eager shadow-catch (§4.3, Q3) marks `#tail` handled at
enqueue time, while `settle()`'s `await #tail` re-surfaces the same rejection at drain into the run's
single rejection path.

## 4.4b Frozen guard strings (pinned in-design, not apply-time improvisation)

Guard tests (REQ-STD-01, REQ-DAS-01.2) assert these EXACT substrings; apply MUST land them verbatim.

- **SECURITY.md `.raw()` sentence**: *"The `.raw(ast => …)` escape hatch executes dialect and
  schematic code with full process privilege — it is NOT a sandbox. The serialization seam (only
  plain strings cross to the engine) is the ONLY containment guarantee; it bounds what data leaves a
  run, not what code may do while running. Vet any dialect or op-pack before importing it."*
- **"conformance ≠ safety" caveat**: *"Passing the conformance kit (`@pbuilder/sdk/conformance`) is
  not a security attestation: it proves a dialect keeps the seam serializable and its ops faithful,
  not that the dialect's `.raw()` code is safe to execute."*
- **Two-realms hazard (docs/authoring-a-dialect.md)**: *"Two ts-morph realms: if your schematic
  already depends on ts-morph directly, that is a separate realm from the SDK's internal ts-morph
  used inside `.raw(ast => …)`. A `Node`/`SourceFile` from your realm is not interchangeable with the
  AST the SDK hands your `.raw()` callback — even when both realms resolve the identical ts-morph
  version. Never pass ts-morph objects across the boundary; operate only on the `ast` the callback
  receives."*

## 4.4c Conformance op-invocation recipe + modify-after-create (rev 5)

**Op-invocation recipe (Q1) — how the generic kit exercises an op-pack.** `testOpPack(fixture)`
consumes `fixture.exercises` (§4.3, REQUIRED). Each exercise runs in its OWN isolated run through the
run-vehicle (§4.2): the kit seeds `path` with `seed`, chains the exercise's ops on
`baseDialect.find(path)` (`{op, args}` → `handle[op](...args)`; `{raw: fn}` → `handle.raw(fn)`), awaits,
and inspects the emitted batch. The five CORE assertions map onto the exercises — no per-op labels,
applicability derived from chain shape:

- **REQ-DC-02 (single-op fidelity + unchanged-elsewhere)** and **REQ-DC-03 (coalescing-to-one, ≥2
  distinguishable ops)**: for every no-read exercise, assert EXACTLY ONE `modify` for `path` whose
  content is byte-exact `=== expect`. A FULL-output comparison proves BOTH the intended effect AND that
  every other region is byte-stable in one assertion — a substring `contains` would let an over-broad
  mutation pass (forbidden by the Theatre Criteria). The fixture MUST include ≥1 multi-op exercise
  (e.g. `addImport` + `.raw`); the kit fails loudly if none exists, since DC-03 is mandatory.
- **REQ-DC-04 (seam-serializability)**: for EVERY emitted directive across all exercises,
  `JSON.parse(JSON.stringify(dir))` deep-equals `dir` (the closure- and live-node-smuggle planted
  op-packs fail this RED — §4.5 ADR-0012 amendment, REQ-DC-04.1/.2).
- **Read-boundary split (fifth core assertion; live counterpart of the planted REQ-DC-05.2)**: for each
  multi-op exercise the kit RE-RUNS it, injecting `handle.read()` after the first op (the global
  flush-before-read that splits — REQ-MC-02), and asserts EXACTLY TWO `modify` directives whose cumulative
  content equals `expect`; directive #1's expected content is SELF-DERIVED by the kit running the first
  op ALONE — no extra fixture field. A planted op-pack that coalesces across the injected read emits ONE
  modify and fails this RED (REQ-DC-05.2).

`DialectFixture` needs no recipe: `testDialect` asserts only byte-exact round-trip (REQ-DC-01) over
`samples`; the op-application assertions are `testOpPack`'s, and the TypeScript conformance test calls
BOTH so the five core hold together.

**Modify-after-create is create-then-find (Q3, REQ-TSD-03.1).** The scenario is a commons
`create(path, { template, options })` FOLLOWED by a dialect `find(path).addImport(name, from)` in the
same run — NOT a commons raw-content `.modify()` (which would never exercise the dialect). The dialect
handle's first-op read-through routes through `Session.read` (REQ-MC-03), whose GLOBAL flush-before-read
(ADR-0015) first flushes the pending `create` directive, then reads the staged content back
(read-your-own-writes, REQ-MC-02.2). The run therefore emits the `create` directive AND exactly ONE
coalesced dialect `modify` for `path`, whose content is byte-exact the CREATED content with the import
applied — derived from the staged create, NEVER from a disk/tree read (no persisted tree, ADR-0008). The
test (`dialect.test.ts`, §4.6) asserts BOTH directives present in order, and the `modify` content
byte-exact against a committed golden = created template + import.

## 4.5 Architecture Decisions (ADRs)

### ADR-0033: ts-morph as the first runtime dependency — plain, exact-pinned (D5)
**Status**: Proposed. **Context**: `modify` needs a real AST library; the repo has zero runtime
`dependencies`. The open half of D5 is the posture — plain `dependency` vs `peerDependency`.
**Decision**: Declare ts-morph as a plain, EXACT-pinned `dependencies` entry (no caret/tilde), commit
the lockfile, publish with npm provenance (REQ-PKG-03, REQ-TSD-06.2), and prove FIT-01 leaf isolation
(ts-morph never reaches `src/commons/**`) BEFORE the dependency lands (S-000 ordering).
**Consequences**: (+) zero-config first-run DX for JS-project authors; (+) one place to gate
determinism against goldens. (–) pins ts-morph's major → a swap is a semver-major; (–) two-realms
hazard (a different version loaded by the author) — ACCEPTED and DOCUMENTED (REQ-TSD-06, §4.4b), not
solved. **Alternatives**: *peerDependency* — worse first-run DX for a capability with zero existing
adopters, pushes install friction onto every consumer; *caret range* — reintroduces the
nondeterminism the pins exist to kill.

### ADR-0034: Coalescing seam is handle-owned; the run boundary joins outstanding handles
**Status**: Proposed. **Context**: N AST edits coalesce to ONE `modify` (ADR-0006); a global
mid-chain read SPLITS to exactly two (ADR-0015); content must be a plain string (FIT-05); `dryRun()`
must not force serialization (REQ-MC-05). An async read-through makes the handle awaitable — raising
forgotten-`await` (lost edit / `unhandledRejection`) and same-path concurrency.
**Decision**: (1) **Handle-owned seam.** A thenable handle backed by a promise queue
(`#tail = #tail.then(op)`, ops return `this`, `.then` delegates to `#tail`) holds one live AST; the
buffered directive's `content` is a memoized lazy getter (`print`, once, at the draining flush).
`ensureOpen()` re-registers a fresh directive when the prior one left `pendingSnapshot()` (identity
check) → the two-modify split, no edit lost (FIT-17). Every enqueue EAGER-MARKS `#tail` handled (a
synchronous no-op shadow-catch) so a forgotten-`await` chain never leaks `unhandledRejection`, while
the real rejection stays on `#tail` for author-`await` and drain `settle()` (rev 4, Q3, §4.3).
(1b) **Inherited write verbs are re-owned
(rev 3, Q2).** `move`/`copy`/`rename`/`modify(content)`/`remove` are re-implemented on the dialect
handle — each enqueues its `session.buffer(...)` on `#tail` (author-order preservation; a
synchronous buffer would order a trailing `move`/`copy` directive BEFORE the coalesced `modify`,
breaking REQ-TSD-03.2/.9's `[modify, relocation]` order) and returns the thenable writable dialect
handle (`remove` → `void`). The type is a covariant re-declaration of commons `WriteOps`: `Handle`
stays structurally a `WritableHandleRef` while authored chains keep the dialect surface, and every
edit/relocation flips `State` `found`→`writable` so a post-edit `remove()` does not typecheck
(ADR-0004 chaining table, honored unchanged on the async handle). (2) **Run-boundary join (ADOPTED alternative,
owner ruling).** `RunContext` carries a handle registry; `defineFactory` drains it (await every
`#tail` + force-resolve getters) BEFORE `session.flush()`, routing rejections through the existing
discard+re-throw catch. Completion-before-commit no longer depends on the author's `await`.
**Same-path honesty**: the join guarantees COMPLETION, not INTERLEAVING. Two UNAWAITED handles on the
SAME path both read-through the pre-edit base before either buffers → competing modifies,
last-write-wins clobber → RYOW VIOLATED. This is **UNDEFINED behaviour, DOCUMENTED, not prevented**.
SEQUENTIAL AWAITED same-path handles ARE defined + correct (the second's read observes the first's
staged edit via RYOW, splitting into cumulative modifies). Different-path concurrent handles are
always safe. **Consequences**: (+) `Session`/`DirectiveFactory`/`EngineClient` diff-free; (+) small
auditable seam + one additive `RunContext` field. (–) chains are async/thenable (one ergonomic
departure, taught); (–) concurrent same-path is UB (guarded expectation, not a guarantee).
**Rejected alternative — author-await-only (no join)**: relies on the author to `await` every chain;
failure modes: a forgotten `await` silently LOSES the edit (chain never runs before flush) or throws
an `unhandledRejection` after the run "succeeds". Rejected: correctness must not hinge on author
discipline. **Rejected — Session pre-flush thunk hook (old Option B)**: a persistent thunk re-emits
every flush; a one-shot thunk reproduces the orphan; a path-keyed materialize registry contradicts
KIT-02/ADR-0008 and enlarges the AST-blind port surface FIT-07/FIT-10 guard — buys nothing once the
join already lands the async work inside the run.

### ADR-0014 amendment: the `./typescript` dialect subpath is wired
**Status**: Proposed (amends Accepted ADR-0014). **Context**: ADR-0014 documented the dialect subpath
as "documented, NOT wired" pending a frozen dialect API. Stage 5 freezes it. **Decision**: Wire
exactly one dialect subpath, `./typescript` (FROZEN) → `dist/dialects/typescript/index.js`; exports
map grows 3→4. This is the "first dialect" trigger ADR-0014 anticipated, but the monorepo extraction
stays DEFERRED (this dialect is INTERNAL; extraction fires on the SECOND or first EXTERNAL dialect).
No general dialect-naming convention is established. **Consequences**: (+) authors get a real
`@pbuilder/sdk/typescript`; (+) FIT-04 baselines the new `.d.ts` from first commit. (–) the subpath
is FIT-04 semver-frozen on ship. **Alternatives**: *mint a competing ADR* — this is an evolution of
ADR-0014, not a reversal; *establish a naming convention now* — premature with one dialect.

### ADR-0012 amendment: conformance CORE subset now, tail deferred
**Status**: Proposed (amends Accepted ADR-0012). **Context**: `testDialect`/`testOpPack` throw until a
real dialect exists; the owner ruling ships a CORE subset. **Decision**: Fill the frozen signatures
with FIVE core assertions — byte-exact round-trip, single-op fidelity + unchanged-elsewhere,
coalescing-to-one (content-verified, ≥2 distinguishable ops), seam-serializability (incl. MANDATORY
closure- AND live-node-smuggle red-proofs), read-boundary split — plus a planted-violation suite (one
red-proof per assertion). Fixture shapes UNCHANGED. **Return type becomes `Promise<void>` (rev 3,
Q3).** The frozen surface is the FIXTURE SHAPES (`DialectFixture`/`OpPackFixture`), not the function
return type — no REQ pins `void`. Observing DC-03 (coalescing-to-one) and DC-04 (seam-serializability)
REQUIRES awaiting a REAL async coalescing run (the handle's `#tail`, the run-boundary join, and
`Session.flush` are all async); a synchronous `testDialect`/`testOpPack` could only inspect the emitted
batch via a mock/bypass, which ADR-0012 and REQ-TSD-07 (ContractFake-only) forbid — a sync return
would be theatre. Planted violations (REQ-DC-05) surface as promise REJECTIONS through the
`expect-…-fail` / expect-reject wrapper, not sync throws. **Run vehicle (Q1, rev 4).** The five
assertions observe an EMITTED coalesced batch, which requires a real `EngineClient` to drive
`Session.flush`/`commit`. The kit ships a MINIMAL kit-internal in-memory client,
`src/conformance/run-vehicle.ts` (§4.2), implementing only the `stage`/`read`/`commit`/`discard`
semantics DC-01..05 exercise — NOT exported from `./conformance` (internal port use is FIT-08-legal;
re-export is not), so it grows the tarball by exactly one shipped file (`dist/conformance/run-vehicle.js`,
FIT-14 baseline delta) and no public symbol. It does NOT replace `test/`'s `ContractFake`: `test/`
keeps the normative full-fidelity fake, and the run-vehicle is a SEPARATE, deliberately thin port
implementation whose own fidelity is pinned by the kit's assertions running the REAL dialect through
it (a divergence would fail DC-01..05, not hide). *Rejected — relocate `ContractFake` to `src/`*: drags
full FAKE-01..06 semantics + test-support coupling into the shipped surface for five assertions that
need a fraction of it. *Rejected — `pendingSnapshot()` pre-flush inspection*: reads directives BEFORE
they cross the seam — the mock/bypass ADR-0012 and REQ-TSD-07 (ContractFake-only) forbid; it could
never prove DC-04 seam-serializability, which is precisely a post-serialization property. **S-001
toy-smoke boundary (Q2, rev 4).** `src/conformance/index.ts` stays STUBBED (throws) until S-004, so
S-001's `test/conformance/toy-dialect-smoke.test.ts` is a TYPE-pin + expect-throw CHARACTERIZATION:
the toy fixture `expectTypeOf`-checks against the frozen `DialectFixture`/`OpPackFixture` shapes AND
calling `testDialect(toyFixture)` throws the documented "not yet available" stub error (suite stays
green). At S-004 that smoke is REPLACED by the REAL TypeScript-dialect conformance run
(`typescript-conformance.test.ts`); the toy fixture is NOT carried into conformance — honoring ratified
slices constraint 2 ("no slice past S-001 imports `test/fixtures/toy-dialect/**` in conformance
code"). What "discarded after S-001" (slices Executor Context) means is precise: the toy's role as the
skeleton's proof vehicle ends; conformance's real fixture is and always was the TypeScript dialect.
Adversarial battery, leaf rule, real-base-dialect rule are committed-next. **Op-invocation recipe
(Q1, rev 5).** `testOpPack`'s per-op assertions (DC-02..04 + the read-split) must APPLY each op on a
seeded target with concrete args and assert byte-exact effects; the frozen `OpPackFixture {opPack,
baseDialect}` carried none. `OpPackFixture` therefore gains ONE additive, REQUIRED field `exercises:
readonly OpExercise[]` (new exported `OpExercise` = `seed` + op `chain` + BYTE-EXACT `expect`; §4.3,
§4.4c). REQUIRED at the type level — an exercise-less fixture does not compile, so the kit cannot silently
skip its load-bearing assertions (theatre). `expect` is a full expected-output STRING, not a `contains`
substring: strict-TDD byte-exactness, the only form that catches over-broad mutation (unchanged-elsewhere).
`DialectFixture` is untouched (round-trip needs only `samples`). Freeze reconciliation: the fixture-shape
freeze (this ADR, rev 3) held for the RETURN type and `DialectFixture`; `OpPackFixture`'s one additive
field is a compatible extension but spec-visible (interface text + `conformance.index.d.ts` FIT-04
baseline, regenerated in S-004) → V4 micro-unfreeze. *Rejected — optional-in-type, runtime-required*: a
runtime throw when `exercises` is absent is strictly weaker than a compile error for a field the kit
ALWAYS needs, and no real fixture exists to break (conformance is stubbed until S-004, the toy fixture is
discarded after S-001). *Rejected — `exercises` on `DialectFixture` too*: `testDialect` asserts only
round-trip; duplicating the recipe there is dead surface. **Consequences**: (+) the `.raw()` code-execution invariant
ships in CORE, not the deferred tail; (+) "conformance ≠ safety" asserted in-kit (§4.4b). (–) partial
coverage — a tracked followup, not a silent gap. (–) `./conformance`'s public signatures change
`void`→`Promise<void>` — a signature-touching FIT-04 baseline update (`conformance.index.d.ts`,
already diffed by FIT-04) landed as an explicit S-004 task; justified because the async run is the
only non-theatre path to observe DC-03/DC-04. **Alternatives**: *defer all bodies* — leaves the security-core
seam assertion unshipped while `.raw()` goes live; *ship the full battery* — the XL breadth the owner
ruling defers.

## 4.6 Test Derivation (outside-in)

Coverage: **all 31 signed REQ-IDs covered** + V3 additions (REQ-MC-06, same-path scenario,
REQ-DAS-01 Async section). Every Create/Modify flow (4.2b) has ≥1 e2e row.

| REQ-ID (scenarios) | Level | Test (name/path) | Flow ref |
|---|---|---|---|
| REQ-DG-01.1/.2, REQ-DG-02.1/.2/.3 | unit (type) | `test/types/define-dialect.test.ts` | — |
| REQ-DG-03.1/.2 | e2e | `test/e2e/dialect-modify.e2e.test.ts` | Flow 1/2 |
| REQ-DG-04.1 | architectural | `test/fitness/fit-08-no-kit-bleed.test.ts` | — |
| REQ-DG-05.1/.2 | unit | `test/dialects/typescript/dialect.test.ts` (tail {op}+{path}, `.cause` absent) | — |
| REQ-MC-01.1/.2 | integration | `test/dialects/typescript/coalescing.test.ts` | Flow 1 |
| REQ-MC-02.1/.2/.3 | e2e | `dialect-modify.e2e.test.ts` + `coalescing.test.ts` | Flow 3 |
| REQ-MC-03.1/.2 | architectural | `test/dialects/typescript/read-routing.test.ts` | — |
| REQ-MC-04.1 | integration | `test/dialects/typescript/coalescing.test.ts` (quarantined guard) | — |
| REQ-MC-05.1 | integration | `test/dialects/typescript/coalescing.test.ts` (getter spy, zero calls) | — |
| REQ-MC-06.1 (V3) — forgotten-await joins | e2e | `dialect-modify.e2e.test.ts` + `fit-18-unawaited-join-guard.test.ts` | Flow 4 |
| REQ-MC (V3) — same-path awaited defined / concurrent UB | integration | `test/dialects/typescript/coalescing.test.ts` | Flow 4 |
| REQ-TSD-01.1/.2 | integration | `dialect.test.ts` + golden | Flow 1 |
| REQ-TSD-02.1/.2/.3 | integration | `dialect.test.ts` (determinism, formatter spy; `.2` calls the pure `detectNewLineKind` on LF/CRLF/tie/empty samples + host-OS-source static scan, §4.4) | — |
| REQ-TSD-03 (.1–.10) | integration | `dialect.test.ts` (edge table; .1 = commons `create` THEN dialect `find().addImport()` → `create` + one coalesced `modify`, content = created+import byte-exact via RYOW, §4.4c) + goldens | Flow 1/3 |
| REQ-TSD-04.1 | unit | `dialect.test.ts` (real ts-morph parse fail, contained) | — |
| REQ-TSD-05.1 | integration | `typescript-conformance.test.ts` (smoke resolve+run) | — |
| REQ-TSD-06.1/.2 | architectural | `fit-14-package-surface.test.ts` + `security-authoring-guard.test.ts` (provenance substring) | — |
| REQ-TSD-07.1 | architectural | `read-routing.test.ts` (no real-engine import scan) | — |
| REQ-DC-01..05 | integration | `typescript-conformance.test.ts` (authors `OpPackFixture.exercises`: an `addImport` single-op exercise → DC-02, an `addImport`+`.raw` multi-op exercise → DC-03/read-split, byte-exact `expect`) + `meta.test.ts` + `test/conformance/planted/` (async `await testDialect/testOpPack`; planted violations → expect-reject) | Flow 5 |
| REQ-DAS-01.1/.2 (incl. Async section, V3) | architectural | `security-authoring-guard.test.ts` | — |
| REQ-DAS-02.1 | architectural | `security-authoring-guard.test.ts` | — |
| REQ-FPS-02.1/.2 | architectural | `fit-14-package-surface.test.ts` | — |
| REQ-PKG-01 | architectural | `fit-09-pkg-exports-resolution.test.ts` (extend) | — |
| REQ-STD-01 | architectural | `security-authoring-guard.test.ts` (both sentences + caveat, §4.4b) | — |
| REQ-FIT-01/03/04/05 | architectural | `fit-01`(transitive)/`fit-03`/`fit-04`+baseline/`fit-05`(coalesced) | Flow 6 (FIT-01) |
| REQ-FIT-06 (public @example) | architectural | `fit-06-example-jsdoc.test.ts` (+`./typescript`) | — |

## 4.7 Fitness Functions

- **FIT-17 (promoted, ADR-0034)**: a handle whose open directive is drained by a mid-chain read
  re-registers a NEW directive — no edit lost, no double-buffer. Red-proof: a handle reusing the
  drained reference fails red. `fit-17-coalescing-orphan-guard.test.ts`.
- **FIT-18 (new, run-boundary join)**: an UNAWAITED dialect chain still emits its `modify` at run end;
  an unawaited THROWING chain rejects the run with the contained prefixed Error and produces NO
  `unhandledRejection`. **Red-proof (two independent drops)**: (a) removing the `dialects.drain()` call
  (or making it a no-op) makes the happy case LOSE the edit AND the throwing case reject/leak; (b)
  removing the EAGER shadow-catch (Q3, §4.3) while keeping drain makes the throwing unawaited case
  surface an `unhandledRejection` in the pre-drain window. Determinism for (b): the guard drives a full
  run where the throwing op rejects during `fn` and the assertion spans the whole run via
  `process.on('unhandledRejection')`; because `defineFactory` sequences `await als.run` STRICTLY before
  `drain()`/`settle()`, the rejected `#tail` outlives a microtask-queue-empty boundary with no attached
  handler once the eager mark is gone — Node reports it deterministically. With the eager mark present,
  `#tail` is handled at enqueue time and the happy path never reports. `fit-18-unawaited-join-guard.test.ts`.
- **FIT-01 (transitive)**: import-GRAPH walk over `src/commons/**`; any AST lib at any depth fails.
  GREEN before ts-morph lands.
- **FIT-03**: `./typescript` gets its OWN committed byte budget constant (sized for ts-morph).
- **FIT-05 (extended)**: `JSON.parse(JSON.stringify(directive))` deep-equals the COALESCED dialect
  `modify` — content is a plain resolved string by construction.
- **FIT-06 (extended)**: `PUBLIC_PATHS` gains `src/dialects/typescript/index.ts` — the new public
  subpath's `find` must carry an `@example` (teaches the async form; closes the regression of a public
  subpath escaping the @example gate).
- **FIT-08 (inherited, exercised)**: `./typescript` re-exporting a kit symbol fails the scan; planted
  Session-import red-proof under `src/dialects/typescript/**`.
- **Serialize-before-drain ordering** (ADR-0034 invariant): the drained directive's getter memoizes at
  its draining flush, capturing AST state at that instant — guarded by the split-by-read golden +
  FIT-17.

## 4.8 Migration / Rollout

S-000 (FIT-01 transitive) lands and goes GREEN BEFORE ts-morph enters `package.json` — load-bearing
ordering. ts-morph is exact-pinned with a committed `bun.lock`; the first release carrying it uses the
existing `--provenance` publish job (REQ-TSD-06.2). No data migration (author-time codegen, zero
consumers). Rollback is clean pre-release: revert the branch; the S-000 FIT-01 tightening is
forward-compatible and safe to keep.

**Provenance & lockfile enforcement**: `--provenance` retention is asserted by a workflow-substring
guard in `security-authoring-guard.test.ts` (the publish job for the first release shipping a runtime
dep MUST retain `--provenance`); the committed-lockfile clause is enforced by FIT-14's
`pkg-surface-baseline.json` diff (ts-morph exact-pin) — the lockfile presence itself has no dedicated
red-proof and is accepted-with-reason (a missing lockfile fails install in CI, a louder signal than a
unit assertion).

**Sensitive-areas promotion** (do not lose again): register these paths at low→medium in
`project/sensitive-areas` — `src/dialects/typescript/**` (`.raw()` code execution, ts-morph realm),
`src/core/dialect-handle.ts` (the coalescing/containment seam), `package.json#dependencies` (first
runtime dep, supply chain). Concrete paths, not a category.

**Post-verify**: `architecture.md` (Public API "3 entries", zero-deps, dialect-subpath-deferred prose)
is stale after this change → `arch_refresh_post_verify` refreshes the baseline (impact = modifying).

## 4.9 Performance Considerations

Coalescing avoids O(ops × file-size) re-serialization via the single lazy `print` at flush (ADR-0006).
`dryRun()` reads only `verb`/`path` from `pendingSnapshot()` → never triggers the getter (REQ-MC-05,
getter-spy zero calls). The run-boundary drain is O(open-handles) awaits of already-enqueued work — no
extra serialization beyond the one print per directive. 4 MiB boundary (REQ-TSD-03.7) is enforced
unchanged at the fake's emit against the SERIALIZED batch size (Stage-1 lesson). ts-morph parse cost
is per-file, once per handle chain.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: two `deviates` touchpoints (4.2c) make the current baseline outdated — the public
`exports` surface grows 3→4 and the first-ever `dependencies` entry lands. No documented boundary is
removed and no pattern is inverted (`Session`/core topology untouched; `RunContext` gains one additive
field, ambient-context pattern ADR-0011 preserved), so not `breaking`. The refresh scope now ALSO
carries the **async-surface pattern** — the first thenable object on the author surface and the
handle↔`defineFactory` run-boundary-join interaction contract — which the baseline does not yet
describe; the baseline's "3 subpaths / zero runtime deps / dialect subpath not wired / all-sync author
verbs" statements become wrong → `modifying`, triggering the post-verify baseline refresh.

## 4.11 Open Questions

None.
