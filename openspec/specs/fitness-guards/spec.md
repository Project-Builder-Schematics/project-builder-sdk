# Fitness Guards Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V2 → V3 (archive-sync, `inline-collection-marker`, 2026-07-29): three new fitness guards added — REQ-FTG-06 (no regrowth of the deleted containment ceiling mechanism: the marker literal, the ancestor-walk idiom, the `RunContext` anchor shape, a `test/**` marker-fabrication allowlist, a one-time `openspec/specs/**` retired-vocabulary sweep executed at this archive, and zero `realpathSync`/`realpath` references in the scaffold/context modules), REQ-FTG-07 (every surviving `AuthoringReason` member reachable through both minting mechanisms, excluding the vacuously-reachable union declaration and exhaustiveness switch), and REQ-FTG-08 (exactly one lexical `../`/absolute-path predicate implementation, never a second parallel one per verb). All three guard invariants this change's containment removal depends on staying true going forward.

V1 → V2 (council fixes applied): REQ-FTG-05 added (FIT-27 anti-tautology static scan —
mechanizes `golden-corpus-contract` REQ-GCC-05, QA-B2); FTG-01/FTG-02 note the
pre-merge RED-provability path via the REQ-GCC-12 skeleton record (gate-decoupling,
QA-minor); FTG-01 notes it is the WEAK determinism guard vs GCC-05's
regenerate-and-diff (QA-M-e). All V1 REQ-IDs preserved.

## Purpose

