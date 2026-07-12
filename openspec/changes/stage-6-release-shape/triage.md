# Triage: Stage 6 — Release shape & DX closure

**Classification**: L
**Decided at**: 2026-07-12T00:00:00Z
**Change name**: `stage-6-release-shape`

## Problem & Scope

> Who hurts: (a) external schematic authors — they CANNOT use the SDK today: it has never been
> published to npm, and the only way to learn it is cloning this repo and reading tests; (b) the
> team — it cannot publish confidently because the pipeline carries gating security debts (the W3
> repo-owner guard in `publish.yml`: without it, a fork with its own `main` can reach OIDC).
> What pain: Stages 1–5 built the whole authoring surface (six verbs, attributable errors,
> dry-run, typed options, testing harness, typescript dialect) but nothing PACKAGES it: no
> guarantee that every public subpath (`.`, `./commons`, `./conformance`, `./testing`,
> `./typescript`, dry-run entry) resolves from a real install with `/core` staying unreachable;
> the tarball drags `dist/core/**` with no decision taken; actions are not SHA-pinned; and no
> single document takes a new author from `bun install` to a passing typed factory.
> Why now: Stage 6 is the TERMINAL stage of the ratified objectives plan — all upstream
> dependencies (1→2→5, 3, 4, 4b) already merged to main. The day it closes, `@pbuilder/sdk` is a
> publishable, engine-independent authoring product.

**OWNER AMENDMENT (2026-07-12, at triage sign-off)**: Stage 6 delivers release-READINESS, not a
release. No live npm publish happens in (or right after) this change: the package is not
L1-ready until real engine integration (PC-PROTO-01 era) reveals what is missing, and publishing
an incomplete L1 surface is explicitly rejected. The near-term consumer is the Project Builder
ecosystem itself, consuming the SDK **locally via `bun link`** (and/or a packed tarball). Stage 6
"leaves everything prepared": pipeline hardened and rehearsed, resolution guaranteed from a local
consumption path, docs teaching the local path — the publish button stays untouched, owner's call,
separate future gate.

**Distribution-channel constraint (owner, 2026-07-12)**: whenever the publish does happen, the
channel MUST be zero-cost. Owner direction: a DUAL publish configuration — (a) a LOCAL publish
config (bun link / packed tarball into sibling consumers; the everyday path) and (b) a GitHub
Packages config (free for public repos), prepared and rehearsed but not fired live until the
L1-readiness gate. Known constraints for propose/design to resolve: GitHub Packages requires the
package scope to MATCH the repo owner (`@pbuilder/sdk` ≠ `@project-builder-schematics/*` — scope
mismatch must be resolved: rescope for GH Packages, dual-name, or org decision); GH Packages
requires auth even to install public packages (consumer `.npmrc` wart — document it). Channel
mechanics = ADR at design; the zero-cost mandate is non-negotiable.

**Post-explore owner rulings (2026-07-12)**: (1) The `@pbuilder` npm scope is the OWNER'S OWN
account — verified live against registry.npmjs.org: the scope is claimed and active (`@pbuilder/cli`
1.9.4, `/sm`, `/angular`, `/nestjs`, `/astro`, `/astro-cli`, all maintainer `pbuilder`), and
`@pbuilder/sdk` 404s (name free inside the owned scope). The security squatting threat (explore,
ranked #1) is NEUTRALIZED; npmjs under `@pbuilder/sdk` is the canonical eventual identity, free,
no scope mismatch. (2) Owner ruling: the DUAL remote config (npmjs + GitHub Packages) STAYS in
scope — rationale: no publish is wanted at all for now, both channels remain prepared-not-fired.
The GH Packages scope-mismatch identity decision therefore remains a live ADR for design
(dual-name vs org decision; rescope rejected by explore evidence — blast radius).

**Explore-gate owner rulings (2026-07-12 — SUPERSEDE ruling (2) above)**:
- **`defineFactory` home**: stays `./testing` for this change (zero cost, 0.x-exempt); graduation
  registered in pending-changes as a mandatory re-evaluation inside the future public-package
  plan (pre-live-publish gate). The `dist/core` posture decision is thereby DECOUPLED from a
  graduation that is no longer happening here: document-not-strip, per the runtime-edge evidence.
- **Remote channels carved OUT** (supersedes "dual stays"): the GitHub Packages config, dual-name
  identity mechanics, and live-publish go-live interlocks move to a dedicated **public-package
  plan** (pending-changes row, own /plan cycle, gated on L1-readiness after engine integration).
  Owner rationale: "mientras funcione el bun link… por el momento es overkill porque no está
  preparado para que nadie lo use." Dual-name (`@project-builder-schematics/sdk` on GH) is the
  accepted direction WHEN that plan runs. Stage-6 keeps ONLY: (a) an npm PLACEHOLDER publish
  reserving the `@pbuilder/sdk` name inside the owner's scope (the one deliberate exception to
  "nothing fires" — a stub, not the product), (b) hardening of the EXISTING `publish.yml` surface
  (W3 repo-owner guard, SHA pins, prebuild clean, `declarationMap: false`), (c) the local
  consumption story.
