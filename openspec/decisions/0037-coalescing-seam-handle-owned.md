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

**Rejected alternative — author-await-only (no join).** Relies entirely on author discipline: a
forgotten `await` either silently LOSES the edit (the chain never runs before the run-end flush)
or throws an `unhandledRejection` after the run has already reported success. Rejected because
correctness must not hinge on whether the author remembered a keyword.

**Rejected alternative — Session pre-flush thunk hook.** A persistent or one-shot thunk registered
on `Session` that re-materializes pending dialect content at flush time. A path-keyed materialize
registry on `Session` contradicts KIT-02 / ADR-0008 (no path-keyed map, no tree) and enlarges the
AST-blind port surface FIT-07 / FIT-10 guard. Buys nothing once the run-boundary join already lands
the async work inside the run before flush.
