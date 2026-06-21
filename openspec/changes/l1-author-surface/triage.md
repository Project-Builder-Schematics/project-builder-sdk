# Triage: L1 Author Surface

**Classification**: XL (re-triaged 2026-06-21 from L — program decomposition accepted by user)
**Decided at**: 2026-06-21T00:00:00Z
**Change name**: `l1-author-surface`

> **Re-triage to XL (2026-06-21).** The initial L classification held until `sdd-explore` resolved 4
> product decisions that materially GREW the scope: Q1 added a read-through-evidence SPIKE (§9.0) + a
> confirming async ADR; Q2 brought the dry-run plan renderer INTO L1; Q3 promoted the mid-chain contract
> to all-or-nothing commit semantics requiring a commit/discard model in the contract fake; Q4 promoted the
> `dist/core` tarball close into L1. On top of the 3 greenfield seams (typed-options, error-to-author,
> frame-cap) + 5 ADRs, this crosses into XL (3+ new patterns, 15+ files, multiple test categories,
> a natural value-half/failure-half/release-hardening seam). User accepted PROGRAM decomposition →
> `sdd-program`. Original L criteria + scope below are preserved as the program's source contract.

## Problem & Scope

> Schematic authors — and the project itself — get zero authoring value today. The foundations-skeleton walks against a contract fake engine but no one can write a useful factory.ts: there are no typed `options` from schema.json (the line between authoring a schematic and writing a script), no read-disk, and no author-facing errors when the engine rejects an op. The skeleton walks, but nobody can ride it. Now: foundations-skeleton is archived, the public API names are frozen, the package is publish-shaped, and L1 is the first release that delivers author value AND the first public release — so the most semver-sensitive decision (the sync-vs-async `read()` signature, ROADMAP §5) locks the moment it ships and must be deliberate now.

```yaml
scope:
  in_scope:
    - commons agnostic author verbs delivering real value (create / remove / move / rename / find / read)
    - typed options derived from schema.json (typed-options parity — the load-bearing differentiator)
    - the fluent chain (commons composition on one handle)
    - read-disk (read(path) against the engine's existing fs.readFile callback)
    - error-to-author: engine rejection attributed to the authoring action, in author vocabulary,
        including mid-chain rejection (what the author sees + staging-tree state when some ops already applied eagerly)
    - the 4 MiB frame-cap behaviour for large content
    - the sync-vs-async read() signature DECIDED and FROZEN (ROADMAP §5)
  out_of_scope:
    - read-staged / read-your-own-writes (gated on engine §6 — ir.emit/tree.read not on the wire yet)
    - any dialect / AST work (T-M2)
    - coalescing a chain into one Modify (T-M2)
    - L2 composition, .raw escape hatch, L3 cross-collection, L4 external collections
    - sync-vs-async DSL machinery (input delegation, suspension) — L2
    - smart refactor with reference updates (T-M3)
```

## Description Received

> L1 author surface: typed options from schema.json, read-disk, error-to-author (engine rejection in author vocabulary including mid-chain), 4 MiB frame-cap, fluent chain, and the sync-vs-async `read()` decision frozen. First public release.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | commons/index.ts, handle-state.ts, session.ts, wire.ts, engine-client.ts, +3–4 new files (typed-options, errors, tests) → ~8–12 files | L |
| Lines affected (estimated) | typed-options schema extraction ~200-400, error-to-author layer ~150-250, read-disk ~50-100, frame-cap ~30-80, tests — total 600–1000+ | L |
| Bounded contexts | 2: authoring API surface (commons/) + core wire/session internals (core/) | M–L |
| New patterns | typed-options from JSON Schema (new), error-to-author attribution (new) — two distinct new patterns | L |
| Test types | Error-to-author mid-chain partial state requires new adversarial categories not present in foundations-skeleton | L |

### Overrides Triggered

- None from the standard sensitivity matrix (no auth/payments/privacy/security/deployment/migration). The public-API contract surface is review-required but is not a security override — it is handled by the persona matrix (tech-writer + architect review).

**Final classification**: L — four criteria independently score L; no XL (all scope is within one package/layer, 2 bounded contexts, not 3+).

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4–6 slices)
- Slice target: 4–6

## Recommended Personas (L only)

| Role | Reason |
|---|---|
| Business Analyst | Always for L; acceptance criteria for each author verb |
| PM | Always for L; scope discipline on first public release — nothing slips in |
| Architect | Always for L; sync/async decision, error model design, frame-cap IPC contract |
| QA Engineer | Always for L; adversarial mid-chain error cases, frame-cap edge, typed-options round-trip |
| Tech Writer | Public API: every exported name and error message is a semver contract, needs naming review |

## Spec Reference

spec_source: internal — no reference captured

## Risks Flagged at Triage

- The sync-vs-async `read()` decision is irreversible post-L1 publish. Explore must surface this as a blocking open question before spec is signed.
- Error-to-author with mid-chain partial state (some ops eagerly applied, then engine rejects later op) is under-specified — the staging-tree state visible to the author on rejection must be deliberated in spec before design.
- The 4 MiB frame-cap is a wire-protocol concern; explore must confirm the cap lives in the engine contract, not an SDK assumption.

## Halt?

No

## Notes for Next Phase

- `sdd-explore` must answer the sync-vs-async `read()` question as a product open question (type=product, blocking) — it gates the API signature in spec.
- Typed-options implementation depends on schema.json being co-located with factory.ts at runtime; explore should confirm how the engine surfaces this or whether the SDK must locate it via a convention.
- Mid-chain error attribution: the existing `session.buffer()` model eagerly queues ops; explore must determine at what point ops become observable to the engine (flush boundary), since error attribution depends on knowing which ops applied.
- foundations-skeleton archive in `openspec/changes/archive/2026-06-21-foundations-skeleton/` is the context baseline for explore; the 11 followups in `openspec/pending-changes.md` (obs 649) include W3 publish guard and W1 live-resolution gate — these are out of scope but explore should confirm none intersect the error-to-author surface.
