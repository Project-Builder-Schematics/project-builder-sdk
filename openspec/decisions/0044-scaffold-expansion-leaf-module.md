# ADR-0044: `src/scaffold/` — the expansion leaf module (disk-read + directive-emit combiner)

- Status: Proposed
- Date: 2026-07-12
- Deciders: Daniel (Hyperxq)
- Origin: change `schematic-local-files` (design rev 1).
- Supersedes: **ADR-0005** (`scaffold` as pure `create` sugar, Model A/B left open).
- Builds on: ADR-0011 (ambient run-context), ADR-0013 (pure `DirectiveFactory`).

## Context

`scaffold`/`copyIn`/`create({templateFile})` are the first SDK operations that READ the
package's own disk AND emit directives. `DirectiveFactory` is pure `args→Directive`, zero
I/O (KIT-03) — it must stay that way. The logic (walk, classify, containment, filename
pipeline, chunked flush) needs a home that can do I/O and reach the run's `session`.

## Decision

House all of it in a **new isolated top-level leaf module `src/scaffold/`**, mirroring the
`dry-run/`/`testing/`/`dialects/` leaf convention. It reaches the run via `currentContext()`
and buffers/flushes via the `session` — it NEVER adds an I/O method to `DirectiveFactory`,
which gains only pure lowering (`factory.copyIn(...)` alongside `create`).

Leaf files (dependency direction `commons → scaffold → core`):

- `index.ts` — public orchestrators `runScaffold`/`runCopyIn`/`readTemplateFile`.
- `walk.ts` — folder enumeration (no descent into symlinked dirs; 10 000-entry bound).
- `filename-pipeline.ts` — pure: rename → token-translation → `.template`-strip;
  include/exclude glob; intra-scaffold destination-collision detection.
- `classify-transport.ts` — the classifier (name chosen because `classifyContent` is
  taken): stat-size gate → whole-file UTF-8/null sniff → serialized-budget → verdict,
  plus the `.template`/`templateFile` fail-loud arm.
- `containment.ts` — ceiling resolution + source/destination guards.
- `expander.ts` — the scaffold algorithm + serialized-size-accumulator chunked flush.

## Consequences

- (+) `DirectiveFactory` purity (KIT-03) and the "no tree in core" posture (ADR-0008)
  survive; the disk-read surface is quarantined in one leaf.
- (+) Matches the existing leaf pattern; `commons` verbs stay thin wrappers.
- (−) A new module boundary and the SDK's first legitimate mid-run disk read (allow-listed
  in the harness, REQ-ATH-14) — a real architectural addition, not sugar.
- Resolves ADR-0005's orphaned Model A/B: obs #915 ruled "both, by ratified classification"
  — text renders by-value on the existing `create` IR, binaries travel by-reference
  (`copyIn`); the engine-side `scaffold` wire op (0005 Model B) stays out of scope (L2).

## Alternatives Considered

- **A `DirectiveFactory.scaffold()` method** — REJECTED: forces I/O into the pure factory,
  breaking KIT-03 and FIT-01/07.
- **Logic inline in `commons/index.ts`** — REJECTED: `commons` is the frozen author
  surface (no AST/I/O imports, FIT-01/03); a disk walker there violates its budget/rules.
