# Exploration: schematic-local-files (schematic-local-files)

**Triage**: L
**Persona lens**: synthesized (architect, qa-engineer, business-analyst, security-engineer)

## Cross-Change Lessons Consulted

- Engram obs #915 (`sdd/schematic-local-files/dx-contract`) — 10 owner rulings, binding.
- `openspec/pending-changes.md` rows 186/187 — `copy` is already emit-only end-to-end (fake/conformance pass, real engine drops it, PC-PROTO-01-gated) and row 187 is the OWNER-RULED origin of this change ("own change").
- `.sdd/state/schematic-local-files.json` triage_note — prior blind architect+pm council convergence; independently corroborated below (not taken on faith).

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author scaffolds a package-local folder into the target tree | none found (manual `readFileSync`+`create` workaround only) | Create |
| Author ships one templateFile via `create({templateFile})` | none found | Create |
| Author copies one package-local file via `copyIn` | none found | Create |
| Author previews a scaffold/copyIn op via `dryRun()` | `test/dry-run/*` (existing 6-verb coverage; no by-reference case) | Modify |

## Current State

`DirectiveFactory` is pure `args → Directive` (KIT-03, zero I/O) — verified in `src/core/directive-factory.ts`. `wire.ts` freezes 6 ops; `copy` is tree-to-tree only (fake's `#requireExists` checks the STAGED tree, ADR-0013 §copy) — its engine apply pass is deferred (row 186), the exact precedent this change's by-reference half will inherit. `Session.flush` (`src/core/session.ts`) emits the ENTIRE pending buffer as one `Batch` at run-end or before a `read()` — no chunking exists; the fake rejects the whole batch over `BATCH_CAP_BYTES` (4 MiB, ADR-0019), all-or-nothing. `context.ts` already reads disk ambiently and pre-`als.run`: `packageDir`-relative schema.json + reserved-name scan, explicitly exempted from the in-memory-only invariant (REQ-ATH-11.2) — the blessed precedent architect cited. No "collection.json" or multi-schematic concept exists anywhere in code today; `problem-statement.md`/`objectives-plan.md` explicitly scope "cross-collection" as **L2, out of scope**. `AuthoringReason` (`authoring-error.ts`) is a CLOSED, compile-pinned 8-value union (`originFor`'s exhaustive switch throws on a 9th). `DryRunVerb`/`WIRE_TO_AUTHOR_VERB` (`dry-run/plan.ts`) are frozen at exactly 6 members, a strict 1 wire-op ↔ 1 author-verb map (ADR-0024/25).

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/commons/index.ts` | extend | new `scaffold`/`copyIn` verbs + `create({templateFile})` | aligns |
| new expansion module (folder walk, classification, containment) | new | first module combining disk-read + directive-emission | deviates |
| `src/core/wire.ts` Directive union | modify | by-reference copy wire shape | aligns (new op) / consequential (extend `copy`) |
| `src/core/directive-factory.ts` | modify | new pure lowering method(s) | aligns |
| `testing/contract-fake.ts` + `conformance/run-vehicle.ts` | modify | represent by-reference directive in both fakes | aligns |
| `src/dry-run/plan.ts` (frozen verb map) | modify | new verb/op needs a 7th row | deviates (MAJOR, licensed) |
| `src/core/context.ts` / `RunContext` | modify | ambient collection-root, new provenance vs `packageDir` | deviates |
| `src/core/authoring-error.ts` reason union | modify | new by-reference failure reasons | deviates (closed union break) |

`openspec/architecture.md` itself is stale (claims stage-5 "not yet merged"; git log shows PR #16/#17 already merged) — recommend `/sdd-architecture refresh` alongside this change.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/commons/index.ts` | Modify | scaffold/copyIn verbs, create({templateFile}) |
| `src/core/context.ts` | Modify | ambient collection-root seeding |
| `src/core/wire.ts` | Modify | new directive shape |
| `src/core/directive-factory.ts` | Modify | new lowering method(s) |
| `src/testing/contract-fake.ts` | Modify | new op case + classification/containment fixtures |
| `src/conformance/run-vehicle.ts` | Modify | new op case |
| `src/dry-run/plan.ts` | Modify | verb-map extension |
| `src/core/authoring-error.ts` | Modify | reason-union extension |
| new `src/scaffold/` module | Create | walk, token translation, classification, containment, chunked flush |
| `openspec/decisions/0005-scaffold-folder-create.md` | Modify | resolve/supersede Model A-vs-B |
| `src/core/session.ts` | Read-only | confirm `flush()` reusable as-is for chunking |
| `test/fake/*`, `test/conformance/*`, `test/dry-run/*` | Modify | new scenario coverage |

## Sensitive Areas Crosscheck

Both triage overrides (input-validation/containment; public-api contract) map to registered rows (`security (IPC)`, `public-api (contract)`) — expected, flagged at triage. No new sensitive area surfaced.

## Approaches

### 1. Extend `copy` with a `source` discriminator
**Description**: `{ op: "copy", copy: { source: {kind: "package"|"tree", path}, to } }`.
**Pros**: no new wire op; smallest type diff.
**Cons**: breaks the frozen 1-op↔1-verb `WIRE_TO_AUTHOR_VERB` map (same op, two possible verbs); touches `copy`'s existing tree-to-tree shape — brushes the explicit out-of-scope line ("rework of existing copy semantics").
**Effort**: Medium. **Pattern fit**: hybrid.

### 2. New wire op (`copyIn`)
**Description**: A distinct op, e.g. `{ op: "copyIn", copyIn: { from, to, force? } }`, `from` always package-local.
**Pros**: `copy`'s existing contract stays untouched; clean 1:1 addition to `DirectiveFactory`/`WIRE_TO_AUTHOR_VERB` (a licensed MAJOR growth, ADR-0025's own language anticipates this); no discriminator branching in any of the 5 consuming surfaces.
**Effort**: Medium. **Pattern fit**: matches existing `src/core/wire.ts` addition precedent (how `copy` itself was added, ADR-0013).

## Recommendation

**New wire op** (Approach 2) — the frozen-map incompatibility and scope-boundary risk of Approach 1 outweigh its smaller diff. House the folder-walk/classification/containment logic in a **new isolated top-level module** (`src/scaffold/`, following the `dry-run/`/`testing/`/`dialects/` leaf convention) that calls `currentContext()` + `session.buffer()` directly — never a `DirectiveFactory` method (confirmed: `DirectiveFactory` is pure, zero I/O). Mark ADR-0005 **Superseded** (not merely revisited) — obs #915 already resolves its Model A-vs-B question as "both, by ratified classification," not an either/or.

## Risks

- **Batch-cap fan-out**: no chunking exists; a large scaffold can exceed `BATCH_CAP_BYTES` and reject the whole batch. Mitigation: the new module can call `session.flush()` directly between groups (it has core-level access) — design must pin the chunking policy.
- **Closed reason union**: `AuthoringReason` (8 values, compile-pinned) needs new by-reference failure reasons — a precedented (Stage-2-style) but consequential change to `originFor` + its compile-time pin test.
- **Ambient collection-root provenance is undesigned**: "seeded by the engine bridge" has no existing analog and must not be conflated with the existing author-supplied `options.packageDir` (different source, possibly different directory in real multi-schematic layouts).
- **Cross-repo apply gap**: only the by-reference APPLY is engine-gated (PC-PROTO-01) — same precedented shape as `copy` (row 186); steward reckoning must not read "fake/conformance green" as "engine copies bytes" (already flagged at triage).
- **Scope creep via `collection.json`**: the project's own charter scopes "cross-collection" as L2/out-of-scope; design must keep collection.json usage to a pure containment-boundary marker, never a parsed manifest.
- **Unverified binary-fraction claim**: could not access the referenced nestjs-schematics repo (GitHub lookup inconclusive) to measure real text-vs-binary ratio; the "text-by-value ships value now" framing rests on general schematics-ecosystem pattern knowledge, not a measurement — see open questions.

## Open Questions

- type: technical — "What mechanism actually seeds the ambient collection.json-anchored root into `RunContext` — is this itself a new cross-repo bootstrap contract point?" why_it_matters: could be another PC-PROTO-01-adjacent dependency triage's "engine work out of scope" line didn't anticipate.
- type: technical — "Confirm real-world binary/text ratio in an actual schematic collection (or build a representative in-repo fixture) before finalizing the by-value-first framing." why_it_matters: the DX story's strength depends on this ratio, which this exploration could not verify.
- type: product — "Confirm ADR-0005 should be marked Superseded (not revisited) given obs #915 already resolves its open question." why_it_matters: leaving it Draft repeats the exact orphaning this change exists to fix.
- type: technical — "`scaffold`'s return value: fire-and-forget vs a chainable handle group." why_it_matters: carried forward unresolved from obs #915; blocks the `commons/index.ts` signature at spec time.

## Ready for Proposal

**Status**: yes
**Reason**: Owner rulings (obs #915) plus this exploration close every ambiguity triage flagged except the wire-shape choice (resolved here) and 4 carried-forward questions (3 technical, 1 product — none blocking). No sensitive-area surprise beyond triage's own override. The one clear architectural deviation (new expansion-layer module) fits the SDK's existing "isolated top-level leaf" convention rather than conflicting with it.
**Recommended action**: Proceed to `sdd-propose`; carry the 4 open questions into spec; recommend `/sdd-architecture refresh` (baseline staleness is an independent finding, not blocking).
