# Apply Progress: inline-collection-marker

**Scope so far**: `slice:S-000` (walking skeleton, run 1), `slice:S-001` (path-guards TOTAL
hardening, run 2), `slice:S-002` (public contract narrows — `AuthoringReason` 12 → 11, run 3),
`slice:S-003` (full suite realigned — no stale ceiling/marker assertion survives, run 4),
`slice:S-004` (scenario-matrix corpus renumbered and regenerated, run 5), `slice:S-005`
(regrowth/reachability guards, ADR-0077, and the cross-repo handoff, run 6)
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
| S-004 | edge-case | complete | 7/7 |
| S-005 | edge-case | complete | 10/10 |
| S-006 | edge-case | complete (post-halt-resolution) | 5/5 |

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
| `test/e2e/author-emulation/scenarios.ts` | Modified | S-004.1 | Deleted the `m-17`/`no-existence-oracle-nonexisting` row + its now-unused `runM17NonExisting` import; renumbered `m-18→m-17` (slug `missing-package-local-source`), `m-19→m-18`, `m-20→m-19`, `m-21→m-20` (function bindings unchanged — only the scenario id/slug wrapper moves); updated the scratch-backed row-list doc-comment and the `m-01..m-20` range comment; dropped the stale "M-17 existing-target" mention from the S-004 section header comment. |
| `test/e2e/author-emulation/corpus/{m-17.no-existence-oracle-nonexisting,m-18.missing-in-ceiling-source,m-19.symlinked-dir-skipped,m-20.conformance-parity-copyin,m-21.cross-chunk-atomicity}.transcript.json` | Deleted | S-004.2 | The five OLD-filename transcripts every renumbered row orphans (each filename embeds its old id+slug). `m-16`'s file keeps its name (id/slug unchanged) and is overwritten in place by the regen instead. |
| `test/e2e/author-emulation/corpus/{m-16.traversal-source-rejected,m-17.missing-package-local-source,m-18.symlinked-dir-skipped,m-19.conformance-parity-copyin,m-20.cross-chunk-atomicity}.transcript.json` | Regenerated | S-004.3 | `bun scripts/regen-corpus.ts` — 21 files written (`s-00` + 20 matrix rows). `m-16` now records `invalid-input`/`null`/`null` (was the stale `source-outside-package`/path); `m-17` records `source-not-found`/`null`/`"missing.txt"` (byte-identical to the old `m-18` file's normative region, new identity fields only). |
| `test/fitness/fit-28-corpus-determinism.test.ts` | Modified | S-004.4 | Updated the `m-01..m-21`→`m-01..m-20` comment; added a NEW `describe("FIT-28b ...")` one-shot stray/duplicate directory check (`readdirSync(CORPUS_DIR)` vs. the expected id/slug set derived from `scenarios.ts`, modeled on `fit-40`'s `checkOrphanDirectories` posture) — empirically verified discriminating (see Verification Evidence). |
| `test/support/corpus-format.ts` | Modified | S-004.5 | `TranscriptRecord.scenarioId` doc-comment `"m-21"` → `"m-20"`. |
| `test/e2e/author-emulation/corpus/coverage-manifest.md` | Modified | S-004.6 | Full renumber per (a)-(d): EXERCISED ledger re-keyed (M-16 → `REQ-IPF-01.1`/`.2`; M-17 keeps `REQ-BRC-06.1` AND gains `REQ-PSH-02.1`, both keyed to M-17 per B8; M-18/M-19/M-20 plain re-keys); NOT-EXERCISED ledger drops the `REQ-PRC-06` bullet entirely (no successor, per the `scenario-matrix` REQ-SCM-02 delta — not a move); Build-status paragraph's prose row-lists and row count (21→20) corrected; the retired `"no collection.json found at or above"` literal removed from the FRICTION section (B1); the `invalidInput()`-producer FRICTION note extended to name M-16 (its citation move onto the shared lexical screen makes it a `null`/`null` producer too, confirmed via the regenerated corpus). |
| `test/e2e/author-emulation-scaffold.e2e.test.ts` | Modified | S-004 (residual fix) | The two describe blocks the baseline flagged as S-004-owned: M-16's reason flipped `source-outside-package`→`invalid-input` (path corrected to `null` — `invalidInput()` never attributes a path, confirmed against the regenerated corpus, not the literal traversal path as first drafted) and its stale compile-shim comment/cast removed; the OLD M-17 describe block (containment's "no-existence-oracle", `runM17Existing` companion) deleted outright — no successor per spec; the old standalone M-18 test became the new M-17 test (`source-not-found`/`"missing.txt"`, PSH-02.1+BRC-06.1 citation); the old M-21 test became the new M-20 test (id only, assertions unchanged). Removed the now-unused `runM17Existing` import. |
| `test/fixtures/author-emulation/factory.ts` | Modified (Boy Scout, beyond design's §6 file list — see Deviations) | S-004 (orphan cleanup) | Deleted `runM17NonExisting`/`runM17Existing`/`m17SiblingPath` — the retired "no-existence-oracle" concept's entire implementation, orphaned by the scenarios.ts/e2e-test deletions above (verified zero remaining consumers repo-wide); dropped the now-unused `dirname` import; reworded the `scratchFactoryRunner` `teardown`-param JSDoc's now-deleted example and the S-004 section-header comment's row list (dropped "M-17"); one stale "in-ceiling" phrase corrected in `runM18`'s inline comment. |

| `test/support/src-invariant-scans.ts` | Created | S-005.1 | Pure scanners over an injectable `ScanFile[]` list, shared by fit-43/44/45: `extractFunctions` (Prettier-formatted-TS heuristic — body-open-brace-then-newline), `findLiteralOccurrences`, `findAncestorWalkIdiom` (loop-body + `dirname(` detection, symbol-scoped allowlist), `findRealpathReferences` (substring `"realpath"` covers both `realpath`/`realpathSync`, symbol-scoped allowlist), `findMarkerFabricationWrites` (mirrors fit-27's call-arg-scoped write detector), `findOrphanedRetiredCitations` (per-line version-history-marker credit for the archive-sync sweep's LOGIC), `parseCodeToReasonValues`/`scanMintedReasons` (CODE_TO_REASON parse + `reason:`/mint-helper-call patterns — naturally blind to the union declaration's `\| "value"` and `originFor`'s `case "value":` syntax), `findLexicalEscapePredicates`, `findCallSites`. |
| `test/fixtures/red/src-invariant-scans/*.ts`, `openspec-sweep/*.md` | Created | S-005.1 | 7 fixtures: `collection-json-literal.ts`, `ancestor-walk.ts`, `ancestor-walk-allowlist-shadow.ts` (mirrors `single-instance-probe.ts`'s shape + a second offender), `realpath-reference.ts`, `marker-fabrication.ts`, `second-lexical-predicate.ts`, `reason-unreachable.ts` (mirrors `authoring-error.ts`'s union/`originFor`/`CODE_TO_REASON` shape with one reason deliberately unreachable), `openspec-sweep/{live-hit,allowlist-only}.md` (REQ-FTG-06.4 pair). |
| `test/fitness/fit-43-no-ceiling-regrowth.test.ts` | Created | S-005.2 | FIT-NEW-A: clauses (a)-(d)/(f) run LIVE against the real `src/**`/`test/**` trees (each with a red-proof against the fixtures above); clause (e) is FIXTURE-PAIR ONLY (REQ-FTG-06.4) — the real `openspec/specs/` tree sweep is never invoked here (archive-sync, `sdd-archive`'s job). Clause (c) reads the kit-internal `core.context.d.ts` baseline directly and asserts field-list EQUALITY (`["packageDir: string"]`), never containment. |
| `src/core/context.ts` | Modified | S-005.2 (fit-43 clause (a) prerequisite) | Rewrote the `packageAnchors` JSDoc comment to drop the literal substring `"collection.json"` (`"the ancestor-marker walk"` replaces it) — the comment legitimately explained the retired concept, but fit-43 clause (a) scans `src/**` for that EXACT literal with no self-referential-comment carve-out; the comment's MEANING is unchanged. |
| `src/scaffold/path-guards.ts` | Modified | S-005.2 (fit-43 clause (f) prerequisite) | Rewrote three comments (`:10`, `:96`, `:151`) replacing the literal substring `"realpath"`/`"no realpath"` with `"disk-canonicalization pass"`/`"never disk-canonicalized"` — same reason as the `context.ts` fix above: the comments correctly explain there is NO realpath call left, but clause (f)'s scan bans the literal string itself, comment or code, with no exception for a comment asserting its absence. Meaning unchanged; zero logic touched. |
| `test/fitness/fit-44-authoring-reason-reachability.test.ts` | Created | S-005.3 | FIT-NEW-B: asserts all 11 surviving `AuthoringReason` members are reachable via `CODE_TO_REASON` or a direct construction site (`reason: "value"` property, or a literal first-arg to `sourceRejection`/`rejection`); asserts `source-outside-package` is NOT reachable; REQ-FTG-07.2's own concrete `CODE_TO_REASON`-has-zero-`source-*`-values assertion. Red-proof against `reason-unreachable.ts` proves the union-declaration/`originFor`-switch exclusion holds by construction (neither excluded shape matches the credit patterns). |
| `test/fitness/fit-45-single-lexical-predicate.test.ts` | Created | S-005.4 | FIT-NEW-C: clause (a) asserts exactly one `(file, function)` pair matches the segment-split+`..`-membership+absolute-test shape (`path-guards.ts#isLexicallyEscaping`), red-proofed against a fixture carrying a SECOND parallel implementation; clause (b) asserts exactly 3 call sites of `validateSourceLexical` (`index.ts#readTemplateFile`, `expander.ts#runScaffold`, `index.ts#runCopyIn`), red-proofed against a synthetic 4-call-site fixture. |
| `openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md` | Created | S-005.5 | Full ADR skeleton (§A Context – §J kit-internal-baseline decision), transcribed from design §5 with "realpath"/"case-fold" wording rewritten to "disk-canonicalization" per the same clause-(f)-safety discipline as the `context.ts`/`path-guards.ts` fixes above (this ADR's own text lives under `openspec/`, outside fit-43's `src/**` scan scope, but keeping the vocabulary consistent avoids a future false trip if the scan scope ever widens). Supersedes ADR-0046/0067, amends ADR-0045. |
| `openspec/decisions/0045-package-read-containment-boundary.md` | Modified | S-005.5 | Appended a dated `## Amended by ADR-0077 (2026-07-28)` section: the `source-*` origin/attribution rules survive; only the containment half of the division of labor retires. |
| `openspec/decisions/0046-runcontext-package-root-ceiling.md`, `openspec/decisions/0067-collection-json-package-anchor-marker.md` | Modified | S-005.5 | Each gained a dated `> **Superseded by ADR-0077 (2026-07-28)**: ...` blockquote immediately under the title — the qualifying condition `package-dir-run-anchor` REQ-MFB-02.3/S-006.3's sweep allowlist requires. |
| `docs/authoring-verbs.md` | Modified | S-005.6 | New "## Package-local reads: the boundary" section carrying the QUALIFIED verbatim author rule pulled from the SIGNED `ir-path-well-formedness` spec V3.3 text (not design's older unqualified wording) + the "what the boundary is now" paragraph; rewrote the `templateFile`/`copyIn`/`scaffold` edge-semantics bullets to drop `source-outside-package` from their reason lists (now 3 reasons, not 4) and to state the symlink-residual fact positively instead of via a retired "package boundary" framing. |
| `docs/authoring-errors.md` | Modified | S-005.6 | Dropped `source-outside-package` from the `reason` table and the exhaustive-switch code sample; added a migration note (worded "drop the case ... arm", not "delete" — `doc-set-content.test.ts`'s wire-internal-terms ban treats "delete" as a banned wire-op word in author-facing docs, caught by the full-suite run below and fixed). |
| `docs/engine-sdk-wire-design.md` | Modified | S-005.6 | `:151` — dropped the false "containment-ceiling anchor (ADR-0046)" mention from `defineFactory`'s responsibilities list; the gate is now stated as exactly two reads in order (ADR-0077 §C). |
| `conformance/README.md` | Modified | S-005.6 | Removed the `conformance/collection.json` marker-requirement checklist item; added a "No marker requirement (ADR-0077)" note explaining the file's deletion (S-006.2's job) and that no successor marker exists. |
| `SECURITY.md` | Modified | S-005.6 | New "## Package-local read trust posture (v1)" section, the FIVE ruling-9 phrases each on its OWN unwrapped line (a real `rg`/`toContain` substring match requires this — a wrapped sentence's `\n` breaks a single-line greppable match, confirmed by the first test run below), cross-linking ADR-0077 and `docs/authoring-verbs.md`. |
| `CHANGELOG.md` | Modified | S-005.7 | Renamed `## Unreleased` → `## 0.2.0`; added the three drafted entries (headline `Fixed`, breaking `Changed` union-narrowing + migration text, honest-timing `Changed`) ABOVE the pre-existing (unrelated, already-landed) `addImport` Unreleased content — both now ship under the SAME `0.2.0` heading since `package.json` is already bumped and no actual npm release has happened yet; rewrote the preamble to name the engine repo + conformance corpus as the real audience and drop the "nothing here requires one" claim. |
| `CONFORMANCE-CORPUS-HANDOFF.md` | Modified | S-005.7 | Deleted the `:117-122` SDK-side marker note and its `:114` cross-reference from the `assets/` note (the `:107` corpus-root-ambiguity stray-file example, a separate concern, untouched); added "## Addendum 3 — package-local read containment removed (ADR-0077), NOTIFICATION only", mirroring Addendum 2's (`SDK-EXIT-CODE-CONFIRMATION.md`) format, including the verbatim Windows-forms warning with "realpath"/"case-fold" reworded to "disk-canonicalization"/"canonicalized" (same clause-(f)-adjacent vocabulary discipline). |
| `SDK-EXIT-CODE-CONFIRMATION.md` | Modified | S-005.7 | `:55` reason list drops `source-outside-package`; added a dated "Historical as of 2026-07-28" note linking `CHANGELOG.md#020`. |
| `openspec/pending-changes.md` | Modified | S-005.7 | Rows 268-270 (BRC-02, BRC-08, PRC-06) re-cited: BRC-02's `packageRoot`/`packageDir` anchor-distinction language marked stale (packageDir is now sole anchor); BRC-08's SDK-side-case-fold premise marked stale (no ceiling comparison exists to case-fold); PRC-06's citation re-pointed from the retired `package-root-containment` REQ-PRC-09 to `ir-path-well-formedness` REQ-IPF-02. Gating unchanged on all three rows. |
| `test/docs/security-authoring-guard.test.ts` | Modified | S-005.8 | New `describe("REQ-PSH-05.1 ...")` block: the FIVE frozen posture phrases (copied verbatim from `SECURITY.md`), each asserted present + one mutation-check (remove phrase 4, confirm phrase 1 still survives — proving per-phrase not whole-file matching). |
| `test/docs/changelog-release-vehicle-guard.test.ts` | Created | S-005.9 | Ties the whole release-vehicle bundle together: `## 0.2.0` heading present / `## Unreleased` absent; all three CHANGELOG entries present by distinguishing phrase; preamble audience phrase present / stale phrase absent; `package.json#version === "0.2.0"`; ADR-0046/0067 carry dated "Superseded by ADR-0077" headers, ADR-0045 carries a dated "Amended by ADR-0077" header; one red-proof (string-removal mutation-check) confirming a missing header fails the regex. |
| `test/scaffold/walk.test.ts` | Modified | Carry-forward (verify-in-loop-4 WARNING #1) | Rewrote the header comment (`:1-4`) and the REQ-FSC-09.1 describe title (`:30`) from the retired "in-ceiling" containment framing to the enumeration-determinism/cycle-safety framing the signed MODIFIED `folder-scaffold` REQ-FSC-09 now uses. Text-only — zero assertion changes; confirmed via the file's own isolated re-run (11 pass / 0 fail, unchanged count) and the full-suite run below. |
| `conformance/collection.json` | Deleted | S-006.2 | REQ-CCR-08 retired (`conformance-corpus` delta) — no test referenced this file (`rg` confirmed zero consumers in `test/`), so deletion required no companion test edits. |

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

## TDD Cycle Evidence — S-004

S-004 is corpus-regen/renumber work (design's own procedure discipline, not a normal
RED-first behaviour cycle — the underlying production code is unchanged from
S-000/S-001/S-002): the "RED" for each residual assertion is the STABLE pre-existing
failure S-003 disclosed (Deviation #8); the "GREEN" is the corrected id/reason/path
following the mechanical renumber-then-regen procedure. The one genuinely NEW check
(FIT-28b) is RED-first / empirically verified discriminating.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Non-vacuousness | Refactored |
|---|---|---|---|---|---|---|
| S-004.1–.3 | `author-emulation-scaffold.e2e.test.ts` — the 2 corpus byte-compares (`m-16`/`m-17`) | e2e | pre-edit: `m-16`/`m-17` committed corpus still carried the stale `source-outside-package` reason against the live `invalid-input`/`source-not-found` capture — confirmed against the S-003-close baseline | yes | the byte-compare is the SAME generic loop every other scenario in `SCENARIOS` already exercises — no new assertion logic, just corrected committed bytes via `scripts/regen-corpus.ts` (never hand-edited) | none needed |
| S-004 residual | `author-emulation-scaffold.e2e.test.ts::M-16 traversal source rejects` | e2e | pre-edit: `Expected: "source-outside-package" / Received: "invalid-input"` — confirmed against baseline | yes | first draft asserted `path: "../m16-traversal-outside.txt"` and FAILED against the freshly regenerated corpus (`Received: null`) — caught by actually running the suite, not assumed; corrected to `path: null` (matches `invalidInput()`'s unconditional `undefined` attribution, same shape as M-08/M-10/M-12/M-13/M-15) | none needed |
| S-004 residual | `author-emulation-scaffold.e2e.test.ts::M-17 missing package-local source` | e2e | pre-edit (as the old M-18 test): already green at S-003 close (unaffected content); re-pointed to scenario id `"m-17"` | yes | unchanged assertion values (`source-not-found`/`null`/`"missing.txt"`) against the SAME underlying `runM18` factory — only the id changed | none needed |
| S-004 residual | `author-emulation-scaffold.e2e.test.ts::M-20 cross-chunk atomicity` | e2e | pre-edit (as the old M-21 test): already green at S-003 close; re-pointed to scenario id `"m-20"` | yes | unchanged assertion values against the SAME underlying `runM21` factory | none needed |
| S-004.4 | `fit-28-corpus-determinism.test.ts::FIT-28b — corpus directory matches scenarios.ts exactly` | architectural | new test; empirically verified discriminating by temporarily copying `m-01`'s transcript to a stray `m-99.stray-test.transcript.json` and re-running — failed with the exact expected violation message (`stray transcript file "m-99.stray-test.transcript.json"...`); stray file removed, re-confirmed green | yes | see above — a real injected stray was caught, not assumed | none needed |

## TDD Cycle Evidence — S-005

S-005 is architectural-guard + docs work: the three new fitness tests (fit-43/44/45) are
genuinely NEW checks with no pre-existing production code to realign, so each is RED-first
against its own fixture (the fixture IS the red-proof, not a temporarily-broken real file —
mutating the REAL `src/**` tree to prove red would violate the "never a live mutation of
src/**" rule every other fitness test in this family already follows). The docs/CHANGELOG/
ADR guard tests (S-005.8/.9) are RED-first in the literal sense: written BEFORE the doc
edits landed, confirmed failing against the pre-edit docs, then turned GREEN by the S-005.6/
.7 doc edits.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Non-vacuousness | Refactored |
|---|---|---|---|---|---|---|
| S-005.1/.2 | `fit-43-no-ceiling-regrowth.test.ts` — clause (a)/(b)/(d)/(f) red-proofs | architectural | each red-proof fixture, run BEFORE its scanner existed, has no meaning; the correct RED evidence is: first scanner-against-fixture run confirmed the offense IS detected (fixture never green-by-default) | yes | clause (b)'s allowlist red-proof additionally proves symbol-scoping (allowlisting `packageRootFor` in a fixture carrying a SECOND offender in the SAME file still flags the second); clause (f)'s red-proof was corrected mid-slice — an earlier draft reused the REAL `single-instance-probe.ts` file as the "allowlisted mirror," which failed because that file ALSO carries an unrelated top-level `realpathSync` import and comment OUTSIDE `packageRootFor`'s body; replaced with a FOCUSED synthetic mirror containing only the allowlisted function, isolating the property under test | clause (f) required TWO production-comment edits (`context.ts`, `path-guards.ts`) to make the REAL-tree assertion pass non-vacuously — see Deviations |
| S-005.2 | `fit-43-no-ceiling-regrowth.test.ts` — clause (e) / REQ-FTG-06.4 | architectural | fixture A (`openspec-sweep/live-hit.md`) confirmed failing on first run against `findOrphanedRetiredCitations` — one early draft of fixture A also failed BECAUSE its own explanatory prose literally quoted `"(Previously: ...)"` as an example of what ISN'T present, which the line-based marker check credited as an allowlist hit; rewritten to keep the explanatory prose on a SEPARATE line from the offending citation | yes | fixture B confirmed passing (all three retired-term mentions carry a marker on their OWN line) | none needed |
| S-005.3 | `fit-44-authoring-reason-reachability.test.ts::[red-proof] a reason present ONLY in the union declaration and originFor's switch is flagged unreachable` | architectural | `reason-unreachable.ts` mirrors `authoring-error.ts`'s exact three shapes (union, `originFor` switch, `CODE_TO_REASON`); confirmed `"unreachable-reason"` is NOT credited while the fixture's OTHER two reasons (present via `CODE_TO_REASON`/`rejection(...)` respectively) ARE credited — proving the exclusion is real, not "the scanner credits nothing in this file" | yes | n/a | none needed |
| S-005.4 | `fit-45-single-lexical-predicate.test.ts` — both clauses | architectural | clause (a): `second-lexical-predicate.ts` confirmed both functions flagged; clause (b): synthetic 4-call-site fixture confirmed `length === 4`, never `3` | yes | n/a | none needed |
| S-005.8 | `security-authoring-guard.test.ts::REQ-PSH-05.1` (5 phrase-presence tests) | docs | run BEFORE `SECURITY.md`'s new section existed — confirmed failing (`toContain` against the pre-edit file, missing section entirely); turned green by the S-005.6 edit. First attempt at the phrase constants used the SAME wrapped-paragraph prose the design draft showed — failed because `SECURITY.md`'s wrapped `\n` line breaks don't match a single-line `toContain` string; fixed by unwrapping each of the five sentences onto its OWN line in `SECURITY.md` (matching the file's own PRE-EXISTING convention for its other frozen guard sentences, e.g. `GENERAL_TRUST_SENTENCE`) | yes | mutation-check: removing phrase 4 via string-replace still leaves phrase 1 present — proves per-phrase matching, not a single whole-block match | none needed |
| S-005.9 | `changelog-release-vehicle-guard.test.ts` (8 tests) | docs | run BEFORE the CHANGELOG/ADR edits landed — confirmed failing (no `## 0.2.0` heading, no ADR headers); the honest-timing entry's distinguishing phrase ALSO tripped the same wrap-vs-single-line issue as S-005.8 (fixed by joining that CHANGELOG paragraph onto one line) | yes | the ADR-header red-proof (string-removal mutation-check) confirms a missing header genuinely fails the date-regex, not merely "the string exists somewhere" | none needed |

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

9. **`test/fixtures/author-emulation/factory.ts` orphan cleanup — beyond design §6's file
   list for S-004 (Boy Scout rule, disclosed rather than silently expanding scope)**:
   design's File Changes table lists `scenarios.ts`, `corpus-format.ts`, `fit-28`, and
   `coverage-manifest.md` for S-004's renumber, not `factory.ts`. Deleting the old `m-17`
   scenario row (S-004.1) and the e2e test's old M-17 describe block (the residual fix)
   orphaned `runM17NonExisting`/`runM17Existing`/`m17SiblingPath` — verified via `rg`
   across `test/`/`scripts/`/`src/` that these three had ZERO remaining consumers. This is
   the entire implementation of the retired "no-existence-oracle for out-of-ceiling paths"
   concept (ADR-0077's own subject), so leaving ~37 lines of dead code describing a
   containment model this change exists to remove would be a direct, self-contained
   degradation in the exact file my own edit touched. Deleted the block, the now-unused
   `dirname` import, corrected the `scratchFactoryRunner` `teardown`-param JSDoc's
   now-deleted example, and dropped "M-17" from the S-004 section-header comment's row
   list. Did NOT touch `scratchFactoryRunner`'s `teardown` parameter itself (now unused by
   any caller but still generic, documented, non-broken infrastructure) or rename any
   OTHER surviving function (`runM18`/`runM19`/`runM20Valid`/`runM21` keep their historical
   names permanently, matching the existing pattern of `M21_COLLISION_SEED_PATH` — the
   scenario id is a separate, current-mapping concern from the factory function's own
   identity). `bunx tsc --noEmit` and the full suite confirmed clean before and after.

10. **Two production-comment rewrites required for fit-43 to pass non-vacuously against the
    REAL tree, beyond S-005's own file list — same "necessary consequence" discipline as
    Deviations #2/#7**: fit-43 clause (a) bans the literal `"collection.json"` substring and
    clause (f) bans the literal `"realpath"` substring across `src/**`(a)/`src/scaffold/**`+
    `src/core/context.ts`(f) — INCLUDING comments, by design (REQ-FTG-06 says "code or
    comment lines" for clause (f); clause (a) has no comment carve-out either). Two
    PRE-EXISTING comments (both landed in earlier slices, S-000.4 and S-000.5 respectively)
    legitimately EXPLAIN the retired concepts by name and tripped the literal scan the moment
    it was written against the real tree:
    - `src/core/context.ts:68` (S-000.4's `packageAnchors` JSDoc) said "the `collection.json`
      ancestor walk" — reworded to "the ancestor-marker walk", meaning unchanged.
    - `src/scaffold/path-guards.ts:10,96,151` (S-000.5's own module header/JSDoc) said "no
      realpath" three times — reworded to "no disk-canonicalization pass"/"never
      disk-canonicalized", meaning unchanged. `openspec/decisions/0077-...md`'s own §F/§H
      text uses the SAME "disk-canonicalization" vocabulary rather than "realpath", for
      consistency (the ADR lives under `openspec/`, outside clause (f)'s scan scope, so this
      is a style choice, not a requirement).
    Verified via `bunx tsc --noEmit` (clean before/after) and the full suite (byte-identical
    pass count before/after these two comment-only edits, confirmed by running fit-43 alone
    before and after).

11. **`docs/authoring-errors.md`'s migration text used "delete" in its first draft, caught by
    the FULL SUITE run (not by any S-005-scoped test)**: `doc-set-content.test.ts`'s
    pre-existing `wire-internal-terms` ban treats the bare word `delete` (word-boundary) as a
    banned wire-op term across the whole author-facing doc set — my first draft of the
    `source-outside-package` removal note read "delete the `case ...` arm"; the full-suite
    run (not fit-43/44/45, which never touch this file) caught it. Reworded to "drop the
    `case ...` arm" — meaning unchanged, `CHANGELOG.md`'s equivalent sentence (not in the
    banned-terms doc list) keeps "delete" since it is not author-facing product doc.

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

### S-004 (run 5)

- `bunx tsc --noEmit` — clean, zero errors (checked after the scenarios.ts renumber, after
  the factory.ts orphan cleanup, and after the final e2e-test fix).
- Corpus regen (S-004.2/.3): deleted the 5 stale OLD-filename transcripts, ran
  `bun scripts/regen-corpus.ts` — wrote 21 files (`s-00` + 20 matrix rows); `git status`
  confirmed exactly 5 deletions + 4 new files + 1 in-place content change (`m-16`), no
  stray leftovers.
- `bun test test/fitness/fit-28-corpus-determinism.test.ts` — 3 pass / 0 fail (double-run
  determinism, red-proof, FIT-28b) before the stray-injection check below.
- FIT-28b non-vacuousness (see TDD Cycle Evidence): copied `m-01`'s transcript to a stray
  `m-99.stray-test.transcript.json`, re-ran — 1 fail with the exact expected violation
  message; removed the stray, re-ran — 3 pass / 0 fail again.
- `bun test` (full suite, run twice, uncontended per Deviation #5's disclosed posture):
  - Run 1: 2363 pass / 0 fail across 197 files (2363 tests).
  - Run 2: 2363 pass / 0 fail — byte-identical test count and result, zero flakes observed.
  All 6 of S-003's disclosed residuals are closed; the 2 pre-existing
  `fit-42-runner-closure-integrity` `REQ-RCD-03.5` failures did not recur on either run
  (environment-dependent, unrelated to this change, per Deviation #4).

### S-005 (run 6)

- `bunx tsc --noEmit` — clean, zero errors (re-checked after every doc/comment edit and
  after the final full-suite pass).
- Targeted runs, each independently green before the final full-suite pass:
  `test/fitness/fit-43-no-ceiling-regrowth.test.ts` + `fit-44-authoring-reason-reachability.
  test.ts` + `fit-45-single-lexical-predicate.test.ts` (21 pass / 39 expect() calls, all
  three files together); `test/docs/security-authoring-guard.test.ts` (23 pass, incl. the
  new REQ-PSH-05.1 block); `test/docs/changelog-release-vehicle-guard.test.ts` (8 pass, new
  file); `test/scaffold/walk.test.ts` (11 pass, unchanged count after the carry-forward
  comment rewrite).
- `bun test` (full suite, run twice, uncontended, immediately back-to-back in one shell
  invocation):
  - Run 1: 2398 pass / 0 fail across 201 files (2398 tests) — +35 vs. the S-004 baseline
    (21 fit-43/44/45 + 8 `changelog-release-vehicle-guard.test.ts` + 6 REQ-PSH-05.1 tests
    [5 presence + 1 mutation-check] = 35 exactly; the `walk.test.ts` carry-forward rewrite
    is text-only, zero net test-count change).
  - Run 2: 2398 pass / 0 fail — byte-identical test count and result, zero flakes observed.
  Zero regressions from S-005's diff; the whole suite is green with no residuals carried
  forward (S-004 closed the last of S-003's 6; S-005 introduces none).
- The two mid-slice fixes disclosed in Deviations #10/#11 (the `context.ts`/`path-guards.ts`
  comment rewrites and the `docs/authoring-errors.md` "delete"→"drop" wording fix) were each
  caught by an ACTUAL red run (fit-43 clause (a)/(f) failing against the real tree; the full
  suite's pre-existing `doc-set-content.test.ts` failing) — not asserted from memory.

## S-006 — Dead-Test Deletion and Final Sweep (run 7, HALTED)

S-006.1, S-006.2, S-006.4, and S-006.5 are complete and verified. **S-006.3 (the `rg`
sweep) is HALTED** — running it exactly as specified surfaces real hits the slice's own
allowlist (Q9 resolution, ratified through 3 plan-verify iterations) does not enumerate.
Per this run's own halt discipline ("fix ONLY if unambiguously this change's own residue;
anything structural or ambiguous → HALT with the hit list rather than improvising allowlist
extensions"), these hits are reported, not silently fixed or silently waved through.

### S-006.1 — remaining retired run-boundary assertions

Read `test/scaffold/run-boundary.test.ts` in full and `rg`'d `test/` for
`missing-ancestor|ancestor.{0,20}reject|pre-empt` (excluding self-describing "no longer
pre-empts"/"inverts"/"retired" hits). **None found.** S-000 already fully inverted this
file's assertions (Deviation-free — this task closes as a verification, not new work).

### S-006.2 — delete `conformance/collection.json`

`rg`'d `test/` for any reference to this file or a `CONFORMANCE...collection` pattern —
zero hits, confirming no test depends on its presence. Deleted via `git rm
conformance/collection.json`. Full suite re-run (below) confirms zero regressions.

### S-006.3 — the sweep (HALTED, see Findings)

Two literals swept, exactly as `slices.md` specifies:

**Literal (i)** — exact string `no collection.json found at or above`, repo-wide:
```
rg -Fn "no collection.json found at or above" --hidden -g '!.git' -g '!node_modules' -g '!dist' .
```
10 raw hits, ALL inside `openspec/changes/inline-collection-marker/**` (this change's own
triage/proposal/slices/north-star/verify-in-loop-5/apply-progress — all quoting the retired
message as historical narration) or `openspec/changes/archive/2026-07-13-schematic-local-files/outcome-verdict.md`
(a different, already-archived change's own historical record). **Zero hits in `src/**`,
`test/**`, `docs/**`, `conformance/**`, or any root-level file** — confirmed by re-running
the same sweep with `-g '!openspec/changes/**' -g '!openspec/specs/**'` added: zero output.
This matches the task's own "zero hits required, no allowlist needed" framing under the
reading that `openspec/changes/**` is the shared BASE exclusion the "scope REPO-WIDE minus
the allowlist (Q9)" sentence refers to for both literals (the same base literal (ii)'s own
allowlist explicitly reuses, worded "unchanged base + B1 addition"). **Literal (i): CLEAN.**

**Literal (ii)** — token `source-outside-package`, repo-wide minus the slice's explicit
allowlist (superseded/amended ADRs 0045/0046/0067/0077, `CHANGELOG.md`,
`SDK-EXIT-CODE-CONFIRMATION.md`, `CONFORMANCE-CORPUS-HANDOFF.md`, `openspec/changes/**`,
`openspec/specs/**`):
```
rg -Fn "source-outside-package" --hidden -g '!.git' -g '!node_modules' -g '!dist' \
  -g '!openspec/changes/**' -g '!openspec/specs/**' -g '!CHANGELOG.md' \
  -g '!SDK-EXIT-CODE-CONFIRMATION.md' -g '!CONFORMANCE-CORPUS-HANDOFF.md' \
  -g '!openspec/decisions/0045-package-read-containment-boundary.md' \
  -g '!openspec/decisions/0046-runcontext-package-root-ceiling.md' \
  -g '!openspec/decisions/0067-collection-json-package-anchor-marker.md' \
  -g '!openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md' .
```
**19 unpermitted hit lines across 10 files** — none deletable as "unambiguous residue"
(each is a deliberate historical/rationale comment or the fitness-guard mechanism's own
necessary literal, not leftover cruft), none covered by the ratified allowlist either.
Classified below rather than fixed:

**Group A — the fitness-guard mechanism itself** (self-referential; the retirement-guard
tests literally have to name the retired reason to check for its absence):
- `test/support/src-invariant-scans.ts:210` — `RETIRED_TERMS` array, the scanner's own
  search target for `openspec/specs/**` archive-sync sweep (fit-43 clause (e))
- `test/fitness/fit-44-authoring-reason-reachability.test.ts:20,48,50` — comment +
  negative-assertion proving the reason is NOT reachable (`expect(...).toBe(false)`)
- `test/fixtures/red/src-invariant-scans/openspec-sweep/allowlist-only.md:5` — S-005.1's
  own red-fixture data, proving `findOrphanedRetiredCitations` credits a version-history
  marker correctly

**Group B — historical rationale comments (production + test code, S-002/S-005 vintage)**:
- `src/core/authoring-error.ts:47,50,105,185` — 4 comments explaining the 12→11
  narrowing (PRODUCTION file — the one that most needs a decision, since it is not a test
  or doc artifact)
- `test/fitness/dts-baseline/core.authoring-error.d.ts:33,36` — mirrors the above verbatim
  (generated via `bun run build` from the same source docblock)
- `test/core/authoring-error-source.test.ts:19,126`
- `test/types/authoring-reason.test.ts:13,15`
- `test/scaffold/expander.test.ts:228`
- `test/e2e/scaffold.e2e.test.ts:158`

**Group C — author-facing docs file, not on the allowlist**:
- `docs/authoring-errors.md:63,66` — the S-005.6-authored migration note ("`source-outside-package`
  was removed in `@pbuilder/sdk` `0.2.0`... Migration: drop the `case
  "source-outside-package":` arm")

**Why this halts rather than resolves in-loop**: deleting any of these would either break
a fitness guard this change built (Group A), or strip deliberate, TDD-documented historical
rationale that earlier slices' own verify-in-loop reports (2, 3, 6) explicitly praised as
correct and complete (Group B), or remove the one piece of author-facing migration guidance
for the exact public API break this change ships (Group C) — none of that is "this change's
own residue" in the sense the halt clause means. But the allowlist Q9 closed after 3
plan-verify iterations does not name any of these 10 files, and silently adding
`src/**`/`test/**`/`docs/authoring-errors.md` carve-outs on my own authority is exactly the
"improvising allowlist extensions" the task explicitly forbids. This reads as a genuine gap
in the ratified allowlist (never actually `rg`-executed until this run — S-006.3 is its
first real execution), not a coding defect — routing back to the Planner to either amend
the S-006.3 allowlist (most likely: add `src/core/authoring-error.ts` + its generated
baseline + the 5 test files + `docs/authoring-errors.md` to the allowlist, mirroring the
same "legitimate historical mention" reasoning already used for ADRs/CHANGELOG/openspec/specs)
or explicitly rule these need rewording, is the correct next step, not a unilateral call
made mid-apply.

### S-006.4 — REQ-RBV-06.1 pointer closure

- **(a)** `rg`'d `openspec/changes/inline-collection-marker/specs/run-boundary-input-validation/spec.md`:
  the delta's pointer text ("Pointer: `package-dir-run-anchor` REQ-MFB-01.1 proves the
  INVERSE") resolves to `openspec/changes/inline-collection-marker/specs/package-dir-run-anchor/spec.md:77`
  — `#### Scenario REQ-MFB-01.1: Missing-ancestor rejection no longer pre-empts the factory
  body [red-today]` — an existing REQ. ✅
- **(b)** confirmed via S-006.1's read: `test/scaffold/run-boundary.test.ts` carries no
  dead assertion of the old missing-ancestor-rejects behaviour — S-000 already replaced it
  with the inverse (body-runs) assertion. ✅
- **(c)** the `run-boundary-input-validation` delta (read in full) explicitly lists the
  retirement: `#### Scenario REQ-RBV-06.1: [RETIRED, id kept as a pointer — not carried
  forward]`. ✅

All three boxes check out — S-006.4 complete independent of S-006.3's halt.

### S-006.5 — final full suite + `tsc --noEmit`

- `bunx tsc --noEmit` — clean, zero errors.
- `bun test` (full suite, run twice, uncontended, back-to-back):
  - Run 1: 2398 pass / 0 fail across 201 files (5310 expect() calls).
  - Run 2: 2398 pass / 0 fail — byte-identical.
  - Zero regressions from `conformance/collection.json`'s deletion (S-006.2) — matches the
    S-005 baseline exactly (no test count change, since no test referenced the deleted file).

### Halt Summary

**Category**: `plan-gaps` (allowlist/scope gap in the ratified S-006.3 task text, discovered
only by actually running the sweep for the first time). **Not** a code defect, **not** a
regression — the full suite is green and `tsc` is clean. Blocks only: marking S-006.3 `[x]`,
closing S-006 as complete, and therefore the change's overall "zero unpermitted hits"
acceptance criterion. Recommended resolution for the Planner: amend `slices.md`'s S-006.3
allowlist to add `src/core/authoring-error.ts` (+ its generated `.d.ts` baseline mirror),
the 5 test files in Group B, and `docs/authoring-errors.md` from Group C — OR rule that one
or more of these needs rewording instead, then re-run this exact sweep to confirm zero
hits under the amended allowlist. Group A (the fitness-guard mechanism's own self-reference)
almost certainly needs a standing carve-out regardless of how B/C are resolved, since a
scanner that check for a term's absence cannot itself avoid naming that term.

### S-006.3 — RESOLVED (2026-07-28, post-halt, orchestrator-amended allowlist)

The orchestrator independently verified all 19 hit-lines / 10 files from the halt above,
confirmed every one is a mention ABOUT the retirement (not a live construction site — fit-44
separately proves zero reachable construction sites), and amended `slices.md`'s S-006.3
task with an "ALLOWLIST AMENDMENT" block (category (A) sweep/guard self-reference, category
(B) this change's own verified retirement rationale, plus a literal-(i) clarification that
`openspec/changes/**` self-quotes don't count). Both sweeps re-run against the amended
allowlist:

**Literal (i)**, `openspec/changes/**` now excluded per the clarification:
```
rg -Fn "no collection.json found at or above" --hidden -g '!.git' -g '!node_modules' -g '!dist' -g '!openspec/changes/**' .
```
→ **0 hits.**

**Literal (ii)**, amended allowlist (unchanged base + B1's `openspec/specs/**` + this
amendment's categories A/B, each path excluded explicitly):
```
rg -Fn "source-outside-package" --hidden -g '!.git' -g '!node_modules' -g '!dist' \
  -g '!openspec/changes/**' -g '!openspec/specs/**' -g '!CHANGELOG.md' \
  -g '!SDK-EXIT-CODE-CONFIRMATION.md' -g '!CONFORMANCE-CORPUS-HANDOFF.md' \
  -g '!openspec/decisions/0045-package-read-containment-boundary.md' \
  -g '!openspec/decisions/0046-runcontext-package-root-ceiling.md' \
  -g '!openspec/decisions/0067-collection-json-package-anchor-marker.md' \
  -g '!openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md' \
  -g '!test/support/src-invariant-scans.ts' \
  -g '!test/fitness/fit-44-authoring-reason-reachability.test.ts' \
  -g '!test/fixtures/red/src-invariant-scans/**' \
  -g '!src/core/authoring-error.ts' \
  -g '!test/fitness/dts-baseline/core.authoring-error.d.ts' \
  -g '!test/core/authoring-error-source.test.ts' \
  -g '!test/types/authoring-reason.test.ts' \
  -g '!test/scaffold/expander.test.ts' \
  -g '!test/e2e/scaffold.e2e.test.ts' \
  -g '!docs/authoring-errors.md' \
  .
```
→ **0 hits.** Zero unpermitted hits on both literals — S-006's acceptance criterion
("GIVEN the whole change landed WHEN the sweep in S-006.3 runs THEN it returns zero
unpermitted hits") is satisfied.

**Closing sanity** (no code changed since the two clean S-006.5 runs above, one run
suffices as the tie-break check):
- `bunx tsc --noEmit` — clean, zero errors.
- `bun test` (full suite, single uncontended run): **2398 pass / 0 fail** across 201 files
  (5310 expect() calls) — matches the S-006.5 baseline exactly, no deviation, no
  second tie-break run needed.

S-006 is now complete (5/5 tasks `[x]` in `slices.md`). The whole `inline-collection-marker`
change (S-000 through S-006, 7/7 slices) is implementation-complete and ready for
`/evaluate` (verify --mode=final) before archive.

## Judgment-Day Round 1 Fixes

Two blind judges reviewed `git diff 1e44ae8..8c3828a`; the owner ratified a 7-group fix
list (G1-G7) and issued **ruling 16**. All seven groups are now applied.

**Ruling 16 (2026-07-29, the load-bearing fix)**: REQ-FSC-09 says the walk MUST NOT
descend into ANY symlinked directory, but `walkFolder`'s ROOT branch called
`readdirSync(fromAbs)` with no `lstatSync` ahead of it — only the NESTED case was
implemented/tested. A symlinked `from` was FOLLOWED (probe-proven: enumerates content
outside the package). Owner ruling: a symlinked walk ROOT REJECTS with `AuthoringError`
(reason `invalid-input`, package-relative locator, no absolute-path echo) — explicit
error, never a silent skip, never a documented residual carve-out.

| Group | Root cause | Fix | Files |
|---|---|---|---|
| G1 | Walk-root symlink followed, never rejected | `walkFolder`'s root branch now `lstatSync`s `fromAbs` before `readdirSync`; a symlinked root throws a new pinned, no-echo `invalid-input` message (`rootIsSymlinkMessage`) | `src/scaffold/walk.ts`; tests: `test/scaffold/walk.test.ts` (root-symlink reject + locator-free fallback), `test/scaffold/expander.test.ts` (retired the old "symlinked root followed" residual test, now asserts rejection), `test/security/canary-no-echo.test.ts` (new canary case); spec: `openspec/changes/inline-collection-marker/specs/folder-scaffold/spec.md` (V3.3→V3.4, new REQ-FSC-09.3); doc: `docs/authoring-verbs.md`, `src/commons/index.ts` JSDoc |
| G2 | `statSourceForRead`'s non-string guard was unreachable (all 3 call sites lexically screen first, and the lexical screen itself crashed with a raw TypeError on a non-string) | Moved the `typeof relPath !== "string"` check to the TOP of `validateSourceLexical` AND `validateDestinationLexical`; deleted the now-dead check inside `statSourceForRead` | `src/scaffold/path-guards.ts`; test: `test/scaffold/path-guards.test.ts` (row-0 retargeted to both lexical entry points) |
| G3 | fit-43 clause (c) only diffed the committed baseline against itself — vacuous against a regrown additive field (Judge B fault-injected `packageRoot?: string` and every static guard stayed green) | Added a second assertion reading the FRESHLY BUILT `dist/core/context.d.ts` (via the shared, memoized `ensureTscBuild()`) and pinning the same equality; proved non-vacuous by repeating the injection (fails) then reverting (`git status` clean) | `test/fitness/fit-43-no-ceiling-regrowth.test.ts` |
| G4(i) | `classify-transport.ts`'s post-hygiene read-failure minted a bare `AuthoringError` with no `message`, silently dropping the failure category REQ-AEC-11.1 mandates | Routed through `path-guards.ts`'s own `sourceRejection("source-unreadable", relPath, "permission or I/O error")` (exported); one mechanism for every `source-unreadable` message | `src/scaffold/classify-transport.ts`, `src/scaffold/path-guards.ts` (export); tests: `test/core/authoring-error-source.test.ts` (message now includes the category) |
| G4(ii) | `statSourceForRead`'s catch-all mapped `ENOTDIR`/`ENAMETOOLONG` to `source-unreadable` — factually wrong for a path routed through a regular file (a normal author typo, not a permission/IO failure) | Branched both errnos to `source-not-found` alongside `ENOENT` (the spec's own table scopes that reason to "does not exist") | `src/scaffold/path-guards.ts`; test: `test/e2e/scaffold.e2e.test.ts` (ENOTDIR case now expects `source-not-found`) |
| G4(iii) | `authoring-error.ts`'s comment claimed "every producer site passes an explicit message" | Verified TRUE after G4(i) (`rg 'reason: "source-' src/` → only `path-guards.ts#sourceRejection`, always with an explicit message) — no comment change needed for accuracy; the adjacent stale `REQ-PRC-05` citation was fixed as part of G5 | `src/core/authoring-error.ts` |
| G5 | Public doc surface drift: stale `package-root-containment` citation in `src/commons/index.ts`'s `scaffold` JSDoc; stale `REQ-PRC-09`/`REQ-PRC-05` citations in `expander.ts`/`authoring-error.ts` | Rewrote the JSDoc to REQ-FSC-09's V3 enumeration-determinism/cycle-safety rationale + ruling-16 root behavior; re-pointed `REQ-PRC-09` → `ir-path-well-formedness` REQ-IPF-02, `REQ-PRC-05` → `package-source-io-hygiene` REQ-PSH-01 (successors confirmed against the signed deltas); regenerated `test/fitness/dts-baseline/commons.index.d.ts` via the FIT-04 procedure (`bun run build` + copy — never hand-edited). That regen also incidentally absorbed pre-existing, UNRELATED baseline staleness already latent in HEAD (`defineFactory({ packageDir })` → "factory run started with packageDir" wording drift) — noted here for transparency, not a scope expansion introduced by this round | `src/commons/index.ts`, `src/scaffold/expander.ts`, `src/core/authoring-error.ts`, `test/fitness/dts-baseline/commons.index.d.ts` |
| G6 | REQ-RBV-04.1's enumerated set had 7 signed branches with no canary-no-echo test (FIFO, injected-EACCES read, broken symlink, absolute source ×3 verbs, `..`-variant set, destination lexical guard, walk-root EACCES) | Added one canary-no-echo test per branch (plus the G1 root-symlink canary), following the file's existing seeded-canary + `expectRejectsCanaryFree` pattern; no helper changes needed — every branch fit the existing idiom | `test/security/canary-no-echo.test.ts` |
| G7 | Stale comments in `test/scaffold/inline-collection.test.ts` still claimed `scratchDirFactory` seeds a `collection.json` marker (removed in S-003) | Corrected both comments to the real remaining rationale: the suite's own `mkdtemp` gives it full control over the ancestor chain for `assertNoAncestorMarkerAnywhere`'s walk-to-root assertion | `test/scaffold/inline-collection.test.ts` |

**RED-evidence summary**:
- G1: RED confirmed by stashing `walk.ts`'s fix and re-running `walk.test.ts` (2 failures:
  `expectAuthoringReason` received `undefined` — no rejection at all); GREEN after restoring.
- G2: RED confirmed by temporarily removing both new `typeof` checks and re-running
  `path-guards.test.ts` (2 failures — a raw `TypeError` from `isLexicallyEscaping`'s
  `.startsWith` call, proving the check was load-bearing, not decorative).
- G3: non-vacuousness proved by repeating Judge B's `packageRoot?: string` fault injection
  into `src/core/context.ts` — the new dist-based assertion failed (`+ "packageRoot?:
  string"` in the diff); reverted immediately, `git status` confirmed clean.
- G4(i)/(ii): mutation-check — the fix pre-existed the updated pinning tests by
  construction (the message/reason text was directly asserted against the new behaviour);
  confirmed by reasoning over the errno branch table and cross-checked against the full
  suite run (both affected tests pass with the NEW expected strings, and would not with the
  old ones — verified by inspecting the prior committed assertions before editing them).
- G6: coverage-addition, not a behavioural fix — all 7 branches already rejected correctly
  before this round; the canary-no-echo PROOF was what was missing, not the rejection
  itself. Exception: the G1 root-symlink canary is genuinely RED-then-GREEN (follows G1's
  own fix).
- G7: comment-only, no test implication.

**Suite**: two consecutive uncontended full `bun test` runs — **2410 pass / 0 fail** across
201 files (5349 expect() calls) both times, byte-identical (baseline 2398 + 12 new tests:
2 in `walk.test.ts`, net +1 in `path-guards.test.ts`, 1 in `fit-43-no-ceiling-regrowth.test.ts`,
8 in `canary-no-echo.test.ts`). `bunx tsc --noEmit` clean. One full-suite run mid-session
showed a transient, unrelated flake in `test/dialects/react`'s `REQ-RXD-08.1` corpus
round-trip test (a pre-existing, timing-sensitive test under full-suite CPU contention,
untouched by this diff) — confirmed non-reproducing in isolation and absent from both
final confirmation runs.

## Judgment-Day Round 2 Fixes

Two blind judges (baseline **2413 pass / 0 fail**, `tsc --noEmit` clean, HEAD `590d42f`)
found 1 CRITICAL + 3 real WARNINGs, all probe-evidenced. Surgical fixes only, RED-first
per fix.

| Fix | Root cause | Fix | Files |
|---|---|---|---|
| F1 (CRITICAL) | `path.join` PRESERVES a trailing separator, and POSIX `lstat` on a path ending in `/` FOLLOWS the final symlink — a `from` root reaching `walkFolder` as `"link/"`/`"link//"`/`"./link/"` bypassed ruling 16's root-symlink rejection entirely (`isSymbolicLink()` reported `false` for the FOLLOWED target), enumerating and committing content outside the package | `walkFolder` (`walk.ts:164`) now computes `const root = resolve(fromAbs);` at its own top and uses `root` for every subsequent `absDir`/`join` — ONE canonical normalization point covering both the root `lstatSync` and every recursive descent, regardless of caller (`expander.ts` or a direct unit-test call) | `src/scaffold/walk.ts` (import `resolve`, normalize `fromAbs` → `root`) |
| F2(a) | Non-string `to` reached `translateTokens(args.to)` before `validateDestinationLexical` ever ran → raw `TypeError` (`path.replace is not a function`), reason `undefined`; same shape for a non-string `rename` value via the filename pipeline | `runScaffold` now calls `validateDestinationLexical(args.to)` at the TOP, before context resolution, the walk, and the empty-folder early return (existing post-rename/post-translate validation of the final `destPath` is unchanged); `runFilenamePipeline` type-checks a resolved rename value BEFORE `translateTokens` consumes it, minting `invalid-input` | `src/scaffold/expander.ts` (`runScaffold`), `src/scaffold/filename-pipeline.ts` (`runFilenamePipeline`) |
| F2(b) | The `walked.length === 0` early return (REQ-FSC-04.1) exited BEFORE destination validation, so `scaffold({from: emptyDir, to: "/abs"})` (or an escaping `../to`) silently succeeded — violating REQ-IPF-02's pre-emit mandate | Same `validateDestinationLexical(args.to)` top-of-function call as F2(a) fixes this too — it now runs unconditionally before the empty-folder no-op path | `src/scaffold/expander.ts` (same call site as F2(a)) |
| F3 | The `## 0.2.0` CHANGELOG section carried exactly three entries; ruling 16's root-symlink rejection (breaking, author-visible: a `from` symlinked to a shared templates dir used to be followed transparently, now hard-rejects) was undocumented | (a) Added a fourth `Changed (breaking)` entry to CHANGELOG.md's `## 0.2.0` section (existing three entries byte-identical); (b) extended `changelog-release-vehicle-guard.test.ts`'s frozen-phrase list with `ROOT_SYMLINK_REJECTION_PHRASE`, renamed the "all three" assertions to "all four"; (c) amended `package-dir-run-anchor`'s REQ-MFB-02 (three→four entries, new clause (d)) and its REQ-MFB-02.1 scenario, V3.3→V3.4, dated "Ruling 16 follow-through (2026-07-29)" note | `CHANGELOG.md`, `test/docs/changelog-release-vehicle-guard.test.ts`, `openspec/changes/inline-collection-marker/specs/package-dir-run-anchor/spec.md` |

**fit-45 / REQ-MFB-02 pin check (F2 scope note)**: `test/fitness/fit-45-single-lexical-predicate.test.ts`
clause (b) pins call sites of `validateSourceLexical` ONLY (exactly 3, unaffected — F2's new
call is to `validateDestinationLexical`, which fit-45 does not pin at all); confirmed no
update needed there. `REQ-MFB-02`'s "exactly THREE entries" language (part (c) of F3) DID
need the three→four amendment described above.

**RED-evidence summary**:
- F1: added trailing-slash rows (`link/`, `link//`, `./link/`, the last constructed by
  literal string concatenation — never `path.join`, to prove the fix normalizes whatever
  raw string reaches it) to `test/scaffold/walk.test.ts`'s root-symlink describe block (3
  new cases, all failed pre-fix with `expectAuthoringReason` receiving `undefined` — the
  symlink was silently followed), plus one e2e case in `test/scaffold/expander.test.ts`
  (`from: "link-out/"`) and one canary case in `test/security/canary-no-echo.test.ts`
  (`from: "link-root/"`) — all 5 failed before the fix, passed after. A no-regression pin
  (`walkFolder(\`${dir}/\`)` against a real, non-symlinked tree) confirmed the fix does not
  change normal-path behaviour.
- F2: 4 new cases in `test/scaffold/expander.test.ts` — non-string `to` (42), non-string
  `rename` value (5), empty-`from` + absolute `to` (`/abs`), empty-`from` + escaping `to`
  (`../escape`) — all 4 raised either a raw `TypeError`/`path.replace is not a function` or
  silently succeeded (no rejection) before the fix; all 4 now reject `AuthoringError`
  `invalid-input`.
- F3: manual mutation-check on the new CHANGELOG phrase — temporarily mutated
  `"now rejects `invalid-input`"` to `"now REJECTS invalid-input-MUTATED"` in CHANGELOG.md,
  re-ran `changelog-release-vehicle-guard.test.ts` (failed, as expected), restored the file
  (`git diff --stat` confirmed only the intended 6-line addition survived), re-ran (passed).

**Suite**: two consecutive uncontended full `bun test` runs — **2423 pass / 0 fail** across
201 files (5406 expect() calls) both times, byte-identical (baseline 2413 + 10 new tests: 4
in `walk.test.ts`, 5 in `expander.test.ts`, 1 in `canary-no-echo.test.ts`). `bunx tsc --noEmit`
clean both times. No flakes observed in either uncontended run.
