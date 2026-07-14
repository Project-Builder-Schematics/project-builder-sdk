# Golden Corpus Contract Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): REQ-GCC-09 added (rejection record shape, QA-B1);
REQ-GCC-10 added (corpus placement + naming — names are the external API, TW-B2);
REQ-GCC-11 added (corpus-root README + in-file authority self-labeling, TW-M-2/M-3);
REQ-GCC-12 added (infra-spine skeleton transcript for pre-merge RED-provability,
QA-minor); GCC-02 gains the one-sentence failure-it-prevents (TW-M-1); GCC-03
"directive multiset" → "ordered directive sequence (walk order, GCC-07)" (TW-minor);
GCC-05 cites FIT-27 as its mechanical enforcement (QA-B2); GCC-06 widened to ban ALL
non-deterministic fields + pins canonical serialization (QA-M-e); GCC-08 gains a
literal completeness checklist, the split gap-attribution parenthetical, and the
FRICTION section (BA major / TW-minors); GCC-01.1 count formula extended for
rejection records + the skeleton file. All V1 REQ-IDs preserved.

## Purpose

Pins the committed golden-transcript corpus: one file per scenario that is
SIMULTANEOUSLY the structural regression baseline and the provisional engine-handoff
contract (owner ruling D1, obs #941) — collapsing what would otherwise be three
separate audiences into one committed artifact, drift between "golden" and "corpus"
impossible by construction.

## Requirements

### REQ-GCC-01: Corpus Identity — One Committed File Is Both Baseline and Handoff

Each scenario MUST have exactly one committed corpus file that serves BOTH roles: the
byte-exact regression baseline AND the engine-handoff contract (D1). No scenario may
have a separate "golden" file and a separate "corpus" file. Rejection scenarios commit
a REJECTION record (REQ-GCC-09) as their corpus file — fail-loud rows are not exempt
from the one-file-per-row rule.

#### Scenario REQ-GCC-01.1: Corpus file count matches the executable rows plus the skeleton [SDK]

- GIVEN the committed corpus directory and the `scenario-matrix` table
- WHEN counted
- THEN the number of committed corpus files equals the number of non-engine-gated
  matrix rows (success AND rejection records alike) PLUS exactly one infra-spine
  skeleton record (REQ-GCC-12), one-to-one

### REQ-GCC-02: Own `formatVersion`, Independent of Wire `protocolVersion`

The corpus record format MUST carry its own `formatVersion` field, versioned
independently of `Batch.protocolVersion` (`src/core/wire.ts`) — a wire protocol bump
MUST NOT force a corpus format bump, and vice versa. The failure this prevents: a
future engine-side reader rejecting a corpus file because `formatVersion: 3` does not
equal `protocolVersion: 1` — that combination is VALID; neither version ever implies,
constrains, or validates the other, and no reader may reject a corpus file on a
wire-version comparison.

#### Scenario REQ-GCC-02.1: formatVersion and protocolVersion vary independently [SDK]

- GIVEN a committed corpus file and the `Batch` it was captured from
- WHEN both version fields are inspected
- THEN `formatVersion` (corpus) and `protocolVersion` (wire) are distinct fields with
  independent values — no code path derives one from the other

### REQ-GCC-03: NORMATIVE vs INFORMATIVE Fields

The corpus format MUST distinguish NORMATIVE content — the ordered directive sequence
(each directive's op + semantic fields, in walk order per REQ-GCC-07), the terminal
outcome (committed-once, or rejected per REQ-GCC-09) — from INFORMATIVE content —
batch/chunk grouping (how many `emit()` calls occurred, which directive landed in
which chunk). A NORMATIVE-field drift MUST fail the corpus check; INFORMATIVE-only
drift is design-owned latitude, captured but not necessarily diff-failing (design
ratifies the exact diff policy).

#### Scenario REQ-GCC-03.1: Chunk-boundary-only change does not read as directive drift [SDK]

- GIVEN two runs of the same scenario where the number of `session.flush()` calls
  differs but the resulting committed directive sequence and order are identical
- WHEN compared under the corpus format's NORMATIVE/INFORMATIVE split
- THEN the NORMATIVE comparison passes; only the INFORMATIVE batch-grouping record
  differs

### REQ-GCC-04: Byte-Determinism

Two consecutive runs of the same scenario MUST produce byte-identical corpus file
content.

#### Scenario REQ-GCC-04.1: Re-run produces a diff-empty corpus file [SDK]

- GIVEN a scenario run twice in succession
- WHEN the two renders are diffed
- THEN they are byte-identical

### REQ-GCC-05: Tautology Guard — No In-Test Update Path

No in-test code path may regenerate or overwrite a committed corpus file. A drifted
corpus MUST fail the suite. Corpus updates are a deliberate, reviewed, out-of-band
action (a maintainer-run regeneration script living OUTSIDE the test-imported graph),
never something the test itself can trigger. Mechanical enforcement is
`fitness-guards` REQ-FTG-05 (FIT-27) — this REQ pins the WHAT; FIT-27 pins the
static-scan HOW. The regenerate-and-diff flow of that out-of-band script is the STRONG
determinism guard (fresh process, fresh state); FIT-28's same-process double-run
(REQ-FTG-01) is the fast, weak guard — both exist deliberately.

#### Scenario REQ-GCC-05.1: Drifted corpus fails the suite; no self-heal exists [SDK]

- GIVEN a committed corpus file manually altered to no longer match a fresh run's
  output
- WHEN the suite runs
- THEN the corresponding test FAILS, and no code path in the test or its helpers writes
  a new corpus file to make it pass

### REQ-GCC-06: Purity — Deterministic, Text-Only, Relative-Path-Only Content

Every committed corpus file MUST contain: no binary magic bytes; no absolute
filesystem paths (by-reference entries carry package-relative source paths only,
mirroring `by-reference-copy-wire` REQ-BRC-07); and NO non-deterministic field of any
kind — no timestamps, durations, run ids, PIDs, hostnames, nonces, or
random/environment-derived values. Serialization MUST be canonical: UTF-8, LF line
endings, a single trailing newline, pretty-printed JSON with a FIXED, documented key
order per record type (design ratifies the exact key listing; the writer emits keys in
that pinned order — never engine/JS object-iteration happenstance). Feeds
`fitness-guards` FIT-24.

#### Scenario REQ-GCC-06.1: Corpus files are pure text, package-relative only [SDK]

- GIVEN every committed corpus file
- WHEN scanned for binary signatures and absolute-path-shaped strings
- THEN none are found

#### Scenario REQ-GCC-06.2: No non-deterministic field survives into a corpus file [SDK]

- GIVEN every committed corpus file
- WHEN scanned for timestamp-shaped, duration-shaped, uuid/nonce-shaped, or
  hostname/PID-shaped values
- THEN none are found — every field is a pure function of the scenario's inputs

### REQ-GCC-07: Walk-Order Is NORMATIVE (Un-Speced Upstream — Explicit Risk)

Intra-walk order MUST be treated as NORMATIVE corpus content, matching the code's
current observed-sorted behaviour (`src/scaffold/walk.ts`'s `readdirSync().sort()`).
`schematic-local-files`'s signed spec does NOT itself pin this order. If upstream later
pins a different order, the corpus format is revisited via ADR — this is a documented,
non-silent risk, not an oversight.

#### Scenario REQ-GCC-07.1: Corpus order matches the code's observed-sorted walk [SDK]

- GIVEN a scaffold scenario whose source folder enumerates in a non-alphabetical
  filesystem creation order
- WHEN captured
- THEN the corpus's directive order matches the SORTED order `walk.ts` produces, and a
  reordering-only mutation would fail the corpus check

### REQ-GCC-08: Coverage Manifest — Two Ledgers Plus Friction, Completeness Defined

The corpus MUST be accompanied by a coverage manifest containing: (a) an EXERCISED
ledger mapping REQ-IDs to matrix rows; (b) a NOT-EXERCISED ledger of honest gaps; and
(c) the `FRICTION` section (`author-emulation-generator` REQ-AEG-06). "Complete" is
this literal checklist — `sdd-verify --mode=final` MUST fail if any item is missing
(D2 mechanical check):

1. EXERCISED lists EVERY `schematic-local-files` REQ-ID cited anywhere in the
   `scenario-matrix` table, each mapped to its row id(s).
2. NOT-EXERCISED contains the literal entries `module-wiring`, `tsconfig-AST`
   (gap source: `author-emulation-generator` REQ-AEG-02), and `template rendering`
   (gap source: `ir-transcript-capture` REQ-ITC-03's evidence boundary).
3. NOT-EXERCISED contains the literal engine-gated entries `REQ-BRC-08` and
   `REQ-PRC-06` (`scenario-matrix` REQ-SCM-02).
4. The `FRICTION` section exists (≥1 entry or the literal `none observed`).

#### Scenario REQ-GCC-08.1: Manifest passes the four-point completeness checklist [SDK]

- GIVEN the coverage manifest
- WHEN checked against the four checklist items above
- THEN all four hold; removing any single matrix-cited REQ-ID from EXERCISED, or any
  of the five literals from NOT-EXERCISED, or the FRICTION section, fails the check

### REQ-GCC-09: Rejection Record — the Corpus Shape for Fail-Loud Rows

For every matrix row whose expected outcome is a rejection (fail-loud, nothing
committed), the corpus file MUST be a REJECTION record whose NORMATIVE content is: an
EMPTY committed-directive sequence, terminal outcome `rejected`, and the Stage-2
`AuthoringError` attribution triple — `reason` (the closed `AuthoringReason` value),
`verb` (the author verb, when attributable), and the primary PACKAGE-RELATIVE path.
Raw error message text is NOT part of the record (message wording stays free to evolve
under upstream REQ-AEC-11 without corpus churn). Success records and rejection records
share the same envelope (`formatVersion`, scenario id, terminal outcome) so one reader
handles both.

#### Scenario REQ-GCC-09.1: A rejection row's corpus file is the attribution triple [SDK]

- GIVEN matrix row M-13 (filters eliminate everything)
- WHEN its corpus file is inspected
- THEN it records terminal outcome `rejected`, an empty directive sequence, and
  `{reason: "invalid-input", verb: null, path: null}` (when the rejection reason is
  not attributable to a specific verb or path, both fields are `null`; when attributable,
  they carry the author verb and package-relative path—see M-21 for a `path-collision`
  rejection where both are present) — and contains no free-text error message

### REQ-GCC-10: Corpus Placement and Naming — Names Are the External API

The corpus MUST live at `test/e2e/author-emulation/corpus/` — a directory DISTINCT
from both existing golden idioms (`test/golden-ir/`, in-source literals;
`test/dialects/typescript/golden/`, byte-print files), keeping the third idiom
physically separate. Per-scenario filename MUST be
`<matrix-id>.<slug>.transcript.json` (lowercase matrix id, kebab-case slug — e.g.
`m-01.happy-path-full-generator.transcript.json`; the skeleton record is
`s-00.infra-skeleton.transcript.json`). The coverage manifest MUST be
`test/e2e/author-emulation/corpus/coverage-manifest.md`; the README (REQ-GCC-11) MUST
be `test/e2e/author-emulation/corpus/README.md`. Renaming any of these after landing
is a corpus `formatVersion`-relevant event, not a refactor.

#### Scenario REQ-GCC-10.1: Every corpus artifact sits at its pinned name [SDK]

- GIVEN the committed corpus directory
- WHEN listed
- THEN every scenario file matches `<matrix-id>.<slug>.transcript.json`, and
  `coverage-manifest.md` + `README.md` exist at the corpus root — no stray or
  differently-patterned file is present

### REQ-GCC-11: Corpus-Root README — Authority Travels With the File

A committed `README.md` at the corpus root MUST cover, as distinct sections: (1) WHAT
this corpus is (golden baseline = engine-handoff contract, D1, v0/PROVISIONAL until
PC-PROTO-01); (2) NORMATIVE STATUS — which record regions bind (ordered directive
sequence, terminal outcome, attribution triple) vs which are informative
(batch/chunk grouping), and what `formatVersion` means (including the REQ-GCC-02
independence sentence); (3) HOW it is regenerated (the out-of-band maintainer script;
tests never regenerate); (4) what the NOT-EXERCISED ledger means; (5) a pointer to
this spec/change. Additionally, each corpus record MUST self-label its regions
(e.g. NORMATIVE content under a dedicated key, informative grouping under another) so
a reader of the RAW file — without the README — can tell which parts bind.
Verify-final performs a mechanical presence + section check.

#### Scenario REQ-GCC-11.1: README present with all five sections; records self-label [SDK]

- GIVEN the corpus root README and any single corpus record
- WHEN inspected
- THEN the README contains the five sections above, and the record structurally
  separates its normative region from its informative region

### REQ-GCC-12: Infra-Spine Skeleton Transcript — RED-Provable Before the Merge Gate

The corpus MUST include exactly one NON-matrix skeleton record
(`s-00.infra-skeleton.transcript.json`) captured from a factory using only the SIX
pre-existing wire ops (no `scaffold`/`copyIn`/`create({templateFile})`), so the corpus
format, determinism (FIT-28), purity (FIT-24), and tautology-guard (FIT-27) REQs are
all RED-provable BEFORE `schematic-local-files` merges — decoupling the infra spine
from the scaffold merge gate and serving as the walking skeleton's committed evidence.
The skeleton record is subject to every REQ-GCC-04/05/06 obligation but is NOT a
scenario-matrix row and never cites scaffold REQs.

#### Scenario REQ-GCC-12.1: Skeleton record exists and passes all corpus guards pre-merge [SDK]

- GIVEN the worktree BEFORE `schematic-local-files` is merged
- WHEN the skeleton scenario and FIT-24/28 run against the existing six ops
- THEN the skeleton corpus file is produced deterministically, passes purity, and a
  deliberate drift to it fails the suite

## Sensitive Areas Coverage

No sensitive areas covered — the corpus is test-only committed data with no runtime
authority.
