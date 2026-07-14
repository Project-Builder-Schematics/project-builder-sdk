# Verify In-Loop Result

**Change**: stage-6-release-shape
**Iteration**: 3 (change-wide sequence; iteration 1/3 for the S-004 batch — S-000's was verify-in-loop-1, S-001/S-002/S-003's was verify-in-loop-2)
**Scope**: S-004 (Reference docs — verbs, errors, dry-run, index, front-door)
**Mode**: in-loop (Strict TDD)

---

## Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 3/3 (S-004.1/.2/.3, all `[x]` in slices.md rev 3)
- Affected tests: `test/docs/doc-set-content.test.ts` — 10/10 pass (independently re-run)
- Full suite (independent re-run, 2x): **1099 pass / 0 fail** both times — matches apply-progress's claimed count exactly, no regression from the 1089-pass baseline inherited from Run 2
- Typecheck (`bun run typecheck` → `tsc --noEmit`): clean, zero errors
- Lint: not available — no lint script/tool configured in this project (reported cleanly, not a failure)
- Spec compliance for scope: 6/6 clauses (REQ-AOD-03.1, REQ-AOD-04.1, REQ-AOD-05.1, REQ-AOD-06.1, REQ-AOD-06.2, REQ-FPS-06.2) + 2 unlabeled "README front-door" acceptance checks (Council DR-3 filename binding)
- Assertion audit (Strict TDD): clean — no banned patterns, delta test uses only specific `.toContain`/`.toMatch`/`.not.toContain`/`.not.toMatch` assertions
- TDD Cycle Adherence: clean — genuine RED evidence for all three delta tasks

### Completeness (Step 4)

All S-004 tasks marked `[x]` in `slices.md` rev 3. No incomplete tasks in scope.

### Correctness — Static Spec Match (Step 5)

| REQ | Doc file | Evidence |
|---|---|---|
| REQ-AOD-03.1 | `docs/authoring-verbs.md` | Six named verbs (`create`/`modify`/`remove`/`rename`/`move`/`copy`) present, plus `copyIn` (7th, superset). `find().read()` trichotomy (`absent`/`empty`/`present`) documented |
| REQ-AOD-04.1 | `docs/README.md` (+ quickstart, README) | Links `authoring-a-dialect.md`; no `addFunction`/`addClass`/dialect-op vocabulary duplicated anywhere in the new doc set |
| REQ-AOD-05.1 | `docs/authoring-errors.md` | `verb`/`path`/`reason` named; wire-internal class names (`EmitRejection`, `Directive`, `Batch`) and the wire op `delete` absent |
| REQ-AOD-06.1/.2 | `docs/dry-run.md` | Imports `dryRun` from `@pbuilder/sdk/commons` (not a subpath); shows `for (const entry of dryRun())` iteration |
| REQ-FPS-06.2 | `README.md` | States `dist/core/**` ships, documents the `./testing`-imports-`../core/context.ts` rationale, references `exports` |

### Behavioural Compliance Matrix (Step 9, scope-only)

| Requirement | Test | Result |
|---|---|---|
| REQ-AOD-03.1 | `doc-set-content.test.ts::REQ-AOD-03.1` (both) | ✅ COMPLIANT |
| REQ-AOD-04.1 | `doc-set-content.test.ts::REQ-AOD-04.1` | ✅ COMPLIANT |
| REQ-AOD-05.1 | `doc-set-content.test.ts::REQ-AOD-05.1` (both) | ✅ COMPLIANT |
| REQ-AOD-06.1 | `doc-set-content.test.ts::REQ-AOD-06.1` | ✅ COMPLIANT |
| REQ-AOD-06.2 | `doc-set-content.test.ts::REQ-AOD-06.2` | ✅ COMPLIANT |
| REQ-FPS-06.2 | `doc-set-content.test.ts::REQ-FPS-06.2` | ✅ COMPLIANT |

### TDD Cycle Adherence (Step 7, Strict TDD, delta only)

Cross-checked against apply-progress's "TDD Cycle Evidence — S-004" table:

- **S-004.1 (docs missing)**: genuine `ENOENT` thrown before the four doc files existed — verified this is the same established pattern `testing-story-docs.test.ts` uses ("the throw IS the RED evidence"). Accepted.
- **S-004.1 (README front-door)**: genuine `toContain` failures against the unmodified `README.md` — real, not fabricated. Accepted.
- **S-004.1 (wire-term ban helper)**: deliberate injection of `"EmitRejection"` into `authoring-errors.md`, observed real failure, reverted — a genuine triangulation proof that the ban helper's branching (string vs. regex terms) actually fires rather than passing vacuously. Accepted as sufficient triangulation for a small assertion helper (2 call sites: absence case + injection case).
- Regression: full suite stable at 1099/0 across 2 independent re-runs (this session) — no previously-passing test broken.

