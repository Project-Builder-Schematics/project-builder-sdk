# S-002+S-004 batch, iteration 1

## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: S-002 (package-root containment, hardened), S-004 (batch-cap chunked flush)
**Batch**: `git diff 2e08cdb..HEAD` — `6fa8c5f` (S-002), `e388c71` (S-004), `1132b84` (chore/apply-progress)
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

Real execution evidence (all run by the verifier, not taken from apply-progress claims):

- `bun test`: **963 pass / 0 fail**, 117 files (reproduced).
- `tsc --noEmit`: **clean** (reproduced).
- `bun test test/fitness/`: **238/238 pass** (FIT-01/04/12/14/16 etc., reproduced) — confirms the two regenerated fitness baselines are internally consistent with the built output.
- Tasks in scope: S-002 4/4, S-004 2/2 — all marked `[x]`, all verified present in the diff.

One CRITICAL implementation bug found via independent adversarial testing (not present in the executor's own suite). Routing: **LOCAL** — fixable by the Executor in the next `/build` iteration; does not require replan/re-spec/human escalation. Iteration 1 of 3 used.

---

## CRITICAL (blocking) — must fix before next iteration

### 1. Lexical/real space-mixing bug in the broken-symlink absolute-target branch — `src/scaffold/containment.ts:96-105`, surfacing at `containment.ts:174`

`resolveBrokenSymlinkTargetLexically` (lines 88-105) has two branches. The **relative-target** branch correctly realpaths its parent (`realpathSync(dirname(symlinkAbsPath))`, line 103) before joining — consistent with the module's own documented invariant ("Two ceiling REPRESENTATIONS... never mixing the two spaces in one comparison", lines 120-128). The **absolute-target** branch (lines 98-99) does not:

```ts
if (isAbsolute(target)) {
  return resolve(target);   // LEXICAL — never realpath'd
}
```

This lexical value is then compared, at line 174, against `realCeiling` — a **realpath'd** value:

```ts
if (!isWithinCeiling(resolvedLexically, realCeiling)) {
```

On any platform/mount where the ceiling's lexical and real forms differ (macOS's `/var`→`/private/var`, the exact class of bug the executor already found and fixed for the *main* flow this same slice — see apply-progress.md "Bug found and fixed during S-002" — but missed here), this comparison is invalid.

