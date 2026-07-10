## Verify In-Loop Result

**Change**: stage-4-typed-options
**Iteration**: 1/3 (persisted as artefact N=2 — continues numbering after S-000's `verify-in-loop-1`)
**Scope**: S-001 (Bin CLI Discipline), S-002 (Schema Contract Fitness)
**Mode**: in-loop (Strict TDD)
**Base commit**: `e9a3cee` (S-000, verified PASS in `verify-in-loop-1`) + uncommitted working-tree delta

---

### Verdict: HALT

**Halt reason**: SPEC

**Detail**: REQ-TFO-04.4 ("Parse failure carries a position locator") is not satisfiable by
the shipped implementation, and the delta's own `apply-progress.md` (Deviation #4) already
discovered this but self-adjudicated it as "not HALT-worthy" — a call that belongs to the
Planner, not the Executor. I independently re-verified the underlying empirical claim and
confirm it is correct, but disagree with the conclusion drawn from it.

**Empirical check (scrutiny point)**: confirmed directly against this repo's Bun runtime
(`bun --version` → `1.3.11`):

```
$ bun -e 'try { JSON.parse("{\"properties\": {\"port\": {\"type\": ") } catch(e) { console.log(e.constructor.name, "|", e.message) }'
SyntaxError | JSON Parse error: Unexpected EOF
$ bun -e 'try { JSON.parse("{ port } garbage") } catch(e) { console.log(e.constructor.name, "|", e.message) }'
SyntaxError | JSON Parse error: Expected '}'
$ bun -e 'try { JSON.parse("{\"a\":1,}") } catch(e) { console.log(e.constructor.name, "|", e.message) }'
SyntaxError | JSON Parse error: Property name must be a string literal
$ bun -e 'try { JSON.parse("") } catch(e) { console.log(e.constructor.name, "|", e.message) }'
SyntaxError | JSON Parse error: Unexpected EOF
```

Six distinct malformed-JSON shapes tried; none produced an "at position N" style message.
Bun's JavaScriptCore-backed `JSON.parse` never emits a byte offset, so
`src/core/schema/schema-parse.ts`'s `locateFromSyntaxError` (regex `/at position (\d+)/`)
never matches under this project's actual runtime — every parse failure falls into the
`(position unknown)` fallback branch. This part of the delta's claim is **correct**.

**Why this is a spec gap, not a closed deviation**:

1. `design.md` line 374 explicitly states the opposite as the applied plan: *"REQ-TFO-04.4
   targets a fixture whose Bun error carries a position + a second fixture pins the
   fallback."* That assumption is now proven categorically false — no fixture, under this
   runtime, can ever exercise a "position known" branch through native `JSON.parse`. This is
   a factual failure of a signed design's stated plan, not a matter of implementation
   craftsmanship.
2. REQ-TFO-04.4's scenario, read literally: *"GIVEN a schema.json with a syntax error at a
   known line/column ... THEN the printed message includes a line/column locator pointing at
   the syntax error"* — demands an actual line/column pointing at the error. `(position
   unknown)` is not that; it is the explicit absence of it.
3. I searched the entire test suite (`rg` for any real `line:`/`column:` assertion on a
   `SchemaParseFailure`) — there is exactly one test (`schema-parse.test.ts`, S-000-owned)
   whose *name* says "and a line/column locator" but whose body only asserts `.problem`, never
   `.line`/`.column`. No test anywhere demonstrates the "position known" branch firing. Per
   Step 9 of the verify protocol, "a spec scenario is only COMPLIANT when a test that covers
   it has PASSED at runtime" — REQ-TFO-04.4 as written has never been exercised, only its
   fallback path has.
4. The in-scope test (`codegen-cli.test.ts:128-138`) is honest about this — it asserts
   `(position unknown)` and documents the Bun/JSC behaviour inline. That is good craftsmanship
   for describing reality, but it is testing the *opposite* of what REQ-TFO-04.4 promises, not
   a satisfying instance of it.

**Why the Executor's self-resolution doesn't close this**: the deviation note argues
"`(position unknown)` IS a valid locator," which stretches the scenario's THEN clause past
what it says. Whether that stretch is acceptable is a call for whoever owns the spec, weighed
against the real alternative (a hand-rolled, zero-dep JSON scanner that tracks byte offsets
itself, replacing/wrapping native `JSON.parse` so a real line/column can be computed) — which
is a design-level investment, not a local test fix. Per the Craftsman preamble ("halt over
heuristic") and this skill's routing table ("SPEC: implementation revealed a missing
requirement"), this is not something an in-loop NEEDS_FIX can resolve; it needs a Planner
decision.

**Recommended action**:
- SPEC → `/replan` with re-spec: either (a) revise REQ-TFO-04.4's Given/When/Then to describe
  the fallback-only reality (a runtime-dependent locator, "when the runtime exposes a
  position" — which for Bun is never) and re-sign; or (b) route to `sdd-design` to evaluate a
  hand-rolled position-tracking JSON scanner (stays zero-dep, consistent with ADR-0027) that
  can genuinely produce a line/column, then have S-001 (or a new slice) implement and test it.
  Either path requires a decision above the Executor's authority — do not let a future
  iteration re-close this via another self-adjudicated deviation note.

Everything else in the S-001/S-002 delta is otherwise clean (see below) — this is the single
blocking finding.

---

### Completeness (scope)
All S-001 (6/6) and S-002 (4/4) tasks marked `[x]` in `slices.md`, confirmed against the
actual `git diff e9a3cee -- openspec/changes/stage-4-typed-options/slices.md` (all flips
`[ ]` → `[x]`, no task text altered). 10/10 tasks in scope complete.

### Correctness (static spec match, scope REQs)
| REQ-ID | Evidence | Status |
|---|---|---|
| TFO-03.1/.2 | `codegen-cli.test.ts:90-96` — no postinstall script, zero deps | ✅ |
| TFO-03.3 | `codegen-static-scan.test.ts` — scans built `dist/bin` for eval/Function/dynamic-import | ✅ |
| TFO-04.1 | `codegen-cli.test.ts:114-126` — non-zero exit, STDERR-only, names file+problem, no `.ts` written | ✅ |
| TFO-04.2 | `codegen-cli.test.ts:100-110` — exit 0, fixed success line | ✅ |
| TFO-04.3 | STDOUT-empty assertion alongside STDERR content, same test | ✅ |
| **TFO-04.4** | **only the `(position unknown)` fallback branch is ever exercised — see Verdict** | ❌ **GAP** |
| TFO-04.5 | `codegen-cli.test.ts:151-163` — malformed re-run leaves prior valid output byte-identical | ✅ |
| TFO-04.6 | `codegen-cli.test.ts:140-149` — asserts absence of "JSON Parse error"/"SyntaxError" in output | ✅ |
| TFO-05.1-.3 | `codegen-cli.test.ts:166-217` — normal write-set, relative-escape, symlink-escape (real `symlinkSync` + `realpathSync`-anchored containment), schema-content-independence | ✅ |
| FPS-01.1 | `codegen-cli.test.ts:100-110` (discovery without path arg) | ✅ |
| FPS-02.1/.2 | `fit-14-package-surface.test.ts` — baseline diff over exports/files/bin/deps/shebang/tarball, real `bun pm pack --dry-run` | ✅ |
| FPS-03.1 | `fit-15-bin-core-direction.test.ts` — real per-file import-path resolution walk, 3 red-proofs (bin-import, false-positive guard, in-src negative) | ✅ |
| FPS-05.1 | `codegen-cli.test.ts:56-81` — no-args/bad-flag/--help/usage-text-content | ✅ |
| SCP-01.1-.4 | `fit-12-schema-parity.test.ts` — digest-based parity, staled-digest + label-only-drift red fixtures, regen-restores-green, non-destructive proof | ✅ |
| SCP-02.1-.6 | `fit-13-schema-sufficiency.test.ts` + `schema-sufficiency.ts` — missing-type/label, enum-no-choices (absent+empty), nonsensical-type, 3× forbidden-key, advisory-pass, safe-iteration-around-`__proto__` | ✅ |

### Cross-change constraint
`git diff e9a3cee --name-only` touches no `openspec/changes/stage-2-error-attribution/` file
and no `src/core/authoring-error.ts` — Stage-2-owned files confirmed read-only. ✅

### TDD Compliance (Strict TDD, delta only)
- **Banned assertion patterns**: scanned all 6 new/modified test files
  (`codegen-cli.test.ts`, `codegen-static-scan.test.ts`, `fit-12/13/14/15`) for
  `.toBeDefined()`, `.toBeTruthy()`, `.toBeFalsy()`, bare `objectContaining`, lone
  `.not.toThrow()` — none found. Clean.
- **Regression check**: full suite green (see Test Execution below) — no previously-passing
  test broke.
- **Triangulation**: `runCli`'s branches (no-args, `--help`/`-h`, bad-flag, valid) are covered
  by 3 of 4 explicit CLI paths (no-args, `--help`, `--nonsense`); the `-h` short-flag alias is
  untested but shares the same code branch as `--help` — sub-critical, flagged not halting.
  `assertWriteContained`/`isWithin`/`realpathNearestExisting` triangulated across 4 distinct
  scenarios (normal, relative-escape, symlink-escape, schema-content-independence).
  `checkSufficiency`'s 5 `SufficiencyReason` branches each get ≥1 dedicated case plus a
  combined multi-property pass and a safe-iteration proof — 11 cases total. No triangulation
  gaps found in delta code.

### Test Execution (real, affected + full suite)
```
$ bun test
471 pass
0 fail
795 expect() calls
Ran 471 tests across 70 files. [1.51s]
```
Matches `apply-progress.md`'s claimed baseline (392 → 471, +79 tests / +6 files). Per-slice
isolated runs from `apply-progress.md` re-confirmed structurally consistent with this full run.

### Build / Typecheck
```
$ bunx tsc --noEmit
(no output, exit 0)
```
Clean.

### Spec Compliance Matrix (scope only)
14/15 scope-covered REQ-IDs COMPLIANT; **REQ-TFO-04.4 = ❌ UNTESTED-AS-WRITTEN** (only its
negative/fallback space is exercised; the scenario's literal "position known" premise has
never fired in any test).

---

Orchestrator action: do not re-invoke the Executor for a local fix on TFO-04.4. Route per
SPEC: re-enter at `sdd-spec` (relax the scenario to match runtime reality) or `sdd-design`
(evaluate a hand-rolled position-tracking parser). The rest of the S-001/S-002 delta needs no
rework and can stay as-is once the routing decision lands — do not re-verify S-001/S-002 from
scratch, only the resolution of this one finding.
