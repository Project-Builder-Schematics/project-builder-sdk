## Verify In-Loop Result

**Change**: author-emulation-e2e-scaffold
**Iteration**: 1/3 for S-003 (artefact N=5)
**Scope**: S-003 (scaffold matrix — generation & classification happy paths, 11 rows) + Boy Scout deviation `7896b9e`
**Mode**: in-loop (Strict TDD)
**Delta under review**: commits `7896b9e`, `1d6a67c`, `75f916b`, `11017a5`, `156c8a4`

---

### Verdict: NEEDS_FIX

S-003's matrix content is strong — all 11 rows land with byte-stable committed transcripts,
M-04's anti-green-by-capture literals are genuinely hardcoded in test source, M-09's R-G
contentDigest normalization is exactly as ruled, and both carried-to-final-relevant gaps
(embedTemplate boundary, ITC-01.2) close this slice. The Boy Scout commit fixed two REAL
false positives (proven by un-fixing), but its FIT-27 rescoping introduced a material
FALSE NEGATIVE: a variable-indirected corpus write — the natural shape of a self-heal —
now escapes the scan the old check caught. FIT-27 is the ONLY guard against corpus
self-healing (a self-heal makes the byte-compare pass by construction), so this is the
one blocking finding. LOCAL fix.

#### Real execution evidence (commands run, not trusted from apply claims)

| Command | Result |
|---|---|
| `bun test` (full suite) | **1139 pass / 0 fail**, 2272 expect() calls, 137 files |
| `bunx tsc --noEmit` | **clean**, exit 0 |
| `bun scripts/regen-corpus.ts` (fresh process, 12 scenarios) + `git status` corpus dir | **all 12 transcripts byte-identical** — strong GCC-05 determinism guard holds for every S-003 row |
| **Un-fix probe 1** — reverted FIT-24's plausibility filter | FIT-24 FAILS on the real committed m-04/m-01 corpus (the "// comment" template prose) → the false positive was REAL; restored, green |
| **Un-fix probe 2** — reverted FIT-27 to whole-file co-occurrence | FIT-27 FAILS on the e2e file (which legitimately reads CORPUS_DIR + writes reports) → the false positive was REAL; restored, green |
| **Evasion probe** — replicated the new FIT-27 scan logic exactly, fed it `writeFileSync(join(CORPUS_DIR, name), text)` with `CORPUS_DIR` holding the corpus literal | **NOT detected** by the new scan; the OLD whole-file scan WOULD have caught it → finding #1 |
| `git diff 469a7ed..HEAD --stat` + `git rev-list --objects … | cat-file` | zero `src/` rows across all 5 commits; **largest new blob 29 KB** (slices.md) — no multi-MiB blob anywhere in history (M-09 fills setup-materialized, corpus uses digests) |
| `git status` after full suite (reports written by the run) | clean beyond SDD state/verify artifacts — RPT-02 holds |
| Corpus dir listing | 14 entries = 12 transcripts + README + coverage-manifest (GCC-10 naming holds) |

#### Boy Scout deviation `7896b9e` — judgement

- **(a) Did not weaken FIT-24 materially**: the space/escaped-newline plausibility guard
  filters the prose false positive; `/etc/passwd`-shape red-proof still discriminates
  (in-suite). Residual narrowing: an absolute path CONTAINING a space (e.g.
  `/Users/John Smith/...`) would now be missed — see finding #3 (SUGGESTION).
