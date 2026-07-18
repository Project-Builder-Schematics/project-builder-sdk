# Apply Progress — conformance-corpus

## S-000 — Walking Skeleton (PR#1)

All 8 tasks (`S-000.1`..`S-000.8`) landed at commit `a497194` — see `slices.md` for the checklist (all `[x]`).

### Fix iteration — in-loop 2 (GAN loop, addressing `verify-in-loop-1.md` CRITICAL finding)

**Finding**: `fit-40-conformance-corpus-integrity.test.ts` + `conformance-fixture-loader.ts` built ~20 `violations: string[]` collectors but only ever evaluated them against the real, well-formed `conformance/` tree — the fail-closed `if (...) violations.push(...)` branches had never fired. REQ-CSC-01.1 and REQ-CSC-04.1 (explicit signed-spec failure scenarios) were UNTESTED despite the suite showing green.

**Fix** (commit `e28c7b6` on `feat/conformance-corpus`):

1. Extracted every violation collector out of `fit-40-conformance-corpus-integrity.test.ts` into `test/support/conformance-validators.ts` as pure functions (`checkMissingManifestIds`, `checkOrphanFactoryWithoutManifest`, `checkManifestIdMatchesDir`, `checkOrphanDirectories`, `checkWireSpecVersionAgreement`, `checkCollectionJsonMarker`, `checkSeedExpectedResolution`, `checkFactoryModuleResolution`, `checkSchematicLoweringFiles`, `checkNonEmptyCases`, `checkValidClass`, `checkTranscriptShape`, `checkOutcomeShape`, `checkOutcomeTripleConsistency`, `checkZeroEffectSeed`). `fit-40` now calls these against the real tree — behaviour byte-identical (confirmed: 37 pass / 0 fail, same 49 `expect()` calls, before and after the extraction).
2. Added `test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` — 18 new tests driving each collector against synthetic broken fixtures (in-memory `LoadedFixture` objects for shape/consistency checks that never touch disk; `mkdtemp` temp-dir trees for the checks that resolve paths on disk). Covers REQ-CSC-01.1, REQ-CSC-04.1 (the two explicit signed-spec failure scenarios named in the finding) plus every sibling family the finding enumerated: REQ-CCR-02(a)/(b)/(c), REQ-CCR-05.2, REQ-CCR-07.1, REQ-CSC-02.1/.2/.3, REQ-CSC-03.1/.2/(class)/(outcome), REQ-CFX-04(directive/batch sub-branches), and REQ-CFX-10.1 (bonus — flagged PARTIAL in the verify report's compliance matrix).
3. No production/fixture/corpus content touched — `conformance/**`, `corpus.json` semantics, and the byte-level scans (REQ-CDT-03/04/07, REQ-CFX-01/02) are untouched, per the fix contract.

### TDD Cycle Evidence — S-000 fix (in-loop iteration 2)

Since the violation-detection logic pre-existed the tests (the CRITICAL finding was a coverage gap, not a bug), the cycle used here is refactor-then-characterize-then-mutate:

1. **Safety net**: `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` → 37 pass / 0 fail before touching anything.
2. **Refactor (behaviour-preserving)**: extracted the 15 collectors to `conformance-validators.ts`; re-ran the same suite → still 37 pass / 0 fail, 49 `expect()` calls — proves the extraction changed nothing observable.
3. **New tests (GREEN on write)**: each of the 18 negative tests passed immediately on first run — expected, since it exercises pre-existing correct logic, not new behaviour (the documented exception to "test must fail first" for TDD applied to *new* production code).
4. **Mutation verification (RED evidence)**: for every one of the 18 tests, the corresponding validator branch was inverted/broken, the specific test re-run and observed to fail (either an assertion mismatch or, for the "missing transcript" case, a `TypeError` proving the guard's absence is caught), then the validator was reverted and the test re-confirmed green. Two of the three `checkOutcomeTripleConsistency` sub-branches were tested with cross-branch collateral checked (mutating the top-level `isExit2 !== hasCode` guard also broke the two downstream tests, confirming they share the gate as designed) before being isolated and verified independently.

| Test (file::name) | Collector mutated | RED evidence |
|---|---|---|
| `...negative.test.ts::REQ-CSC-01.1 fails, naming the offending id...` | `checkMissingManifestIds` → always `[]` | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CCR-02(b) fails when a directory has factory.ts...` | `checkOrphanFactoryWithoutManifest` guard inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CCR-02(c) fails when manifest.json#id differs...` | `checkManifestIdMatchesDir` filter inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CCR-05.2 fails when a directory exists but is not listed...` | `checkOrphanDirectories` filter inverted | wrong id in the emitted violation |
| `...negative.test.ts::REQ-CCR-07.1 fails when a manifest's wireSpecVersion disagrees...` | `checkWireSpecVersionAgreement` filter inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-02.1 fails, naming the fixture and case...` | `checkSeedExpectedResolution` guard inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-02.2 fails, naming the fixture and unresolved path...` | `checkFactoryModuleResolution` filter inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-02.1 fails on both sub-checks when lowering.mode is schematic...` | `checkSchematicLoweringFiles` both guards inverted | `Expected [2 items] Received []` |
| `...negative.test.ts::REQ-CSC-02.3 fails, naming the missing marker...` | `checkCollectionJsonMarker` condition inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-03.1 fails when a manifest's cases[] is empty` | `checkNonEmptyCases` filter inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-03 fails when class is not one of...` | `checkValidClass` filter inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-03.2 fails...no transcript key at all` | `checkTranscriptShape` undefined-guard inverted | `TypeError: undefined is not an object (evaluating 't.callbacks')` |
| `...negative.test.ts::REQ-CSC-03.2 fails when transcript.callbacks contains a value outside...` | `checkTranscriptShape` callbacks-shape guard inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-03 fails when outcome.exitCode is not an integer` | `checkOutcomeShape` exitCode guard inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CSC-04.1 fails when exitCode is 2 and emitRejectionCode is null` | `checkOutcomeTripleConsistency` top guard inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CFX-04 fails when a directive-level emitRejectionCode carries a non-integer failedIndex` | `checkOutcomeTripleConsistency` directive-branch inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CFX-04.2 fails when a batch-level emitRejectionCode carries a non-null failedIndex` | `checkOutcomeTripleConsistency` batch-branch inverted | `Expected [...] Received []` |
| `...negative.test.ts::REQ-CFX-10.1 fails when expected is zero-effect but seed is null` | `checkZeroEffectSeed` filter inverted | `Expected [...] Received []` |

Every mutation was reverted immediately after capturing RED; `diff` against a pre-mutation backup of `conformance-validators.ts` confirmed byte-identical restoration before the fix commit.

### Real execution evidence (fix iteration)

| Check | Result |
|---|---|
| `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` | 55 pass / 0 fail (37 real-tree + 18 negative), 68 `expect()` calls |
| `bun test` (full suite) | 2023 pass / 0 fail, 4317 `expect()` calls, 188 files — up from the verify report's clean-run baseline of 2005 (2005 + 18 new = 2023, exact) |
| `bun run typecheck` (`tsc --noEmit`) | Clean |
| `bun run build` | Green; `dist/` still carries no `collection.json`/`corpus.json`/fixture-id directories (checked with `find`) |

**Commit**: `e28c7b6` on `feat/conformance-corpus` (base `a497194`) — `test(conformance-corpus): prove FIT-40's fail-closed branches actually fail closed`.

**Scope discipline**: `conformance/**` fixture content, `corpus.json` semantics, and the byte-level scans (REQ-CDT-03/04/07, REQ-CFX-01/02) untouched — diff is scoped to `test/support/conformance-validators.ts` (new), `test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` (new), and `test/fitness/fit-40-conformance-corpus-integrity.test.ts` (refactored to call the extracted collectors — net -127 lines, same 37 assertions).

## S-001..S-004 — PR#2 (4 commit-atomic slices: m2-modify → m2-delete → m2-rename-move → m2-create-composition)

All 4 slices' tasks (`S-001.1`..`S-004.5`) landed at commits `d134000`/`381c1a8`/`883c482`/`45b7dae` on `feat/conformance-corpus`, base `c80fd7d` (S-004's hard gate: ADR-0065 ACCEPTED by the engine, confirmed present in the committed handoff before authoring — see "S-004 hard gate" below). See `slices.md` for the checklist (all `[x]`).

### Design elaboration: per-case `factory` export for all four m2-* twins, not composition-only

REQ-CFX-06/07/08's behavioral-contract tables each name a twin's target by a DIFFERENT literal
path/argument than the positive case's (`m2-modify`'s not-found-twin targets `missing.txt`
against a shared seed that still contains `target.txt`+`sibling.txt` — confirmed by
REQ-CFX-10.1's scenario explicitly pinning that seed content for the twin; `m2-delete`'s
dir-target-twin targets the seeded `adir`; `m2-rename-move`'s collision-twin renames onto the
seeded `occupied.txt` and its dir-source-twin sources the seeded `adir`). A single default-export
factory cannot express two different hardcoded target arguments for two cases with no
case-distinguishing input signal (`Manifest.input` is fixture-level, not per-case). The schema's
per-case `factory` override (`Case.factory?`, ADR-0065 §4.3) is generic — the ACCEPTED handoff
text states "a `cases[] entry MAY carry its own factory`" without scoping it to
`m2-create-composition` — so every twin in `m2-modify`/`m2-delete`/`m2-rename-move` uses a
named-export probe (`notFoundProbe`, `dirTargetProbe`, `collisionProbe`, `dirSourceProbe`)
selected via `cases[].factory.export`, exactly the mechanism `m2-create-composition`'s
`createRejectProbe` also uses. This is judged a completion of an underspecified implementation
detail, not a deviation: REQ-CFX-06/07/08's literal target values are unimplementable with the
default-export-only reading, and the schema capability was already global, not composition-scoped,
in both design.md §4.3 and the engine's ACCEPTED sign-off text. Verified safe against REQ-CFX-02's
corpus-wide create-scan: the scan's `/\bcreate\s*\(/.test(source)` reads the WHOLE factory.ts file
per case, gated on that case's resolved `export !== null` — since only `m2-create-composition`'s
factory.ts contains a `create(` call, the new probes in the other three fixtures (whose files
never call `create()`) are structurally safe from false-positive flagging, confirmed by the green
run below.

