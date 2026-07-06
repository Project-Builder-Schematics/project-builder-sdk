# Architecture Audit — project-builder-sdk
Performed: 2026-07-06 21:35
Baseline: obs #652 (2026-07-06, revisions: 3 — refreshed post stage-2-error-attribution)
Scope: `git diff c7c46dd..HEAD` (stage-2-error-attribution) audited against the just-refreshed baseline.

## Headline
The SEAM-04 reshape lands cleanly: `EmitRejection` is structurally contained to `src/core` (FIT-10
green, no `core → commons` edge), and the `AuthoringError` family crosses to `./commons` via the same
two-step author-data-type form `FoundHandle`/`WritableHandle` use (FIT-08 not-kit pin present). One
non-gating warning — the newly-frozen emitted `AuthoringError` class shape (`dist/core/authoring-error.d.ts`)
is not yet under a dedicated FIT-04 `DTS_PAIRS` baseline pair.

## Verdict
Overall: ⚠ notes (1 warning, 0 violations)
Categories: 8 clean · 1 warning · 0 violations

## Drift (since last scan)
No drift. The baseline was refreshed for this change immediately before this audit (arch_refresh_post_verify,
`modifying` impact) — the SEAM-04 data-flow reshape, the `EmitRejection` port convention (incl. its
deliberate kit-barrel exclusion), the frozen `AuthoringError` shape, the `./commons` public-surface
additions, and FIT-11 are already recorded in obs #652. Current code matches the refreshed baseline.

## Warnings (⚠)
- Public API / Testing: the newly-frozen public `AuthoringError` class shape is not covered by a
  dedicated FIT-04 `.d.ts` semver-gate baseline pair. `DTS_PAIRS` diffs `commons.index.d.ts`, which
  captures only the bare `export { AuthoringError }` re-export line; the field shape (`verb`/`path`/
  `reason`/`origin`/`appliedCount`, the six/two union literals) lives in `dist/core/authoring-error.d.ts`,
  which no pair diffs — the exact "name re-exported, shape lives elsewhere" gap stage-1 solved for
  `FoundHandle`/`WritableHandle` via dedicated core pairs.
  Evidence: `test/fitness/fit-04-dts-semver-gate.test.ts` `DTS_PAIRS`; shape at `src/core/authoring-error.ts:177`.
  Why NON-gating: (a) REQ-AEC-04.2 passes today — the commons-boundary diff IS additive and the
  `| undefined` arms ARE emitted; (b) union membership on `reason`/`origin`/`ContentState` is independently
  frozen by compile-time `toEqualTypeOf` pins (`test/types/authoring-reason.test.ts`,
  `test/types/content-state.test.ts`) and by `originFor`'s exhaustive `never`-arm switch — the most likely
  breaking edits break the BUILD before any gate runs; (c) design §4.4 consciously chose "additivity
  argued out-of-band" for this change. Residual gap is defense-in-depth for FUTURE breaking edits to the
  emitted class shape (dropping `| undefined`, renaming a field). Already registered as a followup by
  verify-final (add `core.authoring-error.d.ts` + `commons.classify-content.d.ts` pairs to `DTS_PAIRS`).

## Per-category status
- Layers          : ✓  (single-layer library unchanged; no new layer)
- Pattern         : ✓  (custom layered-behind-port; SEAM-04 seam preserved, signature unchanged)
- Interconnection : ✓  (`EngineClient.emit(): Promise<void>` unchanged; `EmitRejection` is a rejection-value
                        convention on the existing seam, now documented in the baseline; FIT-10 green — 76/76 fitness)
- Data stores     : ✓  (none)
- Auth            : ✓  (none)
- Build / Deploy  : ✓  (npm package build unchanged; `engine-client.ts` change is docs-only, signature intact)
- Public API      : ⚠ (1)  (additive: `AuthoringError`, `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`,
                        `classifyContent`, `ContentState` on `./commons` — FIT-04 additive; warning above is the
                        emitted-class-shape semver-gate coverage gap)
- Conventions     : ✓  (`EmitRejection` kit-barrel exclusion is a DOCUMENTED convention exception, ADR-0022;
                        author-data-type crossing follows the ADR-0023/FoundHandle precedent, FIT-08 pin present)
- Testing         : ✓  (FIT-11 whole-object leak scan added with 3 permanent red-proofs; FIT-10 extended to
                        `EmitRejection`; FIT-08 not-kit pin added; every new significant source file has a test;
                        fitness suite 76 pass / 0 fail across 11 files)

## Boundary integrity (evidence)
- Dependency direction clean: `src/core/authoring-error.ts` imports only `./wire.ts` + `./emit-rejection.ts`
  (both core); `src/core/emit-rejection.ts` and `src/commons/classify-content.ts` import nothing. No
  `core → commons` edge introduced (the only `@pbuilder/sdk/commons` occurrence in core is a JSDoc `@example`
  string, not an import).
- Port containment: `EmitRejection` referenced only under `src/core/**` (`emit-rejection.ts`, `authoring-error.ts`,
  `engine-client.ts` docs) and the allow-listed `test/support/contract-fake.ts` (+ its tests). No `src/**`
  module outside `src/core` names it — FIT-10 structural guard green.
- Public-surface crossing: `AuthoringError` + 3 unions and `classifyContent`/`ContentState` exit via the
  two-step `import{…};export{…}` form in `src/commons/index.ts` (not `export … from "../core"` — FIT-08 clean);
  kit machinery (`EngineClient`/`Session`/`DirectiveFactory`) stays unexported.
