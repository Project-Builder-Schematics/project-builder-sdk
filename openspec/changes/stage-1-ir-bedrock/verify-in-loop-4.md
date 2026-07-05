## Verify In-Loop Result

**Change**: stage-1-ir-bedrock
**Iteration**: 1/3 (first verify pass over **batch 3**; change-wide file named
`verify-in-loop-4` per orchestrator sequencing — batch 1 used `-1`/`-2`, batch 2 used `-3`)
**Scope**: S-1.7 only (JSON round-trip fidelity + paths verbatim + conflict order)
**Mode**: in-loop (Strict TDD)
**Baseline**: `27f01bf` (closed batch 2 — S-1.4/S-1.5-1.6/S-1.8/S-1.9 verified — out of scope
except as regression surface). Under review: the uncommitted working tree on
`feat/stage-1-ir-bedrock`.

---

### Verdict: PASS

All slice scope checks are green. Loop can exit for this batch.

- Tasks in scope complete: 4/4 (RED must-fail-first + characterization-RED-waived + GREEN +
  verify — per `apply-progress-s17.md` "Status: complete"; `slices.md` checkboxes for S-1.7
  remain `[ ]`, consistent with the project's own convention observed in batch 2's verify —
  checkbox reconciliation happens at batch-commit time, not during apply)
- Affected tests passed: 19/19 (targeted: boundary-pass-through 9, batch-cap 3,
  move-fail-closed 4, modify-existence 3) + 232/232 (full suite)
- Spec compliance for scope: 7/7 boundary REQ-IDs compliant (REQ-01.1, REQ-02.1, REQ-02.2,
  REQ-02.3, REQ-03.1, REQ-04.1, REQ-04.2)
- Assertion audit: clean — no banned patterns in the delta test file
- Regression check: S-1.3 fail-closed (REQ-FAKE-04.m1–.m4) + S-1.3 modify-existence
  (REQ-FAKE-07.1–.3) + S-1.4 cap (REQ-01.1–.3) all green, unchanged threshold/message
- Scope discipline: clean — delta is exactly S-1.7 files; nothing from S-1.1 present

Orchestrator action: mark S-1.7 done, commit batch 3, proceed to next batch (S-1.1) per
Build Order.

---

### Execution Evidence

| Command | Result |
|---|---|
| `bun test` (full suite) | **232 pass / 0 fail**, 370 `expect()` calls, 40 files, 1.99s |
| `bunx tsc --noEmit` (full project) | exit 0, no output — clean |
| `bun test test/fake/boundary-pass-through.test.ts test/fake/batch-cap.test.ts test/fake/move-fail-closed.test.ts test/fake/modify-existence.test.ts` | **19 pass / 0 fail**, 34 `expect()` calls, 4 files |

Full-suite delta vs batch 2's closing count (`223` → `232`) is exactly `+9`, matching the 9
new tests in `boundary-pass-through.test.ts` — no test count drift elsewhere.

No step exceeded the in-loop time budget; no step was skipped.

---

### `emit()` End-to-End Read (post-refactor)

Read `test/support/contract-fake.ts` in full and diffed against baseline `27f01bf`. The delta
is exactly:

```
+ module-level deepEqual(a, b) — structural equality (arrays by length+recursion,
+ objects by Object.keys length+membership+recursion, primitives by ===)

  emit(batch):
+   try { serialized = JSON.stringify(batch) }
+   catch (err) { throw "ContractFake: batch failed JSON serialization: ..." }
    const size = Buffer.byteLength(serialized /* was: JSON.stringify(batch) inline */, "utf8")
    if (size > BATCH_CAP_BYTES) throw "ContractFake: batch exceeds size cap — ..."  // UNCHANGED
+   const roundTripped = JSON.parse(serialized)
+   if (!deepEqual(batch, roundTripped)) throw "ContractFake: batch failed round-trip
+     fidelity check: non-JSON-safe value detected"
    for (const directive of batch.instructions) this.#apply(directive, batch.force)  // UNCHANGED
```

