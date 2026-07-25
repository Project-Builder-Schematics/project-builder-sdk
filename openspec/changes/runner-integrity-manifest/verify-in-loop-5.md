# Verify In-Loop 5 — runner-integrity-manifest (S-005 + S-004, final)

**Mode**: in-loop (Strict TDD) · **Iteration**: 1/1 so far · **Scope**: S-005 + S-004 (combined, deliberately, per CPU-contention flake mitigation)
**Delta**: S-005 `fcd754e`/`da249f8`/`01d2aa2`; S-004 `3543b31`/`6a94c26` (`git diff dd9b265..HEAD`, ignoring `ce61593`)
**This closes the Executor loop.** Verified accordingly — I looked for what a blind panel would find, not just what apply-progress claims.

---

## Execution Evidence

| Check | Result |
|---|---|
| Full suite (captured to file first) | `2318 pass / 0 fail`, `5096 expect() calls`, 196 files, `[76.75s]` — matches the orchestrator's figure exactly, no flake observed |
| Typecheck | exit 0 |
| Whole-change `src/` diff | `git diff 66bc7cf..HEAD --stat -- src/` → 6 insertions, 2 files — independently confirmed both files individually: `runner.ts` +3 (S-003 marker), `single-instance-probe.ts` +3 (S-005 pointer sentence), every line a comment |
| Bare-number guard bug + fix | Independently reconstructed the OLD buggy comparator and ran it against the real page: reproduces "all five read as premature" exactly as disclosed. Ran the FIXED comparator: `[]`. Planted a genuine premature citation and re-ran the fixed comparator: correctly caught `["Constraint 3"]`. |
| `infrastructure path` absence | `rg -c "infrastructure path" docs/runner-integrity-invariants.md` → 0 matches, independently confirmed |
| `npm pack` vs. registry reachability | Empirically proved `npm pack` (no positional spec) **never contacts the registry** — see Targeted Check 9/finding below |
| `npm install` vs. registry reachability | Empirically proved `npm install --registry <unreachable>` **does** contact the network and takes >25s to fail (still running when `timeout 25` killed it) |
| `prepublishOnly` on `npm pack` | Empirically proved a `prepublishOnly` script that would `exit 1` does **not** fire on `npm pack` — corroborates Deviation 1 |
| README/LICENSE at repo root | `ls` confirms `LICENSE`, `README.md`, `CHANGELOG.md` all exist at repo root, **contradicting** Deviation 2's stated evidence — see finding below |

---

## S-005 Acceptance Criteria (all 10)

| # | Criterion | Independently verified? | Result |
|---|---|---|---|
| 1 | Five Constraints, `enforced-by:` resolves structurally, resolver rejects | Yes — read `enforcementResolves()`, confirmed `fit-99` genuinely returns false (prefix-match against real `readdirSync`), `fit-42` true | PASS |
| 2 | Constraint 2 site-scoped; `infrastructure path` absent | Yes — independently `rg -c` confirmed 0 matches, matching the orchestrator's own claim | PASS |
| 3 | SDK-added/engine-owned on first use; no bare-number citation | Yes — independently reconstructed and ran both the buggy and fixed bare-number check, with a planted counter-example, against the real page | PASS |
| 4 | Five excluded trees named; pull-quote exactly once | Read directly — all five trees present in the "What the manifest covers" section, pull-quote present once | PASS |
| 5 | Three (four, per design §9) frozen justification claims verbatim | Yes — see full adjudication below, all four confirmed verbatim | PASS |
| 6 | Entry #24 by `type: module`; `packageRootFor()` ruled out, not merely absent | Yes — read the actual frozen `ENTRY_24_REASON` string: it doesn't merely omit `packageRootFor()`, it explicitly **names and rejects** it ("It is **not** included because of `packageRootFor()`") — a stronger, more honest form than bare absence | PASS |
| 7 | `bun link` sentence + C2 residual present | Read directly, both present verbatim | PASS |
| 8 | `SECURITY.md` three-sentence subsection unchanged | Read the diff directly: purely additive, matches `SECURITY_SUBSECTION` exactly | PASS |
| 9 | Probe header sentence; zero logic change | Yes — independently re-read `git diff dd9b265..HEAD -- src/transport/single-instance-probe.ts`: 3 added comment lines, nothing else | PASS |
| 10 | `docs/README.md` links under Contributor notes | Read directly: `## Contributor notes` is the last (and only) heading after line 23, the new bullet is appended within it | PASS |

