# Verify In-Loop Result

**Change**: bare-factory-migration
**Iteration**: 5 (batch 4, fresh loop — iteration 1 of this batch; FINAL build batch)
**Scope**: S-005 + S-006
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

The migration's hard cut is complete and fully green. All builder claims reproduced by
real execution; all three disclosed discoveries adjudicated LEGITIMATE. This closes the
/build loop — carried-to-final list at the bottom.

- **Full suite: 1285 pass / 0 fail** (from 99 fails at S-000 → 0; every bucket resolved
  by its owning slice, exactly as planned)
- Typecheck: exit 0. Build (`bun run build`): exit 0.
- Corpus regen: git-clean no-op (executed twice across batches, both no-op)

---

## Evidence Table

| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | **1285 pass / 0 fail** (146 files) — matches claim |
| Typecheck | `bun run typecheck` | exit 0 |
| Build | `bun run build` | exit 0 |
| Installed-consumer e2e (needs build) | `bun test test/e2e/installed-consumer.e2e.test.ts` standalone | pass (within 80/80 across the 5-file gate set) |
| FIT-08 / FIT-28 / FIT-29 / FIT-04 | standalone run | 80 pass / 0 fail |
| S-005 regen no-op (REQ-ATH-20.2) | `bun scripts/regen-corpus.ts` + `git status corpus/` | **0 changed files** — 22 records byte-identical |
| Regression sentinels (R-5) | four-glob `git diff --name-only` | **Empty** |
| Frozen body | `git diff <merge-base> -- src/core/context.ts` | still exactly ONE additive JSDoc hunk (`@@ -259,6 +259,11 @@`, inside editable `:248-292`); `:293-346` zero old-file lines touched |
| §19 constraints | `git diff --name-only` on `package.json`, `pkg-surface-baseline.json`, FIT-09, FIT-14 | **All four untouched** — no subpath/dependency drift |
| `defineFactory` reachability post-cut | `rg "import.*defineFactory\|export.*defineFactory" src/` | ONLY: `core/context.ts` (definition), `core/index.ts` (kit barrel), `testing/index.ts` (internal delegation import — the public re-export line is GONE), `conformance/index.ts` (internal) — matches ADR-A exactly |

## S-006 acceptance (ruling #5 — atomic hard cut) — all verified

| Criterion | Evidence | Result |
|---|---|---|
| `export { defineFactory }` removed; internal import stays | `git show 5321802 -- src/testing/index.ts` — exactly one deleted line (the re-export); `rg` confirms the internal `import` at `:11` and single wrap call at `:124` remain | ✅ |
| FIT-08 `valueAllow` narrowed to `["runFactoryForTest"]` | fit-08 diff + live file | ✅ |
| REQ-TES-03.1b red-proof (re-exported `defineFactory` = violation) | `fit-08:174` — fixture-source scan asserts the violation fires | ✅ |
| REQ-TES-03.3 shallow-fix rejection (cannot drop `./testing` from `SCANNED`) | `fit-08:194,210` — asserts path membership AND `valueAllow` equals the narrow list, not an absence of scanning | ✅ |
| REQ-TES-03.2/.4 + REQ-ATH-01.3 (Session banned; ContractFake banned value AND type) | `fit-08:184,199,258` | ✅ |
| Installed-consumer inversion | `hasDefineFactory` now asserted `false` on `./testing` (`true` nowhere); root/commons/conformance/typescript stay `false` | ✅ |
| Stale static import fails to resolve (REQ-TES-06.4) | NEW `assertDefineFactoryImportFailsToResolve` — writes a real `import { defineFactory } from "@pbuilder/sdk/testing"` script into the scratch install, asserts non-zero exit + `defineFactory` in stderr; correctly avoids `runScratchScript` (which throws on the non-zero exit that IS the scenario) and correctly notes the dynamic `"x" in mod` probe alone could not prove this | ✅ (ran green via real bun subprocess against the packed tarball) |
| `runFactoryForTest` alone drives both founding scenarios (REQ-TES-06.2/.3, REQ-LC-02.x) | the 6 previously-red installed-consumer tests now pass with bare `const run = () => {...}` scripts | ✅ |
| Removal dts regen (event 2/2) PAIRED with positive assertion (REQ-TES-05.3) | `testing.index.d.ts` baseline diff = re-export line removed + rewritten bare-shape JSDoc (NOT removal-only); `typescript.index.d.ts` regenerated for the @example fix; fit-04's REQ-TES-05.3 positive assertion (asserts the new signature text in the CURRENT `dist/` output) remains at `:164` and ran green post-removal | ✅ |
| FIT-29 positive control 2→1 | diff — expectation now `["../core/context.ts"]` (one line: the internal import; the removed re-export was the second) with updated rationale comment | ✅ |
| TES-05.1/.2 regression | fit-04's baseline-diff + Batch/Directive presence legs green | ✅ |

