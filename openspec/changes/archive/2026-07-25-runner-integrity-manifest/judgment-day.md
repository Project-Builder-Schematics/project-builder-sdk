# Judgment Day — runner-integrity-manifest

**Protocol**: blind adversarial review, two independent judges (`model: opus`), Round 1.
**Run**: 2026-07-25, after `sdd-verify --mode=final` returned `adversarial_review: required` (triage L + sensitive area).
**Verdict**: **ESCALATED** — owner decided to register the findings and merge, rather than iterate in this cycle.

## Protocol notes

Both judges received **only** the code diff (`git diff 7ef64ac...HEAD`, restricted to the change's source and test files) and the **signed spec**. They were explicitly forbidden `design.md`, `north-star.md`, `apply-progress.md`, all five `verify-in-loop-*.md`, `verify-report.md`, `simplify-report.md`, the council reviews, and the orchestrator's transcript. Neither knew the other existed.

That blindness is the point, and it paid: **five in-loop verifies, a four-lens simplify gate and a final verify all missed the two confirmed defects below.** They missed them for a structural reason — every earlier gate asked *"does the red-proof fire on the mutation the spec names?"*, and the spec names the simple forms. The judges invented new mutations (an aliased import, a `./`-prefixed path) and proved them with their own probes against the real exported functions.

No project skill registry is configured (`.atl/skill-registry.md` is present but empty), so both judges reviewed against repo conventions and general engineering judgement rather than project-specific compact rules.

---

## Verdict table

| # | Finding | Judge A | Judge B | Severity | Status |
|---|---|---|---|---|---|
| 1 | `createRequire` anchor exemption permits execution, not just resolution | ✅ | ✅ | **CRITICAL** | **Confirmed** |
| 2 | Bundler-disjointness compares raw strings; `./` and trailing `/` evade | ✅ | ✅ | **CRITICAL** | **Confirmed** |
| 3 | RP-12 does not pin its fixture; degrades to vacuity on any JSDoc edit | ✅ | ✅ | **CRITICAL** | **Confirmed** |
| 4 | `package.json#version` unvalidated → `packageVersion` silently dropped | ✅ | ✅ | WARNING (real) | Confirmed |
| 5 | Post-derivation throw exits non-zero leaving a **stale** manifest | ✅ | ✅ | WARNING (theoretical) | Confirmed |
| 6 | `writeFileSync` is not atomic; truncated manifest reachable | ✅ | ✅ | WARNING (theoretical) | Confirmed |
| 7 | Computed member access evades the Constraint-4 deny set | ✅ | ✅ | WARNING (theoretical) | Confirmed |
| 8 | Directory specifier enters the closure, misdiagnosed as `unreadable-file` | ✅ | ✅ | SUGGESTION | Confirmed |
| 9 | BOM non-vacuity guard is `> 0` where the CRLF sibling pins `=== 23` | ✅ | ✅ | SUGGESTION | Confirmed |
| 10 | CST-04.3 non-vacuity counts **substring** hits; 8 come from comments | ✅ | ❌ | WARNING (real) | Suspect (A) |
| 11 | Docs hardcode 23/24 counts, unbound to the derived closure | ✅ | ❌ | WARNING (real) | Suspect (A) |
| 12 | BPI-04.1 spawns the generator against the **real** `dist/` mid-suite | ✅ | ❌ | WARNING (real) | Suspect (A) |
| 13 | `publishRunSteps` treats YAML job order as execution order | ✅ | ❌ | WARNING (theoretical) | Suspect (A) |
| 14 | Symlink-escape check not applied to the **entry** file | ✅ | ❌ | WARNING (theoretical) | Suspect (A) |
| 15 | `node:` prefix not validated against `builtinModules` | ✅ | ❌ | SUGGESTION | Suspect (A) |
| 16 | JSDoc identifiers **are** scanned; `{@link createRequire}` steals the anchor slot | ❌ | ✅ | WARNING (real) | Suspect (B) |
| 17 | Bare `Function` identifier ban fails ordinary JS (`x instanceof Function`) | ❌ | ✅ | WARNING (real) | Suspect (B) |
| 18 | `srcPathFor`/`srcOf` extension rewrite is lowercase-only | ❌ | ✅ | SUGGESTION | Suspect (B) |

**Confirmed**: 3 CRITICAL, 1 real WARNING, 3 theoretical WARNINGs, 2 SUGGESTIONs.
**Contradictions**: none — the judges never disagreed on a shared finding, only on what they looked at.

---

## The three confirmed CRITICALs

### 1. The anchored `createRequire` exemption permits execution

`scripts/derive-runner-closure.ts:198-207`

The deny-scan exempts the **first non-import `createRequire` occurrence** in `transport/single-instance-probe.js`. Nothing checks what that occurrence does. Both judges probed the real module:

```
anchor file = 'import { createRequire } from "node:module";
               export const m = createRequire(u)("./x.js");'
→ violations: []
```

Changing the probe's `createRequire(u).resolve(spec)` to a direct `createRequire(u)(spec)` — one deletion — turns the closure's one exempted site into an unhashed CommonJS **execution** point, with a green build. That is precisely what Constraint 4 exists to forbid.

Two documents claim the restriction the code does not enforce: `docs/runner-integrity-invariants.md:113` ("whose use is resolution-only") and the tool's own rendered rule at `derive-runner-closure.ts:368` ("permitted: `createRequire(...).resolve(...)` at the anchored site"). **This is the same defect class already found and fixed twice inside this change** — a message promising what the code does not deliver.

Judge A additionally reports that **aliasing** the import in the anchor file (`import { createRequire as cr } from "node:module"; cr(u)("./x.js")`) yields zero violations, because the exemption keys on the identifier text `createRequire`, which then appears only inside the skipped import declaration. If that generalises beyond the anchor file it makes the ban defeatable repo-wide. **Not independently verified** — the orchestrator's earlier probe covered the import, an indirect variable, a direct call and `.resolve`, but not the aliased form.

**Fix intent**: require the exempted occurrence to be the callee of a call whose result is immediately `.resolve`d, and treat any aliased binding of `createRequire` in the anchor file as non-exempt. Add red-proofs for the execute form and the aliased form.

### 2. Bundler-output disjointness compares raw strings

`test/support/closure-integrity-checks.ts:124-141`

Targets and closure paths are compared without normalisation. Both judges probed against `closurePaths = ["dist/transport/runner.js"]`:

| Target | Result | Should be |
|---|---|---|
| `--outdir dist/transport` | violation | violation ✅ |
| `--outdir ./dist/transport` | **none** | violation ❌ |
| `--outfile ./dist/transport/runner.js` | **none** | violation ❌ |
| `--outdir dist/transport/` | **none** | violation ❌ |

`docs/runner-integrity-invariants.md:86-87` names exactly this drift — *"someone points the bundler already here at the runner for startup performance"* — as the realistic Constraint-1 failure, and `bun build --outdir ./dist/x` is the idiomatic spelling. The BDI-01.1 red-proofs only exercise the bare form, so the gap is untested. Judge B also notes `-odist/x.js` (no separator) is unmatched, since the pattern requires `[=\s]+`.

Constraint 1 has two other legs (baseline drift, graph-preserving emit) that would likely catch the consequence, but the check the documentation attributes to it does not hold as written.

**Fix intent**: normalise both sides (`posix.normalize`, strip leading `./`, collapse trailing `/`) before comparing; add a red-proof per spelling.

### 3. RP-12 does not pin its fixture

`test/fitness/fit-42-runner-closure-integrity.test.ts:169-194`

REQ-RCD-03.3 states the day-one scenario is asserted against two files **by name** *"so it can never be 'fixed' by deleting the examples."* The three tests assert: the derivation has no violations; the two files appear as file records; and `core/schema.generated.js` is not a node. **None asserts the JSDoc is still there.** Deleting the `@example` blocks from `src/core/authoring-error.ts:229` and `src/core/context.ts:352` leaves all three green — the outcome the spec says must be impossible.

Judge A found the absence assertion is additionally **unfalsifiable**: the guarded specifier is `"./schema.generated.ts"`, which resolves to node id `core/schema.generated.ts`, never `.js`. The assertion names a path the walker cannot emit from that specifier, and `dist/core/schema.generated.js` does not exist on disk. A regressed walker passes.

**Fix intent**: assert the two emitted files still contain a bare and a relative specifier inside a comment, and add a Tier-A plant of both forms in a synthetic tree where the target exists.

---

## Followups — block A: preconditions for `0.1.0`

These two are the reason the tripwires are the change's durable value rather than ceremony. Ship `0.1.0` without them and the documentation overstates what is enforced.

1. **Constraint-4 anchor must be resolution-only** (finding 1). Verify the aliased-import variant first — it determines the blast radius.
2. **Bundler-disjointness path normalisation** (finding 2).

## Followups — block B: quality

3. RP-12 fixture pinning + Tier-A plant (finding 3).
4. Validate `package.json#version` before writing; fail closed when absent or non-string (finding 4).
5. Route every generator failure — including `JSON.parse` and `realpathSync` — through the manifest-removing path (finding 5).
6. Write-then-rename for atomicity; correct the comment claiming truncation has no source (finding 6).
7. Flag `ElementAccessExpression` with a string-literal argument naming a denied member; consider `register`/`registerHooks`/`Worker` (findings 7, 16, 17).
8. Classify a directory specifier as its own failure rather than `unreadable-file` (finding 8).
9. Pin the BOM check's source count to 23, matching its CRLF sibling (finding 9).
10. Count AST identifiers, not substrings, in CST-04.3's non-vacuity guard (finding 10).
11. Derive the doc's 23/24 counts from the baseline instead of frozen literals (finding 11).
12. Run BPI-04.1 against a copied root like every other mutating case (finding 12).
13. Order `publish.yml` jobs by `needs` before treating array index as sequence (finding 13).
14. Apply the symlink-containment check to the entry file (finding 14).
15. Validate `node:` suffixes against `builtinModules` (finding 15).
16. Exclude JSDoc subtrees from the identifier walk, and delete the comment claiming they are already absent (finding 16) — **note this contradicts an assertion made earlier in the cycle; verify before acting**.
17. Match `Function` only as callee of a `New`/`CallExpression` (finding 17).
18. Make the `.js/.mjs/.cjs` → `.ts` rewrite case-insensitive (finding 18).

---

## Why this is ESCALATED rather than APPROVED

The protocol's Round 1 rule is to present the verdict and let the owner decide whether to fix. The owner chose to **merge now and fix after**, on the grounds that the engine's `PC-RUN-01` had been blocked for the whole cycle by work that the slice plan itself had identified as separable — the handover point was after S-003, and S-004/S-005 were explicitly *"not required for the engine handover."* That is a correct reading of the plan and the delay was an orchestration error, not a property of the change.

The merge is defensible on the merits: neither confirmed CRITICAL is externally exploitable (both require a commit to this repo), the manifest itself is correct and byte-reproducible, and the engine unblocks either way. What is deferred is a set of guards against future drift — and the drift they would miss is, by construction, the kind nobody notices. That is exactly why they are written down here rather than carried in anyone's memory.

**Judgment day is not complete.** It reaches `APPROVED` only after block A is fixed and both judges are re-run blind on the resulting diff.

---

# Round 2 — after the fixes. **NOT APPROVED.**

**Run**: 2026-07-25. PR #50 merged to `main` in between, so the manifest itself is shipped; Round 2 reviews **PR #51** (`c780084...7686a47`, 5 files, +241/−10) — the four hardening fixes.

Both judges relaunched blind on the new diff, with **no knowledge of Round 1's findings**. They converged again.

## Confirmed by both judges

| # | Finding | Severity |
|---|---|---|
| R2-1 | A bare **and** aliased `createRequire` import together evades the anchor exemption entirely | **CRITICAL** |
| R2-2 | The RP-12 "phantom node" assertion is **still unfalsifiable**; its new justifying comment is factually wrong | **CRITICAL** |
| R2-3 | The invalid-`version` failure reuses the `unreadable-file` rule — 4 of 5 rendered lines are false | WARNING (real) |
| R2-4 | A malformed `package.json` throws past `failClosed`, leaving a **stale manifest** on disk | WARNING (real) |
| R2-5 | **False positive introduced**: the exemption now rejects `module.createRequire(u).resolve(s)` — the idiom the anchor file's own header documents | WARNING (real) |
| R2-6 | A path spelling still escapes disjointness (`.//dist/x` per Judge A, `--outdir .` per Judge B) | WARNING (theoretical) |

Suspect-A-only: element-access bypass (pre-existing), exemption granted when the anchor imports `createRequire` from nowhere, version-test subprocess cost. Suspect-B-only: version guard placed after the 24-file hashing pass.

## R2-1 — the fix closed a shape, not the class

`createRequireLocalNameIn` returns on the **first** named specifier matching `createRequire`, so it tracks exactly one binding. Put the unaliased form first and every alias becomes invisible: `anchorAliased` is `false`, so `isAnchorAliasUse` never fires; the alias identifier is not in `DENIED_IDENTIFIERS`; and the bare identifiers all sit inside import declarations, which are skipped.

**Both judges proved it end-to-end against the real built tree.** Judge B's minimal reproduction — only the anchor's import line changed, the legitimate `.resolve` call left untouched:

```js
import { createRequire } from "node:module";
import { createRequire as cr } from "node:module";
cr(import.meta.url)("/tmp/evil.cjs");
```

```
runner-manifest: 24 files -> dist/runner-manifest.json
EXIT=0 — zero violations
```

A valid manifest is published while arbitrary CommonJS from outside the closure executes before the author's code, covered by no digest. `REQ-CST-04.1` does not hold. The behaviour is **order-dependent**: alias-first is caught, bare-first is not — which is exactly why the fix's own new red-proof (alias-only) passes while the property fails.

**The orchestrator's own probe missed it too**: it tested aliased and unaliased separately, never combined.

**Fix direction — invert the invariant rather than matching more shapes.** The anchor file must contain **exactly one** `createRequire` binding, unaliased; anything else forfeits the exemption. That is decidable and has no tail. Continuing to enumerate AST shapes is what produced this round.

## R2-2 — the RP-12 fix did not fix it

The assertion moved from `core/schema.generated.js` to `core/schema.generated.ts` on the reasoning that `.ts` "is what a regressed walker actually WOULD add". Both judges disproved it: `dist/core/schema.generated.ts` does not exist, so `classifySpecifier` returns `unresolvable-specifier` **before** any node is pushed. Judge B probed the maximal regression — a genuine non-JSDoc import of that exact specifier — and got `nodes: ["core/context.js"]`, `violations: ["unresolvable-specifier"]`, no node added. Both spellings are equally unfalsifiable.

The property **is** covered, by the sibling `violations === []` assertion and by the new Tier-A negative test. **Recommended: delete this test rather than repair it.** A test that cannot go red, carrying a comment that misdocuments why it exists, is worse than no test.

## Assessment

One of the three Round-1 fixes held (path normalisation, modulo R2-6's edge). One closed a shape but not its class **and** introduced a false positive. One did not fix its defect and documented a false reason for the change.

The pattern is the lesson: **these are AST-shape checks, and shapes have a long tail.** Each round closes the spellings someone imagined. If Round 3 surfaces further variants of the same class, the answer is not another round — it is that Constraint 4 wants a *structural invariant*, not a shape scanner, and that is a design decision rather than a fix.

Nothing here is on `main` by accident: PR #50 shipped the manifest — correct, deterministic, digests verified — and the engine is unblocked. All of Round 2 concerns tripwire hardening in the still-open PR #51. Abandoning #51 is a real option with no cost to the delivered outcome.

---

# Fix iteration 2 — R2-1 and R2-2 only (owner-scoped)

Owner decision, 2026-07-25: **one final fix, no Round 3.** The scope was cut to the two
CONFIRMED CRITICALs; R2-3, R2-4, R2-5 and R2-6 were registered as debt instead of fixed.

| Finding | Action | Commit |
|---|---|---|
| **R2-1** anchor exemption evadable via unaliased decoy + alias | **Fixed — invariant inverted** | `4b4914a` |
| **R2-2** RP-12 real-tree assertion unfalsifiable | **Deleted, not repaired** | `39f3349` |
| R2-3 version guard renders under the wrong rule | registered as debt | — |
| R2-4 `JSON.parse` unguarded outside `failClosed` | registered as debt | — |
| R2-5 namespace-form false positive at the anchor | registered as debt | — |
| R2-6 `.//dist/x` escapes disjointness normalisation | registered as debt | — |

**R2-1 — the invariant, not the shape.** The exemption is no longer *searched for* among
whatever the anchor imports; it is a shape the anchor must **prove**: exactly one
`createRequire` binding, unaliased. Any other arrangement forfeits it outright, and every
bound name found becomes denied text — so no spelling reaches a name the text ban cannot see.
This follows Round 2's own fix direction verbatim: invert the invariant rather than enumerate
more AST shapes.

Red-proof first, per Strict TDD: the new fixture (unaliased decoy + aliased execution)
returned `violations: 0` against the pre-fix scanner — the judges' exploit, reproduced in the
suite — then went green. `test/fitness/fit-42-runner-closure-integrity.negative.test.ts`,
REQ-CST-04.3.

**R2-2 — deleted.** The property is proven by the Tier-A negative test, which plants the
relative target **on disk** and pins `nodes` to an exact set, so it can genuinely go red. The
real-tree assertion could not, under either spelling. A test that cannot fail, carrying a
comment that misdocuments why it exists, is worse than no test.

**Verification**: suite **2334 pass / 0 fail**, 196 files. `tsc --noEmit` exit 0.

---

# JUDGMENT: ESCALATED

Terminal state per the protocol's own rule — after two fix iterations the owner decides
whether to continue, and the owner chose to stop. This is **not** an approval, and the archive
must not read as one: two independent judges found this change's tripwires defective, one
fix iteration did not fully close them, and four findings ship unresolved.

**What is settled.** The manifest itself was never in question in either round. PR #50 is
merged: `dist/runner-manifest.json` is correct, deterministic, digest-verified, fail-closed,
and the engine's `PC-RUN-01` is unblocked. Every Round-1 and Round-2 finding concerns the
**build-time tripwires** that guard against future drift — not the artefact they guard.

**What is not.** Constraint 4's enforcement is an AST-shape scanner, and shapes have a long
tail. Two rounds of judging closed the spellings two judges imagined; nothing establishes that
the set is now closed. R2-1's fix is the first that inverts the burden of proof rather than
adding a case, which is why it is the first with no obvious next variant — but "no obvious
variant" is not "decidably none".

The honest summary: **this cycle needed roughly 25 review-and-fix rounds, and that count is
itself the finding.** The mechanism was mismatched to the constraint from the design phase
onward. Iterating did not fix that; changing the mechanism did, once, at the very end. The
remaining debt below should be read in that light — as candidates for a *different* approach
to Constraint 4, not as a queue of shapes to patch.
