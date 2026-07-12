# Exploration: Stage 6 — Release shape & DX closure (stage-6-release-shape)

**Triage**: L
**Persona lens**: none (synthesis; council personas join propose/design per triage matrix)

## Cross-Change Lessons Consulted

- ADR-0036 `packed-tarball-e2e-lifecycle` (stage-4b): the pack→install→resolve mechanic already exists at `test/e2e/installed-consumer.e2e.test.ts` — 6.2's smoke test must EXTEND this vehicle, never build a parallel one.
- ADR-0034 `shipped-fake-containment` (stage-4b): precedent for "ship a file in the tarball, don't map it in `exports`" as an accepted 0.x containment shape — the same pattern 6.2 is being asked to apply/confirm for `dist/core/**`.
- ADR-0033 `third-audience-author-testing` (stage-4b): the origin of `defineFactory`'s current `./testing` re-export — the exact decision 6's "production graduation" item revisits.
- Pending row 169 (stage-4b archive, PM M4 / steward CQ1): already names Stage 6 as the owner-confirmation point for the graduation naming call — corroborates triage's framing, not new.
- Stage-2 lesson: parallel `sdd-apply` agents clobber a shared `apply-progress` topic — relevant reminder for this L change's eventual slice build (per-slice topic keys).
- #648 (stage-5 archive): cross-branch ADR-number collision when a sibling branch is unmerged — `stage-5b-dialect-breadth` is plan-only on `main` today (not built); low collision risk for Stage 6's design ADRs but worth a number-range check at design time.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author: local install (bun link / tarball) → docs → typed factory → passing test | `test/e2e/installed-consumer.e2e.test.ts` (tarball path only, via `file:` dependency); `test/e2e/typed-factory.e2e.test.ts` (in-repo, not installed) | Modify — add a `bun link` scenario; no docs-driven walkthrough test exists |
| Maintainer: build → pack → rehearsed publish | none — `publish.yml` runs `npm publish --dry-run` directly; no repo-owner guard, no SHA pins, no GH Packages leg | Modify |

## Current State

