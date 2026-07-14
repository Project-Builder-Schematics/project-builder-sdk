## Verify In-Loop Result

**Change**: author-emulation-e2e-scaffold
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton — infra spine)
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

All 8/8 S-000 tasks complete, real execution is clean (full suite + typecheck), the
scope-guard and canonical-serialization invariants I could verify byte-for-byte all hold.
Two concrete REQ/ADR-level test-coverage gaps and one TDD-discipline concern keep this
from a clean PASS. All are LOCAL — fixable by the Executor without touching design or spec.

#### Real execution evidence (commands run, not trusted from apply-progress)

| Command | Result |
|---|---|
| `bun test` (full suite) | **1070 pass / 0 fail**, 2061 expect() calls, 128 files, 8.30s |
| `bunx tsc --noEmit` (full project) | **clean**, exit 0 |
| `bun test test/fitness/fit-23-corpus-determinism.test.ts test/fitness/fit-24-corpus-purity.test.ts test/fitness/fit-27-anti-tautology-scan.test.ts` | 12 pass / 0 fail |
| `bun test test/e2e/author-emulation-scaffold.e2e.test.ts test/e2e/author-emulation/corpus-format.test.ts` | 3 pass / 0 fail |
| `bun scripts/regen-corpus.ts` (fresh process, strong GCC-05 guard) then `git diff --stat` on corpus dir | **empty diff** — regen reproduces the committed `s-00` byte-for-byte from a cold process |
| `git diff 5b05221..HEAD --stat` | **zero `src/**` rows** across all 17 changed files — scope guard holds |
| `xxd`/`tail -c`/CR-scan on `s-00.infra-skeleton.transcript.json` | starts `7b0a` (no BOM), 0 CR bytes, ends `}\n` exactly once — ADR-0049 byte-format confirmed |

#### Acceptance GWT (S-000) — verified directly

- **FIT-23 (byte-identical re-run)**: in-process double-run test passes; red-proof
  (`nondeterministic-factory.ts`, embeds fresh `randomUUID()`) correctly fails the
  same comparison — the guard discriminates, not vacuous.
- **FIT-24 (purity scan)**: passes on the committed corpus; 4 red-proofs (abs-path
  fixture, UUID-embedding factory, inline PNG magic bytes, negative-control
  package-relative path) all assert correctly — no false positive/negative.
- **FIT-27 (anti-tautology)**: BFS import-graph walk over `test/e2e/`+`test/support/`
  finds no corpus-dir writer and confirms `scripts/regen-corpus.ts` is unreachable
  from that graph and doesn't match `bun test`'s `.test.ts` discovery pattern;
  red-proof (`corpus-write-in-support.ts`, never imported, scanned as text) is
  correctly flagged, and a negative-control unrelated write is correctly NOT flagged.
- **Scope guard (GCC-12)**: `s-00` scenario factory (`test/fixtures/typed-factory/factory.ts`)
  calls only `create` — one of the six pre-existing wire ops (`src/core/wire.ts:29-39`
  enumerates create/modify/delete/rename/move/copy as pre-existing, `copyIn` as the
  new 7th) — confirmed by reading both files.

#### Findings

