## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Slice**: S-003 — Resolution-Based Path Verdicts (bundler disjointness)
**Iteration**: 1/3 (this slice)
**Scope**: S-003 (commits `13fbe93`, `169282e`, `613aba3`, `13bbaeb` over `5483d88`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All 6 mandatory checks confirmed. No CRITICAL or blocking findings.

### 1. Real execution evidence (independently re-run)

- `bun test` (full suite), run A: **2523 pass, 0 fail**, 5609 `expect()` calls, 202 files,
  72.96s. Matches apply-progress's claimed slice-close count exactly (2523/0).
- `bun test`, an intermediate run during mutation testing showed 6 transient failures
  (2517/2523) with `git status --porcelain` confirmed clean at the time — re-ran
  immediately after: **2523 pass, 0 fail** again, 5609 expects, 71.86s. Same class of
  environmental resource-contention flakiness this sandbox has shown on every prior slice's
  verify pass (S-000, S-001) — not a code regression (tree was clean, no fixture/production
  change was in flight).
- `tsc --noEmit --pretty false`: clean, zero errors, confirmed twice (no incremental cache
  present).
- **Byte-neutrality, independent**: `rm -rf dist && bun run build` →
  `dist/runner-manifest.json` sha256 = `31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde`
  — **exact match** to the pinned/re-pinned digest, unchanged from S-001's close. Expected
  and confirmed: S-003 touches only `scripts/bundler-disjointness.ts`,
  `test/support/closure-integrity-checks.ts`, and test files — zero `src/**` diff.

### 2. Red-proof genuineness — judging the "retired-logic probe" pattern + 2 empirical spot-checks

**Judgment on the pattern itself**: apply-progress's evidence table reproduces the RETIRED
`normaliseForComparison`/`oldCollides` logic in throwaway probes (not committed) to show the
OLD code returns the wrong verdict for each escaping spelling, then relies on the CURRENT
(new-mechanism) test being green. This is a valid genuineness argument ONLY IF the current
test would actually fail without the new code — a probe of dead code proves the old bug
existed, but says nothing on its own about whether the new test is wired to the new fix or
could pass some other way (e.g. a fixture that happens to already satisfy a trivial
assertion). The task requires closing that gap empirically. Sampled 4 of 5 spelling
scenarios plus both PTH-01.5/.7:

| Scenario | Judgment | Method |
|---|---|---|
| PTH-01.1 (`.//dist/transport`) | Sound, not independently mutated | Relies on `posix.resolve`'s standard slash-normalisation — no bespoke branch exists to isolate; the fix is a corollary of switching to a trusted Node stdlib primitive, not custom logic this change wrote. Read `resolveAgainstAnchor`/`collides` — no special-casing for double slashes exists, confirming the double-slash handling is NOT hand-rolled (and thus not a plausible source of a hidden bug the retired-logic probe alone might miss). |
| PTH-01.2 (`--outdir .`) | **Empirically confirmed genuine** | Mutated `resolveAgainstAnchor` in the real `scripts/bundler-disjointness.ts` to special-case `path === "."` back to the literal unresolved string (reproducing the retired mechanism's total-root skip bug). Ran the two affected test files: **exactly** `REQ-PTH-01.2 [red-proof]` failed, AND (bonus corroboration) `FIT-PATH-SPELLING-INVARIANCE`'s own cross-product test independently caught the same divergence. Reverted via `git checkout --`; `git status --porcelain` clean before and after. |
| PTH-01.3 (`-odist/transport/runner.js`) | **Empirically confirmed genuine** | Disabled the concatenated-short-flag branch in `classifyToken` (`if (false && token.startsWith("-o") && token.length > 2)`, reproducing the retired mechanism's "never parsed at all" bug). Ran the two affected test files: **exactly** `REQ-PTH-01.3 [red-proof]` failed, nothing else. Reverted; tree confirmed clean. |
| PTH-01.4 (`../dist/transport`) | Sound, not independently mutated | Same reasoning as PTH-01.1 — relies on `posix.resolve`'s standard `..`-clamping-at-anchor behaviour, no bespoke branch to isolate. |
| PTH-01.5 (`--outdir=$VAR`) | Confirmed by code trace | The `value.includes("$")` check in `classifyToken` is load-bearing: removing it mentally, `--outdir=$VAR` would fall through to the ordinary `{kind:"target", ...}` branch, and `findBundlerTargets(scripts)` would return a target entry instead of `[]` — the test's own `expect(findBundlerTargets(scripts)).toEqual([])` assertion would then genuinely fail. Not empirically re-run (2 live mutations already satisfy the "at least 2" requirement; this one's load-bearing role is unambiguous from a direct read, no old-code precedent to reproduce since the retired mechanism had no undecidability concept at all — apply-progress's own honest framing). |
| PTH-01.7 (`--out-dir`) + `--minify` sibling | Confirmed by code trace + existing companion test | See check 4 below. |

Both empirical mutations are exactly the two scenarios with bespoke, hand-rolled logic
(the total-root skip-guard analogue and the concatenated-short-flag parser) — the two
scenarios that rest purely on `posix.resolve`'s standard semantics (.1/.4) are lower-risk
by construction (inherited correctness from a trusted, heavily-used Node stdlib function,
not custom code this change wrote) and were judged by code inspection rather than
mutation. **Overall: the pattern is sound for this slice, and the 2 highest-risk (custom
logic) scenarios are empirically confirmed non-vacuous.**

### 3. FIT-PATH-SPELLING-INVARIANCE — cross-product size + oracle independence

**Cross-product**: `FLAGS` (3: `--outdir`, `--outfile`, `-o`) × `PATH_SPELLINGS` (9,
spanning every escaping class: clean, `./`-prefixed, double-slash, trailing-slash,
`../`-parent, bare `.`, file-targeting variants, and the legitimate
`dist/bin/pbuilder-codegen.js` non-collision case) × `CLOSURE_PATHS` (2) = **54
combinations**, confirmed by direct read of the test (`fit-42-*.test.ts:1047-1097`) —
matches apply-progress's claimed 54 exactly.

**Oracle independence, verified genuine**: `groundTruthCollides` (the oracle) and
production's `collides()` both call `posix.resolve` as their initial resolution step —
but the COMPARISON ALGORITHM differs structurally: production uses prefix-string
`startsWith`/exact-equality on the resolved strings; the oracle uses `posix.relative`
between the two resolved paths and inspects the SIGN of the result (empty string = exact
match; doesn't start with `".."` and isn't absolute = contained). A bug in the
prefix/`startsWith` logic (e.g. an off-by-one on the trailing-slash boundary, or a missed
edge case in how the `/` suffix is appended) would not be mirrored by a bug in the
relative-path sign-analysis, because the two algorithms have no shared implementation
beyond the trusted `posix.resolve` primitive itself. This matches the file's own comment
("the INDEPENDENCE that matters is the comparison ALGORITHM, not the underlying
path-resolution primitive") and the same "two independently-implemented checks must
agree" shape as `FIT-CAP-TOTALITY`. The companion red-proof
(`REQ-PTH-01 [red-proof]: the oracle itself is not vacuous`) proves the oracle can
actually return `false` for a genuinely non-colliding pair. **Confirmed genuinely
independent, not the same function called twice.**

### 4. PTH-01.5/.7 unclassifiable-construct shape-discrimination

Confirmed both required tests exist and are structurally sound
(`fit-42-*.negative.test.ts:1554-1571`):
- `REQ-PTH-01.7 [red-proof]`: `--out-dir` (output-flag-shaped, unrecognised spelling) →
  `findBundlerTargets` returns `[]` (never silently misread as `--outdir`) AND
  `findUnclassifiableBundlerConstructs` reports it — never silent.
- `REQ-PTH-01.7` scope-limit sibling: `--minify --outfile dist/bin/codegen.js` →
  `findUnclassifiableBundlerConstructs` returns `[]` for the `--minify` token (correctly
  NOT flagged) while `--outfile` is still correctly extracted as a target.

Code trace of `classifyToken`'s shape gate: `token.startsWith("--out") &&
!RECOGNISED_LONG.includes(token)` — `"--minify".startsWith("--out")` is `false`, so
`--minify` correctly falls through to `return undefined` (neither a target nor
unclassifiable) rather than being blanket-flagged. The gate is narrowly scoped to the
`--out`/`-o` shape family, exactly as REQ-PTH-01.7's scope-limit sentence requires — it
does not flag every unrecognised flag, only ones shaped like an output-directing flag.
**Confirmed: the mechanism discriminates shape, does not blanket-flag.**

### 5. Whole-verbatim compliance

- Re-ran the standing anti-`toContain` scan describe block in isolation
  (`bun test ... -t "standing scan|toContain"`): **6 pass, 0 fail** — unchanged from
  S-001's close, still green after S-003's diff.
- `git diff 5483d88 HEAD -- test/fitness/fit-42-runner-closure-integrity.test.ts
  test/fitness/fit-42-runner-closure-integrity.negative.test.ts | rg "^\+.*toContain"`:
  **zero matches** — no new `toContain` call introduced anywhere in S-003's diff (the two
  pre-existing `toContain` calls in the extended `REQ-BDI-01.1 / REQ-PTH-01.6` test are
  untouched array-membership checks, not new, and not tripwire messages — correctly out of
  the scan's scope). **Confirmed compliant.**

### 6. Baseline — additive-audit, no pre-existing assertion weakened

- `test/fitness/fit-42-runner-closure-integrity.negative.test.ts`: diff is **100% additive**
  — zero removed lines.
- `test/fitness/fit-42-runner-closure-integrity.test.ts`: only 2 removed lines — an import
  statement (`join` → `join, posix`, additive in effect) and one test's title line, replaced
  by a renamed title (`REQ-BDI-01.1` → `REQ-BDI-01.1 / REQ-PTH-01.6`) with its ORIGINAL 4
  assertion lines untouched and exactly ONE new assertion (`findUnclassifiableBundlerConstructs`
  check) appended — confirmed by reading the full diff hunk, not just the stat. No
  assertion weakened, none deleted.
- `test/support/closure-integrity-checks.ts`: the old `normaliseForComparison`,
  `findDisjointnessViolations`, `findBundlerTargets`, `BundlerTarget` implementations are
  deleted and replaced by a re-export of the same-named symbols from the new
  `scripts/bundler-disjointness.ts` — confirmed the public API surface (names, shapes) is
  unchanged, so every pre-existing consumer/test importing from this module is unaffected.
  This is a genuine relocation (ADR-0081, "placement not timing"), not a silent behaviour
  change under the same name.

---

### Issues

None. No CRITICAL, WARNING, or blocking findings for S-003.

### Routing: none — verdict PASS

Orchestrator action: S-003 verified. Proceed per Build Order (S-003 → S-004 sequentially
on the shared `fit-42-*` files, per slices.md's batch-2 sequencing ruling).
