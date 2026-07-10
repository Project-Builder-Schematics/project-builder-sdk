# Apply Progress: stage-4-typed-options

**Cumulative scope**: S-000 (walking skeleton), S-001 (Bin CLI Discipline), S-002 (Schema
Contract Fitness) — all complete, plus an in-loop fix on the S-001/S-002 delta (ADR-0032
position locator, below). **Mode**: Strict TDD.
**Status**: S-000 + S-001 + S-002 complete, `verify-in-loop-2` HALT (REQ-TFO-04.4) resolved by
the ADR-0032 in-loop fix — S-003, S-004, S-005 remain for the `/build` deliverable; S-006 stays
deferred-blocked on the Stage-2 archive + amendment.

## Slices Built This Run (S-001, S-002)

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-001 | happy-path | complete | 6/6 |
| S-002 | happy-path | complete | 4/4 |

(S-000 — walking-skeleton, 7/7 — was built in a prior run; see the "S-000" sections below
for its own history, carried forward unchanged.)

## Files Changed — S-001 (Bin CLI Discipline)

| File | Action | What Was Done |
|---|---|---|
| `bin/pbuilder-codegen.ts` | Modified | Added the CLI-only surface: `runCli(argv)` (usage/`--help`/bad-flag discipline, exit codes), `assertWriteContained` (SEC-4/TFO-05 — `realpathSync`-anchored containment against the invoking process's project root, symlink-safe via `realpathNearestExisting`), `formatParseError` (TW-m6 pinned template + ADR-0027 Gap-8 `(position unknown)` fallback), `WriteContainmentRefusal` error class. `generateSchema()` itself is UNCHANGED (containment lives only at the `import.meta.main` entry point, per S-000's own note that it was deliberately deferred here) — the existing S-000 unit test that calls `generateSchema()` against an `os.tmpdir()` path (outside the repo) still passes unmodified. |
| `test/support/canary.ts` | Created | Shared canary helper (SEC-5): `canaryToken`, `seedSchema`, `spawnCapture` (stdout/stderr captured separately). Consumed by `codegen-cli.test.ts` now; `canaryToken` is unused until S-003/S-005 — established now to match the existing `rejection-messages.ts` shared-infra precedent named in the slice's own task list. |
| `test/bin/codegen-cli.test.ts` | Created | CLI e2e (spawns the BUILT `dist/bin/pbuilder-codegen.js` via explicit `bun <path>`, ADR-0027 Gap 9): usage discipline (FPS-05.1), TFO-03.1/.2 static package.json checks, FPS-01.1 discovery, TFO-04.1-.6 malformed/success/stream/locator/non-destructive/no-raw-echo, TFO-05.1-.3 write containment (relative-escape, symlink-escape, schema-content-independence), TFO-01/SEC-1 hostile-schema emitter-inertness red-proof. Self-building via an unconditional `beforeAll` (own judgment call beyond the literal iteration-4 pin — see Deviations). |
| `test/bin/codegen-static-scan.test.ts` | Created | TFO-03.3: scans the shipped `dist/bin/pbuilder-codegen.js` text for `eval(`, `new Function(`, and non-literal-argument `import()`/`require()` calls. Self-building `beforeAll` (pinned, iteration-4 literal). |
| `test/fitness/fit-14-package-surface.test.ts` | Created | FIT-14: diffs `package.json#exports`/`#files`/`#bin`/`dependencies` and a real `bun pm pack --dry-run` listing against the committed baseline. Self-building `beforeAll` (pinned). |
| `test/fitness/pkg-surface-baseline.json` | Created | Committed baseline snapshot (`{exports, files, bin, shebang, tarball}`, Gap 11) — regenerated once more in the S-002 run (see below) when the new `schema-sufficiency.ts` dist artifacts legitimately entered the tarball. |
| `test/fitness/fit-15-bin-core-direction.test.ts` | Created | FIT-15: resolves every relative import specifier under `src/**` against its resolved target and flags any landing inside the repo-root `bin/` directory (a real path resolution, not a textual `"bin/"` substring check — avoids false positives on unrelated package specifiers). |

