# Plan Verify Result

**Change**: modify-e2e-extensible
**Iteration**: 2/3
**Mode**: plan
**Write mode**: n/a — ticket bodies not composed (spec_source: internal)

---

## Verdict: gaps

Judge A: **no findings** (problem-fit affirmed incl. the ruled new-dialect proof binding; in_scope 2/2 covered; zero out_of_scope excess). Trajectory: iteration 1 had 1 observation → now clean.
Judge B: **not ready** — 3 technical questions (down from 9). Everything else verified executable against the codebase (reflection mechanism, DMR targets, executeRow isolation, shapes, paths, allow-list all check out).

| # | Category | Description | Suggested route |
|---|---|---|---|
| 1 | question-technical | Seed-bytes provenance: DCS-04 forbids hand-authored golden bytes, but the mutate-only `modifyFactory` cannot synthesize its own seed; the regen script has no specified source-of-truth for the non-empty seed. | sdd-design pin: seeds are authored INPUT constants embedded in the regen script (mirroring `regen-corpus.ts` `scenario.input`); regen writes seed verbatim + derives expected by running the factory; DCS-04's ban applies to on-disk byte authoring, sanctioned source = the regen constant. Then slices inline. |
| 2 | question-technical | Symlink-aware containment vs "before disk touch": lstat/realpath are themselves fs calls; exact policy + timing undefined for the S-000 validator and S-004 negatives. | sdd-design pin: two-stage — (a) lexical checks (reject `..`, absolute, backslash) with zero fs calls; (b) metadata-only validation (lstat each component, reject symlinks; realpath-containment under realpath(root)) — metadata reads permitted, CONTENT read/write only after both stages pass. Then slices inline exact messages/timing. |
| 3 | question-technical | Import-guard enforcement target: S-004 exercises the guard only against synthetic fixture negatives; no slice wires it over the REAL seam modules (table/factory/harness), leaving DCS-06/07's purpose unenforced. | sdd-design pin: the guard runs as a standing fitness assertion over the real seam module set (home: fit-42 positive test file or its own describe), fixtures remain the negative proof; real modules authored to pass the §G positive list from S-000. Then slices inline. |

Minor (fold into slice rev 3): dangling `F2/F3/F4/F6/F7` labels (doc only defines §A–H) — renumber; state the TS row's `seedPath` value explicitly ("a.ts").

Routing: plan-gaps
Orchestrator action: sdd-design pins 1-3 (design V4), sdd-slice rev 3 inlines, re-run both blind judges (iteration 3 of 3 — final before owner escalation).
