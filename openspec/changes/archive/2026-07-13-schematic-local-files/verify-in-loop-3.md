## Verify In-Loop Result — S-001 batch, iteration 1

**Change**: schematic-local-files
**Iteration**: 1/3 (numbering continues across batches in this change's folder — S-000's iterations were 1-2, this is the first S-001 iteration)
**Scope**: S-001 (folder scaffold by-value + classifier — by-reference arm throws)
**Mode**: in-loop (Strict TDD)
**Under review**: branch `feat/schematic-local-files`, `git diff adf5661..HEAD` (commits `0a88742` feat + `bcf23e9` chore)
**Out of scope, not re-litigated**: S-000 (already PASSED, `verify-in-loop-2.md`); S-002..S-005 (their absence is not a finding)
**Scope nuance honored**: S-001 ships a MINIMAL PLACEHOLDER containment guard and a fail-loud throw on the by-reference arm by design — judged as a safe, honest, fail-closed placeholder, NOT for lacking S-002's hardening or S-003's `copyIn` emission.

---

### Verdict: PASS

- Tasks in scope complete: 6/6 (S-001.1 through S-001.6, per slices.md checkboxes)
- Full suite: 935 pass / 0 fail / 1720 expect() calls, 115 files (`bun test`, ran live) — matches apply-progress's claimed 935/0 exactly
- Typecheck: clean (`tsc --noEmit`, exit 0, ran live)
- Spec compliance for scope: 20/21 scenario groups COMPLIANT (see matrix), 1 ADVISORY (REQ-CCL-04, see Finding 1 — non-blocking)
- Assertion audit (delta): clean — real value assertions throughout, explicit mutant-killer fixtures (CCL-01.3/01.4/03.2/02.2/02.3), boundary tests pin `>` not `>=` with independent `Buffer.byteLength` pre-assertions, triangulation present for every conditional/iterative function (walk bound, glob dialect, collision detection, classify verdict branches)
- pkg-surface baseline: exact match to the new internal leaf-module dist files — no `exports` field change, no smuggled public API (see Finding 2 — clean, not a finding, documented for the record)

Orchestrator action: exit the S-001 loop. Proceed to `/build --scope=slices:S-002,S-004` per Build Order step 3.

---

### Real Execution Evidence

1. **`bun test`** (full repo, live run): `935 pass / 0 fail`, `1720 expect() calls`, 115 files, 7.84s. Matches apply-progress's claim exactly.
2. **`tsc --noEmit`** (live run): exit 0, no output.
3. **Direct exercise of `classifyTransport`, `walkFolder`, `runFilenamePipeline`, `isIncluded`, `detectDestinationCollisions`** against real scratch files (not via test names — a standalone script imported the modules and called them directly):
   - `a.txt` ("hello world") → `{verdict:"by-value", content:"hello world"}` ✓
   - `bin.dat` (null-byte buffer) → `{verdict:"by-reference"}` ✓
   - `relPath: "../escape.txt"` → threw `invalid-input`: `"source \"../escape.txt\" escapes the package (containment placeholder — hardened by a later slice)"` — placeholder guard fires, fail-closed ✓
   - `bin.dat` with `isTemplateMarked: true` → threw `invalid-input`: `"...is marked .template but is not valid text (binary content)..."` — CCL-05 carve-out fires ✓
   - `runFilenamePipeline("__name@dasherize__.service.ts.template", {...})` → `destRelPath: "{= name | dasherize =}.svc.ts"`, `isTemplateMarked: true` — matches spec Scenario FSC-05.1 verbatim ✓
   - `isIncluded("nested/a.txt", ["*.txt"], undefined)` → `false`; `isIncluded("nested/a.txt", ["**/*.txt"], undefined)` → `true` — matches spec's own glob table ✓
   - `detectDestinationCollisions` on two sources → threw naming both `a.ts` and `a.ts.template` ✓
4. **Walk bound boundary** (live run): `walkFolder(dir, 3)` with exactly 3 entries → returns 3, no throw; `walkFolder(dir, 2)` with 3 entries → throws `"...exceeded the 2-entry bound"`. Confirms `>` not `>=` (REQ-FSC-09.2 inclusive boundary).
5. **`git diff adf5661..HEAD -- src/core/authoring-error.ts`** → empty. Confirms the `AuthoringReason` union genuinely stays at 8 members in this delta (S-001 mints no new reason, per its own claim).
6. **`isSniffableText` export shape** (`src/scaffold/index.ts:47`) → `export function isSniffableText(...)`, a hoisted function declaration. Confirms the claimed 3-file import cycle (`index.ts → expander.ts → classify-transport.ts → index.ts`) is safe under hoisting, as claimed.

