# Triage: Schematic Local Files (`scaffold` / `copyIn` / by-reference assets)

**Classification**: L
**Decided at**: 2026-07-12T00:00:00Z
**Change name**: `schematic-local-files`

## Problem & Scope

> Schematic authors cannot reference schematic-package-local template files nor copy
> package-local assets into the target tree. Real schematics (e.g. nestjs-schematics
> `crud-graphql-mongo/files`) ship folders of `.template` files plus assets (svg, css,
> images). Today's workaround is manual `readFileSync` + `create` — text-only, manual path
> resolution; binary assets cannot travel the text wire at all (ADR-0019). Why now:
> stage-6 (release shape) is the terminal planned stage and L1 readiness requires real-world
> schematics to be authorable; this is the largest missing author-surface capability, and
> ADR-0005 (the designed answer) has been an orphaned Draft since 2026-06-21 — in no stage,
> no pending-changes row.

```yaml
scope:
  in_scope:
    - scaffold verb (declarative folder scaffold: from/to, include/exclude/rename, mirrored structure, .template strip, __token__ → {= =} pathTemplate translation)
    - create({templateFile}) and copyIn(from, to) per-file escape hatches
    - Ambient package-root resolution via run-context (collection.json-anchored)
    - By-value vs by-reference classification rule (deterministic sniffing + frame budget)
    - By-reference copy IR: SDK side + seam contract specification (wire shape, containment, reasons)
    - Coverage in fake/harness/dry-run/conformance surfaces
  out_of_scope:
    - Rework of existing tree→tree copy semantics
    - Engine-side implementation (cross-repo; only the seam CONTRACT is in scope)
    - Template DSL capabilities (if/for/switch)
    - Publish/release concerns (stage-6 territory)
```

## Description Received

> Give schematic authors a supported way to reference schematic-package-local template
> files/assets and copy them into the target tree, per owner-ratified DX contract (engram
> obs #915): `scaffold` + `create({templateFile})` + `copyIn` surface, ambient
> collection.json-anchored root resolution, deterministic by-value/by-reference
> classification (UTF-8+null-byte sniff + 4MiB budget, fail-loud on `.template` misses),
> dual-side (SDK emit-time + engine apply-time) realpath containment.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | scaffold verb, `create({templateFile})`/`copyIn` API, run-context root resolution, classification/sniffing logic, wire shape extension (`directive-factory.ts`, `wire.ts`), coverage across fake/harness/dry-run/conformance (4 surfaces) — ~10-14 | L |
| Lines affected (estimated) | new classification + containment logic, new IR shape, 4 surfaces of new test coverage — ~600-1200 | L |
| Bounded contexts | 2 within this repo (SDK core authoring/wire surface; testing-harness/conformance surfaces); engine is cross-repo and explicitly out-of-scope (contract only) | L |
| New patterns introduced | FIRST by-reference directive in a protocol that is 100% by-value today (ADR-0019) — breaks an existing invariant, not a variant of anything shipped | L |
| Test types needed | New scenario classes needed in fake/harness/dry-run/conformance for by-reference directives, classification edge cases, containment rejection — existing frameworks, new scenario shapes | L |

### Overrides Triggered

- **Sensitivity override — security boundaries (input validation)**: introduces a NEW engine-read-from-disk surface driven by SDK-emitted paths; containment is enforced via realpath/nearest-`collection.json`-ancestor checks, dual-sided (SDK emit-time + engine apply-time fail-closed) specifically to prevent path-traversal (e.g. `../../.ssh/id_rsa`) escaping the package root. This is squarely "input validation / security boundary" per the sensitivity-override list → **forces L minimum regardless of size** (matches `openspec/sensitive-areas.md`'s "security (code execution)" / "security (IPC)" entries in spirit — a new disk-read trust boundary, not yet a registry row).
- **Public-API contract**: new exported symbols (`scaffold`, `copyIn`, `create({templateFile})`) and a new wire shape addition — matches the existing `public-api (contract)` sensitive-areas row (semver-contract, review-required).

**Final classification**: **L** — sensitivity override (new disk-read containment boundary) independently forces L; size criteria land at L on every axis (new pattern, 2 bounded contexts, ~10-14 files). Not XL: engine-side work — the only 3rd context — is explicitly out of scope for this change (contract-only); owner's own `pending-changes.md` row 187 already sized this "own change L", corroborating.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → `sdd-verify --mode=plan` gate → ready for `/build`
- Slice target: 4-7

## Recommended Personas

| Role | Reason |
|---|---|
| Business Analyst | Always for L; also author-facing DX (authors are the users of this surface) |
| PM | Always for L |
| Architect | Always for L; architectural shift (first by-reference directive breaks the by-value invariant) |
| QA Engineer | Always for L; adversarial edge cases across classification/containment/partial-failure |
| Security Engineer | Conditional — sensitivity override triggered (containment/path-traversal enforcement, new disk-read trust boundary) |
| Tech Writer | Conditional — public API/contract exposure (new exports, new wire shape) |
| UX Designer | Not applicable — no UI surface |
| DBA | Not applicable — no data layer/schema |

Per-phase spawning (per orchestrator's matrix):
- `sdd-explore`: architect, qa-engineer, business-analyst (author-facing), security-engineer (sensitive)
- `sdd-propose`: business-analyst, pm, architect (architectural shift)
- `sdd-spec`: business-analyst, qa-engineer, security-engineer (sensitive)
- `sdd-design`: architect, security-engineer (sensitive), tech-writer (public API)
- `sdd-verify --mode=final`: architect, qa-engineer, security-engineer, tech-writer (all design participants)

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Cross-repo dependency unresolved**: the engine copy-apply pass is emit-only today (PC-PROTO-01 unresolved per `openspec/pending-changes.md` row 186); this change can spec/design the seam contract and ship the SDK side, but cannot get real end-to-end integration evidence until the engine lands its half — steward reckoning at archive must not mistake "contract shipped + fake/conformance pass" for "engine actually copies files."
- **Two open owner decisions carried from engram obs #915** (not yet ratified): (a) wire shape for by-reference copy — extend existing `copy` directive with a `source` discriminator vs. a new wire op; (b) `scaffold` return value — fire-and-forget vs. chainable handle group. These must be closed at `sdd-propose`/`sdd-spec`, not left open into design.
- **First protocol-invariant break**: this is the first by-reference (non-100%-by-value) directive ever emitted — architect must confirm this doesn't quietly erode ADR-0019's simplicity guarantee for the rest of the wire.
- **ADR-0005 orphan**: Draft since 2026-06-21, Model A-vs-B left open — this change must either resolve and supersede it or explicitly re-defer Model B (engine-side `scaffold` wire op) with a reason.

## Halt?

No.

## Notes for Next Phase

`sdd-explore` should treat engram observation #915 (`sdd/schematic-local-files/dx-contract`)
as a binding pre-ratified input, not a proposal to re-litigate — the 10 owner rulings there
are constraints. Focus exploration on: the two open questions in obs #915 (wire shape,
scaffold return value), the containment realpath/symlink mechanics on the SDK side, and
how `dryRun()`/conformance/fake surfaces should represent a by-reference directive without
resolving it. Read ADR-0005, 0001, 0008, 0011, 0013, 0019, and REQ-ATH-10/11 (already
reviewed at triage) as starting context — do not re-derive from scratch.
