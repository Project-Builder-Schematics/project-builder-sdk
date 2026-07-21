## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 3/3 (change-wide numbering; iteration 1/1 for this S-001 batch)
**Scope**: S-001 (loud collision reject)
**Mode**: in-loop (Strict TDD)
**Slice commit**: `d6e71d7` (diff vs `1f8912e`)

---

### Verdict: PASS

All scope checks green with real execution evidence. RED re-verified against the pre-slice
implementation and matches the claimed 8 failures exactly, for the claimed reason. Behaviour
preservation confirmed for the `assertNoCollision` extraction. Two non-blocking observations
below (SUGGESTION-level); neither is CRITICAL, neither blocks this iteration.

- Tasks in scope complete: 5/5 (S-001.1–S-001.5, all `[x]` in slices.md)
- Targeted tests: 118/118 pass (357 expect() calls) —
  `test/dialects/typescript/` + `test/core/dialect-handle.test.ts`
- Full suite: 2075/2075 pass, 0 fail, 4517 expect() calls, 191 files — matches apply-progress's
  claim exactly (2064 S-000 baseline + 11 new: 8 reject cases + `.28` + 2× `.24`)
- Typecheck: clean (`tsc --noEmit`, zero output)
- RED re-verification: 8/8 claimed genuine-RED cases confirmed failing, for the claimed reason,
  against the pre-Step-2 `ops.ts` (`1f8912e`); working tree restored byte-clean afterward
  (`git diff`/`git status` empty)
- Spec compliance for scope: 10/10 REQ-IDs hold (`.6`, `.8`, `.14`, `.16`, `.17`, `.24`, `.26`,
  `.27`, `.28`, `.32`)
- Behaviour preservation: `ops-declarations.test.ts` has ZERO assertion diff in the commit and
  is fully green (11/11 — see Observation 1 on the apply-progress count discrepancy)
- Assertion audit (Strict TDD, delta): no banned patterns, no triangulation gaps, no regressions

Orchestrator action: exit loop, proceed to next slice (`/build --scope=slice:S-002` or
`slice:S-003` per Build Order) or to `/evaluate` (mode=final) once all slices land.

---

### Execution Evidence (real runs, this session)

```
$ bun test test/dialects/typescript/ test/core/dialect-handle.test.ts
118 pass / 0 fail / 357 expect() calls — 10 files, 7.23s

$ bun test   (full suite)
2075 pass / 0 fail / 4517 expect() calls — 191 files, 45.32s

$ bun run typecheck   (tsc --noEmit)
(no output — clean)

$ bun test test/dialects/typescript/ops-declarations.test.ts
11 pass / 0 fail / 29 expect() calls — 1 file, 3.00s
```

---

### RED Re-Verification (real execution against pre-Step-2 code)

Procedure: `git show 1f8912e:src/dialects/typescript/ops.ts` written over the current file,
targeted suite run, then the post-slice file restored via the pre-saved copy and confirmed
byte-clean (`git diff`/`git status --short src/dialects/typescript/ops.ts` both empty; a
follow-up green run of the same suite confirmed the restore was a genuine, working restore, not
just a byte-identical file with stale state).

```
$ bun test test/dialects/typescript/ops-addImport.test.ts test/dialects/typescript/dialect.test.ts
(fail) REQ-TSD-01.6:  type-only DECLARATION collision — rejects before any AST mutation
(fail) REQ-TSD-01.8:  inline `{ type X }` specifier-level type-only collision
(fail) REQ-TSD-01.14: aliased-to-a-different-name collision
(fail) REQ-TSD-01.16: cross-module collision
(fail) REQ-TSD-01.17: 8-kind value-namespace battery (single `it`, all 8 sub-cases inline)
(fail) REQ-TSD-01.26: type-only DEFAULT specifier collision
(fail) REQ-TSD-01.27: type-only NAMESPACE specifier collision
(fail) REQ-TSD-01.32: 29-char name echoed in full

26 pass / 8 fail / 69 expect() calls — 34 tests total, 2 files
```

Exactly the 8 claimed cases fail, exactly `.28` (GREEN pair) and both `.24` cases pass
unaffected — matches apply-progress's TDD Cycle Evidence table row-for-row. Failure reason
matches the claim: `expect(caught).toBeInstanceOf(Error)` — `Expected constructor: [class
Error] / Received value: undefined` — the pre-Step-2 code never threw; it silently
merged/created instead, exactly as documented (verified this literal error text on 5 of the 8,
spot-checked; the other 3 share the identical helper-driven assertion so the shape is
structural, not case-specific).

**Restore verification**: post-restore `bun test` on the same two files: 34/34 pass, 0 fail —
confirms the working tree returned to the exact pre-check-out (post-slice) state.

---

### Scenario Spot-Checks (assertion discrimination — not just "does it throw")

