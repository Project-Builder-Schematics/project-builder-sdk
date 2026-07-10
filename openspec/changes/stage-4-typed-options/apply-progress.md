# Apply Progress: stage-4-typed-options

**Scope this run**: `slice:S-000` (walking skeleton) ONLY.
**Mode**: Strict TDD.
**Status**: S-000 complete — 5/5 tasks `[x]`.

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 7/7 |

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-model.ts` | Created | `SchemaKind`/`SchemaProperty`/`Schema` types (array, not Record — FIT-07 clean); `RESERVED_LIFECYCLE_NAMES` |
| `src/core/schema/schema-parse.ts` | Created | Wrapped `schema.json` bytes -> `Schema`; fail-closed on invalid JSON / missing `"properties"`; position locator (Gap 8); no raw-content echo |
| `src/core/schema/schema-validate.ts` | Created | S-000 scope: the "missing required key" finding only (RBV-01.1 site proof); safe iteration via `Object.hasOwn` over the schema's own declared properties |
| `src/core/schema/schema-discovery.ts` | Created | `schemaPathFor(packageDir)` — fixed adjacent-location discovery, no path argument |
| `src/core/schema/schema-digest.ts` | Created | SHA-256 of schema bytes via `node:crypto` |
| `src/core/schema/input-rejection.ts` | Created | Finding -> pinned REQ-AEC-09 message, thrown as a plain `Error` (constraint 1 — NO `AuthoringError` interim) |
| `src/core/schema/index.ts` | Created | Barrel for the cluster |
| `bin/emit-type.ts` | Created | Schema + digest -> `export type Input` text; escaping emitter (SEC-1: JSON.stringify all schema-derived strings, identifier allow-list for property keys, `*/`-guarded labels) |
| `bin/pbuilder-codegen.ts` | Created | `generateSchema(packageDir)` core (discover/read/parse/emit/write) + minimal CLI entry. Write-containment (TFO-05/SEC-4) and the full argv/exit/stream matrix are explicitly S-001's scope, not implemented here |
| `src/core/context.ts` | Modified | `defineFactory<O>(fn, options?: { packageDir })`; pre-`als.run` schema-conformance check when `packageDir` is threaded; bare `defineFactory(fn)` unchanged (untyped opt-out, REQ-TFO-02) |
| `package.json` | Modified | Added `#bin` field (`pbuilder-codegen`); extended `build` script with the `bun build bin/pbuilder-codegen.ts ...` step (not executed by the agent — session rule: never run `bun run build`) |
| `tsconfig.json` | Modified | Added `test/fixtures/red/**` to `exclude` (constraint 11, pre-empting S-001+'s red fixtures) |
| `test/fixtures/typed-factory/schema.json` | Created | Reference schematic schema (`port: number, required`) |
| `test/fixtures/typed-factory/schema.generated.ts` | Created | Generated via the real bin (`bun run bin/pbuilder-codegen.ts test/fixtures/typed-factory`); digest parity verified against the committed `schema.json` |
| `test/fixtures/typed-factory/factory.ts` | Created | Reference schematic factory using the schema-derived `Input` type |
| `test/e2e/typed-factory.e2e.test.ts` | Created | Outer-loop e2e (FPS-04.1, TFO-01.1, RBV-01.1 site proof) — happy path + reject variant against `ContractFake` |
| `test/types/typed-factory-options.test.ts` | Created | TFO-01.2 mutation-resistant `@ts-expect-error` proof (verified real by round-tripping the directive) + TFO-02.1 untyped-opt-out compile proof |
| `test/fitness/fit-07-no-tree-in-core.test.ts` | Modified | Recursive walk (ARCH-1) so `src/core/schema/**` is covered; surfaced two real `Record<string,...>` heuristic hits (fixed by switching to index-signature type syntax, not by weakening the checker) |
| `test/skeleton/{schema-parse,schema-digest,schema-validate,schema-discovery,input-rejection}.test.ts` | Created | Unit-level RED-GREEN coverage per module |
| `test/bin/{emit-type,pbuilder-codegen}.test.ts` | Created | Unit-level RED-GREEN coverage for the bin's core logic |

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| schema-parse.ts | `schema-parse.test.ts::lifts a wrapped schema.json...` | unit | `Cannot find module '.../schema-parse.ts'` | done | n/a — pure mapping, single case | none needed |
| schema-parse.ts (malformed) | `schema-parse.test.ts::throws SchemaParseFailure...invalid JSON` | unit | same module-not-found | done | 2 cases (invalid JSON, missing "properties") | none needed |
| schema-digest.ts | `schema-digest.test.ts::returns the SHA-256 hex digest` | unit | `Cannot find module '.../schema-digest.ts'` | done | 2 cases (determinism + byte-change) | none needed |
| schema-validate.ts | `schema-validate.test.ts::returns a 'missing' finding...` | unit | `Cannot find module '.../schema-validate.ts'` | done | 3 cases (missing / present / required:false) | none needed |
| schema-discovery.ts | `schema-discovery.test.ts::resolves schema.json adjacent...` | unit | `Cannot find module '.../schema-discovery.ts'` | done | n/a — single deterministic join | none needed |
| input-rejection.ts | `input-rejection.test.ts::renders a 'missing' finding...` | unit | `Cannot find module '.../input-rejection.ts'` | done | n/a — one finding kind this slice | none needed |
| bin/emit-type.ts | `emit-type.test.ts::emits the AUTO-GENERATED header...` | unit | `Cannot find module '.../emit-type.ts'` | done | 7 cases (header/required/optional/enum/label/quoted-key/hostile-label) | none needed |
| bin/pbuilder-codegen.ts | `pbuilder-codegen.test.ts::reads the adjacent schema.json...` | unit | `Cannot find module '.../pbuilder-codegen.ts'` | done | n/a — single integration path this slice | none needed |
| context.ts (run-boundary) | `typed-factory.e2e.test.ts::rejects a resolved input missing...` | e2e (outer loop) | assertion failure: expected `invalid input: port must be number`, got `changes could not be applied: unrepresentable-content` (proved the OLD emit-seam site fired, not the new run-boundary site) | done | n/a — S-003 triangulates the rest of the RBV-01 matrix | none needed |
| fit-07 recursive walk | `fit-07-no-tree-in-core.test.ts::recursively covers nested subdirectories...` | architectural | `toContain "schema/schema-model.ts"` failed — non-recursive scan returned only top-level files | done | n/a — structural walk fix | surfaced 2 real `Record<string,...>` hits in the new code, fixed via index-signature syntax (not by weakening the checker) |
| test/types/typed-factory-options.test.ts (TFO-01.2) | compile-time `@ts-expect-error` | unit(type) | manually verified the underlying `TS2339` fires when the directive is removed, then restored it | done | n/a — single mutation scenario | none needed |

## Deviations from Design

1. **`schema-validate.ts` created in S-000**, not named in the slices task's compressed directory-group notation (`schema/{schema-model,schema-parse,schema-discovery,schema-digest,input-rejection,index}.ts`). Judgment call: S-000's own acceptance criteria requires a "missing required key" rejection at the run boundary, and `input-rejection.ts` only maps findings — something has to produce the finding. Created `schema-validate.ts` now with ONLY the `missing` finding kind (strict-TDD minimal), matching design's own File Changes table (which lists it as a Create with no slice tag) and its own task-list phrasing for S-003 ("triangulation" of the rest of the RBV-01 matrix into this same file). Flagged here per the Craftsman preamble rule — not a silent deviation.
2. **`bin/pbuilder-codegen.ts`'s CLI argv/exit/stream matrix and write-containment (TFO-05) are intentionally NOT implemented in S-000** — S-001 owns `test/bin/codegen-cli.test.ts` (the full spawn-based CLI suite) per its own task list. S-000 ships the core `generateSchema()` function (discover/read/parse/emit/write) plus a minimal `import.meta.main` entry point, sufficient to manually generate the committed fixture and prove the emitter is correct from day 1 (constraint 2). This is staged rollout per the signed slices plan, not scope-cutting.
3. **`context.ts`'s non-ENOENT read-error handling treats every read failure the same as "no schema.json"** (silently skips validation) — this is INTENTIONALLY the S-000 minimum; the RBV-05 non-ENOENT fail-closed distinction (EACCES etc. must FAIL CLOSED, never degrade to the opt-out) is S-003's explicit task. Documented inline in `context.ts` so the gap is visible to the next reader, not a silent landmine.
4. Removed a first-draft over-scope: I initially wrote the full `@example`/`@param`/`@remarks` JSDoc block onto `defineFactory` (S-005's task), including a `@remarks` describing reserved-lifecycle-name behaviour that S-004 has not built yet. Caught and reverted before commit — replaced with a plain comment; the structured JSDoc (and its dedicated `definefactory-jsdoc.test.ts` proof) is deferred to S-005 as designed.

## Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0031)

- **Group 1 (subset)**: TFO-01(.1,.2), TFO-02(.1), RBV-01(.1), FPS-01(.1) — implementing code + asserting test present for each. FPS-04(.1) — covered for the "runs end-to-end, commits" clause; the FIT-12/FIT-13-passing sub-clause is out of scope until S-002 lands those gates (matches S-000's own acceptance text, which only claims run+commit, not the fitness-gate clause).
- **Group 2 (Architecture)**: No layer violations (bin imports `src/core/schema/*` only, never the reverse — FPS-03 direction holds even though FIT-15 itself lands in S-001). No ADR contradictions found against ADR-0027/0029/0031's Decision sections. Known, plan-declared gaps (write-containment SEC-4, non-ENOENT fail-closed SEC-3) are S-001/S-003 tasks per slices.md, not omissions introduced here.
- **Group 3 (Code quality)**: No untyped casts (`as any`/`as never`/`as unknown as X`) introduced. No magic numbers. No TODO/FIXME markers (deferred behaviour documented via prose comments naming the owning future slice, matching the codebase's existing convention). No dead duplicates.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## Test Evidence

`bun test` (full suite): 392 pass, 0 fail, 687 `expect()` calls, 64 files (baseline was 359 pass / 55 files before this slice; +33 tests, +9 files).
`bunx tsc --noEmit`: clean (no output, exit 0).

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-000) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 7/7 |

## Next Step

Ready for `/build --scope=slice:S-001` (or `S-002`/`S-003`/`S-004`, all parallelizable — each requires only S-000). Note the pre-existing dirty `.sdd/state/stage-4-typed-options.json` observed at session start (before any change by this agent) — orchestrator-owned, not touched here; flagging for orchestrator awareness.
