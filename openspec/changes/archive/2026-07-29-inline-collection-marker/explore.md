# Exploration: Remove SDK-Side Containment Enforcement (inline-collection-marker)

**Triage**: L
**Persona lens**: none (orchestrator-run, no persona sub-launch for this pass)

## Cross-Change Lessons Consulted

- No `pattern`/`discovery` memories found for "containment ceiling / collection.json / package
  root removal" — this is the first change touching this domain's removal.
- `discovery` obs #2030 (`schematic-local-files` archive): the three engine-obligation seam rows
  (REQ-BRC-02 ceiling re-derivation, REQ-BRC-08 path-form rejection, REQ-PRC-06 post-render
  containment) were registered `committed-next scheduled` at archive 2026-07-13 — still
  `ENGINE-GATED`, per the by-reference-copy-wire spec's own "Seam Obligations Status" section.
  Directly informs Open Question 1 below.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| `scaffold({from,to})` folder mirror (by-value + by-reference split) | `test/e2e/scaffold.e2e.test.ts` | Modify — drops containment-rejection scenarios, keeps by-value/by-reference verdict scenarios |
| `copyIn(from,to)` by-reference single-file copy | `test/e2e/scaffold.e2e.test.ts`, `test/e2e/author-emulation-scaffold.e2e.test.ts` | Modify — must still reject a missing `from` (REQ-BRC-06 end-to-end obligation is NOT retired) |
| `create({templateFile})` render request | `test/e2e/scaffold.e2e.test.ts` | Modify — same rehomed existence/regular-file check applies before the render-request fail-loud carve-out |
| Factory bootstrap (`defineFactory({packageDir})` pre-`als.run` chokepoint) | `test/scaffold/run-boundary.test.ts`, `test/fake/harness-opted-in.test.ts` | Modify — drops the third (`collection.json` ancestor) read; `harness-opted-in.test.ts`'s exact-3-read fs-io oracle becomes exact-2 |

## Current State

