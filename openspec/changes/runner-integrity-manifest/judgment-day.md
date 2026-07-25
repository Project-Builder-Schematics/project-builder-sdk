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