### S-004 hard gate (pre-authoring, BLOCKING per slices.md)

Before authoring `m2-create-composition/manifest.json`, re-verified `CONFORMANCE-CORPUS-HANDOFF.md`
at HEAD (`c80fd7d`, committed) carries the engine's **ACCEPTED** sign-off block (2026-07-18, loader
support landed engine-side `sdk-live-conformance/build@17a49ab`) for the case-level
`factory: {module, export}` override — confirmed present (`rg -n "ACCEPTED" CONFORMANCE-CORPUS-HANDOFF.md` → line 84) both before starting S-001 and again immediately before authoring S-004's manifest. No `spec-source-drift` halt triggered — gate genuinely cleared, not assumed.

### TDD cycle evidence — double-loop RED→GREEN per slice

Each slice added a NEW `describe("REQ-CFX-0N — <fixture> behavioral contract...")` block to
`fit-40-conformance-corpus-integrity.test.ts`, gated on `expect(fixture).not.toBeUndefined()`
(no vacuous early-return skip, unlike REQ-CFX-05's block — that pattern would have silently
passed instead of RED-failing while the fixture was still absent). Observed genuinely fail
(`Received: undefined`) before authoring each fixture, genuinely pass after:

| Slice | New block | RED (before fixture) | GREEN (after fixture) |
|---|---|---|---|
| S-001 (m2-modify) | REQ-CFX-06 (2 tests) | 37 pass / 2 fail | 57 pass / 0 fail (fit-40 + negative) |
| S-002 (m2-delete) | REQ-CFX-07 (3 tests) | 39 pass / 3 fail | 60 pass / 0 fail |
| S-003 (m2-rename-move) | REQ-CFX-08 (3 tests) | 42 pass / 3 fail | 63 pass / 0 fail |
| S-004 (m2-create-composition) | REQ-CFX-09 (2 tests) | 45 pass / 2 fail | 65 pass / 0 fail |