Confirmed by direct diff: **zero** changes to `#apply`, `#exists`, `#getContent`, `read`,
`commit`, `discard`, or any of the six op branches (create/modify/delete/rename/copy/move).
The move fail-closed check (`!this.#exists(src)` in the `move` branch) and the
modify-existence check (`!this.#exists(p)` in the `modify` branch) are byte-identical to
`27f01bf`.

**Check order, precisely stated**: `emit()` runs three batch-level guards in sequence —
stringify-throw guard → cap check (reusing the same `serialized` string) → round-trip
compare — all **before** the per-directive `#apply` loop where move-fail-closed and
modify-existence live. This is the same architecture batch 2's verify (`verify-in-loop-3.md`,
Cross-Slice Integration Check item 1) already flagged as **spec-silent and untested**: no REQ
specifies precedence when a batch is simultaneously invalid on more than one axis (e.g.
over-cap AND non-JSON-safe AND containing a colliding/missing-source move). That note is
carried forward unchanged by this batch — round-trip joins cap as a batch-level pre-check
that necessarily runs before any per-directive semantic check, for the same reason cap does:
you cannot judge an individual directive's fail-closed rule mid-application of a batch that
turns out to be malformed as a whole. Design row 4.2/1.3's "(a) move fail-closed; then (b)
cap; then (c) round-trip" reads — per the Architecture Overview's own "`emit`/`#apply` are
edited in sequence 1.3 → 1.4 → 1.7" framing and the Migration/Rollout section's identical
"1.3 → 1.4 → 1.7" phrasing — as the **slice build sequence**, not a claimed runtime
precedence contract; no scenario in `specs/boundary-pass-through/spec.md` or
`specs/batch-cap-contract/spec.md`-equivalent constructs a batch exercising more than one
guard at once, so this reading is not falsified by any test. Non-blocking, same as batch 2.

---

### REQ Coverage Check (S-1.7 scope)

| REQ-ID | Test | Result |
|---|---|---|
| boundary REQ-01.1 (clean round-trip applies, false-rejection guard) | `boundary-pass-through.test.ts` | ✅ green |
| boundary REQ-02.1 (function value rejects) | same file | ✅ green |
| boundary REQ-02.2 (undefined + Symbol reject, silent-drop family) | same file | ✅ green (2 cases) |
| boundary REQ-02.3 (BigInt + circular reject, stringify-throw family) | same file | ✅ green (2 cases) |
| boundary REQ-03.1 (path verbatim, characterization) | same file | ✅ green |
| boundary REQ-04.1 (`[create X, delete X]` → absent, characterization) | same file | ✅ green |
| boundary REQ-04.2 (`[delete X, create X]` → present, characterization) | same file | ✅ green |

**Binding-contract spot checks**:
- Silent-drop family (function/undefined/Symbol) and stringify-throw family (BigInt/circular)
  verified as **separately implemented and separately tested** mechanisms: silent-drop is
  caught by `deepEqual` structural comparison (message: `"...round-trip fidelity check:
  non-JSON-safe value detected"`); stringify-throw is caught by the `try/catch` around
  `JSON.stringify` (message: `"...failed JSON serialization: \"<engine message>\""`). No
  raw/uncaught engine message reaches the caller in either family — confirmed both by reading
  the code (both paths always throw a `ContractFake:`-prefixed `Error`) and by running the
  BigInt/circular tests, which assert `.rejects.toThrow(/failed JSON serialization/)` rather
  than an unhandled-rejection crash.
- REQ-01.1 false-rejection guard: test uses a batch with plain JSON-safe values
  (`{a: 1, b: "two", c: [true, null]}`) and asserts the batch **applies** (`fake.read(...)`
  returns `"content"`) — confirms the new round-trip check does not reject legitimate input.
  This is the guard the binding contract calls out explicitly; present and passing.
