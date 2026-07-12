## Verify In-Loop Result

**Change**: stage-5b-dialect-breadth
**Iteration**: 2/3
**Scope**: S-001 (`addFunction`) + S-002 (`removeImport` + row-136 fail-loud + registry/docs) — S-000 already PASSED (`verify-in-loop-1.md`); S-003/S-004/S-005 not yet built, their absence is not a finding
**Mode**: in-loop (Strict TDD)
**Delta**: `git diff 80109ff..HEAD` — 7 commits (`000243a`, `8867d42`, `769f455`, `ce48427`, `e955d55`, `7831143`, `01ff715`), plus fix commit `4770afd` (see Fix Re-verification, last section)

---

### FINAL Verdict: PASS

The initial pass over the 7-commit delta returned NEEDS_FIX on one CRITICAL finding (preserved
verbatim below for the audit trail). The Executor's fix commit `4770afd` was re-verified
independently and closes the finding — batch B2 PASSES. See "Fix Re-verification" at the end.

### Initial Verdict (pre-fix, superseded): NEEDS_FIX

19/20 in-scope REQ-scenarios are compliant, byte-exact, mutation-tested, and non-vacuous. One
CRITICAL Strict TDD finding blocks a clean PASS: a genuinely untested conditional branch was
added to `removeImport`, in a code-execution path that this SAME batch just promoted from
`medium` to `high` sensitivity.

- Tasks in scope complete: S-001 7/7, S-002 13/13 (`slices.md`, all `[x]`)
- Affected tests passed: 828/828 (full suite; was 806 before this batch, +22 — matches
  apply-progress's claimed delta exactly)
- Typecheck: clean (`bunx tsc --noEmit`, 0 errors)
- Build: clean (`bun run build`)
- Spec compliance for scope: 19/20 REQ-scenarios COMPLIANT, 1 REQ-scenario area (removeImport's
  extra guard) has an untested branch — see Issues Found
- Assertion audit: 3/3 load-bearing assertions mutation-killed live (see below); 1 CRITICAL
  triangulation gap found
- Strict TDD (in-loop audit): **halt on one dimension** (triangulation) — see section below

---

### Execution Evidence (real, this run — every command executed live, not asserted)

```
bun test
 828 pass
 0 fail
 1491 expect() calls
Ran 828 tests across 102 files. [11.79s]

bunx tsc --noEmit
(clean, exit 0)

bun run build
tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts ...
Bundled 9 modules in 5ms
(clean, exit 0)

bun test test/fitness/fit-04-dts-semver-gate.test.ts   → 15 pass, 0 fail
bun test test/fitness/fit-14-package-surface.test.ts   → 13 pass, 0 fail
```

Matches apply-progress's claimed suite delta (806→828, +22) exactly.

---

### Acceptance Criteria (S-001 + S-002, individually evidenced)

| Criterion (slices.md) | Evidence | Result |
|---|---|---|
| S-001: empty file + `addFunction("hi", "(): void {}", {export:true})` → byte-exact golden `export function hi(): void {}` | `ops-declarations.test.ts::REQ-TSD-09.2` vs `golden/add-function-exported.txt` | ✅ |
| S-001: seeded `const foo = 1;` + `addFunction("foo", …)` REJECTS with pinned collision message, fail-closed run-wide | `ops-declarations.test.ts::REQ-TSD-09.3` (single-handle) + `dialect-handle.test.ts::REQ-DG-07.2` (two-handle, `committedTree().size===0`/`stagingTree().size===0`) | ✅ |
| S-002: `import { a, b } from "m";` + `removeImport("a","m")` → `b` survives byte-exact | `ops-removeImport.test.ts::REQ-TSD-08.1` — `modifies[0].modify.content === 'import { b } from "m";\n'` | ✅ |
| S-002: absent import as ONLY op → zero directives | `dialect-handle.test.ts::REQ-TSD-08.4` — `collectModifies(emitted)).toHaveLength(0)` + `dryRun()).toEqual([])` — independently mutation-killed (see below) | ✅ |
| S-002: open `addImport` + `.modify()` on SAME handle REJECTS, `.read()` remains the documented escape | `dialect-handle.test.ts::REQ-MC-08.1` (reject) + `REQ-MC-08.3` (`.read()` escape, both directives commit) | ✅ |

---

### Two-Commit Discipline (binding constraint 2) — verified from `git show`, not from claims

- **`769f455`** (`test/core/dialect-handle.test.ts` only, +21/-0): adds ONE standalone
  `describe("dialect handle — row-136 [characterization] …")` block asserting TODAY's silent
  last-write-wins (`fake.committedTree().get("a.ts")` === the raw override, addImport edit
  lost). Nothing else touched in this commit. Confirmed via `git show 769f455 --stat` — one
  file, one hunk, pure addition.
- **`ce48427`** (`slices.md` + `src/core/dialect-handle.ts` + `test/core/dialect-handle.test.ts`):
  the diff DELETES the exact `[characterization]` `describe` block added in commit 1 and
  REPLACES it, in the same hunk, with `describe("dialect handle — REQ-MC-08 (row-136 reject,
  S-002 commit 2 of 2 — replaces the commit-1 characterization)")` containing the four
  REQ-MC-08.1–08.4 scenarios, alongside `runModify`'s implementation change (`#openDirective`
  pending-check → `dialectError` throw). The replacement is visible in the diff (`-` block
  immediately followed by `+` block), never a silent drop. Matches constraint 2 verbatim.

