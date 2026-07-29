# Verification Report

**Change**: `inline-collection-marker`
**Mode**: final (Strict TDD)
**Spec version**: V3.3 signed (owner, 2026-07-28 — micro-unfreeze ruling 15; 14 delta families)
**Change base**: `1e44ae8` → **HEAD** `8c3828a` (built directly on `main`)
**Verified**: 2026-07-29

---

## Verdict: **pass-with-followups**

The change delivers what the signed spec promises. SDK-side containment is genuinely gone
(not renamed, not relocated): `resolvePackageRoot`, `containment.ts`, the ceiling/realpath
machinery, and the `packageRoot` anchor are deleted, `packageDir` is the sole run anchor,
and the reported inline-collection regression is closed by an authoritative test that
asserts the full-ancestor-chain no-marker precondition. The union narrows 12 → 11 with the
FIT-04 baseline updated in the same commit, and the release bundle (version 0.2.0,
CHANGELOG, SECURITY.md, ADR-0077 + three dated supersession/amendment headers) is coherent
and mechanically guarded. Suite is 2398 pass / 0 fail on two independent uncontended runs;
`tsc --noEmit` clean. Zero CRITICALs: no finding below carries a demonstrated failure, and
none blocks the stated problem's resolution. Five WARNINGs and three SUGGESTIONs are
routed as followups — the largest is a systemic shortfall against the spec's own
"driven once per verb (three cases)" rule, materially mitigated by the single-implementation
+ static-call-site-count design but not discharged as written.

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 7 (S-000 … S-006) |
| Slices complete | 7 |
| Tasks total | 52 |
| Tasks complete | 52 (`rg "^\- \[ \]" slices.md` → 0 hits) |
| Commits in change | 11 (`1e44ae8..8c3828a`) |
| Files changed | 90 (+4401 / −1319) |

---

## Build & Tests Execution

**Build / typecheck**: ✅ `bunx tsc --noEmit` → exit 0, zero errors.

**Tests (full suite, two independent uncontended runs)**:

| Run | Result | expect() calls | Files | Wall |
|---|---|---|---|---|
| 1 | ✅ **2398 pass / 0 fail** | 5310 | 201 | 89.95s |
| 2 | ✅ **2398 pass / 0 fail** | 5310 | 201 | 84.88s |

Byte-identical to the post-simplify baseline in the task brief. The disclosed contention
flake (`react-conformance.test.ts` / `quickstart-docs.test.ts`) did **not** reproduce on
either run — both were run without competing load, and `tsc` was run separately afterwards.

**Coverage tool**: ➖ Not available — no coverage tool configured in this project.

**Fitness suite**: included in the full run; `fit-04`, `fit-26`, `fit-27`, `fit-28`,
`fit-40`, `fit-43`, `fit-44`, `fit-45` all green. `fit-04`'s kit-internal pair was verified
against a **fresh** `dist/` (built 07:56, after `8c3828a` at 07:51) — `dist/core/context.d.ts`
carries the single-field `packageAnchors?: { packageDir: string }`.

### Independent fault injection (non-vacuousness proofs, run by this verify)

These were run against the real tree and reverted; `git diff` confirmed clean restoration.

| Guard | Injected fault | Result |
|---|---|---|
| `fit-43` clause (a) — zero `collection.json` literal in `src/**` | appended `// fault-injection probe: collection.json` to `src/core/context.ts` | ✅ **FAILED as designed** — named the offending file; 12 pass / 1 fail |
| REQ-MFB-01.3 runtime shape pin (`run-boundary-validation.test.ts`) | re-added `packageRoot` to the `packageAnchors` literal in `context.ts` | ✅ **FAILED as designed** — `Object.keys` deep-equality caught the additive regrowth; 14 pass / 1 fail |

Both guards are real. The second matters most: it is the only check that catches an
**additive** ceiling regrowth (FIT-04's kit-internal leg is removal-only, and `fit-43`
clause (c) reads the committed baseline, not live source).

---

## Strict TDD (final audit)

**Verdict**: pass-with-followups

### TDD Cycle Adherence
- **Method used**: git-history + commit-messages + the change's own per-task TDD Cycle
  Evidence tables in `apply-progress.md`.
- Commits are slice-grained (`test(scaffold)` / `feat(core)!` / `feat(fitness)` /
  `refactor(test)`), not cycle-grained, so Method 3 is only weakly informative.
- **Findings**: The change **discloses its own RED-first deviations up front** rather than
  claiming a clean cycle (`apply-progress.md:135`): every S-001 test passed on first run
  because `statSourceForRead`'s TOTAL guard and `isLexicallyEscaping` were already complete
  from S-000.5 (the design's own step-4+5 merge note — a TOTAL guard cannot be built
  non-total mid-slice). Non-vacuousness was substituted by **per-task mutation-check**
  (disable clause → confirm the right test fails for the right reason → restore →
  re-confirm green), recorded per row with the exact failure text. S-002's type-level pins
  were genuinely RED-first (`TS2322` against the still-12-member union, then GREEN in one
  step). This is honest evidence, not ceremony, and I independently corroborated the
  discipline with two fault injections of my own. **No anti-TDD pattern found.**

### Assertion Quality
- Tests scanned: 33 changed test/support files.
- Banned-pattern matches: **0** (`toBeDefined()`, `toBeTruthy()`, `toBeFalsy()`,
  `not.toThrow()` as sole assertion, snapshots — all absent).
