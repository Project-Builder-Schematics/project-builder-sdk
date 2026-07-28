## Verify In-Loop Result

**Change**: inline-collection-marker
**Iteration**: 6/3 (cumulative slice-verify count — S-000=1, S-001=2, S-002=3, S-003=4, S-004=5, S-005=6; no single slice required more than one fix-loop pass, so the 3-in-loop-retry escalation rule was never triggered)
**Scope**: slice:S-005 (regrowth/reachability guards fit-43/44/45, ADR-0077, release vehicle — CHANGELOG/SECURITY.md/docs)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 10/10 (S-005.1–S-005.10, `slices.md` all `[x]`; S-006 remains `[ ]`, out of this scope by design)
- Affected tests passed: full suite (2398 pass / 0 fail, two independent back-to-back uncontended runs, byte-identical) + isolated `fit-43`/`fit-44`/`fit-45` (21 pass / 39 expect) + `security-authoring-guard.test.ts` (23 pass) + `changelog-release-vehicle-guard.test.ts` (8 pass) + `walk.test.ts` (11 pass) — all match apply-progress's claimed counts exactly
- Spec compliance for scope: REQ-FTG-06/.1-.4, REQ-FTG-07/.1/.2, REQ-FTG-08/.1, REQ-PSH-05/.1, REQ-MFB-02/.1 all covered, with real discrimination proven by fault injection (see Per-Dimension Verdicts)
- Assertion audit: clean, no banned patterns in the delta test files
- `tsc --noEmit`: clean, zero errors

Orchestrator action: exit loop, proceed to S-006 (final sweep + dead-test deletion), then `/evaluate` (mode=final) before archive.

---

### Per-Dimension Verdicts

