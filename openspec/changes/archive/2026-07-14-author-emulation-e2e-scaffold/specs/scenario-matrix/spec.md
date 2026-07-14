# Scenario Matrix Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): matrix UNFROZEN 20 → 21 — row M-21 added
(cross-chunk atomicity, batch-cap REQ-05.1; QA-M-a) and M-09's stretched REQ-05
citation dropped; M-05 rewritten as genuine mixed-SUCCESS (REQ-CCL-01.1/01.2 +
REQ-BRC-01.1; the sniff-fail arm belongs to M-08 alone; REQ-FSC-06.2 citation dropped
— no collision-with-force row added; QA-M-b); M-01 drops the bare "in-scope boundary"
citation token (allowed vocabulary = signed REQ-ID or D1-D4 only) and gains the
templateFile-destination token assert; M-02 narrowed to the defaults/mandatory half
(field coverage lives in `author-emulation-generator` REQ-AEG-01.2); M-07 names the
observation point (harness I/O instrumentation, REQ-ATH-14.1); M-19 gains the
setup-materialization note; M-20 gains the delta-vs-upstream justification; batch-cap
citations qualified `batch-cap REQ-04.x`; REQ-SCM-03.1 hardened against
green-by-capture (hardcoded literal + RED-escalation policy; QA-M-c); REQ-SCM-04
gains the force-propagation and REQ-FSC-09.2 exclusion rationales; REQ-SCM-05 added
(rejection rows assert the attribution triple, QA-M-f). All V1 REQ-IDs preserved.

## Purpose

Pins the FIXED, ENUMERATED scenario matrix — the corpus's true size — so scope cannot
silently grow. Every row cites a signed `schematic-local-files` REQ-ID or an explicit
owner boundary (D1-D4, obs #941); a row without a citation is rejected.

## Requirements

### REQ-SCM-01: Fixed Enumerated Matrix, Count Pinned at 21

The scenario matrix MUST be exactly the 21 rows enumerated below — no more, no fewer —
at this spec version. Adding a row REQUIRES a spec unfreeze (V3+). Count history: the
owner's pre-propose estimate was ~17 (obs #941, D4); V1 pinned 20 (batch-cap family
decomposed into its three independently meaningful outcomes, batch-cap
REQ-04.1/04.2/04.3); V2 pins 21 (council-mandated M-21 restores the dropped batch-cap
REQ-05.1 coverage). Every row cites a signed REQ-ID or an owner boundary — the count
moves only through reviewed unfreezes like this one, never silently.

#### Scenario REQ-SCM-01.1: Matrix row count is exactly 21 [SDK]

- GIVEN the table below
- WHEN counted
- THEN it contains exactly 21 rows

