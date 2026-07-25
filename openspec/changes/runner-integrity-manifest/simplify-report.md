# Simplify Gate Report — runner-integrity-manifest

**Gate**: `sdd-simplify` (L → 4-lens parallel fan-out) · **Run**: 2026-07-25, at `/evaluate` start,
after the last in-loop verify `PASS` and BEFORE `sdd-verify --mode=final`.
**Scope**: the whole diff (`7ef64ac...HEAD`), once — never per slice.
**Status**: `ok` · **Findings**: applied 9, skipped 3, reverted 0.

---

## Method

Four `cleanup-reviewer` lenses spawned in one message, in parallel, each **blind**: it received the
diff, the REQ-ID titles, and its single angle — never the orchestrator's transcript, another lens's
findings, or any apply-phase reasoning. Twelve raw findings came back; deduped to nine actionable,
three skipped.

Every lens prompt carried the guardrail that behaviour is pinned by a signed spec, plus two
change-specific ones that mattered: some duplication here is **load-bearing** (red-proofs restate
fixtures so a planted mutation cannot silently fix a sibling), and isolation beats speed (several
tests copy a tree per case specifically so mutations cannot leak).

Lenses were instructed not to run the suite. Concurrent runs in this worktree cause CPU contention
that trips a known near-timeout test — see the flake note in the change's state mirror.

## Applied

| # | Lens | Finding | Fix | Commit |
|---|---|---|---|---|
| 1 | simplification (out-of-lane) | The real-tree drift check computed `drift` then asserted a bare boolean; `renderBaselineDrift` was **never called on the real-tree path**, only in the negative test asserting its own format. A maintainer who genuinely drifted the closure got `Expected: false / Received: true` instead of the instructional message naming the added node and the edge that admitted it. | The rendered drift message is now the assertion's own failure output. Pass/fail conditions unchanged — only what a failure *says*. | `2685381` |
| 2 | efficiency | Every closure file and `package.json` was read from disk **twice per build** — once for AST parsing, once for hashing. 24 redundant reads on every `bun run build`, for every developer and CI job. | `deriveRunnerClosure` caches the bytes read during the walk; the generator hashes from those. | `92e0774` |
| 3 | efficiency + simplification | `readSpecifiers` constructed a fresh ts-morph `Project` per call (~92 instantiations for two passes) while `deriveRunnerClosure` correctly reused one; the construction options were duplicated verbatim in the same module. | Extracted `getSharedProject()`, used by both. Safe because every `createSourceFile` already passes `overwrite: true`. | `2858d3d` |
| 4 | reuse | The `RunnerManifest` shape existed in **three** copies — the exported type plus a hand-rolled local interface in each of two test files. | Both tests import the exported type; local copies deleted. | `8a2730e` |
| 5 | simplification + altitude | `ENTRY_RELATIVE_PATH` declared as an independent literal in three files; `DIST_DIR_NAME`/`SRC_DIR_NAME`/`MANIFEST_RELATIVE_PATH`/`BASELINE_RELATIVE_PATH` each duplicated. | Exported once from `derive-runner-closure.ts`, alongside the sibling identity constants it already exported for the same reason. Only the path literals are shared — never the derivation logic, so the tests stay independent. | `8a2730e` |
| 6 | altitude | The e2e file hand-rolled `sha256Of`, duplicating `test/support/scratch-consumer.ts`'s `hashFile` — which the change's own fit-42 test already imports for the identical purpose. | Import the shared helper. **Verified safe before applying**: `hashFile` is a test-side implementation independent of the generator's `sha256File`, so this does not create the `f(x) === f(x)` tautology the file's header warns against. That warning concerns the *generator's* hasher and still stands. | `39ff6a7` |
| 7 | efficiency | `deriveRunnerClosure` re-run 14 times against two trees never mutated in that file. | Two memoized derivations, deeply frozen so a future mutation fails loudly instead of silently contaminating a sibling test. All 14 call sites verified read-only first. | `dc22812` |
| 8 | efficiency | Two full `npm install --ignore-scripts` runs of the identical tarball — in Tier C, the slowest and most cold-cache-exposed part of the suite. | One install shared via `beforeAll`. **Both assertions survive intact** and each still recomputes its own digests from the shared tree, so neither can pass vacuously. E2E file runtime roughly halved. | `e01c56e` |
| 9 | simplification | Three near-identical consumer `package.json` writers differing only in name and `type`. | One helper. Setup scaffolding, not a pinned assertion. | `adcb99f` |

