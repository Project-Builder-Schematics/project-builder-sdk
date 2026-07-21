## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 1/3
**Scope**: S-000
**Mode**: in-loop (Strict TDD)
**Delta reviewed**: commit `1819885` vs `c48036e`

---

### Verdict: NEEDS_FIX

Scope is substantively sound — real execution evidence confirms the port is faithful, the
algorithm ordering is correct, and the flagged TDD deviation is empirically legitimate. One
WARNING-level test-quality gap keeps this from a clean PASS.

- Tasks in scope complete: 6/6 (confirmed `[x]` in `slices.md`)
- Targeted tests (`test/dialects/typescript/`, `test/e2e/dialect-modify.e2e.test.ts`): 74/74 pass
- Full suite: 2064/2064 pass, 0 fail, 4427 expect() calls, 191 files (matches apply-progress's
  claimed counts exactly — no regression)
- Typecheck: clean (`tsc --noEmit`, zero output)
- Spec compliance for scope: 11/11 REQ-IDs in scope have a passing, discriminating test
- Assertion audit: 1 WARNING (see Findings)

---

### Execution Evidence (real runs, this session)

```
$ bun test test/dialects/typescript/ test/e2e/dialect-modify.e2e.test.ts
74 pass / 0 fail / 160 expect() calls — 10 files, 3.61s

$ bun test
2064 pass / 0 fail / 4427 expect() calls — 191 files, 20.09s

$ bun run typecheck   (tsc --noEmit)
(no output — clean)

$ rg -n '\.raw\(' src/dialects/typescript/
(no matches, exit 1)

$ bun test test/dialects/typescript/ops-exact-set.test.ts test/fitness/fit-raw-sweep.test.ts
14 pass / 0 fail / 16 expect() calls
```

**Deviation-claim empirical re-verification** (mutation-mindset check, done independently — not
trusted from apply-progress): swapped `src/dialects/typescript/ops.ts` back to the pre-port
`c48036e` version, ran the NEW test files (`ops-addImport.test.ts` +
`dialect-modify.e2e.test.ts`) against it, then restored the ported version (`git diff` confirms
clean restore, zero residual diff).

```
Against naive c48036e ops.ts:
 9 pass, 4 fail — 13 tests, 2 files

FAIL REQ-TSD-01.10 — Expected length: 0 / Received length: 1
FAIL REQ-TSD-01.11 — content diff: expected two separate decls, got
                      "import Def, { Other } from \"m\";" (grafted, wrong)
FAIL REQ-TSD-01.12 — threw dialectError via #invokeContained (ManipulationError, contained)
FAIL REQ-TSD-01.13 — same throw as .12
```

This is an EXACT match to apply-progress.md's claimed RED evidence (same 4 REQ-IDs, same error
shapes, same messages). The claim that `.5`, `.19`, `.31`, and the e2e Flow-1 case passed
immediately against naive code — and that this is legitimate happy-path coverage, not fabricated
RED — is CONFIRMED by real execution, not by trusting the report.

---

### Scenario Spot-Checks

| Scenario | Test | Checked | Finding |
|---|---|---|---|
| REQ-TSD-01.5 (merge) | `ops-addImport.test.ts` | Asserts `modifies.toHaveLength(1)` + byte-exact golden compare (`merge-add-import-after.txt`) | Discriminating — matches spec's "byte-exact golden" observable exactly. Clean. |
| REQ-TSD-01.19 (create) | `ops-addImport.test.ts` | Byte-exact golden compare against pre-existing `add-import-after.txt` | Discriminating. Clean. |
| REQ-TSD-01.10/.13/.31 (idempotency no-ops) | `ops-addImport.test.ts` | Each asserts ONLY `expect(collectModifies(emitted)).toHaveLength(0)` | **Gap — see Finding 1.** The spec's own wording for every one of these rows is a DUAL observable: "idempotent no-op — printed output byte-IDENTICAL to input." The established sibling-dialect precedent for the SAME scenario shape (`test/dialects/react/ops.test.ts:461` `REQ-RXD-05.6`, `:502` `REQ-RXD-05.9`) asserts BOTH `toHaveLength(0)` AND `expect(await client.read(path)).toBe(before)`. The TS port only asserts the first half. Mutation-mindset re-check: I verified by direct code reading that deleting `satisfiesIdempotency` (return `false` unconditionally) is still caught by `toHaveLength(0)` alone in all three cases (.10/.13 fall through to create — new decl emitted; .31 falls through to merge — a duplicate specifier is added, still a directive) — so this is not a silent false-pass today, but it is a real deviation from the codebase's own established dual-assertion convention and the spec's literal observable, and it's the WEAKER form of the two available checks. |
| REQ-TSD-01.11/.12 (create-branch, default/namespace present) | `ops-addImport.test.ts` | Exact string content assertion (not golden-backed, but literal and precise) | Discriminating — proven RED-driving above. Clean. |
| REQ-TSD-01.2 / REQ-TSD-03.10 (regression) | `dialect.test.ts:36`, `:239` | Byte-exact golden + explicit `importLines` count === 1 for `.03.10`'s double-call idempotency | Discriminating, pre-existing, confirmed still green. Clean. |
| REQ-TSD-01.1/.3/.4 (pre-satisfied) | `ops-exact-set.test.ts`, `.raw(` sweep, `fit-raw-sweep.test.ts` | Ran directly — zero `.raw(` hits under `src/dialects/typescript/`, both tests green | Confirmed pre-satisfied claim, verify-only, no new code introduced for these. Clean. |
| Port fidelity | `src/dialects/typescript/ops.ts` `boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause` vs `src/dialects/react/ops.ts:81-234` | Line-by-line comparison | Verbatim-faithful. Field names, branch logic, and control flow are byte-identical function bodies; only comments were condensed (S-000's Steps 1/3/4-scoped digest vs React's full V8 comment) and REQ-ID references were genericized. No semantic drift. |
| Scope discipline | `git diff --stat c48036e 1819885` | Full file list | 8 files touched, all within S-000's declared surface (`ops.ts`, its new test file, 2 goldens, the e2e addition, slices.md checkboxes, apply-progress, state mirror). No `isValueNamespaceClaimed`/collision logic present (confirmed absent by grep), no react leaf edits, no sibling TS ops (`addFunction`/`addVariable`/`addClass`) touched. Clean — no scope smuggling. |