- One `expect(match).not.toBeNull()` in `fit-43` clause (c) is a precondition guard
  immediately followed by a real deep-equality assertion — not a banned sole assertion.
- The change explicitly **strengthens** assertion quality in two places the spec demanded:
  `Object.keys(packageAnchors)` deep-equality instead of `toBeUndefined()` (REQ-MFB-01.3),
  and `copyin-parity.test.ts` now asserts the **reason**, not merely the accept/reject
  verdict.
- **Findings**: Clean.

### Triangulation
- Functions audited: `isLexicallyEscaping` (7 escaping forms + Windows drive + 2
  substring-non-match + 1 preservation-pin), `statSourceForRead` (ENOENT / ELOOP /
  ERR_INVALID_ARG_VALUE / 5 looped errnos / no-`.code` fallback / isDirectory / !isFile),
  `withOptionalLocator` consumers in `walk.ts` (5 message helpers × locator-present and
  locator-absent), the `fit-43/44/45` scanners (each with a red-proof fixture and a
  real-tree positive).
- Triangulation gaps: **0**.

### Mutation Testing
- Tool: **Not configured** — `package.json` devDependencies carry only `@types/bun`,
  `expect-type`, `typescript`. Skipped per the module's own rule.
- Compensating evidence: per-task manual mutation-checks recorded in `apply-progress.md`,
  plus this verify's two independent fault injections (above).

### REQ-ID Coverage
- Delta families: 14. REQ-IDs across them: 27 requirement-level, ~60 scenarios.
- Families **fully covered in-change**: **10/14** — `package-dir-run-anchor`,
  `package-source-io-hygiene`, `fitness-guards`, `authoring-error-contract`,
  `folder-scaffold`, `by-reference-copy-wire`, `run-boundary-input-validation`,
  `conformance-corpus`, `conformance-self-check`, `package-root-containment` (retirement
  verified for everything except its archive-sync-only clause).
- Families **deferred to archive-sync by explicit, signed design**: **3** —
  `scenario-matrix` (REQ-SCM-01.1, REQ-SCM-02.1), `golden-corpus-contract` (REQ-GCC-08.1),
  `conformance-fixtures` (cross-reference amendment). All three are ledgered in
  `slices.md` § "Excluded from Slices (Archive-Sync Work)" with a mechanical-impossibility
  rationale that I verified: their assertions read main-family spec files that only change
  at archive-sync. This is a planned deferral, not an omission.
- Family **partially covered**: **1** — `ir-path-well-formedness` (see W-1/W-2).
- Uncovered REQ-IDs: **0**.

---

## Adversarial Quality Gate (Step 11b)

### Stage A — Code audit (`pre-pr` mode, GATING)

**Result: 0 gating findings.** Findings below pass neither the EVIDENCE filter (none
carries a demonstrated failure) nor the OUTCOME filter as `blocking` — all are tagged
`outcome_relevance: improvement` and routed as followups.

| Severity | Location | Finding | Evidence | Outcome relevance |
|---|---|---|---|---|
| Epic AC check | `test/e2e/scaffold.e2e.test.ts`, `test/scaffold/expander.test.ts`, `test/conformance/copyin-parity.test.ts` | Per-verb (×3) integration coverage promised by design §7 not discharged for several REQ-PSH/REQ-IPF scenarios | `rg` sweep, see W-1 | improvement (`unverified` as a defect — mitigated structurally) |
| Epic AC check | `test/e2e/scaffold.e2e.test.ts:146` | REQ-IPF-01.1's zero-stat/read assertion missing at the `templateFile` and `copyIn` verb boundaries | direct read, see W-2 | improvement |
| Architecture | `test/fitness/fit-43-no-ceiling-regrowth.test.ts:34-43` | REQ-FTG-06(d) implemented as a file-class exclusion, not the spec's per-symbol allowlist | direct read, see W-3 | improvement |
| Rollout | `test/fitness/fit-26-report-hygiene-citations.test.ts:90-92` | Archive-sync debt: asserts 21 matrix rows; the signed delta pins 20 | `rg`, see W-4 | improvement (ledgered) |
| Rollout | `openspec/sensitive-areas.md` | No row for the package-local read / containment domain; triage flagged this gap | re-checked, see W-5 | improvement |
| Nit | `src/scaffold/walk.ts:30-40` | Simplify pass left the superseded comment paragraph above the new `withOptionalLocator` doc block | direct read, see S-2 | improvement |

**Checks that came back clean:**
- **3.1 Untyped casts** — one `42 as unknown as string` in `path-guards.test.ts`, which is
  the *point* of the mapping-row-0 test (non-string `relPath` → `invalid-input`). Zero in `src/`.
- **3.3 TODO/FIXME/eslint-disable** — zero introduced.
- **4.1 Scope creep** — every changed file traces to a design §6 row or a named slice task
  (S-005.5/.6/.7 for docs/ADR/CHANGELOG, S-006.2 for `conformance/collection.json`,
  S-000.1 for the `authoring-error-contract` main-spec restore). `test/fitness/pkg-surface-baseline.json`'s
  `containment.* → path-guards.*` swap is a mechanical consequence of the file rename.
  `test/e2e/error-attribution.e2e.test.ts` appears in design §6 but not in the diff — no
  edit turned out to be needed; not a defect.
