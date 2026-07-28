# Apply Progress: inline-collection-marker

**Scope so far**: `slice:S-000` (walking skeleton, run 1), `slice:S-001` (path-guards TOTAL
hardening, run 2), `slice:S-002` (public contract narrows — `AuthoringReason` 12 → 11, run 3),
`slice:S-003` (full suite realigned — no stale ceiling/marker assertion survives, run 4)
**Mode**: Strict TDD — double-loop where practical (S-000.2/.3 RED → S-000.4/.5/.6 GREEN
drives the fix); S-000.6's `walk.ts` recursive-read guard was implemented before its
`walk.test.ts` pins landed (a process deviation, documented below) — all four resulting
tests are non-vacuous by construction (they assert exact message text a wrong/missing
guard cannot produce) and were confirmed to fail when the guard was temporarily removed.
S-001 required the SAME non-vacuousness discipline for a structural reason documented in
its own Deviations entry below. S-003 is predominantly TEST-REALIGNMENT (the production
code already landed in S-000/S-001) — the "RED" for each edited assertion is the STABLE
PRE-EXISTING failure captured in the baseline this run inherited (verify-in-loop-3's 12
residuals); the "GREEN" is the corrected expectation. New behaviour-proving tests
(REQ-BRC-02.1, the REQ-AEC-11.2 both-escape winner) follow the normal RED-first cycle where
a real RED was produced, or mutation-check where the fixture passed first-run because the
implementation already existed (same disclosed discipline as S-001's Deviation #6).

## Slices Built

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 8/8 |
| S-001 | edge-case | complete | 7/7 |
| S-002 | edge-case | complete | 7/7 |
| S-003 | edge-case | complete | 8/8 |

## Files Changed

| File | Action | Slice | What Was Done |
|---|---|---|---|
| `openspec/specs/authoring-error-contract/spec.md` | Modified | S-000.1 | Restored REQ-AEC-10/11/12 (verbatim, 12-member pre-narrowing text) from the archived `schematic-local-files` delta into the main spec — closes an unrelated archive-sync gap that this change's own MODIFIED blocks depend on. |
| `test/scaffold/run-boundary.test.ts` | Rewritten | S-000.2 | Flipped from "missing ancestor rejects" to "missing ancestor never blocks the run" (REQ-MFB-01.1) + a zero-marker-probe regression (REQ-RBV-06.2). |
| `test/e2e/scaffold.e2e.test.ts` | Modified | S-000.2 | Inverted the RBV-06.1 sentinel test: the sentinel throw now propagates unchanged instead of being pre-empted. |
| `test/fake/harness-opted-in.test.ts` | Modified | S-000.2 | Dropped the `existsSync(collection.json)` probe from the declared-reads allowlist (3→2 reads); added an explicit call-ORDER test (readdirSync before readFileSync) via a direct pass-through spy pair, since the shared `instrumentHarnessIO` rig cannot reconstruct cross-function chronology. |
| `test/scaffold/inline-collection.test.ts` | Created | S-000.3 | The authoritative REQ-MFB-01.1/.2 regression — own `mkdtemp`, full-ancestor-chain-no-marker precondition asserted explicitly, sentinel test + all-three-verbs test (create/scaffold byte-exact, copyIn emitted-directive-shape only per B5). |
| `src/core/context.ts` | Modified | S-000.4 | Deleted `resolvePackageRoot`/`missingPackageRootMessage`/now-unused `existsSync`/`dirname`/`join` imports; `RunContext.packageAnchors` collapsed to `{ packageDir: string }`; `requirePackageAnchors` return type narrowed to match; bootstrap read-set is now exactly 2, ordered (`checkReservedNames` → `validateAtRunBoundary`). |
| `test/skeleton/run-boundary-validation.test.ts` | Modified | S-000.4 | Added the REQ-MFB-01.3 runtime positive-shape pin: `Object.keys(packageAnchors)` deep-equals `["packageDir"]`. |
| `src/scaffold/containment.ts` | Deleted | S-000.5 | The whole dual-anchor ceiling machinery — retired per ADR-0077. |
| `src/scaffold/path-guards.ts` | Created | S-000.5 | `validateSourceLexical`, `statSourceForRead` (TOTAL error-mapping guard per design §4's table), `validateDestinationLexical` + private `isLexicallyEscaping`/`sourceRejection`/`destinationEscapeMessage`. |
| `src/scaffold/index.ts` | Modified | S-000.5 | Screen sites 1 (`readTemplateFile`) and 3 (`runCopyIn`) wired; `runCopyIn` reordered destination-before-source (design §4 Q2). |
| `src/scaffold/expander.ts` | Modified | S-000.5 | Screen site 2 (`runScaffold`'s walk root) wired, replacing `validateSourceRootContainment`; dropped `packageRoot`/`realCeiling` threading. |
| `src/scaffold/classify-transport.ts` | Modified | S-000.5 | Delegates to `statSourceForRead` instead of `validateSourceContainment`; dropped `packageRoot`/`realCeiling` params. |
| `src/scaffold/walk.ts` | Modified | S-000.6 | Ruling-8 recursive-read guard: the recursive `readdirSync` and per-entry `lstatSync` are now guarded with two NEW entry-specific message templates (`entryUnreadableMessage`/`entryDisappearedMessage`/`entryReadFailure`), closing the raw-Node-error/absolute-path-echo hole REQ-FSC-10.4 targets. |
| `test/scaffold/walk.test.ts` | Modified | S-000.6 | Added REQ-FSC-10.1/.2/.3 preservation-pins (root missing/non-directory/EACCES) and REQ-FSC-10.4 (4 cases: recursive readdirSync EACCES + ENOENT, per-entry lstatSync EACCES, no-rootRelPath fallback). |
| `test/security/canary-no-echo.test.ts` | Modified | S-000.7 | Added the MINIMUM canary-no-echo subset (6 cases: missing/non-regular/lexical-reject × scaffold/copyIn) seeded into the absolute mkdtemp prefix per the canary-seeding rule; landed GREEN before the deletion below. |
| `test/scaffold/containment.test.ts` | Deleted | S-000.7 | Its subject (`containment.ts`) no longer exists. |
| `test/fake/harness-in-memory-invariant.test.ts` | Modified | S-000.7 | Removed the `isWithinCeiling` import (compile-breaker); replaced with a test-local plain prefix/equality membership check (the SDK itself has no containment predicate left to delegate to). |
| **Mechanical compile/consequence fixes** (see Deviations) | Modified | S-000.5–.8 | `test/scaffold/classify-transport.test.ts`, `test/core/authoring-error-source.test.ts`, `test/fixtures/author-emulation/factory.ts`, `test/fitness/pkg-surface-baseline.json` |
| `test/scaffold/path-guards.test.ts` | Created | S-001.1–.4/.6 | Module-level unit coverage for `statSourceForRead`'s TOTAL guard (design §4 rows 0–3: non-string relPath, broken symlink, ELOOP, embedded NUL, EACCES/EPERM/EMFILE/ENFILE/EINTR collapse, FIFO via real `mkfifo`, degenerate `""`/`"."`/`"./"` strings), the two symlink-accept scenarios (REQ-PSH-03.1 in-package, REQ-PSH-04.1 outside-residual), and `validateSourceLexical`/`validateDestinationLexical`'s segment-aware lexical screens (backslash, multi-segment, leading `./`, absolute POSIX/Windows-drive forms, substring-vs-segment discrimination). 25 tests, additive to the per-verb integration rows S-003 re-verifies. |
| `test/security/canary-no-echo.test.ts` | Modified | S-001.5 | Extended the S-000.7 minimum subset to the full hardened branch set: ELOOP (templateFile/copyIn/scaffold-per-entry), embedded NUL (templateFile/copyIn/scaffold-via-`classifyTransport`-direct-call per REQ-PSH-02.3's own sanctioned pattern), degenerate `"."` source (templateFile/copyIn), and REQ-FSC-10.4's recursive mid-walk EACCES canary (scaffold) — 12 new cases, all seeded into the absolute mkdtemp prefix. |
| `src/core/authoring-error.ts` | Modified | S-002.1 | Dropped `source-outside-package` from `AuthoringReason`, `originFor`, and `messageFor`; rewrote the `:40-49` TSDoc ("twelve" → "eleven" + narrowing note) and the JSDoc `@example` switch sample. |
| `package.json` | Modified | S-002.2 | `version` `0.1.0` → `0.2.0` (owner ruling 12), same commit as the union shrink. |
| `test/fitness/dts-baseline/core.authoring-error.d.ts` | Modified | S-002.2 | Regenerated via `bun run build` → copy `dist/core/authoring-error.d.ts` (11-member union). The copy also picked up pre-existing, unrelated additive drift (the `AuthoringVerb` S-004 docblock paragraph, the `invalidInput` export) that FIT-04's removal-only diff had never flagged — expected consequence of the project's own documented full-file regen procedure, not scope creep. |
| `test/fitness/dts-baseline/core.context.d.ts` | Created | S-002.3 | Kit-internal `RunContext`/`packageAnchors` `{packageDir}`-only pin, via the same `bun run build` → copy `dist/core/context.d.ts` procedure. |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modified | S-002.4 | Added `KIT_INTERNAL_DTS_PAIRS` (one entry: `core.context.d.ts`) and a separate `describe` block running the SAME removal-only diff against it — explicitly OUTSIDE the public `DTS_PAIRS` list (ADR-0077 §J), checked but not semver-gated as public. |
| `test/types/authoring-reason.test.ts` | Modified | S-002.5 | 11-member exhaustiveness pin: dropped `case "source-outside-package"` from both the never-arm switch and the `expectTypeOf` literal list; updated doc comment and test descriptions. |
| `test/core/authoring-error-source.test.ts` | Modified | S-002.6 | Union-arithmetic proof re-narrowed to eleven; docblock/describe-title updated to "three surviving `source-*` reasons"; added the missing REQ-AEC-11.1 fixture (FIFO/non-regular source, generic template form, via `classifyTransport`) — the file previously had 3 of the 4 detail variants the design's Test Derivation table names; REQ-AEC-11.2 citation note added (discharged by `path-guards.test.ts`'s REQ-IPF-01/REQ-IPF-02 blocks, not duplicated here). |
| `test/e2e/scaffold.e2e.test.ts`, `test/scaffold/expander.test.ts`, `test/e2e/author-emulation-scaffold.e2e.test.ts` | Modified (mechanical, S-003/S-004-owned files) | S-002.1 consequence | `expectAuthoringReason(caught, "source-outside-package")` / `.reason` comparisons are typed against `AuthoringError["reason"]` (`test/support/expect-reason.ts`) — the union shrink turned 5 call sites into TS compile errors. Added `as AuthoringError["reason"]` casts ONLY (no assertion/semantic change) so `bunx tsc --noEmit` stays green; these tests keep failing at RUNTIME for the same pre-existing reason (S-003/S-004's job to re-point). Same discipline as S-000's Deviation #2. |
| `test/scaffold/expander.test.ts` | Modified | S-003.1 | SEC block: the lexical `../` escape test flips `source-outside-package` → `invalid-input`; the symlinked-directory-root test flips from REJECT to ACCEPT (ADR-0077 residual — a symlinked walk root is followed unverified, its target's content commits). New `REQ-BRC-02.1` describe block: asserts the emitted `copyIn` directive's wire shape is EXACTLY `{op, copyIn: {from, to}}` — no root/ceiling/anchor field, via `spyOn(fake, "emit")`. |
| `test/scaffold/walk.test.ts` | Modified | S-003.1 | Bound-arithmetic correction (consequence of S-003.3's `scratch-dir.ts` change, never bound-bumped): the nested-enumeration test and the REQ-FSC-09.1 symlink test drop `collection.json` from their expected entry lists; both REQ-FSC-09.2 bound tests now write explicit real files (2 and 3, respectively) instead of relying on the marker to reach their entry counts. |
| `test/scaffold/index.test.ts` | Modified | S-003.7 (REQ-AEC-11.2) | New `REQ-AEC-11.2`/design §4 Q2 describe block: a `copyIn` call with BOTH an escaping `from` and an escaping `to` asserts the DESTINATION-escape message wins (RED-first: mutation-checked by temporarily swapping `runCopyIn`'s statement order — confirmed the test fails with the SOURCE message, then restored). |
| `test/e2e/scaffold.e2e.test.ts` | Modified | S-003.7 | REQ-PRC-04/07 block renamed (PSH/IPF hygiene, ADR-0077): the `../../../` escape test flips to `invalid-input`; the broken-symlink-outside-ceiling test flips from `source-outside-package` to `source-not-found` (converges with its existing in-ceiling sibling — ADR-0077: no location distinction survives). Dropped the now-throwing `rmSync(collection.json)` call (S-003.3 consequence) + the now-unused `rmSync` import. Stale `validateSourceContainment` comment corrected to `statSourceForRead`. |
| `test/conformance/copyin-parity.test.ts` | Modified | S-003.7 (REQ-BRC-06.1) | `driveVerdict` now returns `{verdict, reason}` instead of a bare verdict string; the missing-source test asserts BOTH surfaces reject with reason `source-not-found` exactly (previously verdict-only) — the other 3 call sites updated to destructure `.verdict`. Stale `validateSourceContainment`/ADR-0045 comments corrected to `statSourceForRead`/ADR-0077. |
| `test/fake/harness-in-memory-invariant.test.ts` | Modified | S-003.2 (verified, no code change needed) | Confirmed already correct from S-000.7 (`isWithinCeiling` import already dropped, local `isWithinCollectionRoot` predicate already in place); fixed one stale "marker seeded directly at dir" comment. |
| `test/fake/harness-opted-in.test.ts` | Verified, unchanged | S-003.2 | Confirmed already correct from S-000.2 — the ORDERED two-read assertion (readdirSync before readFileSync) already exists. |
| `test/support/scratch-dir.ts` | Modified | S-003.3 | Dropped the `writeFileSync(collection.json)` marker fabrication; rewrote the stale ADR-0046/REQ-PRC-03 header comment to ADR-0077's "no ancestor marker to seed" posture. |
| `test/fixtures/author-emulation/factory.ts` | Modified | S-003.3 | Dropped `scratchFactoryRunner`'s `writeFileSync(collection.json)` marker fabrication; rewrote the stale REQ-PRC-02/03 doc-comment. The `packageAnchors` object literal was already `{packageDir}`-only (S-000.4's collapse) — nothing further to drop there. |
| `test/scaffold/run-boundary.test.ts` | Modified | S-003.3 consequence | Removed 3 now-throwing `rmSync(join(dir, "collection.json"))` calls (the file no longer exists by default); the "positive control" test that needs the marker PRESENT now plants it explicitly via `writeFileSync`. Dropped the now-unused `rmSync` import, added `writeFileSync`. |
| `test/core/authoring-error-source.test.ts` | Modified | S-003.1 consequence | One stale comment fix ("2 real entries + collection.json > bound of 1" → "2 real entries > bound of 1"); the assertion itself never depended on the marker (2 > 1 regardless). |
| `test/support/conformance-validators.ts` | Modified | S-003.4 | Deleted `checkCollectionJsonMarker` (REQ-CSC-02.3's marker-existence check — its subject, `conformance/collection.json`, is retired REQ-CCR-08 territory owned by S-006.2). |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modified | S-003.5 | Removed the `checkCollectionJsonMarker` import + its "REQ-CCR-08 / REQ-CSC-02.3" describe block; dropped the `collection.json` filter arm from the REQ-CFX-14.1 dist-leak check (keeps the `corpus.json`/fixture-id arms). |
| `test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` | Modified | S-003.5 | Removed the `checkCollectionJsonMarker` import + its "REQ-CSC-02.3 — missing collection.json marker" negative-path describe block. |
| `test/scaffold/filename-pipeline.test.ts` | Modified | S-003.6 | New dedicated pin: `runFilenamePipeline` never alters `sourceRelPath` even when rename/token-translation/`.template`-strip heavily transform `destRelPath` — the fact `expander.ts`'s per-entry-source carve-out (design §4) rests on. |

## TDD Cycle Evidence — S-000

Double-loop ordering: S-000.2/S-000.3 wrote the RED tests (run-boundary flip + the new
inline-collection test) against the UNCHANGED code first, confirmed they failed for the
right reason (the old ancestor-walk rejection), then S-000.4/S-000.5 implemented the fix
that turns the whole batch GREEN together (design's own "steps 4+5 cannot be separated —
collapsing packageAnchors does not typecheck while the old containment signatures still
take packageRoot" merged-step justification).

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.2 | `run-boundary.test.ts::the factory body's sentinel throw propagates unchanged` | integration | `Expected substring: "body-ran" / Received message: "invalid input: no collection.json found..."` | yes | n/a — REQ-MFB-01.1 names one topology | none needed |
| S-000.2 | `harness-opted-in.test.ts::only the declared opted-in reads are allowed` | integration | `Expected: [] / Received: [{key:"existsSync", arg:".../collection.json"}]` | yes | n/a | none needed |
| S-000.3 | `inline-collection.test.ts::the sentinel throw IS the thrown value` | e2e | `Expected: "body-ran" / Received: "invalid input: no collection.json found..."` | yes | 2 cases (sentinel-only run + all-three-verbs run) | none needed |
| S-000.3 | `inline-collection.test.ts::create/scaffold/copyIn all succeed with no collection.json anywhere` | e2e | same underlying rejection, different assertion surface (`result.error`) | yes | n/a — full-verb happy path is one scenario | none needed |
| S-000.4 | `run-boundary-validation.test.ts::REQ-MFB-01.3 Object.keys deep-equals ["packageDir"]` | unit | `Expected: ["packageDir"] / Received: ["packageDir","packageRoot"]` | yes | n/a — single positive-shape assertion, static equality in fit-43(c) is the class-of-input complement (S-005, not duplicated here) | none needed |
| S-000.6 | `walk.test.ts::REQ-FSC-10.4 — a nested sub-directory readdirSync EACCES failure` | unit | verified by mutation-check: guard temporarily removed → test failed with the raw uncaught Node `EACCES` error (not an `AuthoringError`) → guard restored, re-confirmed green | yes | 4 cases: readdirSync EACCES, readdirSync ENOENT (disappeared-during-walk template), lstatSync EACCES, no-rootRelPath locator-free fallback | none needed |
| S-000.7 | `canary-no-echo.test.ts::scaffold/copyIn × missing/non-regular/lexical-reject (6 cases)` | security | each case's `caught` was confirmed to actually be a rejection (`toBeInstanceOf(Error)`) before the no-echo assertion — non-vacuous by construction | yes | 6 cases (3 branch shapes × 2 verbs) | none needed |

## TDD Cycle Evidence — S-001

**Deviation from the RED-first cycle, disclosed up front (see Deviations #6 below)**: every
test in this slice passed on its FIRST run — `statSourceForRead`'s TOTAL guard mapping and
`isLexicallyEscaping`'s segment predicate were already fully implemented in S-000.5 (the
design's own step 4+5 merge note: a TOTAL guard cannot be built incrementally per-test
without leaving the shared function non-total mid-slice). Non-vacuousness was verified
instead by MUTATION-CHECK — disabling each guard clause, confirming the corresponding test
fails for the right reason, then restoring — exactly the same discipline S-000.6 applied,
now used slice-wide because it applies to every task, not one.

| Task | Test (file::name) | Layer | Non-vacuousness evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.1 | `path-guards.test.ts::row 2a/row 2b (ELOOP, embedded NUL)` | unit | mutation-check: ELOOP/`ERR_INVALID_ARG_VALUE` special-casing removed from `statSourceForRead`'s catch block → both tests failed on the exact `detail` text (`"symlink cycle"`/`"path contains an invalid character"` → `"permission or I/O error"`) → guard restored, re-confirmed green | yes | 5 errno values looped in one test (EACCES/EPERM/EMFILE/ENFILE/EINTR) + a no-`.code` fallback case | none needed |
| S-001.1 | `path-guards.test.ts::REQ-PSH-01.1/REQ-PSH-01.3 (FIFO, degenerate strings)` | unit | mutation-check: the `isDirectory()`/`!isFile()` allow-list branch removed entirely → all 4 affected tests failed (`expect(caught).toBeInstanceOf(AuthoringError)` on `undefined`) → guard restored, re-confirmed green | yes | 3 degenerate strings (`""`/`"."`/`"./"`) + 1 FIFO case | none needed |
| S-001.2 | `path-guards.test.ts::REQ-PSH-03.1/REQ-PSH-04.1 (symlink accept, in-package and outside)` | unit | positive-acceptance scenarios (`ADR-0077`'s own regression tripwire: a regrown realpath check would fail these, not a mutation I introduce to prove failure) — real symlinks, real content read back and compared | yes | 2 cases (in-package target, outside-package target) | none needed |
| S-001.3/.4 | `path-guards.test.ts::REQ-IPF-01 escaping variants + REQ-IPF-02` | unit | mutation-check: the `..`-segment membership check removed from `isLexicallyEscaping` (absolute check left intact) → exactly the 6 `..`-segment-only cases failed (`../x`/`/abs/x` still correctly rejected via the untouched absolute check, proving the mutation was scoped) → guard restored, re-confirmed green | yes | 7 escaping forms + 1 Windows-drive form + 1 non-escaping preservation-pin + 2 substring-non-match cases | none needed |
| S-001.5 | `canary-no-echo.test.ts::REQ-FSC-10.4 recursive-walk canary` | security | independently probed outside the assertion (see apply run transcript): confirmed the caught message is literally `"invalid input: scaffold entry (files/nested) could not be read"` — the entry-specific REQ-FSC-10.4 template, not a coincidental unrelated error — before trusting the no-echo assertion | yes | 1 case (nested EACCES); the ELOOP/NUL/degenerate cases each drive a distinct verb, not a repeated shape | none needed |

## TDD Cycle Evidence — S-002

Double-loop / RED-first ordering: S-002.5 and S-002.6's test edits (both compile-time
exhaustiveness pins) were flipped to the 11-member shape FIRST, against the still-12-member
union, confirmed RED via `bunx tsc --noEmit` (these two checks are type-only — `bun test`
never invokes them at runtime, per the files' own documented `expect-type`/never-arm
strategy) — then S-002.1's shrink turned both GREEN in one step (a closed-union narrowing
cannot be split into a partial-union intermediate that still compiles).

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.5 | `authoring-reason.test.ts::AuthoringReason is exactly the eleven closed values (type-level pin)` | type-level | `bunx tsc --noEmit`: `TS2322: Type '"source-outside-package"' is not assignable to type 'never'` (never-arm switch) + `TS2344` (expectTypeOf mismatch) | yes | n/a — one closed-union pin, not a class of inputs | none needed |
| S-002.6 | `authoring-error-source.test.ts::the compile-time union pin still counts exactly eleven members` | type-level | `bunx tsc --noEmit`: `TS2322: Type '"source-outside-package"' is not assignable to type 'never'` | yes | n/a — same pin pattern | none needed |
| S-002.6 | `authoring-error-source.test.ts::source-not-regular-file — a FIFO ... source, generic form` | integration | passed on first run (statSourceForRead's FIFO branch and its exact message already exist and were mutation-checked at the unit level in S-001's `path-guards.test.ts`); this is an INTEGRATION-level proof of the same behaviour through `classifyTransport`'s full pipeline, not new logic — no RED possible without breaking already-proven code | yes | n/a — preservation-pin through a new entry point | none needed |
| S-002.1/.2/.3/.4 | FIT-04 baseline pairs (`fit-04-dts-semver-gate.test.ts`, all 25 assertions incl. the new kit-internal describe block) | architectural | mechanical baseline regen (`bun run build` → copy); non-vacuousness rests on FIT-04's own pre-existing red-proof tests (removal-detection, additive-pass) in the same file, not re-proven per baseline | yes | n/a | none needed |

## TDD Cycle Evidence — S-003

S-003 is predominantly REALIGNMENT, not new behaviour: the production code (`path-guards.ts`,
`walk.ts`'s guard, the union shrink) already landed in S-000/S-001/S-002. For each stale
assertion, the "RED" is the STABLE pre-existing failure this slice inherited from
verify-in-loop-3's disclosed 12-residual baseline (confirmed identical failure message
before editing, per row below); the "GREEN" is the corrected expectation, independently
re-run. Two genuinely NEW behaviour-proving tests (REQ-BRC-02.1, the REQ-AEC-11.2
both-escape winner) are RED-first / mutation-checked in the normal sense.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-003.1 | `expander.test.ts::a lexically escaping 'from' rejects invalid-input` | integration | pre-edit run: `Expected: "source-outside-package" / Received: "invalid-input"` (confirmed against the baseline before editing) | yes | n/a — one lexical-escape shape | none needed |
| S-003.1 | `expander.test.ts::a symlinked-directory-root 'from' succeeds (ADR-0077 residual)` | integration | pre-edit run: `Expected constructor: AuthoringError / Received value: undefined` (the run already succeeded — confirmed the OLD rejection assertion was already false before rewriting to an acceptance test) | yes | n/a — one residual shape | none needed |
| S-003.1 | `expander.test.ts::REQ-BRC-02.1 — copyIn directive carries no root/ceiling/anchor field` | contract | new test, passed first run (the wire shape has structurally never had a root field); non-vacuousness confirmed by mutation-check: added a `packageRoot: "/mutation-check"` field to `DirectiveFactory.copyIn`'s returned wire object (`src/core/directive-factory.ts`) → re-ran → test failed exactly as expected (`toEqual` diff showing the extra `packageRoot` key) → reverted (`diff` against the pre-edit file confirmed byte-identical), re-confirmed green. (First attempt mutated the CALL SITE in `expander.ts` instead — passed unexpectedly because `DirectiveFactory.copyIn` itself discards unknown args before building the wire object, so that mutation never reached the wire; moving the mutation into the factory method itself is what actually exercises the assertion.) | yes | n/a — structural absence, not a class of inputs | none needed |
| S-003.1 | `walk.test.ts` bound-arithmetic corrections (2 tests) | unit | pre-edit run: `Expected length: 2 / Received length: 1` (and the mirrored 3-entry case) — confirmed against baseline | yes | n/a | none needed |
| S-003.2 | `harness-opted-in.test.ts` / `harness-in-memory-invariant.test.ts` | integration | verified ALREADY GREEN and already implementing the ordered two-read / no-`isWithinCeiling` posture from S-000 — no edit needed, confirmed by re-reading both files against the task's own citation | yes | n/a | none needed |
| S-003.3 | `run-boundary.test.ts` (3 tests) | integration | pre-edit run: `ENOENT: no such file or directory, rm '.../collection.json'` (the `rmSync` calls now throw once `scratch-dir.ts` stops seeding the marker) — confirmed against baseline | yes | n/a | none needed |
| S-003.7 | `index.test.ts::REQ-AEC-11.2 both-escape winner is the DESTINATION template` | integration | new test; passed first run (RED-first not possible — `runCopyIn`'s destination-before-source order already existed from S-000.5); mutation-checked: swapped the two `validate*Lexical` calls in `runCopyIn`, re-ran, confirmed the test fails with the SOURCE message instead (`Expected: "...destination..." / Received: "source path invalid: ..."`), then restored the original order (`diff` against the pre-edit file confirmed byte-identical) | yes | n/a — one statement-order proof | none needed |
| S-003.7 | `scaffold.e2e.test.ts` REQ-PRC-04/07 block (2 tests) | e2e | pre-edit run: `../../../` escape — `Expected: "source-outside-package" / Received: "invalid-input"`; broken-symlink-outside — `Expected: "source-outside-package" / Received: "source-not-found"` — both confirmed against baseline | yes | n/a | none needed |
| S-003.7 | `copyin-parity.test.ts::missing-source copyIn rejects with reason source-not-found (REQ-BRC-06.1)` | e2e | strengthened from a verdict-only check to an exact `{verdict, reason}` equality; passed first run (the underlying rejection already carried `source-not-found` from S-000/S-001) — non-vacuousness: `toEqual` on the full object would fail on ANY reason drift, confirmed by temporarily changing the expected literal to a wrong reason and observing the failure, then reverting | yes | n/a | none needed |

## Deviations from Design

1. **S-000.6 implemented before its own tests (process deviation)**: under time pressure the
   `walk.ts` recursive-read guard was written before `walk.test.ts`'s REQ-FSC-10.1–.4 pins.
   Non-vacuousness was verified after the fact by mutation-check (see evidence table above).
   Going forward this should be RED-first; flagged here rather than silently normalized.

2. **Mechanical compile/consequence fixes beyond S-000's own file list** — required because
   `tsc --noEmit`/`bun test` type-check and run the WHOLE project, not per-slice, and S-000.5's
   signature changes (`classifyTransport` losing `packageRoot`/`realCeiling`; `RunContext.
   packageAnchors` losing `packageRoot`) are excess-property/type errors in files the design
   assigns to LATER slices (S-002/S-003):
   - `test/scaffold/classify-transport.test.ts` — stripped now-invalid `packageRoot` args
     from ~18 call sites; removed the one describe block (`REQ-PRC-04 — source containment,
     delegated to containment.ts`) whose subject no longer exists (the lexical screen moved
     to `path-guards.ts`, called by classifyTransport's CALLERS, never folded into it).
   - `test/core/authoring-error-source.test.ts` — same `packageRoot` strip; removed the one
     `source-outside-package` fixture (that reason retires with `package-root-containment`,
     S-002.1's job); fixed the `source-unreadable` EACCES fixture, which was matching
     `readFileSync`'s spy against a REALPATH'd target while `statSourceForRead` now resolves
     LEXICALLY (ADR-0077 §H's own documented amendment) — the spy silently never fired,
     masking the assertion entirely (`received: undefined`).
   - `test/e2e/scaffold.e2e.test.ts` — updated one message expectation
     (`source file unreadable: ... (permission or I/O error)`) to match the new REQ-AEC-11
     V3.3 template's mandatory detail-category parenthetical, which `statSourceForRead` now
     always supplies.
   - `test/fixtures/author-emulation/factory.ts` — dropped `packageRoot` from a
     `RunContext.packageAnchors` replica object literal (compile-breaker only; the file's
     OWN marker-fabrication removal is S-003.3's job, left untouched).
   - `test/fitness/pkg-surface-baseline.json` — added `dist/scaffold/path-guards.{d.ts,js}`,
     removed the two `containment.*` entries (FIT-14's tarball-diff baseline is a real,
     expected consequence of the file swap, not a design gap).

3. **10 residual `bun test` failures — all outside S-000's scope, verified**: every one
   asserts the (deliberately retired) `source-outside-package` reason or a
   containment-ceiling behavior. These are explicitly owned by later slices per
   `slices.md`'s build order and design's §6 File Changes table:
   - `test/scaffold/expander.test.ts` — 2 (the "SEC... containment-checked" describe block
     — `S-003.1`'s "flip ceiling/marker expectations").
   - `test/e2e/author-emulation-scaffold.e2e.test.ts` — 2 corpus byte-compares (m-16/m-17)
     + 4 matrix-row assertions — `S-004`'s scenario-matrix renumber/regen.
   - `test/e2e/scaffold.e2e.test.ts` — 2 (`REQ-PRC-04/07` describe block's remaining
     out-of-ceiling cases — same `S-002`/`S-003` retirement).
   No other file in the 196-file suite fails for a reason traceable to package-root-containment
   retirement. `sdd-verify --mode=final`'s own net (per owner ruling 14) is expected to close
   these across the remaining slices, not this one.

4. **2 pre-existing, unrelated failures** (`test/fitness/fit-42-runner-closure-integrity.
   negative.test.ts`'s two `REQ-RCD-03.5` cases) — confirmed via `git stash` against clean
   `main`: identical `EACCES` failure with ZERO of this change's files present. Untouched,
   unrelated (`scripts/derive-runner-closure.ts`, never touched by this change).

5. **Flaky under full-suite load, pass in isolation** (not counted above — did not recur on
   every run): `test/conformance/react-conformance.test.ts`'s `REQ-RXD-08.1`,
   `test/e2e/installed-consumer.e2e.test.ts`'s `REQ-LC-01.1/.2`, and
   `test/fitness/fit-42-runner-closure-integrity.test.ts`'s `REQ-RMD-01.2`/`REQ-BPI-02.1`
   — each verified green when run as its own file; none touch any file this change modifies.
   **S-001 run confirms the SAME root cause, wider blast radius under full-suite parallel
   execution**: a first full run showed 5 EXTRA failures (`test/types/permissive-proof.
   guard.test.ts`, `test/bin/codegen-cli.test.ts`, `test/bin/codegen-static-scan.test.ts`,
   `test/security/canary-no-echo.test.ts`'s OWN `beforeAll` — pre-existing code, untouched
   by this slice — and `test/commons/encode-surface-parity.test.ts`), every one traceable to
   concurrent `bun run build` invocations SIGTERM-ing each other (`beforeAll` hooks racing
   across files). A second full run, same tree, same commit-in-progress, showed ZERO of
   these — 2350 pass / 12 fail (the exact same 12 residual failures below, same test names).
   None of the 5 extra failures are in a file this slice created or edited; `canary-no-echo.
   test.ts`'s failure was its pre-existing `beforeAll` (line 40), not any of the 12 new
   describe blocks S-001.5 added. Zero regressions from S-001.

6. **S-001's entire guard-mapping test suite passed on first run, not RED-first (process
   deviation, disclosed rather than silently normalized — see the S-001 TDD Cycle Evidence
   table above)**: `statSourceForRead`'s TOTAL error-mapping and `isLexicallyEscaping`'s
   segment predicate were fully implemented in S-000.5, for the same architectural reason
   S-000's own migration plan states (design §9 step 4+5: a shared TOTAL guard cannot be
   grown incrementally per-test without leaving it non-total mid-slice, and three call
   sites needed it complete to typecheck). S-001 is explicitly a SPIDR **Data**-dimension
   slice (`slices.md`: "failure-input variants over one guard") — its job is proving the
   ALREADY-COMPLETE guard against the full input space, not growing new logic. Every test
   was verified non-vacuous by mutation-check (guard clause disabled → test fails for the
   right reason → guard restored), not taken on faith. Flagging this here per the same
   discipline as Deviation #1, rather than letting a second instance go unremarked.

7. **Mechanical compile-fix collateral from S-002.1's union shrink, beyond S-002's own file
   list — same discipline as Deviation #2**: `AuthoringReason` narrowing 12 → 11 is a TYPE
   change, and `tsc --noEmit` type-checks the WHOLE project, not per-slice. Five call sites
   in three S-003/S-004-owned files passed the now-retired `"source-outside-package"`
   literal into `expectAuthoringReason`/`expectReason` or compared it against a
   `.reason: AuthoringReason` property — both paths are typed against `AuthoringError
   ["reason"]` (`test/support/expect-reason.ts`), so the narrowing turned these from
   RUNTIME-failing assertions (already counted in the 12 disclosed residual failures) into
   COMPILE errors, which would have broken `bunx tsc --noEmit` for the whole repo. Fixed
   with `as AuthoringError["reason"]` casts ONLY — the assertions themselves are
   byte-for-byte unchanged and continue to fail at runtime for the identical reason as
   before (S-003/S-004's job to re-point to the new reason): `test/e2e/scaffold.e2e.test.ts`
   (2 sites, `REQ-PRC-04/07` describe block), `test/scaffold/expander.test.ts` (2 sites,
   `SEC` describe block), `test/e2e/author-emulation-scaffold.e2e.test.ts` (1 site, M-16
   direct `.reason` comparison — its two `assertRejectionTriple` call sites were unaffected,
   that helper's `reason` param is plain `string`, not `AuthoringReason`). Verified via
   `bunx tsc --noEmit` (clean before and after) and `bun test` (same 12 residual failures,
   same failure messages, before and after this fix).

8. **6 residual `bun test` failures at S-003 close — ALL explicitly S-004-owned, verified**:
   S-003 closed 6 of the 12 residuals it inherited (2 `fit-42-runner-closure-integrity`
   `REQ-RCD-03.5` cases did not recur this run — pre-existing/unrelated per Deviation #4,
   environment-dependent flake, not this change's concern; the other 4 categories were
   fixed by this slice's edits). The 6 that remain are, by their OWN describe-block naming
   and by apply-progress's own Deviation #3 classification, S-004's corpus-renumbering job:
   - `test/e2e/author-emulation-scaffold.e2e.test.ts` — 2 corpus byte-compares (`m-16`,
     `m-17`) inside the top-level "walking skeleton + matrix rows" describe — the
     transcript files themselves are only regenerated by `scripts/regen-corpus.ts`
     (S-004.3), which runs AFTER S-004.1's scenario renumbering; `m-17`'s own scenario is
     DELETED in S-004.1, so this exact test disappears rather than turning green.
   - `test/e2e/author-emulation-scaffold.e2e.test.ts` — 4 assertions inside the describe
     block literally named `"S-004 — matrix-row assertions beyond the generic
     corpus-compare (batch-cap, containment, rejection boundaries)"` (2 under `M-16`, 2
     under `M-17`) — the file's own naming convention marks these as S-004's, not S-003's.
   No other file in the 197-file suite fails for a reason traceable to
   package-root-containment retirement; `bunx tsc --noEmit` is clean. Two independent full
   `bun test` runs (S-003 close) both show exactly 2358 pass / 6 fail, same 6 test names —
   zero regressions, zero new failures from S-003's diff.

## Reorder-Safety Check (S-000.8, design §4 apply-time check)

`rg`'d `test/**` and `test/e2e/author-emulation/scenarios.ts` for a `copyIn` case combining
a failing source **and** a `../`/absolute destination in one fixture. **None found** — no
existing test drives a both-escape `copyIn` case today. No re-pin needed.

## Verification Evidence

### S-000 (run 1)
- `bunx tsc --noEmit` — clean, zero errors.
- `bun test` — 2314 pass / 12 stable-residual fail (all itemized in Deviations #3/#4) across
  196 files (2328 tests total, occasional unrelated flakes per #5 not counted as stable).

### S-001 (run 2)
- `bunx tsc --noEmit` — clean, zero errors (after adding `options: {}` to the three
  `create({templateFile})` canary calls — `CreateFromTemplateFileOptions` requires it).
- `bun test test/scaffold/path-guards.test.ts` — 25 pass / 0 fail, 127 `expect()` calls.
- `bun test test/security/canary-no-echo.test.ts test/scaffold/path-guards.test.ts` — 51
  pass / 0 fail, 182 `expect()` calls.
- `bun test` (full suite, run twice, per Deviation #5):
  - Run 1: 2295 pass / 17 fail / 1 error across 197 files (2312 tests) — 5 extra failures,
    all `bun run build` SIGTERM races, none in a file this slice touched.
  - Run 2: 2350 pass / 12 fail across 197 files (2362 tests) — the SAME 12 stable-residual
    failures as S-000's baseline (2 `fit-42-runner-closure-integrity` REQ-RCD-03.5, 2
    `expander.test.ts` SEC block, 2 `author-emulation-scaffold.e2e.test.ts` byte-compares,
    4 `S-004` matrix-row assertions, 2 `scaffold.e2e.test.ts` REQ-PRC-04/07) — zero new
    failures, zero regressions from S-001's diff.
- Mutation-check log for S-001's guard-mapping tests (Deviation #6): three temporary edits
  to `src/scaffold/path-guards.ts` (ELOOP/NUL special-casing removed; allow-list check
  removed; `..`-segment check removed), each followed by a scoped `bun test -t <pattern>`
  run confirming the affected tests fail for the right reason, then a byte-identical
  restore (`diff` against a pre-edit copy confirmed clean) and a full green re-run.

### S-002 (run 3)

- RED confirmed (pre-shrink): `bunx tsc --noEmit` — 3 errors, all `TS2322`/`TS2344` on the
  two union-arithmetic pins (`test/types/authoring-reason.test.ts`,
  `test/core/authoring-error-source.test.ts`), exactly the expected "still-12-member union
  vs. 11-arm switch" break.
- GREEN (post-shrink + mechanical fixes): `bunx tsc --noEmit` — clean, zero errors.
- `bun test test/types/authoring-reason.test.ts test/core/authoring-error-source.test.ts
  test/scaffold/path-guards.test.ts` — 38 pass / 0 fail, 157 `expect()` calls.
- `bun test test/fitness/fit-04-dts-semver-gate.test.ts` — 24 pass / 0 fail (23 pre-existing
  + 1 new kit-internal describe block), 26 `expect()` calls.
- `bun test` (full suite, run twice — the project's own documented flakiness-under-load
  posture, Deviation #5):
  - Run 1: 2351 pass / 13 fail (one extra transient failure not reproduced on run 2 — not
    in a file this slice touched, consistent with the project's disclosed flake pool).
  - Run 2: 2352 pass / 12 fail across 197 files (2364 tests) — the SAME 12 stable-residual
    failures as the S-000/S-001 baseline (2 `fit-42-runner-closure-integrity`
    `REQ-RCD-03.5`, 2 `expander.test.ts` SEC block, 2
    `author-emulation-scaffold.e2e.test.ts` byte-compares, 4 `S-004` matrix-row assertions,
    2 `scaffold.e2e.test.ts` `REQ-PRC-04/07`) — same test names, same failure messages.
    Zero new failures, zero regressions from S-002's diff; none of the 12 flipped.
- `package.json` `version` verified `0.2.0`; no other file in the tree references the old
  `"0.1.0"` literal (`rg` swept `src/` and `test/`, zero hits) — the bump is isolated.

### S-003 (run 4)

- `bunx tsc --noEmit` — clean, zero errors (checked repeatedly across the whole edit
  sequence, including after each mutation-check restore).
- Targeted runs, each independently green before the final full-suite pass:
  `test/scaffold/expander.test.ts` (13 pass), `test/scaffold/walk.test.ts` (11 pass),
  `test/scaffold/index.test.ts` (11 pass), `test/scaffold/classify-transport.test.ts` (28
  pass combined with index.test.ts), `test/scaffold/run-boundary.test.ts` (4 pass),
  `test/fake/harness-in-memory-invariant.test.ts` + `harness-opted-in.test.ts` (8 pass),
  `test/conformance/copyin-parity.test.ts` (4 pass), `test/e2e/scaffold.e2e.test.ts` (27
  pass), `test/e2e/author-emulation-scaffold.e2e.test.ts` (45 pass / 6 fail, all 6 the
  S-004-owned residuals below), `test/e2e/error-attribution.e2e.test.ts` (1 pass),
  `test/fitness/fit-40-conformance-corpus-integrity.test.ts` + `.negative.test.ts` +
  `test/support` (93 pass), `test/scaffold/filename-pipeline.test.ts` (16 pass).
- Non-vacuousness verified live for the 2 genuinely new behaviour-proving tests (both
  reverted afterward, `diff` confirmed byte-identical restores):
  - `REQ-BRC-02.1` (expander.test.ts): mutating `DirectiveFactory.copyIn` to add a
    `packageRoot` field to the emitted wire object made the test fail with the exact
    expected diff; reverted, re-confirmed green.
  - `REQ-AEC-11.2` both-escape winner (index.test.ts): swapping `runCopyIn`'s
    `validateDestinationLexical`/`validateSourceLexical` statement order made the test fail
    with the SOURCE message instead of the DESTINATION one; reverted, re-confirmed green.
- `bun test` (full suite, run twice at S-003 close):
  - Run 1: 2359 pass / 6 fail across 197 files (2365 tests, +1 net vs. the S-002 baseline:
    +3 new tests — REQ-BRC-02.1, REQ-AEC-11.2 both-escape, filename-pipeline's
    sourceRelPath pin — minus 2 deleted marker tests in fit-40's two files).
  - Run 2: 2359 pass / 6 fail, same 6 test names, same failure messages — zero new
    failures, zero regressions from S-003's diff.
  - The 6 stable residuals (all itemized, S-004-owned, in Deviation #8): 2 corpus
    byte-compares (`m-16`/`m-17`) + 4 assertions inside author-emulation-scaffold.e2e.
    test.ts's own `"S-004 — matrix-row assertions..."` describe block. The 2 pre-existing
    `fit-42-runner-closure-integrity` `REQ-RCD-03.5` failures from the S-000/S-001/S-002
    baseline did NOT recur on either S-003 run (environment-dependent, per Deviation #4 —
    not this change's concern either way).
