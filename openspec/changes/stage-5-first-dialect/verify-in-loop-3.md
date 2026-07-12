# Verify In-Loop Result

**Change**: stage-5-first-dialect
**Iteration**: 3/3
**Scope**: S-003 (Edge Scenarios & Fidelity Boundaries) + S-004 (Conformance Core Against the Real Dialect)
**Mode**: in-loop (Strict TDD)
**Delta**: `7444c51..HEAD` (`382c8c6` S-003, `33b29f4` S-004)

---

### Verdict: PASS

All scope checks green. Loop can exit for this batch.

- Tasks in scope complete: 5/5 (S-003) + 6/6 (S-004)
- Full suite: 746/746 passed (0 fail), 1314 `expect()` calls — `bun test` (up from 729 pre-batch, matches apply-progress's claimed 729→740→746 delta)
- `bunx tsc --noEmit`: clean (exit 0)
- `bun run build`: clean (exit 0 — tsc build + bin bundle)
- Spec compliance for scope: all TSD-03(.1-.10)/TSD-04.1/DC-01..05 scenarios directly evidenced with content/byte-exact assertions (constraint 7), no count-only assertions found
- Assertion audit: clean — no banned patterns in any S-003/S-004 delta test file
- Deviation (a) (RED-posture retag) ruled SANCTIONED — see "Deviation (a) Ruling" below
- Two WARNING findings carried forward unchanged from iterations 1-2 (spec-text drift, non-blocking); one new low-severity documentation-consistency finding this iteration

Orchestrator action: this was the last slice-verifying in-loop iteration per Build Order (S-005 remains, docs/security-only, not yet built). Proceed to `/build --scope=slice:S-005`, then `sdd-verify --mode=final` before archive — final verify must reconcile the two carried-forward spec-text findings before archive.

---

## Mandatory Execution Evidence (run by this verify pass)

| Check | Result |
|---|---|
| `bun test` (full suite) | 746 pass / 0 fail / 1314 `expect()` — up from 729 pre-batch |
| `bunx tsc --noEmit` | clean, exit 0 |
| `bun run build` | clean, exit 0 (tsc build + bin bundle) |
| `bun test test/conformance/ test/dialects/` (targeted) | 42 + 55 pass, 0 fail — includes all 6 planted-violation tests (round-trip, single-op, coalescing, closure-smuggle, live-node-smuggle, read-split) actually executing and passing their `.rejects.toThrow(...)` assertions |
| `bun test` FIT-01/03/04/06/08/09/10/14 | all green, run individually to confirm baselines self-validate post-batch |
| TSD-03 matrix (10 scenarios) | Read `dialect.test.ts` line-by-line: every scenario (.1/.2/.9 create-move-copy, .3 two-edits, .4 not-found, .5 empty, .6 CRLF+BOM, .7 4MiB boundary, .8 CRLF+addImport, .10 duplicate) asserts against a committed golden or an exact inline literal — zero count-only assertions found |
| TSD-03.7 boundary arithmetic (independently verified) | `BATCH_CAP_BYTES = 4*1024*1024 = 4,194,304` (`src/core/wire.ts:50`); test constructs `targetSerialized = CAP+1 = 4,194,305`, derives raw print bytes below the cap via quote-padding (1 raw byte → 2 serialized bytes); confirmed `raw < BATCH_CAP_BYTES` and `serialized > BATCH_CAP_BYTES` are both asserted in the test body, not merely claimed in prose; the run rejects with `AuthoringError.reason === "changes-too-large"` |
| TSD-04.1 error taxonomy | `ERROR_PREFIX = "dialect operation failed: "` constructed at exactly ONE site (`src/core/dialect-handle.ts:23`, `dialectError()`); `rg "dialect operation failed"` across `src/` → 1 hit; `ast.ts`'s own `parse()` throws a plain, unprefixed `Error("syntactically invalid TypeScript source")` that `dialect-handle.ts`'s `#ensureLive()` catches and re-wraps — confirms constraint 3 (one taxonomy, one wrapper) holds against the REAL ts-morph parse-failure path, not a second implementation |
| Golden byte content (new S-003 goldens) | `xxd` on all 4 new golden files: `crlf-bom-round-trip.txt` starts `EF BB BF` (UTF-8 BOM) and contains `0D 0A` (CRLF); `crlf-add-import-{before,after}.txt` both CRLF-consistent; `empty-add-import-after.txt` matches the expected minimal import — all byte-exact, none hand-typed-looking |
| DC-04 seam-serializability, two distinct modes | `assertSerializable()` (`src/conformance/index.ts:121-141`): try/catch around `JSON.stringify` (throw path) vs. a separate `deepEqual` mismatch check (silent-drop path) — genuinely two distinct code branches, not one branch catching both. Test assertions use DISTINCT regexes: `closureSmuggleFixture` → `.rejects.toThrow(/REQ-DC-04/)` (deep-equal-mismatch message); `liveNodeSmuggleFixture` → `.rejects.toThrow(/JSON\.stringify/)` (throw-path message) — both fixtures run and both assertions passed in the live test run |
| DC-05 planted-violation suite (spot-run, all 6 executed via targeted run above) | round-trip → `/REQ-DC-01/`; single-op → `/REQ-DC-02/`; coalescing → `/REQ-DC-02\/03/`; closure-smuggle → `/REQ-DC-04/`; live-node-smuggle → `/JSON\.stringify/`; read-split (DC-05.2) → `/REQ-DC-05\.2/` — all 6 fixtures read in full; each is a genuinely different broken mechanism (print-corrupting, wrong-region mutation, never-coalescing hand-rolled `find`, closure-in-print, live-SourceFile-in-print, defer-all-buffering-to-`.then()`), not a copy-pasted violation with a relabeled assertion |
| Constraint 2 (toy-dialect isolation) | `rg "toy-dialect" src/ test/conformance/` → zero import matches (one comment-only reference in `typescript-conformance.test.ts` explaining the constraint); `test/conformance/toy-dialect-smoke.test.ts` confirmed deleted (not in working tree) |
| Constraint 5 (flush-seed-rule) | Every S-004 exercise pre-seeds via `createRunVehicle({[path]: exercise.seed})` before any op runs (`src/conformance/index.ts:159`) — no bare `create()`-then-`find()`-only chain in any new test |
| Constraint 6 (no same-path concurrency assertion) | `rg "concurrent\|same-path\|last-write-wins" test/dialects/typescript test/conformance` → only hit is `coalescing.test.ts`'s pre-existing (S-002, untouched this batch — confirmed via `git diff --stat` showing zero changes to `coalescing.test.ts`) `REQ-MC-07.1: sequential awaited same-path handles` test, which asserts the DEFINED sequential-awaited case only, never a concurrent/unawaited outcome |
| run-vehicle not exported from `./conformance` | `package.json#exports["./conformance"]` maps only to `dist/conformance/index.{js,d.ts}`; `src/conformance/index.ts` `import`s `createRunVehicle` but never re-`export`s it; `run-vehicle.ts`'s own header explicitly avoids naming the SDK's transport-port type (confirmed via `grep "EngineClient\|EmitRejection" run-vehicle.ts` → no matches) |
| FIT-04/FIT-14 baseline regen | `conformance.index.d.ts` baseline contains `Promise<void>` return types + `exercises`/`OpExercise` (grep-confirmed); `pkg-surface-baseline.json` carries the 3 new `dist/conformance/run-vehicle.*` tarball entries; both FIT-04 and FIT-14 tests pass live, meaning the baselines are byte-consistent with the actual `bun run build` output, not stale |
| Implementation-file diff check (RED-posture ruling input) | `git diff 7444c51..HEAD --stat -- src/dialects/typescript/ast.ts src/dialects/typescript/ops.ts src/core/dialect-handle.ts` → EMPTY. Confirms apply-progress's own claim ("no implementation changes were needed this slice") — the S-003 [characterization] retag is not laundering an undisclosed implementation change |

## Completeness (S-003 + S-004)

| Slice | Tasks | Status |
|---|---|---|
| S-003 | 5/5 | complete |
| S-004 | 6/6 | complete |

## Spec Compliance Matrix (scope: S-003 + S-004)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-TSD-03.1 | modify-after-create (commons `create` then dialect `find().addImport()`, V4 wording) | `dialect.test.ts::REQ-TSD-03.1` | ✅ COMPLIANT |
| REQ-TSD-03.2 | modify-then-move, original path, `{path,toDir}` | `dialect.test.ts::REQ-TSD-03.2` | ✅ COMPLIANT |
| REQ-TSD-03.3 | two-distinguishable-edits, one modify, both effects present | `dialect.test.ts::REQ-TSD-03.3` | ✅ COMPLIANT |
| REQ-TSD-03.4 | not-found, pinned QUOTED message | `dialect.test.ts::REQ-TSD-03.4` | ✅ COMPLIANT — matches spec's exact quoted wording |
| REQ-TSD-03.5 | empty file round-trip + import | `dialect.test.ts::REQ-TSD-03.5` + golden | ✅ COMPLIANT |
| REQ-TSD-03.6 | CRLF+BOM round-trip byte-exact | `dialect.test.ts::REQ-TSD-03.6` + golden (BOM+CRLF confirmed via `xxd`) | ✅ COMPLIANT |
| REQ-TSD-03.7 | 4 MiB serialized-side boundary, never silent truncation | `dialect.test.ts::REQ-TSD-03.7` | ✅ COMPLIANT — arithmetic independently re-derived |
| REQ-TSD-03.8 | CRLF+addImport, same newLineKind | `dialect.test.ts::REQ-TSD-03.8` + golden | ✅ COMPLIANT |
| REQ-TSD-03.9 | modify-then-copy, original path, `{from,to}` | `dialect.test.ts::REQ-TSD-03.9` | ✅ COMPLIANT |
| REQ-TSD-03.10 | duplicate addImport, idempotent | `dialect.test.ts::REQ-TSD-03.10` | ✅ COMPLIANT |
| REQ-TSD-04.1 | real ts-morph parse failure contained, `.cause` absent | `dialect.test.ts::REQ-TSD-04.1` | ✅ COMPLIANT |
| REQ-DC-01.1 | byte-exact round-trip, real dialect | `typescript-conformance.test.ts` | ✅ COMPLIANT |
| REQ-DC-02.1 | single-op fidelity + unchanged-elsewhere | `typescript-conformance.test.ts` | ✅ COMPLIANT |
| REQ-DC-03.1 | coalescing-to-one, content-verified, ≥2 ops | `typescript-conformance.test.ts` | ✅ COMPLIANT |
| REQ-DC-04.1 | closure-smuggle fails loudly | `typescript-conformance.test.ts` + `planted/closure-smuggle-violation.ts` | ✅ COMPLIANT |
| REQ-DC-04.2 | live-node-smuggle fails, DISTINCT mode | `typescript-conformance.test.ts` + `planted/live-node-smuggle-violation.ts` | ✅ COMPLIANT — confirmed distinct via regex + code-path read |
| REQ-DC-05.1 | one red-proof per core assertion | `typescript-conformance.test.ts` (round-trip/single-op/coalescing slots) | ✅ COMPLIANT |
| REQ-DC-05.2 | read-boundary-split red-proof | `typescript-conformance.test.ts` + `planted/read-split-violation.ts` | ✅ COMPLIANT |
| REQ-TSD-05.1 | subpath smoke, ContractFake | `typescript-conformance.test.ts` | ✅ COMPLIANT — correctly against `ContractFake`, not run-vehicle (TSD-07 scope) |

## Assertion Quality / Strict TDD (in-loop, delta scope)

- **Banned patterns**: none found in `dialect.test.ts`'s S-003 additions or any S-004 test file (`typescript-conformance.test.ts`, `meta.test.ts`, all 6 `planted/*.ts` fixtures).
- **Triangulation**: TSD-03.1/.2/.9 (create/move/copy) each a distinct fixed scenario, acceptable per slices.md's own note ("each REQ is one fixed scenario, not a class of inputs"); `assertSerializable`'s two branches (throw vs. deep-equal-mismatch) are each independently triangulated by a dedicated fixture (closure-smuggle vs. live-node-smuggle) — genuine two-case coverage, not one test asserting both.
- **Regression**: full suite green, 729 → 746 (+5 S-003, wait — actually +11 S-003 minus toy-smoke deletion, +6 S-004 net per apply-progress's own accounting: 729→740→746), no regressions.
- **RED evidence quality**: for TSD-03.1-.6/.8/.10 and TSD-04.1, RED-equivalent evidence is a standalone probe script run against the REAL (unchanged) implementation before the assertion was committed — this is weaker than a genuine revert-and-fail RED but is the accepted substitute this house's own precedent uses (S-001/S-002 batches, already verified PASS) precisely for the "test-writing lags implementation by one slice" pattern the ORIGINAL slice document itself planned (TSD-01/02 → S-002, TSD-03/04 → S-003, per the signed Coverage Check table). TSD-03.7 is qualitatively stronger — its RED-equivalent evidence is an independent arithmetic derivation (`raw < CAP`, `serialized > CAP`), not merely "observed what the code currently does," and would genuinely fail if the cap check regressed.
- **S-004's `[must-fail-first]` tag**: genuinely warranted — `src/conformance/index.ts`'s bodies (testDialect/testOpPack/run-vehicle) did NOT exist before this batch (confirmed: these were stubs, per ADR-0012's "Context"); the planted-violation fixtures were probed pre-commit against the real (new) implementation, which is standard must-fail-first practice for newly-written production code.

## Deviation (a) Ruling — S-003 tasks retagged `[must-fail-first]` → `[characterization]`

**Ruling: SANCTIONED per the RED-posture taxonomy — not a tdd-violation.**

Evidence supporting the ruling:
1. **The underlying mechanism genuinely pre-existed and is unchanged this batch.** `git diff 7444c51..HEAD` touches zero lines in `src/dialects/typescript/ast.ts`, `ops.ts`, or `src/core/dialect-handle.ts` — the BOM re-prepend, `detectNewLineKind`, syntactic-diagnostics parse-failure detection, and `addImport` merge-idempotency were all built and committed in S-002 (`bc073d2`), a separate, already-verified-PASS batch (iteration 2). S-003 adds tests only.
2. **The split was planned at slicing time, not discovered at build time.** The ORIGINAL signed `slices.md` Coverage Check table already assigns TSD-01/02 to S-002 and TSD-03/04 to S-003 — the test-writing lag is a deliberate, owner-ratified sequencing decision (mirrors the "toy dialect proves the mechanism early, real edge-case tests land later" pattern this same change already used for S-001→S-002). The retag reflects that plan's own structure, not an ad hoc rationalization invented mid-batch to dodge rigor.
3. **RED-equivalent evidence was actually produced**, not merely asserted: apply-progress documents standalone probe scripts run against the real (unchanged) implementation before each assertion was committed, and this iteration independently re-derived the strongest case (TSD-03.7's boundary arithmetic) rather than trusting the log.
4. **Consistent with already-accepted house precedent** — iterations 1 and 2 of this very change (S-001, S-002) used the identical "probe against real code, then batch-commit the test" pattern for comparable reasons and were verified PASS without objection.
5. The taxonomy's own definition — "[characterization] — pins already-intended behavior; RED waived with justification" — is a precise match: this is not new intended behavior being specified for the first time (which would demand true must-fail-first), it is coverage of already-shipped, already-intended behavior.

**Minor, non-blocking flag on this deviation**: `TSD-03.7`'s task line in `slices.md` was retagged to `[characterization]` alongside the other eight, but apply-progress's own TDD Cycle Evidence table explicitly labels that same task's RED evidence "GENUINELY NEW assertion (**not** characterization)". The underlying cap-rejection mechanism (`BATCH_CAP_BYTES`, from Stage 1) does predate this slice, so the checkbox tag is defensible, but the artefact's own prose contradicts its own checkbox. Recorded as Finding 3 below (SUGGESTION, not blocking).

## Findings

### Finding 1 — WARNING (routing: SPEC, non-blocking, carried forward unchanged from iteration 2)

REQ-FPS-02's signed spec text ("exactly FOUR entries... no more, no less") is stale against the correct, shipped 5-entry exports map (`./testing` landed independently via `stage-4b-testing-harness`). Batch 3 does not touch this area; unresolved. Must be reconciled (spec micro-unfreeze) before final verify/archive.

### Finding 2 — WARNING (routing: SPEC, non-blocking, carried forward unchanged from iteration 1)

REQ-FIT-01's spec text is stale relative to the ratified S-000 transitive-walk semantics ruling (verify-plan-5 amendment). Batch 3 does not touch this area; unresolved. Must be reconciled before final verify/archive.

### Finding 3 — SUGGESTION (non-blocking, new this iteration)

`apply-progress.md`'s S-003 TDD Cycle Evidence table row for TSD-03.7 says "GENUINELY NEW assertion (not characterization)" while the corresponding `slices.md` task checkbox is tagged `[characterization]`. Both readings are individually defensible (see Deviation (a) ruling above) but the artefact is internally inconsistent about which one applies. Recommend a one-line reconciliation in either file at the next opportunistic touch — does not block this iteration or final verify.

## Deviations From Plan (apply-progress.md) — Judged

| # | Deviation | Judgment |
|---|---|---|
| a | S-003 tasks retagged `[must-fail-first]` → `[characterization]` | SANCTIONED — see "Deviation (a) Ruling" above. Minor internal-consistency nit noted as Finding 3. |
| b | `test/conformance/toy-dialect-smoke.test.ts` deleted (not extended) | SANCTIONED — ADR-0012 amendment ("S-001 toy-smoke boundary", design §4.5) explicitly states this file is REPLACED at S-004 by `typescript-conformance.test.ts`; slices constraint 2 forbids the toy fixture past S-001 in conformance code; `rg` confirmed no other file references the deleted test. |
| c | `run-vehicle.ts`'s explanatory comment rephrased to avoid naming `EngineClient`/`EmitRejection` | SANCTIONED — self-corrected same session after FIT-10's text-scan (not AST-scan) caught the comment; confirmed live: `grep` for both banned identifiers in the current file returns zero matches, and FIT-10 passes. |
| d | `read-split-violation.ts` mechanism redesigned mid-development (first attempt lost an edit for the wrong reason) | SANCTIONED — standard TDD-driven correction; apply-progress documents the probe that caught the wrong-reason failure and the redesign that fixed it; the final fixture (read at full) genuinely isolates the read-split failure specifically (direct no-read pass coalesces correctly first, per the file's own header comment), confirmed by reading the committed file. |

## Files Changed (verified against apply-progress.md's table)

Matches apply-progress.md's Files Changed tables for S-003 (5 files: `dialect.test.ts` + 4 new goldens) and S-004 (13 files: `index.ts`, `run-vehicle.ts`, `typescript-conformance.test.ts`, 6 `planted/*.ts`, `meta.test.ts` modified, `toy-dialect-smoke.test.ts` deleted, 2 fitness baselines, ADR-0012 amendment). `git diff 7444c51..HEAD --stat` (21 files, 1464/-118) matches this set exactly; no undisclosed file changes found.

## Risks Carried Forward

- Finding 1 (REQ-FPS-02 spec text) — open since iteration 2, unresolved, must reconcile before final verify/archive.
- Finding 2 (REQ-FIT-01 spec text) — open since iteration 1, unresolved, must reconcile before final verify/archive.
- Finding 3 (new, this iteration) — cosmetic artefact inconsistency, low priority.
- S-005 (docs/SECURITY/sensitive-areas) remains unbuilt — the only slice left before final verify per Build Order.

## Next Recommended

`/build --scope=slice:S-005` (Authoring Docs, SECURITY Guard, Sensitive-Areas Promotion) — requires S-002 (complete) + S-004 (complete, this batch). Last slice in Build Order. Once complete: `sdd-verify --mode=final`, which MUST reconcile Findings 1 and 2 (spec-text drift) before archive — both are non-blocking for in-loop exit but explicitly flagged across three consecutive iterations now as needing resolution before the change closes.