Pins the five fitness functions (FIT-24..28 — FIT-22/23 are already taken upstream:
`schematic-local-files`'s `fit-22-scaffold-leaf-rule.test.ts` and
`stage-6-release-shape`'s `fit-23-publish-workflow-guard.test.ts`, both on origin) that
guard the invariants this change's shared infra depends on.

## Requirements

### REQ-FTG-01: FIT-28 — Corpus Byte-Determinism

A fitness test MUST run the full non-engine-gated scenario set twice IN-PROCESS and
assert the resulting corpus content is byte-identical both times — guards against
non-determinism silently creeping into the walk/capture/render pipeline
(`golden-corpus-contract` REQ-GCC-04). This same-process double-run is deliberately
the FAST, WEAK guard; the STRONG guard is the out-of-band regenerate-and-diff flow
(REQ-GCC-05 — fresh process, fresh state). Before `schematic-local-files` merges,
FIT-28 runs (and is RED-provable) against the REQ-GCC-12 skeleton record alone.

#### Scenario REQ-FTG-01.1: FIT-28 fails on injected non-determinism [SDK]

- GIVEN a deliberately injected source of nondeterminism (e.g. an unsorted walk order,
  or a timestamp leaked into a record)
- WHEN FIT-28 runs
- THEN it fails, naming the scenario whose corpus differed between the two runs

### REQ-FTG-02: FIT-24 — Corpus Purity

A fitness test MUST scan every committed corpus file for binary magic-byte sequences,
absolute-path-shaped strings, and non-deterministic-field shapes (timestamps,
durations, uuids/nonces — `golden-corpus-contract` REQ-GCC-06), failing if any are
found. Pre-merge, FIT-24 is RED-provable against the REQ-GCC-12 skeleton record.

#### Scenario REQ-FTG-02.1: FIT-24 fails on a corpus file containing an absolute path [SDK]

- GIVEN a committed corpus file deliberately containing an absolute filesystem path
  string
- WHEN FIT-24 runs
- THEN it fails, naming the offending file and the matched string

### REQ-FTG-03: FIT-25 — Single Capture Path

A fitness test MUST import-scan the corpus writer, the report renderer, and
`test/e2e/author-emulation-scaffold.e2e.test.ts`, asserting all three resolve the SAME
capture module (`ir-transcript-capture` REQ-ITC-02) and that no second capture module
exists in the change's file tree.

#### Scenario REQ-FTG-03.1: FIT-25 fails if a second capture module is introduced [SDK]

- GIVEN a deliberately introduced second, parallel capture module
- WHEN FIT-25 runs
- THEN it fails, naming both capture module candidates

### REQ-FTG-04: FIT-26 — Report Hygiene + Every Row Cites a REQ-ID

A fitness test MUST assert (a) `.gitignore` contains the report output pattern
(`run-report` REQ-RPT-02/03 — `test/e2e/author-emulation/reports/`), (b) the report
filename derives from a single pinned constant/function rather than ad hoc string
literals scattered across the suite, and (c) every row in the `scenario-matrix` table
cites at least one `schematic-local-files` REQ-ID or an explicit owner boundary
(D1-D4) — a row without a citation fails this fitness check.

#### Scenario REQ-FTG-04.1: FIT-26 fails on an uncited matrix row [SDK]

- GIVEN a scenario-matrix row deliberately stripped of its REQ-ID/boundary citation
- WHEN FIT-26 runs
- THEN it fails, naming the uncited row

### REQ-FTG-05: FIT-27 — Anti-Tautology Static Scan (No Test-Reachable Corpus Writer)

A fitness test MUST statically verify that NO module reachable from the test-imported
graph (`test/e2e/`, `test/support/`, and their transitive test-side imports) performs
a write to the corpus directory (`test/e2e/author-emulation/corpus/`) — the mechanical
enforcement of `golden-corpus-contract` REQ-GCC-05's tautology guard. The maintainer
regeneration script MUST live OUTSIDE the test-imported graph (e.g. under `scripts/`),
MUST NOT be imported by any test file, and MUST NOT be runnable by CI's test command.
FIT-27 is RED-provable pre-merge against the skeleton-record writer path
(REQ-GCC-12).

#### Scenario REQ-FTG-05.1: FIT-27 fails when a test-reachable module writes the corpus [SDK]

- GIVEN a deliberately added corpus-directory write inside a `test/support/` module
- WHEN FIT-27 runs
- THEN it fails, naming the offending module and the write call site

#### Scenario REQ-FTG-05.2: Regen script is outside the test-imported graph [SDK]

- GIVEN the maintainer regeneration script
- WHEN the test-imported graph is resolved
- THEN the script is not part of it, and no test file imports it

### REQ-FTG-06: FIT-NEW-A — No Ceiling Regrowth

A fitness test MUST statically scan `src/**` and assert: (a) the literal string
`"collection.json"` appears in ZERO files; (b) no ancestor-walk idiom (a loop calling
`dirname` upward searching for a marker file) exists anywhere; (c) `RunContext`'s
`packageAnchors` field shape matches the FIT-04 `.d.ts` baseline exactly (single-field
`{packageDir}`) — bound to the SAME baseline artefact FIT-04 already maintains, not a
second, ad hoc runtime check. The scan's allowlist for the pre-existing, UNRELATED
`packageRootFor()` walk is SYMBOL-scoped —
`src/transport/single-instance-probe.ts#packageRootFor` specifically, not the whole
file — because that function is a structural TWIN of the banned ancestor-walk idiom; a
file-scoped allowlist would let any OTHER function added to that file regrow the banned
idiom undetected. (d) the scan's allowlist additionally covers `test/**` with an
EXPLICIT, per-symbol allowlist of any surviving marker-fabricating fixture helper — a
deliberate, reviewed entry, never invisible debt. (e) — SCOPED TO `openspec/specs/**`
ONLY: a repo-wide sweep asserting that, outside an explicit version-history marker (a
`(Previously: ...)` parenthetical or a `V{n} → V{n+1}` changelog line), zero live
mentions remain of the retired containment family's name, its REQ-ID prefix, or its
sole exclusive rejection-reason literal (the exact three-term pattern is pinned in
code, `test/support/src-invariant-scans.ts`'s `RETIRED_TERMS` constant, and narrated in
the now-retired containment family's own retirement history). This clause's real-tree
invocation ran ONCE, at this archive's spec-sync commit, and is a PERMANENT regression
thereafter — every subsequent change that touches `openspec/specs/**` must keep it
green. (f) the literal string
`"realpathSync"` and the literal string `"realpath"` appear in ZERO code or comment
lines anywhere under `src/scaffold/**` or `src/core/context.ts` — the sole exception is
the SAME symbol-scoped allowlist entry clause (a)/(c) already carry
(`src/transport/single-instance-probe.ts#packageRootFor`); the allowlist for this clause
is otherwise EMPTY. Rationale: this backs the cross-repo engine handoff's claim that
"the SDK no longer realpath-resolves sources" (`proposal.md` §Dependencies) with a
mechanical guard rather than an unverified assertion — plan-verify Judge A finding #5
noted this shipped hard gate previously had no signed REQ behind it.

#### Scenario REQ-FTG-06.1: FIT-NEW-A fails if `collection.json` or an ancestor walk regrows in `src/**` [preservation-pin]

- GIVEN a deliberately reintroduced `collection.json` literal or ancestor-walk loop
  under `src/**`, run against a FIXTURE file tree (the scanner is a pure function over
  an injectable file list, not a live mutation of the real `src/**`)
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the offending file

#### Scenario REQ-FTG-06.2: The symbol-scoped allowlist does not shadow a new offending symbol in the same file [preservation-pin]

- GIVEN a fixture mirroring `single-instance-probe.ts`'s shape, with the allowlisted
  `packageRootFor` symbol PLUS a second, deliberately reintroduced ancestor-walk
  function in the SAME file
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the second (non-allowlisted) function — proving the allowlist
  is symbol-scoped, not file-scoped

#### Scenario REQ-FTG-06.3: FIT-NEW-A fails if a `realpathSync`/`realpath` reference regrows outside the allowlisted symbol [preservation-pin]

- GIVEN a fixture file tree under `src/scaffold/**` (or mirroring `src/core/context.ts`)
  containing a deliberately reintroduced `realpathSync`/`realpath` reference — in code
  OR in a comment — OUTSIDE the allowlisted
  `src/transport/single-instance-probe.ts#packageRootFor` symbol, run against the SAME
  injectable fixture-file-list pure function REQ-FTG-08 already establishes as this
  family's pattern
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the offending file and line — the allowlisted
  `packageRootFor` symbol itself, present in the SAME fixture set, does NOT trigger a
  failure

#### Scenario REQ-FTG-06.4: The `openspec/specs/` sweep LOGIC fails on a live (non-historical) orphaned citation — fixture-pair, ships IN-CHANGE [preservation-pin]

- GIVEN a FIXTURE PAIR (never the real `openspec/specs/` tree in this in-suite
  scenario): fixture A mirrors `openspec/specs/` containing a LIVE (non-version-history)
  mention of the retired terms — i.e., OUTSIDE any `(Previously: ...)` or
  `V{n} → V{n+1}` marker; fixture B contains ONLY allowlisted version-history mentions of
  the same terms
- WHEN clause (e)'s sweep LOGIC runs against each fixture
- THEN fixture A fails, naming the offending file and line; fixture B does NOT fail —
  proving the logic credits the allowlist, not merely string-matching
- **Distinct from clause (e) itself**: this scenario tests the SWEEP'S LOGIC via
  fixtures; clause (e)'s own real-`openspec/specs/`-tree invocation is a SEPARATE test,
  run permanently going forward per this REQ's clause (e)

#### Scenario REQ-FTG-06.5: The real `openspec/specs/` tree is swept and stays clean [preservation-pin]

- GIVEN the real, post-archive-sync `openspec/specs/**` tree
- WHEN clause (e)'s sweep runs against it
- THEN zero live (non-version-history-marker) mentions of the retired terms are found —
  this is the permanent, real-tree counterpart to REQ-FTG-06.4's fixture-driven logic
  proof

### REQ-FTG-07: FIT-NEW-B — Closed-Union Reachability Over BOTH Minting Mechanisms

A fitness test MUST assert every surviving `AuthoringReason` member is mintable from
`src/**` through the UNION of two mechanisms: the `CODE_TO_REASON` value set
(`authoring-error.ts`) AND direct `AuthoringError` construction sites (the
`sourceRejection`-equivalent reason parameter union, plus literal `reason:` properties
at construction sites such as `classify-transport.ts`) — EXCLUDING, from the scan
itself, the `AuthoringReason` union type declaration and `originFor`'s switch arms
(both list every member BY DEFINITION; including them would make every member
vacuously "reachable" regardless of whether any real construction site mints it).
`CODE_TO_REASON` ALONE is insufficient — it maps only `EmitRejectionCode` to five
reasons and mints no `source-*` reason at all, the exact family this change touches;
defined via `CODE_TO_REASON` alone, this check would pass vacuously after the union
shrink.

#### Scenario REQ-FTG-07.1: FIT-NEW-B fails if a surviving reason is unreachable from either mechanism [preservation-pin]

- GIVEN a surviving `source-*` reason deliberately made unreachable (removed from both
  `CODE_TO_REASON` and every direct construction site, but still present in the union
  declaration and `originFor`'s switch — proving the scan does not credit those two
  excluded locations), run against a fixture module set
- WHEN FIT-NEW-B runs against that fixture
- THEN it fails, naming the unreachable reason

#### Scenario REQ-FTG-07.2: `CODE_TO_REASON`'s value set contains zero `source-*` reasons [preservation-pin]

- GIVEN `CODE_TO_REASON`'s value set (`authoring-error.ts`)
- WHEN scanned for any `source-*`-prefixed value
- THEN none is found — a concrete, executable assertion proving `CODE_TO_REASON` alone
  can never satisfy REQ-FTG-07 for this family of reasons

### REQ-FTG-08: FIT-NEW-C — Exactly One Lexical Predicate Implementation

A fitness test MUST statically scan `src/**` and assert that every occurrence of the
`..`-segment/absolute-path lexical rejection idiom (`ir-path-well-formedness`
REQ-IPF-01's predicate — segment-aware over `/` and `\`, checking for a `..` segment or
an absolute-looking path) resolves to a SINGLE file-and-function pair — never one
implementation per call site, never a second parallel predicate introduced for a
different verb. The scanner is exposed as a PURE function over an injectable
root/file-list, so both the passing case and its negative scenarios run against fixture
directories, never against a live-mutated copy of the real `src/**`.

#### Scenario REQ-FTG-08.1: FIT-NEW-C fails if a second lexical predicate implementation appears [preservation-pin]

- GIVEN a fixture file tree containing the real predicate PLUS a deliberately
  introduced second, parallel `../`/absolute-path check function implementing the same
  idiom
- WHEN FIT-NEW-C runs against that fixture
- THEN it fails, naming both predicate implementations (file + function for each)

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (regrowth/reachability guards for the retired containment mechanism) | REQ-FTG-06, REQ-FTG-07, REQ-FTG-08 | Yes |