---

### Load-Bearing Literals — byte-exact, verified against actual thrown messages

- **Foreign wrap** (`raw() on "{path}" threw`): unchanged code path (S-000), re-confirmed clean
  in this batch's full suite run.
- **Row-136 reject**: `dialect-handle.ts:259-261` constructs
  `` `cannot .modify() "${this.#path}" while a structured edit is pending on the same handle — the pending edit would be lost; call .read() to commit it first, then .modify()` ``
  via `dialectError()`, which prepends the frozen `"dialect operation failed: "` prefix
  (`dialect-error.ts:22`) — the composed string is byte-identical to design §4.4's pinned
  literal. `REQ-MC-08.1`'s test asserts the FULL composed string with `toBe` (not `toContain`),
  the strictest possible check.
- **Add-op collision** (one template, verified at its ONE call site in `assertNoCollision`,
  `ops.ts:44-47`): `` `${opName}("${name}") on "${handlePath}" — a value or import binding named "${name}" already exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, or edit it with .raw().` `` — matches design §4.4 verbatim. Only
  `addFunction` calls it in this batch (S-003 will add the other two call sites); the template
  itself is already parameterized correctly for reuse (`opName` is threaded, not hardcoded to
  `"addFunction"`).
- **Foreign wrap `{op}`** for named ops (`addFunction() on "{path}" threw`, `removeImport() on
  "{path}" threw`): mechanism unchanged from S-000, `opName` threaded correctly per
  `createDialectHandle`'s op-dispatcher (`dialect-handle.ts:365-373`).

---

### Collision Namespace Semantics (Owner Ruling #4) — verified from code, not claims

`assertNoCollision` (`ops.ts:44-47`) checks `ast.getFunction`, `ast.getVariableDeclaration`,
`ast.getClass`, and named-import bindings (matched by alias-or-name) — cross-kind, one throw.
**No** call to `ast.getTypeAlias`/`ast.getInterface` — `type`/`interface` correctly EXEMPT.
Evidence: `REQ-TSD-09.7` (import-binding collision rejects) and `REQ-TSD-09.8` (type-alias does
NOT collide, function is added, golden `add-function-type-alias-after.txt` shows both the
untouched `type foo = string;` and the new `function foo(): void {}`) — both pass. Mutation-killed
live (see below).

---

### Guard-Loop Flip + Registry Promotion (constraints 6, 9)

- `test/docs/security-authoring-guard.test.ts` (`7831143`): positive shipped-verbs loop is now
  exactly `["defineDialect", "defineOpPack", "withOps", ".raw", "addImport", "removeImport",
  "addFunction"]` — `addVariable`/`addClass` correctly ABSENT (they ship in S-003). The negative
  `"never names unshipped surface (e.g. removeImport)"` test is DELETED (not just weakened) —
  confirmed via `git show 7831143`.