| Dimension | Verdict | Evidence |
|---|---|---|
| S-005.1/.2 — `src-invariant-scans.ts` + fit-43 clauses (a)-(f) | ✅ PASS, empirically re-verified non-vacuous | Ran the 3 new fitness files (21 pass/39 expect, matches claim). Fault-injected against the REAL tree and confirmed each catches the regression, then restored (`git status` clean after each): clause (a) — reintroduced literal `"collection.json"` into `context.ts` → caught, exact file path named; clause (f) — reintroduced `realpath` literal into `path-guards.ts` → caught, exact file+line named. Clause (e) confirmed FIXTURE-PAIR ONLY: `findOrphanedRetiredCitations` is called exclusively against `test/fixtures/red/src-invariant-scans/openspec-sweep/{live-hit,allowlist-only}.md` in the test file — never against the real `openspec/specs/` tree; live-hit fixture fails (flags the orphaned citation), allowlist-only fixture passes (credits the version-history marker), proving the sweep logic discriminates rather than string-matching blind. The real-tree run is correctly deferred to archive-sync (owned by `sdd-archive`/`package-root-containment`'s post-archive-sync criterion) — confirmed by absence of any such invocation in the test file or elsewhere in the diff. |
| S-005.3 — fit-44 (mintability, REQ-FTG-07) | ✅ PASS, empirically re-verified non-vacuous | Fault-injected: renamed the real `"outside-run"` minting site in `context.ts` (`reason: "outside-run"` → `reason: "outside" + "-run-removed"`) → fit-44 failed exactly as expected (`Expected: true, Received: false`), restored, `git status` clean. Built-in red-proof fixture (`reason-unreachable.ts`) additionally proves the scan is blind ONLY to the two excluded syntactic shapes (union declaration, `originFor`'s switch), not to everything — confirmed by reading the assertions. |
| S-005.4 — fit-45 (single lexical predicate, REQ-FTG-08) | ✅ PASS, empirically re-verified non-vacuous | Clause (a): a naive decoy (`p.includes("..")`) did NOT trip the scanner — correctly so, since the mechanism is a documented "shape-keyed clone detector" (segment-aware `..` test AND absolute-path test), not a name match; a decoy with the REAL shape (split+dotdot-membership+absolute-test) under a different function name DID trip it, naming both the real and the decoy file — confirms the mechanism's disclosed limit and its real discrimination boundary. Clause (b): read `findCallSites` — confirmed 3 real call sites (`expander.ts#runScaffold`, `index.ts#readTemplateFile`, `index.ts#runCopyIn`) and its red-proof (synthetic 4-site fixture) is a direct mechanism proof, not real-tree mutation (appropriately, since a real 4th call site would require production code change to test). |
| S-005.5 — ADR-0077 + ADR-0045/0046/0067 headers | ✅ PASS | Read ADR-0077 in full (176 lines) — §A-§J all present, matching design §5 point for point, including the two dated amendments and the "disk-canonicalization pass" vocabulary consistently used instead of "realpath" (per Deviation #10's disclosed rationale). ADR-0046 and ADR-0067 each carry `> **Superseded by ADR-0077 (2026-07-28)**` near their top; ADR-0045 carries `## Amended by ADR-0077 (2026-07-28)` near its tail. All three verified by direct read, not just `rg`. |
| S-005.6 — `docs/authoring-verbs.md` qualified author rule (V3.3 verbatim) | ✅ PASS, byte-verified | Programmatically diffed (whitespace-normalized) the exact sentence in `docs/authoring-verbs.md` against the signed `ir-path-well-formedness` spec V3.3 text — **exact match**. Confirmed this is NOT design's older wording: design's own §6 file-changes table (line 419) reads "…lives inside its package **boundary** — symlinks are followed without target verification, see SECURITY.md" (no parens, extra word "boundary") — the builder correctly used the SIGNED SPEC text, not design's stale draft, exactly as S-005.6 demanded. `SECURITY.md`'s "what the boundary is now" paragraph and the "what the boundary is now" prose in `docs/authoring-verbs.md` both present. |
| S-005.7/.9 — CHANGELOG.md three entries + preamble + version + ADR headers, `docs/authoring-errors.md`, cross-repo handoff | ✅ PASS | `CHANGELOG.md` carries `## 0.2.0` (never `## Unreleased`), all three entries by distinguishing phrase, and the amended preamble naming "the engine repo and the conformance corpus" as the real audience. `package.json#version === "0.2.0"` confirmed. `CONFORMANCE-CORPUS-HANDOFF.md` Addendum 3 present; `SDK-EXIT-CODE-CONFIRMATION.md` carries the dated "Historical as of 2026-07-28" note; `openspec/pending-changes.md` rows re-cited (diff confirmed in commit). `docs/authoring-errors.md` correctly uses "drop" (not "delete") in its migration note, satisfying the pre-existing `wire-internal-terms` doc guard — confirmed no bare "delete" remains in that file, while CHANGELOG.md (not in the banned-terms doc list) legitimately keeps "delete". |
| S-005.8 — SECURITY.md 5-phrase docs guard | ✅ PASS, mutation-checked | The 5 phrases in `SECURITY.md`'s "Package-local read trust posture (v1)" section byte-match `security-authoring-guard.test.ts`'s `PSH_05_POSTURE_PHRASE_1..5` constants exactly (direct comparison). Mutated phrase 4 (dropped "documented" qualifier) → guard failed with a clear diff showing expected vs. received; restored, `git status` clean. |
| S-005.9 — CHANGELOG/release-vehicle bundled guard | ✅ PASS, mutation-checked | Mutated the breaking-narrowing phrase ("narrows"→"shrinks") in `CHANGELOG.md` → `changelog-release-vehicle-guard.test.ts` failed exactly on that assertion (others stayed green); restored, `git status` clean. Confirms the guard actually reads CHANGELOG.md content, not a hardcoded stand-in. |
| S-005.10 — `bun test` green | ✅ PASS (re-executed independently, see Suite) | — |
| Deviation #10 — two production-comment rewrites (`context.ts`, `path-guards.ts`) | ✅ RULED LEGITIMATE, necessary consequence | Diffed the actual commit: `context.ts:68` "the `collection.json` ancestor walk" → "the ancestor-marker walk"; `path-guards.ts` (3 sites) "no realpath"/"no realpath" → "no disk-canonicalization pass"/"never disk-canonicalized". Meaning verified unchanged — both edits are pure vocabulary substitutions for the exact same technical fact, forced by fit-43 clauses (a)/(f) banning those literal substrings even in comments (REQ-FTG-06 says "code or comment lines" for clause (f); clause (a) has no comment carve-out). Not scope creep — a compile-breaker-equivalent forced fix, same discipline as prior deviations #2/#7/#9. ADR-0077 itself adopts the same "disk-canonicalization" vocabulary for consistency (outside the scan's scope, a style choice not a requirement). |
| Deviation #11 — `docs/authoring-errors.md` "delete"→"drop" | ✅ RULED LEGITIMATE, necessary consequence | Confirmed via `rg` — zero occurrences of bare "delete" remain in `docs/authoring-errors.md`; the pre-existing `wire-internal-terms` doc guard (`test/docs/doc-set-content.test.ts`) bans it repo-wide across the author-facing doc set. `CHANGELOG.md`'s equivalent sentence correctly keeps "delete" (not in the banned-terms doc list, not author-facing product doc). Caught by the FULL SUITE run (not S-005's own tests), exactly as disclosed. |
| `test/scaffold/walk.test.ts` carry-forward | ✅ PASS, zero assertion changes | Diffed `5185eb7^..5185eb7` — only the header comment and one `describe` title changed ("in-ceiling" framing → enumeration-determinism/cycle-safety framing per signed REQ-FSC-09); zero test bodies, assertions, or `it()` blocks touched. Confirmed 11 pass, unchanged count. |
| Slices/apply-progress honesty | ✅ PASS | All 10 S-005 checkboxes `[x]` in `slices.md` (S-006's 5 tasks correctly remain `[ ]`, out of scope). Spot-checked 4+ apply-progress claims against the actual `5185eb7` diff/re-execution: (1) the exact "35 new tests" arithmetic (21 fit-43/44/45 + 8 changelog-guard + 6 REQ-PSH-05.1 = 35) verified by independently running each file and counting; (2) the two production-comment rewrites (Deviation #10) verified byte-for-byte against the diff; (3) the "delete"→"drop" rewrite (Deviation #11) verified via `rg`; (4) the suite delta (2363→2398) verified via two independent full-suite runs. No discrepancies found. |
| TDD discipline | ✅ PASS | New guard files (fit-43/44/45, both docs-guard tests) are new production+test pairs with no pre-existing implementation to retrofit; apply-progress does not claim strict RED-first process deviation for S-005 (unlike S-000's disclosed Deviation #1/S-001's Deviation #6) — consistent with the nature of this slice (architectural scanners built fresh against their own fixtures). |
| Full-suite execution (real, re-run independently) | ✅ PASS | Two back-to-back UNCONTENDED runs in a single shell invocation: 2398 pass / 0 fail both times, byte-identical (5310 expect() calls, 201 files) — matching the builder's claim exactly. No react-conformance flake observed (expected — flake is contention-triggered, these runs were uncontended). |
| `tsc --noEmit` | ✅ PASS | Re-run independently — clean, zero errors. |

### Findings

None.

### Assertion Quality / Strict TDD (in-loop audit)

**Iteration**: 6
**Verdict**: ok
**Delta scope**: test files — `fit-43-no-ceiling-regrowth.test.ts`, `fit-44-authoring-reason-reachability.test.ts`, `fit-45-single-lexical-predicate.test.ts`, `test/docs/security-authoring-guard.test.ts` (extended), `test/docs/changelog-release-vehicle-guard.test.ts` (new), `test/scaffold/walk.test.ts` (comment-only); impl files — `test/support/src-invariant-scans.ts` (pure scanners, test-support tier, not `src/**`), plus the two production comment edits (`src/core/context.ts`, `src/scaffold/path-guards.ts`) and one docs wording edit (`docs/authoring-errors.md`).

No banned assertion patterns found (no bare `.toBeDefined()`/`.toBeTruthy()` as sole assertions, no snapshot-only tests, no mock-heavy tests). All new fitness-guard tests assert exact expected values (`toEqual([...])` with named file/function/line), never shape-only checks. Triangulation is adequate: each scanner has both a real-tree assertion and at least one red-proof fixture exercising the discriminating branch; fault injection independently confirmed 4 distinct guards (fit-43 clauses a/f, fit-44, fit-45 clause a) actually fail when the invariant is broken, and 2 docs guards (SECURITY.md, CHANGELOG.md) fail when their frozen phrases are mutated — none of this was accepted from the builder's word alone.

### Suite

- Run 1: 2398 pass / 0 fail across 201 files (5310 expect() calls)
- Run 2: 2398 pass / 0 fail — byte-identical
- `bunx tsc --noEmit`: clean, zero errors
- Targeted re-runs matching apply-progress's claimed counts exactly: fit-43/44/45 (21 pass/39 expect), `security-authoring-guard.test.ts` (23 pass/50 expect), `changelog-release-vehicle-guard.test.ts` (8 pass/12 expect), `walk.test.ts` (11 pass/42 expect)
- Working tree confirmed clean (`git status --short`) both before verification began and after every fault-injection/restore cycle — no residual mutations left behind

### Routing

LOCAL / none needed — PASS, no fixes required.
