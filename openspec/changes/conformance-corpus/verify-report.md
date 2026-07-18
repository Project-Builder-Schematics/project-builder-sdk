# Verification Report

**Change**: conformance-corpus
**Mode**: final (Strict TDD)
**Spec version**: V3 SIGNED (35 REQs / 60 scenarios across 4 domains)
**Branch/range**: `feat/conformance-corpus`, `6db2f5e..45b7dae` (7 commits: S-000 `a497194`+`e28c7b6`, handoff-flip `c80fd7d`, S-001..S-004 `d134000`/`381c1a8`/`883c482`/`45b7dae`)

---

### Verdict: pass-with-followups

The corpus is internally consistent, well-formed, fail-closed, and byte-deterministic. Full
suite / typecheck / build all green; every whole-change invariant holds; the one-time PR-gate
checks (REQ-CCR-03/04) and the renormalize dry-check (REQ-CDT-02) — none of which the recurring
`bun test` suite exercises — were run directly and PASS. 35/35 REQs covered. Three non-blocking
followups carried (2 robustness gaps, 1 documentation-debt), all already surfaced in in-loop-3.

`adversarial_review: required` — triage L AND a fail-closed cross-repo contract corpus (the
engine consumes this as a submodule and treats every structural rule as a HARD failure).

---

### Completeness
| Metric | Value |
|---|---|
| Slices total | 5 (S-000..S-004) |
| Slices complete | 5 |
| Tasks total | 20 (S-001..S-004) + S-000 skeleton |
| Tasks complete | all `[x]` (apply-progress + in-loop-1/2/3) |

### Build & Tests Execution (run directly this pass — not trusted from apply-progress)
| Check | Result |
|---|---|
| Full suite (`bun test`, HEAD `45b7dae`) | **2033 pass / 0 fail**, 4379 expect() calls, 188 files, 44.4s |
| `bun run typecheck` (`tsc --noEmit`) | Clean (exit 0) |
| `bun run build` (`tsc -p tsconfig.build.json && codegen`) | Green (exit 0) |
| REQ-CFX-14.1 dist isolation | Clean — no `corpus.json`/`collection.json`/`manifest.json`/`factory.ts`/`m1-*`/`m2-*` under `dist/` |
| Determinism byte-oracle (CR / BOM / trailing-`\n` / UTF-8) over `conformance/**` | Clean, **reproducible across 2 passes** (CR=0 BOM=0 TRAILNL=0 NONUTF=0) |
| REQ-CCR-04.1 commit-atomicity gate (`conformance-pr-gate.ts pr2 6db2f5e`) | PASS — 7 commits, no orphan-listing commit |
| REQ-CCR-03.1 PR#1 scope (`git show e28c7b6:conformance/corpus.json`) | PASS — `fixtures === ["m1-vehicle"]` at PR#1 head |
| REQ-CDT-02 `git add --renormalize .` dry-check | PASS — only the pre-existing orchestrator-owned `.sdd/state/conformance-corpus.json` stages; zero corpus/tracked-file diff |
| REQ-CFX-02 single-create scan | PASS — sole `create()` site is `createRejectProbe` |

Coverage tooling: not configured in this repo (Bun) — reported clean, not a failure.
Live-app pass: N/A — no UI surface (static data corpus + structural validators).

### Adversarial Quality Gate (Step 11b)
**Stage A — code audit (pre-pr, GATING)**: no Bug / Architecture / MAJOR findings. The change
touches zero production `src/**` runtime code — it adds a root `conformance/` static data corpus,
a structural self-check (`test/fitness/fit-40*`, `test/support/conformance-*`), a one-time
PR-gate script, and repo-config (`.gitattributes`). Three minor followups below.

**Stage B — blind dual review**: `adversarial_review: required` (see verdict). Orchestrator runs
judgment-day blind before archive.

