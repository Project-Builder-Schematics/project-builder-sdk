# Verify In-Loop Result

**Change**: stage-5-first-dialect
**Iteration**: 4/3 (final slice — last in-loop pass before /evaluate)
**Scope**: S-005 (Authoring Docs, SECURITY Guard, Sensitive-Areas Promotion)
**Mode**: in-loop (Strict TDD)
**Delta reviewed**: `git diff 33b29f4..HEAD` (commits `cb94b90` + `9dc63b2`)

---

### Verdict: PASS (with followups carried forward, non-blocking)

All S-005 scope checks green. Loop can exit — this was the last slice.

- Tasks in scope complete: 4/4 (slices.md checkboxes match reality)
- Real `bun test`: **758 pass / 0 fail** (matches the expected delta, 746 → 758, +12 —
  exactly `security-authoring-guard.test.ts`'s case count)
- `bunx tsc --noEmit`: clean, exit 0
- `test/docs/security-authoring-guard.test.ts` run in isolation: 12/12 pass
- Spec compliance for scope: 6/6 scenarios (DAS-01.1/.2/.3, DAS-02.1, STD-01, TSD-06.2) —
  all COMPLIANT, real assertions, real execution evidence (see matrix below)
- Assertion audit: clean — every guard assertion is exact-substring or section-scoped, no
  count-only or tautological check found

Orchestrator action: exit loop, proceed to `/evaluate` (`sdd-verify --mode=final`). Two
pre-existing WARNING findings (spec-text drift on REQ-FPS-02 and REQ-FIT-01, carried
unchanged since iterations 1-2, S-005 does not touch that scope) remain **unresolved** and
must be reconciled before archive — final verify should re-surface them, they are not new
to this batch and not this batch's responsibility to close.

---

## Execution Evidence (real, run by this verify pass)

| Check | Result |
|---|---|
| `bun test` (full suite) | 758 pass / 0 fail / 1335 expect() calls, 95 files, 8.89s |
| `bunx tsc --noEmit` | clean, exit 0 |
| `bun test test/docs/security-authoring-guard.test.ts` | 12 pass / 0 fail |
| Mutate-and-restore: stripped `--provenance` from `.github/workflows/publish.yml`, re-ran the guard | `REQ-TSD-06.2` test failed RED exactly as expected (`expect(received).toContain("--provenance")` — received the mutated content with the flag stripped); file restored via `cp` from backup, confirmed `git diff --stat` clean afterward, guard back to 12/12 |
| Byte-exact diff: design.md §4.4b's 3 frozen quoted strings vs. the test file's 3 frozen `const`s | Programmatic extraction + `===` comparison (Node script) — **all 3 match exactly**, no drift |
| Byte-exact diff: frozen strings vs. actual `SECURITY.md` / `docs/authoring-a-dialect.md` content | Verified via the guard test's own `.toContain()` assertions passing (12/12) — code existing was independently confirmed by direct file read, not just test-passing |

---

## Spec Compliance Matrix (scope: S-005)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-DAS-01.1 | doc names exactly the shipped API | `security-authoring-guard.test.ts` "names every shipped kit verb..." + "never names unshipped surface" | ✅ COMPLIANT — verified independently: `find` is the only export of `src/dialects/typescript/index.ts`; `defineDialect`/`defineOpPack`/`withOps` are real exports of `src/core/define-dialect.ts`; `addImport(name, from)` matches the real op signature (internal `Op<Ast>` shape binds `ast` first, chain exposes `(name, from)`); no unshipped name (`removeImport`, second dialect, collision diagnostic, postcss) found in the doc |
| REQ-DAS-01.2 | two-realms hazard section present, guard-asserted | `security-authoring-guard.test.ts` "REQ-DAS-01.2" describe (2 tests) | ✅ COMPLIANT — string byte-identical to design §4.4b, present verbatim in `docs/authoring-a-dialect.md` under "### Two ts-morph realms" |
| REQ-DAS-01.3 | Async usage section present, guard-asserted | `security-authoring-guard.test.ts` "REQ-DAS-01.3" describe (2 tests) | ✅ COMPLIANT — section present, names both the awaited-chain form and the forgotten-await join |
| REQ-DAS-02.1 | contributor section has no author-style demo | `security-authoring-guard.test.ts` "REQ-DAS-02.1" describe | ✅ COMPLIANT — confirmed by direct read of `docs/authoring-a-dialect.md` "### For contributors" section: zero fenced code blocks, names `testDialect`/`testOpPack`/`expectTypeOf` as verification anchors only |
| REQ-STD-01 | SECURITY.md carries both trust sentences + caveat, guard-asserted, RED if removed | `security-authoring-guard.test.ts` "REQ-STD-01" describe (4 tests incl. regression proof) | ✅ COMPLIANT — general sentence untouched, `.raw()`-specific sentence + "conformance ≠ safety" caveat added verbatim, byte-identical to design §4.4b |
| REQ-TSD-06.2 | publish workflow retains `--provenance` for the ts-morph-carrying release | `security-authoring-guard.test.ts` "REQ-TSD-06.2" describe | ✅ COMPLIANT — real-execution mutate-and-restore confirms the guard reads the actual `.github/workflows/publish.yml` and fails RED if the flag is removed, not a static/vacuous check |

Sensitive-areas promotion (slices.md task 4, no dedicated test per its own text): verified
directly — `openspec/sensitive-areas.md` rows "security (code execution)" and "security
(third-party trust)" now name concrete paths (`src/dialects/typescript/**`,
`src/core/dialect-handle.ts`, `package.json#dependencies`) at confidence `medium` (up from
`low`), matching design §4.8. Diff confirmed no scope creep beyond these two rows.