### Real execution evidence (per slice, at each commit)

| Check | S-001 (`d134000`) | S-002 (`381c1a8`) | S-003 (`883c482`) | S-004 (`45b7dae`) |
|---|---|---|---|---|
| `bun test` (full suite) | 2025 pass / 0 fail | 2027/2028 pass, 1 fail (pre-existing `test/conformance/react-conformance.test.ts` timeout flake — reproduced with S-002's changes stashed away, confirmed pre-existing, not a regression; 2031/2031 clean on immediate rerun) | 2030/2031, 1 fail (same flake), 2031/0 clean on rerun | 2033 pass / 0 fail |
| `bun run typecheck` | Clean | Clean | Clean | Clean |
| `bun run build` | Green | Green | Green | Green, `find dist -iname "*collection.json*" -o -iname "*corpus.json*"` and fixture-id dir search both empty |
| `scripts/conformance-pr-gate.ts pr2 c80fd7d` | PASS, 1 commit | PASS, 2 commits | PASS, 3 commits | PASS, 4 commits |
| `git add --renormalize .` dry-check (post-S-004) | — | — | — | Zero residual diff on any `conformance/**`/test file; the only diff picked up was the pre-existing, untouched `.sdd/state/conformance-corpus.json` content edit (orchestrator-owned, not touched by this session) |

**Note on the react-conformance flake**: `test/conformance/react-conformance.test.ts` (REQ-RXD-08.1,
20-sample JSX round-trip, unrelated `src/conformance/**` published dialect kit) times out at
~5.1-5.8s against a 5000ms budget under system load — reproduced via `git stash` at the S-001
commit with S-002's uncommitted changes removed, confirming it is pre-existing and unrelated to
this change's `conformance/` root-corpus work. Not touched, not caused, by S-001..S-004.

### Scope discipline (S-001..S-004)

`conformance/m1-vehicle/**`, `conformance/collection.json`, `conformance/README.md`,
`.gitattributes`, `test/support/conformance-fixture-loader.ts`, `test/support/conformance-validators.ts`,
`test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` — all untouched by S-001..S-004.
Diff scoped to: 4 new `conformance/m2-*/**` fixture trees, `conformance/corpus.json` (4 additive
`fixtures[]` appends, one per commit), `test/fitness/fit-40-conformance-corpus-integrity.test.ts`
(4 new `describe` blocks appended, one per commit, zero edits to existing blocks), and `slices.md`
checkbox updates. No wire-spec touches, no fake-fidelity fixes, no second `create()` site.

## Council fix batch (post-S-004, pre-verify-final)

Six fixes from the council review, split into two commits on `feat/conformance-corpus`.

### Docs commit — `348bb75` (fixes 1-4, TW findings)

1. `CONFORMANCE-CORPUS-HANDOFF.md` — the "manifest.json schema (per fixture)" example was
   labelled `"id": "m2-modify"` but showed `callbacks: ["tree.read", "ir.emit", "ir.commit"]`,
   a sequence only `m1-vehicle` actually has (`m2-modify` never reads). Neutralized the id to
   `"<fixture-id>"` and added a note that `callbacks` is per-fixture — each fixture's own
   `manifest.json` is normative. No real manifest touched.
2. `conformance/README.md` — documented the engine's strict manifest/`corpus.json` decoding
   (`DisallowUnknownFields`, any unknown key at any level is a hard engine-side failure) under
   the authoring conventions bullets — fit-40 checks shape, not unknown keys, so this was an
   undocumented trap.
3. `conformance/README.md` — documented case-level `factory` override mechanics for negative
   twins (ADR-0065) as step 2 of "How to add a fixture", renumbering the following steps.
4. Root `README.md` — added a one-line pointer to `conformance/` (SDK↔engine corpus, pinned
   submodule) under "## Development", the closest existing section to a repo-layout/testing
   home (no dedicated "Repository layout" section exists in this README).

### Test commit — `f46e8fd` (fixes 5-6, QA findings, `fit-40-conformance-corpus-integrity.test.ts`)

5. **QA F2** — REQ-CFX-03.1's `DO-NOT-COPY` assertion only checked for the token, never that
   the five clauses (a)-(e) it's supposed to convey were actually present; deleting a clause
   left it green. Strengthened to locate each `(a)`..`(e)` marker and require a stable,
   reword-resistant keyword within that clause's span (`one-create-corpus-wide`, `REJECT
   PROBE`, `do NOT imitate`, `unrepresentable`, `modify/delete/rename/move`).
   **Non-vacuousness proof**: scratch script (`clause-check.ts`, not committed) ran the exact
   assertion logic against (a) the real `m2-create-composition/factory.ts` source → `missing:
   []` (green), (b) an in-memory copy with clause (c)'s line deleted → `missing: ["(c)"]`
   (RED), (c) an in-memory copy with clause (c) reworded but its keyword kept → `missing: []`
   (still green, proving resilience to minor rewording, not just brittleness). Original
   restored — no mutation ever touched disk.
6. **QA F3** — REQ-CFX-02's create-scan predicate filtered on
   `(c.factory?.export ?? f.manifest.factory.export) !== null`, silently exempting every
   default-export factory (including the fixture-level default, `export: null`) from the
   `create()` scan — a `create()` authored straight into any fixture's default export would
   never have been caught. Replaced with a structural invariant: collect the corpus-wide SET
   of factory files (fixture-level module + every case-level override module) whose source
   matches `/\bcreate\s*\(/`, and require that set contain nothing but the one sanctioned site
   `m2-create-composition/factory.ts` (vacuous-safe: the sanctioned-site requirement only
   fires once that fixture is actually loaded, preserving the two-checkpoint PR#1/PR#2
   cadence documented at the top of the file).
   **Mutation-check proof**: copied the real `conformance/` tree to a scratch dir (never the
   repo), injected an unused function calling `create(...)` into
   `m2-modify/factory.ts`'s default-export module, then ran the extracted validator logic
   (via `loadCorpus` + `stripComments`, the same functions the test imports) against that
   scratch copy — `factoryFilesWithCreate` came back
   `["m2-modify/factory.ts", "m2-create-composition/factory.ts"]` and `violations` flagged
   `m2-modify/factory.ts` by name. Scratch dir discarded after; no repo file touched.

### Real execution evidence

| Check | Result |
|---|---|
| `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` | 47 pass / 0 fail, 112 `expect()` calls |
| `bun test` (full suite, after both commits) | 2033 pass / 0 fail, 4380 `expect()` calls, 188 files — identical count to the pre-batch baseline (assertions strengthened in place, no tests added/removed) |
| `bun run typecheck` (`tsc --noEmit`) | Clean, both commits |

**Commits**: `348bb75` (`docs(conformance): fix TW council findings on corpus docs`),
`f46e8fd` (`test(conformance): strengthen fit-40 QA council findings`), both on
`feat/conformance-corpus`, base `45b7dae`.

**Scope discipline**: no manifest, `corpus.json`, or `src/**` file touched. Diff scoped to
`CONFORMANCE-CORPUS-HANDOFF.md`, `README.md`, `conformance/README.md`, and
`test/fitness/fit-40-conformance-corpus-integrity.test.ts` only.

**Deviations from the batch spec**: none. All six fixes applied exactly as scoped; no
additional findings surfaced during application.

## Judgment-day fix round 1 (post-council, blind adversarial review)

Three CONFIRMED findings from the blind judgment-day round 1 pass, applied surgically on
top of `f46e8fd`.

### JD-1 — `scripts/conformance-pr-gate.ts`'s `checkPr2` under-enforced REQ-CCR-04

The per-commit loop only asserted `manifest.json` presence + `manifest.id === listed id` —
REQ-CCR-04 requires the FULL artefact set per commit, atomically. Fixed: for every fixture
id listed in a commit's `corpus.json`, using THAT commit's tree only (`git ls-tree`/`git
show`, never the worktree), now also asserts: (a) the fixture-level `factory.module` path
resolves; (b) every case-level `factory.module` override resolves; (c) every `seed`/
`expected` directory reference resolves (sentinel values `"empty"`/`"zero-effect"` need no
directory, per manifest semantics); (d) `lowering.mode === "schematic"` implies
`<schematicRoot>/schema.json` + at least one `<schematicRoot>/files/**` entry, all in that
commit's tree. Directory existence is proven via a "some blob path starts with `<dir>/`"
scan (`hasEntryUnder`), since `git ls-tree` only lists blobs.

**Non-vacuousness proof**: built a synthetic scratch git repo (outside this repo) with one
commit listing a fixture whose `manifest.json` declares a seed, an expected dir, and
`lowering.mode: "schematic"` but ships NONE of those artefacts. The OLD `checkPr2` logic
(verified via `git stash`) reported `PASS — 1 commit(s) checked` against this broken
commit — proving the vacuous gap. The NEW logic reports 4 named violations (seed dir,
expected dir, schema.json, schematic/files/) and exits 1. Scratch repo discarded after —
no repo file touched.

### JD-2 — REQ-CFX-02's create-scan was blind INSIDE the sanctioned file

The `f46e8fd` fix strengthened the corpus-wide "which FILES contain create()" scan but
still could not see a SECOND `create()` smuggled into the sanctioned file's own default
export — it only asked "which files", never "where inside the file". Added
`checkCreateQuarantine` (`test/support/conformance-validators.ts`): for every factory
module a fixture references, if its stripped source contains any `create(` call, extracts
the function block of every case-referenced named-export (via brace-matching from the
`export function <name>(` declaration) and asserts the total `create(` count in the whole
file equals the count found strictly inside those quarantine block(s), with at least one
inside. Wired into fit-40 as a new assertion in the existing REQ-CFX-02/03 describe block.

**Non-vacuousness proof**: negative-suite test (`fit-40-conformance-corpus-integrity.negative.test.ts`)
builds a synthetic factory with a `create()` in the default export (unquarantined) AND a
`create()` inside a case-referenced named export (quarantined) — `checkCreateQuarantine`
correctly reports the file smuggles a call outside its quarantine (`2 total, only 1 inside
quarantine`), naming the fixture. A second test proves the "no quarantining case at all"
branch, a third proves the clean case (real corpus shape) passes with zero violations.

### JD-3 — case-level `factory.export`/`factory.module` resolution was never validated

Added `checkFactoryExportResolution` (same file): for the fixture-level factory pointer AND
every distinct case-level `factory` override, resolves the module (extending
`checkFactoryModuleResolution` to also check case-level module overrides, not just the
fixture-level default) then text-parses the module's exports (default export presence +
every named `export function`/`export async function`/`export const`) and asserts every
`factory.export` value names a real export — `factory.export: null` requires a default
export to exist. Wired into fit-40 alongside the module-resolution check.

**Non-vacuousness proof**: negative-suite tests cover a typo'd/nonexistent named export
(fails, naming fixture + case), a `factory.export: null` module with no default export
(fails), and an `async function`/`export const` combination (passes — proves the regex
isn't brittle to those forms, per the JD-3 robustness requirement).

### Real execution evidence

| Check | Result |
|---|---|
| `bun test` (full suite) | 2041 pass / 0 fail, 4388 `expect()` calls, 188 files — up from the pre-round baseline of 2033 (2033 + 8 new tests = 2041, exact: 2 new fit-40 assertions + 6 new negative-suite tests) |
| `bun run typecheck` (`tsc --noEmit`) | Clean |
| `scripts/conformance-pr-gate.ts pr2 6db2f5e` | PASS — 9 commit(s) checked, no orphan-listing commit found |
| `scripts/conformance-pr-gate.ts pr1` | Exits 1 (pre-existing, unrelated — HEAD is past the PR#1 checkpoint at 5 fixtures; reproduced identically before this round's changes via `git stash`) |

**Scope discipline**: no manifest, `corpus.json`, fixture content, or `src/**` file
touched. Diff scoped to `scripts/conformance-pr-gate.ts`,
`test/support/conformance-validators.ts`,
`test/fitness/fit-40-conformance-corpus-integrity.test.ts`, and
`test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts`.

**Deviations from the fix list**: none. All three CONFIRMED findings applied exactly as
scoped; no additional findings surfaced during application.
