# Verification Report

**Change**: schematic-local-files
**Mode**: final (Strict TDD)
**Spec version**: V3 (signed) — 48 REQs / 81 scenarios across 10 delta domains
**Branch**: feat/schematic-local-files (32 commits, S-000..S-005 + 17-item /simplify pass)
**Evaluated at**: 2026-07-13
**Verdict**: **pass-with-followups**

One-line: SDK-side of the schematic-local-files capability is complete, spec-compliant, and
its L-classified path-traversal containment boundary genuinely holds under adversarial probing;
the behavior-neutral /simplify pass (classifyTransport gate-merge + chunked-flush counter) is
verified equivalent; three non-blocking followups (all pre-existing or traceability) carry to archive.

---

## Completeness
| Metric | Value |
|---|---|
| Slices total | 6 (S-000..S-005) |
| Slices complete | 6 |
| In-loop verifies | 7 (all resolved to PASS; iters 1 & 4 were NEEDS_FIX, fixed) |
| Tasks complete | All checked in apply-progress.md |

## Build & Tests Execution (real, this evaluation)
| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | ✅ 1006 pass / 0 fail / 0 skip — 1958 expect() calls, 121 files, 7.84s |
| Typecheck | `tsc --noEmit` | ✅ exit 0, clean |
| Fitness (FIT-04 .d.ts + FIT-14 pkg-surface) | `bun test test/fitness` | ✅ 238 pass / 0 fail, 22 files |
| permissive-proof | `tsc -p tsconfig.permissive-proof.json` | ⚠️ 1 error `test/types/permissive-proof.ts(35,3) TS2578` — **CONFIRMED pre-existing, byte-identical on main 04c141e** (ran in a clean worktree) — NOT this change's defect |

## Simplify-Delta Scrutiny (32e52e2..HEAD — never re-verified by any prior evaluator)
| Item | Finding |
|---|---|
| Test-count equivalence | Ran the suite at 32e52e2 (pre-simplify) in a clean worktree: **1006 pass / 0 fail** — identical to HEAD. Behavior-neutral confirmed at suite level. |
| classifyTransport gate-engine merge (4def009) | `readTemplateFile` now delegates to `classifyTransport` with a `failMessages` render-request override; overload signature guarantees the failMessages path returns `{verdict:"by-value", content}`. Containment runs BEFORE any read (REQ-PRC-08). Verified correct + item (a) closure held. |
| Chunked-flush counter (3f6e44d) | Replaced O(k²) whole-batch re-serialization with a running counter (`pendingSize += directiveSize + comma`). **Manually verified byte-identical** to re-serialization: JSON array bytes are additive (envelope + Σ element bytes + (n−1) commas); seed/reset/first-element/comma accounting all check out. The fake's own emit cap remains the sole authority (ADR-0019). |

## Adversarial Quality Gate (Step 11b)
**Code audit (pre-pr mode)** — full `src` diff (14 files, +1241/−24) vs signed spec: **Clean, no gating findings.**
- No untyped casts (`as any/never/unknown`), no `@ts-ignore/@ts-expect-error`, no `eslint-disable` introduced.
- No TODO/FIXME/deferred markers. No stray `console.*` (only doc-comment examples).
- Magic numbers are named constants: `DEFAULT_WALK_ENTRY_BOUND = 10_000`, `BATCH_CAP_BYTES = 4*1024*1024`.
- **Scope**: all 14 changed `src` files are in design's File-Changes table; `session.ts` correctly untouched (design pins it read-only). No scope creep.
- ADRs 0043-0046 honored (dual-anchor containment, leaf module, ceiling seed); no contradiction.

