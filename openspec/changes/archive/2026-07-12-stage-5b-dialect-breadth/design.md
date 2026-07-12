# Design: Stage 5b — Dialect breadth

**Change**: `stage-5b-dialect-breadth` · **Spec**: V2 signed (owner, 2026-07-12) · **Triage**: L · **Persona lens**: none

## 4.1 Architecture Overview

This change EXTENDS the one bounded context stage-5 established (the TypeScript dialect leaf +
the ADR-0037 coalescing seam + the ADR-0012 conformance kit); it opens no new topology. Four
seams are touched: (1) `src/dialects/typescript/{ops,index}.ts` gain five structured ops
(`removeImport`, `addFunction`, `addVariable`, `addClass` ± export) reusing `addImport`'s
`(ast, ...args) => void` rhythm; (2) `src/core/dialect-handle.ts` grows one shared
contained-invoke primitive (runOp/runRaw parity) and a **mutation-gated** open-directive
registration so a semantically-null op emits zero directives; (3) `src/core/define-dialect.ts`'s
`withOps` gains an eager fail-closed collision + reserved-name check; (4)
`src/conformance/index.ts` grows the deferred tail (mandatory adversarial samples, real-base
probe, leaf rule) and the shared `deepEqual` moves to a kit-internal `src/core/` module. A new
kit-internal shared module `src/core/dialect-error.ts` (no public symbol, out of every barrel)
owns the `dialectError(tail)` factory and an `isContained(err): boolean` predicate, both backed
by a module-private `WeakSet<Error>` the factory populates. Two new fail-loud rejects (row-136
modify-after-AST-op; add-op name collision) are constructed via that factory — so they carry the
WeakSet brand — and route through the existing drain-before-flush ordering to fail the whole run
closed. The frozen `"dialect operation failed: "` prefix survives as PRESENTATION only; the
containment discriminator is the WeakSet brand (`isContained`), never a message-prefix match.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modify | Add `removeImport`, `addFunction`, `addVariable`, `addClass`; a local `assertNoCollision(ast, name)` value+import-binding predicate; imports `dialectError` from `../../core/dialect-error.ts` so the TSD-09/10/11 collision reject lands in the shared WeakSet (load-bearing for DG-06.5 passthrough — see ADR-0037 amendment). **JSDoc disambiguation** (verify-final obligation): `addFunction`'s `source` INCLUDES its `{ … }` braces; `addClass`'s `source` EXCLUDES them (the op adds the braces). Each op's `@example` shows the exact string and cross-references the contrast |
| `src/core/dialect-error.ts` | Create | Kit-internal shared module (no public symbol, out of ALL barrels/subpaths): `dialectError(tail): Error` factory + `isContained(err): boolean`, backed by a module-private `WeakSet<Error>` the factory populates. Sibling of `src/core/deep-equal.ts` — same kit-internal-shared-in-core pattern (ADR-0037 amendment folds both) |
| `src/core/context.ts` | Modify | Add kit-internal `runFailure?: { reason: unknown }` field to the `RunContext` interface (F2 poison flag, REQ-DG-07.3). `DialectRegistryImpl`/`drain` unchanged; NO import from `dialect-handle.ts` (direction held — fitness-guarded) |
| `src/dialects/typescript/index.ts` | Modify | Compose the expanded shipped pack; widen the exported op-type + `find` return type to the six-op set |
| `src/dialects/typescript/ast.ts` | Modify | Row-139: own-property/stack sweep in `parse`'s syntactic-diagnostic handling (executor-latitude, no REQ) |
| `src/core/dialect-handle.ts` | Modify | Shared `#invokeContained` (runOp sync+async + runRaw) discriminating passthrough via `isContained(caught)` (imports `dialectError`/`isContained` from `./dialect-error.ts`) — NEVER `message.startsWith`; runOp gains `opName`; **mutation-gated** `#ensureOpen`; row-136 modify guard; row-145 closure-ref clear; use `session.isPending()`; F2 poison flag: step wrapper sets `ctx.runFailure` first-wins on catch and re-throws the stored original at step/`read()` entry |
| `src/core/define-dialect.ts` | Modify | `withOps` eager collision + reserved-name throw; `RESERVED_HANDLE_NAMES` const |
| `src/core/session.ts` | Modify | Add `isPending(directive): boolean` (row-141); `pendingSnapshot()` retained for dry-run (SEAM-02) |
| `src/core/deep-equal.ts` | Create | Kit-internal shared `deepEqual` (row-146); NOT re-exported from `src/core/index.ts`, no public symbol |
| `src/conformance/index.ts` | Modify | Inject six mandatory adversarial samples; real-base structural probe (testDialect); leaf-rule contract doc + shipped-dialect assertion; import `deepEqual` from `../core/deep-equal.ts` |
| `src/testing/contract-fake.ts` | Modify | Import `deepEqual` from `../core/deep-equal.ts`; drop the local copy |
| `test/dialects/typescript/ops-removeImport.test.ts` | Create | REQ-TSD-08.1–08.6 (byte-exact goldens, RYOW, dryRun preview) |
| `test/dialects/typescript/ops-declarations.test.ts` | Create | REQ-TSD-09.* (addFunction, non-cuttable) |
| `test/dialects/typescript/ops-declarations-cuttable.test.ts` | Create | REQ-TSD-10/11 (addVariable/addClass) — **cut-lever isolate**: cutting deletes this file + its golden rows clean |
| `test/dialects/typescript/ops-exact-set.test.ts` | Create | REQ-TSD-01.1 sorted allow-list via `toEqual` (edited in same slice if cut lever fires) |
| `test/dialects/typescript/print-failure.test.ts` | Create | REQ-TSD-04.2 — `.raw(sf => sf.forget())` forces REAL ts-morph print throw (no mock) |
| `test/dialects/typescript/goldens/**` | Create | Byte-exact `.d`/fixture files for every op scenario |
| `test/core/dialect-handle.test.ts` | Modify | Row-136 characterisation→reject (same slice); runOp sync+async containment; REQ-DG-06.5 passthrough; REQ-DG-07 fail-closed; mutation-gate zero-directive; no-reparse parse-count spy; row-145 annotated-untested |
| `test/core/define-dialect-collision.test.ts` | Create | REQ-DG-02.4 (RED colliding real-`SourceFile` packs), 02.2 (GREEN disjoint), 02.5 (reserved `then`) |
| `test/types/define-dialect.test.ts` | Modify | REQ-DG-02.1 intersection compile-pin unchanged; note runtime-collision is the load-bearing proof |
| `test/conformance/typescript-conformance.test.ts` | Modify | REQ-DC-06 (six samples run), REQ-DC-07.1 (leaf), REQ-DC-08.1 (real-base) against the shipped dialect |
| `test/conformance/planted/**` | Create/Modify | Identity-fixture RED (DC-08.1); opt-out-attempt RED/compile-pin (DC-06.2) |
| `test/fixtures/red/**` | Create | Async-op containment red fixture (DG-06.2); colliding op-pack pair typed over real `SourceFile` (DG-02.4), outside `src/conformance/**` |
| `test/docs/security-authoring-guard.test.ts` | Modify | **Row-138 guard flip** (SAME slice as removeImport): extend the positive shipped-verbs loop (`["defineDialect", …, "addImport"]`) with `removeImport`/`addFunction`/`addVariable`/`addClass`, AND **DELETE** the negative `never names unshipped surface (e.g. removeImport)` test (lines 76-78) — delete, not invert (an inverted copy duplicates the positive loop). **Registry guard additions**: (a) assert the `openspec/sensitive-areas.md` `security (code execution)` row reads `high` (not `medium`); (b) assert the stale sentence "All entries are `confidence: low` and **anticipated**" is ABSENT |
| `docs/authoring-a-dialect.md` | Modify | Document the five new ops, the row-136 reject + read() escape, and the leaf-rule documented-limit (REQ-DC-07). Specifically: op-inventory prose update (the "one structured op" claim is now false); `removeImport` paragraph (exported-name matching, idempotent absent no-op, last-binding-deletes-import, named-imports-only scope stated explicitly); `source`/`initializer` teaching (incl. the `addFunction`-braces-included vs `addClass`-braces-excluded contrast); modify-after-AST-op reject rule + read()-drain escape; async-op containment note; `withOps` collision + reserved-names line |
| `test/fitness/fit-04-*` baseline (`typescript.index.d.ts`) | Modify | New op signatures on the frozen `./typescript` subpath (per-op, SAME slice) |
| `test/fitness/fit-14-*` (`pkg-surface-baseline.json`) | Modify | `./typescript` op signatures + additive `dist/core/deep-equal.*` tarball entry |
| `openspec/sensitive-areas.md` | Modify | Promote `security (code execution)` medium→high; correct the stale "Review Required" paragraph |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Typed `removeImport` on an existing file | Modify | REQ-TSD-08 | `test/e2e/dialect-modify.e2e.test.ts` (extend) | destructive op end-to-end, dryRun-visible |
| Typed `addFunction`/`addVariable`/`addClass` ± export | Create | REQ-TSD-09/10/11 | `test/e2e/dialect-modify.e2e.test.ts` (extend) | the named pain ("export a function") through the real subpath |
| Two real op-packs collide via `withOps` | Create | REQ-DG-02 | `test/core/define-dialect-collision.test.ts` | integration-level (composition throws before any run) |
| Conformance adversarial/leaf/real-base tail | Modify | REQ-DC-06/07/08 | `test/conformance/typescript-conformance.test.ts` | kit self-run against the shipped dialect |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/typescript/{ops,index}.ts` | extend | five new ops, same shape as `addImport` | aligns |
| `src/dialects/typescript/ast.ts` | extend | row-139 diagnostic-sweep internals | aligns |
| `src/core/dialect-handle.ts` (coalescing seam) | modify | shared containment, mutation-gate, row-136 reject, row-145 | aligns (ADR-0037 amendment, same seam) |
| `src/core/define-dialect.ts` | modify | `withOps` runtime collision/reserved-name check (ADR-0010's own anticipated diagnostic) | aligns |
| `src/core/session.ts` | modify | additive `isPending()` (row-141) | aligns |
| `src/core/context.ts` | modify | additive kit-internal `RunContext.runFailure?` poison field (F2); no new import edge | aligns |
| `src/core/deep-equal.ts` | new | kit-internal dedup joining the EXISTING core layer, no barrel/subpath | aligns |
| `src/core/dialect-error.ts` | new | kit-internal WeakSet-branded error factory + `isContained`, joining the EXISTING core layer, no barrel/subpath | aligns |
| `src/conformance/index.ts` | extend | ADR-0012 deferred tail | aligns |
| `src/testing/contract-fake.ts` | modify | consume shared `deepEqual` (no new `./conformance`→`./testing` edge — both point to core) | aligns |

No `deviates` rows — every touch reuses an established pattern within the one bounded context.

## 4.3 Data Model

No new data shapes cross the wire. `Op<Ast>` stays `(ast, ...args) => void` (frozen). New op
signatures (ratified owner ruling #4): `removeImport(name: string, from: string)`;
`addFunction(name: string, source: string, options?: { export?: boolean })`;
`addVariable(name: string, initializer: string, options?: { export?: boolean; kind?: "const" |
"let" | "var" })` (`kind` default `"const"`); `addClass(name: string, source: string, options?:
{ export?: boolean })`. Kit-internal: `Session.isPending(d: Directive): boolean`;
`deepEqual(a: unknown, b: unknown): boolean` at `src/core/deep-equal.ts`; `dialectError(tail:
string): Error` + `isContained(err: unknown): boolean` at `src/core/dialect-error.ts`
(module-private `WeakSet<Error>` brand); `RunContext.runFailure?: { reason: unknown }` (F2 poison
flag — run-scoped, first-wins, never crosses the wire).

## 4.4 Interface Contracts

Observable surface = the `@pbuilder/sdk/typescript` handle gains five chainable op methods
(additive semver on the frozen subpath). Error taxonomy — every contained error is built by
`dialectError()` (WeakSet brand + frozen `"dialect operation failed: "` presentation prefix,
`.cause` absent, no ts-morph/pack internals). **Leak constraint** (record in ADR-0037
amendment): a contained message is constructed ONLY from `{path}` + op name + frozen literals —
the caught error's `.message` is NEVER interpolated. Final wordings (tech-writer derivations,
pinned):
- **modify-after-AST-op** (REQ-MC-08): `dialect operation failed: cannot .modify() "{path}" while a structured edit is pending on the same handle — the pending edit would be lost; call .read() to commit it first, then .modify()`.
- **add-op collision** (REQ-TSD-09/10/11 — ONE template, three call sites; `{op}` ∈ `addFunction`/`addVariable`/`addClass`): `dialect operation failed: {op}("{name}") on "{path}" — a value or import binding named "{name}" already exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, or edit it with .raw().`.
- **foreign wrap** (`runOp`/`runRaw` catch; `{op}` passes `"raw"` for `runRaw` → byte-identical to today): `dialect operation failed: {op}() on "{path}" threw`.

Two new **compose-time** throws (distinct `"op-pack composition failed: "` prefix — see ADR-0010 amendment; NOT WeakSet-branded, keeping the containment discriminator unambiguous):
- collision: `op-pack composition failed: duplicate op "{name}" declared by more than one pack`.
- reserved: `op-pack composition failed: op "{name}" collides with a reserved handle verb` (the `then`-specific case may append a why-clause, e.g. that shadowing `then` breaks the PromiseLike join).

`removeImport`'s absent-binding case emits **zero directives** (REQ-TSD-08.4). Deterministic
insertion rule (REQ-TSD-09/10/11): **new top-level declarations append at end-of-file, in call
order** (ts-morph `addStatements`); goldens encode it byte-exact.

## 4.5 Architecture Decisions

### ADR-0039: Fail-loud rejection of author-incoherent dialect operations

**Status**: Proposed

**Context**: Two author actions today either silently lose data or produce invalid TS:
`.modify(content)` after an open AST op wins array-order and drops the AST edit (row-136,
verified live); and a second top-level declaration under an existing value name yields invalid
TS. `addImport`, by contrast, MERGES (imports coexist safely). Owner rulings #3/#4 pinned both
new cases as `dialectError` REJECTS (not the public `AuthoringError` — growing its closed
`reason` union is a deferred MAJOR).

**Decision**: Reject both, fail-loud, with a contained `dialectError`. (a) **Row-136**: inside
`runModify`'s enqueued step, throw when the handle's own open directive is still pending —
predicate `this.#openDirective !== undefined && session.isPending(this.#openDirective)`, the
IDENTICAL condition `#ensureOpen` already tests. Asymmetric and directional: `.modify()` with
no pending AST op is unchanged; `.read()` drains (documented escape); AST-op-after-modify is
unchanged. A GREEN characterisation test pinning today's silent LWW lands FIRST, then is
REPLACED by the reject scenarios in the SAME slice. (b) **Add-op collision**: each add-op calls
`assertNoCollision(ast, name)` — rejects when a VALUE-namespace declaration
(`function`/`const`/`let`/`var`/`class`) OR an import binding exists under `name`, cross-kind;
`type`/`interface` are exempt (legal TS coexistence). The collision reject is constructed via
`dialectError()` **imported** from `../../core/dialect-error.ts` — LOAD-BEARING: only then does
the thrown error carry the WeakSet brand, so `#invokeContained`'s `isContained` passthrough
(REQ-DG-06.5) recognises it instead of double-wrapping. This does NOT breach FIT-08: FIT-08 bans
RE-EXPORTING kit symbols from author subpaths (it scans `export { … }` brace-lists on a fixed
path set); `ops.ts` is not in that scanned set at all, `dialectError`/`isContained` are not in
`KIT_SYMBOL_NAMES`, and IMPORTING (not re-exporting) from core is already how
`dialects/typescript/index.ts` obtains `defineDialect`/`defineOpPack`/`withOps`. The earlier
"reproduce the prefix as a leaf literal, do not core-import — FIT-08" reading was wrong and is
dropped; there is no duplicated contract literal.

