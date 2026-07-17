## Verify In-Loop Result

**Change**: react-dialect
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton — the only slice built so far)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 6/6 (S-000.1..6, all `[x]` in `slices.md`)
- Full suite: `bun test` → **1674 pass / 0 fail** (baseline was 1639/0; net +35, matches the apply claim exactly)
- Typecheck: `bun run typecheck` (`tsc --noEmit`) → clean, exit 0
- Build: `tsc -p tsconfig.build.json` succeeds; `dist/dialects/react/index.d.ts` produced
- Spec compliance for scope: 15/15 scenarios (REQ-RXD-02 ×8, REQ-RXD-03 ×5, REQ-RXD-14.1, REQ-RXD-01.1 resolves-half)
- Assertion audit (delta test files): clean — no banned patterns found
- Boundary: `src/dialects/typescript/ast.ts` — 0 diff lines vs `main`; `bun.lock` — 0 diff (zero new deps)

### Commands run (evidence)

```
$ git diff --stat main..HEAD                       # 15 files changed, 710(+)/11(-)
$ bun test                                          # 1674 pass, 0 fail, 3387 expect() calls, 176 files, 27.35s
$ bun run typecheck                                 # tsc --noEmit, exit 0
$ rm -rf dist && tsc -p tsconfig.build.json && ...  # build succeeds
$ diff test/fitness/dts-baseline/react.index.d.ts dist/dialects/react/index.d.ts   # IDENTICAL
$ bun test test/fitness/fit-{04,09,14,36,37,38}*.test.ts   # 65 pass, 0 fail
$ bun test test/dialects/react/dialect.test.ts      # 13 pass, 0 fail (matches apply-progress claim of "13 tests")
$ git diff main..HEAD -- src/dialects/typescript/ast.ts     # empty (untouched)
$ git diff main..HEAD -- bun.lock package.json | rg dependencies   # empty (zero new deps; only exports map touched)
```

### Real-probe spot checks (executed via a throwaway script against the built module, not asserted from memory)

| Probe | Result |
|---|---|
| `find("Button.tsx")` | passes the gate (no immediate throw) |
| `find("src/Button")` (extensionless) | throws `... requires an explicit .tsx extension ... Append .tsx to the path.` |
| `find("Component.ts")` | throws `... use @pbuilder/sdk/typescript ...` |
| `find("Component.jsx")` | throws `... .jsx is not supported in v1 ... follow-up ...` |
| `find(".babelrc")` (dotfile) | throws `.tsx is the only extension ...` (suffix rule, not extensionless rule) |
| `find("Button.")` (trailing dot) | throws `.tsx is the only extension ...` (suffix rule) |
| `find("src/v1.2/Button")` (directory dot) | throws the SAME extensionless-requirement message as `src/Button` |
| `find("README.md")` | throws `.tsx is the only extension ...` |
| BOM+CRLF round-trip (`parse`→`print`, no edit) | byte-exact `true` |
| `import("@pbuilder/sdk/core")` | rejects — unresolvable, as required |

All eight gate-ordering probes match the design's classification order and the spec's tail catalog verbatim. Fidelity probe and unresolvable-`src/core` probe both confirmed live, not structural-only.

### Fitness functions (fit-36/37/38) — red-proof logic verified real, not tautological

- **fit-36** (spike-deps-absent): scans raw `package.json`/`bun.lock` text for 4 banned library names + deep-equals `dependencies` to `{ "ts-morph": "28.0.0" }`. Red-proof feeds a fixture manifest containing `magic-string` and a fixture lockfile containing `@babel/parser`/`recast` through the SAME scanner function (`findSpikeLibMatches`) used for the real files — both correctly caught.
- **fit-37** (core/commons AST-free): does a transitive relative-import graph walk from every `.ts` file in `src/core/**` and `src/commons/**`, resolving relative imports and flagging any AST-library bare specifier reached at ANY depth. A **permanent fixture** (`test/fixtures/red/fit-37-transitive/leaf.ts` → `helper.ts`) proves the transitive case for real: `leaf.ts` alone has no direct violation (a per-file scanner would miss it), but the graph walk correctly reaches `helper.ts`'s `import { Project } from "ts-morph"` through the relative edge.
- **fit-38** (parser-construction confinement): repo-wide regex scan (`\bnew\s+Project\s*\(`) over `src/**/*.ts`, authorized only for `src/dialects/*/ast.ts`. Confirmed non-vacuous: asserts BOTH `dialects/react/ast.ts` and `dialects/typescript/ast.ts` actually contain the construction (retro-covers the shipped TS dialect). Red-proof fixture string with `new Project()` outside any `ast.ts` is caught; a same-named `.Project()` call without `new` is correctly NOT flagged.