| # | Category | Severity | File:Line | Detail |
|---|---|---|---|---|
| 1 | Strict TDD — triangulation gap | NEEDS_FIX | `test/support/corpus-format.ts:95-105` (`sortKeysDeep`) | ADR-0049 names this recursive lexicographic key-sort as the fix for "the most common determinism regression," and `canonicalize()` is the ONE function every verifier/writer shares — yet no test anywhere calls `canonicalize`/`sortKeysDeep` with a multi-key `options` object. The only exercise is `s-00`'s `options: {port: 8080}` — a single key can never prove a sort actually reorders anything; a broken/no-op `sortKeysDeep` would pass every current test. Recommend: one `corpus-format.test.ts` case with `options` keys authored out of order (e.g. `{z: 1, a: 2}`), asserting the serialized output emits `a` before `z`, plus a nested-object case. |
| 2 | Spec coverage — REQ-ITC-01.1 untested | NEEDS_FIX | `test/support/ir-transcript.ts:63-109` (`captureRun`) | Design's own Test Derivation table (§4.6) assigns REQ-ITC-01.1 ("three ordered `Batch` entries from a 3-flush factory") to a dedicated "e2e capture unit (3-flush factory)" test, marked UNGATED (buildable now) — S-000's Covers line lists `ITC-01` unqualified (implying full coverage). No such test exists: every `captureRun` call in this delta (`corpus-format.test.ts`, the e2e file, both FIT-23/24 tests) drives the same single-batch, single-directive `s-00` scenario. The `rejected`-outcome branch (`ir-transcript.ts:85-106`, the R-F verbatim pass-through logic) is likewise never exercised at runtime anywhere in this delta — only a hand-authored static JSON fixture (`abs-path-corpus.transcript.json`) simulates that shape, it never runs through `captureRun` itself. Per this skill's own rule ("a spec scenario is only COMPLIANT when a test that covers it has PASSED at runtime — code existing is not sufficient evidence"), REQ-ITC-01.1 is ❌ UNTESTED, not ✅ COMPLIANT, despite being claimed as covered. Recommend: add a small in-repo 3-flush test factory (or reuse an existing multi-flush fixture) exercised through `captureRun`, asserting 3 ordered `Batch` entries; and at least one test driving `captureRun` through an actual `AuthoringError` to prove the rejected branch's shape at runtime (not just via a static fixture). |
| 3 | Strict TDD — git-history ordering (final-mode relevant, non-blocking here) | WARNING | commits `e216211`, `4394534` | Git history shows two `feat:`-prefixed commits (`e216211` adding `ir-transcript.ts`+`corpus-format.ts`, `4394534` adding `scenarios.ts`+`regen-corpus.ts`) landing with **zero accompanying test files**, both BEFORE the first `test:`-prefixed commit (`f7d393b`). This is the anti-TDD ordering `strict-tdd-verify.md` Method 1 flags (tests added after implementation), and it sits in tension with apply-progress's own narrative ("e2e skeleton test written first... RED... implemented... GREEN") — the working-directory order may have been test-first, but the *committed* history has no verifiable RED commit, so that claim isn't evidence-backed. `strict-tdd-verify.md`'s in-loop Halt Conditions table lists this as a HALT trigger, while its own more specific "TDD Cycle Adherence Audit" section for the same condition says "flag (in-loop) / halt (final)" — I followed the more specific, mode-differentiated instruction (flag here) since a HALT's only routing options (ARCHITECTURAL/SPEC/SENSITIVE/ITERATION-LIMIT) don't fit a commit-hygiene concern; the document's own internal inconsistency is worth a maintainer look but is out of scope for this verify pass. Not blocking iteration 1 by rule; final-mode verify MUST NOT tolerate this — flag for full final-mode TDD Cycle Adherence Audit. |
| 4 | Carried-forward risk (already self-disclosed, not new) | INFO | `test/support/corpus-format.ts:84-89` (`embedTemplate`) | Confirmed via `rg` — no test anywhere exercises the `>CONTENT_EMBED_BUDGET` (4096-byte) digest branch; `s-00`'s template is far under budget. This matches apply-progress's own "Risks" section verbatim (already flagged, already deferred to S-003/M-09). Listing here only for completeness — not a new finding, no action needed at this iteration. |

#### Tolerated for now (correctly out of S-000 scope, not findings)

- `normalizeDirective`'s `copyIn` branch (`ir-transcript.ts:41-43`) has zero direct exercise in S-000 — but GCC-12 explicitly restricts the `s-00` scenario to the six pre-existing wire ops (excludes `copyIn` by design); this is deferred to S-003/S-004 matrix rows, not a gap.
- REQ-ITC-01.2 (zero-emission run) — design's table cites "e2e M-14 / skeleton" as its test; M-14 is an S-003-owned matrix row, so this is plausibly deferred rather than missed. Lower confidence than finding #2 — noting but not counting as a blocking gap.
- Coverage-manifest's EXERCISED ledger is empty and README's family-prefix/5-heading/self-labeling content is skeleton-appropriate — both match the explicitly-scoped "walking-skeleton state" the manifest itself declares.

Routing: **LOCAL** (Executor SDD-light — two targeted unit-test additions; no design/spec/architecture change implied)
Orchestrator action: re-invoke `/build` (SDD-light) targeting findings #1 and #2. Iteration 1 of 3 used.

---

### Spec Compliance Matrix (scope: S-000 only)