---

### Findings

| # | Severity | Description | Evidence | Suggested fix owner |
|---|---|---|---|---|
| 1 | WARNING | `.10`/`.13`/`.31` idempotency tests in `ops-addImport.test.ts` assert only `toHaveLength(0)` (zero directives), not the full dual observable ("byte-IDENTICAL to input") the spec text specifies for every one of these rows. The established sibling-dialect precedent for the identical scenario shape (`react/ops.test.ts:461`,`:502`) asserts BOTH halves via `client.read(path)`. Not a false-pass today (verified: deleting `satisfiesIdempotency` is still caught via directive-count alone in all three cases), but it is a real deviation from this codebase's own convention for the same op family, and leaves one fewer independent check against a future regression where a directive-suppression bug and a content-corruption bug coincide. | `test/dialects/typescript/ops-addImport.test.ts` lines covering `.10` (~L18-27), `.13` (~L52-61), `.31` (~L92-101) vs `test/dialects/react/ops.test.ts:461-471`, `:502-512` | Executor (SDD-light) — add `expect(await client.read("a.ts")).toBe(seed)` to the three idempotency assertions, matching the react sibling's pattern |

No CRITICAL findings. No ARCHITECTURAL/SPEC/SENSITIVE issues found — Step 2's absence is confirmed intentional and correctly scoped per `slices.md`, not a finding.

Routing: LOCAL (Executor SDD-light)
Orchestrator action: re-invoke `/build` with SDD-light targeting Finding 1 only. Iteration 1 of 3 used.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: concerns
**Delta scope**: 2 test files (`ops-addImport.test.ts` new, `dialect-modify.e2e.test.ts` delta), 1 impl file (`ops.ts`)

**Findings**:
- Finding 1 above (assertion completeness gap, not a banned pattern) — tolerated for in-loop per the module's own rule ("assertion quality concerns that are sub-critical" — the test IS discriminating, just not maximally so), flagged for `final`.

**Checked clean**:
- No banned assertion patterns (`toBeDefined`/`toBeTruthy`/`objectContaining`-only/`not.toThrow()`-only/mock-mirroring/multi-unrelated-assertion) in either delta test file.
- Triangulation: `addImport`'s conditional branches (idempotency/merge/create, default/namespace/named kinds) are exercised by 7 distinct test cases in `ops-addImport.test.ts` plus the e2e case — not a single-case gap.
- Regression: full suite green, 0 previously-passing tests broken.
- TDD cycle adherence: RED evidence for `.10/.11/.12/.13` independently re-verified by real execution against the pre-port code (see Execution Evidence) — genuine, not fabricated. The 3 immediately-green cases (`.5/.19/.31`) plus the e2e case are non-silently flagged in `apply-progress.md`'s Deviations section with a verified root cause, matching this session's independent re-run exactly.

---

### Files Reviewed

- `openspec/changes/ts-addimport-collision/slices.md`
- `openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md`
- `openspec/changes/ts-addimport-collision/apply-progress.md`
- `src/dialects/typescript/ops.ts` (diff + full port-fidelity comparison against `src/dialects/react/ops.ts:81-234`)
- `test/dialects/typescript/ops-addImport.test.ts`
- `test/e2e/dialect-modify.e2e.test.ts` (delta)
- `test/dialects/typescript/dialect.test.ts` (REQ-TSD-01.2, REQ-TSD-03.10 regression tests)
- `test/dialects/react/ops.test.ts` (idempotency assertion precedent, lines 461-471, 502-512)
- `test/dialects/typescript/golden/merge-add-import-{before,after}.txt`