**Consequences**: (+) no silent data loss; fail-loud coherence for security-motivated edits.
(+) declarative desired-state mental model for authors. (−) an asymmetry with `addImport`
(merge) authors must learn — documented. (−) the leaf takes a compile-time import edge on the
kit-internal `dialect-error.ts` factory (legal, already the norm for `define-dialect.ts`) —
accepted as the cost of the unforgeable WeakSet brand.

**Alternatives considered**: **Document row-136 as UB** — rejected: ships the silent-data-loss
footgun ADR-0037 explicitly refused for the await problem. **Grow `AuthoringError.reason`** —
rejected: closed-union MAJOR, deferred out by the row-141 split.

### ADR-0037 amendment: runOp containment, fail-closed run, mutation-gated registration

**Status**: Proposed (amends Accepted ADR-0037, same seam)

**Context**: `runOp` never wrapped its `fn` (row-137: an `async` op typed `=> void` floats its
rejection uncontained); a no-op op still buffered a modify (blocks REQ-TSD-08.4's zero
directives); the deliberate-reject discriminator was a message-prefix match (fragile — see F1);
and any reject must fail the whole run closed across BOTH the same and a DIFFERENT handle
(REQ-DG-07.3), which promise-chain construction alone does not deliver for the cross-handle case.

**Decision**: (0) **WeakSet-branded contained-error module** (`src/core/dialect-error.ts`,
kit-internal, no public symbol, out of every barrel): `dialectError(tail)` mints a fresh `Error`
with the frozen presentation prefix AND adds it to a module-private `WeakSet<Error>`;
`isContained(err)` is the WeakSet membership test. This is the SAME kit-internal-shared-in-core
pattern as `deep-equal.ts` (§ADR-0012 amendment clause 4) — one decision covers both module
homes; no separate ADR is minted for either (ADR count stays flat). (1) **One shared
`#invokeContained(fn, foreignTail)`** routed through by BOTH `runRaw` and `runOp`: run `fn`,
`await` a thenable result inside the try, and on catch RETHROW verbatim **iff `isContained(caught)`**
(deliberate-reject passthrough, REQ-DG-06.5 — no double-wrap, no `.cause`), else wrap as
`dialectError(foreignTail)`. The discriminator is the WeakSet brand, NEVER `message.startsWith`.
Rationale: a buggy op interpolating a caught ts-morph error into a message that happened to start
with the prefix would otherwise be rethrown VERBATIM, bypassing the DG-06 leak-budget
sanitisation; a coincidental foreign prefix would misclassify. The WeakSet is unforgeable,
non-enumerable, carries no class name into the error (leak budget), and dodges cross-realm
`instanceof` fragility. runOp takes `opName` for its tail. Awaiting inside containment blocks
subsequent chained ops until the async op settles (author-order). (2) **Mutation-gated
`#ensureOpen`**: register the open lazy directive only when an op actually changes the print vs a
`#lastEmittedText` baseline (seeded from `#ensureLive`'s read). A true no-op (absent
`removeImport`) never registers → zero directives (REQ-TSD-08.4); an add-then-revert keeps the
already-registered directive → one coalesced modify === seed (REQ-TSD-08.6, NOT retroactive
cancellation). (3) **Fail-closed, run-scoped poison flag** (F2). Same-handle sequencing is
emergent — `dialects.drain()` runs BEFORE `session.flush()`, so any handle rejection re-throws
pre-flush → zero batches for every handle, and a chained op on the SAME handle propagates the
original by `#tail` construction. The CROSS-handle case (REQ-DG-07.3: "same OR different handle",
"MUST NOT be attempted as a fresh operation") is NOT covered by promise-chain construction — a
different handle's `#tail` is independent, so its op WOULD run `fn`/mutate/buffer (its effect is
never committed, but it executes). To make "never attempted" literal: a plain run-scoped field
`RunContext.runFailure?: { reason: unknown }` is set **first-wins** in the step wrapper's catch
(storing the surfaced/contained error) and **checked at step entry AND at `read()` entry** —
when set, the step re-throws the stored ORIGINAL instead of executing, which also makes a
post-death `.read()` re-throw rather than return stale staging. The field lives on the
`RunContext` interface in `context.ts`; it is set/read via `currentContext()` from
`dialect-handle.ts`, so the dependency direction is unchanged (`context.ts` still imports NOTHING
from `dialect-handle.ts` — a fitness guard asserts that edge stays absent). The `drain()`
`Promise.allSettled` first-rejection ordering is the always-on backstop; the flag upgrades the
observable contract to "not attempted" without racing it. (4) Row-145: null the getter's
`resolve` closure ref after memoizing so the live AST is GC-eligible. (5) **Leak constraint**
(§4.4): a contained message is built ONLY from `{path}` + op name + frozen literals — the caught
error's `.message` is never interpolated (the SENTINEL leak test in §4.6 is its structural
proof).

