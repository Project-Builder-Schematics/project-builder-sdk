## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 6/∞ (renumbered — sealed loop-iterations 1-5 covered S-000/S-001/S-003/S-002; this is the first verify pass over S-004)
**Scope**: S-004 (explicit contract postures) + mid-slice spec amendment V3.1 → V3.2 (REQ-TSD-01.25 correction, ratification #5)
**Mode**: in-loop (Strict TDD)
**Commit under review**: `e416997` | **Baseline**: `8a27219`

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 4/4 (S-004.1-.4, all `[x]` in slices.md)
- Affected tests passed: 61/61 (`ops-addImport.test.ts` + `dialect.test.ts` targeted run)
- Full suite: 2102/2102 pass, 0 fail, 4684 expect() calls, 191 files (+4 vs the 2098/191 S-002 baseline, exactly matching apply-progress.md's claim)
- Typecheck: clean, no errors
- Spec compliance for scope: 3/3 clauses (REQ-TSD-01.25 both halves, REQ-TSD-01.33, REQ-TSD-03.11)
- Assertion audit (Strict TDD): clean — no banned patterns, no triangulation gaps in delta
- Production diff (`ops.ts`): comment-only, verified token-by-token — zero behaviour change
- Spec amendment diff: scoped exactly to header/version bookkeeping, one V3.2 history note, `.25`'s scenario body, and Sign-Off ratification #5 — no other scenario touched
- Green-on-arrival legitimacy: all 3 new S-004 pin tests re-run against baseline (`8a27219`) `ops.ts` — 61/61 pass, confirming the batch pins pre-existing behaviour and smuggled no behaviour change

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.

---

### Findings

None (blocker/warning/suggestion) — the batch is clean across both the pins and the spec-amendment episode.

---

### Verification Detail (evidence trail)

**1. Comment-only production diff — CONFIRMED.**
`git diff 8a27219..e416997 -- src/dialects/typescript/ops.ts` produces 2 hunks, both entirely inside `/** ... */` JSDoc blocks:
- Hunk 1 (~line 173-181): `addImport`'s Step 3 JSDoc — replaced the "contrast `removeImport`'s all-match posture" clause with the true search-all/remove-first-hit description and a pointer to `removeImport`'s own JSDoc.
- Hunk 2 (~line 348-358): `removeImport`'s own "Judgment-day round 1 (Issue 2)" JSDoc paragraph — tightened to state explicitly that the search is all-declarations but the removal is first-match-only, with a REQ-TSD-01.25/V3.2 cross-reference.

No line outside a comment block (`*` prefix or `/**`/`*/` delimiter) appears in the diff. Verified by reading both hunks directly and re-reading the surrounding function bodies (`ops.ts:341-374`) — the `removeImport` implementation itself (`for (const decl of decls) { ... if (specifier === undefined) continue; ... return; }`) is byte-identical to baseline.

**2. Spec amendment scope — CONFIRMED.**
`git diff 8a27219..e416997 -- openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md` touches exactly:
- Header block: version `V3.1` → `V3.2`, status/date line.
- One new "(V3.2 — targeted amendment...)" history paragraph after the V3/V3.1 history note.
- `#### Scenario REQ-TSD-01.25` — header renamed and its GIVEN/WHEN/THEN body rewritten to the corrected search-all/remove-first-hit semantics.
- Sign-Off Block — date/version/status-transition lines updated, and one new ratification entry (#5) appended after the existing 4.
No other `#### Scenario` heading, REQ-ID, or ratification #1-#4 text appears in the diff. `.33` and REQ-TSD-03.11 text is unchanged in this diff (confirmed — they were already present at V3.1/V3, S-004 only pins them, does not amend them).

**3. Corrected `.25` factual accuracy — CONFIRMED.**
Read `removeImport` (`ops.ts:360-374`): loops over all declarations matching `from`, `continue`s past ones without the named specifier, and on the first declaration that DOES contain it, removes the specifier (or the whole declaration if it's the last binding) and `return`s — never continuing to a second occurrence. This is exactly "searches ALL, removes from the FIRST match only, once" — matching the corrected spec text, design.md's Test Derivation row, and the new pin test's fixture/assertion (`import { a, x } from "m";\nimport { y, x } from "m";` → `removeImport("x","m")` → `import { a } from "m";\nimport { y, x } from "m";` — second `x` survives). Re-ran this exact test: pass.

**4. Pin evidence — all three families re-run directly, all pass:**
- `.25` addImport half (`import { a, c } from "m";\nimport { b } from "m";`) — pass.
- `.25` removeImport half (second `x` survives) — pass.
- `.33` shebang contained reject — asserted and confirmed: `caught instanceof Error`, message `'dialect operation failed: addImport() on "a.ts" threw'`, `err.cause === undefined`, `collectModifies(emitted)` length 0, `client.read("a.ts")` byte-identical to seed. Matches ADR-03's fallback arm and the spec's own "Design-reserved fallback (pre-authorized)" clause under `.33` verbatim.
- `03.11` seed-with-own-output — a first, independent run produces the golden merged output; a second, genuinely separate `makeSpyClient`/run seeded with that output emits `collectModifies(emitted)` length 0. Confirmed pass.

**5. Green-on-arrival legitimacy — CONFIRMED (own re-run, not trusted from apply-progress.md).**
Swapped `src/dialects/typescript/ops.ts` for the pre-slice baseline (`8a27219`), ran `bun test test/dialects/typescript/ops-addImport.test.ts test/dialects/typescript/dialect.test.ts --timeout=30000`: **61 pass, 0 fail, 310 expect() calls** — identical to the post-slice run. Restored the current file afterward (`git status` on the file shows no diff post-restore — confirmed clean). This proves the S-004 batch pins pre-existing behaviour and did not smuggle a behaviour change; ADR-03's shebang test in particular is a genuine regression guard against already-shipped containment, not a driver of new code.

**6. Followup registration (S-004.4) — CONFIRMED.**
`openspec/pending-changes.md` gained a new section `## From \`ts-addimport-collision\` (2026-07-21) — ADR-03 shebang-aware insertion, registered at S-004`, in the file's existing `| Description | Type | Size | Gating? | Stage |` table format, correctly citing ADR-03 and design §4.8. The pre-existing row-341 entry (`Latent type-contamination bug in shipped addImport`) was also corrected: its `removeImport` clause now reads "SEARCHES all matching declarations but removes exactly one hit" instead of the old "iterates ALL matching declarations" framing — matches the corrected semantics.

**7. Full suite + typecheck — CONFIRMED, run directly by this verifier:**
- `bun test --timeout=30000`: **2102 pass, 0 fail, 4684 expect() calls, 191 files.**
- `bun run typecheck`: clean, no output (success).

**8. JSDoc alignment — CONFIRMED.**
Both corrected passages (`addImport`'s Step 3 paragraph and `removeImport`'s own JSDoc) now state the true semantics unambiguously — read in full above (Finding 1). No remaining reference to an "all-match" removal posture anywhere in `ops.ts`.

---

### Strict TDD (in-loop audit)

**Iteration**: 6
**Verdict**: ok
**Delta scope**: 2 test files (`ops-addImport.test.ts`, `dialect.test.ts`), 1 impl file (`ops.ts`, comment-only)

**Findings**: None.
- TDD adherence (light): 3 new production-facing tests, all documented as intentional pin/regression tests (green-on-arrival by design, per this slice's own framing) rather than defect-discovery — apply-progress.md's evidence table is honest about this, and this verifier's independent baseline-swap re-run corroborates it (checks item 5 above) rather than merely trusting the claim.
- Banned assertion patterns (delta): none found. All three new tests assert concrete byte-exact/shape values (`.toBe(...)`, `.toHaveLength(0)`, `err.cause` explicit undefined check, message substring), not `.toBeDefined()`/`.toBeTruthy()`/`objectContaining` alone.
- Triangulation: `.25`'s two halves are each single-fixture, hand-authored contract-fact pins documented as deliberately not a class of inputs (matches the existing house pattern for other single-fact asymmetry pins in this change, e.g. `.24`). `.33` and `03.11` are also single-scenario pins by design (posture/durability facts, not conditional logic requiring multiple branches). No triangulation gap flagged — these are not conditional/iterative functions under test, they are fixed contract facts.
- Regression check: full suite 2102/2102 green, zero regressions vs the 2098 S-002 baseline plus the 4 new tests.

### Tolerated for now (flagged for final)
- None beyond the pre-existing, already-documented ambient-load flake class (subprocess-timeout on `react-conformance`/`copyin-parity`/`scaffold-e2e` under heavy concurrent load) — not observed in this verifier's own full-suite run (clean at `--timeout=30000`), and unrelated to this slice's files.

---

### Episode note: spec-correction handling

The mid-slice halt→ratify→resolve episode was audited as part of this batch, not merely accepted on the executor's narrative. Independently confirmed:
- The empirical claim (removeImport removes exactly one hit, not all matches) is TRUE against the shipped code (item 3 above).
- The spec amendment is scoped exactly as claimed — no drift into other requirements (item 2).
- The production code was NOT changed to match the old spec claim — the owner's ratification ("Corregir la spec") was followed faithfully; zero behavioural diff (item 1, item 5).
- Design.md and pending-changes.md echoes were corrected in lockstep, consistently with the corrected semantics (item 6, and design.md diff read directly).

No process or correctness concern found in how the spec-correction episode was handled or recorded.

---

**Skill resolution**: `none` — skill registry is present-and-empty (greenfield); no compact rules were available to inject beyond the house discipline stated in the launch prompt (Strict TDD, `bun test --timeout=30000`, `bun run typecheck`, byte-exact goldens).
