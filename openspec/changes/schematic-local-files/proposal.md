# Proposal: schematic-local-files

**Change**: `schematic-local-files` · **Triage**: L · **Persona lens**: business-analyst + pm + architect

## Intent

Real schematics ship a folder of `.template` files plus binary assets (svg, css, images) and copy them into the target tree — the Angular `apply(url('./files'))` mental model. SDK authors have no supported way to do this: today's workaround is manual `readFileSync` + `create`, which is text-only and hand-rolls path resolution; binary assets cannot travel the text wire at all (ADR-0019). This is the largest missing author-surface capability blocking L1-readiness, and ADR-0005 (the designed answer) has been an orphaned Draft since 2026-06-21. The honesty split is load-bearing: the **by-value** (text) half rides the existing `create` IR with **zero engine contract change**; the **by-reference** (binary) half is an **additive wire widening** the engine must eventually apply. This change ships the entire SDK side and specifies the engine seam contract; it does not implement the engine.

## Scope

### In Scope
- `scaffold` verb — declarative package-local folder → target tree (mirrored structure, `.template` strip, `__token__` → `{= =}` translation, include/exclude/rename/force).
- `create({templateFile})` and `copyIn(from, to)` per-file escape hatches.
- Deterministic by-value/by-reference classification (UTF-8 + null-byte whole-file sniff + serialized-batch frame budget; fail-loud).
- Ambient dual-anchor package-root resolution + source/destination realpath containment (SDK emit-time enforcement).
- By-reference copy **wire op + engine seam contract** (shape, reasons, engine-side re-derivation).
- Coverage across fake / conformance / dry-run surfaces.

### Out of Scope
- Engine-side apply implementation (cross-repo; contract only — PC-PROTO-01-gated).
- Rework of existing tree→tree `copy` semantics.
- Template DSL capabilities (if/for/switch); per-file `options` overrides.
- `collection.json` as a parsed manifest / cross-collection (charter L2).
- Publish/release concerns (stage-6 territory).

## Capabilities (contract with sdd-spec)

### New Capabilities
- `folder-scaffold` (C1): scaffold verb — folder walk, mirrored structure, `.template` strip, token translation, include/exclude/rename/force, zero-files-after-filter fail-loud.
- `file-escape-hatches` (C2): `create({templateFile})` by-value + `copyIn(from, to)` by-reference single-file forms.
- `content-classification` (C3): deterministic by-value/by-reference sniff + frame budget; author never declares text-vs-binary.
- `package-root-containment` (C4): dual-anchor (resolution=factory dir; ceiling=collection.json root, fixed once, never re-walked) + source AND destination realpath containment, SDK emit-time.
- `by-reference-copy-wire` (C5): by-reference wire shape (design ADR) + engine seam contract (reasons, engine re-derives ceiling, additive widening).

### Modified Capabilities
- `authoring-error-contract` (C6): +4 by-reference AuthoringReasons (`source-not-found`, `source-outside-package`, `source-not-regular-file`, `source-unreadable`) — coordinated closed-union extension.
- `dry-run-plan-exposure` (C7): show by-value/by-reference tag per entry (the honesty mechanism).
- `batch-cap-contract` (C8): aggregate-vs-per-file envelope semantics + chunked `flush()` between scaffold groups.
- `run-boundary-input-validation` (C9): REQ-ATH-11.2 in-memory carve-out widened for the package-root read.
- `author-test-harness` (C10): by-reference directive fake fidelity (FAKE-06 package-source branch) + conformance parity; emit-only evidence boundary pinned.

## Approach

