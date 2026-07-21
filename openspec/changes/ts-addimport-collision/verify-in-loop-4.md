## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 4/3 (loop-numbering continues from prior batches; this is the first in-loop verify of the S-003 batch)
**Scope**: S-003 (input-shape variants)
**Mode**: in-loop (Strict TDD)

**Commit under review**: `1505d19` — "feat(typescript-dialect): handle input-shape variants in addImport (S-003)"
**Pre-slice baseline**: `e0b6e6d`

---

### Verdict: PASS

All scope checks green. Loop can exit for this batch.

- Tasks in scope complete: 5/5 (S-003.1–S-003.5, all `[x]` in `slices.md`)
- Affected tests passed: 2087/2087 (full suite; targeted `ops-addImport.test.ts`: 28/28, 122 expect() calls)
- Spec compliance for scope: 10/10 REQ-TSD-01 scenario IDs (`.7`, `.9`, `.15`, `.18`, `.20`, `.21`, `.22`, `.23`, `.29`, `.30`)
- Assertion audit: clean — no banned patterns, dual observable upheld on both no-op scenarios, byte-exact golden on the create-with-directive scenario
- Typecheck: clean

Orchestrator action: exit loop for S-003, proceed toward `/evaluate` (mode=final) once all remaining slices (S-002, S-004, S-005) are built.

---

### Independent RED re-proof (empirical, not trusted from apply-progress)

Swapped `src/dialects/typescript/ops.ts` back to the pre-slice baseline (`git show e0b6e6d:...`), ran the new S-003 test file against it, then restored the file (`git checkout 1505d19 -- src/dialects/typescript/ops.ts`) and confirmed the restore is byte-identical to the commit (`diff` against a pre-swap backup copy — clean).

Result against baseline `e0b6e6d`:

```
28 tests, 25 pass, 3 fail
```

The 3 failures are exactly:
- `REQ-TSD-01.15: self-alias {X as X} — idempotent no-op` — baseline threw a collision reject (`already exists`) instead of no-op'ing
- `REQ-TSD-01.21: directive prologue — import lands AFTER it, byte-exact golden` — baseline inserted the import ABOVE the directive
- `REQ-TSD-01.21 (triangulation): TWO leading directives` — same defect, both directives displaced

This matches the executor's claim exactly: 8 of the 10 scenario IDs (12 of 15 new test cases, counting `.18`'s two sub-cases and `.21`'s two sub-cases) were green-on-arrival against the pre-existing, already-general S-000/S-001 machinery; only `.15` and `.21` needed new production code. The root-cause claim in `apply-progress.md` ("the ported general algorithm already subsumes these shapes") is verified, not merely asserted.

Working tree was left clean after the restore (`git status --short` shows no diff on `src/dialects/typescript/ops.ts`).

### Dual observable (house standard)

