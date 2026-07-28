# Delta for Scenario Matrix

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 finding F1): adds a Sensitive Areas Coverage Amendment —
the main family spec's Sensitive Areas Coverage section cites the now-retired
`package-root-containment` by name as an exercised-security-REQ family; re-pointed to
its two successor families.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): M-17's title drops
"in-ceiling" (retitled "Missing package-local source"); M-16's GWT explicitly names
reason `invalid-input`; the renumbering note now records that the renumbered M-17's GWT
text ALSO changed (dropped "in-ceiling" framing to match its citation moving to
`package-source-io-hygiene` REQ-PSH-02), not merely that rows shifted position;
REQ-SCM-01 now says a row may be added OR REMOVED only via a reviewed spec unfreeze —
this change is itself an example of a reviewed removal.

## MODIFIED Requirements

### REQ-SCM-01: Fixed Enumerated Matrix, Count Pinned at 20

The scenario matrix MUST be exactly the 20 rows enumerated below — no more, no fewer —
at this spec version. Adding OR REMOVING a row REQUIRES a spec unfreeze (V3+). Every row
cites a signed REQ-ID or an owner boundary — the count moves only through reviewed
unfreezes, never silently.

(Previously: V2 [of the signed spec] pinned 21 rows. `inline-collection-marker` DELETES
row M-17 — its citation, `package-root-containment` REQ-PRC-07.1 (no-existence-oracle
for out-of-ceiling paths), is retired with no successor: the in-ceiling/out-of-ceiling
distinction it guarded no longer exists. Row M-16 is RETAINED and re-cited — its
behaviour (`../` and absolute source paths both reject) is precisely what
`ir-path-well-formedness` REQ-IPF-01 now mandates; only its citation and rationale
change. Row M-18 (renumbered to M-17) keeps its cited REQ-ID but its GWT text is also
reworded — see the renumbering note below. Count: 21 → 20. V1 of this delta stated only
"adding a row requires unfreeze"; V2 states the rule symmetrically for removal too,
since THIS delta is itself a reviewed removal.)

#### Scenario REQ-SCM-01.1: Matrix row count is exactly 20 [red-today]

- GIVEN the table below
- WHEN counted
- THEN it contains exactly 20 rows

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
| M-16 | Traversal / absolute source path rejected | `ir-path-well-formedness` REQ-IPF-01.1; REQ-IPF-01.2 | GIVEN `../` and absolute source paths WHEN called THEN both reject with reason `invalid-input`, the ruling-5 lexical screen cited (not containment — `package-root-containment` retired) |
| M-17 | Missing package-local source surfaces `source-not-found` | `package-source-io-hygiene` REQ-PSH-02.1 | GIVEN a package-local, non-existent source (at `create({templateFile})` or `copyIn` — not scaffold, per REQ-PSH-02's carve-out) WHEN run via the harness THEN `AuthoringError` reason `source-not-found` |
| M-18 | Symlinked directory is skipped, not traversed | REQ-FSC-09.1 | GIVEN a symlinked directory (setup-materialized, REQ-AEG-07; skipped on platforms where symlink creation is unavailable, with the skip recorded) WHEN scaffolded THEN its contents are absent, no error |
| M-19 | `ContractFake` ↔ conformance-vehicle parity on THIS change's fixtures | REQ-ATH-16.1 | GIVEN this change's OWN by-reference fixture set (valid, missing-source, collision — richer than upstream ATH-16.1's minimal set; the delta is re-asserting parity on author-emulation-scale fixtures) WHEN run through both simulators THEN identical verdicts |
| M-20 | Cross-chunk atomicity — later flush rejects, nothing commits | batch-cap REQ-05.1 | GIVEN a scaffold spanning ≥2 flushes whose SECOND flush rejects WHEN run via `runFactoryForTest` THEN `result.tree` is empty (first chunk discarded) and `result.error` carries the attributed rejection |

(Renumbering note: the retired M-17 "no-existence-oracle" row is deleted outright — the
former M-18/M-19/M-20/M-21 shift up to M-17/M-18/M-19/M-20 respectively. This is NOT a
pure position renumbering: the renumbered M-17 (formerly M-18, "Missing in-ceiling
source surfaces `source-not-found`") also has its CITATION changed from
`by-reference-copy-wire` REQ-BRC-06.1 to `package-source-io-hygiene` REQ-PSH-02.1 (the
new owning REQ for the primary, non-TOCTOU missing-source scenario) and its GWT text
REWORDED to drop "in-ceiling" and to name the carve-out (create/copyIn only, not
scaffold) — matching the M-17 title fix above. M-18/M-19/M-20 (formerly M-19/M-20/M-21)
carry their ORIGINAL content and citations unchanged.)

### REQ-SCM-02: Engine-Gated Rows Are Non-Executing Corpus Notes, Never Matrix Rows

`REQ-BRC-08` (engine path-form/render hardening) MUST NOT appear as an executing
scenario-matrix row — it is `[SEAM] [ENGINE-GATED]` in its signed spec (no
SDK-runnable assertion is possible). It MUST instead be captured as a literal entry in
the `golden-corpus-contract` coverage manifest's NOT-exercised ledger (REQ-GCC-08
checklist item 3) — documented, never silently dropped.

(Previously: this REQ also named `package-root-containment` REQ-PRC-06 alongside
REQ-BRC-08 as an engine-gated citation that must never appear as a matrix row.
`package-root-containment` is retired wholesale and REQ-PRC-06 has no successor REQ —
the SDK-side destination guard it partly described is `ir-path-well-formedness`
REQ-IPF-02, which IS an executing, SDK-testable requirement (REQ-IPF-02.1 is already a
proper matrix-eligible scenario, not engine-gated) and therefore does not belong in this
REQ's engine-gated exclusion list. Post-render destination containment remains solely
`by-reference-copy-wire` REQ-BRC-08's obligation. See the companion
`golden-corpus-contract` delta, which drops the SAME `REQ-PRC-06` literal from its own
NOT-exercised ledger checklist.)

#### Scenario REQ-SCM-02.1: The engine-gated REQ appears only as a manifest note [red-today]

- GIVEN the scenario matrix table and the coverage manifest
- WHEN searched for `REQ-BRC-08`
- THEN it does not appear as a matrix row citation; it appears in the manifest's
  NOT-exercised ledger, named as engine-gated

## Sensitive Areas Coverage Amendment

The main family spec's own "Sensitive Areas Coverage" section states: "this domain
exercises (read-only, as a test consumer) already-signed security REQs from
`package-root-containment` and `content-classification`." `package-root-containment` is
retired wholesale. At archive-sync, this sentence MUST be re-pointed to the two
successor families this matrix's rows now actually cite: "already-signed security REQs
from `package-source-io-hygiene`, `ir-path-well-formedness`, and `content-classification`"
— `content-classification`'s citation is unaffected and stays as-is.

## Sensitive Areas Coverage

No sensitive areas newly introduced — unchanged from the signed spec.
