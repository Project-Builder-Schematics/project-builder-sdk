# Dry-Run Plan Skeleton Specification

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-21)
**Change**: `l1-author-surface-skeleton`
**Seam**: SEAM-02

## Purpose

Exposes the `Session`'s pending directive buffer as a read-only snapshot and provides
a minimal author-vocabulary renderer that turns buffered commons directives into a
human-readable plan. The renderer is AST-blind — it derives its output solely from the
commons directive buffer (`Session.#pending`), never from the engine or any AST. Seeds
SEAM-02 so that `dry-run-and-release-shape` (#4) can grow the complete renderer into a
working slot.

## Requirements

### REQ-03: Read-Only Pending Buffer Snapshot

`Session` MUST expose a read-only snapshot of `#pending` accessible to the author-side
dry-run renderer. The snapshot MUST reflect the buffer at the moment of the call;
mutations to the buffer after the call MUST NOT affect a previously obtained snapshot.

#### Scenario REQ-03.1: Snapshot reflects directives buffered before the call

- GIVEN a `Session` with two directives buffered (`create` and `modify`)
- WHEN the pending snapshot is requested
- THEN the snapshot contains exactly those two directives in buffer order

#### Scenario REQ-03.2: Snapshot is isolated from subsequent buffer mutations

- GIVEN a pending snapshot obtained from a session with one directive
- WHEN a second directive is buffered into the session after the snapshot is taken
- THEN the snapshot still contains only one directive

### REQ-04: Minimal Dry-Run Plan Renderer

A `dryRunPlan` function MUST accept a `Directive[]` snapshot and MUST return a
`DryRunEntry[]` array where each entry carries `verb` (author vocabulary) and `path`
(primary path of the operation). The renderer MUST NOT import or invoke any AST,
engine, or filesystem module.

#### Scenario REQ-04.1: Renderer maps a create directive to author vocabulary

- GIVEN a directives array containing `{ op: "create", create: { pathTemplate: "src/foo.ts", template: "…", options: {} } }`
- WHEN `dryRunPlan` is called with that array
- THEN the result contains `{ verb: "create", path: "src/foo.ts" }`

#### Scenario REQ-04.2: Renderer maps all six commons directive ops

- GIVEN a directives array with one entry of each op kind (`create`, `modify`, `delete`, `rename`, `move`, `copy`)
- WHEN `dryRunPlan` is called
- THEN the result contains six entries with the correct author-vocabulary `verb` for each op
- AND `path` is the primary path of each directive (`pathTemplate` for create, `path` for modify/delete/rename/move, `from` for copy)

#### Scenario REQ-04.3: Renderer output equals buffered directives for a write-only chain

- GIVEN a write-only factory that calls `create<S>` once (no `.read()` call)
- WHEN the pending snapshot is captured immediately before flush
- AND `dryRunPlan` is called on the snapshot
- THEN the plan contains exactly one entry for the create verb (FIT-01 green: no AST imported)

### REQ-05: AST Import Prohibition

The dry-run renderer module MUST NOT import any module from `src/core/` or any AST
library at module load time or at call time.

#### Scenario REQ-05.1: Renderer module has no core or AST import

- GIVEN the renderer source file
- WHEN its import graph is traced
- THEN no import resolves to `src/core/**` or to any external AST package