**F1 decision** (BLOCKING): adopt the WeakSet brand as the sole containment discriminator;
prefix demoted to presentation. **Rejected**: message-prefix matching — a buggy/coincidental
prefix bypasses leak sanitisation and misclassifies foreign errors.
**F2 decision** (BLOCKING): adopt option (a), the run-scoped poison flag. **Rationale**: it
satisfies REQ-DG-07.3's "MUST NOT be attempted as a fresh operation" LITERALLY for the
cross-handle case, needs no spec-text touch (so no owner unfreeze), keeps the dependency
direction intact (plain field on `RunContext`, no reverse import), and fixes stale post-death
`.read()` as a bonus. **Rejected**: option (b) "argue the contract is met by zero-batches alone"
— a different handle's op literally executes without the flag, contradicting "never attempted",
and reconciling the scenario wording would need a signed-spec unfreeze; no hard problem was found
with (a).

**Consequences**: (+) runOp/runRaw containment cannot drift and cannot be spoofed by a message
prefix. (+) declarative zero-directive no-ops. (+) cross-handle "never attempted" holds literally,
not just observably. (−) the mutation-gate probes `print(#live)` per op — a bounded relaxation of
ADR-0006's "serialize once at flush" (the buffered getter still resolves once); documented,
correctness over micro-perf. (−) FIT-19 split path re-verified under the gate. (−) one extra
kit-internal field on `RunContext` (`runFailure`) — never serialized, run-scoped, no wire impact.