- `.15` (self-alias no-op): asserts `collectModifies(emitted)).toHaveLength(0)` AND `expect(await client.read("a.ts")).toBe(seed)` — both halves present.
- `.30` (mixed default+named, matching default no-op): same pair pattern — both halves present.
- No new reject-shaped scenarios in this batch (rejects are S-001's domain); nothing to check on that axis here.

### Spec fidelity — scenario-by-scenario

Cross-checked every S-003 REQ-ID against `specs/typescript-dialect/spec.md`'s scenario battery (`REQ-TSD-01.5–01.19` table plus individually-headed `.20`–`.30`) and the corresponding test in `ops-addImport.test.ts`. All 10 map to a test asserting the exact normative Given/When/Then, not merely incidental coverage:

| REQ-ID | Spec outcome | Test fixture / call | Result |
|---|---|---|---|
| .7 | type-only decl, diff name → create, type-only untouched | `import type { X } from "m"` + `addImport("Y","m")` | ✅ matches |
| .9 | type-only ALIASED, X never claimed → create | `import type { X as XT } from "m"` + `addImport("X","m")` | ✅ matches |
| .15 | self-alias → idempotent no-op | `import { X as X } from "m"` + `addImport("X","m")` | ✅ matches |
| .18 | `type`/`interface` not in value namespace → create (2 sub-cases) | `type Icon = string;` / `interface Icon {...}` + `addImport("Icon","./icons")` | ✅ matches, both |
| .20 | side-effect import preserved byte-unchanged, separate decl added | `import "polyfill";` + `addImport("X","polyfill")` | ✅ matches |
| .21 | directive prologue: import lands after it (+ 2-directive triangulation) | golden-driven + inline 2-directive case | ✅ matches, both |
| .22 | multi-decl for same module: merge FIRST | two `import {...} from "m"` decls + `addImport("c","m")` | ✅ matches |
| .23 | empty `{}` clause is a valid merge target | `import {} from "m"` + `addImport("X","m")` | ✅ matches |
| .29 | mixed default+named: merge to named, default untouched | `import Def, { B } from "m"` + `addImport("C","m")` | ✅ matches |
| .30 | mixed default+named: default-name match is no-op | same fixture + `addImport("Def","m")` | ✅ matches |

No scenario ID is tested only incidentally — each has a dedicated `it()` block whose fixture and assertion mirror the spec row verbatim.

### Full suite + typecheck (run independently)

- `bun test` (full suite, on the restored `1505d19` tree): **2087 pass, 0 fail, 4541 expect() calls, 191 files** — matches `apply-progress.md`'s claim exactly.
- `bun test test/dialects/typescript/ops-addImport.test.ts`: **28 pass, 0 fail, 122 expect() calls** — matches claim exactly.
- `bun run typecheck` (`tsc --noEmit`): clean, no output, no errors.
- Lint: not available (`package.json` has no `lint` script) — reported cleanly, not a failure.

### Golden integrity

`directive-add-import-before.txt` / `directive-add-import-after.txt` read directly:

```
before: "use client";
        const x = 1;

after:  "use client";
        (blank)
        import { readFileSync } from "node:fs";
        (blank)
        const x = 1;
```

The pair differs ONLY by the inserted import declaration (plus its surrounding blank lines from ts-morph's formatter) — the directive and the trailing statement are untouched. Confirmed NOT dead files: the RED re-proof run above actually asserted against `golden("directive-add-import-after.txt")` and the failure diff visibly quoted this fixture's content, proving the test reads it at runtime, not just references its name.

### Shebang untouched (ADR-03 fail-closed containment)

Confirmed by code inspection of the diff: `leadingDirectiveCount` iterates `ast.getStatements()` and only counts `ExpressionStatement`s whose expression is a `StringLiteral`. A shebang (`#!/usr/bin/env node`) is SourceFile leading trivia in ts-morph/TypeScript's AST model — it is never represented as a `Statement` node — so it is structurally invisible to this function and always yields `directiveCount === 0` for a shebang file, which routes into the pre-existing `addImportDeclaration` branch (unchanged code path, same as before this diff). No line in the diff touches the `#invokeContained`/`ManipulationError` containment path (`dialect-handle.ts`) that produces the shebang's fail-closed reject — that logic is untouched by `1505d19`. `.33` (shebang) remains explicitly out of S-003's scope (owned by S-004, not yet built — its tasks are still `[ ]` in `slices.md`), so there is no shebang-specific test to run yet; this is expected and matches the Build Order.

### Strict TDD (in-loop audit)

**Iteration**: 4
**Verdict**: ok
**Delta scope**: 1 test file (`ops-addImport.test.ts`, +12 test cases in a new `describe` block), 1 impl file (`ops.ts`, +`selfAliased` field, +`leadingDirectiveCount`, Create-branch conditional), 2 new golden fixtures.

#### Findings
None blocking.

#### Tolerated for now (flagged, not a blocker)
- `selfAliased` is a genuinely new boolean branch in `satisfiesIdempotency`, and this iteration's delta adds exactly ONE test case (`.15`) that drives its `true` arm. Taken alone this would read as a triangulation gap. However: (a) the surrounding function `satisfiesIdempotency` is already triangulated across ≥4 cases spanning prior slices (unaliased named, aliased-to-different-name, default, namespace — S-000/S-001), so the function as a whole is not single-case-driven; (b) the spec (REQ-TSD-01.15) and design (§4.5 ADR-01, N1) both frame self-alias as a single PINNED deviation value, not a parameterized class needing its own internal triangulation — the executor's own TDD evidence table states this reasoning explicitly rather than omitting it. Judged sub-critical, consistent with `strict-tdd-verify.md`'s in-loop tolerance for "coverage gaps in adjacent code not touched" — here the gap is a deliberately-scoped single pin, not an unexamined branch. No action required; noted for final-mode awareness only.
- Regression check: all 25 previously-passing tests in the delta file (S-000/S-001 tests + the 8-scenario/12-case green-on-arrival S-003 additions) still pass — confirmed by the RED re-proof run above, not merely assumed.

#### Halts
None.

---

### Findings (severity)

None at CRITICAL, WARNING, or blocking SUGGESTION level. One informational note (triangulation tolerance for `selfAliased`, above) — not routed as a finding since it does not block.

### Artifacts
- Report: `openspec/changes/ts-addimport-collision/verify-in-loop-4.md`

### Risks
- None new. The `selfAliased` single-case triangulation note carries forward as an awareness item for `sdd-verify --mode=final`'s full audit, where the "no tolerated dimensions" rule applies — the final auditor should re-examine whether the design's "single pinned value" framing is still an adequate justification once all slices (including S-004/S-005's parity fitness `FIT-41`) have landed.

### skill_resolution
`none` — greenfield skill registry (present-and-empty), per launch instructions; house discipline (Strict TDD, `bun test`/`bun run typecheck`, byte-exact goldens) applied directly.