- **(a) DID weaken FIT-27**: see finding #1 (NEEDS_FIX). The direction of the fix
  (call-site scoping) was correct and necessary — the regression demo proves whole-file
  co-occurrence false-positives on the legitimate e2e file — but the argument check
  matches only the LITERAL corpus path, and every realistic corpus write (including the
  regen script's own) builds its path through a variable.
- **(b) Truly test-only**: both files under `test/fitness/` — confirmed via `git show --stat`.
- **(c) Regression tests pin both false-positive shapes**: FIT-24's comment-opener +
  escaped-quote red-proof; FIT-27's write-elsewhere-while-referencing-corpus red-proof.
  Both verified failing under the un-fixed code (the same probes above flip them).
- The FRICTION ledger honestly logs both false positives AND the S-002
  `collection.json` authoring gap with dispositions — exemplary AEG-06 usage, and the
  `collection.json` fix itself (`{}` one-liner, presence-only marker) is a justified
  in-slice repair, not scope creep.

#### S-003 contract compliance (verified in source + execution)

- **11 rows / GWT match**: every scenario registered in `SCENARIOS` (R-E), driven by the
  registry loop, byte-compared against its committed transcript. Row-specific THEN
  clauses with dedicated in-test assertions: M-02 (both mandatory-arg rejections,
  `invalid-input`), M-04 (both hardcoded literals), M-07 (zero content reads via
  `instrumentHarnessIO` + real copyIn emitted), M-09 (chunking >1 batch, per-batch
  ≤4 MiB, exactly 6 ordered directives), AEG-01.2, AEG-02.1, RPT-03. Remaining rows'
  THEN clauses (M-03 exclude-wins, M-05 mixed pair, M-06 no-bytes-on-directive, M-14
  empty record, M-19 symlink contents absent, M-01 three-verb commit + verbatim token)
  are evidenced in their committed corpus records — reviewed: m-01 carries all three
  verbs and the verbatim `{= name =}.index.ts` / `{= name | singular | dasherize =}`
  tokens; m-14 is the empty-sequence success record (retires ITC-01.2 at runtime);
  m-09 embeds ONLY digest objects.
- **M-04 (SCM-03 anti-green-by-capture)**: ONE scenario, ONE corpus record, TWO
  assertions BOTH against hardcoded test-source literals
  (`m04-out/{= name | singular | dasherize =}.entity.ts` chained-token;
  `m04-out/{= name | dasherize =}.svc.ts` rename-order) — never corpus-derived; the
  RED-stays-RED escalation comment points at `PC-SPEC-FSC-TOKENS`. Fully conformant.
- **M-09 + R-G**: 6 × ~0.8 MiB setup-materialized fills → 2 chunks; committed record
  normalizes every `template` to `{contentDigest: {algo, bytes, sha256}}` (read the
  record); identical fills → identical digests (deterministic).
- **embedTemplate dedicated unit** (`test/support/corpus-format.test.ts`): inclusive
  boundary pinned (`<= 4096` embeds verbatim, `+1` digests), exact 3-key digest shape,
  determinism, byte-vs-string-length UTF-8 case. **Carried-to-final item #2 RETIRED.**
- **AEG-01.2**: `SCAFFOLD_CALL_ARGS` recorder collects the ACTUAL args passed (never a
  hand-maintained list); coverage assert proves all 7 fields non-default at least once
  (from/to everywhere; options M-01/03/04/05/06; include M-03/06; exclude M-03;
  rename M-04; force M-05).
- **AEG-02**: zero `modify` directives asserted across every captured matrix transcript.
- **RPT-03**: ≥2 distinct named reports coexist after the suite run; same-scenario
  re-run leaves exactly one file. First slice with ≥2 concurrent reports — satisfied.
- **M-20 parity**: dedicated suite drives the SAME committed binary asset through
  ContractFake AND the conformance vehicle across 4 verdict cases (valid,
  missing-source, collision, collision+force) — verdict-only comparison with an honest,
  documented reason for not comparing rejection shapes (FIT-10's structural port bar).
- **ITC-03**: swept all new test files — shape-only assertions (ops, pathTemplates with
  untranslated tokens, counts); no rendered output, no tree/disk bytes.
- **R-E/FIT-27 hygiene**: scenarios stay data-only; corpus written ONLY by the regen
  script; factory's scratch writes target tmpdir, torn down in `finally`.

#### Findings

| # | Category | Severity | File:Line | Detail |
|---|---|---|---|---|
| 1 | Fitness-guard weakening — FIT-27 misses variable-indirected corpus writes | NEEDS_FIX | `test/fitness/fit-27-anti-tautology-scan.test.ts:106-134` (`writesToCorpusDir`) | The call-site rescoping tests each write call's argument text against the LITERAL `author-emulation/corpus` — but the natural implementation of any corpus write (including `scripts/regen-corpus.ts` itself) is `writeFileSync(join(CORPUS_DIR, name), text)`, whose argument text contains only the variable name. Demonstrated concretely: fed the scan's exact logic a test-support-shaped self-heal module using that shape → NOT detected; the pre-fix whole-file scan caught it. Since a corpus self-heal makes the e2e byte-compare pass by construction, FIT-27(a) is the ONLY mechanical guard against the tautology GCC-05 bans — its blind spot is exactly the most realistic violation shape, and the current red-proof pins only the unrealistic inline-literal shape. Recommend: two-step check — flag a write call if its args match the corpus literal OR contain an identifier whose declaration (same file, post-strip) binds a string matching the corpus literal; add a variable-indirection red-proof. Keep the reports-dir exclusion. |
| 2 | Spec coverage — GCC-07.1's promised sorted-order discriminator absent | WARNING | design §4.6 row "GCC-07.1 … e2e M-01 (sorted-order assert)" | Design promised an explicit sorted-order assert on M-01. None exists: the byte-compare makes walk order NORMATIVE mechanically (any reorder fails the diff — the scenario's second half), but nothing proves the committed order IS `walk.ts`'s sorted order as opposed to accidental filesystem order (m-01's fixture files happen to sort the same way they'd enumerate on APFS). The GWT's GIVEN ("source folder enumerates in a non-alphabetical filesystem creation order") is not constructed anywhere. Non-blocking for this slice (the normativity half holds; the corpus was human-reviewed at regen) but the discriminator is owed — either an explicit sorted-vs-creation-order fixture case or a documented decision that the byte-compare + fixture review suffices. Route to the S-003 fix pass or verify-final. |
| 3 | FIT-24 plausibility guard narrows abs-path detection | SUGGESTION | `test/fitness/fit-24-corpus-purity.test.ts:47-56` | The space/`\n` heuristic un-flags any absolute path containing a space (`/Users/John Smith/...` — plausible on macOS). Root cause is the non-escape-aware regex; a targeted alternative: make the matcher escape-aware (`(?:[^"\\]|\\.)*`) and exclude only `//`-prefixed candidates (comment openers), which keeps space-containing paths detectable. Cosmetic-adjacent given upstream mints package-relative paths (R-F) and CI paths are space-free — but note it in the guard's comment if accepted as-is. |

#### Retirements & obligation updates

- **Carried-to-final #2 (embedTemplate digest branch) — RETIRED** (dedicated boundary unit, genuine and inclusive-boundary-correct).
- **ITC-01.2 (zero-emission record)** — satisfied at runtime via M-14 (empty-sequence committed success record through `captureRun`).
- **RPT-03.1** — satisfied (two concurrent named reports + re-run idempotence).
- **Carried-to-final #1 (TDD commit-order audit)** — unchanged, pattern repeats in this batch (`1d6a67c` fixtures/factory before `75f916b` tests); still owed at final.

Routing: **LOCAL** (Executor SDD-light — strengthen FIT-27's arg check + red-proof; finding #2 either a small fixture case or a recorded decision; #3 optional)
Orchestrator action: re-invoke `/build` (SDD-light) targeting finding #1 (blocking), #2 (decide or fix), then re-verify. S-003 iteration 1 of 3 used.

---

### Spec Compliance Matrix (S-003 scope)

| Requirement | Test | Result |
|---|---|---|
| M-01 GWT (3 verbs + verbatim token) | corpus byte-compare + record review | ✅ COMPLIANT |
| M-02 GWT (defaults + 2 rejections) | corpus + expectReasonAsync ×2 | ✅ COMPLIANT |
| M-03 GWT (exclude wins) | corpus record (README absent) | ✅ COMPLIANT |
| M-04 GWT / REQ-FSC-05.1 + REQ-SCM-03.1 | 2 hardcoded-literal asserts in test source | ✅ COMPLIANT |
| M-05 GWT (mixed pair) | corpus record (create + copyIn) | ✅ COMPLIANT |
| M-06 GWT (binary by-ref, no bytes) | corpus record (copyIn, no content field) | ✅ COMPLIANT |
| M-07 GWT / CCL-06.1 + ATH-14.1 | zero-content-read instrumented assert + copyIn | ✅ COMPLIANT |
| M-09 GWT / batch-cap REQ-04.1 + R-G | chunking asserts + digest-normalized record | ✅ COMPLIANT |
| M-14 GWT / FSC-04.1 + ITC-01.2 | empty-sequence success record via captureRun | ✅ COMPLIANT |
| M-19 GWT / FSC-09.1 | corpus record (only a.ts) + skip-recorded fallback | ✅ COMPLIANT |
| M-20 GWT / ATH-16.1 | 4-case verdict parity suite | ✅ COMPLIANT |
| AEG-01.2 (7 fields) | SCAFFOLD_CALL_ARGS coverage assert | ✅ COMPLIANT |
| AEG-02.1 (zero modify) | per-scenario transcript filter assert | ✅ COMPLIANT |
| RPT-03.1 | concurrent + re-run report asserts | ✅ COMPLIANT |
| GCC-07.1 (sorted-order discriminator) | byte-compare (implicit) only | ⚠️ PARTIAL (finding #2) |
| FTG-05 (FIT-27 strength post-fix) | scan + red-proofs | ⚠️ PARTIAL (finding #1 — indirection blind spot) |

**Compliance summary**: 14/16 fully compliant; 2 partial (FIT-27 strength, GCC-07.1 discriminator).

### Strict TDD (in-loop audit)

- Banned assertion patterns: swept all new test files — clean (no bare toBeDefined/toBeTruthy/objectContaining-only/snapshot).
- Triangulation: M-04 two distinct assertions; embedTemplate 4 cases incl. boundary + UTF-8; M-20 four verdict cases; M-02 defaults + 2 rejections. Strong.
- Regression: 1139/1139; all 12 corpus files byte-stable under fresh regen.
- Commit-order: feat-before-test pattern repeats — carried to final (item #1), no new signal.

### Carried-to-final list (updated)

| # | Item | Origin | Owed at |
|---|---|---|---|
| 1 | TDD commit-order audit (feat-before-test committed history, all slices) | verify-in-loop-1 #3 | `sdd-verify --mode=final` |
| ~~2~~ | ~~embedTemplate digest branch~~ — **RETIRED** (dedicated boundary unit landed in S-003) | verify-in-loop-1 #4 | — |
| 3 | GCC-07.1 sorted-order discriminator (finding #2) — IF the executor records a decision instead of adding the fixture case | verify-in-loop-5 #2 | S-003 fix pass or `sdd-verify --mode=final` |
| 4 | FIT-24 space-path narrowing (finding #3) — informational unless accepted-as-is without a comment | verify-in-loop-5 #3 | verify-final (informational) |

### Artifacts Persisted
| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-5 | hybrid | engram `sdd/author-emulation-e2e-scaffold/verify-in-loop-5` + `openspec/changes/author-emulation-e2e-scaffold/verify-in-loop-5.md` |

### Risks
- Finding #1 is a guard-strength regression, not a present defect (no self-heal exists today — verified by the reachability scan and my own read of every corpus-dir reference). But S-004 adds 10 more corpus records and more e2e write activity; the blind spot should close before that surface grows.

### Next Recommended
`sdd-apply` (SDD-light) targeting finding #1 (blocking) + a decision-or-fix on #2, then `sdd-verify --mode=in-loop` S-003 iteration 2 (artefact N=6).

### Skill Resolution
none (greenfield project — skill registry empty)
