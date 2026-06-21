# Commit/Discard Contract Specification

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-21); amended 2026-06-21 (plan-verify iter-2 resolution: `EngineClient` port exposes `commit`/`discard` — REQ-08 prose reconciled, scenarios unchanged)
**Change**: `l1-author-surface-skeleton`
**Seam**: SEAM-03

## Purpose

Establishes the all-or-nothing commit contract for `defineFactory`: a factory function
that completes without throwing MUST commit its full directive batch to the engine
client's committed state; a factory function that throws MUST discard the staging tree
and commit nothing. This REVERSES the partial-write JSDoc in `context.ts:33-37` (which
documented that directives buffered before a throw were still emitted). The real
transactional commit is an engine §6 deliverable; the skeleton models it in
`ContractFake` and rewrites the JSDoc — the new contract is the spec, not the old
comment.

**Sensitive areas**: None (pre-release; no published consumer).

## Requirements

### REQ-06: All-or-Nothing Commit on Success

When a factory function completes without throwing, `defineFactory` MUST commit the
full set of buffered directives to the engine client. The committed result MUST
contain every directive the factory buffered, in order.

#### Scenario REQ-06.1: Write-only factory success commits full batch

- GIVEN a factory that calls `create<S>` once and returns without throwing
- WHEN the runner executes the factory to completion
- THEN the engine client's committed state contains the file created by the directive
- AND the staging tree is cleared (no pending directives remain uncommitted)

#### Scenario REQ-06.2: Multi-directive factory success commits all directives

- GIVEN a factory that buffers two directives in sequence (e.g., `create` then `modify`)
- WHEN the runner executes the factory to completion
- THEN the committed state reflects both operations applied in order

### REQ-07: Discard on Throw — Committed Tree Left Empty

When a factory function throws an uncaught error, `defineFactory` MUST discard the
staging tree. The engine client's committed state MUST remain empty — no directives
buffered before the throw MUST be applied to the committed result. The original error
MUST propagate to the caller.

This requirement supersedes the partial-write contract previously documented in
`context.ts:33-37`. The JSDoc at that location MUST be reworded to reflect the
all-or-nothing contract.

#### Scenario REQ-07.1: Factory that throws leaves committed tree empty

- GIVEN a `ContractFake` with an empty seed and a factory that buffers one `create` directive then throws
- WHEN the runner executes the factory
- THEN the committed tree is empty (the staged `create` was discarded)
- AND the staging tree is discarded (no residue remains)
- AND the original error propagates out of the runner

#### Scenario REQ-07.2: Factory that throws after multiple buffers commits nothing

- GIVEN a factory that buffers `create` and then `modify` before throwing on the third operation
- WHEN the runner executes the factory
- THEN the committed tree is empty (all staged directives were discarded)
- AND the error propagates

#### Scenario REQ-07.3: Forced rejection from fake triggers discard

- GIVEN a `ContractFake` seeded with `"src/existing.ts"` and a factory that calls `create` targeting `"src/existing.ts"` without `force: true`
- WHEN the runner executes the factory (the fake throws a `ContractFake:` collision error)
- THEN the committed tree is empty
- AND the staging tree is discarded

### REQ-08: ContractFake Models Commit/Discard Phases

`ContractFake` MUST grow a two-phase model: a staging tree (eager apply, as today) and
a committed tree (empty until explicit commit). It MUST expose `commit()` and `discard()`
methods. `commit()` MUST atomically promote the staging tree contents to the committed
tree. `discard()` MUST clear the staging tree without touching the committed tree.

The `EngineClient` interface MUST expose `commit()` and `discard()`, additive to
`emit`/`read` (their signatures are unchanged). The staging→commit boundary is an
engine concern: `defineFactory` drives it through the port on factory success/throw,
so the methods cannot live test-only on `ContractFake`. `ContractFake` implements them
as the conformance model now; the real engine fulfils the transactional commit in §6.
The committed-tree assertion accessor (`committedTree()`) stays test-only, off the port.

#### Scenario REQ-08.1: commit() promotes staging to committed

- GIVEN a `ContractFake` whose staging tree contains `"src/foo.ts": "content"`
- WHEN `commit()` is called
- THEN the committed tree contains `"src/foo.ts": "content"`
- AND the staging tree is cleared

#### Scenario REQ-08.2: discard() clears staging without affecting committed

- GIVEN a `ContractFake` whose staging tree contains `"src/foo.ts": "content"` and whose committed tree is empty
- WHEN `discard()` is called
- THEN the staging tree is empty
- AND the committed tree remains empty

#### Scenario REQ-08.3: Committed tree is independent after commit

- GIVEN a `ContractFake` that has committed `"src/foo.ts": "v1"` and then receives a new staging entry `"src/foo.ts": "v2"`
- WHEN `discard()` is called
- THEN the committed tree still contains `"src/foo.ts": "v1"`
- AND the staging tree is empty

### REQ-09: context.ts JSDoc Reflects All-or-Nothing Contract

The JSDoc for `defineFactory` in `src/core/context.ts` MUST NOT describe a
partial-write outcome. It MUST describe the all-or-nothing contract: success →
full commit, throw → full discard, original error propagates.

#### Scenario REQ-09.1: JSDoc wording matches the spec contract

- GIVEN the source of `src/core/context.ts`
- WHEN the JSDoc block for `defineFactory` is read
- THEN no sentence describes buffered directives being emitted on throw
- AND the comment explicitly states that a thrown factory commits nothing