---

## Ruling on the logged judgment call (apply-progress.md, "Deviations From Plan")

**Question posed**: apply-progress claims "the two SECURITY.md frozen sentences are NOT
repeated verbatim inside `docs/authoring-a-dialect.md`... only the two-realms hazard
paragraph is doc-side frozen." Does design §4.4b sanction cross-referencing instead of
repeating, or does a spec scenario demand both files carry the strings?

**Finding: the claim is half-right, half-inaccurate.**

1. **The `.raw()` trust sentence (`RAW_TRUST_SENTENCE`)** genuinely is NOT repeated in the
   doc — the doc instead carries its own distinct sentence ("`.raw()` executes your callback
   with full process privilege — it is not a sandbox. Read SECURITY.md before importing...")
   plus a markdown link to `SECURITY.md`. This is exactly what REQ-DAS-01's own text
   prescribes: "the `.raw()` escape hatch and its explicit-trust posture (**cross-referencing**
   SECURITY.md's REQ-STD-01 sentence)" — cross-reference, not verbatim repetition, is the
   spec-sanctioned reading for this one string. Design §4.4b's own bullet list labels this
   string "SECURITY.md `.raw()` sentence" with no doc-side tag (unlike the two-realms bullet,
   which is explicitly tagged "(docs/authoring-a-dialect.md)") — consistent with this string
   belonging to SECURITY.md alone. **Ruling: SANCTIONED.**

2. **The "conformance ≠ safety" caveat (`CONFORMANCE_NOT_SAFETY_CAVEAT`)** — contrary to
   apply-progress's claim that "only the two-realms hazard paragraph is doc-side frozen," this
   string IS present byte-for-byte in BOTH files: `SECURITY.md` line 38 and
   `docs/authoring-a-dialect.md` line 117 ("## Testing with the conformance kit" section) are
   identical, confirmed by direct read and string comparison. No spec scenario *requires* it in
   the doc (only REQ-STD-01/SECURITY.md), and no constraint *forbids* the extra copy either —
   constraint 4 only demands byte-for-byte landing (satisfied in both places) and "no
   apply-time paraphrasing" (satisfied — it's identical, not paraphrased). Functionally
   harmless: the guard test only asserts this string against `security()`, not `doc()`, so the
   doc's copy is unguarded but was independently verified accurate by this pass. **Ruling:
   the duplication itself is not a spec violation, but apply-progress's own stated rationale
   ("This keeps one frozen string in exactly one file, avoiding a second copy that could
   silently drift") is factually wrong for this string — there IS a second copy.** This is a
   self-report accuracy issue, not an implementation defect.

**Net**: no REQ/constraint violation. Recorded as a WARNING for self-report accuracy only —
see Findings.

---

## Findings

### Finding 1 — WARNING (routing: LOCAL/documentation, non-blocking)

**File**: `openspec/changes/stage-5-first-dialect/apply-progress.md` (Batch 4 "Deviations
From Plan" section)

apply-progress states "the two SECURITY.md frozen sentences are NOT repeated verbatim inside
`docs/authoring-a-dialect.md`... only the two-realms hazard paragraph is doc-side frozen."
This is inaccurate: the "conformance ≠ safety" caveat is present verbatim in BOTH
`SECURITY.md` (line 38) and `docs/authoring-a-dialect.md` (line 117). Only the `.raw()` trust
sentence is genuinely SECURITY.md-only (cross-referenced, not repeated, in the doc). The
actual implementation is spec-compliant (see Ruling above) — this finding is about the
artefact's self-description, not a code or test defect. Recommend a one-line correction at
the next opportunistic touch of apply-progress.md; does not block this iteration or final
verify.

### Finding 2 — WARNING (routing: SPEC, non-blocking, carried forward unchanged from iteration 2, NOT closed by this batch)

REQ-FPS-02's signed spec text ("exactly FOUR entries... no more, no less") is stale against
the correct, shipped 5-entry exports map (`./testing` landed independently via
`stage-4b-testing-harness`). S-005 does not touch this area. Still unresolved — must be
reconciled (spec micro-unfreeze) before final verify/archive, since S-005 was the last slice
and there is no further batch to pick it up opportunistically.

### Finding 3 — WARNING (routing: SPEC, non-blocking, carried forward unchanged from iteration 1, NOT closed by this batch)

REQ-FIT-01's spec text is stale relative to the ratified S-000 transitive-walk semantics
ruling (verify-plan-5 amendment). S-005 does not touch this area. Still unresolved — must be
reconciled before final verify/archive, same reasoning as Finding 2.

### Finding 4 — SUGGESTION (non-blocking, carried forward unchanged from iteration 3, NOT closed by this batch)

`apply-progress.md`'s S-003 TDD Cycle Evidence table row for TSD-03.7 says "GENUINELY NEW
assertion (not characterization)" while the corresponding `slices.md` task checkbox is tagged
`[characterization]`. Internally inconsistent, individually defensible either way (see
verify-in-loop-3's ruling). Recommend a one-line reconciliation at the next opportunistic
touch of either file — does not block final verify.

---

## Deviations From Plan (apply-progress.md) — Judged

| # | Deviation | Judgment |
|---|---|---|
| a | `.raw()` trust sentence cross-referenced (not repeated) in the doc; "conformance ≠ safety" caveat characterized as doc-absent when it is actually doc-present | Cross-reference reading SANCTIONED by REQ-DAS-01's own text; self-report accuracy issue on the caveat claim — see Finding 1, non-blocking |

---

## Artifacts Persisted

| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-4 | hybrid | `sdd/stage-5-first-dialect/verify-in-loop-4` (engram) + `openspec/changes/stage-5-first-dialect/verify-in-loop-4.md` |

## Risks

- Findings 2/3 (spec-text drift on REQ-FPS-02 / REQ-FIT-01) are now unresolved with no
  further in-loop batch to opportunistically absorb them — final verify (`sdd-verify
  --mode=final`) must explicitly reconcile or explicitly accept-as-followup before archive.

## Next Recommended

`/evaluate` (`sdd-verify --mode=final`) — S-005 was the last slice; all 6 slices (S-000..S-005)
are now complete per slices.md's own checkboxes, 758/758 suite green, `tsc` clean. Final verify
should carry Findings 2/3 into its own compliance matrix and either close them via spec
micro-unfreeze or register them as archive followups.

## Skill Resolution

none (skill registry present-and-empty per session bundle)
