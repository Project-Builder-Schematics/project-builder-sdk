## Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-001
**Mode**: in-loop (Strict TDD)
**Date**: 2026-07-15

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 7/7 (S-001.1–.7, incl. fit-32) — all `[x]` in `slices.md`
- Tests: **1480 pass / 0 fail** (160 files) — full `bun test` run, matches `apply-progress.md`'s claim exactly
- Typecheck: `bunx tsc --noEmit` — clean, zero errors
- Spec compliance for scope: 8/8 REQ-IDs (WPS-03, WPS-04, WPS-07, WPS-08, SEC-04, SEC-05, SEC-08, SEC-10) have named, passing, behaviorally-real tests
- fit-32 (cap-single-source): built, green, red-proofed (6 planted-violation sub-tests + non-vacuity check), read in full — the sole `>`/`<` `BATCH_CAP_BYTES` comparison lives in `wire.ts::exceedsBatchCap`; no re-derived comparison or spelled-out literal across `src/transport/**`, `src/testing/contract-fake.ts`, `test/fake/**`
- Regression: S-000's e2e (`fake-engine-harness.e2e.test.ts`) + fit-10/29/30 all still green (437 pass across `test/fitness/` + the e2e file); the S-000 client-header "trusts the next frame" boundary note is CONFIRMED GONE — replaced by `stdio-engine-client.ts:9-11`'s "Scope boundary (S-000, happy path only) CLOSED by S-001: routing/discard (WPS-03), fail-closed propagation (SEC-08), injectable timeout (SEC-05), and the EmitRejection precondition/degrade (SEC-04) all now hold."
- Assertion audit (delta test files): clean — zero banned patterns (`toBeDefined()`/`toBeTruthy()`/`objectContaining`-as-whole-assertion/`not.toThrow()`-only) found across all 7 new/modified S-001 test files; every assertion checks an exact value, not shape/presence
- Triangulation: every conditional/branching function has ≥3 driving cases (`exceedsBatchCap` 5, `reconstructEmitRejection`'s degrade path 3, `parseFactoryPointer` 4, frame-reader's fault matrix 3 EOF variants + 2 desync/malformed)
- Code smells: zero `TODO`/`FIXME`/`as any`/`as unknown as` introduced in the S-001 diff (verified via diff scan, not trusted from the report)

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive.

---

### Real Execution Evidence

```
$ bun test
 1480 pass
 0 fail
 3027 expect() calls
Ran 1480 tests across 160 files. [21.06s]

$ bunx tsc --noEmit
(clean, no output, exit 0)

$ bun test test/transport/frame-reader.unit.test.ts test/transport/error-text.unit.test.ts \
    test/core/wire.test.ts test/transport/framing.unit.test.ts \
    test/transport/stdio-engine-client.unit.test.ts test/transport/factory-pointer.unit.test.ts \
    test/fitness/fit-32-cap-single-source.test.ts
 106 pass / 0 fail / 163 expect() calls

$ bun test test/fitness/ test/fake/fake-engine-harness.e2e.test.ts   # regression guard
 437 pass / 0 fail across 34 files
```

### Acceptance Spot-Checks (read + executed)

| Acceptance clause | Test | Result |
|---|---|---|
| Exactly-one-dispatch reassembly (split/coalesced/EOF) | `frame-reader.unit.test.ts` — SEC-10.1–.5 | PASS — split-prefix, split-payload, coalesced-x2, complete+partial, EOF-mid all assert exact dispatched arrays/fault kinds |
| Cap rejects before alloc; exact-cap accepted, `0x80000000` rejected | `framing.unit.test.ts` + `wire.test.ts` — WPS-04.1–.4 | PASS — `isOversizeDeclaredLength(BATCH_CAP_BYTES)` false, `+1` true, `0x80000000` true (unsigned-read triangulation); outbound `exceedsBatchCap` mirrors on Batch fixtures |
| Routing discards wire-silent + stderr-noted with liveness | `stdio-engine-client.unit.test.ts` — WPS-03.1–.3 | PASS — unknown-type / absent-type / stale-id discarded, `stderrNotes` populated, genuinely-pending call resolves after TWO discards |
| Injectable timeout, slow-success no stray reject | `stdio-engine-client.unit.test.ts` — SEC-05.1/.2 | PASS — hung host times out classified `kind:"timeout"`; slow-but-before-bound resolves + 250ms grace period proves no stray rejection |
| Rejection mapping honors `failedIndex`, degrades to `unknown` | `stdio-engine-client.unit.test.ts` — SEC-04.1–.3, WPS-08.2/.3 | PASS — directive-level carries index, batch-level omits it, 3 out-of-contract payloads (bogus code / batch-level+index / negative index) all degrade to `"unknown"`, explicit `"unknown"` round-trips without special-casing |

### Deviation Adjudication (apply-progress.md § Discoveries/Deviations)