All three ran in the full-suite pass above and pass on the real repo tree.

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 4 new/changed test files (`dialect.test.ts`, `fit-36`, `fit-37`, `fit-38`) + 3 modified fitness test files (`fit-04`, `fit-09`, `fit-14`) + 2 new impl files (`ast.ts`, `index.ts`) + 2 new core-adjacent files (none — S-000 has no `src/core` additions) + 1 new fixture pair

- Banned assertion patterns: none found (`toBeDefined()`/`toBeTruthy()`/`toBeFalsy()` grep: zero hits; `objectContaining` as sole assertion: zero hits; the one `not.toThrow()` in `dialect.test.ts:134` is paired with a positive `toThrow()` assertion one line above — together they ARE the REQ-RXD-03.5 divergence proof, not a lone smoke check).
- Triangulation: the extension-gate's 4-way branch (`.tsx` pass / extensionless / `.ts` / `.jsx` / other-suffix, with dotfile and trailing-dot as sub-cases of the suffix branch) has 8 distinct test cases across its branches — no single-test branch. The BOM/no-BOM branch in `ast.ts` has ≥2 cases each side (03.2 with BOM; 03.1/03.3/03.4/03.5 without).
- Regression: all 1639 previously-passing tests still pass (full suite delta is a pure +35, 0 regressions).
- New-file-has-tests: both new impl files (`ast.ts`, `index.ts`) are exercised by `dialect.test.ts`; the 3 new fitness files are self-testing (test file IS the fitness function file, established repo pattern for FF-numbered files).
- Note: this repo commits per-slice, not per-TDD-cycle (single commit `6e02e7c` for the whole S-000 batch) — git-history TDD-cycle-adherence (Method 1) is not discriminating here; Method 2 (test-implementation pairing) was used instead and is clean. This is consistent with the project's established commit granularity, not a new deviation.

### Spec Compliance Matrix (scope: S-000 REQ set)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-RXD-01.1 (resolves-half) | subpath exports shape | `fit-09-pkg-exports-resolution.test.ts` | ✅ COMPLIANT |
| REQ-RXD-02.1 | `.ts` rejected, names typescript fix | `dialect.test.ts:18` | ✅ COMPLIANT |
| REQ-RXD-02.2 | `.jsx` rejected, names follow-up | `dialect.test.ts:22` | ✅ COMPLIANT |
| REQ-RXD-02.3 | other ext rejected, generic message | `dialect.test.ts:36` | ✅ COMPLIANT |
| REQ-RXD-02.4 | `.tsx` proceeds past gate | `dialect.test.ts:40` | ✅ COMPLIANT |
| REQ-RXD-02.5 | synchronous gate timing | `dialect.test.ts:55` | ✅ COMPLIANT |
| REQ-RXD-02.8 | dotfile/trailing-dot via suffix rule | `dialect.test.ts:59` | ✅ COMPLIANT |
| REQ-RXD-02.9 | extensionless basename rejects | `dialect.test.ts:77` | ✅ COMPLIANT |
| REQ-RXD-02.10 | directory dot doesn't count | `dialect.test.ts:90` | ✅ COMPLIANT |
| REQ-RXD-03.1 | JSX round-trip byte-exact | `dialect.test.ts:105` | ✅ COMPLIANT |
| REQ-RXD-03.2 | BOM preserved | `dialect.test.ts:116` | ✅ COMPLIANT |
| REQ-RXD-03.3 | CRLF preserved | `dialect.test.ts:121` | ✅ COMPLIANT |
| REQ-RXD-03.4 | generic-arrow round-trips | `dialect.test.ts:126` | ✅ COMPLIANT |
| REQ-RXD-03.5 | angle-bracket cast diverges | `dialect.test.ts:131` | ✅ COMPLIANT |
| REQ-RXD-14.1 | spike deps absent | `fit-36-spike-deps-absent.test.ts` | ✅ COMPLIANT |

**Compliance summary**: 15/15 in-scope scenarios compliant.

### Issues Found

**CRITICAL**: None
**WARNING**: None
**SUGGESTION**: None

Orchestrator action: exit loop, proceed to build S-001 (`setJsxProp` — the security-anchor op), then `/evaluate` (mode=final) once all six slices land.