### ADR-0010 amendment: `withOps` runtime collision + reserved-name check

**Status**: Proposed (amends Accepted ADR-0010)

**Context**: ADR-0010 promised "a readable diagnostic + a disjoint-names convention" but left
collisions as an incompatible-intersection compile artifact. The kit's `any`-erasure means a
THIRD-PARTY (or fixture) pack collision evaporates at the type level — a runtime test cannot
red-prove a compile error, so the load-bearing proof MUST be runtime.

**Decision**: `withOps` performs an EAGER, synchronous, fail-closed check at composition: (a)
an op name declared by two or more of the passed packs (or colliding with `base.ops`) throws
`op-pack composition failed: duplicate op "{name}"…`; (b) an op name in `RESERVED_HANDLE_NAMES`
(the full base vocabulary — `then`, `read`, `raw`, `modify`, `rename`, `move`, `copy`, `remove`
— superset of the spec's illustrative `then`/`read`/`modify`/`raw`, to prevent silent shadowing
of ANY base verb) throws `op-pack composition failed: op "{name}" collides with a reserved
handle verb`. These compose-time throws are NOT WeakSet-branded (they are minted outside
`dialectError()`), so `#invokeContained`'s `isContained` discriminator never mistakes one for a
deliberate contained reject — and they fire at composition, before any run exists. The DISTINCT
`"op-pack composition failed: "` prefix additionally keeps the two families legible to a reader.
Type-level intersection (REQ-DG-02.1) is unchanged; no type-level collision diagnostic is added
(theatre for the runtime-proven case).