---

### Spec Compliance Matrix (S-001 scope: FSC-01..05, FSC-06.1, FSC-07..09, CCL-01..06, AEC-12 remaining)

| Requirement | Test(s) | Result |
|---|---|---|
| FSC-01.1/.2/.3 | `test/scaffold/index.test.ts`, e2e | ✅ COMPLIANT (live-exercised) |
| FSC-02.1 | `test/scaffold/expander.test.ts`, e2e | ✅ COMPLIANT |
| FSC-03 (table) + .1/.2 | `test/scaffold/filename-pipeline.test.ts` | ✅ COMPLIANT (live-exercised against spec's own table) |
| FSC-04.1/.2 | `test/scaffold/expander.test.ts`, e2e, `authoring-error-source.test.ts` | ✅ COMPLIANT |
| FSC-05.1 | `test/scaffold/filename-pipeline.test.ts` | ✅ COMPLIANT (live-exercised, exact match) |
| FSC-06.1 | `test/scaffold/expander.test.ts` | ✅ COMPLIANT |
| FSC-06.2 | — | ⚪ CORRECTLY DEFERRED — no by-reference fixture exists yet (by-reference throws in S-001); slices.md's own S-001.5 line documents the omission; S-003 scope |
| FSC-07.1 | `test/types/scaffold-return.test.ts` | ✅ COMPLIANT (pattern matches established precedent: `dry-run-verb.test.ts`, `typed-create.test.ts`) |
| FSC-08.1 | `test/scaffold/filename-pipeline.test.ts`, `authoring-error-source.test.ts` | ✅ COMPLIANT (live-exercised) |
| FSC-09.1 | `test/scaffold/walk.test.ts` | ✅ COMPLIANT |
| FSC-09.2 | `test/scaffold/walk.test.ts`, `authoring-error-source.test.ts` | ✅ COMPLIANT (live-exercised boundary) |
| CCL-01.1-.5 | `test/scaffold/classify-transport.test.ts` | ✅ COMPLIANT (live-exercised) |
| CCL-02.1-.3 | `test/scaffold/classify-transport.test.ts` | ✅ COMPLIANT (boundary self-verified via independent `Buffer.byteLength` assertions) |
| CCL-03.1-.2 | `test/scaffold/classify-transport.test.ts` | ✅ COMPLIANT |
| CCL-04.1 | — | ⚠️ ADVISORY — see Finding 1 |
| CCL-05.1 | `test/scaffold/classify-transport.test.ts`, e2e | ✅ COMPLIANT (live-exercised) |
| CCL-06.1 | `test/scaffold/classify-transport.test.ts` | ✅ COMPLIANT |
| AEC-12 (S-001 remaining fixtures) | `test/core/authoring-error-source.test.ts` | ✅ COMPLIANT (design's Test Derivation table row 268 assigns AEC-12(.1) here, not to `authoring-reason.test.ts` — confirms deviation 1 below) |

---

### Findings

**Finding 1 (ADVISORY, non-blocking)** — REQ-CCL-04 coverage gap within S-001's own claimed scope.

S-001's `Covers:` line in slices.md lists `CCL-01..06`, which literally includes CCL-04 ("Template-Like Sequences in a Text Asset"). No S-001 test exercises CCL-04's core claim — a **non-template** text asset containing `{= =}`-like sequences classifies by-value and renders through `scaffold` unmodified. The closest existing test (`classify-transport.test.ts`'s `"a valid text .template-marked source still classifies by-value normally"`) exercises the `.template`-**marked** path (CCL-05's carve-out), not the default non-template case CCL-04 actually describes.

This is consistent with, not contrary to, `design.md`'s own Test Derivation table (line 246: `CCL-04 (.1) | integration | test/scaffold/scaffold-fake.test.ts`) — that file is S-003 scope (slices.md S-003.6), because CCL-04's full acceptance criterion requires a parallel `copyIn` fixture that cannot exist before S-003 mints the wire op. The design correctly defers full CCL-04 verification; the discrepancy is only that S-001's slice-header `Covers:` line over-claims by including CCL-04 in the same breath as CCL-01/02/03/05/06, which S-001 fully covers.

Not a blocker: the design already routes this REQ's test to S-003, and the "renders via scaffold" half of CCL-04's behavior is implicitly exercised by every by-value scaffold test (nothing in `classifyTransport` treats `{= =}` sequences specially — the classifier only checks UTF-8/null/budget, so template-like content passes through untouched by construction). Recommend `sdd-verify --mode=final`'s REQ-ID coverage audit confirm CCL-04 lands a dedicated test in S-003 and not slip through.

**Finding 2 (informational, not a finding)** — pkg-surface baseline verified clean.

`test/fitness/pkg-surface-baseline.json`'s diff adds exactly 12 entries: `dist/scaffold/{walk,filename-pipeline,classify-transport,expander}.{d.ts,d.ts.map,js}` — the 4 new leaf modules' build output, nothing else. `package.json`'s `exports` field is untouched (still 5 entries: `.`, `./commons`, `./conformance`, `./testing`, `./typescript`) — `scaffold`/`copyIn` are reachable only through the existing `./commons` export, exactly as ADR-0044 specifies (leaf modules are internal, `commons` is the public surface). No smuggled public API.

### Deviations Audit (6 self-declared in apply-progress.md)

All 6 verified against the live repo, not accepted on the executor's word:

1. **AEC-12 → `authoring-error-source.test.ts` instead of `authoring-reason.test.ts`** — CONFIRMED justified: design.md line 268 assigns `AEC-12 (.1)` to exactly this file; `authoring-reason.test.ts` diff is empty in this delta (confirmed via `git diff`), so the 8-member pin there is genuinely untouched, as claimed.
2. **New `test/types/scaffold-return.test.ts`** — CONFIRMED justified: precedent files (`dry-run-verb.test.ts`, `typed-create.test.ts`) exist in `test/types/` using the identical `expectTypeOf(...).returns/toEqualTypeOf` pattern; design line 235 assigns FSC-07(.1) to "a `test/fitness/dts-baseline` type test" which is ambiguous about mechanism, and the scenario text itself asks for "an `expectTypeOf`-style type test" (FIT-04 is a baseline-diff mechanism, not that).
3. **MINIMAL placeholder containment guard's shape (own design choice)** — CONFIRMED reasonable and safe: rejects `..` segment or absolute-looking prefix, fail-closed (verified live: `../escape.txt` throws). Explicitly documented as NOT a security control (a symlink escape sails through) — this is honest, not overclaimed. S-002's task S-002.1 explicitly says it "REPLACES" this placeholder — consistent story.
4. **Wrapping raw stat/read errors into `AuthoringError{invalid-input}` for non-template entries** — reasonable defensive choice (no raw `Error` crosses the public API boundary), not spec-contradicting since no PRC-* REQ is in S-001's Covers list.
5. **RED evidence method (mutation-based for the 3 new pure modules, true test-first for the outer e2e loop)** — cannot independently replay session history, but the described method (implement first → stub to wrong return → confirm assertion-reason failure → restore) is coherent and consistent with the honest-evidence-caveat precedent already set in S-000's own iteration-1 fix (verify-in-loop-2.md). Framed honestly, not misrepresented as literal test-first.
6. **Fixed a fixture bug in `walk.test.ts` (FSC-09.1)** rather than the implementation** — cannot independently replay, but the final fixture (verified by reading `walk.test.ts` live) correctly isolates the symlink-skip behavior by placing the real target OUTSIDE the walked tree, which is the technically correct way to test this — supports the claim.

No deviation found unjustified or uncontained.

---

**Executive summary**: S-001 (folder scaffold by-value + classifier, by-reference arm fail-loud placeholder) is implemented correctly and safely. All 6 self-declared deviations check out against live evidence, not just against the executor's narrative. Real execution (test suite, typecheck, and direct module invocation) confirms every claimed behavior — classification sniff/budget/boundary rules, filename pipeline pinned order, glob dialect, collision detection, walk bound, and the by-reference fail-loud throw — matches the spec exactly, including inclusive/exclusive boundary edge cases. The placeholder containment guard is honestly scoped (fail-closed, tested, explicitly documented as non-security) and is not judged against S-002's hardening per the batch's scope nuance. One non-blocking advisory: REQ-CCL-04's own test is correctly deferred to S-003 by design, but S-001's `Covers:` line over-claims it — worth a note for final-mode's REQ-ID coverage audit, not a fix-now item.