| Scenario | What was checked | Result |
|---|---|---|
| `.17` 8-kind isolation | Each of the 8 kinds (`function`/`const`/`let`/`var`/`class`/`enum`/`namespace`/`export default function`) runs through `expectCollisionReject`, which calls `makeSpyClient` FRESH per invocation — no shared AST/fixture state leaks between iterations, so each is a genuinely isolated case, not a cumulative one. Each iteration asserts both the `addImport("Icon")` echo AND the collision-specific substring, not a bare `toThrow()`. | Genuine isolation confirmed by reading `expectCollisionReject`'s implementation (fresh `makeSpyClient` call per invocation) and by the RED re-run above, where all 8 sub-cases failed together as one `it` (consistent with 8 independent assertion sequences inside one loop, not one lucky case masking 7 silent passes) |
| `.24` ordering, both variants | Case 1 (chained call against a freshly-seeded already-bound fixture) and Case 2 (fresh `Project`, seeded with a prior run's own output) both assert `collectModifies(emitted)).toHaveLength(0)` — zero directives, i.e. no throw AND no mutation, the correct outcome per spec ("NEVER a collision reject"). An unguarded `await run(...)` means an actual throw would fail the test outright (no try/catch), so "no throw" is implicitly enforced even though not asserted by name. | Both pass on the current implementation; both pass unmodified (per apply-progress, expected — no competing Step 2 existed pre-slice for them to guard against, becomes a genuine regression guard now that Step 2 exists) |
| `.32` uncut echo | Asserts `err.message).toContain("NotificationPreferencesPanel")` — the full 29-char name, not a prefix/suffix fragment. A truncation mutant (cutting to e.g. 16 chars, mirroring the S-002 validation-reject bounded-echo convention) would produce a message NOT containing the full string, so `toContain` on the full name correctly kills that mutant class. | Confirmed by inspection; RED-side failure for `.32` in the pre-Step-2 run was the generic "no throw at all" failure (no echo existed yet to check), consistent with the claim |

**Distinguishing-substring requirement (QA M4)**: every one of the 8 reject tests asserts
`.toContain('a value or import binding named "{name}" already exists')` in addition to the
`addImport("{name}")` echo — satisfies the spec's explicit requirement that a bare `toThrow()`
or a check on the shared `"dialect operation failed: "` prefix alone does NOT satisfy these
scenarios. Confirmed by direct read of `ops-addImport.test.ts` lines 139–218.

---

### Behaviour-Preservation Check (`assertNoCollision` extraction)

`git diff 1f8912e..d6e71d7 -- test/dialects/typescript/ops-declarations.test.ts` → **empty diff**
— zero assertion changes, confirming the extraction of `isValueNamespaceClaimed` out of
`assertNoCollision` did not require touching the sibling-ops collision suite at all. Full run:
11/11 pass, 29 expect() calls, all green.

Source diff review (`src/dialects/typescript/ops.ts`) confirms the extraction is mechanically
behaviour-preserving: `assertNoCollision`'s `collides` expression now reads
`isValueNamespaceClaimed(ast, name) || ast.getImportDeclarations().some(...)` — the second half
(the import-scan) is byte-identical to what it was before extraction, still keyed off
`assertNoCollision`'s own named-imports-only posture (confirmed unchanged — the extraction only
pulled the five `ast.getFunction/getVariableDeclaration/getClass/getEnum/getModule` calls into
the new function, it did not touch or generalize the import half).

**Note**: apply-progress.md's TDD Cycle Evidence table (row `S-001.5`) claims
`ops-declarations.test.ts` is "14/14 unchanged" — the actual file has **11** `it(...)` blocks and
the real run reports **11 pass**, not 14. See Observation 1 below; this is a documentation
accuracy issue only, not a functional one — the behaviour-preservation claim itself (zero
assertion diff, full green) is independently verified and correct.

---

### Collateral Fixture Fix Verification

`git show d6e71d7 -- test/core/dialect-handle.test.ts`:

```diff
-      await ts.find("a.ts").addImport("x", "m").removeImport("x", "m");
+      await ts.find("a.ts").addImport("y", "m").removeImport("y", "m");
```

Confirmed as claimed: a pure rename (`"x"` → `"y"`), no other change to the test. The test's own
subject — RYOW (read-your-own-writes) add+remove chaining, `REQ-TSD-08.6` — is untouched; the
fixture's pre-existing top-level `const x = 1;` is what now correctly collides with
`addImport("x", "m")` under the new Step 2, an incidental name choice unrelated to the test's
actual assertions. The rename avoids the unrelated collision without altering what the test
proves.

---

### Ordering Invariant (source-level confirmation)

`addImport`'s body (`src/dialects/typescript/ops.ts:132-159`): the `alreadyBound` check
(Step 1) is computed and its early-return (`if (alreadyBound) return;`) executes strictly BEFORE
the `claimed` check (Step 2) is even computed — not just test-order, but a structural
if-return gate in source. Matches REQ-TSD-01.24's ordering invariant exactly; the `.24`
mutant-kill tests would catch a reordering regression.

---

### Strict TDD (in-loop audit, delta)

**Iteration**: 3 (this batch)
**Verdict**: ok
**Delta scope**: 2 test files modified (`ops-addImport.test.ts`, `dialect.test.ts`) + 1
collateral test file (`dialect-handle.test.ts`, rename only) + 1 impl file (`ops.ts`)