**Consequences**: (+) the deferred diagnostic ships, RED+GREEN, against real `SourceFile` packs.
(+) `then`-shadow (breaks PromiseLike join) is caught. (−) a legitimately-named third-party op
matching a base verb is blocked — acceptable (base verbs are reserved).

**Alternatives considered**: **Compile-time only** — rejected: unprovable against `any`-erased
third-party packs. **WeakSet-brand the compose-time throws too** — rejected: they are not
run-op contained rejects and must never be recognised by `isContained` as passthrough; keeping
them unbranded (and out of `dialectError()`) is what preserves the discriminator's meaning.

### ADR-0012 amendment: conformance tail + `deepEqual` extraction

**Status**: Proposed (amends Accepted ADR-0012)

**Context**: the adversarial-sample battery, the leaf rule, and the real-base rule for
`testDialect` were deferred to this change; and `deepEqual` is duplicated across
`./conformance` and `./testing` (FIT-17 forbids the cross-edge).

**Decision**: (1) **Mandatory samples** — `testDialect`/`testOpPack` inject six adversarial
samples (empty, comment-only, 4 MiB, CRLF, BOM, duplicate-target) ADDITIVELY on every run; the
fixture type carries no field to disable them (compile-level, REQ-DC-06.2). (2)
**Real-base probe** (REQ-DC-08) — a RUNTIME structural probe: `parse(sample)` must return a
non-null object distinct from the input string; an identity/stub `parse` returns the string →
FAIL. Combined with the six mandatory samples a vacuous fixture cannot pass. A type-level brand
is REJECTED (`any`-erasure evaporates it; fakeable = theatre). (3) **Leaf rule** (REQ-DC-07) —
**documented-limit**: the kit DOCUMENTS the leaf contract; the SDK's shipped dialect is enforced
by the existing FIT-01 transitive walk (REQ-DC-07.1 asserted there, surfaced through the
conformance test module); third-party dialects self-run it via their own tooling. NO new public
static entry point (PM balloon-watch; the in-memory vehicle is not a static analyzer). (4)
`deepEqual` moves to kit-internal `src/core/deep-equal.ts`, imported by both consumers; NOT in
any barrel/subpath (no public symbol; FIT-04 unchanged; FIT-14 gains one additive tarball row).
This is the SAME kit-internal-shared-in-core decision that homes `dialect-error.ts` (F1 — see
ADR-0037 amendment clause 0): two sibling no-public-symbol modules, one decision, no extra ADR.

