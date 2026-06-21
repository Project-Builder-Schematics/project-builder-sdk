# Verify Report — foundations-skeleton (mode: final)

**Verdict**: `needs-fix`
**Triage**: L · **Sensitive**: deployment/publish, supply-chain
**adversarial_review**: required (L + sensitive — publish/supply-chain)
**Date**: 2026-06-21 · Branch `feat/foundations-skeleton` (4 commits on `a0df99c`)

One Bug-severity finding gates archive: the CI step ordering makes the FIT-04
fitness gate error out on a clean checkout (ENOENT). Everything else — all REQ
clauses, all fitness functions, the build, typecheck, the permissive-proof, and
the supply-chain/publish posture — is COMPLIANT. The fix is a one-step reorder in
`ci.yml` (or guard FIT-04 on `dist` existence); no spec/design change required.

---

## Execution evidence (real numbers)

| Command | Result |
|---|---|
| `bun install` | no changes (6 installs / 7 packages) |
| `bun run build` (`tsc -p tsconfig.build.json`) | exit 0 — emits `dist/{index,commons/index,conformance/index}.{js,d.ts}` |
| `bun test` (full suite, dist present) | **109 pass / 0 fail**, 126 expect() calls, 19 files |
| `bun run typecheck` (`tsc --noEmit`) | exit 0 — clean |
| `bun run typecheck:permissive-proof` (raw `tsc` exit **2**) | TS2578 fires on `permissive-proof.ts:34` — **proof PASSES (inverted)** |
| `bun test` with `dist/` ABSENT | **106 pass / 3 fail** — FIT-04 throws ENOENT (impurity, see Bug-01) |

Note on the `bun run typecheck:permissive-proof` wrapper: `bun run` reports exit 0,
but the EXPECTED `TS2578` is printed and the **raw** `tsc` exit is `2`. The CI step
(`ci.yml:40-46`) inverts it correctly (`if bun run ...; then exit 1`). The proof is
genuine, not theatre — verified by running tsc directly.

---

## Spec compliance matrix

Legend: COMPLIANT = a covering test PASSED at runtime · PARTIAL = covered but with a caveat.