| # | Scenario | Citation(s) | GWT (brief) |
|---|---|---|---|
| M-01 | Happy-path full generator | D2 (owner boundary); REQ-FSC-01.2; REQ-FEH-01.1; REQ-FEH-03.1 | GIVEN the author-emulation factory WHEN run THEN scaffold+copyIn+create(templateFile) all commit, and the create(templateFile) destination path's filename token appears verbatim in the emitted `pathTemplate` |
| M-02 | `ScaffoldArgs` defaults + mandatory-arg rejections | REQ-FSC-01.1; REQ-FSC-01.2; REQ-FSC-01.3 | GIVEN a defaults-only call and calls missing `from`/`to` WHEN scaffolded THEN defaults hold and both rejections fire (full 7-field coverage guarantee: REQ-AEG-01.2) |
| M-03 | Include/exclude, exclude wins on overlap | REQ-FSC-03.1 | GIVEN overlapping include/exclude WHEN scaffolded THEN excluded file is absent |
| M-04 | Rename remap (+ token + `.template` strip pipeline order) | REQ-FSC-05.1 | GIVEN a rename rule on an original source name WHEN scaffolded THEN pipeline order holds |
| M-05 | Mixed by-value/by-reference SUCCESS in ONE scaffold | REQ-CCL-01.1; REQ-CCL-01.2; REQ-BRC-01.1 | GIVEN one small text file and one binary file WHEN scaffolded THEN one `create` and one `copyIn` directive emit and commit in the same run, structurally distinguishable |
| M-06 | Binary asset classifies by-reference | REQ-CCL-01.2; REQ-BRC-01.2 | GIVEN a binary asset WHEN classified THEN by-reference, no bytes on the directive |
| M-07 | Oversized-by-stat file classifies by-reference, zero content reads | REQ-CCL-06.1; REQ-ATH-14.1 | GIVEN a file whose stat size alone exceeds budget WHEN classified THEN by-reference with zero content reads, observed via the harness I/O instrumentation (REQ-ATH-14) |
| M-08 | Binary `.template` in a scaffold walk fails loud | REQ-CCL-05.1 | GIVEN a scaffold walk enumerating a binary `.template` source WHEN scaffolded THEN fails loud, `invalid-input` |
| M-09 | Aggregate-over-cap chunking succeeds completely | batch-cap REQ-04.1 | GIVEN aggregate size over cap, no single group over WHEN scaffolded THEN completes, one directive per file |
| M-10 | Single group's own batch exceeds cap — still rejects | batch-cap REQ-04.2 | GIVEN one group's serialized batch alone exceeds cap WHEN flushed THEN rejects `changes-too-large` |
| M-11 | Exactly-at-cap passes; one-byte-over rejects | batch-cap REQ-04.3 | GIVEN two fixtures at/over the cap boundary WHEN flushed THEN at-cap passes, over rejects |
| M-12 | `templateFile` binary/oversized fails loud, never silently copies | REQ-FEH-02.1; REQ-FEH-02.2 | GIVEN a binary or oversized `templateFile` WHEN `create` is called THEN `invalid-input`, no directive |
| M-13 | Filters eliminate every entry — fail loud naming filters | REQ-FSC-04.2 | GIVEN filters leaving zero survivors WHEN scaffolded THEN fails loud naming include/exclude |
| M-14 | Empty source folder no-ops | REQ-FSC-04.1 | GIVEN a truly empty `from` (setup-materialized, REQ-AEG-07) WHEN scaffolded THEN zero directives, no error; corpus = empty-sequence success record |
| M-15 | Intra-scaffold destination collision — fail loud naming both sources | REQ-FSC-08.1 | GIVEN two sources collapsing to one destination WHEN scaffolded THEN fails loud, names both |
| M-16 | Traversal / absolute source path rejected | REQ-PRC-04.1; REQ-PRC-04.6 | GIVEN `../` and absolute source paths WHEN called THEN both reject, containment cited |
| M-17 | No-existence-oracle for out-of-ceiling paths | REQ-PRC-07.1 | GIVEN existing and non-existing out-of-ceiling targets WHEN rejected THEN identical `source-outside-package` shape |
| M-18 | Missing in-ceiling source surfaces `source-not-found` | REQ-BRC-06.1 | GIVEN an in-ceiling, non-existent source WHEN run via the harness THEN `AuthoringError` reason `source-not-found` |
| M-19 | Symlinked directory is skipped, not traversed | REQ-FSC-09.1 | GIVEN a symlinked directory (setup-materialized, REQ-AEG-07; skipped on platforms where symlink creation is unavailable, with the skip recorded) WHEN scaffolded THEN its contents are absent, no error |
| M-20 | `ContractFake` ↔ conformance-vehicle parity on THIS change's fixtures | REQ-ATH-16.1 | GIVEN this change's OWN by-reference fixture set (valid, missing-source, collision — richer than upstream ATH-16.1's minimal set; the delta is re-asserting parity on author-emulation-scale fixtures) WHEN run through both simulators THEN identical verdicts |
| M-21 | Cross-chunk atomicity — later flush rejects, nothing commits | batch-cap REQ-05.1 | GIVEN a scaffold spanning ≥2 flushes whose SECOND flush rejects WHEN run via `runFactoryForTest` THEN `result.tree` is empty (first chunk discarded) and `result.error` carries the attributed rejection |

### REQ-SCM-02: Engine-Gated Rows Are Non-Executing Corpus Notes, Never Matrix Rows

`REQ-BRC-08` (engine path-form/render hardening) and `REQ-PRC-06` (destination
containment post-render) MUST NOT appear as executing scenario-matrix rows — both are
`[SEAM] [ENGINE-GATED]` in their signed spec (no SDK-runnable assertion is possible).
They MUST instead be captured as literal entries in the `golden-corpus-contract`
coverage manifest's NOT-exercised ledger (REQ-GCC-08 checklist item 3) — documented,
never silently dropped.

#### Scenario REQ-SCM-02.1: Engine-gated REQs appear only as manifest notes [SDK]

- GIVEN the scenario matrix table and the coverage manifest
- WHEN searched for `REQ-BRC-08` and `REQ-PRC-06`
- THEN neither appears as a matrix row citation; both appear in the manifest's
  NOT-exercised ledger, named as engine-gated

### REQ-SCM-03: Chained Filename Tokens Exercised + D3 Upstream Gap Flagged

The chained-token scenario (extension of M-04's fixture surface) MUST assert the
emitted `pathTemplate` against the HARDCODED string literal
`{= name | singular | dasherize =}` written directly in the test source — NEVER
against the captured corpus (a capture-derived expectation would be green by
construction, hiding a non-chaining pipeline). If the landed REQ-FSC-05 pipeline does
NOT chain multi-filter tokens, this scenario goes RED and STAYS RED — the failure
escalates through the `PC-SPEC-FSC-TOKENS` pending-changes row, never a
weakened assertion. This change MUST register that row
(`openspec/pending-changes.md`) flagging that `folder-scaffold` REQ-FSC-05 only
specifies SINGLE-filter token translation (`__x@filter__` → `{= x | filter =}`),
leaving multi-filter chaining under-specified upstream (owner ruling D3, obs #941).
Registering the row is itself a verifiable deliverable, checked at
`sdd-verify --mode=final`.

#### Scenario REQ-SCM-03.1: Chained token asserted against a hardcoded literal; RED escalates [SDK]

- GIVEN a source filename `__name@singular@dasherize__.entity.ts`
- WHEN scaffolded with `options: { name: "Widgets" }`
- THEN the emitted `pathTemplate` is compared against the test-source-hardcoded
  literal `{= name | singular | dasherize =}` (never engine-rendered, never
  corpus-derived)
- AND if the pipeline does not chain, the scenario FAILS and the gap escalates via the
  `PC-SPEC-FSC-TOKENS` row in `openspec/pending-changes.md` — which must exist either
  way

### REQ-SCM-04: Exclusions — Unit-Redundant and Out-of-Scope Rows Never Appear

The matrix MUST NOT include: (a) unit-redundant classification edges already exercised
in `content-classification`'s own upstream unit suite (byte-level UTF-8 sniff
mutant-killers, tail-null detection); (b) rows for other mutation families
(`rename`/`move`/`delete`/`modify`/plain `copy`) or cross-family combinations;
(c) force-propagation rows — REQ-FSC-06.1/06.2 are unit-covered upstream and no
collision-with-force row is added here (deliberate exclusion, keeping the count at
21); (d) the walk entry-count bound — REQ-FSC-09.2 is excluded because its fixture is
CI-hostile at e2e scale (10,001 real files) and upstream already pins the bound branch
at unit level with an injected limit.

#### Scenario REQ-SCM-04.1: No row duplicates an upstream unit-level classification edge [SDK]

- GIVEN the 21-row matrix
- WHEN cross-checked against `content-classification`'s own unit-test REQ-IDs
  (REQ-CCL-01.3/.4/.5, REQ-CCL-02.2/.3, REQ-CCL-03.1/.2)
- THEN none of those byte-level mutant-killer REQ-IDs are cited as a matrix row's
  PRIMARY citation — the matrix exercises the scaffold-family INTEGRATION behavior
  those REQs feed into (e.g. M-05/M-06/M-07), not their own unit-level mutant kill

### REQ-SCM-05: Rejection Rows Assert the Attribution Triple

Every rejection-outcome row's e2e assertion MUST cover the full Stage-2 attribution
triple — `reason` (closed `AuthoringReason` value), `verb` (author verb, when
attributable), and primary package-relative `path` — matching the committed rejection
record's NORMATIVE content (`golden-corpus-contract` REQ-GCC-09). A rejection
assertion checking `reason` alone is incomplete.

#### Scenario REQ-SCM-05.1: A rejection row asserts reason, verb, and path [SDK]

- GIVEN matrix row M-15 (intra-scaffold collision)
- WHEN its rejection is asserted
- THEN the test checks reason (`invalid-input`), the attributed verb, and the primary
  package-relative path — not the reason string alone

## Cross-Cutting Notes (applies to the whole change)

- **Zombie tripwires** (state.yaml, binding): (1) capture/report code branching on any
  non-scaffold mutation family → out of scope, re-triage; (2) a scenario added to the
  matrix without a new REQ-ID/boundary citation → spec unfreeze required, never a
  silent addition.
- **Out of scope** (unchanged from proposal/triage): other mutation families and their
  combinations; the engine itself / real-wire / PC-PROTO-01; live registry, publish,
  public-package plan items; Stryker-style `src/` mutation testing;
  `dialect-modify`/ts-morph wiring; golden-idiom unification across
  `test/golden-ir/`/`test/dialects/typescript/golden/`; `dasherize`/`singularize`
  SDK-side helpers (filters stay engine-template-DSL territory, never implemented here).
- **Build gate**: `scaffold`/`copyIn`/`create({templateFile})` are confirmed ABSENT from
  this worktree's `src/` (verified via `origin/feat/schematic-local-files`, not yet
  merged to this worktree's base). Rows M-01 through M-21 are all BUILD-GATED on
  `schematic-local-files` merging; the infra spine (capture module, corpus/report
  renderer, FIT-24/27/28 via the REQ-GCC-12 skeleton record) is buildable NOW against
  the 6 existing wire ops + `runFactoryForTest` (V2 micro-unfreeze 1, owner-approved
  2026-07-13: wrap target corrected makeSpyClient → runFactoryForTest, see
  `ir-transcript-capture` REQ-ITC-01); `sdd-slice` splits accordingly, with
  apply-time re-verify against the landed API.

## Sensitive Areas Coverage

No sensitive areas newly introduced — this domain exercises (read-only, as a test
consumer) already-signed security REQs from `package-root-containment` and
`content-classification` (both flagged sensitive in their own specs); this change adds
no new sensitivity surface of its own.
