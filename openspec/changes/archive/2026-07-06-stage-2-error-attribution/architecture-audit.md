# Architecture Audit — project-builder-sdk
Performed: 2026-07-06 21:35 (amended 2026-07-06 — see Amendment note)
Baseline: obs #652 (2026-07-06, revisions: 4 — refreshed post stage-2-error-attribution)
Scope: `git diff c7c46dd..HEAD` (stage-2-error-attribution) audited against the just-refreshed baseline.

## Headline
The SEAM-04 reshape lands cleanly: `EmitRejection` is structurally contained to `src/core` (FIT-10
green, no `core → commons` edge), the `AuthoringError` family crosses to `./commons` via the same
two-step author-data-type form `FoundHandle`/`WritableHandle` use (FIT-08 not-kit pin present), and
the newly-frozen public shape is under dedicated FIT-04 `DTS_PAIRS` coverage. No findings.

## Verdict
Overall: ✓ clean
Categories: 9 clean · 0 warnings · 0 violations

## Amendment note
The original report carried one Public-API warning: "the emitted `AuthoringError` class shape
(`dist/core/authoring-error.d.ts`) is not under a dedicated FIT-04 `DTS_PAIRS` baseline pair". That
finding was STALE at audit time — transcribed from the verify-report's followup (written pre-fix)
instead of verified against HEAD. Commit `6c136aa` ("harden error-translation totality and its
guarding gates", the post-council quality-fix pass) had already added both pairs BEFORE this audit ran:
`test/fitness/fit-04-dts-semver-gate.test.ts:106-115` declares `core.authoring-error.d.ts` and
`commons.classify-content.d.ts` entries, with committed baselines at
`test/fitness/dts-baseline/core.authoring-error.d.ts` (85 lines) and
`test/fitness/dts-baseline/commons.classify-content.d.ts` (41 lines) — the stage-1
handle-state/base-handle precedent applied. The fitness run backing this audit (76 pass / 0 fail
across 11 files) already exercised these pairs green. Warning withdrawn; verdict corrected
notes → clean. The verify-report followup #1 is CLOSED IN-CHANGE, not pending.

## Drift (since last scan)
No drift. The baseline was refreshed for this change immediately before this audit (arch_refresh_post_verify,
`modifying` impact) — the SEAM-04 data-flow reshape, the `EmitRejection` port convention (incl. its
deliberate kit-barrel exclusion), the frozen `AuthoringError` shape (incl. its FIT-04 `DTS_PAIRS`
coverage), the `./commons` public-surface additions, and FIT-11 are recorded in obs #652. Current
code matches the refreshed baseline.

## Per-category status
- Layers          : ✓  (single-layer library unchanged; no new layer)
- Pattern         : ✓  (custom layered-behind-port; SEAM-04 seam preserved, signature unchanged)
- Interconnection : ✓  (`EngineClient.emit(): Promise<void>` unchanged; `EmitRejection` is a rejection-value
                        convention on the existing seam, now documented in the baseline; FIT-10 green — 76/76 fitness)
- Data stores     : ✓  (none)
- Auth            : ✓  (none)
- Build / Deploy  : ✓  (npm package build unchanged; `engine-client.ts` change is docs-only, signature intact)
- Public API      : ✓  (additive: `AuthoringError`, `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`,
                        `classifyContent`, `ContentState` on `./commons` — FIT-04 additive, with dedicated
                        `core.authoring-error` + `commons.classify-content` baseline pairs covering the emitted shape)
- Conventions     : ✓  (`EmitRejection` kit-barrel exclusion is a DOCUMENTED convention exception, ADR-0022;
                        author-data-type crossing follows the ADR-0023/FoundHandle precedent, FIT-08 pin present)
- Testing         : ✓  (FIT-11 whole-object leak scan added with 3 permanent red-proofs; FIT-10 extended to
                        `EmitRejection`; FIT-08 not-kit pin added; FIT-04 extended with 2 new baseline pairs;
                        every new significant source file has a test; fitness suite 76 pass / 0 fail across 11 files)

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
- Semver-gate coverage: `test/fitness/fit-04-dts-semver-gate.test.ts:106-115` — dedicated
  `core.authoring-error.d.ts` / `commons.classify-content.d.ts` pairs with committed baselines under
  `test/fitness/dts-baseline/` (landed `6c136aa`).