**Consequences**: (+) conformance theatre closed honestly. (−) leaf rule runtime-enforced only
for the SDK's own dialect — a documented limit, not a silent gap. (−) FIT-14 baseline +1 row.

**Alternatives considered**: **Static leaf entry point** — rejected (public surface + not the
vehicle's job). **Type-brand real-base** — rejected (fakeable theatre).

## 4.6 Test Derivation

| REQ-ID | Scenario | Level | Test | Flow ref |
|---|---|---|---|---|
| REQ-TSD-01.1 | exact op-set `toEqual` | unit | `ops-exact-set.test.ts` | — |
| REQ-TSD-01.2 | addImport before/after golden | unit | `ops-removeImport.test.ts` | — |
| REQ-TSD-04.1 | real parse failure contained | integration | `dialect-handle.test.ts` | — |
| REQ-TSD-04.2 | real print failure contained (`forget()`) | integration | `print-failure.test.ts` | — |
| REQ-TSD-08.1 | sibling binding survives byte-exact | unit | `ops-removeImport.test.ts` | removeImport |
| REQ-TSD-08.2 | last binding deletes whole import | unit | `ops-removeImport.test.ts` | removeImport |
| REQ-TSD-08.3 | aliased matched by exported name | unit | `ops-removeImport.test.ts` | removeImport |
| REQ-TSD-08.4 | absent = idempotent no-op, ZERO directives | integration | `dialect-handle.test.ts` | removeImport |
| REQ-TSD-08.5 | dryRun() preview of destructive op | unit | `ops-removeImport.test.ts` | removeImport |
| REQ-TSD-08.6 | add-then-remove RYOW, one modify === seed | integration | `dialect-handle.test.ts` | removeImport |
| REQ-TSD-09.1 | non-exported function golden | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.2 | exported function golden | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.3 | cross-kind collision (const) rejects | integration | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.4 | comment-only seed preserved | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.5 | CRLF preservation | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.6 | run-twice byte-identical | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.7 | import-binding collision rejects | integration | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-09.8 | type-alias does NOT collide | unit | `ops-declarations.test.ts` | addFunction |
| REQ-TSD-10.1 | non-exported const golden | unit | `ops-declarations-cuttable.test.ts` | addVariable |
| REQ-TSD-10.2 | exported let golden | unit | `ops-declarations-cuttable.test.ts` | addVariable |
| REQ-TSD-10.3 | collision rejects (own scenario) | integration | `ops-declarations-cuttable.test.ts` | addVariable |
| REQ-TSD-10.4 | empty-file seed golden | unit | `ops-declarations-cuttable.test.ts` | addVariable |
| REQ-TSD-11.1 | non-exported class golden | unit | `ops-declarations-cuttable.test.ts` | addClass |
| REQ-TSD-11.2 | exported class golden | unit | `ops-declarations-cuttable.test.ts` | addClass |
| REQ-TSD-11.3 | collision rejects (own scenario) | integration | `ops-declarations-cuttable.test.ts` | addClass |
| REQ-TSD-11.4 | empty-file seed golden | unit | `ops-declarations-cuttable.test.ts` | addClass |
| REQ-DG-02.1 | intersection compile-pin | contract | `types/define-dialect.test.ts` | — |
| REQ-DG-02.2 | disjoint real packs compose (GREEN) | integration | `define-dialect-collision.test.ts` | withOps collide |
| REQ-DG-02.3 | defineOpPack in isolation | unit | `define-dialect-collision.test.ts` | — |
| REQ-DG-02.4 | colliding real packs throw (RED) | integration | `define-dialect-collision.test.ts` | withOps collide |
| REQ-DG-02.5 | op `then` collides reserved vocab | integration | `define-dialect-collision.test.ts` | withOps collide |
| REQ-DG-06.1 | sync throw contained | integration | `dialect-handle.test.ts` | — |
| REQ-DG-06.2 | async reject contained, zero unhandled, zero batches | integration | `dialect-handle.test.ts` + red fixture | — |
| REQ-DG-06.3 | async resolve lands in coalesced modify | integration | `dialect-handle.test.ts` | — |
| REQ-DG-06.4 | async blocks subsequent chained ops | integration | `dialect-handle.test.ts` | — |
| REQ-DG-06.5 | deliberate-reject passthrough byte-exact (WeakSet brand, not prefix) | integration | `dialect-handle.test.ts` | — |
| REQ-DG-06.* | SENTINEL leak: op throws error with a unique token → token ABSENT from surfaced `.message` AND every own-property AND `.cause` | integration | `dialect-handle.test.ts` | — |
| REQ-DG-07.1 | row-136 reject fail-closed (zero batches) | integration | `dialect-handle.test.ts` | — |
| REQ-DG-07.2 | collision reject fail-closed (zero batches) | integration | `dialect-handle.test.ts` | — |
| REQ-DG-07.3 | chained-after-reject surfaces original — SAME handle (`#tail`) AND DIFFERENT handle (poison flag: second handle's op never executes, re-throws stored original); post-death `.read()` re-throws | integration | `dialect-handle.test.ts` | — |
| REQ-MC-08.1 | modify rejects while AST op open | integration | `dialect-handle.test.ts` | — |
| REQ-MC-08.2 | modify with no pending op unaffected | integration | `dialect-handle.test.ts` | — |
| REQ-MC-08.3 | read() drains then modify succeeds | integration | `dialect-handle.test.ts` | — |
| REQ-MC-08.4 | reverse order stays defined | integration | `dialect-handle.test.ts` | — |
| REQ-DC-06.1 | injected samples run even if fixture supplies none | integration | `typescript-conformance.test.ts` | conformance |
| REQ-DC-06.2 | fixture cannot suppress injection (compile) | contract | `planted/**` | conformance |
| REQ-DC-07.1 | shipped dialect passes leaf check | architectural | `typescript-conformance.test.ts` + FIT-01 | conformance |
| REQ-DC-08.1 | identity fixture rejected | integration | `planted/**` | conformance |
| (verify-final obligation) | sensitive-areas `security (code execution)` row reads `high` | guard | `security-authoring-guard.test.ts` | — |
| (verify-final obligation) | stale "All entries are `confidence: low` and **anticipated**" sentence ABSENT | guard | `security-authoring-guard.test.ts` | — |
| (verify-final obligation) | `addFunction` `@example` shows braces-included `source`; `addClass` `@example` shows braces-excluded `source`, cross-referencing the contrast | guard (JSDoc) | `ops.ts` JSDoc + FIT-06 example scan | addFunction/addClass |

Coverage note (REQ-MC-01, non-normative): a mixed `addImport`+new-op chain fixture in
`dialect-handle.test.ts` proves coalescing; the parse-count spy pins no-reparse across it.

## 4.7 Fitness Functions

- **Async-op containment**: a red fixture (`test/fixtures/red/**`) proves an `async` runOp op's
  rejection surfaces contained (REQ-DG-06.2) — FIT-20-adjacent.
- **`withOps` collision exact throw**: RED (colliding real-`SourceFile` packs) + GREEN (disjoint)
  + reserved `then` (REQ-DG-02).
- **Exact op-set allow-list**: `toEqual` on sorted `Object.keys(dialect.ops)` (REQ-TSD-01.1).
- **No-reparse**: parse call-count spy stays 1 per handle across mixed-op chains.
- **Leaf isolation**: FIT-01 transitive walk unchanged (proves REQ-DC-07.1 for the shipped
  dialect); `deepEqual` extraction adds no `./conformance`→`./testing` edge (FIT-17 holds).
- **Dependency-direction guard (F2)**: a static import-scan asserts `src/core/context.ts` takes
  NO import from `src/core/dialect-handle.ts` — the poison flag lives on `RunContext` and is
  reached via `currentContext()`, so the one-way edge (dialect-handle → context) must stay
  one-way. Red-proof: a planted fixture adding that import is caught.

## 4.8 Migration / Rollout

Fully reversible (ADR-0008, no persisted state). Each new op commits its FIT-04 `.d.ts` + FIT-14
pkg-surface baseline rows in the SAME slice (rollback invariant). Row-136 reverts to the
pre-existing silent LWW (documented by its RED characterisation baseline). `deepEqual` extraction
reverts cleanly (internal, no public symbol). `dialect-error.ts` extraction reverts cleanly
(internal, no public symbol; the `dialectError` inline in `dialect-handle.ts` is what it
replaces). Cut lever: `addVariable`/`addClass` (REQ-TSD-10/11) are isolated in
`ops-declarations-cuttable.test.ts` + their golden rows; cutting also edits the REQ-TSD-01.1
allow-list array in the same slice. Registry promotion (sensitive-areas medium→high +
stale-paragraph fix) is a verify-final + pre-archive-gate obligation, encoded as a File Changes
row. **Archive-time doc-staleness refresh obligations** (F3): once the five ops ship, two prose
claims go stale and MUST be refreshed at archive — `src/dialects/typescript/index.ts`'s JSDoc
"thin starter op-pack (`addImport`)" claim, and the `dialect-authoring-standards` main-spec
"thin" prose. Both are recorded here so `sdd-archive` refreshes them (not silent drift).

## 4.9 Performance Considerations

The mutation-gate probes `print(#live)` once per op — bounded; source files are small and the
buffered directive still serializes once at flush. No throughput/latency budget affected.

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: every touchpoint (4.2c) is `aligns` with `extend`/`modify`/`new` actions that ADD
capability inside existing boundaries — five ops on the frozen `./typescript` subpath
(additive semver), two kit-internal core modules (`deepEqual`, `dialect-error` — no public
symbol, no barrel/subpath), an additive `RunContext.runFailure?` poison field, conformance-kit
assertions, and a `withOps` runtime check that fulfills ADR-0010's own deferred promise. No
boundary, dependency direction (the F2 fitness guard PROVES `context.ts`→`dialect-handle.ts`
stays absent), data-ownership line, or pattern changes; the four ADRs fulfill previously-deferred
commitments (additive) rather than reversing decisions. The baseline GAINS entries; nothing
documented becomes wrong (post-verify refresh will record the new ops, the `deepEqual` +
`dialect-error` modules, the poison field, and the sensitive-areas promotion).

## 4.11 Open Questions

None.