**1. SEC-04.3's `code:"unknown"` reached via `as EmitRejectionCode` cast, not a type extension.**
**Verdict: conformant-with-rationale, no finding.**
`core/emit-rejection.ts` is marked Read-only in `design.md` § 4.2's File Changes table — extending `EmitRejectionCode` there would itself be a design violation. Read the cited precedent (`test/skeleton/authoring-error.test.ts:235`): `new EmitRejection("quota-exceeded" as EmitRejectionCode, ...)` is pre-existing, established codebase idiom for exactly this situation (an out-of-band code reaching the domain type), with `toAuthoringError`'s `CODE_TO_REASON[...] ?? "unknown"` lookup (unmodified) doing the actual degrade downstream. The implementer followed the codebase's own prior art rather than touching a Read-only file. `tsc --noEmit` confirms the cast type-checks cleanly.

**2. `exceedsBatchCap` widened to a `Batch | number` overload vs design § 4.3's literal `(batch: Batch): boolean`.**
**Verdict: conformant-with-rationale, no finding.**
Read `src/core/wire.ts:79-84`: this is a proper TS function overload — `exceedsBatchCap(batch: Batch): boolean` and `exceedsBatchCap(subject: number): boolean` are BOTH exported overload signatures; the Batch-typed call form design gives verbatim still type-checks exactly as written, so this is additive, not a breaking signature change. It is also necessary: WPS-04.2/.4's inbound leg (`framing.ts::isOversizeDeclaredLength`) has only a raw declared length prefix — no `Batch` exists yet to construct — so a Batch-only signature could not serve that leg. The alternative (a second private, non-exported comparison function) would satisfy fit-32's mechanical scan (which excludes `wire.ts`) while violating fit-32's own documented INTENT (design § 4.7: "the `> cap` comparison lives only in `exceedsBatchCap`") more than the chosen overload does — there is exactly one `>` comparison in the codebase (`wire.ts:83`), inside `exceedsBatchCap`'s single implementation. The overload satisfies the letter and the spirit of the fitness function better than the design's literal single-argument form would have.

**3. WPS-04's outbound cap check lives in `stdio-engine-client.ts::emit()`, not `framing.ts`.**
**Verdict: conformant-with-rationale, no finding.**
Spec is normative here per the Executor Context table's own rule ("the algorithm itself is spec-normative, not design-normative" — stated for WPS-07, and the same principle applies: design § 4.2's File Changes table is a one-line prose Purpose column, not a literal contract in the § 4.3 sense). Spec Scenario REQ-WPS-04.1 explicitly requires "the client rejects with `EmitRejection{code:"cap"}` locally" — `EmitRejection` is a domain/core construct (`src/core/emit-rejection.ts`); `framing.ts` is chartered (design § 4.2: "Single owner of frame encode/decode") as a pure protocol codec with no dependency on domain types, confirmed by reading `framing.ts` in full — it imports only `exceedsBatchCap` from `wire.ts`, nothing from `core/emit-rejection.ts`. Only `stdio-engine-client.ts` (the class that already imports `EmitRejection` for SEC-04) can construct the scenario's required domain object. Read `stdio-engine-client.ts:168-171` (`emit()`) and confirmed via test (`WPS-04.1` — `channel.written` stays `[]`, no wire write) that the reject-before-write behavior holds regardless of which file owns it. `framing.ts` correctly retains the INBOUND raw-length leg where "reject-before-alloc" is literal (no buffer allocated for the declared body before the check).

None of the three deviations rise to ARCHITECTURAL or SPEC halt category — all three are spec-driven or Read-only-contract-driven necessities, verified against actual file contents and actual type-checking, not just the implementer's narrative.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 7 test files (6 unit test files touched/created + 1 new fitness test), 8 impl files (`frame-reader.ts`, `error-text.ts` [new], `wire.ts`, `framing.ts`, `stdio-engine-client.ts`, `runner.ts`, `factory-pointer.ts` [new], `contract-fake.ts`)

#### Findings
None.

#### Tolerated for now (flagged for final)
- S-001.1c's four `[characterization]`-labeled tests (SEC-10.1–.4) pin pre-existing S-000 buffering behavior rather than driving new production code — spot-checked against `frame-reader.ts`'s `#drainCompleteFrames` loop, which is structurally unchanged from S-000 for the coalesced/split-frame buffering path (only the EOF-fault throw and the reject-before-alloc oversize check are new S-001 additions ahead of it). Labeling is accurate, consistent with the project's fit-10-established `[characterization]` convention. Final-mode should confirm this convention is applied consistently project-wide, not just spot-checked here.
- TDD cycle granularity is per-task-within-a-slice-commit (tests and implementation land in the same commit, e.g. `b608fd2`), not per-cycle commits — consistent with S-000's already-verified convention (`verify-in-loop-1.md`); RED evidence is captured narratively in the apply-progress TDD Cycle Evidence table (actual error messages/assertion failures pre-implementation) rather than via separate commits. Acceptable per `strict-tdd-verify.md`'s "if the project does not commit per cycle... the audit relies on Methods 1 and 2 only."

#### Halts (if verdict = halt)
N/A — no halt.

---

### Slice Audit Notes Cross-Check

`apply-progress.md`'s own Step 7c notes (Groups 1-3, no Bug/Architecture/MAJOR findings) were spot-verified rather than trusted: REQ coverage confirmed independently (table above), fit-32 confirmed green + red-proofed by direct execution, zero unsafe-cast/TODO/FIXME confirmed via `git diff` scan of the full S-001 diff (`479f9c0..HEAD`). No discrepancy found between the claimed audit and the actual diff.
