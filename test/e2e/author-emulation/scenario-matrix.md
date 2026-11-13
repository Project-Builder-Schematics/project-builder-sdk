# Author-emulation scenario matrix

One row per scenario the author-emulation e2e covers. Each row cites the requirement IDs or owner
boundary (D1-D4) it exercises; fit-26 fails on a row without a citation and checks the citations
against `corpus/coverage-manifest.md`.

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
| M-16 | Traversal / absolute source path rejected | `ir-path-well-formedness` REQ-IPF-01.1; REQ-IPF-01.2 | GIVEN `../` and absolute source paths WHEN called THEN both reject with reason `invalid-input`, the ruling-5 lexical screen cited (not containment — the containment family is retired) |
| M-17 | Missing package-local source surfaces `source-not-found` | `package-source-io-hygiene` REQ-PSH-02.1 | GIVEN a package-local, non-existent source (at `create({templateFile})` or `copyIn` — not scaffold, per REQ-PSH-02's carve-out) WHEN run via the harness THEN `AuthoringError` reason `source-not-found` |
| M-18 | Symlinked directory is skipped, not traversed | REQ-FSC-09.1 | GIVEN a symlinked directory (setup-materialized, REQ-AEG-07; skipped on platforms where symlink creation is unavailable, with the skip recorded) WHEN scaffolded THEN its contents are absent, no error |
| M-19 | `ContractFake` ↔ conformance-vehicle parity on THIS change's fixtures | REQ-ATH-16.1 | GIVEN this change's OWN by-reference fixture set (valid, missing-source, collision — richer than upstream ATH-16.1's minimal set; the delta is re-asserting parity on author-emulation-scale fixtures) WHEN run through both simulators THEN identical verdicts |
| M-20 | Cross-chunk atomicity — later flush rejects, nothing commits | batch-cap REQ-05.1 | GIVEN a scaffold spanning ≥2 flushes whose SECOND flush rejects WHEN run via `runFactoryForTest` THEN `result.tree` is empty (first chunk discarded) and `result.error` carries the attributed rejection |