Exports map is 5 subpaths (`.`/`./commons`/`./conformance`/`./testing`/`./typescript`); `./core` stays unmapped but `dist/core/**` still ships (`files: ["dist"]`, confirmed in `test/fitness/pkg-surface-baseline.json`'s pinned tarball list). `src/testing/index.ts` re-exports `defineFactory` from `../core/context.ts` — a **runtime** relative import, so `dist/testing/index.js` needs `dist/core/context.js` physically present; stripping `dist/core/**` wholesale breaks `./testing` unless the graduation decision moves `defineFactory`'s canonical source first. `publish.yml` has `id-token: write`, triggers on any push to `main`, has no `if: github.repository == …` guard (W3 open) and pins only `oven-sh/setup-bun`, not `actions/checkout`/`actions/setup-node` (`ci.yml` has the same unpinned `actions/checkout`). No `.npmrc`/GH-Packages config exists. `docs/authoring-a-dialect.md` is the only house doc (Two-audience / escape-hatch / testing / publishing-and-trust structure) — no quickstart, verb reference, error-contract, or dry-run doc exists; README's "Testing your factory" section is the closest thing to a quickstart today. Pending row 74 (EmitRejection real-client conformance) is tagged "6" but concerns a real `EngineClient` implementation that does not exist in this repo and is explicitly out of scope (triage excludes "Real wire ir.emit/tree.read") — **mis-tagged**, recommend propose formally excludes/re-tags it to the cross-repo engine-gated bucket.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `package.json#exports` (Public API) | extend | bun-link consumption story, no new subpath | aligns |
| `package.json#files`/tarball (Build/Deploy) | modify | strip-or-document `dist/core/**` | aligns (ADR-0034 precedent) |
| `.github/workflows/publish.yml` (Build/Deploy) | modify | W3 guard, SHA pins, GH Packages leg (prepared-not-fired) | aligns (extends dry-run-staged convention) |
| `src/core/context.ts` / `src/testing/index.ts` (defineFactory home) | modify | production-home graduation | deviates — new boundary decision, needs its own ADR |
| `docs/` (Conventions) | new | quickstart, verb ref, dialect usage, error contract, dry-run usage | aligns (matches `docs/authoring-a-dialect.md` precedent) |
| `test/e2e/installed-consumer.e2e.test.ts` (Testing) | extend | add `bun link` scenario | aligns |
| GitHub Packages registry config | new | dual publish, zero-cost mandate | deviates — no such channel exists today, needs ADR (scope mismatch) |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `package.json` | Modify | exports/files, `prebuild` clean script |
| `.github/workflows/publish.yml` | Modify | W3 guard, SHA pins, GH Packages job |
| `.github/workflows/ci.yml` | Read-only | confirm SHA-pin scope excludes it (no publish creds) — open question |
| `src/core/context.ts` | Read-only/Modify | `defineFactory` definition, graduation candidate |
| `src/core/index.ts` | Read-only | confirms `./core` stays unreachable (ADR-0009) |
| `src/testing/index.ts` | Modify | re-export path depends on graduation decision |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modify | extend for any export/graduation change |
| `test/fitness/fit-14-package-surface.test.ts` + baseline JSON | Modify | regenerate baseline for any tarball change |
| `test/e2e/installed-consumer.e2e.test.ts` | Modify | add `bun link` scenario (REQ-PKG-01) |
| `docs/*.md` (new files) | Created | quickstart, verb reference, dialect usage, error contract, dry-run usage |
| `README.md` | Modify | front-door dialect entry (pending row 143), quickstart link |
| `ROADMAP.md` + `openspec/pending-changes.md` | Modify | 6.4 final reconciliation |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| deployment | `.github/workflows/publish.yml` | Yes |
| security (supply-chain) | published package surface, `dist/core/**` tarball contents, `ts-morph` dep | Yes |

No new sensitive area discovered beyond the two overrides triage already applied.

## Approaches

### 1. Single unified L change (as scoped) — RECOMMENDED
**Description**: Execute 6.1–6.4 plus the graduation decision as one change, treating `defineFactory`'s production-home ADR as an explicit design checkpoint sequenced BEFORE the `dist/core` strip-or-document decision (they are the same coupled decision — `./testing` imports `../core/context.ts` at runtime).
**Pros**: matches triage's own sizing (L, 4 bounded contexts, not XL); keeps genuinely coupled decisions (exports shape, tarball contents, graduation) inside one signed spec/design.
**Cons**: two live sensitivity overrides on one change — a stall in the graduation ADR can block unrelated docs work from reaching verify-final.
**Effort**: L. **Pattern fit**: matches existing `stage-4-typed-options` precedent (packaging+CI+relocation+docs bundled).

### 2. Split defineFactory graduation into its own preceding micro-change
**Description**: Resolve the production-home ADR as a standalone M change first, then run a lighter Stage 6.
**Pros**: isolates the one new architectural decision from mechanical hardening/docs work.
**Cons**: does not remove the dist/core-strip coupling — just moves it across a change boundary, adding a full SDD cycle for one decision; contradicts triage's explicit "not XL — one cohesive artefact" ruling.
**Effort**: same total, more process overhead. **Pattern fit**: no precedent for this repo.

### 3. Split docs (6.3) into its own change
**Description**: Ship 6.1/6.2/6.4 (sensitivity-gated) separately from 6.3 (no sensitivity override).
**Cons**: 6.3's acceptance bar ("install → passing typed factory using only the docs") is definitionally dependent on 6.1's exports map and the bun-link story — splitting buys no real parallelism.
**Effort**: similar total, worse sequencing. **Pattern fit**: hybrid, rejected on dependency grounds.

## Recommendation

Approach 1. The graduation ADR and the dist/core strip decision are one coupled decision, not two — splitting either into a separate change (Approaches 2/3) multiplies process cost without resolving the coupling. Sequence design so the graduation ADR resolves first.

## Risks

- `dist/core` strip is coupled to the graduation decision — sequencing risk if design assigns them to independent slices.
- GH Packages scope mismatch (`@pbuilder/sdk` vs `Project-Builder-Schematics`) is unresolved; the dual-publish ADR cannot be drafted correctly until it is.
- `publish.yml` has NO W3 guard and NO SHA pins today — a fork with its own `main` can reach the `id-token: write` job now, not hypothetically (verified by reading the workflow).
- Pending row 74 is mis-tagged into Stage 6 scope with no real `EngineClient` to bind it against — risk of scope creep if not excluded at propose.
- The "docs-only" acceptance bar (triage risk) has no test-derivation precedent in this repo; QA will need to invent a checkable form.
- `bun link` consumption is completely untested today — the existing e2e vehicle only proves the tarball path.

## Open Questions

- type: technical
  question: "Does 6.2's action-SHA-pin scope include `ci.yml`'s `actions/checkout@v4` (no publish credentials) or only `publish.yml`'s?"
  why_it_matters: "ci.yml is lower-risk; scoping wrong either overspends effort on a non-sensitive file or leaves a known hygiene gap silently undocumented."
- type: technical
  question: "Confirm the design sequences the defineFactory graduation ADR strictly before the dist/core strip-or-document decision, given the runtime import coupling found in `src/testing/index.ts`."
  why_it_matters: "Reversing the order (or slicing them independently) risks a design that strips `dist/core` while `./testing` still needs it at runtime — a broken build, not a style nit."
- type: technical
  question: "Is the docs-only 'new author success' scenario meant to be an automated e2e test, a recorded manual QA walkthrough, or both?"
  why_it_matters: "Spec needs one concrete, checkable form; an automated test that reads code to assert on docs both proves nothing and can't detect a human failing to find something in the prose."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: Codebase investigation confirms every gap triage named (no W3 guard, no SHA pins beyond setup-bun, `dist/core/**` genuinely ships, no quickstart docs) and surfaces one previously-implicit coupling (graduation ⟷ dist/core strip) with concrete evidence. Sensitivity crosscheck found no new areas. One mis-tagged pending row identified with a clear recommendation.
**Recommended action**: Proceed to `sdd-propose` with Approach 1 and the three technical open questions carried into spec/design.