House the folder-walk / classification / containment logic in a **new isolated top-level module** (`src/scaffold/`, following the `dry-run/`/`testing/`/`dialects/` leaf convention) that calls `currentContext()` + `session` directly — never a `DirectiveFactory` method (confirmed pure, zero-I/O). `RunContext` gains `packageRoot` seeded once at run boundary (ADR-0011 dialects-field pattern). Slice ordering is **A-first**: the text/by-value half early (classifier's by-reference arm = fail-loud throw), the B slice swaps that throw for by-reference emission — never ship A as terminal scope.

**The by-reference wire shape is an OPEN DESIGN DECISION**, routed to a dedicated design ADR — this proposal ratifies neither alternative. Council evidence is live-conflicted (explore + fresh architect evidence lean new op; obs #915 records an earlier architect+security lean for the discriminator):

1. **New wire op** (e.g. `copyIn`): the precedented growth path ADR-0025 anticipates — MAJOR, loud, compile-safe; preserves the compile-enforced 1-op↔1-verb `Record<Directive["op"], DryRunVerb>` totality; leaves `copy`'s tree→tree contract untouched.
2. **Extend `copy` with a `source: {kind: "package"|"tree", path}` discriminator**: no new op, smallest wire-type diff; erodes the 1-op↔1-verb totality (same op, two author verbs); brushes the out-of-scope "rework existing copy semantics" line.

New architect evidence for the ADR: ruling 14's per-entry by-value/by-reference `dryRun()` tag makes the discriminator's "no new dry-run verb" saving **illusory** — the per-entry branch appears regardless of shape. The ADR must cost both alternatives across: wire type diff, fake (`contract-fake.ts`) branching, dry-run 1-op↔1-verb totality, conformance vehicle, and the engine apply pass. The capability contract (C1–C10) is satisfiable by **either** shape.

**Design must formalise (ADRs):** by-reference wire shape (above) + seam contract; `src/scaffold/` expansion-layer module (first disk-read + emit combiner); AuthoringReason coordinated extension; aggregate batch-cap envelope + chunked flush; **ADR-0005 marked Superseded** (not revisited). `architecture_impact` = additive (wire widening) + modifying (new module, reason union). `openspec/architecture.md` is stale — recommend `/sdd-architecture refresh` alongside.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/scaffold/` | New | walk, token translation, classification, containment, chunked flush |
| `src/commons/index.ts` | Modified | `scaffold`/`copyIn` verbs, `create({templateFile})` |
| `src/core/wire.ts` | Modified | by-reference wire shape (new op OR `copy` discriminator — design ADR) |
| `src/core/directive-factory.ts` | Modified | new pure lowering method(s) |
| `src/core/context.ts` / `RunContext` | Modified | ambient `packageRoot` seeding |
| `src/core/authoring-error.ts` | Modified | +4 by-reference reasons |
| `src/dry-run/plan.ts` | Modified | per-entry classification tag; verb-map impact per wire-shape ADR |
| `src/testing/contract-fake.ts` | Modified | package-source op case + fixtures |
| `src/conformance/run-vehicle.ts` | Modified | new op case |
| `src/core/session.ts` | Read-only | confirm `flush()` reusable for chunking |
| `openspec/decisions/0005-*.md` | Modified | Superseded |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| AuthoringReason union extension is MAJOR/coordinated — build-breaks exhaustive `originFor` switch + compile-pin test | High | Precedented (Stage-2); spec pins all 4 reasons + updates the pin test in the same slice |
| Aggregate batch-cap vs per-file budget undecided — large scaffold overruns 4MiB `BATCH_CAP_BYTES` | Medium | Design pins envelope semantics; new module calls `session.flush()` between groups (core-adjacent access) |
| REQ-ATH-11 carve-out widening loosens the in-memory-only invariant | Medium | Scope carve to package-root read only, mirroring context.ts schema/reserved-name precedent (REQ-ATH-11.2) |
| Fake FAKE-06 package-source branch diverges from real engine | Medium | Conformance vehicle parity + emit-only boundary pinned; no test asserts by-reference bytes in `result.tree` |
| Cross-repo seam unverifiable until PC-PROTO-01 lands the engine apply pass | High | Ship contract + fake/conformance sim; steward reckoning must not read green as "engine copies bytes" |
| `collection.json` scope-creeps into a parsed manifest | Low | Design keeps it a pure containment-boundary marker (charter L2 stays out) |
| Wire-shape decision (new op vs `copy` discriminator) lands in design — whichever alternative loses becomes latent reconsideration debt | Medium | Dedicated design ADR with the full cost table; losing alternative documented as rejected + pending-changes row (Ledger Discipline) — wording nowhere presupposes the winner |

## Rollback Plan

The surface is **all-additive** — no existing behaviour is modified. Pre-publish revert: drop the `src/scaffold/` module, the new `scaffold`/`copyIn` exports and `create` overload from `commons/index.ts`, the by-reference wire addition (whichever shape design ratifies), the `RunContext.packageRoot` field, the 4 reason-union entries (+ pin test), and the dry-run/fake/conformance cases; restore ADR-0005 to Draft. By-value scenarios revert cleanly (they only reuse the existing `create` IR). **Post-publish caveat**: once the by-reference wire shape is published and any engine build consumes it, it becomes a semver wire contract — removing it is then a **breaking** wire change, not a clean revert, and must go through a deprecation cycle. Validate rollback by re-running the pre-change suite green + confirming the exports guard (FIT-09/FIT-14) shows no new subpath.

## Dependencies

- **Engine apply pass for the by-reference copy** (cross-repo, PC-PROTO-01-gated) — real byte-copy evidence is deferred to the engine's half. New ledger sibling to row 186.
- **Engine template DSL confirmation** — `__token__` → `{= =}` `pathTemplate` translation assumes the engine's substitution DSL matches; needs a cross-repo confirmation row.

## Ledger Discipline

- **Retires row 187** — this change IS its "own change L" resolution.
- **Extends row 186 / mints sibling** — engine apply dependency now covers the by-reference copy, parallel to `copy`.
- **Mints**: (1) whichever wire-shape alternative LOSES the design ADR, as documented rejected alternative / reconsideration debt; (2) engine template-DSL confirmation.

## Success Criteria

> **Evidence boundary (binding, QA council):** the by-reference copy path is verified SDK-side ONLY as **directive emission + fake/conformance simulation + `dryRun()` visibility**. NO criterion below claims bytes land on disk — that is engine-gated (PC-PROTO-01). Any test asserting `result.tree` contains by-reference bytes is asserting a lie.

- [ ] `scaffold`, `copyIn`, `create({templateFile})` exported + type-checked; mandatory/optional arg rejection scenarios pass.
- [ ] Classification is deterministic: UTF-8+null-byte sniff + frame budget; `.template` filter-miss and zero-files-after-filter both fail loud (unit + fake).
- [ ] By-reference emits the design-ADR-ratified wire shape; fake + conformance vehicle simulate it faithfully (emit-only — no on-disk byte assertion).
- [ ] `dryRun()` shows a by-value/by-reference tag per entry.
- [ ] Source AND destination containment reject traversal (`../`, symlink-escape) with package-relative (never absolute) error messages, SDK emit-time.
- [ ] 4 new AuthoringReasons attributed; `originFor` exhaustive switch + compile-pin test green.
- [ ] Scaffold exceeding `BATCH_CAP_BYTES` chunks via `flush()` without whole-batch rejection.
- [ ] **Deferred followup (registered, not closed):** real end-to-end byte-copy assertion when PC-PROTO-01 unblocks the engine apply pass.