- REQ-03.1 and REQ-04.1/.2 are characterization pins: confirmed zero production change to path
  handling or `#apply`'s array-order iteration (diff-verified above) — they pin, not alter,
  today's behavior, matching the spec's own RED-waived posture for REQ-04 and the "no
  production change to path handling" framing for REQ-03.
- One deviation from literal spec wording, judged non-blocking: REQ-03.1's Given/When/Then
  says "a read of the literal key returns the content," but the test asserts via
  `fake.committedTree().get(...)` rather than `fake.read(...)`. `apply-progress-s17.md`
  documents why: `read()` binds exclusively to the staging tree (`#tree`) per ADR-01, and by
  the time the spy captures the emitted batch, `run()` has already completed and called
  `commit()`, which clears `#tree`. Asserting via `committedTree()` is the only way to check
  the literal key post-commit and matches the existing pattern in
  `test/skeleton/write-only-factory.test.ts`. This still proves REQ-03.1's actual claim (the
  key crossing the seam is byte-identical, unresolved) — a naming/wording gap between spec
  prose and test mechanics, not a behavioral gap. Flagged as SUGGESTION only: consider
  tightening REQ-03.1's scenario wording in a future spec revision to say "a query against
  the tree that holds the literal key" rather than "a read," to avoid this class of question
  recurring.

7/7 REQ-IDs in scope, no orphans, no duplicates — matches `slices.md`'s own count ("S-1.7 (4)"
task-count / boundary domain "REQ-01, REQ-02, REQ-03, REQ-04" 7-scenario total per
`specs/boundary-pass-through/spec.md`).

---

### Regression Check (cap + fail-closed semantics post-refactor)

Explicitly re-ran the suites this refactor's shared-code-path touches:

| Suite | REQ-IDs | Result | Notes |
|---|---|---|---|
| `test/fake/batch-cap.test.ts` | REQ-01.1–.3 (batch-cap domain) | ✅ 3/3 pass | Exactly-at-cap accepted, over-cap rejected with unchanged `/exceeds/` message; cap predicate (`Buffer.byteLength(serialized, "utf8")` vs `BATCH_CAP_BYTES`) byte-identical to pre-S-1.7 — confirmed by diff, the only change is reusing the `serialized` local instead of a second inline `JSON.stringify(batch)` call. Same value, same comparison, same threshold. |
| `test/fake/move-fail-closed.test.ts` | REQ-FAKE-04.m1–.m4 | ✅ pass (part of 19/19) | `#apply`'s `move` branch untouched by this diff (confirmed via `git diff 27f01bf -- test/support/contract-fake.ts` — no hunks touch lines 228–253) |
| `test/fake/modify-existence.test.ts` | REQ-FAKE-07.1–.3 | ✅ pass (part of 19/19) | `#apply`'s `modify` branch untouched by this diff (no hunks touch lines 165–177) |

No behavioral change detected in cap or fail-closed semantics. The only structural change to
the shared path is that the cap check and the new round-trip check now share one
`JSON.stringify` call (guarded by the new try/catch) instead of the cap check computing its
own inline serialization — a correctness fix in its own right, since an unguarded
`JSON.stringify` on a BigInt/circular batch would previously have thrown synchronously inside
an `async` method (unhandled rejection with a raw engine message), which is precisely the
crash REQ-02.3 forbids. This merge is documented in `apply-progress-s17.md`'s Integration
Notes and is corroborated by the passing BigInt/circular tests.

---

### TDD Evidence Audit (per `apply-progress-s17.md`)