| Requirement | Test | Result |
|---|---|---|
| ITC-01.1 (3 ordered batches) | none | ❌ UNTESTED (finding #2) |
| ITC-01.2 (zero-emission) | none in S-000 | ⚠️ deferred (plausibly M-14/S-003) |
| ITC-02 (single capture path, path only) | manual import check (ir-transcript.ts imported identically by regen/e2e/corpus-format.test/fit-23/fit-24) | ✅ COMPLIANT (no automated FIT-25 yet — expected, S-001) |
| ITC-03 (shape not render) | `s-00` corpus retains `{{port}}` unrendered | ✅ COMPLIANT |
| ITC-04 (placement) | `spy-client.ts` untouched (git diff), e2e filename exact | ✅ COMPLIANT |
| ITC-05 (zombie tripwire) | code inspection — 2 named branches only, throws otherwise | ✅ COMPLIANT |
| GCC-01 (partial) | 1 corpus file present (skeleton only) | ✅ COMPLIANT (partial, as scoped) |
| GCC-02 (formatVersion independence) | `corpus-format.test.ts` | ✅ COMPLIANT (test passed) |
| GCC-03 (chunk-only ≠ drift) | `corpus-format.test.ts` | ✅ COMPLIANT (test passed) |
| GCC-04 (byte-determinism) | FIT-23 + fresh-process regen diff | ✅ COMPLIANT |
| GCC-05 (no self-heal) | FIT-27 + regen-script isolation | ✅ COMPLIANT |
| GCC-06 (purity + canonical serialization) | FIT-24 + byte-level xxd/CR check | ✅ COMPLIANT for exercised paths; sort-order claim itself untested (finding #1) |
| GCC-07 | N/A (single-directive scenario) | N/A, as scoped |
| GCC-09 (rejection record) | none in S-000 | ⚠️ deferred to S-004/M-13 by design table (GATED) |
| GCC-10 (placement/naming) | file inspection | ✅ COMPLIANT |
| GCC-11 (README) | 5 literal headings + self-labeling `normative`/`informative` keys | ✅ COMPLIANT |
| GCC-12 (skeleton pre-merge RED-provability) | FIT-23/24/27 all pass against `s-00` alone | ✅ COMPLIANT |
| RPT-02 (.gitignore) | `.gitignore:30` + `git status` clean after full run | ✅ COMPLIANT |
| FTG-01 (FIT-23) | test run + red-proof | ✅ COMPLIANT |
| FTG-02 (FIT-24) | test run + 4 red-proofs | ✅ COMPLIANT |
| FTG-05 (FIT-27) | test run + red-proof + negative control | ✅ COMPLIANT |

**Compliance summary**: 16/20 rows compliant, 2 untested (findings #1/#2 — sort-order + REQ-ITC-01.1), 2 legitimately deferred to later slices (GCC-09, ITC-01.2).

### Completeness

| Metric | Value |
|---|---|
| S-000 tasks total | 8 |
| S-000 tasks complete | 8/8 |

### TDD Cycle Adherence (audit scope: S-000 delta only)

- Method used: git-history (Method 1) + test-implementation pairing (Method 2).
- Method 1: anti-TDD ordering found (finding #3) — two `feat:` commits with zero tests landed before the first `test:` commit.
- Method 2: every delta file has SOME corresponding test coverage except the two gaps in findings #1/#2 — no file is entirely untested.
- Banned assertion patterns: scanned all S-000 delta test files (`ir-transcript.ts`, `corpus-format.ts`, both e2e/unit test files, `scenarios.ts`, `regen-corpus.ts`, all three fitness tests) for `toBeDefined()`/`toBeTruthy()`/`toBeFalsy()`/`objectContaining`-as-whole-assertion/`not.toThrow()`-only/bare snapshots — **zero matches**, clean.
- Regression: all 1070 tests pass, zero regressions from pre-change baseline.

---

### Artifacts Persisted
| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-1 | hybrid | engram `sdd/author-emulation-e2e-scaffold/verify-in-loop-1` + `openspec/changes/author-emulation-e2e-scaffold/verify-in-loop-1.md` |

### Risks
- Findings #1 and #2 are both in pure, side-effect-free functions (`sortKeysDeep`, `captureRun`'s ordering/rejection paths) — low behavioral risk today, but they are exactly the kind of gap that's cheap to close now and expensive to discover later (once matrix rows depend on multi-key options or rejection scenarios in S-003/S-004).
- Finding #3 (TDD git-history ordering) should be escalated to full scrutiny at `sdd-verify --mode=final` per `strict-tdd-verify.md`'s final-mode rules — this in-loop pass explicitly does NOT halt on it, following the audit section's mode-specific guidance over the (looser) summary table in the same file.

### Next Recommended
`sdd-apply` (SDD-light) targeting findings #1 and #2 only, then re-run `sdd-verify --mode=in-loop --scope=S-000 --iteration=2`.

### Skill Resolution
none (greenfield project — skill registry empty per orchestrator's "Project Standards (auto-resolved)" note)
