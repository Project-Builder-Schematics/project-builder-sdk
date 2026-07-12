# Delta for modify-coalescing

**Spec version**: V4
**Draft revision**: V2 (council feedback applied 2026-07-12)
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-5b-dialect-breadth`

## Coverage Note (non-normative, this change)

REQ-MC-01 (N distinguishable edits on one handle, no read → exactly one modify) is worded
generically over "named ops and/or `.raw()`" and the no-reparse invariant (`#ensureLive()`
parses at most once per handle) is already structural, not op-specific. Both already cover
chains that MIX the pre-existing `addImport` with this change's new ops — no REQ-MC-01 text
change is required. Design/apply should add ONE concrete fixture proving a mixed
old-op+new-op chain coalesces correctly (test-coverage only, not a spec gap).

## ADDED Requirements

### REQ-MC-08: `.modify(content)` rejects when an AST op is pending on the same handle

A dialect handle's `.modify(content)` MUST REJECT with a `dialectError` (frozen
`"dialect operation failed: "` prefix — NOT the public `AuthoringError`; growing
`AuthoringError.reason`'s closed enum is a separate, deferred amendment, per owner ruling) when
an AST-op directive is currently OPEN (buffered, not yet drained by a read or flush) on the
SAME handle. This supersedes today's silent last-write-wins, where `.modify()`'s own buffered
directive wins array-order and the AST edit is silently dropped. The rejection is ASYMMETRIC
and narrowly scoped: `.modify()` called when NO AST op is pending on the handle is UNCHANGED
and continues to work; `.read()` DRAINS the pending AST op first (the documented escape route —
calling `.modify()` AFTER a `.read()` is a legitimate sequential edit, not a collision); an AST
op enqueued AFTER `.modify()` (the REVERSE order) stays defined as today, unaffected by this
REQ.

> Non-normative implementation note (characterisation baseline): TODAY's behaviour — two
> directives land, array-order applies, the `.modify()` (`raw`) directive wins over the buffered
> AST edit, and the AST edit is silently lost — is pinned by a CHARACTERISATION test that lands
> FIRST in the implementing slice (GREEN, describing current code as evidence for the RED→GREEN
> transition). That characterisation test is then REPLACED by this REQ's reject scenarios in the
> SAME slice. The last-write-wins behaviour it captures is NOT itself a normative scenario of
> this spec (it contradicts REQ-MC-08's reject contract) — it exists solely as RED-phase
> evidence and a rollback reference, not as a shipped contract.
>
> See REQ-DG-07 for this rejection's run-wide fail-closed consequence (zero batches across the
> entire run, not just this handle).

#### Scenario REQ-MC-08.1: modify rejects while an AST op is open

- GIVEN `find(path).addImport(x)` (an open AST op, undrained) followed immediately by
  `.modify(rawContent)` on the SAME handle
- WHEN the chain runs
- THEN it REJECTS with the pinned `dialectError` prefix and a tail naming the conflict — the
  `addImport` edit is NEVER silently discarded

#### Scenario REQ-MC-08.2: modify with no pending AST op is unaffected

- GIVEN a freshly-opened handle with NO AST op yet enqueued
- WHEN `.modify(content)` is called
- THEN it succeeds exactly as today — a regression guard proving the reject is scoped, not a
  blanket ban on `.modify()`

#### Scenario REQ-MC-08.3: read() drains, then modify() succeeds (documented escape)

- GIVEN `find(path).addImport(x)` followed by `.read()` (draining the pending AST op) followed
  by `.modify(newContent)`
- WHEN the chain runs
- THEN both directives commit — the `.read()` is the documented escape route, not a workaround
  being blocked

#### Scenario REQ-MC-08.4: reverse order stays defined

- GIVEN `find(path).modify(content)` followed by `.addImport(x)` (AST op AFTER modify)
- WHEN the chain runs
- THEN it behaves exactly as today (unaffected by this REQ) — the restriction is directional,
  not symmetric

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — coalescing seam correctness (prevents silent data loss) | REQ-MC-08 | Yes |