- `openspec/sensitive-areas.md`: `security (code execution)` row promoted `medium`→`high`
  verbatim; the stale `"All entries are \`confidence: low\` and **anticipated**"` sentence is
  gone, replaced with a paragraph reflecting landed concrete paths. Confirmed via `git show
  7831143 -- openspec/sensitive-areas.md`.
- **Live-verified, not asserted**: I reverted the `high`→`medium` promotion and re-ran
  `security-authoring-guard.test.ts` — the new registry-promotion test FAILED for the right
  reason (`Expected to contain: "| high |"`, received the `medium` row verbatim). Restored via
  file copy; full suite re-confirmed 828/828 green. The guard assertions are real, not tautologies.

---

### Mutation-Resistance Spot Check (≥3 load-bearing assertions, live-verified)

All verified via a genuine plant-mutate-run-restore cycle, git state restored cleanly after each
(`git status`/`git diff --stat` showed zero residual changes after every restoration):

1. **Collision reject** (`ops.ts` `assertNoCollision`) — disabled the throw
   (`if (!collides) return` → unconditional `return`). Result: **4 tests failed**
   (`REQ-TSD-09.3`, `REQ-TSD-09.7` in `ops-declarations.test.ts`; `REQ-DG-07.2` in
   `dialect-handle.test.ts`). Restored; suite re-confirmed 828/828 green.
2. **Row-136 reject** (`dialect-handle.ts` `runModify`) — disabled the pending-check
   (`if (this.#openDirective !== undefined && …)` → `if (false)`). Result: **2 tests failed**
   (`REQ-MC-08.1`, the `REQ-DG-07.1` concrete-trigger test). Restored; suite re-confirmed clean.
3. **Alias matching** (`ops.ts` `removeImport`) — mutated the specifier match from
   module-exported-name to local-alias (`named.getName()` → `named.getAliasNode()?.getText() ??
   named.getName()`). Result: **1 test failed** (`REQ-TSD-08.3`, exactly the aliased-specifier
   scenario this mutation targets). Restored; suite re-confirmed clean.
4. **Zero-directive claim** (`removeImport`'s early return on absent decl, backing the
   "passed-immediately" `REQ-TSD-08.4`/`08.6` claims in apply-progress) — inserted an
   unconditional `ast.addStatements("// MUTATION-TEST")` before the early return. Result:
   **6 tests failed**, including `REQ-TSD-08.4`, `REQ-TSD-08.6`, and the mixed-chain coalescing
   test — confirming these are real content checks, not vacuous passes. Restored; suite
   re-confirmed 828/828 green.

All four mutations were killed. Every restoration left `git status` clean except the
pre-existing, unrelated `.sdd/state/stage-5b-dialect-breadth.json` diff (present before I
started, not introduced by any experiment).

---

### FIT-04/FIT-14 Baseline Consistency (constraint 5) — regenerated fresh, right now

- `diff dist/dialects/typescript/index.d.ts test/fitness/dts-baseline/typescript.index.d.ts` →
  **IDENTICAL** after a fresh `bun run build` executed in this verify pass.
- `bun pm pack --dry-run` run fresh — output inspected; `test/fitness/fit-14-package-surface.test.ts`
  (13/13) and `test/fitness/fit-04-dts-semver-gate.test.ts` (15/15) both pass against the
  regenerated artifacts.
- FIT-04's baseline shows `addFunction`/`removeImport` in the `AddImportOps` type with their
  PUBLIC 3-4-arg signatures (no `handlePath` 5th arg visible) — confirms deviation (a) below.

---

### Deviation Rulings (apply-progress's 4 claimed deviations — independently re-verified)

