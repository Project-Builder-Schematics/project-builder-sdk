## Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-005 (FINAL slice)
**Mode**: in-loop (Strict TDD)
**Date**: 2026-07-15

---

### Verdict: PASS

All scope checks green. Loop can exit — this was the last slice.

- Tasks in scope complete: 4/4 (S-005.1–.4) — all `[x]` in `slices.md`
- Tests: **1605 pass / 0 fail** (170 files, 3243 expect() calls) — full `bun test` run, matches
  `apply-progress.md`'s claim exactly; delta from S-004's baseline (1571 pass) is +34 tests
  (fit-31: 15 tests incl. per-file transport scan + 4 red-proofs + 4 WPS-11 tests + 4 LED-01
  tests; fit-33: 4; fit-34: 4; harness.test.ts: `PENDING_S005_COVERAGE_EXEMPTIONS` shrunk to
  empty, no new tests there)
- Typecheck: `bunx tsc --noEmit` — clean, zero errors
- Build: `bun run build` — clean (`tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts...`)
- Regression: **zero `src/` files touched this slice** (confirmed via `git diff --stat 6a21a7f..ee48e47`
  — only `docs/{README.md,engine-sdk-wire-design.md,engine-sdk-wire-spec.md}`,
  `openspec/pending-changes.md`, `test/fake/harness.test.ts`, and the three new
  `test/fitness/fit-{31,33,34}-*.test.ts` files changed)
- Spec compliance for scope: 4/4 REQ-IDs (WPS-06, WPS-11, FEH-06, LED-01), 7/7 scenarios, all
  covered by named, passing, non-vacuous tests — see matrix below