## S-005 acceptance (REQ-ATH-20.2)

- `bun scripts/regen-corpus.ts` against the S-004 bare fixtures: all 22 records written,
  `git status` on the corpus dir EMPTY — byte-identical no-op. FIT-28 fresh-process
  double-run: green (standalone + in suite).

## Three disclosed discoveries — adjudications

### (1) `src/dialects/typescript/index.ts` JSDoc example → LEGITIMATE (necessary consequence, not scope creep)
The `@example` imported `defineFactory` from `./testing` — after S-006's removal that
example would demonstrate an import that FAILS TO RESOLVE, i.e. the removal itself would
introduce a broken author-facing doc (the typescript dialect is in FIT-06's
`PUBLIC_PATHS`, an author-visible surface). Fixing it in the removal commit is the
minimal coherent scope, matches the bare convention every other surface uses, and its
`typescript.index.d.ts` baseline regen folds into the removal-regen event. Design §14's
doc inventory missed it — **lessons-learned candidate for archive** (same defect class as
R-9's harness-file undercount: inventory-by-narrow-search).

### (2) Installed-consumer collision-seed latent bug → LEGITIMATE (in-slice fix)
The old script line passed `{ "<path>": "<content>" }` positionally — under the
post-S-000 signature that object is silently read as an OPTIONS BAG with `seed:
undefined`, so the collision scenario would stop testing anything. Fixed to
`{ seed: { ... } }` in the same edit. The file was S-006's own red bucket since S-000;
fixing its latent shape bug during its owning slice is correct. (This is the same
silently-swallowed-positional-seed mutant class verify-in-loop-1 Finding 2 warned about —
here it was caught in the e2e's own conversion.)

### (3) S-005 vacuous-red documentation → CORRECT CALL
S-005's Failing-first line assumed the fixture conversion would change corpus bytes
(stale-corpus red). S-004 was proven byte-identity-preserving (batch-3 verification ran
the regen: no-op), so FIT-28 could never go red against the committed corpus.
Manufacturing a red would be theatre; documenting the vacuousness (apply-progress `:543`,
citing the verify-in-loop-4 precedent) is the honest move. The slice's REAL acceptance
(ATH-20.2 git-clean no-op regen) is verified by execution, twice.

## Strict TDD (in-loop audit)

**Verdict**: ok
- S-006's declared reds were genuinely red for four batches (installed-consumer 6 fails
  from S-000 through batch 3; FIT-08 narrowing red-proof by construction) → all green now.
- S-005's red leg: vacuous, documented (adjudication 3) — waiver recorded for the final
  TDD aggregate.
- No banned assertion patterns in the delta (TES-06.4 asserts exit code + stderr content;
  TES-03.x red-proofs scan fixture sources with specific violation predicates).

## Findings

None blocking.

---

## CARRIED TO FINAL — things verify --mode=final should scrutinize

1. **R-3 replica drift risk** (batch 3, WARNING): the scratch-anchor replica in
   `test/fixtures/author-emulation/factory.ts` skips `validateAtRunBoundary`, hardcodes
   the containment ceiling, and lacks `checkReservedNames`' scan-failure wrapper.
   Register followup: lockstep pin test or shared helper. §20 R-3 superseded by R-11.
2. **Design inventory gaps — lessons-learned**: two independent undercounts in one change
   (R-9: 5 unclaimed harness-convention files from a too-narrow `fd`/`rg`; §14 docs table:
   missed the typescript-dialect `@example`). Final/archive should promote "inventory
   claims need multi-pattern sweeps + verify-side re-derivation" to `project/lessons-learned`.
3. **Test-after waivers for the TDD aggregate**: `harness-options-bag.test.ts` (batch 1,
   R-10-mandated) and S-005's vacuous red — both documented, neither an anti-TDD violation;
   the final report should carry them as waivers, not findings.
4. **Cosmetic**: comment-level `defineFactory` tokens remain in
   `test/fake/harness-opted-in.test.ts` and `test/scaffold/classify-transport.test.ts`
   (prose about the migration) — no spec scenario scans test comments; optional cleanup.
5. **Adversarial review flag**: triage is L → `adversarial_review: required` at final;
   judgment-day should see the full diff + signed spec blind.
6. **JSDoc example inside `defineFactory`'s own doc** (`context.ts:288`) still shows
   `defineFactory<Input>` usage — CORRECT per design (it is the @internal re-aimed example
   for sanctioned callers), noting it here so final-mode does not mistake it for a missed
   token.

## Orchestrator action

Exit the /build loop — all 7 slices (S-000..S-006) complete and green. Proceed to
/simplify, then `sdd-verify --mode=final`. Iteration 1 of 3 used for this batch.