**Strict TDD verdict**: ok.

### Documented Deviations — Judged

**1. Vocabulary superset (7 verbs / 12 reasons vs. the plan's 6/8) — ACCEPT.**
Independently verified against `src/`:
- `src/core/authoring-error.ts:30` — `AuthoringVerb` is exactly `"create" | "modify" | "remove" | "rename" | "move" | "copy" | "copyIn"` (7 values). `docs/authoring-verbs.md` documents all 7.
- `src/core/authoring-error.ts:64-76` — `AuthoringReason` is exactly the 12 values `docs/authoring-errors.md` lists (`path-collision`, `path-not-found`, `unrepresentable-content`, `changes-too-large`, `outside-run`, `unknown`, `invalid-input`, `reserved-name`, `source-not-found`, `source-outside-package`, `source-not-regular-file`, `source-unreadable`) — exact match, no drift, no omission.
- REQ-AOD-03's Purpose text names six verbs; its own scenario text ("all seven elements are present" = 6 verb names + 1 trichotomy explanation) does not fix a ceiling. Documenting the true current superset is a floor-satisfying, non-scope-creep judgment call, consistent with `slices.md`'s own standing "trust the repo, not this doc" ruling (already invoked once for S-002's `fit-23` rename). No REQ text is contradicted.

**2. Wire-term ban list (`["EmitRejection", "Directive", "Batch", /\bdelete\b/]` — excludes bare `"collision"`) — ACCEPT.**
Verified `src/core/emit-rejection.ts:9` — `EmitRejectionCode` includes the bare value `"collision"`, which is a genuine substring of the REQUIRED author term `"path-collision"` (`AuthoringReason`). Banning bare `"collision"` would false-positive on the doc's own correct, required vocabulary — the deviation is not a loosened check, it is a correctly-scoped one. Verified no other `EmitRejectionCode` bare value (`not-found`, `unrepresentable`, `cap`) appears literally in any of the four new docs (they'd have the same substring-collision problem against `path-not-found`/`unrepresentable-content` if banned bare) — the doc set uses only the `AuthoringReason` (author-vocabulary) spelling throughout, never the bare wire codes. `assertNoWireInternalTerms` targets exactly the unambiguous wire class/type identifiers (`EmitRejection`, `Directive`, `Batch` — all real exported TS identifiers from `src/core/wire.ts`/`src/core/emit-rejection.ts`) plus the wire op word `delete` (word-boundary-scoped, confirmed no false positive on "deleted"/"deletion" prose, and none of the four docs use the bare word `delete` anywhere).

**Investigated but NOT a finding — lowercase "directive"/"batch" usage in `docs/authoring-errors.md`.**
`docs/authoring-errors.md` uses "batch-level rejections" and "how many directives applied" (lowercase, common-noun form) — the ban list's case-sensitive match on capitalized `Directive`/`Batch` doesn't catch these. Investigated whether this violates REQ-AOD-05.1's intent (it names "wire directives, IR batch codes" as banned terminology examples). Verified against `src/core/authoring-error.ts`'s OWN public JSDoc on `AuthoringError.verb`/`.appliedCount` (the exact source-of-truth for what this doc paraphrases): the SDK's own author-facing JSDoc uses the identical phrasing — "batch-level rejections... which have no single offending directive" (line 18-19) and "Counts directives applied within the failing flush before the offender... NOT a persistence promise" (line 242-245). The doc's wording is a faithful paraphrase of the SDK's own already-established public vocabulary at this exact field, not a leak of hidden wire-internal jargon. REQ-AOD-05.1's "wire directives" language is best read as targeting the capitalized TYPE identifiers and `EmitRejectionCode`'s bare enum values, which the doc correctly avoids. No finding.

### Not Applicable / Skipped (in-loop scope)

- Coherence (design match), Drift/cross-change check, Coverage validation, Mutation testing, REQ-ID full coverage audit — all correctly SKIP per in-loop mode (final-mode concerns).
- Live-app behavioural pass — N/A, no UI changes in this slice.

---

Orchestrator action: exit loop for S-004, proceed toward S-005 (`/build --scope=slice:S-005`) or `/evaluate` (mode=final) once all slices land, per Build Order.