- **2.2 ADR contradictions** — ADR-0077 supersedes 0046/0067 and amends 0045, each with the
  dated header the spec demands; no accepted ADR is contradicted.
- **2.3 Sensitive area coverage** — the security-relevant behaviour change is covered by
  REQ-PSH-04/05, REQ-IPF-01/02/03, REQ-FTG-06/07/08 and `SECURITY.md`; the *registry* gap
  is W-5, not an uncovered-area finding.
- **4.3 Migration without versioning** — explicitly satisfied: `package.json` 0.1.0 → 0.2.0
  in the same commit as the union shrink, with migration text in `CHANGELOG.md` and
  `docs/authoring-errors.md`.

### Cross-cutting invariant sweeps (run by this verify)

| Invariant | Command | Result |
|---|---|---|
| No `packageRoot`/`realCeiling`/`resolvePackageRoot`/`validateSourceContainment` in `src/**` | `rg 'packageRoot\|realCeiling\|resolveRealCeiling\|validateSourceContainment\|validateSourceRootContainment\|resolvePackageRoot' src/` | ✅ only `single-instance-probe.ts#packageRootFor` — the pre-existing, symbol-allowlisted, unrelated npm-package walk |
| No `collection.json` literal in `src/**` | `rg 'collection\.json' src/` | ✅ zero |
| `containment.ts` deleted | `ls src/scaffold/` | ✅ absent; `path-guards.ts` present |
| No `source-outside-package` outside the allowlist | repo-wide `rg` | ✅ every surviving hit is a retirement narration, migration note, guard ban-list, red fixture, or a pre-archive `openspec/specs/**` historical line (expected — clause (e) is archive-sync-only, spec V3.3) |
| Wire shape carries no SDK-resolved root | REQ-BRC-02.1 / REQ-BRC-07.1 in `expander.test.ts` | ✅ green |
| Release bundle coherent | `package.json` 0.2.0 · `## 0.2.0` heading with all three entries · preamble names the engine repo + conformance corpus · `docs/authoring-verbs.md` carries the **qualified** verbatim rule word-for-word · `SECURITY.md` all five posture points · ADR-0045 "Amended by ADR-0077 (2026-07-28)", ADR-0046 + ADR-0067 "Superseded by ADR-0077 (2026-07-28)" | ✅ all present, and mechanically guarded by `test/docs/changelog-release-vehicle-guard.test.ts` + `test/docs/security-authoring-guard.test.ts` |

### Simplify-pass scrutiny (`da02af7..8c3828a`, never previously verified)

The task brief flagged this commit as unverified. Reviewed line-by-line:

- **`walk.ts` message byte-identity** — `withOptionalLocator(relPath, plain, withLocator)`
  returns `relPath === undefined ? plain : withLocator(relPath)`. Each of the five helpers
  passes exactly the two strings it previously returned inline. **Byte-identical output**;
  confirmed green by the two full-suite runs and by `walk.test.ts`'s locator-present and
  locator-absent cases.
- **Canary helper semantics** — `expectRejectsCanaryFree(dir, canary, thunk)` performs the
  same three steps the 13 inlined call sites did (fresh `ContractFake` → `rejectedRun` →
  `toBeInstanceOf(Error)` → `surfaceContains(...) === false`). Each site's *distinguishing*
  setup (symlinks, extra files, the thunk) stayed inline. **No assertion was weakened or
  dropped.**
- **Memoized `src/**` snapshot** — `realSrcFileSnapshot()` is lazily memoized per process.
  No test mutates `src/**` during a run, so freshness holds; my fault injection confirmed
  the first call reads current on-disk state. Module import stays side-effect-free.
- **Shared `WRITE_CALL_RE`** — now module-level in `import-scan.ts` with the `g` flag and
  **two** consumers (`fit-27`, `src-invariant-scans`). Both use `String.prototype.matchAll`
  **only** (verified by `rg`), which clones the regex internally and never mutates
  `lastIndex` — no cross-consumer statefulness bug. Had either used `.test()`/`.exec()`,
  this would have been a real defect.
- **`findMatchingClose` extraction** — behaviourally identical depth-counting to the three
  inline loops it replaces.

**No behaviour drift found in the simplify pass.**

### Stage B — Blind dual review flag

**`adversarial_review: required`.**

Two independent triggers, either sufficient:
1. **Triage = L.**
2. **Sensitive-area subject.** This change does not merely pass near a security boundary —
   it *deletes* one. `package-root-containment` self-flags REQ-PRC-01…10 as
   `security (input validation / containment) — Flagged: Yes`, and
   `run-boundary-input-validation` independently self-flags REQ-RBV-06. Both are touched.
   The residual is explicitly **widened**: an in-package symlink whose target escapes
   `packageDir` now reaches the wire unfiltered for by-reference directives too, accepted
   under the v1 trusted-author model.

Arguing `not-required` here would require believing that removing a self-declared security
control on a public npm package needs no second, blind pair of eyes. It does. The residual
is well-reasoned and well-documented (ADR-0077 §A's "a factory is arbitrary in-process code
with full `node:fs` — the SDK can never be a security boundary against its own author" is
sound), and the SDK→engine handoff rests on REQ-BRC-02, whose LIVE status is an
**owner first-hand verification of another repo**, not a test in this suite. That single
load-bearing, externally-verified claim is exactly what a blind judge should probe.