| Task | Verdict | Notes |
|---|---|---|
| Silent-drop round-trip (REQ-02.1/.2) | clean | RED evidence is a genuine assertion-failure message (`Expected promise that rejects, Received promise that resolved`) against pre-fix `contract-fake.ts` — plausible: no round-trip check existed before this diff, so a function/undefined/Symbol-bearing batch would have applied silently. Triangulated: 3 distinct cases (function, undefined, Symbol) covering the family's 3 distinct JS mechanisms. |
| Stringify-throw guard (REQ-02.3) | clean | RED evidence is the actual raw engine message (`"JSON.stringify cannot serialize BigInt."` / `"...cyclic structures."`) instead of the `ContractFake:`-prefixed rejection — consistent with the pre-fix code having no try/catch around the inline `JSON.stringify` call. Triangulated: 2 cases (BigInt, circular) covering the family's 2 distinct triggers. |
| False-rejection guard (REQ-01.1) | clean, judgment documented | Honestly labeled "n/a — written to pass immediately once GREEN lands"; the apply-progress explicitly reasons through why this is legitimate (a guard test, not a must-fail-first scenario) rather than silently mislabeling it. Single representative shape is appropriate for a negative/pass-through guard, not itself a branch requiring triangulation. |
| Characterization pins (REQ-03.1, REQ-04.1, REQ-04.2) | clean | Correctly labeled RED-waived per the spec's own posture; zero production change confirmed by diff — these are prove+freeze, not new behavior. |

No banned assertion patterns found in `boundary-pass-through.test.ts` (`toBeDefined()`,
`toBeTruthy()`/`toBeFalsy()` without context, `objectContaining` as sole assertion,
`not.toThrow()` as sole assertion, mocks mirroring implementation, tests of private state —
all absent by direct read; the file's `spyOn(fake, "emit")` usage observes a real fake, not a
mock standing in for one, matching the established pattern in
`test/skeleton/write-only-factory.test.ts` / `test/fake/batch-cap.test.ts`). Every `.rejects`
assertion pins a specific message-pattern regex, not a bare negative.

---

### Scope Audit

Delta vs baseline `27f01bf` (via `git status` + `git diff --stat`):

**Modified** (2 files): `.sdd/state/stage-1-ir-bedrock.json` (orchestrator bookkeeping —
`phase_status` string update only, no other keys touched) · `test/support/contract-fake.ts`
(diff-confirmed: `deepEqual` addition + `emit()` rewiring only — no touch to `#apply` or any
other method)

**Created** (2 paths): `test/fake/boundary-pass-through.test.ts` (S-1.7, 9 tests) ·
`openspec/changes/stage-1-ir-bedrock/apply-progress-s17.md` (expected bookkeeping)

Every file maps to S-1.7's own task list or expected bookkeeping. **Confirmed absent**: no
`test/golden-ir/*` changes (S-1.1, correctly deferred to the next batch per Build Order
S-1.3 → S-1.4 → S-1.7 → S-1.1) — `slices.md` itself is untouched in this delta (checkbox
reconciliation, per the pattern observed in batch 2, happens at batch-commit time, not
during apply).

---

### Non-Blocking Notes (carried forward / new)

1. **Cap/round-trip-vs-fail-closed ordering** (carried forward from batch 2's note #1,
   extended here to include round-trip) remains untested and spec-silent — no scenario
   constructs a batch invalid on more than one axis simultaneously. Not a defect; worth a
   design footnote only if Stage 2.1 needs deterministic "which rejection the author sees
   first" semantics.
2. **REQ-03.1 wording vs test mechanics** (detailed above under REQ Coverage Check) — spec
   says "a read," test uses `committedTree()` for a documented, sound reason. SUGGESTION:
   tighten scenario wording in a future spec revision.
3. `slices.md` checkboxes for S-1.7 remain `[ ]` pending batch-commit reconciliation — same
   pattern as batches 1 and 2, not a completeness gap.

None of the above block this batch's PASS verdict.

---

### Skill Resolution

`fallback-registry` — the launch prompt's "Project Standards (auto-resolved)" block contained
only a brief inline TypeScript/Bun/Strict-TDD note, not a full compact-rule injection from the
skill registry. Proceeded using the codebase's own established conventions (assertion style,
`ContractFake:`-prefixed error convention, `spyOn`+`defineFactory` pattern from sibling test
files) as the pattern source, read directly from the artefacts and source per instructions.
Orchestrator should re-resolve the skill registry if this recurs across further batches.