| REQ | Clause | Covering test (file::name) | Result |
|---|---|---|---|
| PKG-01 | subpath exports `.`/`./commons`/`./conformance`; no `./core` | `package.json#exports` (static) + FIT-08 no-kit-bleed | COMPLIANT |
| PKG-02 | `tsconfig.build.json` emits ESM+`.d.ts`; dev `tsconfig` `noEmit` | `bun run build` → `dist/**.{js,d.ts}`; `tsc --noEmit` clean | COMPLIANT |
| PKG-03 | CI publishes dev prerelease, provenance, fork-isolated | `.github/workflows/publish.yml` (config + dry-run + `--provenance`, OIDC, `main`-only, no `id-token` in ci.yml) | COMPLIANT (config-asserted per spec — live publish deferred to registry trust) |
| KIT-01 | `EngineClient { emit; read:Promise<string> }` sole seam, no served tag | `engine-client.ts`; skeleton + fidelity suites consume it | COMPLIANT |
| KIT-02 | `Session` buffer + flush-before-read, no tree | `session.test.ts::flushes pending before read`; FIT-07 | COMPLIANT |
| KIT-03 | `DirectiveFactory` pure, ADR-0028 shapes, `remove`→`delete`, AST-blind | `golden-ir.test.ts` (6 ops, exact-key); `directive-factory.test.ts` | COMPLIANT |
| KIT-04 | Handle state machine, type-enforced, open | `handle-types.test.ts` (+`@ts-expect-error`), `permissive-proof.ts` (flips red, tsc exit 2), `handle-chaining.test.ts` | COMPLIANT |
| KIT-05 | Ambient `RunContext` (ALS), client injected, `currentContext` throws outside | `context.test.ts` (throws-outside, fake injection, parallel-run isolation, cross-contamination) | COMPLIANT |
| FAKE-01 | eager batch apply in array order | `fidelity.test.ts::applies in sequence [create A, modify A]` (+2) | COMPLIANT |
| FAKE-02 | Tree-first read + served tag (fake-internal) | `fidelity.test.ts::served:tree / served:disk / raw string` | COMPLIANT |
| FAKE-03 | flush-before-read round-trip, no SDK shadow | `fidelity.test.ts` + `read-your-own-write.test.ts` (call-order log) | COMPLIANT |
| FAKE-04 | fail-closed + force precedence (3 rows × create/rename/copy) | `fidelity.test.ts::Row 1/2/3` (9 tests) | COMPLIANT |
| FAKE-05 | idempotent delete | `fidelity.test.ts::FAKE-05` (5 tests: absent, double, tree, seed, double-existing) | COMPLIANT |
| FAKE-06 | fidelity to OBSERVABLE contract, independent oracle, no engine internals | `test/fake/fidelity.test.ts` imports only `ContractFake`+wire; no Session/commons; no tombstone/opLog | COMPLIANT |
| SKEL-01 | byte-exact read-your-own-write, content equality (not "did not throw") | `read-your-own-write.test.ts::returns content byte-exact` (`toEqual(content)`, `order===["emit","read"]`) | COMPLIANT |
| GIR-01 | golden-IR per op, exact-key, hand-written, `delete`/shape-only | `golden-ir.test.ts` + `fixtures.ts` (hand-written; `create` unrendered DSL; envelope-shape) | COMPLIANT |
| FIT-01 | commons zero AST libs (allow-list scan) + red-proof | `fit-01-commons-no-ast.test.ts` (main + 3 red-proofs, scanner exercised) | COMPLIANT |
| FIT-02 | no dialect imports another dialect (leaf) + red-proof | `fit-02-dialect-leaf-rule.test.ts` (no dialects yet; scanner pre-wired; 2 red-proofs) | COMPLIANT |
| FIT-03 | `/commons` < 50 KB minified, no AST specifier + red-proof | `fit-03-commons-bundle-budget.test.ts` (real `bun build --minify`; red-proof uses string literal — minor, noted) | COMPLIANT |
| FIT-04 | public `.d.ts` semver gate vs committed baseline + red-proof | `fit-04-dts-semver-gate.test.ts` (diffs REAL `dist/*.d.ts`; 2 red-proofs) | PARTIAL — passes only with `dist/` present; see Bug-01 |
| FIT-05 | only serializable bytes cross seam + red-proof | `fit-05-serializable-bytes.test.ts` (JSON roundtrip; function-value red-proof) | COMPLIANT |
| FIT-06 | every public export carries JSDoc `@example` + red-proof | `fit-06-example-jsdoc.test.ts` (8 commons exports; scanner distinguishes tag from prose; 3 red-proofs) | COMPLIANT |
| FIT-07 | no `Map<path,*>`/tree in core + red-proof | `fit-07-no-tree-in-core.test.ts` (5 production core files scanned; 2 red-proofs) | COMPLIANT |
| FIT-08 | no author subpath re-exports a kit symbol + red-proof | `fit-08-no-kit-bleed.test.ts` (3 subpaths; 2 red-proofs; Found/Writable correctly excluded) | COMPLIANT |
| STD-01 | public-repo standards + dialect doc stub; SECURITY trust posture verbatim | `CONTRIBUTING`/`CODE_OF_CONDUCT`/`SECURITY.md` (explicit-trust posture present), `.github/` templates+CI, `docs/authoring-a-dialect.md` (5 titled sections) | COMPLIANT |
| STD-02 | the two ADRs (verb→IR lowering, single-package subpath) | `openspec/decisions/0013-verb-ir-lowering.md`, `0014-single-package-subpath-shape.md` | COMPLIANT |
| CONF-01 | conformance scaffold + meta-tests (remove-property→red) | `src/conformance/index.ts` (typed stubs), `test/conformance/meta.test.ts` (main `toHaveProperty` is the genuine red gate) | COMPLIANT (red-proof tests are vacuous — minor, see Quality-01) |

**Completeness**: all 7 slices' deliverables present in code (S-000..S-006). All 27 REQ
clauses covered. **Coherence**: code matches design §Interface contracts + File Changes
table exactly; no rejected alternative slipped in (handle is open/interface-based per
ADR-0010; Session holds no tree per ADR-0008; kit boundary intact per ADR-0009).

---

## Step 11b — code-audit (mode: pre-pr, GATING)

Independent audit pass + my own read. Findings:

| Severity | Location | Description | Fix |
|---|---|---|---|
| **Bug** | `ci.yml:28-35` + `fit-04-dts-semver-gate.test.ts:63-65` | CI runs `bun test` BEFORE `bun run build`. FIT-04 `readFileSync`s `dist/*.d.ts`; `dist/` is untracked → ENOENT → 3 FIT-04 tests fail, erroring CI on every clean push. Empirically reproduced (106 pass / 3 fail with dist absent). No `pretest`/`prepare` hook regenerates dist; no test runs the project build. | Move the **Build** step before **Run tests** in `ci.yml` (simplest, matches FIT-04's S-004 intent), OR guard FIT-04's baseline-diff blocks behind `existsSync(distFile)` + an explicit "dist exists after build" assertion. |
| minor | `contract-fake.ts:100,117,127` | `rename`/`copy`/`move` of an **absent source** silently produce `content=""` instead of erroring. No REQ-FAKE clause covers absent-source; latent oracle-fidelity gap. | Add fail-on-absent-source + fidelity row when real apply semantics land (vNext). |
| minor | `fit-03-commons-bundle-budget.test.ts:76-93` | FIT-03 red-proof uses a string literal `"ts-morph"`, not a real import — exercises the specifier scanner but not true bundle inclusion. Production assertion (real `bun build` + size + scan) is sound. | Swap to a real `import "ts-morph"` once an AST dep exists. |
| minor (Quality-01) | `meta.test.ts:23-32` | The two CONF-01 "[red-proof]" tests assert `expect(stripped).not.toHaveProperty(key)` on an object that deliberately lacks the property — a tautology. NON-load-bearing: the MAIN `expect(conformance).toHaveProperty("testDialect")` IS the genuine gate and goes red if the export is removed, satisfying the spec clause. | Replace the inverse-assertion red-proofs with a check that the real `extractPublicExports`-style gate fires, or delete them (the main test already proves it). |
| info | `define-dialect.ts:7` | One `any` (`Op = (...args:any[])=>void`), eslint-disabled, documented T-M2 placeholder. | Refine to generic AST param at T-M2. |
| info | `dist/core/**` shipped, no `./core` export | Kit emitted into package but unreachable via exports encapsulation. ADR-0009 "extraction-ready" by design, not a leak. | None. |

**Audit verdict**: one Bug-severity finding → change FAILS the Step 11b gate →
overall verdict `needs-fix`. Routing: `verify-failed` (final), category **quality**
(CI-wiring defect, Executor-fixable; no re-spec/re-design needed).

---

## Assertion-quality audit (Strict TDD)

Scrutinized all 19 test files. **No tautologies, ghost loops, smoke-only, or
mock-heavy theatre in load-bearing tests.** Highlights:

- SKEL-01 asserts byte-exact content equality (`toEqual(content)`) AND flush order via a
  real call-order log — not `toBeDefined`/"did not throw".
- FAKE fidelity: real read-after-write/read-after-delete behavioural assertions; the
  suite is genuinely independent (imports only `ContractFake` + wire types).
- KIT-04 permissive-proof GENUINELY flips the `@ts-expect-error` negatives red (raw tsc
  exit 2, TS2578) — confirmed by direct tsc run; the CI inversion is correct.
- Every fitness red-proof (FIT-01/02/05/06/07/08) runs the SAME production scanner
  function against a deliberate violation and asserts it fires. FIT-03/04 red-proofs are
  weaker (string-literal / simulated-string) but their MAIN assertions exercise the real
  artifact (`bun build` output; real `dist/*.d.ts` diff).
- Only genuinely vacuous assertions: the two CONF-01 meta-test "[red-proof]" cases
  (Quality-01, minor, non-load-bearing — the main property check is the real gate).

No test result depends on ordering EXCEPT FIT-04, which depends on a prior
`bun run build` (Bug-01). This is the one impurity in the suite.

---

## Fitness / drift

All 8 fitness functions green locally (FIT-04 only with `dist/` present). No layer
violations: commons→no AST (FIT-01), core→no tree (FIT-07, contract-fake exempt by
design), kit boundary intact (FIT-08), only-bytes-cross-seam (FIT-05). architecture_impact
per design = additive (greenfield); no breaking refresh required.

## adversarial_review

**required** — L + sensitive (publish/supply-chain). Confirmed. Recommend judgment-day
runs against the fixed branch (after Bug-01) before archive.

## Halts / routing

- `verify-failed` (final), category **quality** → Executor `sdd-apply` fix (reorder the
  `ci.yml` build/test steps or guard FIT-04 on `dist` existence), then re-verify.
- No spec ambiguity, no architectural conflict, no sensitive-area surprise.


---
# Verify Report — foundations-skeleton (mode: final, iteration 2)

**Verdict**: `pass`
**Triage**: L · **Sensitive**: deployment/publish, supply-chain
**adversarial_review**: required (L + sensitive — publish/supply-chain)
**Date**: 2026-06-21 · Branch `feat/foundations-skeleton` · fix commit `18cbbb5` (on `904938c`)

Focused re-verify after the iteration-1 quality fix pass. All 9 findings are GENUINELY
closed — each confirmed against the mechanism that makes the original defect impossible,
not against a green checkmark. The fix pass introduced no new Bug/Architecture/MAJOR.
The change is archive-ready.

## Clean-state evidence

Built from scratch (`bun run build`), then full suite:

- **Suite**: `118 pass, 0 fail`, 156 expect() calls, 19 files. (~106 ms)
- **typecheck (strict)**: exit `0`.
- **typecheck:permissive-proof**: exit `2` (non-zero as required — TS2578 "Unused
  '@ts-expect-error'" is its success signal; the CI inversion fails iff this exits 0).
- **Tarball** (`bun pm pack --dry-run`): 42 files — `dist/**` + `package.json` + `LICENSE`
  + `README.md` only. No src/test/tsconfig/openspec. Unpacked 39.78 KB.

**FIT-04 self-freshness proven empirically**: touched the 5 tracked src files newer than
`dist/` (src mtime 1782009177 > dist 1782009128) → `isDistFresh()` returned false →
`beforeAll` ran `bun run build` → dist mtime advanced to 1782009179 (820 ms run). A
renamed public export would now be caught even without a manual rebuild.

## 9-finding confirmation

| # | Finding | Status | Confirming mechanism |
|---|---------|--------|----------------------|
| 1 | CI build-before-test + FIT-04 self-fresh | **closed** | `ci.yml:28-32` build precedes test; `fit-04:42-76` `isDistFresh()` compares oldest dist `.d.ts` mtime vs newest src mtime, `beforeAll` rebuilds on staleness — empirically verified (rebuild fired). |
| 2 | Tarball `files: ["dist"]` | **closed** | `package.json:31-33`; pack ships only dist + manifest + LICENSE/README. `dist/core/contract-fake.js` ships inside dist (internal, not in `exports`) — accepted deferred followup. |
| 3 | FIT-07 globs all core + catches `Record<string,` | **closed** | `fit-07:27-30` `readdirSync(CORE_DIR)` replaces the old hardcoded 5-file list (was missing base-handle/define-dialect/handle-state); `hasRecordStringField` adds Record detection; contract-fake exclusion justified (it IS the fake tree). |
| 4 | Handle-chaining payload assertions | **closed** | `handle-chaining.test.ts` asserts per-verb payload: modify{path,content}, rename{path,newName,force?}, move{path,toDir}, copy{from,to,force?}, delete{path}. A swapped field mapping would fail (e.g. `:69-70`, `:108-111`). |
| 5 | FIT-06 scans conformance + re-exports; @example present | **closed** | `fit-06:22-25` scans commons+conformance; `buildReExportMap` follows the two-step `import type`/`export type` barrel; FoundHandle/WritableHandle carry `@example` (`handle-state.ts:12-15,25-28`). Full suite green proves real re-export resolution. |
| 6 | currentContext error wording | **closed** | `context.ts:20-26` names only user-facing verbs + "your factory function"; the old string named `currentContext()`/`defineFactory` — diff confirms removal. |
| 7 | setup-bun pinned to SHA | **closed** | `ci.yml:21` and `publish.yml:24` both pin `oven-sh/setup-bun@0c5077e...` (full SHA), incl. the OIDC publish job. |
| 8 | FIT-03/05/CONF-01 red-proofs hit the real guard | **closed** | FIT-03 red-proofs call real `buildAndMeasure`+`containsAstLibSpecifier`+`BUDGET_BYTES`; FIT-05 adds a NaN→null red-proof exercising the exact `JSON.parse(JSON.stringify)`+`toEqual` green path; CONF-01 red-proofs spread the REAL `conformance` module. |
| 9 | No slice/"T-M2" vocab in runtime error strings | **closed** | `conformance/index.ts:57,75` errors are milestone-free; grep confirms "T-M2" appears ONLY in code comments, never in a thrown string. |

## Step 11b re-audit (code-audit pre-pr, `904938c..HEAD`)

No new `Bug` / `Architecture` / `MAJOR`. Diff is 14 files: CI×2, package.json, 2 src
(error-string-only rewrites), handle-state JSDoc, 7 test files, 1 skeleton test. Runtime
src changes are exactly the 3 intended string fixes (#6, #9) + added `@example` JSDoc. No
`as any`/`@ts-ignore`/TODO introduced; the single `as unknown as import(...)` is a scoped
red-proof coercion to build a knowingly-invalid directive (legitimate negative test). No
scope creep, no migrations, no sensitive-area regression.

## Regression check

No brittleness or vacuousness introduced. FIT-04's `beforeAll` build adds ~700-800 ms when
dist is stale, but is a no-op when dist is fresh (CI builds first, so it never fires in CI)
— no flake risk. Strengthened assertions (handle-chaining payloads, NaN red-proof) are
deterministic.

## New findings (non-blocking)

- **N-01 (Nit, FIT-07 `Record<string,` evasion)**: `hasRecordStringField` skips any line
  matching `^(?:export\s+)?type\s+\w+`, so a violation laundered through a type alias
  (`type FileTree = Record<string,string>` + `private files: FileTree`) would evade both
  the Record and Map detectors. This is a PRE-EXISTING theoretical gap, not a regression —
  the prior version was strictly weaker (hardcoded file list). Any concrete inline
  `Map<string,`/`Record<string,` field IS still caught. Low severity for a walking
  skeleton (ADR-0008 polices stored path-keyed state). Register as followup; do not gate.

## adversarial_review

**required** — L + sensitive (publish/supply-chain). The iteration-1 gating Bug is closed;
recommend judgment-day runs BLIND against the fixed branch before archive.