- `PENDING_S005_COVERAGE_EXEMPTIONS` (S-004's shrink-only exemption set): confirmed **empty**
  at `test/fake/harness.test.ts:134` (`new Set<string>()`) — the hard gate this slice was held to

One WARNING below (Strict TDD commit-ordering finding), non-blocking per in-loop rules but
**must** be resolved or explicitly adjudicated before `sdd-verify --mode=final`, which has zero
tolerance for it. No CRITICAL findings, no ARCHITECTURAL/SPEC halt.

Orchestrator action: exit loop (PASS) — S-005 was the last slice. Per the state mirror's
`post_build_user_request`, proceed to `/simplify` over the full change diff next, THEN
`sdd-verify --mode=final` before archive. Final mode's TDD audit MUST explicitly adjudicate
BOTH this report's Strict TDD finding AND the still-open `verify-in-loop-4`/`-5` carryover
(`ea9b7e0`'s commit-ordering issue) — neither is a free pass at final.

---

### Real Execution Evidence

```
$ bun test
 1605 pass
 0 fail
 3243 expect() calls
Ran 1605 tests across 170 files. [58.67s]

$ bunx tsc --noEmit
(clean, no output, exit code 0)

$ bun run build
$ rm -rf dist
$ tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"
Bundled 9 modules in 6ms
  pbuilder-codegen.js  14.29 KB  (entry point)
(exit code 0)

$ git log --oneline b3e876d^..ee48e47
ee48e47 docs(sdd): record S-005 apply progress complete (4/4) — change COMPLETE
ef18770 test(fitness): add fit-31/33/34 doc-reconciliation and ledger guards (S-005)
4a008b5 docs(sdd): reconcile pending-changes ledger against stdio-engine-client (REQ-LED-01)
b3e876d docs: add normative engine-sdk-wire-spec.md, reconcile wire-design.md to rev 3

$ git diff --stat 6a21a7f..ee48e47 -- test/ src/ docs/ openspec/pending-changes.md
 docs/README.md                                     |   9 +-
 docs/engine-sdk-wire-design.md                     |  73 ++++++--
 docs/engine-sdk-wire-spec.md                       | 177 ++++++++++++++++++
 openspec/pending-changes.md                        |  44 +++--
 test/fake/harness.test.ts                          |  18 +-
 test/fitness/fit-31-single-owner-framing.test.ts   | 229 +++++++++++++++++++++++
 test/fitness/fit-33-bridge-version-pin.test.ts     |  62 ++++++
 test/fitness/fit-34-batch-cap-drift.test.ts        |  54 ++++++
 8 files changed, 624 insertions(+), 42 deletions(-)
```

Single clean run on the already-installed `node_modules` — no re-run needed for flake
confirmation (the carried-forward "cold-start suite flake" item from `verify-in-loop-4`'s
state mirror concerns a FRESH install, not this warm environment; deferred to final per that
report's own routing).

---

### Requirement 1 — Wire-spec doc reconciled against BUILT code (not stale design prose)

Every normative claim in `docs/engine-sdk-wire-spec.md` was spot-checked directly against the
shipped `src/` source, not trusted from the doc's own prose:

| Doc claim | Source of truth | Verified |
|---|---|---|
| `WIRE_PROTOCOL_VERSION = 1` | `src/transport/wire-protocol.ts:4` | ✅ exact match |
| `BRIDGE_CONTRACT_VERSION = 1` | `src/transport/wire-protocol.ts:5` | ✅ exact match |
| `BATCH_CAP_BYTES = 4194304` | `src/core/wire.ts:55` (`4 * 1024 * 1024`) | ✅ exact match |
| Frame grammar: 4-byte BE length prefix + UTF-8 JSON body, single owner `framing.ts` | `src/transport/framing.ts` `encodeFrame`/`decodeFrameBody`/`LENGTH_PREFIX_BYTES` | ✅ exact match, byte-for-byte |
| `REVERSE_CALLBACK_METHODS = ["tree.read","ir.emit","ir.commit","ir.discard"]` | `src/transport/wire-protocol.ts:6` | ✅ exact match |
| Error-text ceilings: 2000-char message / 200-char token | `src/transport/error-text.ts` `MESSAGE_CEILING_CHARS=2000` / `TOKEN_CEILING_CHARS=200` | ✅ exact match |
| Exit-code taxonomy (0–4, classification rule) | `src/transport/exit-codes.ts::classifyExitCode` + `src/transport/runner.ts::runRunnerBody`'s direct `return 1`/`return 4` pre-run-gate paths | ✅ every code-1/4 case in the doc's table traced to a real return site; `classifyExitCode` handles only the post-run `AuthoringError`/`TransportFault`/crash split (codes 1(subset)/2/3/4) |

No stale-design-prose issue found — every literal cited by the doc is read directly off code
that already shipped in S-000..S-004, exactly as `apply-progress.md` claims.

### Requirement 2 — The three documented interpretive calls

1. **fit-31's code-scan scoped to frame ENCODING only, not encode+decode** (diverges from
   design.md § 4.7's one-line "only framing.ts encodes/decodes the length prefix"). **Sound.**
   `frame-reader.ts` legitimately calls `readUInt32BE` for streaming reassembly (a genuinely
   different concern — peeking how many body bytes to wait for — while still delegating
   body-decode and the cap check to `framing.ts`). The scan is non-vacuous in BOTH directions:
   a red-proof planting `writeUInt32BE` outside `framing.ts` IS flagged, and `frame-reader.ts`'s
   real, legitimate `readUInt32BE` reference is verified NOT flagged (read the actual test at
   `fit-31-single-owner-framing.test.ts:161-165` — asserts the source really contains
   `readUInt32BE` first, so the negative control is against real code, not a strawman).
2. **REQ-LED-01's "fit-31-style ledger-presence scan" bundled into `fit-31-single-owner-
   framing.test.ts` rather than a 7th numbered fitness function.** **Sound, effectively forced.**
   `slices.md`'s Executor Context (line 26, "orchestrator ruling, plan-verify iteration 2")
   fixes the new-check count at exactly six (fit-30..35) and explicitly states fit-29 is NOT
   reused for anything new. `spec.md`'s REQ-LED-01 text ("a fit-31-style ledger-presence scan")
   is genuinely ambiguous between "styled like fit-31" and "inside fit-31," but the numbering
   ruling forecloses the "separate 7th check" reading — there is no numbering slot left for it.
   `design.md` § 4.7 was updated to match (six checks, fit-31's own bullet naming both the
   code-scan and the WPS-11 doc-scan leg).
3. **`docs/README.md` + a handful of factual one-liners in `wire-design.md`** (runner-bin
   `package.json#bin` correction, Open Questions resolutions) touched alongside the mandated
   rev-3 edit. **Sound, in-scope.** Same-file, directly-in-scope corrections completing the
   "reconciled against BUILT code" posture WPS-11/the north-star reckoning item 2 requires —
   not a broader unscoped rewrite (spot-checked `docs/README.md`'s diff: 9 lines, index links +
   one in-scope one-liner, nothing beyond that).

None of the three rise to ARCHITECTURAL or SPEC halt category — all are documented, non-silent,
and independently re-derivable from the artefacts cited.

### Requirement 3 — Coverage exemption set empty + real, non-vacuous per-REQ tests

`PENDING_S005_COVERAGE_EXEMPTIONS` confirmed `new Set<string>()` (empty) at
`test/fake/harness.test.ts:134`. Each of the four previously-exempted REQ-IDs now has a real
test citing it, verified independently (not by grep alone — each test read and its red-proof
inspected):

| Requirement | Test | Would it catch a violation? |
|---|---|---|
| WPS-06 (.1) | `fit-34-batch-cap-drift.test.ts::REQ-WPS-06.1` | YES — asserts `BATCH_CAP_BYTES === 4194304` directly against the export; a drift in either direction fails |
| WPS-11 (.1) | `fit-31...test.ts::docs/engine-sdk-wire-design.md holds no live NDJSON/...` | YES — real scan of the actual doc, 3 red-proof fixtures (outside/inside/nested-under superseded) prove the heading-scope logic is exercised both ways, not just "doesn't crash" |
| WPS-11 (.2) | `fit-31...test.ts::...header stamps a version matching WIRE_PROTOCOL_VERSION` | YES — red-proof: an unstamped header yields `undefined`, never a false match against the real constant |
| WPS-11 (.3) | `fit-31...test.ts::docs/engine-sdk-wire-spec.md is missing zero mandated sections` | YES — red-proof: a doc missing one of the 8 mandated sections is caught by name |
| FEH-06 (.1) | `fit-34...test.ts::REQ-FEH-06.1: the wire-spec doc's Frame-Cap Constant section pins the SAME literal the SDK exports` | YES — extracts the doc's literal via a scoped regex and compares to the live export; red-proof drift fixture confirmed caught |
| LED-01 (.1) | `fit-31...test.ts::openspec/pending-changes.md names the cross-repo tether row and the Windows/macOS-pins row` | YES — organic RED obtained during S-005.3 development (ledger not yet edited); red-proof against an unrelated-text ledger confirmed |
| LED-01 (.2) | `fit-31...test.ts::...closed StdioEngineClient row carries a full supersession note` | YES — per-line scan (not distance-based) avoids the false-match bug the executor discovered and fixed mid-slice (see Discoveries); red-proof: a row missing one of the three named decisions is caught |

All seven scenarios independently confirmed COMPLIANT — code existing was not trusted as
sufficient; each test was read in full and its red-proof/negative-control inspected.

### Requirement 4 — fit-31/33/34 adversarial vacuity check

All three files carry explicit red-proofs AND (where a false-positive risk exists) negative
controls, not just a happy-path assertion:

- **fit-31**: red-proof for the encode-scan (planted `writeUInt32BE`), negative control against
  real `frame-reader.ts` code; 3-way red-proof for the superseded-term scan (outside/inside/
  nested-under-superseded); red-proof for the header-stamp check (unstamped → `undefined`);
  red-proof for the section-presence check (one section removed → caught by name); red-proof
  for both ledger checks (missing rows; a row missing one of three named decisions).
- **fit-33**: red-proof for a doc-declared version drifting from the SDK export; red-proof for
  a missing Bridge Contract section (`undefined`, never a false pass); red-proof proving a
  same-named constant under an UNRELATED section (WPS-06) is not mistaken for the bridge value
  — a genuinely adversarial case since both sections' fixture text share the same constant name.
- **fit-34**: red-proof for a doc-declared cap drifting from the SDK export; red-proof for a
  missing Frame-Cap Constant section.

None of the six checks (WPS-11.1/.2/.3, WPS-06.1/FEH-06.1 combined in fit-34, LED-01.1/.2) can
pass vacuously — every one has at least one fixture proving it genuinely fails on the
adversarial input it exists to catch. This is the same discipline S-000's fit-10/fit-29/fit-30
established, correctly carried through to the docs-domain checks.

### Requirement 5 — `openspec/pending-changes.md` ledger reconciliation

Read the ledger directly (not trusted from `apply-progress.md`'s summary) and matched every row
disposition against `slices.md`'s S-005.4 reconciliation table verbatim:

| slices.md disposition | Ledger state (read directly) | Match |
|---|---|---|
| L359 `StdioEngineClient` row → CLOSE w/ supersession note (NDJSON, session.init, argv-spawn) | Line 374: `~~...~~` struck through, **CLOSED — superseded by `stdio-engine-client`** note naming all three decisions by REQ-ID (WPS-01, WPS-02, WPS-09/BRB-01) | ✅ |
| L360 factory-scaffold row → RE-HOME to public-package plan | Line 375: **RE-HOMED 2026-07-15** (owner ruling, obs #2161) → `public-package plan` | ✅ |
| L361 bare-factory-migration row → VERIFY against shipped archive, retire w/ pointer if delivered | Line 376: **RETIRED 2026-07-15** — DELIVERED by `archive/2026-07-15-bare-factory-migration`, names the 3 concrete deliverables verified | ✅ |
| L350–355 section header → RE-HEAD "DELIVERED by stdio-engine-client" + annotate stale preamble | Line 357 header re-headed exactly; lines 359–365 add a "Stale preamble note" block explaining the pre-2026-07-14 text is historical | ✅ |
| L74 EmitRejection row → SPLIT/PARTIAL-CLOSE | Line 74: **SPLIT 2026-07-15** note, SDK-side delivered via `reconstructEmitRejection`, engine-side flagged cross-repo | ✅ |
| L56 batch-cap row → ADVANCE-NOTE | Line 56: **ADVANCE-NOTE 2026-07-15** citing WPS-06/FEH-06 + fit-34 | ✅ |
| L107 stage-2 error contract → ADVANCE-NOTE | Line 114 (content-matched, not line-56): **ADVANCE-NOTE 2026-07-15** citing WPS-08 formalization, still engine-unconfirmed | ✅ |
| L220 copy-verb row → NO CHANGE + advance-note | Line 227: ADVANCE-NOTE, gating unchanged | ✅ |
| L261–263 BRC-02/BRC-08/PRC-06 → NO CHANGE + advance-note | Lines 268–270: all three carry an ADVANCE-NOTE, gating explicitly unchanged | ✅ |
| L92–100 PC-PROTO-01 gloss → UPDATE w/ rev-3 + wire-spec version | Lines 103–107: new paragraph added naming rev-3 doc + wire-spec version as new SDK-side inputs | ✅ |
| NEW row — Windows/macOS pins | Line 411, under new `## From stdio-engine-client (2026-07-15)...` section | ✅ |
| NEW row — cross-repo tether | Line 412, same new section, names PC-PROTO-01/rev-3/wire-spec v1/`MaxMessageBytes==BATCH_CAP_BYTES` | ✅ |

12/12 dispositions match exactly, content-verified (not line-number-verified, per the
task's own "locate rows by CONTENT" instruction — several rows had shifted from their
original line numbers, e.g. the stage-2 row landed at line 114, not 107).

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: **concerns** (WARNING-level finding below; does not meet the in-loop HALT bar)
**Delta scope**: 3 new fitness test files (`fit-31`, `fit-33`, `fit-34`) + 1 test file extended
(`harness.test.ts`, exemption-set shrink only) + 2 new/modified docs (`engine-sdk-wire-spec.md`
new, `engine-sdk-wire-design.md` rev 3) + 1 modified ledger (`pending-changes.md`); zero `src/`
files touched this slice.

#### Findings

**Finding S-005-1 (WARNING, routing LOCAL/carry-to-final): docs committed BEFORE their driving
fitness tests, reversing this same change's own established TDD order.**

Git history is unambiguous: `b3e876d` (wire-spec.md + wire-design.md rev 3) and `4a008b5`
(ledger) both land BEFORE `ef18770` (fit-31/33/34). `apply-progress.md`'s own TDD Cycle Evidence
table admits this directly for the WPS-11 checks: *"n/a — doc already rev-3'd (S-005.2) before
this check was written; proven via 3 red-proof fixtures instead."*

This is a genuine deviation from the pattern THIS SAME change used successfully in every prior
slice for architectural/fitness checks — S-000's fit-10 (ADR-01 allow-list) and fit-29 (ADR-07
allow-list) both obtained real organic RED against the actual PRE-fix repository state (the
check was written first, genuinely failed against the not-yet-widened allow-list, and only
THEN was the allow-list widened to GREEN). The same option was available here and not taken:
`docs/engine-sdk-wire-design.md` at rev 2 already existed with real NDJSON/`session.init`
references outside any superseded section — writing fit-31's superseded-term scan FIRST against
that pre-existing rev-2 doc would have produced genuine organic RED (multiple real violations),
exactly mirroring fit-10/fit-29's pattern. Instead the rev-3 rewrite landed first, and the check
was written to already pass against the corrected doc, substituting synthetic string fixtures
for the RED that was actually available from the real artifact.

**Why this is WARNING, not HALT, at in-loop**: `strict-tdd-verify.md`'s own mode-comparison
table lists "Tests added AFTER implementation (anti-TDD pattern from git history)" under
**final mode HALTs** specifically, separate from the in-loop HALT list (banned-pattern-in-delta,
new-file-no-tests, regression, triangulation-gap). In-loop mode's explicit tolerance list
includes "assertion quality concerns... flagged for final" — this finding fits that bucket. It
does NOT meet any in-loop HALT condition on its own (the tests exist, are real, are non-vacuous,
and no regression occurred).

**Why this cannot be silently waved through at final**: `strict-tdd-verify.md`'s final-mode
audit has "No tolerated dimensions" — this is exactly the anti-TDD pattern that mode is built to
catch, and it is now the SECOND such finding in this change (the first, from `verify-in-loop-4`
re: `ea9b7e0`, remains unadjudicated per the state mirror's `carried_to_final` list as of this
report). `/evaluate` (mode=final) MUST either (a) accept both as documented, deliberate lapses
with an explicit rationale note added to `apply-progress.md`/the final report, or (b) route
`tdd-violation` back to the Executor. Silently passing both through final mode's "zero
tolerance" language without an explicit ruling would be inconsistent with the skill's own text.

**Mitigating factors** (why this is not classified higher than WARNING): (1) the docs are not
"production code" in the traditional RED/GREEN sense — they are the ARTEFACT UNDER TEST for
fitness checks, a genuinely different category the skill's own `strict-tdd.md` does not
explicitly address; (2) the checks are non-vacuous regardless of ordering — the red-proof
fixtures independently prove each check can fail, which is the substantive guarantee TDD is
protecting; (3) `PENDING_S005_COVERAGE_EXEMPTIONS` shrinking to empty and the full suite passing
are both real, verified outcomes, not artifacts of a weak test.

#### Tolerated for now (flagged for final)

- Finding S-005-1 above (this report's own finding).
- **Carryover, unresolved**: `verify-in-loop-4`'s Finding #1 (S-003's `ea9b7e0` commit-ordering
  anti-TDD pattern — production code shipped in a test-free commit, driving test landing two
  commits later) remains unadjudicated as of this report, per the state mirror's
  `carried_to_final` list. Two anti-TDD ordering findings now queue for final mode's zero-
  tolerance audit — the orchestrator should ensure both get an explicit ruling, not a silent
  pass.
- **Carryover, unresolved**: state-mirror-tracked "cold-start suite flake" (1 error on first
  `bun test` after a fresh install, not reproduced across 4 clean re-runs) — re-run full suite
  at final per `verify-in-loop-4`'s own routing; not re-triggered in this report's run (warm
  `node_modules`, single clean pass).

#### Halts (if verdict = halt)

N/A — no halt.

---

### Judgment Calls Adjudication (per orchestrator's request)

All three documented interpretive calls (Requirement 2 above) adjudicated **sound** — none
rises to a silent deviation or an ARCHITECTURAL/SPEC halt category. Full rationale under
Requirement 2.

### Deviation Adjudication (`apply-progress.md` § Deviations)

1. **fit-31's code check scoped to encode-only.** Adjudicated sound (Requirement 2, item 1).
2. **REQ-LED-01 bundled into fit-31, not a 7th numbered check.** Adjudicated sound, effectively
   forced by the numbering ruling (Requirement 2, item 2).
3. **`docs/README.md` + wire-design.md one-liners touched alongside the mandated edit.**
   Adjudicated sound, in-scope (Requirement 2, item 3).

None of the three documented deviations rise to ARCHITECTURAL or SPEC halt category.

---

### Slice Audit Notes Cross-Check

`apply-progress.md`'s own Step 7c notes ("no Bug/Architecture/MAJOR findings... self-reviewed
given the docs-only/test-only diff shape") were spot-verified rather than trusted:

- Zero `src/` changes confirmed independently via `git diff --stat 6a21a7f..ee48e47` — matches.
- REQ coverage confirmed independently for all 4 in-scope REQ-IDs / 7 scenarios (Requirement 3
  table above) via direct read of the cited tests and their red-proofs, not grep alone.
- Ledger reconciliation confirmed independently, row-by-row, by CONTENT (Requirement 5 table)
  — several rows had shifted line numbers from `slices.md`'s table, correctly located by content
  per the task's own instruction.
- Zero `as any`/`as unknown as`/TODO/FIXME spot-checked across the three new fitness test files
  and the `harness.test.ts`/ledger/docs diffs — none found.
- One discrepancy the Step 7c sweep did NOT explicitly call out (though it does not change the
  verdict): the Strict TDD commit-ordering finding above (S-005-1) — `apply-progress.md`'s own
  TDD Cycle Evidence table contains the admission this finding is built from, but the Deviations
  and Slice Audit Notes sections do not surface it as a finding in its own right. Surfaced here
  instead.

---

### Issues Found

**CRITICAL**: None.
**WARNING**: Finding S-005-1 — docs committed before their driving fitness tests (this report's
Strict TDD audit above). Non-blocking at in-loop; MUST be adjudicated at `sdd-verify --mode=final`
alongside the still-open `ea9b7e0` carryover from `verify-in-loop-4`.
**SUGGESTION**: None beyond the judgment calls already adjudicated as sound above.

Orchestrator action: exit loop (PASS) — S-005 is the last slice, all 6 slices (S-000..S-005) now
complete. Per the state mirror's `post_build_user_request`, proceed to `/simplify` over the full
change diff next, THEN `sdd-verify --mode=final` before archive. Final mode MUST explicitly
adjudicate BOTH open Strict TDD findings (this report's S-005-1, and `verify-in-loop-4`'s
`ea9b7e0`) and re-confirm the cold-start flake does not reproduce on a fresh install.