**Reproduced independently** (fixture built by the verifier, not the executor's suite):

```
base/pkg/                         <- ceiling, created via mkdtempSync(tmpdir()) → /var/folders/...
base/pkg/broken-inside.txt        <- symlink, ABSOLUTE target = base/pkg/sub/never-created.txt
                                      (target does not exist, but IS lexically inside the ceiling)
```

Expected (per the module's own inline comment, line 157, and the "in-ceiling ⇒ source-not-found" contract): `source-not-found`.
Actual: `source-outside-package`.

```
Expected: "source-not-found"
Received: "source-outside-package"
```

Root cause confirmed via direct inspection (`bun run` debug script): `realpathSync(ceiling)` = `/private/var/folders/.../pkg`, but `resolve(target)` (the broken symlink's raw absolute target text) = `/var/folders/.../pkg/sub/never-created.txt` — two different string spaces being compared.

**Why this is CRITICAL, not advisory**: this is inside S-002's own contracted scope (`containment.ts`, the REQ-PRC-07.2/S1 ENOENT-ordering domain), it violates the module's own documented invariant, and it's the *same bug class* the executor already had to fix once in this slice — meaning the risk pattern was known but this one remaining branch wasn't audited for it. The **observed** direction is a false-reject (safe: nothing is read either way, both `source-outside-package` and `source-not-found` are rejections) — this is not a demonstrated data-exposure bypass. But space-mixing bugs in containment logic are exactly the defect class from which false-*accepts* emerge under a different input shape; I could not construct a concrete false-accept PoC in the time available (a package living at a literal, non-symlinked path never triggers this branch's bug at all, since lexical==real there), so I am not claiming a proven bypass — but the sensitivity classification of this domain (security: input validation/containment, flagged in spec's own Sensitive Areas Coverage table) warrants treating an untested, invariant-violating branch as blocking rather than advisory.

**Suggested fix**: realpath the absolute-target case the same way the relative-target branch already does — e.g. route it through `nearestExistingAncestorRealpath` on `dirname(target)`, or explicitly realpath the nearest existing ancestor of `target` itself, so the result being compared against `realCeiling` is always in real-space. Add a regression test with the exact fixture above (in-ceiling broken symlink via an ABSOLUTE target) — this positive-control case was absent from `containment.test.ts` (only the *outside*-ceiling absolute-target case is tested, REQ-PRC-07.2, which happens to pass regardless of this bug because the "outside" fixture uses an unrelated random tmpdir that never shares a prefix with `realCeiling` in either space).

---

## Deviation #1 ruling (mandatory) — `readTemplateFile` / `create({templateFile})` containment

**Executor's claim** (apply-progress.md, "Deviations from Design (S-002)", item 2): `readTemplateFile` was deliberately not routed through `validateSourceContainment`, because S-002.1's task line scopes the replacement to "S-001.3's placeholder guard inside classify-transport" specifically, and design's Test Derivation table assigns every PRC-04 scenario to `test/scaffold/containment.test.ts` only. The executor flagged this explicitly rather than silently deciding.

**Verified independently, two ways:**

1. **Spec/design reading** (`openspec/changes/schematic-local-files/specs/package-root-containment/spec.md`, `design.md` Test Derivation table): No REQ-PRC-04 through REQ-PRC-09 *scenario* (the testable Given/When/Then blocks) names `create({templateFile})` as its subject — every one uses `copyIn(...)` or generic "scaffolded"/"source path" phrasing. Only REQ-PRC-03.1 explicitly names `create({templateFile})`, and that scenario is about **ceiling derivation** (missing `collection.json` ancestor → fail loud), which is implemented correctly at the `defineFactory`/`RunContext` level (S-000) and is unaffected by this gap. Design's own Test Derivation table (lines 249-257) assigns every PRC-04..09 row exclusively to `containment.test.ts`, never to `index.test.ts` or an e2e file. So: **by the letter of the signed REQ/scenario set, S-002's coverage commitment does not require `readTemplateFile` containment** — the executor's scoping is correct and the deviation was flagged honestly, not smuggled.
2. **Live exploit, constructed independently**: called `readTemplateFile` through a real `defineFactory` run with a `relPath` escaping via `../../../` to a file living entirely outside `packageRoot` (not just outside `packageDir` — verified the escape crosses the true containment ceiling, not merely the resolution anchor, which REQ-PRC-01 explicitly permits crossing). Result: the file was read and its content returned with **zero rejection**:

```
observedContent: TOP SECRET OUTSIDE THE CEILING
observedError: undefined
```

**Ruling: ADVISORY, not blocking for S-002/S-004's own pass/fail** — per the REQ-backing test given in my brief (REQ-backed → blocking; Purpose-prose-only → advisory), this is Purpose-prose only. `package-root-containment/spec.md`'s Purpose section explicitly names `create({templateFile})` as one of three protected surfaces ("keeps `scaffold`/`copyIn`/`create({templateFile})` from reading or writing outside the schematic package's own boundary") but no REQ/scenario operationalizes that for this slice.

**This must not silently vanish.** Two additional findings sharpen the urgency:

- This is a **live, exploitable arbitrary-host-file-read primitive** in already-shipped code, on the exact surface this whole L-classified change exists to protect.
- The regenerated `.d.ts` baseline's own JSDoc (`test/fitness/dts-baseline/core.authoring-error.d.ts`, new comment added in this batch) now says the four `source-*` reasons cover *"the SDK's own pre-emit read/stat of a package-local source for `scaffold`/`copyIn`/`create({templateFile})`"* — this is **doc drift**: it asserts protection for `create({templateFile})` that does not exist in the implementation. Minor on its own, but it compounds the risk of this gap going unnoticed by a future reader of the public `.d.ts` surface.

**Recommended routing**: register as a mandatory follow-up before this change archives — either (a) a small dedicated slice/task closing the gap (route `readTemplateFile` through `validateSourceContainment`, or an equivalent), inserted before S-005, or (b) fold explicitly into S-005's scope (already the coverage-tail slice). Do **not** let `/evaluate` or `sdd-archive` proceed with this open unless there is an explicit, recorded human override (e.g. an `outcome-override`-style entry) acknowledging the Purpose-section gap — the steward reckoning gate exists precisely to catch "tests pass but the stated purpose isn't met."

---

## WARNING (non-blocking, should fix)

| # | Finding | File:Line | Detail |
|---|---|---|---|
| W1 | No "TDD Cycle Evidence" table for S-002 or S-004 in apply-progress.md | `openspec/changes/schematic-local-files/apply-progress.md` (S-002/S-004 sections) | S-000 has a detailed table; S-001 has a narrative "RED evidence method" note; S-002/S-004 have neither. Both commits (`6fa8c5f`, `e388c71`) land test+prod files together, so commit order cannot establish RED-first either way (same caveat S-000 already self-flagged). Tests exist, pass, and triangulate correctly — this is a documentation-trail gap, not a functional defect — but should be closed before final verify given Strict TDD is enabled project-wide. |
| W2 | `isWithinCeiling`'s case-fold branch has zero dedicated test coverage | `src/scaffold/containment.ts:45-51`; `test/scaffold/containment.test.ts` | No test in the executor's own suite exercises a case-mismatched candidate/ceiling pair. Verified independently that the fold logic IS currently correct on darwin, but a Q24 product-ruled, security-relevant branch has no regression protection. |
| W3 | `expect(fn).not.toThrow()` as the sole assertion | `test/scaffold/containment.test.ts:257-259` | Technically a banned Strict-TDD pattern. Mitigated: `validateDestinationLexical` is void/side-effect-free, so throw-or-not genuinely is its entire success-path contract — flagging per policy rather than silently waiving. |

---

## Independent adversarial verification performed (all constructed fresh by the verifier)

| Scenario | Result |
|---|---|
| Symlink pointing outside the ceiling (deterministic sibling dirs, not reused from executor's fixtures) | ✅ correctly rejects `source-outside-package` |
| Prefix-collision sibling dir (`/pkg-evil` vs `/pkg`), both at `isWithinCeiling` unit level and end-to-end via a live symlink through a sibling sharing a literal string prefix | ✅ correctly rejects — segment-aware, not bare `startsWith` |
| Case-fold pair (darwin), positive direction | ✅ `isWithinCeiling` folds correctly (see W2 for the coverage gap) |
| Broken symlink, PRC-07.2 oracle-killer, target genuinely outside ceiling | ✅ correctly rejects `source-outside-package`, never `source-not-found` |
| Broken symlink, target lexically/would-be inside ceiling (positive control) | ❌ **CRITICAL bug found** — see above |
| macOS `/var`↔`/private/var` double representation, main flow | ✅ holds (the executor's earlier fix for the main flow is correct; only the broken-symlink absolute-target sub-branch was missed) |
| REQ-05 run-level atomicity, using a **non-collision** rejection cause (genuine over-cap SIZE rejection on a chunk *after* an earlier chunk already flushed successfully) — deliberately different from the executor's own collision-based fixture | ✅ `result.tree.size === 0`; discard() clears all staged chunks regardless of rejection cause |
| S-004 sync/async `DialectRegistry` bridge reasoning (apply-progress.md's own explanation) | ✅ verified against actual `context.ts`/`session.ts`/`expander.ts` source — the described mechanism (unawaited `flush()` fired synchronously up to its own `await`, registered as a dialect `settle()`, drained before `commit()`) is accurate |
| `readTemplateFile` containment | ❌ **confirmed gap** — see Deviation #1 ruling above |
| Regenerated `.d.ts` / `pkg-surface-baseline.json` | ✅ additive-only, matches exactly the new `AuthoringReason` 4-member growth and the new `containment.ts` leaf module — no smuggled API surface (aside from the doc-accuracy issue noted in Deviation #1) |

---

### Orchestrator action

Route the CRITICAL finding as **LOCAL** — re-invoke `/build` (SDD-light) targeting `src/scaffold/containment.ts`'s `resolveBrokenSymlinkTargetLexically` absolute-target branch, plus a regression test for the in-ceiling-broken-symlink-via-absolute-target case. Surface the Deviation #1 ruling to the human/Planner for explicit routing decision (new slice vs fold into S-005) — do not let it default-vanish. W1-W3 may ride along in the same fix pass or be deferred to final verify at the orchestrator's discretion. Iteration 1 of 3 used.
