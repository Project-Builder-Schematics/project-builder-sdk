## Verify In-Loop Result

**Change**: react-dialect
**Iteration**: 6/3 (batch iteration for S-003+S-004+S-005 — the FINAL batch; scope-batch numbering per orchestrator, not a repeat of any single slice's 3-iteration cap)
**Scope**: S-003 (conformance corpus), S-004 (authoring docs), S-005 (installed-consumer six-subpath parity) — commits `cf89a52` (S-003) → `548c581` (S-004) → `616ff75` (S-005) → `0257e5c` + `f78cb88` (apply records)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

Every claim in the apply record for this batch was independently reproduced against the code,
not trusted from the narrative — including all three mutation probes, the docs worked example's
actual output, and the trustworthy full-suite number in a clean `/private/tmp` worktree (run
twice, both 1797/0). Nothing survived as a blocking finding.

- Tasks in scope complete: 8/8 (S-003.1–.2, S-004.1–.4, S-005.1–.2, all `[x]` in `slices.md`)
- Scoped combined suite (`test/dialects/react/`, `test/conformance/`,
  `test/e2e/installed-consumer.e2e.test.ts`, react-relevant fitness files,
  `canary-no-echo.test.ts`): **245 pass / 0 fail** (independently run; apply record's own
  narrower slice-by-slice numbers — 229 at S-003, 187/188 at S-004 with one unrelated flake,
  16/16 at S-005 — are each individually reproduced below)
- Full suite, trustworthy location (`/private/tmp/react-dialect-verify-6`, fresh worktree of
  `f78cb88`, `bun install` + `bun test` × 2): **1797 pass / 0 fail both runs** — exactly matches
  the apply record's claim (1779 baseline + 18 net new)
- Typecheck: clean in the worktree (`tsc --noEmit`, 0.2s — confirms the main working directory's
  ~12s `tsc` time this session is the diagnosed Documents-folder scanning tax, not a code issue)
- Spec compliance for scope: 12/12 scenarios ✅ COMPLIANT (REQ-RXD-08.1/.2, REQ-RXD-09.1–.5,
  REQ-LC-01.1/.2, REQ-LC-02.1–.3, REQ-LC-03.1)
- Assertion audit (delta test files): clean, no banned patterns
- Design contract: zero production files touched (confirmed via `git diff --name-status
  6ee9af0..f78cb88`); every changed file matches its designated `Modify`/`Create` action in
  design.md §4.2

Orchestrator action: exit the S-003/S-004/S-005 in-loop batch. All six slices (S-000..S-005) of
react-dialect are now DONE. Proceed to `sdd-verify --mode=final`, which still owns two carried
items: (1) S-002's disclosed TDD ordering violation (impl/tests same editing pass, RED proven
retroactively — deferred at in-loop-4/5, not re-adjudicated here per this iteration's scope), and
(2) the full-change TDD Cycle Adherence audit across all six slices' commit history.

---

### Design contract — no production code touched (independently confirmed)

```
$ git diff --name-status 6ee9af0..f78cb88
M	README.md
M	docs/authoring-a-dialect.md
M	openspec/changes/react-dialect/apply-progress.md
M	openspec/changes/react-dialect/slices.md
A	test/conformance/react-conformance.test.ts
A	test/dialects/react/docs.test.ts
M	test/e2e/installed-consumer.e2e.test.ts
```

Every entry matches design.md §4.2's File Changes table exactly: `react-conformance.test.ts` and
`docs.test.ts` are `Create`, `installed-consumer.e2e.test.ts`/`docs/authoring-a-dialect.md`/
`README.md` are `Modify` — no row exceeded, nothing outside the table touched. `src/**` has zero
diff in this range. The apply record's "no production code was changed by this batch" claim is
correct.

Also confirmed the `./react` `package.json#exports` entry S-005 depends on was NOT added by this
batch — it already existed from S-000 (`rg '"\./react"' package.json` → present, unchanged since
`6ee9af0`), which is *why* S-005 could legitimately be test-only: the capability pre-existed, S-005
only wires it into the e2e proof.

---

### S-003 — Conformance: 20-sample JSX adversarial corpus

**Claim adjudicated**: 3 tests / 4 assertions in `test/conformance/react-conformance.test.ts`,
claimed to discharge the full 20-sample corpus via 3 mutation probes substituting for RED
(print-corruption, parse-diagnostic bypass, `setJsxProp` no-op), each claimed to isolate exactly
the test covering it.

**Verified directly**:

1. Ran the file as committed: **3 pass / 0 fail / 4 expect() calls** — matches the claim exactly.
2. Read `src/conformance/index.ts`'s `testDialect`/`testOpPack` — both are real drivers that
   internally iterate every sample/exercise and REJECT the returned promise on the first
   mismatch (not a stub, not a thin pass-through). This is the same kit already shipping and
   verified for `test/conformance/typescript-conformance.test.ts`. A rejected promise fails the
   outer `expect(...).resolves.toBeUndefined()` — so the "4 assertions" figure undercounts the
   real assertion surface by design: each `it()` implicitly checks every sample in its fixture.
3. **Reproduced all three mutation probes myself** (each applied, run, reverted; `git status
   --porcelain`/`diff` confirmed empty after every revert):
   - **Probe A (print-corruption)** — appended a marker suffix in `react/ast.ts`'s `print()`:
     `1 pass / 2 fail` — both REQ-RXD-08.1 tests failed (round-trip AND op-pack fidelity), the
     divergence-probe test correctly unmoved. **Matches claim exactly.**
   - **Probe B (parse-diagnostic bypass)** — short-circuited the syntactic-diagnostic throw in
     `parse()` (`if (false && ...)`): `2 pass / 1 fail` — ONLY the divergence-probe test failed,
     round-trip and op-pack tests unmoved. **Matches claim exactly.**
   - **Probe C (`setJsxProp` no-op)** — replaced `element.addAttribute(...)` with a comment in
     `ops.ts`: `2 pass / 1 fail` — ONLY the op-pack fidelity test failed, round-trip and
     divergence-probe tests unmoved. **Matches claim exactly.**

**Honest judgment on thinness**: this is NOT the same failure shape in-loop-4 caught. In-loop-4's
gap was a literal iteration count (1/10 hostile values actually exercised through `addImport`,
despite the test file's structure implying full coverage). Here, the low `it()`/`expect()` count
is a direct consequence of `testDialect`/`testOpPack` being iteration-internal kit functions —
the same pattern already shipped and trusted for the TypeScript dialect's conformance suite. My
three probes prove the three describe-block-level checks are independently discriminating across
the full corpus, not mutually redundant or vacuous: a print bug breaks both round-trip checks, a
parse-diagnostic bug breaks only the divergence probe, and a mutation bug breaks only the op-pack
check — exactly the isolation a 20-sample corpus should produce. Verdict: adequate, not thin.

---

### S-004 — Docs: worked example, trust posture, honest limitations

**Claim adjudicated**: 15 tests / 33 assertions in `test/dialects/react/docs.test.ts` +
`docs/authoring-a-dialect.md` + `README.md`, claimed a true RED→GREEN with 11/15 genuinely
failing first.

**Verified directly**:

1. Ran the file: **15 pass / 0 fail / 33 expect() calls** — matches the claim exactly.
2. Read the full test file. Each REQ-RXD-09.x scenario has a dedicated describe block, and
   09.2/09.3/09.5 each carry an explicit "fails red if the section is removed" regression-proof
   test (mirrors `REQ-DAS-01.2`'s guard pattern) — these are permanent, self-verifying
   discriminators, not a one-time claim I have to take on faith.
3. **Cross-checked doc prose against the real `find()` JSDoc** (`src/dialects/react/index.ts`):
   the test asserts `"no normalization, always an explicit \`.tsx\`"`,
   `"extensionless path is rejected"`, `.jsx`, and `"follow-up"` — all four strings are present
   in the actual JSDoc, verbatim. Doc and code are not divergent.
4. **Executed the worked example itself** — not read it, ran it — against the real
   `parse`/`print`/`setJsxProp`/`addImport`:
   ```
   seed:  const el = <Button />;
   ops:   .addImport("handleClick", "./handlers").setJsxProp("Button", "onClick", "{handleClick}")
   output: import { handleClick } from "./handlers";

           const el = <Button onClick={handleClick} />;
   ```
   This is byte-exact against the doc's three `// ->` lines. The worked example is accurate and
   executable, not aspirational prose that happens to pass a loosely-matching guard.
5. I could not literally rewind the doc to its pre-change prose to reproduce the historical
   "11/15 failed first" RED count (there is no artifact of the stale text to restore). I treat
   this as accepted-on-corroborating-evidence rather than independently reproduced: the
   regression-proof tests inside the file (point 2) and the exact prose/code match (points 3–4)
   are strong indirect confirmation that the guard genuinely discriminates real content, which is
   the property that matters — a docs test passing against wrong prose (the risk this task named)
   is ruled out by point 4 specifically.

**Verdict**: DONE, no findings. Docs assert real content that matches real behaviour.

---

### S-005 — Installed-consumer six-subpath parity

**Claim adjudicated**: 16 tests, passed first run, 1 mutation probe (remove `./react` from
`package.json#exports` → exactly the two `results.react?.resolved` assertions fail, one per leg).

**Verified directly**:

1. Ran the file as committed: **16 pass / 0 fail / 66 expect() calls**.
2. **Reproduced the mutation probe**: removed the `"./react"` export block from `package.json`,
   ran the full e2e file (both legs execute a real `bun run build` + pack/link):
   ```
   14 pass
   2 fail
   ```
   The two failures were exactly `results.react?.resolved` — one in the tarball leg
   (`installed-consumer.e2e.test.ts:289`), one in the bun-link leg (`:360`) — all 14 other
   scenarios, including the founding-bug and cross-leg red-proof scenarios, stayed green.
   **Matches claim exactly.**
3. Reverted `package.json` (`diff` against pre-probe backup empty), re-ran: **16 pass / 0 fail**
   again, confirming clean revert.

**Verdict**: DONE, no findings. The probe is correctly scoped and precisely isolates the two
new assertions.

---

### Spec Compliance Matrix (12 scenarios, this batch)

| Requirement | Test | Result |
|---|---|---|
| REQ-RXD-08.1 (corpus round-trip via testDialect) | `react-conformance.test.ts` | ✅ COMPLIANT (mutation-proven, independently reproduced) |
| REQ-RXD-08.2 (op-pack fidelity under real mutation) | `react-conformance.test.ts` | ✅ COMPLIANT (mutation-proven, independently reproduced) |
| REQ-RXD-09.1 (ops named, minimality, catalog, escape hatch) | `docs.test.ts` | ✅ COMPLIANT |
| REQ-RXD-09.2 (coalesced worked example, `// ->` output) | `docs.test.ts` | ✅ COMPLIANT (output independently executed and matched) |
| REQ-RXD-09.3 (trust-boundary + spread warnings, guard-asserted) | `docs.test.ts` | ✅ COMPLIANT |
| REQ-RXD-09.4 (stale single-dialect framing reconciled) | `docs.test.ts` | ✅ COMPLIANT |
| REQ-RXD-09.5 (explicit-extension requirement, JSDoc + doc) | `docs.test.ts` + `index.ts` | ✅ COMPLIANT (JSDoc content independently cross-checked) |
| REQ-LC-01.1 (six subpaths resolve via bun link) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (mutation-proven, independently reproduced) |
| REQ-LC-01.2 (`./core` unresolvable) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (pre-existing, re-run green) |
| REQ-LC-02.1–.3 (founding-bug parity, count-parity structural) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (pre-existing, unchanged, re-run green) |
| REQ-LC-03.1 (tarball scenarios stay green as probe set extends) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (mutation-proven, independently reproduced) |

**Compliance summary**: 12/12 compliant (counting REQ-LC-02 as one row for its three sub-scenarios).

---

### Strict TDD (in-loop audit)

**Iteration**: 6 (S-003/S-004/S-005 batch)
**Verdict**: concerns (unchanged posture from iterations 4/5 — no new halt condition; the S-002
historical ordering violation remains disclosed and carried to final-mode per its own routing)
**Delta scope**: 2 test files created (`react-conformance.test.ts`, `docs.test.ts`), 1 test file
modified (`installed-consumer.e2e.test.ts`), 0 implementation files touched

- Banned assertion patterns in delta: none found — scanned `react-conformance.test.ts`,
  `docs.test.ts` in full, and the `installed-consumer.e2e.test.ts` diff hunk for
  `toBeDefined()`/`toBeTruthy()`/`toBeFalsy()`/`objectContaining(...)`-as-whole-assertion/bare
  `not.toThrow()`/snapshot-only — zero matches.
- New file with implementation but no tests: N/A — no new implementation files in this batch.
- Regression check: all previously-passing tests still pass — full suite 1779→1797 (net +18),
  0 fail, reproduced twice in a clean worktree.
- Triangulation: not applicable to new conditional/iterative production logic (none was added);
  the delta's own coverage-breadth question (S-003's corpus, S-004's doc guards) is judged above
  under each slice's own section, not this checklist item.
- **Mutation-probe-for-RED substitution — my call**: for S-003 and S-005, the exercised
  behaviour genuinely pre-existed (S-000–S-002 for the ops/AST, S-000 for the `./react` export),
  so literal first-run failure was structurally impossible — a true RED would have required
  temporarily breaking already-shipped, already-verified production code, which is a worse
  practice than a disclosed, reverted mutation probe. The substitution is used narrowly (only
  where pre-existing behaviour is being wired into a *new test surface*, not as a general
  workaround for skipping RED), each probe is disclosed with exact numbers, and I independently
  reproduced all three probes (S-003 ×3, S-005 ×1) byte-for-byte against the claimed isolation.
  I judge this adequate. S-004, by contrast, needed no substitution — genuine RED was available
  (doc prose did not yet exist) and was used; this is the stronger pattern and the one preferred
  when available, which is exactly what happened here.

### In-Loop History

| Iteration | Verdict | Issues |
|---|---|---|
| 1 (S-000) | PASS | — |
| 2 (S-001) | NEEDS_FIX | CRITICAL removeInitializer coverage; WARNING 06.5 e2e asymmetry |
| 3 (S-001 re-verify) | PASS | both resolved, mutation-proven |
| 4 (S-002) | NEEDS_FIX | CRITICAL REQ-RXD-06.5 addImport-portion coverage gap; WARNING unsubstantiated TDD claim in state note |
| 5 (S-002 re-verify) | PASS | both resolved — Finding 1 fully closed (independently reproduced); Finding 2 documentation-fixed, historical violation carried to final-mode |
| 6 (S-003+S-004+S-005) | PASS | none — all mutation probes and the worked example independently reproduced; full suite confirmed 1797/0 twice in a clean worktree |

### Issues Found

**CRITICAL**: None.
**WARNING**:
- (Carried forward, not re-elevated) S-002's historical TDD ordering violation — impl and tests
  written in the same editing pass, RED proven retroactively — remains disclosed and open for
  `sdd-verify --mode=final`'s TDD Cycle Adherence audit across the full change history.
- (Carried forward, not re-elevated) The main working directory's `tsc --noEmit`/subprocess-bound
  test flakiness under `~/Documents` is pre-existing debt, already registered for
  `pending-changes` at archive; this iteration re-confirms it is environmental (0.2s in a clean
  `/private/tmp` worktree vs ~12s in this working directory) and not a regression from this batch.
**SUGGESTION**: None. (REQ-RXD-11.5 spec-wording follow-up from S-001 remains open, unrelated to
this batch, routing unchanged.)