- **Canonical local install path**: `bun link` FIRST in the docs (owner's everyday loop); the
  packed-tarball path stays as the release-shape verification vehicle (e2e). Design decides
  `prepare`-script auto-build vs documented build-then-link ritual.
- **FIT-09/14 exports-guard extensibility**: OWNER-RULED (2026-07-12, propose gate) — deferred
  to a pending-changes row with trigger "second dialect". Explore verified stage-5b adds NO new
  subpath (breadth within `./typescript`; "exports stay byte-identical"), so the refactor's
  first real consumer is a second dialect that no plan contains yet. Out of stage-6 scope.

**Foresight-gate owner ruling (2026-07-12 — supersedes the placeholder exception above)**: the
npm placeholder publish is DEFERRED to the public-package plan (steward CQ2 — the owned scope
makes it buy no security today). Stage-6 now performs NO registry write at all — "nothing fires"
is literal. CQ1: the bun-link ecosystem consumer is live today (significance affirmed). CQ3: the
external npm-installing author is explicitly out of near-term scope; this change serves the
ecosystem consumer and the owner.

```yaml
scope:
  in_scope:
    - "6.1 Final exports map — '.', './commons', './conformance', dry-run entry, './typescript'; FIT-09 extended. Done when every public subpath resolves from a packed install and /core stays unreachable."
    - "6.2 Tarball + publish hardening — W3 repo-owner guard (gating before first live publish); pack->install->resolve smoke test in CI; strip-or-document dist/core/**; pin action SHAs; prebuild clean."
    - "6.3 Author documentation set — quickstart (factory.ts + schema.json), six-verb reference with the read-trichotomy rule, dialect usage, error contract in author vocabulary, dry-run usage. Done when a new author goes from LOCAL install (bun link or packed tarball — npm install is not available yet) to a passing typed factory against the fake using only the docs. [AMENDED 2026-07-12: install path is local]"
    - "6.4 Final reconciliation — ROADMAP, problem statement and pending-changes mutually consistent; milestone declaration; L2+ explicitly out."
    - "defineFactory production-home graduation — decide the definitive import home (currently ./testing)."
    - "Verified local consumption path — bun link (and/or bun add <tarball>) from a sibling consumer works against the built dist with the same exports guarantees as 6.1; documented as THE install story until the live publish. [ADDED by owner amendment 2026-07-12]"
  out_of_scope:
    - "The first LIVE npm publish itself — deferred until L1-readiness, judged after real engine integration (PC-PROTO-01 era); owner decision, separate future gate. The pipeline is hardened and rehearsed (dry-run/staged) but never fired live in this change. [ADDED by owner amendment 2026-07-12]"
    - "Asset-copy / SourceFS (own future change, cross-repo)"
    - "stage-5b-dialect-breadth build (own change; Stage 6 plans against the CURRENT surface: typescript dialect only)"
    - "Real wire ir.emit/tree.read (PC-PROTO-01, engine repo)"
    - "L2 composition (invoke/extends)"
    - "prompt UX from schema.json"
    - "@pbuilder/sdk-kit extraction (ContractFake long-term form re-evaluated as a NOTE only, pending row 175)"
```

## Description Received

> Stage 6 of the ratified objectives plan — "Release shape & DX closure" (`openspec/objectives-plan.md`
> Stage 6, items 6.1-6.4, plus the `defineFactory` production-home graduation pending row). Packages
> whatever surface Stages 3/4/5 produced into a publishable, documented npm package.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `package.json` (exports, `prebuild` script), `publish.yml` (guard + SHA pins + provenance checklist), `defineFactory` relocation (source file move + re-export + import-site updates), FIT-09 test extension, 4-5 new docs files (quickstart, verb reference, dialect usage, error contract, dry-run usage — only `docs/authoring-a-dialect.md` exists today, confirmed by directory listing), `ROADMAP.md`, `pending-changes.md` — ~15-20 files | L |
| Lines affected (estimated) | Docs are prose-heavy (quickstart + reference + usage guides plausibly 800-1500 lines); code/config changes modest (~100-200: exports map, guard condition, prebuild script, relocation) — ~1000-1700 total | L |
| Bounded contexts | 4: (1) packaging/exports public-API surface (`package.json#exports`, FIT-09), (2) CI/CD publish security (`publish.yml` guard, SHA pins, provenance), (3) source relocation (`defineFactory` home), (4) documentation content — stays within one repo/package, not 3+ independently-shippable systems (same reasoning as `stage-4-typed-options` triage) | L |
| New patterns | None/variant of existing — this is hardening + reconciliation of surfaces Stages 1-5 already built, not a new engineering pattern | S/M |
| Test types | Existing types — extends FIT-09 (exports resolution) and the stage-4b installed-consumer e2e pattern; no new test category | M |

### Overrides Triggered

- **Sensitivity override — deployment**: `openspec/sensitive-areas.md` names `.github/workflows/`, `npm publish` (confidence: low, "upgrade to high once secrets exist; security-engineer review then mandatory"). 6.2 is exactly the CI/CD publish-hardening work (W3 repo-owner guard closes a fork-reaches-OIDC hole; SHA pins; provenance go-live checklist). Forces L minimum.
- **Sensitivity override — security (supply-chain)**: same registry row on "published package surface" — 6.1/6.2 directly determine what ships in the tarball (`dist/core/**` strip-or-document). Forces L minimum.
- **Public-API stability**: `package.json#exports` is the registry's own "review-required for breaking changes" row; 6.1 is precisely the final exports map. Corroborates L, does not independently override past it.

**Final classification**: **L** — two independent sensitivity overrides (deployment/CI-CD, supply-chain) both force L minimum; size criteria (files, lines, 4 bounded contexts) independently land in the L band and stay short of the XL "3+ independently-shippable systems" line per the `stage-4-typed-options` precedent (packaging, CI, one file relocation, and docs all live in this single package, unlike `stage-5`'s 5 genuinely separate engineering surfaces that triggered XL).

## Recommended Path

- Phase: Full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → `sdd-verify --mode=plan` → `/build` (`sdd-apply` ⇄ `sdd-verify` in-loop) → `sdd-verify --mode=final` → `sdd-archive`
- Slice target: 4-7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L — public exports map, packaging boundary, `defineFactory` home decision |
| QA Engineer | Always for L |
| Security Engineer | Sensitivity overrides triggered: deployment (publish.yml/OIDC), supply-chain (tarball contents, SHA pins) |
| Tech Writer | Public contract exposed: final exports map is a semver contract; 6.3 is an entire author-facing documentation set |

Not needed: UX Designer (no interactive UI surface — package config/CI/docs, not a rendered interface; note the 6.3 "new author's first experience" is DX-flow-shaped without pixels, flagged below for the orchestrator's judgment); DBA (no schema/migration).

## Spec Reference

`spec_source: internal` — no reference captured (write_mode: sync).

## Risks Flagged at Triage

- Two live sensitivity overrides (deployment, supply-chain) on the terminal stage before first real publish — nothing here can be rubber-stamped; Security Engineer participation is load-bearing, not decorative.
- `defineFactory`'s production-home graduation is a naming/architecture decision (steward CQ1 from `stage-4b` flagged it, PM M4 pending row) — design must treat it as an explicit ADR-gated checkpoint, not a mechanical file move.
- `pending-changes.md` row 74 (EmitRejection port conformance decision) is marked "Stage-6 gating" but is about engine-client error-shape behavior, not release packaging — confirm at explore/propose whether it truly belongs in this change's scope or is a separate concern mis-tagged "6".
- Docs claim ("done when a new author goes from install to a passing typed factory... using only the docs") is an end-to-end usability bar — QA/BA should derive an actual acceptance scenario that walks a fresh clone + `bun install` + docs-only path, not just check docs exist.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should: (1) confirm which pending-changes.md rows tagged "6"/"6.2"/"6.3"/"6 (production graduation)" are truly in scope vs. mis-tagged (row 74 flagged above); (2) read `docs/authoring-a-dialect.md` as the one existing doc precedent for house documentation style; (3) confirm current `defineFactory` export path and all its import sites before design proposes a relocation; (4) verify pending row 28 (W1 pack→install→resolve smoke test) is genuinely closed/subsumed by `stage-4b`'s `test/e2e/installed-consumer.e2e.test.ts` rather than re-deriving it as new 6.2 work.