`RunContext.packageAnchors?: { packageDir; packageRoot }` (`src/core/context.ts:71`) is seeded
eagerly, pre-`als.run`, by `resolvePackageRoot()` (`context.ts:199-217`): an ancestor walk for
`collection.json`, fail-loud `invalid-input` if none found (ADR-0046). Every package-local read
verb passes through `requirePackageAnchors()` (`context.ts:163-169`). `src/scaffold/containment.ts`
(291 lines) then dual-anchor-validates every SOURCE path against the resolved `packageRoot`
ceiling (`validateSourceContainment`/`validateSourceRootContainment`, realpath + segment-aware +
regular-file allow-list) and lexically screens the DESTINATION (`validateDestinationLexical`,
REQ-PRC-09, reuses generic `invalid-input`, never a `source-*` reason). Call sites:
`classify-transport.ts` (per-file classify, threads `packageRoot`/`realCeiling`),
`expander.ts` (`runScaffold`'s walk-root check + realCeiling resolution), `index.ts`
(`runCopyIn`/`readTemplateFile`, both via `requirePackageAnchors`). `containment.ts` mints four
`AuthoringReason` values (`source-not-found`, `source-outside-package`, `source-not-regular-file`,
`source-unreadable`, `authoring-error.ts:71-83`) — a public, closed 12-member union
(`./commons` export, FIT-04 `.d.ts`-baselined). The project's OWN signed spec already states the
SDK check is DX/attribution only: `by-reference-copy-wire` REQ-BRC-02 (signed) — the engine
independently re-derives its ceiling and is "the ONLY real security control"; REQ-BRC-07 pins the
wire path package-relative so the SDK ceiling is never wire-authoritative. **Non-obvious**:
`src/scaffold/walk.ts`'s root `readdirSync` (lines 112-117) ALREADY independently converts a
missing/non-dir walk root into a clean `AuthoringError` (`rootReadFailure`) — this is the
REQ-PRC-10.3 no-echo fix, and it lives in `walk.ts`, not `containment.ts`; deleting
`containment.ts` wholesale does not touch it.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/context.ts` (`RunContext`/`defineFactory`) | modify | `packageAnchors` collapses to `packageDir`-only; `resolvePackageRoot` deleted | aligns — same pre-`als.run` chokepoint pattern, narrower payload |
| `src/scaffold/` leaf (`containment.ts` deleted; `index.ts`/`expander.ts`/`classify-transport.ts` simplified) | modify/remove | drops an enforcement layer the spec already calls DX-only | aligns — scaffold stays the sole `node:fs`-touching leaf (FIT-01); no new dependency, no boundary move |
| `src/core/authoring-error.ts` (`AuthoringReason` union) | modify | retires `source-outside-package`; keeps 3 rehomed `source-*` reasons | aligns — same closed-union pattern, one fewer member; MAJOR semver signal per the union's own doc comment |
| Public API (`./commons` `AuthoringReason` export, FIT-04 `.d.ts` baseline) | modify | published surface loses a documented error mode | aligns — same subpath/shape, narrower contract; breaking-change CHANGELOG entry needed (precedent: `ts-addimport-collision`) |
| `conformance/` corpus (`collection.json` marker, REQ-CSC-02.3 check) | remove | marker becomes functionally dead once `resolvePackageRoot` is gone | aligns — corpus stays a structural self-check layer, drops one now-pointless rule |
| Spec/ADR layer (`package-root-containment` retirement, `run-boundary-input-validation` REQ-RBV-06, `by-reference-copy-wire` REQ-BRC-06 reconciliation, ADR-0046 superseded) | modify | responsibility-boundary reversal is a structural decision | aligns — doc-only, no runtime layer touched; ADR is the correct vehicle |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/context.ts` | Modify | delete `resolvePackageRoot`/ancestor walk; `packageAnchors` → `{packageDir}` only |
| `src/scaffold/containment.ts` | Delete | wholesale — ceiling machinery has no remaining caller |
| `src/scaffold/index.ts` | Modify | `runCopyIn` loses its ONLY existence/regular-file check (never reads content) — needs a rehomed IO-hygiene check to preserve REQ-BRC-06 |
| `src/scaffold/expander.ts` | Modify | drop `resolveRealCeiling`/`validateSourceRootContainment`/`realCeiling` threading |
| `src/scaffold/classify-transport.ts` | Modify | drop `packageRoot`/`realCeiling` params; rehome existence/regular-file check before its own `readFileSync` |
| `src/scaffold/walk.ts` | Read-only | root not-found/not-dir hygiene already independent (`rootReadFailure`) — confirmed no change needed |
| `src/transport/single-instance-probe.ts` | Read-only | has an UNRELATED `packageRootFor()` (npm-package-root resolution, SEC-07) — naming collision risk, must NOT be touched |
| `src/core/authoring-error.ts` | Modify | retire `source-outside-package` only; keep `source-not-found`/`source-not-regular-file`/`source-unreadable` |
| `test/scaffold/containment.test.ts`, `classify-transport.test.ts`, `run-boundary.test.ts`, `test/core/authoring-error-source.test.ts` | Modify/Delete | direct unit coverage of the deleted module/behavior — wider than triage's "test support" line |
| `test/support/scratch-dir.ts`, `test/fixtures/author-emulation/factory.ts` (line ~182 `packageAnchors` literal), `test/fake/harness-opted-in.test.ts`, `test/e2e/scaffold.e2e.test.ts` | Modify | drop `collection.json` seeding / `packageAnchors` shape / the exact-3-read oracle |
| `test/support/conformance-validators.ts`, `test/fitness/fit-40-*.test.ts`, `conformance/collection.json` | Modify/Delete | retire REQ-CSC-02.3 marker check + the now-dead fixture file |
| `test/fitness/dts-baseline/core.authoring-error.d.ts` | Modify | FIT-04 baseline pins the 12-member union verbatim — must update deliberately |
| `openspec/specs/package-root-containment/spec.md`, `run-boundary-input-validation/spec.md` (REQ-RBV-06), `conformance-corpus/spec.md` (REQ-CCR-08), `by-reference-copy-wire/spec.md` (REQ-BRC-06 reconciled, NOT retired), `openspec/decisions/0046-*.md` | Modify | retirement/reconciliation across 3 spec families + 1 ADR supersession |
| `docs/authoring-verbs.md`, `docs/authoring-errors.md`, `CONFORMANCE-CORPUS-HANDOFF.md` | Modify | public author docs + a CROSS-REPO handoff doc reference the retiring reason/marker |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (input validation / containment) | `src/scaffold/containment.ts`, `src/core/context.ts` | Yes — core subject of the sensitivity override |
| public-api (contract) | `AuthoringReason` union, `.d.ts` baseline | Yes — public-contract override, reinforcing |

No new sensitive area surfaced beyond triage's own findings; registry gap (`openspec/sensitive-areas.md` still has no dedicated row) confirmed unchanged, recommend at archive as triage already noted.

## Approaches

### 1. Pure removal
Delete `containment.ts` wholesale; inline a bare existence+regular-file check (no ceiling) separately in `classify-transport.ts` and `runCopyIn`. **Pros**: smallest new-file footprint, matches the owner's principle literally. **Cons**: duplicates the rehomed hygiene check across two call sites — exactly the kind of drift risk that produced REQ-PRC-04's earlier hardening. **Effort**: Low. **Pattern fit**: new pattern (no shared helper).

### 2. Removal + shared rehomed IO-hygiene helper
Same deletion, but extract the existence/regular-file/readable check into one small shared helper (new module or a function in an existing scaffold-leaf file) consumed by both `classify-transport.ts` and `runCopyIn`. **Pros**: single point of maintenance for the 3 surviving reasons, satisfies REQ-BRC-06 without duplication, cleanly separates "IO hygiene" from the deleted "containment" concept the ADR needs to narrate. **Cons**: one new small file. **Effort**: Low-Medium. **Pattern fit**: matches the existing scaffold-leaf-module convention (`walk.ts`, `filename-pipeline.ts` precedent).

### 3. Repurpose `containment.ts` in place
Keep the file, strip only the ceiling-comparison logic, rename nothing. **Pros**: smallest line-diff on call-site signatures. **Cons**: a file named `containment.ts` with zero containment logic left is exactly the misplaced-responsibility naming debt the owner is trying to remove; contradicts the change's own ADR narrative. **Effort**: Low. **Pattern fit**: hybrid (keeps stale naming).

## Recommendation

**Approach 2.** It satisfies the owner's stated principle (SDK stops enforcing the boundary) exactly as fully as Approach 1, while avoiding Approach 1's duplication risk and Approach 3's naming debt. `runCopyIn` today has zero independent hygiene fallback (it never reads content, unlike `classify-transport.ts`), so the shared helper is not optional scaffolding — it is the only way REQ-BRC-06's still-binding `source-not-found` obligation survives without being written twice.

## Risks

- **Engine-readiness gap (central)**: REQ-BRC-02's re-derivation is a signed contractual promise in THIS repo, but the by-reference-copy-wire spec's own "Seam Obligations Status" marks it `ENGINE-GATED`/`committed-next scheduled` as of the 2026-07-13 archive, and `architecture.md` notes PC-PROTO-01 "is NOT yet shipped in the engine repo." Removing the SDK's only enforcement before that lands could leave a real window with zero containment on either side.
- **REQ-BRC-06 is not in the retirement scope**: `runCopyIn` has no independent existence check today — deleting containment without rehoming would silently break this still-binding end-to-end obligation.
- **REQ-PRC-09 destination guard is ambiguous**: lives in the file slated for wholesale deletion but isn't named in triage's scope list; its removal wouldn't show up in an `AuthoringReason` diff (it reuses `invalid-input`), so it's an easy place to drift silently.
- **Naming collision risk**: `src/transport/single-instance-probe.ts`'s `packageRootFor()` is an unrelated npm-package-root concept — a blind rename/grep pass must exclude it explicitly.
- **Test ripple wider than triage's scope line**: `containment.test.ts`, `classify-transport.test.ts`, `authoring-error-source.test.ts`, `scaffold.e2e.test.ts`, `harness-opted-in.test.ts` all directly assert the retiring behavior — triage's "test support" line only named `scratch-dir.ts`/`factory.ts`/`conformance-validators.ts`.
- **FIT-04 `.d.ts` baseline** must be updated deliberately or the fitness suite fails on the union-shrink.

## Open Questions

- type: product
  question: "Is the engine's apply-time containment re-derivation (REQ-BRC-02) actually implemented and deployed in the engine repo today, or only a contractual promise not yet shipped (per this repo's own spec/architecture notes)?"
  why_it_matters: "If not live, removing the SDK's only enforcement now creates a real containment gap until the engine ships it — a sequencing/risk-acceptance call only the owner can make; explore cannot verify a separate repo's shipped state."
- type: product
  question: "Does REQ-PRC-09's destination lexical guard (`validateDestinationLexical`) retire alongside source containment, or survive as an independent SDK-side hygiene check on the SDK's own computed destination?"
  why_it_matters: "It sits in the file slated for wholesale deletion but isn't named in triage's scope, and its removal wouldn't surface in an `AuthoringReason` diff — silent drift either way is easy."
- type: technical
  question: "Should the rehomed existence/regular-file/readable check for `source-not-found`/`source-not-regular-file`/`source-unreadable` live as one shared helper or be inlined per call site?"
  why_it_matters: "Feeds directly into sdd-design's file-changes table; Approach 2 (recommended) assumes a shared helper."

## Ready for Proposal

**Status**: partial
**Reason**: No blocker, sensitive-area surprise, or architectural conflict — the direction aligns with the existing signed baseline (REQ-BRC-02 already names the engine as sole enforcer). But one product question (engine-readiness) materially affects sequencing/risk-acceptance and should be answered before spec signs off, and one scope ambiguity (REQ-PRC-09) needs an explicit decision in spec rather than an implicit one in design.
**Recommended action**: Surface both product open questions to the user before `sdd-propose`; carry the technical question into `sdd-spec`/`sdd-design`.