## Skipped, with reasons

| Lens | Finding | Why skipped |
|---|---|---|
| altitude | Fold `node:vm` out of `classifySpecifier`'s special case into a `DENIED_SPECIFIERS` set in `denyScan`, so the "closure may RESOLVE, never EXECUTE" invariant lives in one mechanism instead of two. | A genuine altitude insight, and the strongest conceptual finding of the pass. But it sits in the **security-critical classifier**, and CST-06 pins violation message shapes — changing which rule fires could change what a maintainer is told. Behaviour-change risk at the final gate outweighs the tidiness. **Registered as a followup.** |
| altitude | Unify `srcOf` (`closure-integrity-checks.ts:195`) with `srcPathFor` (`derive-runner-closure.ts:405`) — the same `.js/.mjs/.cjs → .ts` rewrite hand-rolled twice. | That module deliberately carries **no repo imports** so it adds nothing to the module graph FIT-27 walks from `test/support/**`. The constraint is real and was re-checked twice during the build. The duplication is the price of the guard. The lens flagged this caveat itself rather than proposing blindly. |
| altitude | Converge fit-42's `pristineRoot` and the e2e file's `temporaryRoot`/`temporaryRoots` on a shared whole-file-lifetime scratch helper. | Attempted, then skipped by the builder on evidence: the two have a genuine **shape mismatch**, not a naming one — `pristineRoot` is a single seeded slot, `temporaryRoot(prefix)` a multi-call accumulator with a different prefix per site. The existing `scratchDirFactory` also unconditionally seeds a `collection.json` marker (ADR-0046, load-bearing for other callers), which would plant an unrequested file in what must be an exact `dist/` + `package.json` mirror. Real design work, not mechanical dedup. Cost of skipping: a future third file may hand-roll a third variant. Accepted. |

## Verification

| Check | Result |
|---|---|
| Full suite | **2319 pass / 0 fail**, 5099 `expect()` calls, 196 files — **identical to the pre-gate baseline** |
| `tsc --noEmit` | exit 0 |
| Manifest byte-identity | Proven by stash → rebuild with the unmodified generator → pop → rebuild with the fix → `diff` of the two manifests: **identical**. Both `257ba3fe…` |
| Net diff | +195 / −138 across 5 files |
| Reverted fixes | none — every applied fix landed on the first attempt |

**A note on the manifest hash, because it corrects the orchestrator.** The launch prompt quoted
`1d5cc95e…` as the expected digest. That value is stale: it is S-000's, and S-003 later added the
`SANCTIONED-FACTORY-IMPORT` comment to `src/transport/runner.ts`, which changes `dist/transport/runner.js`'s
bytes and therefore the manifest digest by design. The correct current value is `257ba3fe…`. The builder
declined to trust the supplied number and ran the stronger check instead — byte-identity against what the
*unmodified* code produces on this tree. That is the right instinct, and the reference hash was the
orchestrator's error, not a regression.

## Assessment

The gate earned its place, on one finding above all. **#1 was invisible to five in-loop verifies** because
it is not a correctness defect — the check fires correctly on drift either way. It is a *journey* defect:
north-star.md describes the closure-drift path as the change's best-designed journey, where "CI fails with a
permissive-register message naming the added node and the edge that admitted it", and that message existed,
was tested, and was **not wired to the real-tree path**. Only a whole-diff pass with an angle other than
correctness was going to surface it.

#2 is the second-most valuable: 24 redundant file reads on every build is a cost paid by every developer
forever, and it was equally invisible per-slice — S-000 built the derivation and S-000 built the generator,
and neither slice's frame contained both reads at once.

Three findings were skipped and all three were skipped for a *stated mechanism*, not for convenience. Two
lenses volunteered their own caveats rather than proposing blindly, which is what the anti-anchoring setup
is supposed to buy.

**Non-blocking by contract**: `sdd-verify --mode=final` is the safety net for everything this pass touched,
and it runs next.