**(a) `runOp` trailing-path arg (touches S-000-owned `dialect-handle.ts`)** — **ACCEPTABLE**.
`runOp` appends `this.#path` as a trailing runtime arg (`dialect-handle.ts:226`); `addFunction`
declares an optional 5th `handlePath?: string` parameter to receive it
(`ops.ts`). The PUBLIC type (`AddImportOps` in `index.ts`, which `OpMethods`/`Bound` in
`define-dialect.ts` derives the author-facing signature from) declares `addFunction` with only
3 args + options — no `handlePath`. Verified two ways: (1) `bunx tsc --noEmit` passes clean,
meaning the wider real function is structurally assignable to the narrower declared type
(TS's standard "extra optional trailing param" variance rule); (2) the FIT-04 `.d.ts` baseline,
regenerated fresh in this pass, shows the 4-arg public signature with zero trace of the 5th arg.
Existing ops (`addImport`) silently ignore the extra trailing arg (JS drops unclaimed args) —
confirmed no behavior change to `addImport`'s own tests (all still pass). Sound, reversible,
correctly invisible.

**(b) Retired pre-existing `dialect.test.ts` REQ-TSD-01.1 exact-set test** — **ACCEPTABLE**.
Design's own Test Derivation table (§4.6) assigns REQ-TSD-01.1's test ownership to
`ops-exact-set.test.ts`, explicitly owned by S-003 (not yet built). `slices.md`'s Coverage Check
confirms: `TSD-01.1→S-003 (gate test SURVIVES a cut...)`. The interim gap (no exact-set gate
between S-002 landing and S-003 landing) is a KNOWN, PLANNED gap already accounted for in the
signed plan — not a new defect introduced by this batch's executor. Confirmed the old test was
removed cleanly (not left broken) and its replacement is scheduled, not abandoned.

**(c) `golden/` vs `goldens/` directory naming** — **ACCEPTABLE**. Only `test/dialects/typescript/
golden/` (singular) exists in the repo; `test/support/golden.ts`'s `DEFAULT_GOLDEN_DIR` already
points there. No second `goldens/` directory exists anywhere. Matches the established pattern;
the plural spelling in slices.md/design.md prose is the prose's own inconsistency, not a code
defect.

**(d) UNTESTED defensive guard in `removeImport` (default/namespace-import coexistence)** —
**FINDING (CRITICAL, Strict TDD triangulation gap)**. See Issues Found below — this is the one
deviation that does NOT get a clean pass.

---

### Issues Found

**CRITICAL**:

1. **Untested conditional branch in `removeImport`'s whole-statement-deletion guard**
   (`src/dialects/typescript/ops.ts:97-101`):
   ```ts
   const isLastNamedBindingOnly =
     decl.getNamedImports().length === 1 && decl.getDefaultImport() === undefined && decl.getNamespaceImport() === undefined;
   if (isLastNamedBindingOnly) {
     decl.remove();
   } else {
     specifier.remove();
   }
   ```
   The `getDefaultImport() === undefined && getNamespaceImport() === undefined` conjuncts were
   added specifically to prevent whole-statement deletion when a default/namespace import
   coexists with the last named binding on the same declaration (apply-progress's own stated
   rationale — "prevents silent corruption of a declaration shape"). REQ-TSD-08 explicitly
   scopes this op to NAMED-binding imports only ("default and namespace imports are OUT OF
   SCOPE for this change") — so this guard is defensive code added BEYOND the signed spec's
   stated scope. I grepped the full diff (`git diff 80109ff..HEAD -- test/dialects/typescript/
   ops-removeImport.test.ts test/core/dialect-handle.test.ts | grep -c "default\|namespace"` →
   **0 matches**) — no test anywhere seeds a declaration with a default or namespace import
   alongside a named one. Every existing `removeImport` test has `getDefaultImport()` and
   `getNamespaceImport()` return `undefined` unconditionally, so these two conjuncts are always
   `true` in every test run — the branch where they'd be `false` (and the guard would actually
   fire, taking the `specifier.remove()` path instead of `decl.remove()`) is never exercised.
   This is precisely the strict-tdd-verify module's in-loop HALT condition: "Single test for
   conditional logic in delta (triangulation gap)" — here it's worse than "single test", it's
   ZERO tests distinguishing the two branches this specific guard exists to create. Under Strict
   TDD (enabled project-wide), production code should not exist without a driving test, and this
   is a genuinely new conditional path, not incidental/adjacent code. The stakes are non-trivial:
   this sits inside `src/core/dialect-handle.ts`'s calling code (`removeImport`), the exact
   destructive-AST-mutation seam this SAME batch just promoted from `medium` to `high`
   sensitivity in `openspec/sensitive-areas.md` — an untested branch in a freshly-promoted-high
   security-sensitive path is not something to wave through.
   - **Routing**: LOCAL (Executor SDD-light, trivially fixable in the next iteration).
   - **Recommended fix** (either is acceptable): (i) add ONE triangulating test case — seed
     `import Foo, { bar } from "m";`, call `removeImport("bar", "m")`, assert the printed
     output retains `import Foo from "m";` (specifier removed, declaration survives) — this
     closes the gap and gives the guard a real reason to exist; OR (ii) remove the guard
     entirely (4 lines) since it exceeds REQ-TSD-08's stated scope and no signed scenario
     requires it — the simpler `decl.getNamedImports().length === 1` check alone (matching
     REQ-TSD-08.2's literal text) would suffice for everything currently specified. I recommend
     (i): the guard's protective intent is sound (prevents real, if out-of-scope, data loss) and
     is cheap to triangulate honestly, rather than deleting code that pre-empts a real footgun.

**WARNING**: None.

**SUGGESTION**:

1. `ops.ts`'s `assertNoCollision(ast, name, opName, handlePath: string)` receives
   `handlePath as string` from `addFunction`'s optional `handlePath?: string` 5th param — a type
   assertion, not a runtime guard. Today this is always safe (`runOp` always supplies the path),
   but if a future direct call to `addFunction` ever bypassed `runOp` (e.g. a unit test calling
   the exported function directly with 4 args), the collision message would silently embed
   `"undefined"` instead of a type error. Non-blocking; worth a runtime assertion or a comment
   noting the invariant if S-003's `addVariable`/`addClass` reuse this pattern.

---

### Strict TDD (in-loop audit)

**Iteration**: 2
**Verdict**: **halt** (one dimension — triangulation; see Issues Found #1)
**Delta scope**: 4 new test files (`ops-declarations.test.ts`, `ops-removeImport.test.ts`,
2 golden-set additions) + 1 heavily-modified test file (`dialect-handle.test.ts`) + 1 modified
guard-test file (`security-authoring-guard.test.ts`), 4 impl files
(`ops.ts`, `index.ts`, `dialect-handle.ts`, `sensitive-areas.md`)

**TDD adherence (light)**: every new production surface has a corresponding test, EXCEPT the
`removeImport` default/namespace guard branch (see CRITICAL finding #1).

**Banned assertion patterns (delta)**: scanned all delta test files for `.toBeDefined()`/
`.toBeTruthy()`/`.toBeFalsy()`/`objectContaining`-as-whole-assertion/`not.toThrow()`-only —
zero matches. Assertions are content-exact (`toBe`, `toEqual`, `toHaveLength` with real byte
comparisons), consistent with the mutation-kill results above.

**Triangulation**: `assertNoCollision`'s 4-way OR (function/variable/class/import) has ≥2 cases
per collision arm (`REQ-TSD-09.3` const, `REQ-TSD-09.7` import) plus the negative
(`REQ-TSD-09.8` type-alias). `removeImport`'s sibling-survives vs last-binding-deletes branches
both have dedicated cases (`REQ-TSD-08.1`/`08.2`). **Gap**: the default/namespace-coexistence
conjunct has zero triangulating cases (CRITICAL finding #1).

**Regression check**: all 806 previously-passing tests still pass (828 total − 22 new = 806,
full suite run confirms 0 failures).

**Halts**: 1 — triangulation gap, `removeImport`'s default/namespace guard (see Issues Found).

---

### Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-TSD-09.1 | `ops-declarations.test.ts::REQ-TSD-09.1` | ✅ COMPLIANT |
| REQ-TSD-09.2 | `ops-declarations.test.ts::REQ-TSD-09.2` | ✅ COMPLIANT |
| REQ-TSD-09.3 | `ops-declarations.test.ts::REQ-TSD-09.3` | ✅ COMPLIANT |
| REQ-TSD-09.4 | `ops-declarations.test.ts::REQ-TSD-09.4` | ✅ COMPLIANT |
| REQ-TSD-09.5 | `ops-declarations.test.ts::REQ-TSD-09.5` | ✅ COMPLIANT |
| REQ-TSD-09.6 | `ops-declarations.test.ts::REQ-TSD-09.6` | ✅ COMPLIANT |
| REQ-TSD-09.7 | `ops-declarations.test.ts::REQ-TSD-09.7` | ✅ COMPLIANT |
| REQ-TSD-09.8 | `ops-declarations.test.ts::REQ-TSD-09.8` | ✅ COMPLIANT |
| REQ-DG-07.2 | `dialect-handle.test.ts::REQ-DG-07.2` (single + two-handle) | ✅ COMPLIANT |
| REQ-TSD-08.1 | `ops-removeImport.test.ts::REQ-TSD-08.1` | ✅ COMPLIANT |
| REQ-TSD-08.2 | `ops-removeImport.test.ts::REQ-TSD-08.2` | ✅ COMPLIANT |
| REQ-TSD-08.3 | `ops-removeImport.test.ts::REQ-TSD-08.3` | ✅ COMPLIANT |
| REQ-TSD-08.4 | `dialect-handle.test.ts::REQ-TSD-08.4` | ✅ COMPLIANT (but see note*) |
| REQ-TSD-08.5 | `ops-removeImport.test.ts::REQ-TSD-08.5` | ✅ COMPLIANT |
| REQ-TSD-08.6 | `dialect-handle.test.ts::REQ-TSD-08.6` | ✅ COMPLIANT |
| REQ-MC-08.1 | `dialect-handle.test.ts::REQ-MC-08.1` | ✅ COMPLIANT |
| REQ-MC-08.2 | `dialect-handle.test.ts::REQ-MC-08.2` | ✅ COMPLIANT |
| REQ-MC-08.3 | `dialect-handle.test.ts::REQ-MC-08.3` | ✅ COMPLIANT |
| REQ-MC-08.4 | `dialect-handle.test.ts::REQ-MC-08.4` | ✅ COMPLIANT |
| REQ-DG-07.1 | `dialect-handle.test.ts::"a row-136 reject on a LATER handle…"` | ✅ COMPLIANT |

\* REQ-TSD-08.4's SIGNED scenario (absent import → zero directives) is fully compliant and
mutation-killed. The finding is about an ADDITIONAL, spec-unscoped guard clause inside the SAME
function, not about REQ-TSD-08.4 itself.

20/20 signed scope REQ-scenarios COMPLIANT. 1 non-REQ, out-of-spec-scope defensive addition has
a Strict TDD triangulation gap (Issues Found #1).

---

### Routing (pre-fix, superseded)

**NEEDS_FIX** — Routing: **LOCAL** (Executor SDD-light).

Orchestrator action: re-invoke `/build` targeting `src/dialects/typescript/ops.ts`'s
`removeImport` default/namespace guard — add a triangulating test (recommended) or remove the
guard, per Issues Found #1's two acceptable resolutions. This is a single, narrowly-scoped fix;
no re-design, re-spec, or human escalation needed. Iteration 2 of 3 used — one more in-loop
iteration available before the 3-iteration ceiling.

Everything else in B2 (all 20 signed REQ-scenarios, two-commit discipline, load-bearing
literals, collision-namespace semantics, guard-loop flip, registry promotion, FIT-04/FIT-14
baselines, 4/4 mutation-resistance checks, deviations a/b/c) is clean and does not need to be
re-touched in the fix iteration.

---

### Fix Re-verification — commit `4770afd` (closes CRITICAL finding #1) → FINAL: PASS

The Executor applied the prescribed fix (recommended option (i): triangulate the guard). All
four re-verification checks were performed independently, live, in this pass:

**(a) Full suite + typecheck — CONFIRMED.** `bun test` → **829 pass / 0 fail / 1493 expect()
calls** (was 828, +1 — exactly the one new test). `bunx tsc --noEmit` → clean, exit 0. Matches
the Executor's claim exactly.

**(b) Mutation-kill — REPRODUCED LIVE.** Planted the same weakening the Executor claimed
(replaced the guard with bare `decl.getNamedImports().length === 1`, dropping both defensive
conjuncts). Result: exactly the new test failed, for the right reason —
`Expected "import def from \"m\";\n", Received ""` (the whole declaration was deleted instead
of the default import surviving). Restored via `git checkout -- src/dialects/typescript/ops.ts`;
`git status` clean (only the pre-existing unrelated `.sdd/state` diff + this report file);
full suite re-confirmed **829/829 green** post-restore. The test is a real content check, not
a tautology.

**(c) Unreachable-namespace-conjunct comment — FACTUALLY CORRECT, verified empirically** (not
from memory): ran a throwaway ts-morph probe (scratchpad, outside the repo) against the repo's
own pinned ts-morph:
- `import * as ns, { a } from "m";` → **2 syntactic diagnostics** (`'from' expected.`,
  `';' expected.`) — invalid TS, exactly as the comment claims (namespace and named imports
  cannot coexist in one declaration; the grammar allows default+namespace XOR default+named).
- Even in ts-morph's error-recovery parse tree for that malformed input,
  `getNamedImports().length === 0` while `getNamespaceImport()` is set — so the guard's
  namespace conjunct can NEVER evaluate `false` while the `length === 1` conjunct is `true`.
- Belt-and-braces: the dialect's own `parse` rejects files with syntactic diagnostics
  (REQ-TSD-04.1 containment) before any op runs, so a malformed file never reaches
  `removeImport` at all.
The "unreachable-but-harmless dead code, not an untested live branch" characterization is
accurate; declining to manufacture an impossible fixture is the honest call.

**(d) No scope creep — CONFIRMED.** `git show 4770afd --stat`: exactly two files —
`test/dialects/typescript/ops-removeImport.test.ts` (+22, the new test + explanatory comment)
and `openspec/changes/stage-5b-dialect-breadth/apply-progress.md` (+29, the fix's TDD evidence
entry). Zero production-code changes; nothing beyond the prescribed fix + progress entry.

**Strict TDD (in-loop audit) — REVISED verdict: ok.** The single halt dimension (triangulation
gap in `removeImport`'s guard) is closed: the reachable branch (`getDefaultImport()` conjunct)
now has a dedicated, mutation-killed test; the unreachable branch is documented with a
grammar-verified justification instead of a fake fixture. No other dimension changed.

### FINAL Verdict: PASS

All scope checks green. Loop can exit for batch B2.
- Tasks in scope complete: S-001 7/7, S-002 13/13 (+ fix task evidenced in apply-progress)
- Full suite: 829/829 passed, typecheck clean, build clean
- Spec compliance for scope: 20/20 signed REQ-scenarios COMPLIANT
- Assertion audit: clean — 5/5 live mutation-kill experiments across both passes
- Strict TDD (in-loop): ok

Orchestrator action: proceed to batch B3 (S-003 per Build Order — cut-lever gate applies there).

**Carry-forward for verify-final** (not blockers, bookkeeping):
1. The interim REQ-TSD-01.1 exact-set gap (deviation b) closes only when S-003's
   `ops-exact-set.test.ts` lands — final verify must confirm it exists (or the cut-edited
   3-op variant, if the cut lever fired).
2. SUGGESTION from this report (the `handlePath as string` type assertion in
   `assertNoCollision`) stands — worth a look when S-003 reuses the pattern.
3. In-loop history for the final report: iteration 1 (S-000) PASS; iteration 2 (B2)
   NEEDS_FIX → fix `4770afd` → PASS.
4. The `getNamespaceImport()` conjunct is documented dead code by TS-grammar impossibility —
   if a future mutation-testing pass flags a surviving mutant there, that is expected and
   pre-justified (see (c) above).