### Spec Compliance Matrix (35/35 REQs)
| Domain | REQs | Verifier | Result |
|---|---|---|---|
| conformance-corpus | CCR-01,02,05,06,07,08 | fit-40 blocks (+ negative companion) | ✅ COMPLIANT |
| conformance-corpus | CCR-03 (PR#1 scope), CCR-04 (commit-atomic) | `conformance-pr-gate.ts` — one-time gate, run this pass | ✅ COMPLIANT |
| conformance-fixtures | CFX-01,02,03,04,05,06,07,08,09,10,12,13,14 | fit-40 behavioral + structural blocks | ✅ COMPLIANT |
| conformance-fixtures | CFX-11 (honesty boundary) | README honesty section + no runner path in repo (declaration only) | ✅ COMPLIANT |
| conformance-self-check | CSC-01,02,03,04,05,06 | fit-40 is the named verifier; suite exit code is the fail-closed proof | ✅ COMPLIANT |
| corpus-determinism | CDT-01,03,04,05,06,07 | fit-40 REQ-CDT blocks (byte scans) | ✅ COMPLIANT |
| corpus-determinism | CDT-02 (renormalize) | `git add --renormalize .` — run this pass | ✅ COMPLIANT |

All 5 manifests match their spec tables byte-for-byte: outcome triples (`exitCode`/`emitRejectionCode`/`failedIndex`), transcripts (`callbacks[]`/`singleCommit`/`forbidDiscard`/`emitBeforeCommit`), and `writtenPaths` pins. Directive-level codes (`not-found`/`collision`) carry `failedIndex: 0`; the batch-level `unrepresentable` carries `failedIndex: null` — REQ-CFX-04.1/.2 hold across all 6 reject cases. `wire-create-reject-twin` frozen to the ADR-0064 emit-branch (exit 2 / `unrepresentable` / null / `[ir.emit, ir.discard]`).

### Coherence (Design ADRs 0063-0067)
| ADR | Decision | Followed? |
|---|---|---|
| 0063 | Root `conformance/` as new cross-repo static-contract layer | ✅ |
| 0064 | `wire-create-reject-twin` = exit 2 / `unrepresentable` / null (frozen) | ✅ (manifest + DO-NOT-COPY comment consistent) |
| 0065 | Per-case `factory` override | ✅ (generalized to all 4 twins — see W3 doc-debt) |
| 0066 | One fitness file + typecheck sweep (no tsconfig exclude) + corpus.json-derived inventory (two-checkpoint cadence) | ✅ |
| 0067 | `collection.json` single shared package-anchor marker | ✅ |

### TDD Evidence (Strict TDD)
Per-commit RED→GREEN confirmed at git-history level in in-loop-3 (each fixture's full artefact
set + its `fit-40` `describe` block land in the SAME commit). Triangulation gap from in-loop-1
closed by `fit-40-*.negative.test.ts` — proves every `violations` collector actually FIRES on
synthetic broken fixtures (in-memory + real `mkdtemp` trees), not merely stays silent on the one
well-formed live corpus. Assertion audit: clean — collect-`string[]`-and-`toEqual([])` idiom,
no tautologies, every violation names fixture id + case + rule.

### Issues Found
**CRITICAL**: None.
**WARNING** (non-blocking followups):
- **W1 — case-level `factory.export` existence unvalidated.** `checkFactoryModuleResolution`
  validates only the FIXTURE-level `factory.module` file; no validator checks that a case-level
  `factory.export` string (now used by 5/12 cases: `notFoundProbe`×2, `dirTargetProbe`,
  `collisionProbe`, `dirSourceProbe`, `createRejectProbe`) names a real export. All 5 verified
  correct by manual read — no live defect — but a future typo passes fit-40/typecheck silently
  and surfaces only engine-side. Not a spec violation (REQ-CSC-02.2 covers module resolution
  only). Recommend a fast-follow validator.
- **W2 — REQ-CFX-02 create-scan precision.** `test/fitness/fit-40*.test.ts:221-231` flags a case
  as create-authoring on (file-wide `create(` text match) AND (case export non-null). Correct for
  today's corpus (only the composition factory contains any `create(`), but a future non-create
  named export added to that same file would false-positive. Tighten to scan the specific
  exported function body before the corpus grows.

**SUGGESTION / documentation-debt**:
- **W3 — ADR-0065 scope prose.** The ADR is written for "the multi-behaviour composition fixture"
  only, yet the per-case `factory` mechanism it introduces is now depended on by 5/12 cases across
  all 4 `m2-*` fixtures. slices.md placed the engine-sign-off HARD GATE only at S-004, not S-001
  (the first actual consumer). De-risked in practice (executor re-verified sign-off before S-001)
  but under-scoped on paper. Amend ADR-0065's scope statement so the design record matches what
  shipped.

### Working-Tree Note (not a change defect)
During this pass a concurrent edit to `openspec/changes/conformance-corpus/design.md` appeared
(mtime 10:29:20, inside the build window) — a 2-line accurate `> **RESOLVED**: V3 RE-SIGNED`
annotation at the top-of-file gate note. A `tsc`/`bun build` cannot author markdown; this is an
external orchestrator edit, benign and correct (V3 was re-signed 2026-07-18). Left untouched
(reverting concurrent orchestrator work would be wrong). My own verify operations
(renormalize+reset, build) left zero footprint — the only working-tree entries attributable to
me are none; pre-existing entries are `.sdd/state/*` (orchestrator-owned) and the untracked
apply-progress / verify-in-loop-{1,2,3} artefacts.

### Verdict
**pass-with-followups** — corpus verified internally consistent, fail-closed, and deterministic;
35/35 REQs covered with real execution evidence; 3 non-blocking followups registered.
`adversarial_review: required`.