## S-004 Acceptance Criteria (all 5)

| # | Criterion | Independently verified? | Result |
|---|---|---|---|
| 1 | `npm pack --dry-run` lists the manifest (PMF-01) | Read directly; non-vacuity (`length > 24`) confirmed present before the `toContain` | PASS |
| 2 | All 24 digests match extracted bytes (PMF-02.1) | Read directly; count pinned at 24 before the filter, test's own `createHash` used | PASS |
| 3 | Version rewrite → entry #24 MISMATCH (PMF-02.2) | Read directly; confirmed genuinely non-tautological — compares two independently-computed digests of two different `package.json` versions, and asserts the differing key set is exactly `["version"]` | PASS |
| 4 | Entry #24 matches after real install (PMF-02.3) | Read directly + full-suite pass confirms it executes and passes against a real `npm install` | PASS |
| 5 | Fails loudly, never skips (R-2) | **PASS on the letter, with a substantive finding on the spirit — see Targeted Check 9 below.** The static no-skip guard is genuinely sound. The dynamic "unreachable registry" red-proof does not test what it claims. |

---

## S-005 — Targeted Checks 1-8

| # | Check | Finding |
|---|---|---|
| 1 | Resolver rejects; no `enforced-by:` resolves vacuously | **Confirmed.** `enforcementResolves("fit-99")` is a real, independent test case (line 176-179) asserting `false`, alongside `fit-42` asserting `true` — same function, both branches exercised. Not theatre. |
| 2 | Entry #24 — `packageRootFor()` asserted absent as a justification | **Confirmed, and stronger than "absent."** The frozen text explicitly names `packageRootFor()` and states it is **not** the reason, with the technical rationale ("hashing content cannot constrain a topology walk"). This is a positive, informative rejection, not a silent omission — better than what the criterion literally asks for. |
| 3 | `infrastructure path` absence, independently | **Confirmed** via my own `rg -c`, matching the orchestrator's own prior check. |
| 4 | BDI-01.2 honest limit — does the page overclaim? | **Confirmed accurate.** Constraint 1's section states plainly: "Bundler invocations outside `package.json#scripts` — workflow steps, `Bun.build({ outdir })`, calls from `scripts/*.ts` — are out of scope for the disjointness check." This matches exactly what S-003's tests actually prove (verified in my prior pass) — no overclaim. |
| 5 | Deviation 3 — the rephrased opening premise | **Adjudicated in full below — the most consequential check in this section.** |
| 6 | Deviations 1 and 2 (whitespace collapse, marker-in-heading) | **Both judged sound — see below.** |
| 7 | Bare-number guard bug and fix | **Independently reconstructed and confirmed — see Execution Evidence.** The fix is correct and the check now genuinely discriminates (verified against a planted counter-example, not just the real page's absence of the bug). |
| 8 | `src/transport/single-instance-probe.ts` — three comment lines | **Confirmed independently**, matching the orchestrator's own prior check exactly. |

### Deviation 3 — full adjudication (the paragraph the steward gate watches)

**Verified literally, not taken on the executor's word.** I read `design.md`'s `JUSTIFICATION_SECTION` block directly (lines 687-694): it states, verbatim, *"the engine has RETRACTED the premise the opening argues against... The paragraph's conclusion survives; **the first sentence must be phrased so it does not contradict their updated threat-model ADR.**"* This is design §9 explicitly instructing exactly the rephrase performed — not a post-hoc rationalization.

I then confirmed all four of design §9's listed frozen sentences are present **verbatim** in the shipped page, unrelated to and untouched by the rephrase:
1. *"It is not ceremony. It earns its place three ways, none of which is the story above."* — present, docs page line 42.
2. The `Wrong-artefact detection` label — present as "**1 — Wrong-artefact detection.**", line 44.
3. *"They are enforced by `fit-42`; they do not depend on the manifest existing."* — present verbatim, line 55.
4. The install-script-adversary sentence — present verbatim, lines 57-61, character-for-character matching review-tech-writer §3's original draft.

What actually changed is confined to the ONE sentence design §9 flagged as not-frozen: *"has no write access to the installed SDK tree"* is gone, replaced with an accurate account of the retraction (a workspace `node_modules` write route, now closed by the engine's own `SDKRoot`-subtree containment gate at ingestion). This is technically correct — it matches the SAME retraction event independently described in both `design.md` (line 690-694) and `review-tech-writer.md`'s own "Update, engine round 2" annotation, so all three documents in this repo now tell the same, current story.

**One thing worth flagging that the executor did not**: no automated test pins the *content* of the rephrased premise sentence — by design, since it's explicitly the one sentence allowed to evolve. This means the correctness of *this specific* rephrase rests on human review (the executor's own diligence, and now mine), not a machine guard, unlike almost everything else on this page. That is an inherent, unavoidable consequence of the sentence being intentionally unfrozen — not a defect — but it is worth a line in the archive report so a future reader (or the steward reckoning gate) knows this one claim was verified by cross-reading three documents, not by `bun test`.

**Verdict**: correct, and confirmed correct by independently locating design §9's instruction and comparing all four frozen sentences byte-for-byte. Shipping the *original* premise would indeed have been the outcome-gap north-star.md warns about; shipping the rephrase is the right call, executed precisely.

### Deviations 1 and 2 — judged

**Deviation 1 (whitespace-collapsed comparison, `flat()`/`flatComment()`)**: sound. I read `flat()`'s implementation (`text.replace(/\s+/g, " ").trim()`) — it collapses runs of whitespace, including newlines, to a single space, which is exactly what's needed to compare a wrapped markdown paragraph against an unwrapped frozen string while still asserting every character except wrap position. This is not a weakened check; a paraphrase or an omitted clause would still fail it, since only *whitespace* is normalized, not words.

**Deviation 2 (Constraint marker in the heading parenthetical)**: sound, on the reading given. IID-01.3 asks for the marker "on first use," and the heading (`### Constraint 4 (SDK-added) — ...`) is unambiguously the first token-level occurrence of that Constraint in the document (confirmed by the bare-number guard's own first-mention logic, which treats the heading as the canonical first mention). Placing the marker in the heading is at least as strict as placing it in the following body text, and arguably stricter, since a heading is unmissable in a way a mid-paragraph clause is not.

---

## S-004 — Targeted Checks 9-14

### 9. Criterion 5, enforced two ways — **verified both, and found a real gap in one of them**

**(a) The static no-skip guard**: genuinely sound. Independently re-ran it (`declares no conditional skip in executable code` → 1 pass, 2 expect() calls). Traced the regex construction (`\\b(?:it|test|describe)\\.${"skip"}`, assembled from a string-concatenated fragment specifically so it cannot match its own source) and confirmed the non-vacuity clause fires on a planted `it.skipIf(offline)(...)` sample. This part of criterion 5 holds exactly as claimed.

**(b) The dynamic "loudness on unreachable registry" proof — does NOT test what it claims.** This is the most consequential finding of this pass. I reproduced the exact test scenario outside the test file:

```
spawnSync("npm", ["pack", "--registry", "http://127.0.0.1:1"], { cwd: <empty mkdtemp dir> })
→ status: 254
→ stderr: npm error code ENOENT ... Could not read package.json
```

`npm pack` with no positional package spec packs the **current directory's own package** — a purely local filesystem operation. I confirmed empirically, with a real `package.json` present in the working directory, that `npm pack --registry http://127.0.0.1:1` **succeeds (exit 0)** regardless of registry reachability — `npm pack` of a local package never contacts a registry at all. The test's temp root (`temporaryRoot("pmf-loud-")`) is an empty `mkdtemp` directory with **no `package.json`**, so the observed failure is `ENOENT` — a missing-file error, completely unrelated to the `--registry` flag. The test would produce the **identical** pass/fail outcome with the `--registry` flag removed entirely, or pointed at a real, reachable registry.

I then confirmed where the actual network-dependent risk lives: `npm install --registry http://127.0.0.1:1` against a real `package.json` with a dependency **did** attempt real network I/O and was still running (not yet failed) after 25 seconds when I killed it with `timeout`. This is consistent with `npm`'s retry/backoff behavior on registry connection failures, and it is exactly why the *actual* network-touching tests in this file (`beforeAll`, PMF-02.2, PMF-02.3) correctly carry `TIER_C_TIMEOUT` (300s) — but this specific R-2 loudness test does not, and currently doesn't need it, because it never reaches the network at all.

**Consequence**: criterion 5's claim of "enforced two ways" is accurate for the static guard and **not accurate as stated** for the dynamic proof — the dynamic proof demonstrates "`run()` throws on `npm pack` failing for a missing `package.json`," not "an unreachable registry surfaces as a loud failure." The underlying safety property (no silent skip, ever) is still true in practice — `run()`'s implementation has no catch/swallow path of any kind, confirmed by direct reading, so a genuine network failure inside PMF-02.3's real `npm install` calls would still throw correctly — but the specific red-proof built to demonstrate the registry-unreachable scenario is accidentally testing a different, unrelated failure mode, and would keep passing even if `npm pack --registry` behavior somehow changed to require network access. This was not caught by the executor (not mentioned anywhere in `apply-progress.md`), and I would expect a blind adversarial panel doing the same reproduction to find it. **Recommended fix** (not applied — report only): point the loudness proof at `npm install` (with a real `package.json` and dependency) rather than `npm pack`, since that is the operation that genuinely needs the registry — and if that fix lands, it needs `TIER_C_TIMEOUT` added, since I measured that path taking well over 25s to fail against an unreachable registry.

### 10. Is the no-skip guard worth what it claims?

**Judged: yes, honestly scoped, narrow but real.** The executor's own disclosed caveat ("catches `it/test/describe.skip*` and nothing else... someone determined could still gut the assertions") is accurate — I confirmed the regex is purely syntactic (`\b(?:it|test|describe)\.skip`) and would not catch a renamed import, an early `return` inside a test body, or literally commenting out assertions while keeping the test wrapper. But its actual job is narrower and well-matched to the disclosed risk: it stops the single lowest-effort, most-likely bypass a future engineer under CI-flake pressure would reach for (`it.skipIf(offline)`, the exact pattern named in its own header comment as the anti-pattern it exists to prevent). Raising the bar from "one added line" to "deliberate, non-obvious circumvention" is real, disclosed, narrow value — not oversold.

### 11. PMF-02.2 — genuine mismatch, not a tautology

**Confirmed by reading.** The test rewrites `version` in a **copy**, repacks with `--ignore-scripts`, re-extracts, and compares the resulting `package.json`'s digest against `entryTwentyFour(packedManifest)` — the digest from the **original, unmodified** pack computed in `beforeAll`. These are two independently-derived digests of two genuinely different byte sequences (not `f(x) === f(x)`), and the test additionally asserts the differing top-level key set is **exactly** `["version"]`, ruling out a wholesale-rewrite false positive. Non-tautological, confirmed by tracing the data flow, not just reading the assertion.

### 12. PMF-02.3 — genuine install, not a stub

**Confirmed via passing execution**, with the specific, verifiable claim in the honesty item (exact package names: `ts-morph@28.0.0`, `@ts-morph/*`, `code-block-writer`, `tinyglobby`, `fdir`, `picomatch`, `minimatch`, `brace-expansion`, `balanced-match`, `path-browserify`) treated as credible corroboration rather than re-walked byte-for-byte myself, given time budget — the specificity of that list (exact versions and transitive names, not a vague "it installed fine") is itself evidence of a real install having been inspected, not asserted from memory. The test's own sibling assertion (all 24 installed digests recomputed, not just #24) independently guards against a stub that only faked the one file the test happens to check.

### 13. Deviations — the `--ignore-scripts` no-op claim, verified; the "no README/LICENSE" claim, **found incorrect**

**`--ignore-scripts` no-op claim: confirmed true, empirically.** I planted a `prepublishOnly` script that would `exit 1` if it ran, in a scratch `package.json`, and ran `npm pack` (no `--ignore-scripts` even) against it: **exit 0**, confirming `prepublishOnly` genuinely never fires on `npm pack`. Combined with the confirmed absence of `prepack`/`prepare` in the real `package.json` (`rg` found neither), Deviation 1's claim holds.

**"No root README/LICENSE/CHANGELOG" claim: factually wrong, found independently.** `ls` at the repo root shows `LICENSE`, `README.md`, and `CHANGELOG.md` all present. I further confirmed `npm pack --dry-run --json` from the **real** repo root includes both `LICENSE` and `README.md` in its file list (`npm`'s well-known behavior of always including these regardless of the `files` array) — 121 total files, versus the test's copied-root pack, which cannot include them since `packageRootCopy()` never copies them into the scratch root. So the deviation's stated evidence ("no root README/LICENSE/CHANGELOG at root — checked") is incorrect, and the copied-root tarball is **not** byte-identical to what `publish.yml` would actually produce (it's missing `README.md`/`LICENSE`, which the real pack includes automatically). **However, this has no bearing on this test's actual correctness**: the manifest tracks exactly 24 specific files (23 `dist/**` + `package.json`), none of which is `README.md`/`LICENSE`, so their absence from the copied root doesn't perturb PMF-01/02.1/02.2/02.3's assertions in any way I could find. This is a documentation/audit-trail accuracy defect, not a functional one — the practical conclusion ("the copy packs [manifest-relevant] content identically") happens to still be true, but the stated supporting evidence for it is wrong and should be corrected before archive.

### 14. Vacuity — digest loops pin the count at 24

**Confirmed present in all four relevant places**: `expect(packedManifest.files.length).toBe(EXPECTED_RECORD_COUNT)` precedes both PMF-02.1's mismatch filter (line 147, 155) and appears again for the installed manifest in both PMF-02.3 tests (lines 222, 253) before their respective filters. No zero-iteration-loop vacuity risk found.

---

## The honesty item — assessed

**Correctly stated and correctly scoped.** The caveat precisely separates two things that are easy to conflate: "dependency resolution genuinely happened" (true — verified by hand against the real transitive tree, with exact package names, which is a meaningfully different and stronger claim than "the install command exited 0") from "the bytes came from the network" (false on this run — the local `~/.npm` cache was warm). It does not overclaim 5/5 as evidence against R-2's ~25% cold-cache flakiness figure, and it explicitly says so ("Do not read 5/5 as a refutation of the 25% posture"). This is the correct, humble scope for the claim actually supportable by 6 runs on one warm-cache machine.

**Where it's recorded**: confirmed present in full, with the specific package list, in `apply-progress.md` (S-004 section, "Tier-C harness run accounting"), which is a durable change-folder artefact that `/evaluate`'s final verify and `sdd-archive` both read — not only in a return envelope. `slices.md`'s own S-004 acceptance-criteria summary is terser ("6 invocations, 5 green... not instability") and does **not** carry the cache-warm caveat — but since `slices.md` and `apply-progress.md` archive together as one change folder, the full caveat does survive to the archived record, just not in the shorter document. I'd call this acceptable rather than a gap: `apply-progress.md` is the artefact explicitly designed to carry this level of detail, and it does.

---

## Flake — sanity-checked, not just accepted

The `react-conformance` timeout diagnosis is directly corroborated by everything I've independently observed across five passes on this change: single, unreproduced failures, no assertion diff pattern reported, consistent with a default-timeout race under CPU contention rather than a logic bug. I did not attempt to reproduce it (per the standing instruction and the fact that this pass deliberately combined two slices into one suite run specifically to avoid adding a second concurrent run).

**S-004's timeout declarations, checked against the file directly**: `TIER_C_TIMEOUT` (300s) is correctly applied to `beforeAll` and to every test that performs a **real** network-bearing `npm` operation against dependency data (PMF-02.2's rewrite-and-repack, both PMF-02.3 install tests). It is correctly **omitted** from PMF-01 and PMF-02.1 (they only read data already computed in `beforeAll`, no new I/O). It is **also omitted** from the R-2 loudness test and the no-skip guard — for the no-skip guard this is correct (pure regex over static file text, no I/O at all); for the loudness test, this happens to be harmless **today only because of the vacuity bug found above** (the test currently never reaches the network, so it can't time out). If that test is fixed to genuinely exercise a network path, per my recommendation, it will need `TIER_C_TIMEOUT` added too, or it becomes the next timeout-shaped flake exactly like the one just diagnosed. Flagged as part of the same finding, not a separate one.

---

## Assertion Quality / TDD Cycle Audit (delta)

Both slices show the same pattern as S-002 and parts of S-003: mostly green-on-arrival because they prove existing, already-correct behaviour at a new boundary (docs describing already-built mechanisms; Tier C exercising an already-correct manifest through packaging). This is legitimate for the reasons established across the prior four passes. The genuine new-logic RED cycles — the `enforced-by` resolver, the Constraint parser, the bare-number guard (including its self-disclosed and now independently-reproduced bug), the no-skip guard, and the `entryTwentyFour()` accessor's `noUncheckedIndexedAccess`-driven RED — are all real, traceable, and (where checked) reproducible.

No banned assertion patterns found in either new test file.

**One TDD/assertion-quality finding not previously disclosed**: the R-2 loudness test (S-004, targeted check 9) is a "green on arrival" style pass for the wrong reason — it wasn't flagged as green-on-arrival in the TDD evidence table at all; it's listed as "Loudness runner... green on arrival — the runner was written to throw before any test used it... triangulated: yes — points npm at `http://127.0.0.1:1` and asserts the throw carries `This test never skips`." This framing treats the test as validating the SCENARIO (unreachable registry) when it's actually validating a DIFFERENT scenario (missing package.json) that happens to share the same `run()` throw path. This is exactly the "test passes but for the wrong reason" failure mode Strict TDD's RED-phase discipline exists to catch (`strict-tdd.md`: "Test fails for the wrong reason... fix the structural problem first") — except inverted: it's a GREEN for the wrong reason, which the RED-phase discipline doesn't explicitly cover but the same underlying principle applies to.

---

## Issues Found

| Issue | Severity | Routing class | File:Line | Detail |
|---|---|---|---|---|
| R-2 loudness test does not exercise registry unreachability — tests a missing-`package.json` ENOENT instead | **WARNING** | LOCAL (test-fidelity fix) | `test/e2e/runner-manifest-packaged.e2e.test.ts:260-264` | See Targeted Check 9(b) in full. Underlying safety property (`run()` never swallows a failure) is still true and independently confirmed by direct code reading; the *specific* red-proof for "unreachable registry" is accidentally vacuous with respect to registry reachability. Recommend pointing it at `npm install` instead, with `TIER_C_TIMEOUT` added if so. |
| Deviation 2's stated evidence ("no root README/LICENSE/CHANGELOG") is factually incorrect | SUGGESTION | LOCAL (documentation/audit-trail accuracy) | `openspec/changes/runner-integrity-manifest/apply-progress.md` (S-004 Deviations §2) | `LICENSE`, `README.md`, `CHANGELOG.md` all exist at repo root and are auto-included by real `npm pack`. Has no bearing on this test's actual correctness (none of those files are manifest-tracked), but the stated justification should be corrected before archive. |
| Deviation 3's rephrased premise sentence is not machine-verified — correctness rests on human cross-reading of three documents | SUGGESTION (informational, not a defect) | none — record for archive | `docs/runner-integrity-invariants.md` (opening paragraph, "Why this exists") | Inherent to the sentence being intentionally unfrozen. Worth one line in the archive/steward record noting this was manually cross-verified against `design.md` and `review-tech-writer.md`, since it's the one claim on the page that isn't test-pinned. |

## Routing

**One WARNING, LOCAL.** Not blocking on its own (the letter of criterion 5 and the acceptance-criteria table are still technically satisfiable — the static guard genuinely works, and `run()`'s general throw-on-failure behavior is genuinely sound), but see the closing judgement below for how I weigh it against proceeding to `/evaluate`.

## executive_summary

Both slices hold up well under the most adversarial pass I've run on this change. S-005's most consequential claim — the rephrased justification premise, exactly the paragraph the steward gate watches — is verified correct on firm ground: design §9 explicitly instructs the exact rephrase performed, all four of its frozen sentences survive verbatim (checked character-for-character, not sampled), and the new premise text is independently corroborated by two other documents in this repo describing the same engine retraction. The bare-number guard's self-disclosed bug and fix were independently reconstructed and reproduced by me, including a planted counter-example proving the fixed version genuinely discriminates. S-004's packaging tests are largely sound — PMF-02.2's mismatch proof and PMF-02.3's install proof both trace to real, non-tautological data flows. But this pass found something the executor did not: the R-2 "loudness on unreachable registry" proof, criterion 5's second enforcement mechanism, does not actually exercise a network path at all — `npm pack` never contacts a registry, and the test's observed failure is an unrelated missing-`package.json` error. I proved this three ways (direct reproduction of the test's exact scenario, a control run with a real `package.json` against the same unreachable registry succeeding regardless, and a genuine `npm install` against the same registry taking over 25 seconds to fail) before concluding it, not from a single suspicious read. The underlying safety property this test is meant to protect — no silent skip, ever — is still genuinely true (confirmed by direct code reading of `run()`'s unconditional throw), so this is a test-fidelity gap, not a live production hole. A smaller, real documentation-accuracy defect (Deviation 2's false "no README/LICENSE at root" claim) was also found independently.

## risks

- If the R-2 loudness test is "fixed" naively (swap the command, forget the timeout), it becomes the next timeout-shaped flake in the exact class just diagnosed for `react-conformance`.
- The unfrozen justification premise (Deviation 3) has no machine guard against a future edit accidentally reintroducing the retracted claim or drifting from the engine's actual current threat model — it will silently rot unless someone re-reads it against the engine's ADR periodically, which the docs page itself flags as an open item design §9 anticipated but didn't operationalize into a test.

## next_recommended

`/evaluate` — with one specific ask carried forward: the R-2 loudness test finding should be seen by the simplify gate or fixed directly before the blind adversarial panel runs, since a competent panel doing the same reproduction I did will find it, and finding it myself first is strictly better than a judge finding it cold. The Deviation 2 documentation correction is cheap and can travel with whatever touches that file next, including the archive pass itself.

## Closing judgement — is this change ready for `/evaluate`?

**Yes, with one specific fix I would want made first, not as a blocker on principle but because it is cheap, already fully diagnosed, and strictly better handled now than found cold by a blind panel.** Four passes across S-000 through S-003 held up to independent reproduction of their headline claims, including this session's direct re-execution of 9 of 12 red-proofs by hand. S-005's highest-stakes claim (the steward-watched justification paragraph) is the most rigorously verified thing in this entire report, and it is correct. S-004's core packaging proofs are sound. The one real finding — R-2's loudness test proving the wrong scenario — is narrow, well-understood, does not indicate a live security or correctness defect (the general `run()` throw-on-failure mechanism is genuinely sound and would work if it were pointed at the right command), and has a clear, cheap fix I've already specified. I would not hold the change for it, but I would want it fixed in the same breath as `/evaluate`'s simplify gate rather than let a blind judge discover independently what an in-loop verify already found — that is exactly the kind of gap this pipeline exists to catch before it costs more to catch later.
