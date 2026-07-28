## Verification Report

**Change**: positive-create-conformance
**Mode**: final (Strict TDD)
**Spec version**: V1 (merged, signed) — 9 REQ-ID/scenario rows in design §4.6 Test Derivation
**Scope verified**: merge `0bd88e4` (PR #55, base diff `0bd88e4^1..0bd88e4`) + post-merge `e76bd8f`
(simplify-gate cleanup + ADR-0064 engine-confirmed amendment expansion) — HEAD of
`feat/positive-create-conformance`, base `origin/main@0bd88e4`.

---

### Completeness

| Metric | Value |
|---|---|
| Slices total | 3 (S-000, S-001, S-002) |
| Slices complete | 3/3 — all `[x]`, cross-checked against `git show` per commit (7eb89fd, 29c8ed1≈547b247, ccdd417≈08a7d4a) |
| Tasks total | 15 |
| Tasks complete | 15/15 |

### Build & Tests Execution (real, re-executed independently of verify-in-loop-1)

**Typecheck**: ✅ `bunx tsc --noEmit` — clean, no output.

**Targeted (fit-40)**: ✅ `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` →
`61 pass / 0 fail`, 198 `expect()` calls. Matches the engine-mandated expectation exactly.

**Full suite**: ✅ `bun test` → `2401 pass / 0 fail`, 5325 `expect()` calls, 201 files, 83.6s.
Better than the documented baseline (~2401/0 modulo two known load-flakes — react-conformance
RXD-08.1 and installed-consumer tarball-leg, both Bun 5000ms-timeout-under-load flakes per
`openspec/pending-changes.md:463`/601) — neither flake fired on this run; no re-isolation needed.

**Build**: N/A — library package, no separate build step beyond typecheck for this verification
(no build script failures encountered).

### Strict TDD (final audit)

**Verdict**: pass

**TDD Cycle Adherence**
- Method used: file-pairing (Method 2) — project convention is per-slice commits, not
  per-cycle, confirmed unchanged from verify-in-loop-1's finding.
- Evidence: `7eb89fd` (`test(conformance): author create-composite...` — RED test + manifest
  case + factory export + expected bytes landed together, message states "Covers REQ-CFX-09.4,
  REQ-CFX-12.3, REQ-CFX-13.6"), `547b247` (`test(conformance): reject-twin gains force:true...`),
  `08a7d4a` (`docs(conformance): sync quarantine-cardinality wording...` — turns
  `REQ-CFX-03.1` RED via the `CLAUSE_KEYWORDS["(a)"]` regex change, then restores GREEN in the
  same commit). No anti-pattern (implementation committed alone, tests added later) found in
  any of the three slice commits.
- Findings: Clean.

**Assertion Quality**
- Tests scanned: all 5 new/changed `it` blocks in `fit-40-conformance-corpus-integrity.test.ts`
  (REQ-CFX-09.4, REQ-CFX-09.5, REQ-CFX-02.2, REQ-CFX-03.1 regex update, plus the reworded
  REQ-CFX-02.1 comment).
- Banned pattern matches: 0 — all assertions pin concrete values (`toEqual` on full objects,
  `toBe` on exact byte content, `.test()` regex on real file content), no
  `toBeDefined()`/`toBeTruthy()` used as a sole assertion.
- Findings: Clean.

**Triangulation**
- Functions/logic audited: the new assertions pin static structural/content invariants
  (manifest shape, file bytes, regex presence/absence), not conditional/iterative production
  logic — triangulation does not apply the same way it would to branching code. No gap.
- Findings: N/A for this delta's shape (data-fixture pinning, not branch logic).

**Mutation Testing**
- Tool: Not configured in this project — skipped per protocol.
- **Manual mutation spot-check substituted** (real, executed, then reverted):
  1. `manifest.json`'s `create-composite.outcome.exitCode` 0→1 → fit-40 went RED
     (`60 pass / 1 fail`, exact diff shown in failure output) — reverted, back to 61/61.
  2. `expected-composite/create-composite.txt` bytes `"composite: [x][y]"` →
     `"composite: [x][z]"` → fit-40 went RED (byte mismatch caught) — reverted, back to 61/61.
  3. `factory.ts`'s `createRejectProbe` call: dropped `force: true` → fit-40 went RED
     (REQ-CFX-09.5's regex assertion caught the missing field) — reverted, back to 61/61.
  - All three real, targeted mutations were caught. Tests are not tautological.

**REQ-ID Coverage**
- REQs in design §4.6 Test Derivation: 9 (REQ-CFX-02.1, 02.2, 03, 09.1, 09.2/.3, 09.4, 09.5,
  12.3, 13.6).
- REQs with at least one test that PASSED at runtime: 9/9.
- Uncovered REQs: 0.

### Adversarial Quality Gate (final mode)

**Code audit (pre-pr mode)** — ran the catalogue (`skills/_shared/code-audit.md`) over the full
diff (`0bd88e4^1..e76bd8f`) + signed spec + design:

| Severity | File:Line | Finding |
|---|---|---|
| — | — | **Clean** — no Bug/Architecture/MAJOR findings. Group 1 (spec alignment): all 9 REQ rows traced to tests, no drift. Group 2 (architecture): zero `src/**` diff, ADR-0064's frozen triple unchanged (only its Amendment section grew), no layer/SSOT violation, `conformance/` confirmed absent from sensitive-areas. Group 3 (quality): no untyped casts, no new magic numbers, no TODO/FIXME introduced, the one near-duplicate (2 logically-implied assertions) was already caught and fixed by the simplify gate (`e76bd8f`, verified: `git diff 0bd88e4..e76bd8f` shows exactly that 2-line removal + ADR-0064 amendment addition — nothing else). Group 4 (scope): diff's changed files match design §4.2's File Changes table exactly; `pending-changes.md` row 500 untouched (confirmed via empty `git diff ... -- openspec/pending-changes.md`). |

**Live-app pass**: N/A — no UI changes (fixture/spec/ADR/test authoring only).

**Adversarial review (judgment-day)**: **not-required** — triage = M, no sensitivity override
fired at triage (`conformance/` confirmed absent from `openspec/sensitive-areas.md`; triage.md's
own "Overrides Triggered: None").

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-CFX-02.1 | Every `create()`-authoring case is quarantined inside the sanctioned file | `fit-40` `REQ-CFX-02` (existing `checkCreateQuarantine`, zero code change needed) | ✅ COMPLIANT |
| REQ-CFX-02.2 (NEW) | Cardinality sync sites (README/clause-a/regex) describe the quarantine invariant, same commit | `fit-40` new `it("REQ-CFX-02.2 ...")` | ✅ COMPLIANT |
| REQ-CFX-03 clause (a) | DO-NOT-COPY 5-clause comment reworded for the quarantine + force-triggered rejection + new copy-pointer | `fit-40` `it("REQ-CFX-03.1 ...")`, `CLAUSE_KEYWORDS` updated | ✅ COMPLIANT |
| REQ-CFX-09.1 | Positive case declares one commit, two composed halves (unchanged) | `fit-40` existing `it` | ✅ COMPLIANT (unaffected) |
| REQ-CFX-09.2/.3 | `wire-create-reject-twin` outcome triple pinned per ADR-0064 (unchanged) | `fit-40` existing `it` | ✅ COMPLIANT (unaffected) |
| REQ-CFX-09.4 (NEW) | New quarantined case authors composite-options create, exit 0, byte-exact | `fit-40` new `it("REQ-CFX-09.4/12.3/13.6 ...")` | ✅ COMPLIANT (mutation-verified, see above) |
| REQ-CFX-09.5 (NEW) | Reject-twin stays valid under engine's new create semantics (`force: true`) | same test file, new `it("REQ-CFX-09.5 ...")` | ✅ COMPLIANT (mutation-verified) |
| REQ-CFX-12.3 (NEW) | New case pins a genuinely new `writtenPaths` entry, no collision | covered by the REQ-CFX-09.4 assertion | ✅ COMPLIANT |
| REQ-CFX-13.6 (NEW) | New case's transcript is single-emit-single-commit | covered by the REQ-CFX-09.4 assertion | ✅ COMPLIANT |

**Compliance summary**: 9/9 scenarios compliant.

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0078 (`force: true` added to `createRejectProbe`) | Yes | `factory.ts` call carries `force: true`; verified mutation-resistant |
| ADR-0064 amendment (outcome triple byte-identical, cause reclassified) | Yes | `(2, "unrepresentable", null)` unchanged; Amendment section states force-is-trigger + engine-v1-no-force-mechanism specifics (see item B below) |
| New case inside SAME sanctioned file, no new fixture id (design §4.1/4.2) | Yes | `createComposite` lives in `m2-create-composition/factory.ts`; no new `corpus.json` entry |
| `conformance-validators.ts`/`corpus.json` read-only (design §4.2 table) | Yes | zero diff on either file |
| No `src/**` change (design §4.2c, "aligns") | Yes | confirmed empty `src/` diff |

### Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| `conformance/` authoring layer | Clean | additive extension within existing layer, matches architecture.md's `conformance-corpus (additive)` characterization |
| ADR-0064 (frozen decision) | Amended, not contradicted | Amendment section explicitly cites this change and the follow-on engine confirmation |
| ADR-0067 (`collection.json` marker) | **Already superseded — pre-existing, not by this change** | see Blast-Radius Statement (item D) below — flagged for completeness, not a finding against this change |

### In-Loop History

| Iteration | Verdict | Issues fixed |
|---|---|---|
| 1 | PASS | None needed — clean on first pass |

### Issues Found

**CRITICAL**: None.

**WARNING** (should fix, does not block):
1. `openspec/changes/positive-create-conformance/simplify-report.md` exists only as an
   **untracked** file in the worktree (`git status` confirms; `git log --all` for this path
   returns nothing) — it was never committed, unlike the ADR-0064 amendment and fit-40 cleanup
   it describes (which DID land in `e76bd8f`). If this worktree is discarded before archive, the
   simplify report's record is lost. Fix: `git add` + commit it (or fold its content into the
   archive report) before `sdd-archive` runs.
2. `verify-in-loop-1.md`'s self-reported test-execution numbers are slightly inaccurate:
   it states "fit-40 targeted 62/62" and "201 expect() calls" at the pre-simplify commit; direct
   re-execution against that exact commit (`0bd88e4`) shows **61 pass, 200 expect() calls**.
   Non-blocking (off by one test/one assertion in the report's own count, not a real failure —
   the underlying REQ coverage and pass/fail verdict were correct), but a reminder that in-loop
   self-reported counts should be copy-pasted from actual terminal output, not summarized from
   memory.

**SUGGESTION**:
- None beyond what `simplify-report.md` already logged (reviewer's overall assessment: tight,
  well-scoped diff, no reuse/efficiency/altitude issues).

**IMPROVEMENTS** (real but not blocking for THIS problem, routed to pending-changes):
- (Already registered, not new) `openspec/pending-changes.md:500` ("Create total-count==1 +
  session.buffer raw shape scan — widen the exactly-one-create invariant") stays open,
  confirmed untouched by this change.
- **NEW, not yet registered**: `wire.ts`'s `force?: boolean` type on the create directive and
  `docs/create-templates.md`'s §"Overwrite behavior (force)" both need correction once the
  engine's fail-closed `force` behavior (engine ADR-0028 third amendment: v1 has NO force
  mechanism for create, permanently — any force-bearing create is rejected explicitly) is
  confirmed live. Design §4.8 flags this explicitly as an archive-time registration duty —
  **not yet done** (no such row found in `openspec/pending-changes.md` as of this verify pass).
  `sdd-archive` MUST add it.
- **NEW, cross-repo, non-gating**: see Blast-Radius Statement item D below —
  `resolvePackageRoot`'s deletion (inline-collection-marker, unrelated in-flight change) retires
  a documented runner pre-flight failure mode; the engine team should confirm their own harness
  doesn't depend on it before the pin advances.

### Fix Plan

Not applicable — verdict is `pass-with-followups`, no gating findings.

---

## Item B — ADR-0064 Amendment Completeness (engine item 3)

**Verdict: SATISFIED.** Read `openspec/decisions/0064-wire-create-reject-twin-outcome-triple-frozen.md`
in full (landed in `e76bd8f`, the post-merge /evaluate commit). Its "Amendment" section
(lines 45-67) states, verbatim and accurately against the engine handoff (obs #1695, #1739):

(a) **Force-is-the-trigger, not the template** — "The rejection trigger is `force`, NOT the
template. The `"unrepresentable"` template literal renders fine as an ordinary string; before
`force` was added, the NEW engine accepted this probe and wrote the file — the engine's
adversarial review flagged the manifest's pinned rejection as falsified."

(b) **Engine v1 has no force mechanism for create, permanently** — "Engine v1 has no `force`
mechanism for create, permanently (engine ADR-0028, third amendment) — neither envelope-level
nor per-op. A wire create carrying `force` is rejected at decode step 2, before any render, as
batch-level `unrepresentable` with `failedIndex: null` — explicitly, never silently ignored."

Both required specifics are present, word-for-word consistent with the task's summary of obs
#1739. No gap.

## Item C — Composite-Options Round-Trip REQ Coverage (engine item 4)

**Verdict: COVERED (SDK side).** The exact code path `createComposite` exercises is pinned by an
SDK REQ and directly tested:

- **Call chain** (file:line evidence): `conformance/m2-create-composition/factory.ts:33-34`
  (`createComposite` calls `create("create-composite.txt", { template: ..., options: { tags:
  ["x","y"] } })`) → `src/commons/index.ts:187-204` (`create()` calls
  `session.buffer(factory.create({..., options: opts.options, ...}))`) →
  `src/core/directive-factory.ts:137-146` (`DirectiveFactory.create()` calls
  `encodeOptions(a.options)`) → `src/core/directive-factory.ts:126-133` (`encodeOptions`'s
  `Array.isArray(value) || isPlainObject(value) ? JSON.stringify(value) : value` branch —
  the exact stringify branch in question).
- **REQ pin**: `openspec/specs/typed-options-encoding/spec.md:23-83`, REQ-TOE-01 ("Shallow
  Top-Level Encode of Composite Option Values") — Scenario .1 pins array values encoding to a
  JSON string.
- **Test pin**: `test/core/encode-options.test.ts:14-53` — `describe("REQ-TOE-01 —
  encodeOptions, shallow top-level composite encode")`, `it("Scenario REQ-TOE-01.1: native array
  value encodes to a JSON string")` exercises `encodeOptions({ methods: [...] })` directly and
  asserts the exact JSON string. `test/golden-ir/golden-ir.test.ts:22` exercises the SAME branch
  end-to-end through `DirectiveFactory.create()` with a composite array option.
- **Spec's own scope boundary** (`typed-options-encoding/spec.md:17-19`): "REQ-TOE-01 through
  REQ-TOE-06 describe the SDK-side wire SHAPE only — they assume the engine renders/consumes
  that shape faithfully (the PC-PROTO-01 tether). Engine-side rendering behaviour is out of
  scope and untested here." This is a DELIBERATE, documented boundary, not a gap: the SDK half
  of the round-trip (native array → JSON string at the wire) is REQ+test pinned; the engine
  half (JSON string → depth-1-promoted array at ingest, their REQ-ING-12.8) is necessarily
  proven engine-side, per the corpus's own honesty boundary (REQ-CFX-11) — this SDK repo
  declares outcomes, never proves engine-side behaviour.

No followup needed — the boundary is intentional and already documented at the REQ level.

## Item D — Pin-Advance Blast-Radius Statement (engine item 5)

Both candidate commits inspected with `git diff`/`git show` against the runner/transport
surface, comparing the pre-`positive-create-conformance` tree (`1c9d917`, before either change
began) to `HEAD` (`e76bd8f`).

**Axis 1 — Runner invocation surface (bin/argv contract, exports the engine consumes): UNCHANGED.**
`git diff 1c9d917..b66900e -- src/transport/ src/bin/ package.json` touches only
`package.json` (1-line version bump `0.1.0`→`0.2.0`, semver field, not the `bin`/`exports`
maps). `git log 1c9d917..HEAD -- src/transport/ src/bin/ package.json` returns exactly one
commit (`b66900e`, the version bump). `src/transport/runner.ts`'s argv parsing, `RunnerIo`
interface, and its `defineFactory(exportResolution.fn, { packageDir })` call shape
(`runner.ts:309-310`) are byte-identical across the whole range.

**Axis 2 — Single-instance probe behaviour: UNCHANGED.** `src/transport/single-instance-probe.ts`
has ZERO commits touching it in `git log 1c9d917..HEAD -- src/transport/single-instance-probe.ts`
(empty). SEC-07's probe-before-import behaviour is untouched by either change.

**Axis 3 — Exit-code semantics: TAXONOMY UNCHANGED, one failure MODE RETIRED (pre-existing,
transparent to this corpus).**
- `src/transport/exit-codes.ts` (`classifyExitCode`) has ZERO diff across the whole range —
  the `AuthoringError.origin === "authoring-rejected" ? 1 : 2` / `IntentRejectedError → 2` /
  `TransportFault → 3` / fallback `4` mapping is byte-identical.
- `b66900e` (`AuthoringReason` narrowed 12→11, `source-outside-package` dropped) is INVISIBLE
  to the exit-code classifier: `classifyExitCode` reads only `.origin` (a coarser derived
  field), never `.reason`. Read `src/core/authoring-error.ts`'s `originFor()` diff in `b66900e`
  — `source-outside-package` was ALREADY grouped under `"authoring-rejected"` (exit 1) before
  its removal; removing an already-`authoring-rejected` reason changes zero exit-code outcomes,
  it just makes that one reason unreachable (no code path can produce it anymore, since the
  containment check that used to throw it is gone — see next point).
- `6694754` (inline-collection-marker S-000) deletes `resolvePackageRoot` and
  `missingPackageRootMessage` from `src/core/context.ts`, collapsing `RunContext.packageAnchors`
  from `{ packageDir, packageRoot }` to `{ packageDir }` only. This retires the SPECIFIC failure
  mode ADR-0064's own "Context" section traces to derive the reject-twin's exit-2 triple: "no
  `collection.json` ancestor found → `AuthoringError{invalid-input}` → exit 1, before `fn` runs."
  That code path no longer exists. `conformance/collection.json` itself is also deleted
  (confirmed: no `collection.json` at `conformance/` root in the current tree) —
  ADR-0067 self-documents this at its own top: "**Superseded by ADR-0077 (2026-07-28)**: the
  SDK no longer walks for a `collection.json` ancestor at all... `conformance/collection.json`
  is deleted."
  - **Transparent to THIS corpus**: every fixture's factory always had `conformance/
    collection.json` satisfied and always reached `fn` before; now there's no check at all and
    `fn` still always runs. Confirmed empirically — fit-40 (61/61) and the full suite (2401/0)
    both pass with every conformance fixture's factory still reaching `fn` and producing its
    pinned outcome. No observable regression for the corpus this change ships.
  - **NOT transparent as a general statement about the runner's pre-flight surface**: any
    EXTERNAL caller (including the engine's own Go harness spawning this exact runner via the
    pinned submodule) that previously relied on "a factory outside any `collection.json`
    ancestor fails closed at exit 1" will now see that check simply not fire — the factory runs
    unconditionally once `packageDir` resolves. Whether the engine's own conformance test setup
    (`internal/conformance/sdk_emitted_create_test.go`) depends on this retired check is UNKNOWN
    from this repo — **flag as a cross-repo confirmation item for the engine team at pin-advance
    time**, same class as the other "engine repo, cross-repo flag" rows already in
    `openspec/pending-changes.md`.
- **Documentation staleness (non-gating, informational)**: ADR-0064's own "Context" section
  (lines 12-16) still narrates `resolvePackageRoot (src/core/context.ts:144-162)` as the live
  mechanism — that function is deleted. This is a pre-existing staleness introduced by the
  UNRELATED, still-paused `inline-collection-marker` change (not by `positive-create-
  conformance`, which only touched ADR-0064's Amendment section) — out of THIS change's scope
  to fix, but should be swept when `inline-collection-marker` itself archives (it already
  touches `openspec/specs/authoring-error-contract/spec.md` and similar cross-references).

**Summary for the archive report**: invocation surface and single-instance-probe behaviour are
byte-identical; exit-code TAXONOMY is byte-identical; ONE pre-flight failure mode (missing-
collection.json-ancestor → exit 1) is retired by a change unrelated to this one, transparent to
this corpus's own fixtures (empirically confirmed), but reachable by any external caller of the
runner — surface this to the engine team as a confirmation item at pin-advance time, not as a
blocker to THIS change's archive.

---

## Guard Rails (item E)

| Rail | Status |
|---|---|
| No `src/**` in this change's diff | ✅ Confirmed — `git diff 0bd88e4^1..e76bd8f --stat -- src/` is empty |
| `pending-changes.md` row 500 untouched | ✅ Confirmed — `git diff 0bd88e4^1..e76bd8f -- openspec/pending-changes.md` is empty; row 500 text byte-identical |
| Main spec (`openspec/specs/conformance-fixtures/spec.md`) still says "exactly one create" | ✅ Confirmed, and CORRECT for this stage — `rg "exactly (once|one)"` still hits line 64 of the main spec. This is the KNOWN, EXPECTED pre-archive contradiction: `sdd-archive` syncs the delta spec into main at close, not before. Not a finding — the archive step resolves it. |

---

### Verdict

**pass-with-followups**

Full suite 2401/0, targeted fit-40 61/61, typecheck clean, 9/9 REQ scenarios compliant with
mutation-verified evidence on the two new/changed test blocks, TDD adherence clean, code audit
clean (zero gating findings), no sensitive area touched (`adversarial_review: not-required`).
Two non-blocking WARNINGs (uncommitted simplify-report.md; minor test-count inaccuracy in
verify-in-loop-1's self-report) and one already-flagged-but-not-yet-registered pending-changes
row (force-removal followup, design §4.8) need `sdd-archive` to close them out. Composite-options
round-trip coverage confirmed on the SDK side (REQ-TOE-01 + tests); the pin-advance blast radius
is clean on invocation surface and single-instance-probe, with one transparent-but-flaggable
exit-path retirement to hand the engine team as a confirmation item, not a blocker.

**adversarial_review**: not-required — triage M, no sensitive area touched (confirmed at triage
and re-confirmed here: `conformance/` absent from `openspec/sensitive-areas.md`).