**Behavioral spot-probes (evaluator-constructed, real disk + real symlinks on the containment seam)**
- Unit `validateSourceContainment` — **11/11 pass**: literal `../` traversal → `source-outside-package`; deep `../../../etc/passwd` → outside (no read); absolute path → outside; symlink-inside-pointing-out → outside (realpath); broken-symlink-target-outside → outside (no existence oracle); broken-symlink-target-inside → not-found; missing → not-found; directory → not-regular-file; sibling-prefix `/pkg-evil` NOT admitted (segment-aware ceiling kills bare startsWith).
- E2E `readTemplateFile` through the real factory — **2/2 traversal cases contained** (`source-outside-package` for `../secret` and deep `/etc/passwd`); item (a) confirmed closed end-to-end post-simplify. (A 3rd probe's "happy path" failed only on my minimal fixture tripping the fake's `unrepresentable-content` rule — a fixture artifact, not a read/containment defect; the FEH-01.1 happy path passes in the change's own e2e suite, 23/23.)

**Live-app pass**: N/A — no UI surface (library/SDK change).
**Adversarial review (judgment-day)**: **required** — triage = L AND sensitive area (new engine-read-from-disk trust boundary / path-traversal containment).

## Spec Compliance Matrix (summary)
| Bucket | Count | Result |
|---|---|---|
| REQs total | 48 | — |
| REQs with direct/behavioral test evidence | 46 | ✅ COMPLIANT |
| REQs that are engine-gated seam contracts (no SDK test by design) | 2 (REQ-BRC-08, REQ-PRC-06) | ✅ Correctly deferred — `[SEAM][ENGINE-GATED]`, archive-gated per Q23, pending-changes rows present & match design §Seam Contract |
| Scenarios total | 81 | ✅ all backed by passing tests or documented seam deferral |

Detail on the 4 REQs whose literal ID does not appear in a test name:
- **REQ-BRC-02** `[SEAM]` — SDK half ("no SDK-resolved root value on the wire as authoritative") satisfied structurally: `directive-factory.copyIn` emits only `{op, from, to, force?}` — no packageRoot/ceiling/contents; asserted via copyin-fidelity emitted-directive test. Engine re-derivation half → pending-changes row (present).
- **REQ-BRC-03** `[SDK]` — "existing create IR byte-identical pre/post" covered by the unchanged, still-green golden-IR byte-string tests (`test/golden-ir/`).
- **REQ-BRC-08 / REQ-PRC-06** `[ENGINE-GATED]` — spec itself declares them "not SDK-runnable tests"; registered as archive-gated engine obligations in `openspec/pending-changes.md` (verify-in-loop-7 cross-checked wording verbatim against design §Seam Contract).

## Strict TDD (final audit)
| Dimension | Finding |
|---|---|
| Cycle adherence | Audited per-slice IN-LOOP (Strict TDD active; 7 in-loop reports; iters 1 & 4 NEEDS_FIX driven by TDD-evidence corrections, fixed). apply-progress carries 37 RED/GREEN/REFACTOR evidence rows. Commits are per-slice (not per-cycle) → git-history Method 1 weaker; pairing (Method 2) + in-loop delta audits are the authoritative record. **No anti-TDD (test-after-impl) at slice granularity.** |
| Assertion quality | Shared helpers extracted in /simplify (`expectAuthoringReason`, `rejectedRun`, IO instrumentation) PRESERVE strong assertions — instanceof + closed-`reason` enum + `origin`, pass-through (never disabling) instrumentation. No tautologies, no smoke-only, no banned patterns found. |
| Triangulation | Classification (CCL-01..06) and containment (PRC-01..08) each carry multi-case boundary coverage (budget-boundary inclusive-fit, sibling-prefix, tail-null >64KB, broken-symlink two shapes). No single-case conditional logic. |
| Mutation testing | Not configured in sdd-init — skipped cleanly. Spec authors wrote explicit mutant-killing scenarios (e.g. CCL-01.3 null-scan-only mutant, CCL-01.4 ASCII-only mutant, PRC-04.5 bare-startsWith mutant). |
| REQ-ID coverage | 48/48 accounted (46 tested, 2 engine-gated-deferred). No req-coverage-gap halt. |

## Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| ADR-0043 by-reference wire shape (new `copyIn` op mirroring `copy`) | ✅ | anchor pin S2 (`from` rel to packageDir) honored |
| ADR-0044 scaffold expansion leaf module | ✅ | single fan-out owner in expander.ts; commons stays fs-blind (FIT-01) |
| ADR-0045 package-read containment boundary | ✅ | dual-anchor, realpath, segment-aware |
| ADR-0046 RunContext package-root ceiling | ✅ | seeded once pre-als.run; not re-derived per call (REQ-PRC-02) |

## In-Loop History
| Iter | Verdict | Notes |
|---|---|---|
| 1 | NEEDS_FIX | S-002/S-004 TDD evidence + findings |
| 2 | PASS | S-002/S-004 |
| 3 | PASS | S-003 |
| 4 | NEEDS_FIX | broken-symlink realpath CRITICAL (macOS /var vs /private/var) — fixed 99b1c48 |
| 5,6,7 | PASS | S-005 + final apply / baseline regen |

## Issues Found
**CRITICAL**: None.
**WARNING**: None blocking.
**SUGGESTION / Followups** (→ archive registers in project/pending-changes):
1. `typecheck:permissive-proof` fails 1x (`permissive-proof.ts:35 TS2578` unused `@ts-expect-error`) — **pre-existing on main, not this change**; register as a standalone project pending item, do not attribute here.
2. Traceability nit: REQ-BRC-02.1 and REQ-BRC-03.1 have behavioral coverage but no literal REQ-ID in the covering test name (the ID-in-name convention used elsewhere isn't applied to these two) — optional tidy, zero functional risk.
3. Carried advisory (verify-in-loop-7): the FIT-04 .d.ts baseline regen swept pre-existing JSDoc drift originating from another change — informational; confirm at archive it introduced no schematic-local-files surface change.

## Engine-Obligation Seam Rows (archive gate)
`openspec/pending-changes.md` § "From schematic-local-files (2026-07-13)" — 3 rows present, owner=engine repo, cross-repo flag (with PC-PROTO-01), all archive-gated per Q23:
- **BRC-02** engine ceiling re-derivation + TOCTOU closure
- **BRC-08** non-canonical path-form rejection + single-pass literal-token render
- **PRC-06** post-render destination containment

Content matches design §Seam Contract verbatim (verify-in-loop-7 confirmed). Owner sign-off happens AT the archive gate, not here.

## Steward Reckoning Note (for orchestrator)
Cross-repo caveat stands (triage risk #1): the engine apply pass does not yet exist (PC-PROTO-01 unresolved), so "green tests + fake/conformance parity" is NOT "the engine copies files." north-star.md's evidence-boundary honesty commitment (REQ-BRC-04: no test asserts by-reference bytes on disk/tree) is enforced by a production-wide scan test — the SDK deliberately proves emission, never engine effect. Steward reckoning must judge the SDK half on its own contract, not mistake it for end-to-end delivery.

## Envelope
- **status**: ok
- **verdict**: pass-with-followups
- **adversarial_review**: required (L + sensitive path-traversal/code-execution boundary)
- **next_recommended**: judgment-day (blind dual review) → sdd-steward reckoning → sdd-archive
- **skill_resolution**: injected