---

## Spec Compliance Matrix

| Requirement | Scenario | Test (runtime evidence) | Result |
|---|---|---|---|
| REQ-MFB-01 | .1 sentinel ordering, full-ancestor precondition | `test/scaffold/inline-collection.test.ts:35`; `run-boundary.test.ts` | ✅ COMPLIANT |
| REQ-MFB-01 | .2 all three read verbs commit, no marker anywhere | `inline-collection.test.ts:51` (byte-exact create/scaffold + emitted-directive-shape copyIn) | ✅ COMPLIANT |
| REQ-MFB-01 | .3 `Object.keys` deep-equals `["packageDir"]` + FIT-04 baseline | `run-boundary-validation.test.ts:157` + `fit-43` (c) + `fit-04` kit-internal | ✅ COMPLIANT (fault-injected) |
| REQ-MFB-02 | .1 CHANGELOG `## 0.2.0`, 3 entries, preamble amended, version bumped | `test/docs/changelog-release-vehicle-guard.test.ts` | ✅ COMPLIANT |
| REQ-MFB-02 | .2 `docs/authoring-verbs.md` qualified verbatim rule | same guard; verified word-for-word at `docs/authoring-verbs.md:18-21` | ✅ COMPLIANT |
| REQ-MFB-02 | .3 ADR-0045/0046/0067 dated headers | same guard; `rg` confirms all three | ✅ COMPLIANT |
| REQ-PRC-01…10 | RETIRED wholesale | `containment.ts` deleted; `resolvePackageRoot` deleted; `rg` sweeps clean | ✅ COMPLIANT (clause (e)'s real-tree `openspec/specs/` sweep is archive-sync-only per spec V3.3) |
| REQ-IPF-01 | .1 `../x` rejects ×3 verbs, zero stat/read | unit ×7 shapes with zero-IO (`path-guards.test.ts:197`); `scaffold.e2e:146` (templateFile, no zero-IO assertion); `expander.test.ts:209` (scaffold, zero readdir/lstat); `factory.ts:414` M-16 (copyIn) | ⚠️ PARTIAL (W-2) |
| REQ-IPF-01 | .2 `/abs/x` rejects ×3 verbs | unit ✅; `factory.ts:418` `/etc/passwd` (copyIn) ✅; templateFile ✗; scaffold root ✗ | ⚠️ PARTIAL (W-1) |
| REQ-IPF-01 | .3 escaping scaffold root rejects before enumeration | `expander.test.ts:209` (zero `readdirSync`/`lstatSync`) | ✅ COMPLIANT |
| REQ-IPF-01 | .4 literal `..` rejected in both regimes (preservation-pin) | `path-guards.test.ts:220` | ✅ COMPLIANT |
| REQ-IPF-01 | .5 M-16 re-cited under the ruling-5 screen | `author-emulation-scaffold.e2e.test.ts:351`; corpus `m-16` transcript now `"reason": "invalid-input"` | ✅ COMPLIANT |
| REQ-IPF-01 | .6 segment-aware edge cases ×3 verbs | unit ×5 shapes ✅; zero integration verb legs | ⚠️ PARTIAL (W-1) |
| REQ-IPF-02 | .1 literal `../`/absolute `to` rejects pre-emit | `path-guards.test.ts:230`; `expander.test.ts`; `index.test.ts:151` (both-escape → destination wins) | ✅ COMPLIANT |
| REQ-IPF-03 | .1 no absolute path in an emitted directive | `expander.test.ts` | ✅ COMPLIANT |
| REQ-PSH-01 | .1 FIFO → `source-not-regular-file`, zero content reads | `path-guards.test.ts:134` (real `mkfifo`); `authoring-error-source.test.ts` | ⚠️ PARTIAL (W-1 — 2 of 3 verbs) |
| REQ-PSH-01 | .2 directory-as-source | `path-guards`; `scaffold.e2e`; canary `copyin-nonregular` | ✅ COMPLIANT |
| REQ-PSH-01 | .3 `""`/`"."`/`"./"` → `source-not-regular-file` | `path-guards.test.ts:151` ×3 strings; canary `templatefile/copyin-degenerate`; `classify-transport.test.ts` | ✅ COMPLIANT |
| REQ-PSH-02 | .1 missing → `source-not-found` | `scaffold.e2e:107`; `copyin-parity.test.ts` (reason-level parity); corpus `m-17` | ✅ COMPLIANT |
| REQ-PSH-02 | .2 unreadable → `source-unreadable` (injected seam) | `path-guards.test.ts:90` (EACCES/EPERM/EMFILE/ENFILE/EINTR + no-`.code`) | ⚠️ PARTIAL (W-1 — module-level only) |
| REQ-PSH-02 | .3 embedded NUL → `source-unreadable`, placeholder | `path-guards.test.ts:74`; canary `templatefile-nul`, `copyin-nul`, sanctioned `classifyTransport` unit | ✅ COMPLIANT |
| REQ-PSH-02 | .4 broken symlink → `source-not-found` | `path-guards.test.ts:50`; `scaffold.e2e:179` + `:197` (outside- and inside-target) | ⚠️ PARTIAL (W-1 — no copyIn/scaffold leg) |
| REQ-PSH-03 | .1 in-package symlink → in-package regular file accepted | `path-guards.test.ts:164` | ⚠️ PARTIAL (W-1) |
| REQ-PSH-03 | .2 symlink cycle → `source-unreadable`, no-echo | `path-guards.test.ts:62`; canary `templatefile-eloop`, `copyin-eloop`, `scaffold-eloop` (×3 verbs) | ✅ COMPLIANT |
| REQ-PSH-04 | .1 symlink → OUTSIDE file **succeeds** (positive residual + realpath tripwire) | `path-guards.test.ts:177` (content read back); `expander.test.ts:254` (scaffold leg, committed tree + no absolute-path echo in `readdirSync` targets) | ✅ COMPLIANT (copyIn leg via canary; tripwire holds — a regrown `realpathSync` fails these) |
| REQ-PSH-05 | .1 `SECURITY.md` all five posture points | `test/docs/security-authoring-guard.test.ts`; manually re-read — all five present | ✅ COMPLIANT |
| REQ-FTG-06 | .1 marker/ancestor-walk regrowth caught | `fit-43` (a)/(b) real-tree + red fixtures | ✅ COMPLIANT (fault-injected) |
| REQ-FTG-06 | .2 symbol-scoped allowlist does not shadow a sibling | `fit-43:71` (`ancestor-walk-allowlist-shadow.ts`) | ✅ COMPLIANT |
| REQ-FTG-06 | .3 `realpathSync`/`realpath` regrowth caught (code **or** comment) | `fit-43:135` real trees + red fixture + allowlisted-mirror negative | ✅ COMPLIANT |
| REQ-FTG-06 | .4 `openspec/specs/` sweep LOGIC, fixture-pair | `fit-43:112` (`live-hit.md` fails, `allowlist-only.md` passes) | ✅ COMPLIANT |
| REQ-FTG-06 | clause (d) `test/**` allowlist EMPTY | `fit-43:94` | ⚠️ PARTIAL (W-3 — file-class exclusion, not per-symbol allowlist) |
| REQ-FTG-07 | .1 unreachable surviving reason flagged | `fit-44:44` red fixture planting BOTH excluded shapes | ✅ COMPLIANT |
| REQ-FTG-07 | .2 `CODE_TO_REASON` has zero `source-*` values | `fit-44` | ✅ COMPLIANT |
| REQ-FTG-08 | .1 second lexical predicate flagged, naming both | `fit-45:24`; real tree = exactly `path-guards.ts#isLexicallyEscaping`; call sites = exactly 3 | ✅ COMPLIANT |
| REQ-AEC-10 | .1 three surviving reasons → `authoring-rejected` | `authoring-error-source.test.ts` | ✅ COMPLIANT |
| REQ-AEC-10 | .2 `originFor` 11-arm exhaustiveness + FIT-04 same commit | `authoring-reason.test.ts` (type-level, RED-first evidence recorded) + `fit-04`; baseline updated in `b66900e` | ✅ COMPLIANT |
| REQ-AEC-11 | .1 all five template rows incl. both `source-not-regular-file` variants | `authoring-error-source.test.ts`; templates verified verbatim against `path-guards.ts:59-74` | ✅ COMPLIANT |
| REQ-AEC-11 | .2 source vs destination templates never interchangeable | `path-guards.test.ts` + `index.test.ts:151` (both-escape → destination template wins, pinned statement order) | ✅ COMPLIANT |
| REQ-AEC-12 | .1 owner-ruled modes → `invalid-input`; union still 11 | `authoring-error-source.test.ts` | ✅ COMPLIANT |
| REQ-FSC-09 | .1/.2 symlinked dir skipped; 10 000-entry bound | `walk.test.ts` | ✅ COMPLIANT |
| REQ-FSC-10 | .1/.2/.3 walk-root missing / regular-file / EACCES | `walk.test.ts` | ✅ COMPLIANT |
| REQ-FSC-10 | .4 recursive mid-walk failure, entry-specific no-echo text | `walk.test.ts` (both arms); canary `scaffold-recursive-walk`; mutation-checked in S-000.6 | ✅ COMPLIANT |
| REQ-BRC-02 | .1 no SDK-resolved root on the wire `[SEAM]` | `expander.test.ts` | ✅ COMPLIANT |
| REQ-BRC-06 | .1 missing source → `source-not-found` through the harness | `copyin-parity.test.ts` (now reason-level, both surfaces) | ✅ COMPLIANT |
| REQ-BRC-07 | .1 no absolute path in the emitted directive | `expander.test.ts`; `fit-24` | ✅ COMPLIANT |
| REQ-BRC-08 | .1/.2 `[SEAM] [ENGINE-GATED]` | correctly in the NOT-exercised ledger, not a matrix row | ➖ N/A — engine-side, not SDK-runnable |
| REQ-RBV-04 | .1 canary scan across every rejection branch | `canary-no-echo.test.ts` — 13 branch cases across the three verbs | ✅ COMPLIANT |
| REQ-RBV-04 | .2 key names may appear, values never | `canary-no-echo.test.ts` | ✅ COMPLIANT |
| REQ-RBV-06 | .1 RETIRED, id kept as pointer | `run-boundary-input-validation/spec.md:54`; dead test deleted | ✅ COMPLIANT |
| REQ-RBV-06 | .2 exactly two reads, in order, fs-instrumented | `harness-opted-in.test.ts` (ORDERED); `run-boundary.test.ts` (`existsSync` never called against any `collection.json` path) | ✅ COMPLIANT |
| REQ-CCR-08 | REMOVED | `conformance/collection.json` deleted; zero dangling references | ✅ COMPLIANT |
| REQ-CSC-02 | .1/.2 dangling `expected` / missing `factory.ts` fail | `fit-40-conformance-corpus-integrity.test.ts` (+ negative); `.3` dropped with its validator | ✅ COMPLIANT |
| REQ-SCM-01 | .1 matrix row count exactly 20 | corpus renumbered in-change (20 `m-*` transcripts, `SCENARIOS` = 20); the **assertion** is ledgered archive-sync work | ⏸ DEFERRED (W-4) |
| REQ-SCM-02 | .1 `REQ-BRC-08` only in the NOT-exercised ledger | manifest updated in-change; assertion ledgered archive-sync | ⏸ DEFERRED (W-4) |
| REQ-GCC-08 | .1 manifest passes the FOUR-point checklist | manifest content verified by hand — four literals present, `REQ-PRC-06` dropped, FRICTION non-empty; assertion ledgered archive-sync | ⏸ DEFERRED (W-4) |
| conformance-fixtures | Cross-Reference Amendment | archive-sync annotation | ⏸ DEFERRED |

**Compliance summary**: 44 ✅ COMPLIANT · 8 ⚠️ PARTIAL · 4 ⏸ DEFERRED (planned, ledgered) ·
1 ➖ N/A · **0 ❌ FAILING · 0 ❌ UNTESTED**

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0077 §C — `packageDir` sole run anchor, no ceiling | ✅ | `context.ts` `packageAnchors?: { packageDir: string }`; `resolvePackageRoot` + `missingPackageRootMessage` + `existsSync`/`join` imports all removed |
| ADR-0077 §G — ONE shared lexical predicate, THREE call sites | ✅ | `isLexicallyEscaping` is the single implementation; `validateSourceLexical` called from exactly `readTemplateFile`, `runScaffold`, `runCopyIn` — statically pinned by `fit-45` |
| ADR-0077 §J — kit-internal `.d.ts` set kept OUT of the public `DTS_PAIRS` | ✅ | `KIT_INTERNAL_DTS_PAIRS` is a separate, separately-labelled describe block, with the split's rationale documented in-code |
| Design §4 Q1 — `path-guards.ts` owns the REQ-AEC-11 template mapping via a closed `RejectionDetail` enum | ✅ | `sourceRejection(reason, relPath, detail?)`; `messageFor` in `authoring-error.ts` otherwise untouched |
| Design §4 Q2 — `runCopyIn` screens DESTINATION before SOURCE | ✅ | pinned statement order in `index.ts:114-117`, proven by `index.test.ts:151`'s both-escape fixture |
| Design §4 — check-before-walk ordering preserved | ✅ | `validateSourceLexical(args.from)` precedes `walkFolder`; `expander.test.ts:209` asserts zero enumeration |
| Design §4 — per-entry scaffold sources NOT re-lexically-screened (carve-out) | ✅ | documented at `expander.ts:154-160`; `filename-pipeline.test.ts` pins that `runFilenamePipeline` never alters `sourceRelPath`, the fact the carve-out rests on |
| Design §6 File Changes table | ✅ | every row realised; only `test/e2e/error-attribution.e2e.test.ts` needed no edit |
| Design §7 Test Derivation — "integration ×3 verbs" | ⚠️ | see W-1/W-2 — several rows discharged at module level plus one or two verb legs |
| Rejected alternative: widening the marker to accept `project-builder.json` | ✅ not implemented | superseded direction; no marker probing survives anywhere |

---

## Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| `src/transport/single-instance-probe.ts` | ✅ untouched | the `packageRootFor` grep hazard; symbol-scoped allowlist in `fit-43` (b)/(f) verified not file-scoped |
| `openspec/specs/**` (main, unsynced) | ⏸ expected drift | ~16 live `REQ-PRC-`/`package-root-containment`/`source-outside-package` hits remain pre-archive; clause (e) explicitly does not run before archive-sync (spec V3.3) |
| `openspec/pending-changes.md` rows 268-270 | ✅ re-cited | BRC-02/BRC-08/PRC-06 rows updated with dated `RE-CITED 2026-07-28` notes; gating unchanged |
| `test/fitness/pkg-surface-baseline.json` | ✅ | `containment.{d.ts,js}` → `path-guards.{d.ts,js}` |
| `conformance/` corpus | ✅ | `collection.json` deleted, README carries the retirement note, `fit-40` marker checks removed with their validator |
| Author-emulation corpus | ✅ | 20 `m-*` transcripts **regenerated** (not hand-renamed); `fit-28` determinism green |
| `test/docs/quickstart-docs.test.ts` | ⚠️ pre-existing | contention-sensitive `tsc` subprocess under bun's default 5s timeout — untouched by this change (see S-3) |

---

## In-Loop History

| Iteration | Scope | Verdict | Issues fixed |
|---|---|---|---|
| 1 | S-000 | PASS | — |
| 2 | S-001 | PASS | — |
| 3 | S-002 | PASS | — |
| 4 | S-003 | PASS | ENOENT-ordering CRITICAL regression caught and fixed (broken-symlink classification) |
| 5 | S-004 | PASS | — |
| 6 | S-005 | PASS | — |
| 7 | S-006 | PASS | S-006.3 sweep halted on 19 under-enumerated hits → orchestrator-amended allowlist by enumeration; halt narrative preserved verbatim in `apply-progress.md` |

No single slice needed more than one fix pass; the 3-iteration escalation rule was never
triggered. The halt narrative was **not** rewritten to hide the halt — I re-read
`apply-progress.md:535-680` and confirmed the original halt section stands above the later
RESOLVED addendum.

---

## Issues Found

### CRITICAL (must fix before archive)
**None.** No finding carries a demonstrated failure (failing test, repro + output, or
concrete trace) AND `outcome_relevance: blocking`. Severity language without both is a
followup, not a blocker.

### WARNING (should fix; does not block)

**W-1 — The signed spec's "driven once per verb (three cases)" rule is not discharged as
written for 8 scenarios.** `outcome_relevance: improvement` · `unverified` as a defect.

Both the spec and `design.md:432-435` state the ×3-verb rule "exists expressly to close the
2-of-3 mutant gap," and design §7 names three files per row
(`scaffold.e2e.test.ts` / `expander.test.ts` / `copyin-parity.test.ts`). In practice these
scenarios are discharged at **module level over the single shared implementation**
(`path-guards.test.ts`, against `statSourceForRead` / `validateSourceLexical`) plus one or
two verb legs:

| Scenario | Verb legs actually driven |
|---|---|
| REQ-IPF-01.2 (absolute source) | copyIn only (`factory.ts:418`, `/etc/passwd`) |
| REQ-IPF-01.6 (segment-aware edge cases) | none — unit only |
| REQ-PSH-01.1 (FIFO) | 2 (`path-guards`, `authoring-error-source`) |
| REQ-PSH-02.2 (injected EACCES) | 0 — `spyOn(fs,"statSync")` appears only in `path-guards.test.ts` |
| REQ-PSH-02.4 (broken symlink) | templateFile only (`scaffold.e2e:179`, `:197`) |
| REQ-PSH-03.1 (in-package symlink accepted) | 0 |

**Why this is a WARNING and not a CRITICAL**: the mutant class the rule targets ("the guard
is missing at one call site") is substantially closed structurally. `isLexicallyEscaping`
and `statSourceForRead` are each a *single* implementation, fully unit-covered including
the zero-stat/read ordering; and `fit-45` clause (b) statically asserts
`validateSourceLexical` is called from **exactly** the three named sites — deleting one
turns `fit-45` red. `statSourceForRead` reaches all three verbs through only two call sites
(`classify-transport.ts` serves both scaffold-per-entry and `readTemplateFile`;
`index.ts#runCopyIn` serves copyIn), so a literal three-way integration matrix was always
partly notional there.

**Fix suggestion**: add the missing verb legs where they are cheap (absolute-source
`templateFile` and `scaffold` root cases; one `copyIn` broken-symlink case), or amend the
spec's ×3 phrasing to name the structural substitute it actually relies on. The current
state is a real mismatch between what the signed text promises and what ships.

**W-2 — REQ-IPF-01.1's zero-stat/read assertion is not made at each verb boundary.**
`outcome_relevance: improvement`.
The scenario requires "zero stat or read calls are recorded against the target" and design
§7:458 specifies `instrumentHarnessIO` ×3 verbs. Actual: the unit test asserts it for all
seven shapes (`path-guards.test.ts:201-213`), and the scaffold leg asserts zero
`readdirSync`/`lstatSync` (`expander.test.ts:209`). The `templateFile` leg
(`scaffold.e2e.test.ts:146`) asserts only that the secret content never appears and the
trees stay empty; no `copyIn` leg asserts it at all. The screen-before-stat ordering *is*
proven — just not at the verb boundaries the scenario names.

**W-3 — REQ-FTG-06 clause (d) ships as a file-class exclusion, not the spec's per-symbol
allowlist.** `outcome_relevance: improvement`.
Spec: "an EXPLICIT, per-symbol allowlist of any surviving marker-fabricating fixture
helper — a deliberate, reviewed entry, **never invisible debt**."
Implementation (`fit-43-no-ceiling-regrowth.test.ts:34-43`): `realTestHelperFiles()` filters
out **all** `*.test.ts` files and `test/fixtures/red/**` before scanning, and passes an
EMPTY allowlist. The one surviving fabricator — `run-boundary.test.ts:41`'s deliberate
positive-control plant — is therefore silenced by *class*, not by a reviewed entry. A future
marker-fabricating helper defined inside any `.test.ts` regrows undetected: precisely the
"invisible debt" the clause was written to prevent. The exclusion is documented in-code with
a rationale, so this is a considered narrowing, not an oversight — but it does not implement
the clause as signed. **Fix suggestion**: keep the `test/fixtures/red/**` exclusion (every
fitness scan does that), drop the `*.test.ts` exclusion, and add
`test/scaffold/run-boundary.test.ts#<enclosing>` as the single explicit allowlist entry.

**W-4 — Archive-sync debt that will turn the suite RED if the ledgered edits do not land in
the same commit as the spec sync.** `outcome_relevance: improvement` (rollout).
`fit-26-report-hygiene-citations.test.ts:90-92` asserts the main
`openspec/specs/scenario-matrix/spec.md` table has exactly **21** rows. The signed delta
pins **20** (M-17 no-existence-oracle deleted, M-18…M-21 renumbered). The corpus was already
renumbered in-change (20 `m-*` transcripts, `SCENARIOS` = 20), so the moment
`sdd-archive` syncs the delta into the main spec, `fit-26` goes red unless its row-count
edit — plus the new REQ-SCM-01.1 / REQ-SCM-02.1 / REQ-GCC-08.1 assertions — land in the
**same** commit. This is correctly ledgered in `slices.md` § "Excluded from Slices", along
with `fit-43` clause (e)'s real-tree `openspec/specs/` sweep (~16 live hits today) and the
`folder-scaffold` main-spec Purpose amendment. Flagged here so archive treats it as a
same-commit obligation, not a followup.

**W-5 — `openspec/sensitive-areas.md` still carries no row for the package-local read /
containment domain.** `outcome_relevance: improvement`.
Re-checked: the only row is the `.raw()`/dialect-execution one. `triage.md` flagged this gap
and recommended promoting a row at archive; the change did not add one. Given this cycle
*retired* a security control and published an accepted residual, a registry row naming
`src/scaffold/path-guards.ts` + `src/core/context.ts` with the ADR-0077 posture is the
natural close. Route to `sdd-archive`'s registry-promotion step.

### SUGGESTION (nice to have)

**S-1 — `fit-04`'s kit-internal pair depends on a manually-regenerated, gitignored `dist/`.**
`test/fitness/fit-04-dts-semver-gate.test.ts` reads `dist/core/context.d.ts`; `dist/` is
gitignored and produced only by an out-of-band `bun run build`. Against a **stale** `dist`
the removal-only comparison passes vacuously. Verified fresh for this run (built 07:56,
after `8c3828a` at 07:51), and the positive shape is guarded independently by `fit-43`
clause (c) and the runtime pin, so this is robustness, not a hole. The in-code comment
already documents the manual regen procedure.

**S-2 — `walk.ts` retains a superseded comment paragraph.** The simplify pass added a doc
block for `withOptionalLocator` but left the pre-existing paragraph immediately above it
("…a caller that omits it (only the direct-unit-test callers in walk.test.ts do) falls back
to a locator-free phrasing…"), which the new helper's own doc now restates. Cosmetic.

**S-3 — `test/docs/quickstart-docs.test.ts` REQ-AOD-11 spawns a real `tsc` subprocess under
bun's default 5s timeout.** Pre-existing, untouched by this change, and it did not fire on
either of my uncontended runs — but it will keep producing false-negative flakes in any
loaded `--mode=final` run. Raising that test's own timeout is a cheap, isolated fix. Already
logged in `verify-in-loop-7`.

**S-4 — ADR-0077 is already marked `Status: Accepted`** with the parenthetical
"(2026-07-28, `inline-collection-marker` archive)" while the change is still pre-archive.
Self-documenting, but strictly the promotion is `sdd-archive`'s to make.

### IMPROVEMENTS (real, not blocking this problem)
Covered by W-1 through W-5 and S-1 through S-4 above — all routed to
`project/pending-changes` rather than to a fix loop.

---

## Followups (for `sdd-archive` to register)

| # | Item | Route |
|---|---|---|
| F-1 | Add the missing per-verb integration legs for REQ-IPF-01.2/.6 and REQ-PSH-01.1/02.2/02.4/03.1, **or** amend the spec's ×3-verb phrasing to name the structural substitute (`fit-45` call-site pin) it relies on | `project/pending-changes` |
| F-2 | Add the zero-stat/read assertion at the `templateFile` and `copyIn` verb boundaries (REQ-IPF-01.1) | `project/pending-changes` |
| F-3 | Re-implement `fit-43` clause (d) as the spec's per-symbol allowlist; drop the blanket `*.test.ts` exclusion | `project/pending-changes` |
| F-4 | **Same-commit archive obligation** (not a deferrable followup): `fit-26` row-count 21→20 + REQ-SCM-01.1/REQ-SCM-02.1/REQ-GCC-08.1 assertions + `fit-43` clause (e) real-tree sweep + `folder-scaffold` main-spec Purpose amendment | `sdd-archive`, spec-sync commit |
| F-5 | Promote a `sensitive-areas.md` row for the package-local read / containment domain (ADR-0077 posture) | `sdd-archive` registry step |
| F-6 | Raise `test/docs/quickstart-docs.test.ts` REQ-AOD-11's per-test timeout (pre-existing flake) | `project/pending-changes` |
| F-7 | Remove the superseded comment paragraph above `withOptionalLocator` in `walk.ts` | `project/pending-changes` |

---

## Fix Plan

Not applicable — verdict is not `fail`. No gating findings; nothing is routed into a fix
loop.

---

## Verdict

**pass-with-followups** — the change is implementation-complete, behaviourally correct
against its signed spec, and green on two independent full-suite runs plus a clean
typecheck. Seven followups are registered; four spec scenarios are deliberately deferred to
the archive-sync commit and are ledgered as such. `adversarial_review: required` — this
change deletes a self-declared security boundary on a public package, and the blind pass
should run before archive.
