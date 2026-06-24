# ADR-0016 — Read Signature Freeze: Async (ratifies ADR-0001) + Nullable `undefined`

**Status**: Accepted
**Date**: 2026-06-24
**Origin**: change `typed-options-and-read` (2026-06-22), #2 of `l1-author-surface`
**Builds on / cites**: ADR-0001 (async clause), ADR-0015 (port-growth / fake-as-conformance-anchor pattern)

## Context

`find(path).read()` returned `Promise<string>` and the engine seam threw on not-found.
Two consequences made the read surface wrong to freeze at L1:

1. **Absence is not branchable.** An author cannot write "scaffold if missing, else patch" — the only
   way to detect not-found is to catch a throw, which conflates absence with genuine read failure.
2. **Absent and empty are indistinguishable.** A throw on not-found and `""` on empty cannot both be
   branched cleanly; an idempotent generator can overwrite a user's deliberately-empty file.

The read signature is part of the L1 semver surface (`package.json#exports` + emitted `.d.ts`,
FIT-04). It must be settled with evidence before the L1 lock. This ADR has two clauses.

## Decision

### Clause A — Async (RATIFICATION, not re-litigation)

`read` stays `async` / returns a `Promise`. Already decided by ADR-0001:28-29:

> "Reads are async (`await read(path)`): the read-through is an IPC callback (`fs.readFile`) that
> crosses the process boundary. This freezes the §5 sync-vs-async signature as async."

The read-through is an out-of-process IPC callback across the SDK↔engine process boundary
(JSON-RPC `tree.read` over stdio). Synchronous read across that boundary is frozen-out by ADR-0001.

### Clause B — Nullable sentinel = `undefined` (NEW decision)

`read` returns **`Promise<string | undefined>`**:
- content present → the content string
- not-found → `undefined` (was: THROW — behaviour change)
- empty file → `""`

The not-found sentinel is `undefined` (not `null`, per explicit user decision). Because `undefined` is
not JSON-representable, the JSON-RPC `tree.read` wire carries absence as null/absent, and the SDK
translates it to `undefined` at the TS boundary.

**Wire→undefined translation site = the PORT (`EngineClient.read`).** The port returns
`Promise<string | undefined>`; the fake and the real client both stop throwing on not-found and return
`undefined`; `Session.read` and the handle bodies merely widen their return type to ride it.

This follows the ADR-0015 pattern: the boundary contract lives ON the port; the fake is the conformance
anchor the real engine must match (`EngineClient.read` → `undefined` on not-found, modelled now,
fulfilled by the real Go client at engine §6).

`Session.read` does NOT catch and does NOT coalesce — it is `await this.flush(); return this.#client.read(path)`.
No `||`, no `??` at the mapping.

## Rejected Alternatives

- **`null` instead of `undefined`** — rejected per user decision. `JsonValue` includes `null`; the
  author-facing surface uses `undefined` and the wire representation is an internal concern.
- **Throw-on-not-found (prior behaviour)** — rejected: absence is not exceptional for a read-and-decide
  flow; throwing forces `try/catch` for control flow and conflates absence with failure.
- **`Session.read` catches the throw → `undefined`** — rejected: off-pattern vs ADR-0015, conflates
  absence with failure, would require string-matching the fake's error message (the brittleness
  ADR-0015's error-attribution work also rejected).

## Consequences

- (+) Author read-and-decide flows work: `if (c === undefined) create… else if (c === "") … else modify(c)`.
- (+) Not-found-vs-empty distinction kills a real bug class (idempotent generator clobbering a
  deliberately-empty file).
- (+) Genuine read failures (permission/transport) remain throws — distinguishable from absence by
  control flow, not by string-matching.
- (−) Behaviour change THROW → `undefined` required deliberate test reversals in the existing suite
  (7 sites: 2 fidelity, 3 fidelity-missing-source, 1 contract-fake, 1 handle-types). Tracked explicitly.
- (−) FIT-04 fires; `core.base-handle.d.ts` baseline regenerated to `Promise<string | undefined>`.
- (−) Real-engine divergence: the fake models `undefined`-on-not-found that the real Go client must
  match at engine §6. Tracked (same posture as ADR-0015's commit/discard). Owned by #3.

## Fence (design-enforced, never to be relaxed without a new ADR)

1. **`as string` casts at read sites are BANNED** — they re-merge `undefined` back into `string`.
2. **`||`/`??` coalescing at the not-found mapping is BANNED** — merges `""`/`"0"`/`"false"` into not-found.