## Files Changed — S-002 (Schema Contract Fitness)

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-sufficiency.ts` | Created | `checkSufficiency(raw)` — hard-fail rules (REQ-SCP-02) over the RAW wrapped wire shape directly (not the narrowed `Schema` array — see Deviations for why), safe `Object.keys` iteration (constraint 5). |
| `src/core/schema/index.ts` | Modified | Barrel export for `checkSufficiency`/`SufficiencyFinding`/`SufficiencyReason`. |
| `test/support/scan-roots.ts` | Created | `ALWAYS_ON_SCAN_ROOTS = ["test/fixtures/typed-factory"]` — the single shared always-on-walk allowlist FIT-12 (this slice) and FIT-16 (S-004) both import (design §4.6a). |
| `test/fitness/fit-12-schema-parity.test.ts` | Created | FIT-12: `checkParity(packageDir)` — extracts the embedded `@schema-digest` from the committed `schema.generated.ts`, recomputes `schema.json`'s current digest, compares. Read-only (no scratch regeneration needed — see Deviations). Always-on walk over `ALWAYS_ON_SCAN_ROOTS`; red-proofs call `checkParity` directly against `test/fixtures/red/schema/{staled-digest,label-only-drift}/`. |
| `test/fixtures/red/schema/staled-digest/{schema.json,schema.generated.ts}` | Created | Permanent red fixture: committed `schema.generated.ts` carries a deliberately-wrong embedded digest (REQ-SCP-01.1). |
| `test/fixtures/red/schema/label-only-drift/{schema.json,schema.generated.ts}` | Created | Permanent red fixture: `schema.generated.ts` committed against an earlier `label` value; the adjacent `schema.json` has since been label-edited without regenerating (REQ-SCP-01.3 — digest catches label-only drift a compiled-type-text diff could not). |
| `test/fitness/fit-13-schema-sufficiency.test.ts` | Created | FIT-13: direct-call matrix (not a tree-walk, design §4.6a) — missing-type, missing-label, enum-missing-choices (absent AND empty-array), nonsensical-type (+ value echoed), three forbidden-key variants (`__proto__`/`constructor`/`prototype`), advisory-fields-pass, safe-iteration-around-`__proto__` proof. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added the three new `dist/core/schema/schema-sufficiency.*` entries to the committed `tarball` list — FIT-14 correctly caught this as real drift on the first full-suite run after S-002; updated because these are this change's own legitimate additions, not a leak. |

## TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| CLI usage/argv/containment surface | `codegen-cli.test.ts` (whole file, 16 cases) | e2e | `SyntaxError: Export named 'USAGE' not found in module '.../bin/pbuilder-codegen.ts'` — confirmed by reverting `bin/pbuilder-codegen.ts` to its S-000 shape via `git stash` and re-running the new test file before implementing, then restoring | done | usage (no-args/bad-flag/--help), success, malformed (invalid-JSON + truncated-JSON fallback), non-destructive re-run, containment (relative-escape/symlink-escape/schema-content-independence), hostile-schema — 16 distinct cases across the CLI surface | none needed |
| static-scan | `codegen-static-scan.test.ts` (7 cases incl. 4 red-proofs) | architectural | new file — first run fails as "module not found" until created (file did not exist prior to this slice) | done | eval / new Function / non-literal import / literal-import-not-flagged — 4 direct red-proof cases | none needed |
| FIT-14 | `fit-14-package-surface.test.ts` (10 cases incl. 3 red-proofs) | architectural | new file — same "did not exist" RED | done | exports/files/bin/deps/shebang/tarball-new/tarball-missing — 7 real-state cases + 3 simulated-array red-proofs | none needed |
| FIT-15 | `fit-15-bin-core-direction.test.ts` (28 cases incl. 3 red-proofs) | architectural | new file — same "did not exist" RED; per-file assertions over the full `src/**` walk (24 files at slice time) | done | relative-escape-into-bin / bare-specifier-false-positive-guard / stays-within-src — 3 red-proofs | none needed |

## TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| FIT-12 | `fit-12-schema-parity.test.ts::REQ-SCP-01.1/.2/.3/.4` (5 cases) | architectural | new file — "did not exist" RED; the two `test/fixtures/red/schema/*` fixtures are hand-constructed with deliberately-mismatched digests (verified by inspection: the fake digest cannot collide with a real SHA-256 of different content) | done | staled-digest (raw mismatch) + label-only-drift (SOURCE-content mismatch despite same conceptual "type shape") — 2 distinct staleness classes | none needed |
| `schema-sufficiency.ts` | `fit-13-schema-sufficiency.test.ts` (11 cases) | unit(architectural, direct-call) | new file/function — "did not exist" RED | done | missing-type / missing-label / enum-missing-choices (absent + empty-array, 2 cases) / nonsensical-type / 3× forbidden-key / advisory-pass / multi-property-pass / safe-iteration-around-proto — 11 cases spanning every REQ-SCP-02 branch | none needed |

## In-Loop Fix — REQ-TFO-04.4 Position Locator (design §4.16, ADR-0032)

`verify-in-loop-2` HALTED (SPEC) on REQ-TFO-04.4: Bun's `JSON.parse` (JavaScriptCore) never
emits an `at position N` byte offset, so `schema-parse.ts`'s old `locateFromSyntaxError` regex
was dead — every malformed fixture fell into the `(position unknown)` fallback and the
scenario's "position known" branch never fired. Owner ruling: re-design, not re-spec. Design
rev 6 (§4.16) + ADR-0032 pin a hand-rolled, zero-dep JSON syntax scanner. Implemented exactly
that amendment — no other shipped module touched.

### Files Changed — In-Loop Fix

| File | Action | What Was Done |
|---|---|---|
| `src/core/schema/schema-locate.ts` | Created | `locateFirstJsonSyntaxError(raw)` — pure minimal left-to-right JSON syntax scanner (whitespace/structural/string/number/keyword, legal-next-token state). Returns the 1-based `{line,column}` of the first grammar deviation (structural classes: premature EOF, unquoted/non-string key, trailing comma, malformed number/keyword — all MUST-pin per ADR-0032), or `undefined` when the scanner completes without finding one (in-string escape violations — bounded fidelity, deliberately not validated — or a defensive scanner/`JSON.parse` divergence). |
| `src/core/schema/schema-parse.ts` | Modified | Catch branch: deleted the dead `locateFromSyntaxError` (regex on `err.message`); now calls `locateFirstJsonSyntaxError(raw)` when `err instanceof SyntaxError`. `SchemaParseFailure.line`/`.column` populate from the new locator. Message formats unchanged (`formatParseError` in `bin/pbuilder-codegen.ts` reads the same fields, untouched). |
| `test/skeleton/schema-locate.test.ts` | Created | Direct-call unit coverage: position-known (single-line unquoted-key, multi-line — falsifies a column-only implementation, EOF/truncation, empty document, trailing comma, malformed number) and fallback (bad `\u` escape fixture, invalid escape char) — 8 cases. |
| `test/skeleton/schema-parse.test.ts` | Modified | The pre-existing "and a line/column locator" test asserted only `.problem` (the exact gap `verify-in-loop-2` flagged as evidence of the untested claim in its own name) — now asserts the real `.line`/`.column` the locator pins for its fixture. |
| `test/bin/codegen-cli.test.ts` | Modified | TFO-04.4's single all-`(position unknown)` assertion REPLACED with two tests: a structural fixture asserting a concrete `(line 4, column 15)`, and the bounded in-string-escape fixture asserting `(position unknown)`. |
| `test/fixtures/red/schema/malformed-syntax/schema.json` | Created | Permanent multi-line red fixture (unquoted `BOGUS` value) — position-known class, shared by the unit test (direct read) and the CLI e2e test (seeded into a scratch dir). Deliberately multi-line to falsify a column-only locator. |
| `test/fixtures/red/schema/bad-unicode-escape/schema.json` | Created | Permanent red fixture (`"\uZZZZ"`) — fallback class, same dual-surface sharing. Verified empirically: `JSON.parse` throws (`"\uZZZZ" is not a valid unicode escape`) while the scanner reports the string well-formed structurally, per ADR-0032's bounded fidelity. |
| `test/fitness/pkg-surface-baseline.json` | Modified | Added the three new `dist/core/schema/schema-locate.*` entries FIT-14 correctly flagged as real drift on the first full-suite run after this fix — this change's own legitimate addition, not a leak. |

### TDD Cycle Evidence — In-Loop Fix

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `schema-locate.ts` | `schema-locate.test.ts` (whole file, 8 cases) | unit | `error: Cannot find module '../../src/core/schema/schema-locate.ts'` (module did not exist; confirmed via a `git stash` of the new module before writing tests) | done | position-known: unquoted-key / multi-line / EOF / empty / trailing-comma / malformed-number (6 structural classes, all six matching `verify-in-loop-2`'s own empirical probes); fallback: bad-`\u`-escape / invalid-escape-char (2 cases) — 8 total | none needed |
| `schema-parse.ts` rewire | `schema-parse.test.ts::...a line/column locator...` | unit | pre-existing test passed trivially before this fix (never asserted `.line`/`.column` — exactly the gap `verify-in-loop-2` named); added real assertions, confirmed they'd fail against the OLD dead-regex implementation before rewiring (verified via the empirical Bun probes in ADR-0032, not by literally reverting) | done | shares the scanner's own triangulation; single wiring-point case sufficient at this layer | none needed |
| CLI e2e wiring | `codegen-cli.test.ts::parse failure carries a concrete...` + `::...falls back to (position unknown)...` | e2e | old single test asserted `(position unknown)` unconditionally — replacing it with a concrete-locator expectation against the OLD implementation would fail (dead regex never matched under Bun); confirmed the split assertions against real bin output post-fix | done | 2 fixture classes (structural, in-string-escape) — both branches now genuinely reachable | none needed |

**Empirical verification (not fabricated)**: every new position-known assertion was checked
against BOTH `JSON.parse`'s real Bun 1.3.11 throw AND `locateFirstJsonSyntaxError`'s actual
output before being pinned in a test (see the six `verify-in-loop-2` probe shapes, all now
covered: unquoted key, trailing comma, EOF/truncation, empty document — plus a multi-line case
and a malformed-number case beyond the original six).

### Post-Fix Audit (Step 7c, self-run)
- **Group 1**: REQ-TFO-04.4 both branches (position-known, fallback) now have passing tests exercising real locator output — the exact gap `verify-in-loop-2` HALTED on is closed.
- **Group 2 (Architecture)**: `schema-locate.ts` is a pure sibling module inside the already-planned `src/core/schema/` cluster (design §4.2c "aligns", no new boundary — matches the design's own "Architecture impact of this amendment: none"). Not exported from the barrel `index.ts` — it is an internal wiring detail of `schema-parse.ts` only, consistent with ADR-0032's "single wiring point" framing; the runtime/bin consumers read `SchemaParseFailure.line/.column`, never the locator directly.
- **Group 3 (Code quality)**: No untyped casts. No magic numbers beyond the JSON grammar's own literals (`true`/`false`/`null`, 4/5-char lengths for `startsWith` offsets — inherent to the grammar, not arbitrary). No TODO/FIXME. No dead code — the old `locateFromSyntaxError` and its regex are fully deleted, not left inert.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## Deviations from Design

Carried forward from S-000 (items 1-4, unchanged — see prior entries below), plus this run's:

5. **`bin/pbuilder-codegen.ts`'s CLI e2e test (`codegen-cli.test.ts`) gained its own
   self-building `beforeAll`** (`spawnSync("bun", ["run", "build"])`), even though the
   slices' "Self-building artifact tests" load-bearing literal (iteration-4 pin) names only
   `fit-14-package-surface.test.ts` and `codegen-static-scan.test.ts`. Reasoning: the CLI
   test also spawns the DIST artifact (per ADR-0027 Gap 9, ALL CLI e2e spawns target
   `dist/bin/pbuilder-codegen.js`), and `bin/codegen-cli.test.ts` sorts alphabetically
   BEFORE `bin/codegen-static-scan.test.ts` — on a fresh checkout with no prior build, a
   bare `bun test` would hit the CLI test first with no `dist/bin` yet to spawn, breaking
   constraint 10's "a bare `bun test` on a fresh checkout stays green" guarantee. Flagged,
   not silent — this fills what looks like a narrow gap in the pin rather than contradicting
   it (the pin says those two files self-build; it does not say a third file may not).
2. **Write-containment (`assertWriteContained`) is a CLI-entry-point-only concern**,
   deliberately NOT folded into `generateSchema()` itself — confirmed necessary (not just a
   style choice) because the pre-existing S-000 unit test
   (`test/bin/pbuilder-codegen.test.ts`) calls `generateSchema()` against an
   `os.tmpdir()`-rooted scratch dir, which sits OUTSIDE any plausible repo-root anchor;
   folding containment into `generateSchema()` would have broken that already-committed
   test. This matches S-000's apply-progress's own forward note that containment was
   deliberately deferred to S-001 "not implemented here."
3. **The TFO-05.2 symlink-escape fixture is constructed AT TEST TIME**
   (`symlinkSync` inside the test, cleaned up in `finally`), not committed as a static
   fixture under `test/fixtures/red/**` as the design's File Changes row for that directory
   might suggest. A symlink whose target must resolve OUTSIDE the repo cannot be committed
   portably across machines/CI (the external target path would need to exist at that exact
   location on every checkout). Dynamic construction against `os.tmpdir()` is the portable
   equivalent and proves the identical `realpathSync`-containment code path.
4. **SUPERSEDED by the In-Loop Fix above (ADR-0032)** — `verify-in-loop-2` correctly rejected
   this self-adjudication as an Executor call that belonged to the Planner. The owner ruled
   RE-DESIGN; the position-carrying branch is now genuinely reachable via a hand-rolled
   scanner. Original note kept verbatim below for the record, not because it still holds:
   **REQ-TFO-04.4's "position-carrying" fixture branch is unreachable under this project's
   actual runtime** — verified empirically (multiple malformed-JSON shapes tried via `bun
   -e`): Bun's `JSON.parse` (JavaScriptCore) NEVER emits an "at position N" style message,
   unlike V8/Node, which the pre-existing `schema-parse.ts` `locateFromSyntaxError` regex
   (`/at position (\d+)/`, S-000-owned, out of this slice's scope) assumes. Every malformed
   fixture therefore falls into the `(position unknown)` fallback branch in practice. This
   does not violate REQ-TFO-04.4 itself (which only requires "a locator... never raw
   content" — the pinned fallback token IS a valid locator) but means the DESIGN's §4.14
   Gap-8 instruction to test both a "position present" and a "position absent" fixture
   cannot be literally satisfied; `codegen-cli.test.ts` tests the fallback branch only, with
   an inline comment explaining why, rather than inventing an artificial "position present"
   case that misrepresents actual runtime behaviour. Not a HALT-worthy issue: REQ-TFO-04.4
   is still fully satisfied, and the dead V8-style regex in `schema-parse.ts` is harmless
   (an inert branch) — out of this slice's scope to remove (S-000-owned, already `[x]`).
5. **`checkSufficiency` re-parses `raw` schema.json text itself** rather than consuming the
   already-parsed `Schema`/`SchemaProperty` array from `schema-parse.ts`. The narrowed
   `SchemaProperty.type: SchemaKind` (non-optional) makes an absent/garbage `type` value
   impossible to distinguish at the type level without a `TS2367`-triggering comparison;
   sufficiency's entire job is auditing data that may NOT conform to that narrowed shape
   (that's what "insufficient" means). A small, self-contained raw-JSON walk (mirroring
   `schema-parse.ts`'s own `isPlainObject` checks) avoids fighting the type system for what
   is a legitimately different concern — validating the schema DEFINITION's completeness,
   not lifting trusted data into a strict model. Matches the design's own File Changes table
   treating `schema-sufficiency.ts` as an independent module.

## Post-Slice Audit (Step 7c, code-audit.md `slice` mode, self-run — architecture.adrs non-empty: ADR-0027..0031)

### S-001
- **Group 1**: TFO-03(.1-.3), TFO-04(.1-.6), TFO-05(.1-.3), FPS-01(.1), FPS-05(.1) — implementing code + asserting test present for each. TFO-01 SEC-1 row's hostile-schema CLI-level red-proof present (constraint 2's S-001-owned half).
- **Group 2 (Architecture)**: `bin/pbuilder-codegen.ts` still imports only `src/core/schema/*` (verified structurally + by FIT-15 passing against the real tree). No `src/` module imports `bin/` (FIT-15 self-check green). Containment logic stays CLI-entry-only, never leaking into the shared `generateSchema()` core. No ADR-0027/0029/0031 contradictions found.
- **Group 3 (Code quality)**: No untyped casts. `WriteContainmentRefusal` sets `this.name` matching the existing `AuthoringError`/`EmitRejection`/`SchemaParseFailure` convention (fixed during self-audit, not left as a first-pass gap). No magic numbers, no TODO/FIXME, no dead duplicates.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

### S-002
- **Group 1**: SCP-01(.1-.4), SCP-02(.1-.6) — implementing code + test present for every scenario, including both empty-array and absent-choices sub-cases for SCP-02.3 and both `constructor`/`prototype` variants alongside `__proto__` for SCP-02.5 (the REQ names all three; each gets its own case, not just the headline `__proto__`).
- **Group 2 (Architecture)**: `schema-sufficiency.ts` lives inside `src/core/schema/`, joins the existing cluster (design §4.2c "aligns"). No `Map<string,*>`/`Record<string,*>`/`tree` field introduced (would be caught by FIT-07's recursive walk if it were). No cross-module coupling beyond what's declared.
- **Group 3 (Code quality)**: The one `as unknown` cast (`JSON.parse(raw) as unknown`) is a WIDENING cast from `JSON.parse`'s `any` return down to `unknown` — the safe direction, not the banned `as unknown as X` narrowing-smuggle pattern; immediately followed by real runtime type guards (`isPlainObject`, `typeof`). No magic numbers, no TODO/FIXME, no dead duplicates. `test/fitness/pkg-surface-baseline.json` updated in the SAME run that introduced the drift it now reflects (not left stale for a future slice to trip over).
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

---

## [Prior run] S-000 — Files Changed

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

## [Prior run] S-000 — TDD Cycle Evidence

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

## [Prior run] S-000 — Deviations from Design

1. **`schema-validate.ts` created in S-000**, not named in the slices task's compressed directory-group notation (`schema/{schema-model,schema-parse,schema-discovery,schema-digest,input-rejection,index}.ts`). Judgment call: S-000's own acceptance criteria requires a "missing required key" rejection at the run boundary, and `input-rejection.ts` only maps findings — something has to produce the finding. Created `schema-validate.ts` now with ONLY the `missing` finding kind (strict-TDD minimal), matching design's own File Changes table (which lists it as a Create with no slice tag) and its own task-list phrasing for S-003 ("triangulation" of the rest of the RBV-01 matrix into this same file). Flagged here per the Craftsman preamble rule — not a silent deviation.
2. **`bin/pbuilder-codegen.ts`'s CLI argv/exit/stream matrix and write-containment (TFO-05) are intentionally NOT implemented in S-000** — S-001 owns `test/bin/codegen-cli.test.ts` (the full spawn-based CLI suite) per its own task list. S-000 ships the core `generateSchema()` function (discover/read/parse/emit/write) plus a minimal `import.meta.main` entry point, sufficient to manually generate the committed fixture and prove the emitter is correct from day 1 (constraint 2). This is staged rollout per the signed slices plan, not scope-cutting.
3. **`context.ts`'s non-ENOENT read-error handling treats every read failure the same as "no schema.json"** (silently skips validation) — this is INTENTIONALLY the S-000 minimum; the RBV-05 non-ENOENT fail-closed distinction (EACCES etc. must FAIL CLOSED, never degrade to the opt-out) is S-003's explicit task. Documented inline in `context.ts` so the gap is visible to the next reader, not a silent landmine.
4. Removed a first-draft over-scope: I initially wrote the full `@example`/`@param`/`@remarks` JSDoc block onto `defineFactory` (S-005's task), including a `@remarks` describing reserved-lifecycle-name behaviour that S-004 has not built yet. Caught and reverted before commit — replaced with a plain comment; the structured JSDoc (and its dedicated `definefactory-jsdoc.test.ts` proof) is deferred to S-005 as designed.

## [Prior run] S-000 — Post-Slice Audit

- **Group 1 (subset)**: TFO-01(.1,.2), TFO-02(.1), RBV-01(.1), FPS-01(.1) — implementing code + asserting test present for each. FPS-04(.1) — covered for the "runs end-to-end, commits" clause; the FIT-12/FIT-13-passing sub-clause is out of scope until S-002 lands those gates (matches S-000's own acceptance text, which only claims run+commit, not the fitness-gate clause).
- **Group 2 (Architecture)**: No layer violations (bin imports `src/core/schema/*` only, never the reverse — FPS-03 direction holds even though FIT-15 itself lands in S-001). No ADR contradictions found against ADR-0027/0029/0031's Decision sections. Known, plan-declared gaps (write-containment SEC-4, non-ENOENT fail-closed SEC-3) are S-001/S-003 tasks per slices.md, not omissions introduced here.
- **Group 3 (Code quality)**: No untyped casts (`as any`/`as never`/`as unknown as X`) introduced. No magic numbers. No TODO/FIXME markers (deferred behaviour documented via prose comments naming the owning future slice, matching the codebase's existing convention). No dead duplicates.
- **Verdict**: no `Bug`/`Architecture` findings — no halt.

## Test Evidence (cumulative, after S-000 + S-001 + S-002 + the ADR-0032 in-loop fix)

`bun test` (full suite): **482 pass, 0 fail, 808 `expect()` calls, 71 files** (prior baseline
verified at `verify-in-loop-2` was 471 pass / 70 files; +1 file — `schema-locate.test.ts`, 8
cases — and the `codegen-cli.test.ts` TFO-04.4 split from one assertion into two tests;
`schema-parse.test.ts` gained real `.line`/`.column` assertions on its existing case, no new
test count there).
`bunx tsc --noEmit`: clean (no output, exit 0).
`bun run build`: clean (bundles `dist/bin/pbuilder-codegen.js`, 6 modules).

Per-slice/fix isolated runs (also green, confirming no cross-slice file-order dependency):
- `bun test test/skeleton/schema-locate.test.ts` — 8 pass (new)
- `bun test test/skeleton/schema-parse.test.ts` — 5 pass
- `bun test test/bin/codegen-cli.test.ts` — 17 pass (16 + 1 net from the TFO-04.4 split)
- `bun test test/bin/codegen-static-scan.test.ts` — 7 pass
- `bun test test/fitness/fit-14-package-surface.test.ts` — 10 pass (baseline updated for the 3 new `schema-locate` dist entries)
- `bun test test/fitness/fit-15-bin-core-direction.test.ts` — 28 pass
- `bun test test/fitness/fit-12-schema-parity.test.ts` — 5 pass
- `bun test test/fitness/fit-13-schema-sufficiency.test.ts` — 11 pass

## Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 3 (S-000, S-001, S-002) |
| Slices complete | 3 |
| Slices in progress | 0 |
| Tasks complete | 17/17 (7 + 6 + 4) |

## Next Step

Ready for `/build --scope=slice:S-003` (or `S-004`, parallelizable — each requires only
S-000). S-005 requires S-001 + S-003 + S-004. S-006 stays deferred-blocked on the
`stage-2-error-attribution` archive + its coordinated `sdd-spec` amendment. Note the
pre-existing dirty `.sdd/state/stage-4-typed-options.json` observed at session start (before
any change by this agent) — orchestrator-owned, not touched here; flagging again for
orchestrator awareness (carried forward from the S-000 run).