- No banned assertion patterns introduced (no bare `.toBeDefined()`/`.toBeTruthy()`, no
  snapshot-only tests, no mock-mirrors-implementation, no assertions on private state).
- `err.cause).toBeUndefined()` inside the shared `expectCollisionReject` helper is weak in
  isolation (per `dialect-error.ts`'s own contract, `.cause` is ALWAYS absent from any
  `dialectError`, so this conjunct can't discriminate a correct implementation from a buggy one
  on its own) — but it is one of three conjuncts in the helper (Error-instance check + cause
  check + byte-unchanged read-back), and the surrounding two conjuncts do the real
  discriminating work. Not flagged as a finding — informational only.
- Triangulation: `isValueNamespaceClaimed`'s 5-branch OR-chain gets 8 distinct driving cases
  (`.17`'s battery); the import-specifier claimed-scan gets 6 distinct driving cases
  (`.6`/`.8`/`.14`/`.16`/`.26`/`.27`); the Step 1→2 ordering gate gets 2 direct cases (`.24`)
  plus 1 indirect regression guard (`.28`). No triangulation gaps found.
- Regression: full suite green, 0 previously-passing tests broken (2064 S-000 baseline → 2075,
  +11 new tests, 0 removed, 0 flipped).

---

### Observations (non-blocking, SUGGESTION-level)

**Observation 1 — apply-progress.md evidence-count mismatch (LOCAL, cosmetic)**: the S-001 TDD
Cycle Evidence table (row `S-001.5`) states `ops-declarations.test.ts`'s suite is "14/14
unchanged." The actual file (`test/dialects/typescript/ops-declarations.test.ts`, 213 lines —
line count matches) has 11 `it(...)` blocks; the real run reports 11 pass, 0 fail. The
underlying claim (zero assertion changes, behaviour-preserving, fully green) is independently
verified and correct — only the specific count cited is wrong. Recommend the Executor correct
the count in apply-progress.md for evidence hygiene; does not affect the verdict.

**Observation 2 — collision-reject dual observable doesn't explicitly assert `collectModifies`
(informational, no fix needed)**: S-000's iteration-1→2 fix established the project convention
that a no-op/reject dual observable should assert BOTH `collectModifies(emitted).toHaveLength(0)`
AND the byte-unchanged read-back (see `verify-in-loop-2.md`'s "Mutation-Mindset Spot Check").
S-001's `expectCollisionReject` helper only captures `{ client }` from `makeSpyClient` (discards
`emitted`) and asserts the byte-unchanged read-back only — it does not call `collectModifies`
explicitly. Investigated whether this is a real gap by reading `dialect-handle.ts`'s `runOp`
(lines 275-284): `#ensureOpen()` — the ONLY call site that buffers a directive
(`session.buffer(this.#openDirective)`) — runs strictly AFTER `#invokeContained(fn, ...)`
resolves without throwing. Since `addImport`'s Step 2 throws synchronously before returning, a
collision-reject run can NEVER reach `#ensureOpen()`, so a directive is structurally impossible
to have been buffered — zero directives is guaranteed by construction whenever the read-back is
byte-unchanged. Unlike S-000's no-op case (where the op returns normally and `#ensureOpen()`'s
own "same print as baseline" gate is what suppresses the directive — a gate that COULD have a
bug), there is no equivalent gate to fail here. Downgraded from a WARNING to informational: not a
functional gap, just a stylistic deviation from the established explicit-both-halves pattern.
No fix recommended.

---

### Files Reviewed

- `git show d6e71d7 --stat` / `git show d6e71d7 -- src/dialects/typescript/ops.ts` (full slice diff)
- `git show d6e71d7 -- test/core/dialect-handle.test.ts test/dialects/typescript/dialect.test.ts`
- `git diff 1f8912e..d6e71d7 -- test/dialects/typescript/ops-declarations.test.ts` (empty — confirmed)
- `src/dialects/typescript/ops.ts` (full file, post-slice)
- `test/dialects/typescript/ops-addImport.test.ts` (full file)
- `test/dialects/typescript/dialect.test.ts` (REQ-TSD-01.24 describe block)
- `test/core/dialect-handle.test.ts` (REQ-TSD-08.6 collateral fix site)
- `test/support/spy-client.ts` (to confirm `emitted`/`read()` relationship)
- `src/core/dialect-handle.ts` (`runOp`/`#ensureOpen`/`#invokeContained`, to ground Observation 2)
- `src/core/dialect-error.ts` (`.cause` contract, to ground the Strict TDD note)
- `openspec/changes/ts-addimport-collision/slices.md` (S-001 section + Executor context)
- `openspec/changes/ts-addimport-collision/apply-progress.md` (S-001 section, claims audited)
- `openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md` (battery table
  lines 276-306, `.24`/`.26`/`.27`/`.28`/`.32` scenario bodies, distinguishing-substring
  requirement)
- `openspec/changes/ts-addimport-collision/verify-in-loop-1.md`, `verify-in-loop-2.md`
  (established conventions — dual observable, mutation-mindset methodology)
