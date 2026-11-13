# ADR-0037: Coalescing seam is handle-owned; the run boundary joins outstanding handles

- Status: Accepted
- Date: 2026-07-12
- Change: `stage-5-first-dialect` (S-001)
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0006 (coalescing to one `modify`), ADR-0015 (global flush-before-read),
  ADR-0010 (open handle, op-pack composition), ADR-0011 (ambient run-context)

> Renumbering note: design.md and slices.md drafted this decision as "ADR-0034". By the time
> this worktree branched from `main`, `stage-4b-testing-harness` had already landed ADRs
> 0033-0036 (third-audience author-testing, shipped-fake containment, fake-relocation parity,
> packed-tarball e2e lifecycle) — an unrelated concern that happened to claim the same number
> range in parallel. Renumbered here to the next free slot (0037), mechanically, per this
> project's established precedent for cross-branch ADR-number collisions (stage-4's own
> 0024-0028 renumber). No decision content changes; every in-repo reference to "ADR-0034" in
> this change's own planning artefacts (design.md, slices.md) refers to THIS decision.

## Context

N AST edits coalesce to ONE `modify` (ADR-0006); a global mid-chain read SPLITS coalescing to
exactly two (ADR-0015); content must cross the seam as a plain string (FIT-05); `dryRun()` must
not force serialization (REQ-MC-05). An async read-through-parse makes the dialect handle
awaitable — raising two new hazards a purely synchronous handle never had: a forgotten `await`
(lost edit, or an `unhandledRejection` from a throwing chain nobody observed), and same-path
concurrency (two handles racing the same file).

## Decision

**(1) Handle-owned seam.** A thenable handle backed by a private promise queue (`#tail =
#tail.then(op)`; every op returns `this`; `.then` delegates to `#tail`) holds ONE live AST
instance for its path. The buffered `modify` directive's `content` is a memoized lazy getter
(`print`, evaluated exactly once, at whichever flush first serializes it — ADR-0006's "serialize
once at flush" honored literally). `ensureOpen()` re-registers a FRESH directive whenever the
prior one has left `Session.pendingSnapshot()` (an identity check, not a value check) — this is
what turns a global drain mid-chain into the spec's exactly-two-modifies split, with no edit lost
and no double-buffer (FIT-19, promoted).

Every op-enqueue attaches an EAGER, synchronous, no-op shadow-catch to the just-updated `#tail`
(`#tail.catch(() => {})`) in the SAME turn it chains the op, before returning `this`. This marks
`#tail` handled the instant it exists, closing the window where a throwing-but-unawaited chain
could report an `unhandledRejection` before the run-end drain ever attaches its own observer. The
real rejection is untouched — it stays on `#tail` and re-surfaces independently for both an
author `await` and the drain's `settle()` (a settled rejected promise re-throws its reason on
every branch it is awaited from; the shadow-catch discards nothing).

**(1b) Inherited write verbs are re-owned on the dialect handle.** `modify(content)` / `rename` /
`move` / `copy` / `remove` are re-implemented here rather than inherited from commons' synchronous
`WriteOps`: each enqueues its own `session.buffer(...)` on `#tail` (preserving author order — a
synchronous buffer would file a trailing relocation directive BEFORE the coalesced AST `modify`,
inverting the required `[modify, relocation]` order) and returns the SAME thenable handle (never a
new one bound to a different path — the AST edits stay anchored to the ORIGINAL found path;
relocation directives are additive, not a rebind). `remove()` stays terminal (`void`, ADR-0004) and
is reachable only from the "found" state, before any edit.

**(2) Run-boundary join.** `RunContext` gains one additive field, `dialects: DialectRegistry`
(`register(handle)`, `drain(): Promise<void>`). `defineFactory` sequences `als.run(ctx, fn)` →
`ctx.dialects.drain()` → `session.flush()` → `commit()`, all inside the existing try/catch — a
drain rejection routes through the SAME discard-and-re-throw path a flush rejection already used.
`drain()` awaits every registered handle's `settle()` via `Promise.allSettled` (never a bare
`Promise.all`, which would itself risk an unhandled rejection on the losing settlements) and
re-throws the FIRST rejection. Completion-before-commit no longer depends on the author
remembering to `await` a chain.

**Same-path honesty.** The join guarantees COMPLETION, not INTERLEAVING. Two handles on the SAME
path, both left unawaited, both read-through the pre-edit base before either buffers — a race,
last-write-wins, read-your-own-writes violated for the loser. This is UNDEFINED BEHAVIOUR,
DOCUMENTED, not prevented (REQ-MC-07). SEQUENTIAL AWAITED same-path handles ARE defined: the
second handle's read observes the first's staged edit, producing cumulative split modifies.
Different-path concurrent handles are always safe (independent `#tail` chains, independent
directives).

## Consequences

- (+) `Session` / `DirectiveFactory` / `EngineClient` stay diff-free; the entire seam is one
  additive `RunContext` field plus one new kit-internal file.
- (+) `await` becomes optional for CORRECTNESS (the join guarantees it); it remains meaningful for
  SEQUENCING (read-your-own-writes across same-path handles, and observing a chain's result).
- (-) Dialect chains are the first thenable, async object on the author surface — one ergonomic
  departure from the synchronous commons verbs, taught explicitly (async-usage doc section).
- (-) Concurrent same-path handles are UB, a guarded expectation rather than a guarantee — the
  author must `await` between same-path handles for defined ordering.
- (+) *(council fix pass)* an async `.raw()` callback's returned promise is `await`ed INSIDE the
  same containment as a sync throw — its rejection surfaces through the frozen-prefix contained
  error (never an uncontained `unhandledRejection`), and its mutation is guaranteed observed
  before the next print.
- (-) *(known limit)* `drain()` snapshots the registered handles once; a handle registered DURING
  drain (e.g. by a dialect whose `settle()` enqueues new handles) is not re-drained in the same
  run boundary. No shipped dialect does this; a future dialect relying on nested registration
  must extend the join to drain-until-quiescent first.

**Rejected alternative — author-await-only (no join).** Relies entirely on author discipline: a
forgotten `await` either silently LOSES the edit (the chain never runs before the run-end flush)
or throws an `unhandledRejection` after the run has already reported success. Rejected because
correctness must not hinge on whether the author remembered a keyword.

**Rejected alternative — Session pre-flush thunk hook.** A persistent or one-shot thunk registered
on `Session` that re-materializes pending dialect content at flush time. A path-keyed materialize
registry on `Session` contradicts KIT-02 / ADR-0008 (no path-keyed map, no tree) and enlarges the
AST-blind port surface FIT-07 / FIT-10 guard. Buys nothing once the run-boundary join already lands
the async work inside the run before flush.

## Amendment (2026-07-12, `stage-5b-dialect-breadth`, S-000..S-005): runOp containment, fail-closed run, mutation-gated registration

**Status**: Accepted (amends Accepted ADR-0037, same seam)

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
