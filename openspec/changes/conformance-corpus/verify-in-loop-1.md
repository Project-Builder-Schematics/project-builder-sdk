## Verify In-Loop Result

**Change**: conformance-corpus
**Iteration**: 1/3
**Scope**: S-000
**Mode**: in-loop (Strict TDD)
**Commit judged**: `a497194` (range `6db2f5e..a497194`, branch `feat/conformance-corpus`)

---

### Verdict: NEEDS_FIX

Real execution evidence (all run against the actual commit, not claimed):

| Check | Result |
|---|---|
| `bun test` (full suite, 3 runs) | Run 1: 1998 pass / 7 fail (transient — 6 `scratch bun install failed` network flakes in unrelated e2e/scratch-consumer tests + 1 `tsc` timeout, all outside `conformance/**`). Runs 2 and 3: **2005 pass / 0 fail**, clean. |
| `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` | **37 pass / 0 fail** |
| `bun run typecheck` (`tsc --noEmit`) | Clean, no errors. `tsconfig.json` carries no `exclude` for `conformance/**` (confirmed by reading the file) — the strict sweep genuinely includes the corpus. |
| `bun run build` | Green. `dist/` contains no `collection.json`/`corpus.json`/fixture-id directories (checked directly with `find`). |
| `scripts/conformance-pr-gate.ts pr1` | PASS — `corpus.json#fixtures === ["m1-vehicle"]` at HEAD |
| `scripts/conformance-pr-gate.ts pr2 6db2f5e` | PASS — 1 commit checked, no orphan-listing violation |
| `.gitattributes` renormalize dry-check | **Zero residual diff** — ran `git add --renormalize .` for real (not `--dry-run`, which is uninformative here since it lists every tracked file regardless of content change) against the actual working tree at `a497194`, `git diff --cached --stat` was empty, then unstaged with `git reset HEAD` (working tree untouched throughout; verified via `git status`). No CRLF golden fixtures under `test/dialects/typescript/golden/*crlf*.txt` were silently renormalized — the `-text` opt-out in `.gitattributes` is effective. |

The transient run-1 failures are unrelated to this slice: all 7 are e2e tests that spawn `bun install` against a scratch consumer or hit a 5s `tsc` timeout — none touch `conformance/**`, and both reran clean. This matches a pre-existing, already-documented cold-start nondeterminism in this repo (confirmed via `sdd/conformance-corpus/apply-progress`, obs #1266). Not a regression from S-000.

---

### Completeness

All 8 S-000 tasks marked `[x]` in `slices.md`; each verified against real artefacts, not the checkbox alone:
- `corpus.json` = `{wireSpecVersion:1, fixtures:["m1-vehicle"]}` ✓
- `collection.json` presence-only marker (`{}`) ✓
- `README.md` — 4-way disambiguation present (`conformance/` and `./conformance` both named), "engine-authoritative" honesty-boundary language present ✓
- `m1-vehicle/{manifest.json,factory.ts,schematic/,expected/}` — both cases present, `expected/out.txt` committed as `v2` (no trailing newline, per REQ-CDT-06) ✓
- `.gitattributes` `* eol=lf` + `-text` CRLF-golden opt-out ✓ (dry-check above)
- `test/support/conformance-fixture-loader.ts` — shapes + `loadCorpus`/`listSubdirectories` ✓
- `test/fitness/fit-40-conformance-corpus-integrity.test.ts` — RED→GREEN per apply-progress (obs #1266: written first against ENOENT, then built to green); 37 tests now green ✓
- `tsconfig.json` — confirmed no `conformance/**` exclude; `openspec/pending-changes.md` row 306 confirmed retired in the diff ✓

### Correctness (Static + Behavioural Spec Match, scope = S-000's REQ-IDs)

Spot-checked against spec text, not just design intent:
- REQ-CFX-05 (m1-vehicle behavioral contract): manifest's `positive` case (`exitCode:0`, `writtenPaths:["out.txt"]`, transcript `[tree.read,ir.emit,ir.commit]`) and `greeting-mismatch-twin` (`exitCode:1`, `expected:"empty"`, transcript `[]`) byte-match the spec's pinned table exactly.
- REQ-CFX-12.1 (`writtenPaths` pin for schematic-lowered case = `["out.txt"]`) — matches.
- REQ-CFX-13 transcript oracle row for `m1-vehicle` — matches (`forbidDiscard:true` for both cases, correct per the V3 correction table since neither m1-vehicle case reaches a mid-flight rejection).
- REQ-CFX-01 (factory authoring surface): `factory.ts` imports only `../../src/index.ts`; `find` resolves through `src/commons/index.ts` → `src/index.ts` (confirmed by reading both files) — typecheck's green run is real proof the import chain resolves.
- REQ-CCR-08/REQ-CSC-02.3 (`collection.json` marker): present, asserted by fit-40.
- REQ-CCR-03 (PR#1 scope boundary) + REQ-CCR-04 (commit atomicity): verified directly via the PR-gate script run above, not just code inspection.
- REQ-CDT-01 (`.gitattributes` `* eol=lf`) + REQ-CDT-02 (renormalize dry-check): verified live, see table above.

No CRITICAL gaps found in this static/behavioural pass — the artefacts genuinely implement what S-000's REQ-IDs describe.

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: **halt-worthy triangulation gap found — classified LOCAL, not escalated** (see rationale below)
**Delta scope**: 2 test-relevant files (`test/fitness/fit-40-conformance-corpus-integrity.test.ts` new, `test/support/conformance-fixture-loader.ts` new), 8 non-test artefact files (all of `conformance/**` + `.gitattributes` + `scripts/conformance-pr-gate.ts`)

#### Findings

1. **CRITICAL — Triangulation gap: every violation-detection branch in the self-check is exercised by exactly one real-world sample (the current well-formed corpus), which can never trigger the failure path it exists to catch.**

   `test/support/conformance-fixture-loader.ts:72-88` (`loadCorpus`) and `test/fitness/fit-40-conformance-corpus-integrity.test.ts` build ~20 `violations: string[]` collectors (e.g. lines 73-96 `REQ-CCR-02(a)/(b)/(c)`, line 109 `missingManifestIds`, line 271 `REQ-CFX-04.1/.2 + REQ-CSC-04.1`, plus the REQ-CSC-02/03 reference-resolution and shape-validation blocks) and assert `expect(violations).toEqual([])`. Every one of these is evaluated ONLY against the real, currently-well-formed `conformance/` tree — there is no `mkdtemp`/`writeFileSync`/synthetic-fixture setup anywhere in either file (confirmed by direct grep — zero matches). This means the `if (...) violations.push(...)` lines that implement the actual fail-closed logic are **never executed with a truthy condition** by this suite. Delete or invert any one of those `if` bodies and every affected test would keep passing.

   This is not a hypothetical concern — it directly contradicts explicit signed-spec scenarios that describe FAILURE behaviour, not just pass-on-valid behaviour:
   - **REQ-CSC-01.1** (`specs/conformance-self-check/spec.md:23-27`): "GIVEN `corpus.json#fixtures` lists an id with no `manifest.json` on disk — WHEN the self-check runs — THEN it fails, naming the offending id." No test constructs this precondition.
   - **REQ-CSC-04.1** (`specs/conformance-self-check/spec.md:113-117`): "GIVEN a case with `exitCode: 2` and `emitRejectionCode: null` — WHEN the self-check runs — THEN it fails." No test constructs this precondition either — `fit-40-conformance-corpus-integrity.test.ts:271` only iterates the real fixture's two consistent cases.

   Per this skill's own rule ("A spec scenario is only COMPLIANT when a test that covers it has PASSED at runtime"), REQ-CSC-01.1 and REQ-CSC-04.1 should be marked **UNTESTED**, not COMPLIANT — the code that would implement them exists, but no test has ever driven it into its failing branch. This is exactly the Strict TDD in-loop halt condition "Single test for conditional logic in delta (triangulation gap)."

   **Note — this does NOT apply uniformly.** A separate class of checks (REQ-CDT-03 CR-byte scan, REQ-CDT-04 BOM scan, REQ-CDT-07 UTF-8 decode, REQ-CFX-01 banned-import scan, REQ-CFX-02 create-count scan, REQ-CDT-06 trailing-newline scan) genuinely scans every real byte/import in the corpus and WOULD catch a real violation if one existed in any of the actual committed files — those are legitimate, not vacuous, just currently green because the files are clean. The gap is specific to **registry-consistency checks whose violating precondition can only be manufactured** (a listed-but-missing manifest, a version mismatch between `corpus.json` and a manifest, a malformed `transcript`/`outcome` shape, an orphan directory, an inconsistent outcome triple) — none of which the single real `m1-vehicle` fixture can ever produce.

   **Failure scenario**: someone refactors `loadCorpus` and accidentally drops the `missingManifestIds.push(id)` call, or flips the `isExit2 !== hasCode` comparison to `===` in the outcome-consistency check — `bun test` stays green, `fit-40` reports 37/37 pass, and the self-check silently stops being fail-closed for exactly the invariants REQ-CSC-01/CSC-04 exist to guarantee, with no signal until the engine's Go loader independently discovers the same class of bug months later.

   **Suggested fix (LOCAL, Executor-fixable, does not require a design change)**: add a small number of synthetic-fixture tests — e.g. build a `LoadedCorpus`/`Manifest` object by hand (or write a minimal fixture tree to `bun:test`'s tmp dir) with a deliberately missing manifest / mismatched `wireSpecVersion` / malformed `transcript` / inconsistent outcome triple, and assert the corresponding `violations` array is non-empty and names the offending id. This exercises the actual failing branches REQ-CSC-01.1 and REQ-CSC-04.1 (and the sibling REQ-CCR-02/05.2/07.1/CSC-02/03 branches) require, without touching production code or the design.

**Routing**: **LOCAL** (Executor SDD-light — add negative-path tests to `fit-40`; no design/spec ambiguity, no architectural conflict).

#### Tolerated for now (flagged for final)

- TDD cycle adherence audited via Method 2 (test-implementation pairing) + the apply agent's self-reported RED→GREEN account (obs #1266) rather than independently git-history-verifiable Method 1 evidence, since S-000 landed as a single squashed commit — consistent with this project's established per-slice-commit convention seen in prior archived cycles, not a new deviation. Re-audit with full git history at final if per-cycle commits ever become available.
- No direct unit test exists for `test/support/conformance-fixture-loader.ts` in isolation (only exercised transitively through `fit-40`) — confirmed this matches the established repo convention for `test/support/import-scan.ts` (also only exercised transitively, never directly unit-tested). Not a new violation.

#### Assertion Quality / Banned Patterns

Scanned both delta test files for the banned-pattern list (`toBeDefined()`, `toBeTruthy()/toBeFalsy()` without context, `objectContaining` as the whole assertion, `.not.toThrow()` as the only assertion, snapshot-without-behaviour, mock-heavy, multi-unrelated-assertion, private-function tests). **Zero matches** — every assertion in `fit-40` targets a concrete expected value via the `ruleFail`/`toEqual([])` idiom (matching the repo's fit-01/fit-19/fit-27 precedent), which is a genuinely strong pattern for the checks it actually exercises — the finding above is about branch coverage of the violation path, not assertion shape.

---

### Spec Compliance Matrix (scope = S-000's REQ-IDs)

| Requirement | Test | Result |
|---|---|---|
| REQ-CCR-01.1/.2 | fit-40 | ✅ COMPLIANT |
| REQ-CCR-02(a) | fit-40 | ⚠️ PARTIAL — passes on valid input; failing-branch scenario (REQ-CSC-01.1) untested |
| REQ-CCR-02(b) | fit-40 | ⚠️ PARTIAL — same as above |
| REQ-CCR-02(c) | fit-40 | ⚠️ PARTIAL — same as above |
| REQ-CCR-03.1 | `scripts/conformance-pr-gate.ts pr1` (executed) | ✅ COMPLIANT |
| REQ-CCR-04.1 | `scripts/conformance-pr-gate.ts pr2` (executed) | ✅ COMPLIANT |
| REQ-CCR-05.2/.3 | fit-40 | ✅ COMPLIANT (checkpoint-derivation logic is genuinely exercised — 1 fixture / 2 cases is the real live state) |
| REQ-CCR-06.1 | fit-40 | ✅ COMPLIANT |
| REQ-CCR-07.1/.2 | fit-40 | ✅ COMPLIANT (real value comparison against `WIRE_PROTOCOL_VERSION`) |
| REQ-CCR-08.1 | fit-40 | ✅ COMPLIANT |
| REQ-CFX-01.1/.2 | fit-40 | ✅ COMPLIANT (scans real factory.ts source) |
| REQ-CFX-04.1/.2 | fit-40 | ⚠️ PARTIAL — REQ-CSC-04.1's explicit failing scenario untested |
| REQ-CFX-05.1/.2 | fit-40 | ✅ COMPLIANT |
| REQ-CFX-10.1 | fit-40 | ⚠️ PARTIAL — no case in the real corpus declares `zero-effect`; branch untested |
| REQ-CFX-11.1/.2 | fit-40 | ✅ COMPLIANT |
| REQ-CFX-12.1 | fit-40 | ✅ COMPLIANT |
| REQ-CFX-13.1/.2 | fit-40 (REQ-CFX-05 tests pin the transcript) | ✅ COMPLIANT |
| REQ-CFX-14.1 | fit-40 + real `bun run build` | ✅ COMPLIANT |
| REQ-CSC-01..06 | fit-40 | ⚠️ PARTIAL — see Strict TDD finding above; passing-path scenarios compliant, failing-path scenarios (CSC-01.1, CSC-04.1) untested |
| REQ-CDT-01.1 | fit-40 + manual read of `.gitattributes` | ✅ COMPLIANT |
| REQ-CDT-02 | manual renormalize dry-check (executed) | ✅ COMPLIANT |
| REQ-CDT-03..07 | fit-40 | ✅ COMPLIANT (real byte-level scans over real files) |

---

### Recommendation

Iteration 1 of 3. Re-invoke `/build` with SDD-light targeting the triangulation gap above (add synthetic negative-path fixtures/tests to `fit-40` proving REQ-CSC-01.1, REQ-CSC-04.1, and the sibling REQ-CCR-02/05.2/07.1/CSC-02/03 violation branches actually fail-closed) before this slice is considered done. Everything else — execution evidence, structural correctness, `.gitattributes` safety, build/typecheck hygiene, PR-gate scripts — is solid and does not need rework.
