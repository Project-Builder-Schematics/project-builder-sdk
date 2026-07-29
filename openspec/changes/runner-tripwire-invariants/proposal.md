# Proposal: Runner Tripwire Invariants

**Change**: `runner-tripwire-invariants` · **Triage**: L · **Persona lens**: synthesis (architect / QA / security / PM / BA records)

## Intent

The runner integrity tripwires are the *only* guard on the closure-sealing lemma — that "these 24 manifest files" ≡ "everything that runs before the factory import". The manifest shipped correct; the tripwires did not. Two judging rounds closed five AST spellings and neither round could establish the set was closed, because `denyScan` is default-**pass**: it iterates identifiers and `continue`s whatever it does not recognise. Three escapes are live on `main` today, probe-confirmed: `globalThis["ev"+"al"]("1+1")`, `(()=>{}).constructor("return 1")()`, and `node:child_process` (spawning `node -e` is verbatim the arbitrary-code-execution bypass Constraint 4 names). A fourth surface — the publish path — runs zero tests and `main` carries no branch protection, so no tripwire assertion has ever executed against a published artefact. The payoff of this change is not "fewer bugs"; it is **no third judging round**. A mechanism that closes 90% of a tail buys 0% of that.

## Scope

### In Scope

- Replace Constraint-4's deny-scan with a **default-deny capability-admission property**, gated structurally by a totality fitness function (the pair is one deliverable, not two)
- Close R2-5, R1-7, R1-16, R1-17 and the node:vm altitude fold *by mechanism*; add the four owner-ruled primitives (`node:child_process`, `node:worker_threads`, `WebAssembly`, `module.register`/`registerHooks`)
- Exemptions become file-level proof obligations covering both the `createRequire` anchor and the sanctioned dynamic-`import()` site (anchor-drift and re-export-laundering holes included)
- Resolution-based path verdicts for bundler disjointness, undecidable ⇒ explicit violation (R2-6 + five confirmed escaping spellings)
- Fail-closed generation totality as ONE property, absorbing R2-4 + R1-5 + R1-6
- Diagnostic honesty: the reported rule is true of the violation (R2-3); messages asserted whole, never by substring
- Publish-path integrity: explicit rebuild step declared in `publish.yml`, suite gate, R1-13 execution-order guard, shipped with the react-conformance timeout fix
- Spec-honesty bundle (ruling 7): R1-15, R1-8, RMD-05.1 and RMD-01.2 wording reconciled to what is enforced
- Full 23-row debt-register re-audit: every row leaves with exactly one evidenced disposition

### Out of Scope

- 0.1.0 go-live sequence and its release-checklist row (this change fixes *current-pipeline* integrity, not go-live)
- User-reachable integrity-mismatch diagnostic; loader observation for Constraint 1; any engine-side work
- Manifest generation/determinism machinery (shipped, correct — and byte-neutrality is a gate here)
- **M3.6 script-chaining** — OUT with reason, registered as a fresh dated debt row (silence is the register's own failure mode)
- **R1-14** (entry file exempt from symlink containment) — NOT pulled in; re-registered as a fresh dated row carrying the security lens's Tier-1 ranking alongside explore's dismissal
- A generated capability-baseline artefact, a ts-morph mutation harness, and the semantic-oracle fitness function — declined by ruling 8 / PM budget, each registered with its re-open trigger

## Capabilities

### New Capabilities

None. The eight families below are REQ families inside two existing spec domains — consistent with the parent cycle, which already carries six families (RCD/RME/RMD/BPI/CST/BDI) in one spec file.

### Modified Capabilities

- `runner-integrity-manifest`: Constraint-4 replaced by capability admission; CST/RCD/RMD/BDI/BPI touched
- `publish-pipeline-hardening`: publish-path integrity proven behaviourally + suite gate in `publish.yml`

### Capability Families (the contract `sdd-spec` writes against)

| # | Family | Prefix | Contract |
|---|---|---|---|
| C1 | capability-admission-totality | CAP | Every node of a closure file's **capability surface** classifies into exactly one of {admitted, violation, unclassifiable-construct}; default = violation; unclassifiable is fail-closed; **ambiguity ⇒ violation is a REQ, not prose**. Classified-node count == present-node count, red-proven. Merges BA's C1+C2 (inseparable by their own finding). Absorbs R1-15 (`node:` not in `builtinModules` ⇒ unclassifiable, not builtin). |
| C2 | capability-primitive-register | PRM | ONE register, ONE enforcement site: `eval`, `Function`, `createRequire`, `Bun.plugin`, `process.binding`, `node:vm` (fold its separate `classifySpecifier` case in) + the four ruled-in primitives. Every member has a producing fixture; a member with no fixture is itself a violation. |
| C3 | exemption-proof-obligation | XPO | Exemptions are proofs **on the file** (exactly one unaliased binding, forfeit on any other arrangement), never predicates on an occurrence. Covers the `createRequire` anchor (named **and** namespace form green — R2-5) and the sanctioned dynamic-import site (marker-carrying, per-site). Anchor must be a node of the derived closure (M1.13); re-export laundering closed (M1.12). |
| C4 | spelling-invariant-path-verdicts | PTH | Verdicts by resolution, not string normalisation; all candidate readings per token; `-o` short form extracted; `--outdir=$VAR` becomes an explicit unclassifiable violation, never a pass. Closes R2-6 + M3.1-M3.5. |
| C5 | fail-closed-generation | FCG | One property: exit ≠ 0 ⟺ no manifest, for **every** failure path; one boundary routes every throw through `failClosed`; write-temp-then-rename is the only write path. Absorbs R2-4 + R1-5 + R1-6 (P4 as one REQ, ruling 3). |
| C6 | diagnostic-honesty | DGN | The reported `ViolationRule` is true of the violation (R2-3 gets its own rule; R1-8 stops misdiagnosing a directory as `unreadable-file`); messages asserted **whole**; rule identity asserted per red-proof. |
| C7 | publish-path-integrity | PPI | Publish integrity proven **behaviourally** (packed digests vs packed bytes against a scratch target) and never dependent on an implicit npm lifecycle behaviour `publish.yml` never declares — explicit rebuild step; suite gate; R1-13 reads execution order, not YAML declaration order. |
| C8 | enforcement-delivery-fidelity | DLV | `docs/runner-integrity-invariants.md` counts derived from the derivation, never frozen prose (R1-11), and the doc promises no more than the guard enforces; spec text reconciled with enforcement (RMD-05.1, RMD-01.2); every register row leaves with exactly one evidenced disposition. Merges BA's C10+C11. |

**BA's C9 (evidence-of-exhaustiveness) is deliberately not a family.** It becomes a cross-cutting test-mechanics clause binding all eight, per BA's own note: each invariant publishes its **negation partition** (closed case list) plus a machine-checked closure argument; fixture corpora are directory-enumerated (corpus ⇔ declared class list, both directions); counts are exact, never thresholds; a mandatory green corpus sits beside every red one.

## Approach

**Central mechanism.** Constraint-4's guard stops asking "does a forbidden token appear?" and starts asking "is every capability use in this file one I admitted?". The admitted set is **not** a generated, committed baseline (ruling 8 declines the artefact) — it lives in the guard's own declared source: two small, closed, reviewed tables in `scripts/` (admitted globals; admitted `node:` module surfaces), versioned with the guard and changed only by a PR that also changes the guard's tests. This is what makes the property affordable: an ordinary closure edit that introduces no new capability requires zero table edits, so there is nothing to rubber-stamp; adding a genuinely new capability is exactly the event that *should* stop a reviewer.

The property has three legs, all decidable from **syntax alone** — no ts-morph type checker or module resolution inside a fail-closed build gate, because the verdict must never be a function of install state. (1) **Callee decidability**: every call/`new` whose callee is not a statically resolvable binding is a violation — this generalises `4b4914a` and subsumes R1-7's computed access, aliasing, indirection and the unimagined siblings in one property, killing `globalThis["ev"+"al"](…)` and `(()=>{}).constructor(…)` structurally rather than by spelling. It carries a precondition that must itself be proven, not assumed: no closure file reassigns a module-scope binding — a permissive P1 is a *worse* false negative than today. (2) **Origin admission**: a resolved binding's origin is local, a closure import, an admitted global, or an admitted builtin surface; anything else is a violation naming the primitive. (3) **Positional decidability for denied roots**: a denied root may appear only in a closed list of non-capability-yielding positions (`instanceof` right operand, `typeof` operand) — which is precisely what makes R1-17's relaxation safe while `const F = Function; F("…")` stays red. Hand-rolled scope analysis is biased so **ambiguity means free**, i.e. toward violation.

**Explicitly rejected**: explore.md's Approach 1 (per-guard positional predicates). PM, QA and the architect converged independently — it leaves the default at *pass*, and all three live escapes survive it. Also rejected: the architect's committed capability baseline (ruling 8 — property yes, artefact no) and QA's 60-mutant ts-morph mutation harness (new test infrastructure disguised as debt closure; a directory-enumerated corpus of ≤20 mutants buys ~80% at zero machinery).

**Fixed at proposal; re-opening any of these at design is a scope re-open**: the mechanism class; syntax-only decidability; ambiguity⇒violation as a REQ; the eight families; primitives as scenario-level examples (ruling 1); the S-000 composition; the no-churning-artefact constraint; the budget gates; R1-17 sequencing. **Deferred to `sdd-design`**: ADR numbering/consolidation (start at 0079 — max on disk verified 0078; predicate placement must read as *placement, not timing*, explicitly not an ADR-0075 reversal); R1-16 probe-then-close; diagnostic register wording; corpus layout.

**Sequencing constraints binding on `sdd-slice`**:

- **SC-1** — S-000 is the publish-path slice (C7: explicit rebuild + suite gate + R1-13 + react-conformance timeout). Zero dependency on the mechanism work, independently mergeable, ships first. A knowingly-flaky gate is a gate that gets routed around, so the timeout fix is *in* the slice, not after it.
- **SC-2** — R1-17 (relaxing bare-`Function`) lands **with** callee decidability, never before: relaxing first reopens `const F = Function; F("…")`.
- **SC-3** — C1's property and its totality fitness function are one slice. Without the fitness function the property is a label, and the tail moves instead of closing.
- **SC-4** — C8's docs half lands after the enforcement it describes. Docs asserting more than the guard enforces is the exact condition judgment-day named against 0.1.0.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/derive-runner-closure.ts` | Modified | `denyScan` → capability-admission property; admitted tables; totality; R1-8/R1-15 classification |
| `scripts/generate-runner-manifest.ts` | Modified | C5 single fail-closed boundary; temp-then-rename; R2-3's own rule |
| `test/support/closure-integrity-checks.ts` | Modified | C4 resolution-based path verdicts |
| `test/fitness/fit-42-runner-closure-integrity(.negative).test.ts` | Modified | New red-proofs per REQ; 18 existing must stay green |
| `test/fixtures/red/runner-tripwires/**` | New | Directory-enumerated corpora: deny-scan, green, bundler-scripts, fail-closed, mutants |
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | Modified | R1-13 execution order; explicit rebuild step assertion |
| `.github/workflows/publish.yml` | Modified | Explicit rebuild step + suite gate (C7) |
| `test/conformance/react-conformance.test.ts` | Modified | Per-file timeout (ships with S-000) |
| `docs/runner-integrity-invariants.md` | Modified | Counts derived; enforcement promise matches mechanism |
| `openspec/specs/runner-integrity-manifest/spec.md` | Modified | Unfreeze batch + re-signature |
| `openspec/specs/publish-pipeline-hardening/spec.md` | Modified | C7 REQs |
| `openspec/decisions/0079+`, `openspec/pending-changes.md` | New / Modified | ≤3 ADRs; 23-row disposition table + 3 owed registrations |

## Spec Unfreeze List (for `sdd-spec` — verified against the signed text)

| REQ | Why | Ruling |
|---|---|---|
| `REQ-CST-04.2` | Enumerates primitives in requirement text; they must become scenario-level examples so the requirement demands the *property* | 1 |
| `REQ-CST-04.3` | Non-vacuity guard is written against "the deny-scan"; must be re-derived under the admission mechanism | 1 |
| `REQ-CST-06.1` | Reads "*asserted **by substring***" — directly contradicts C6/whole-message assertions (R2-3 shipped 4/5 false lines under a green substring assertion) | PM finding, same batch |
| `REQ-RMD-05.1` | Text says "no username"; enforcement asserts no username *path segment* (CI's user is literally `runner`) | 7 |
| `REQ-RMD-01.2` | Satisfied-in-intent only: Bun's default collator resolves `en-US` regardless of `LC_ALL`, so the scenario cannot discriminate its own mutation | 7 |

`REQ-CST-04.1` survives unmodified (ruling 1). Confirmed **not** requiring unfreeze: `REQ-RCD-03` (R1-15 makes the signed "zero silent skips" text *true* — fix the code, never amend it away), `REQ-RCD-04.1`, `REQ-BPI-03.1` (the explicit rebuild step keeps it green; the declaration assertion is an *added* scenario). Watch item for `sdd-spec`, not an unfreeze: `REQ-CST-04.4` scopes the namespace form to a **synthetic** closure file, so the anchor's namespace form being green does not contradict it — make that scoping explicit rather than implicit.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hand-rolled scope analysis has its own tail and fails **permissively** — the capability model then buys nothing | High | Ambiguity⇒violation encoded as a REQ, not prose; syntax-only (no checker in the build gate); the "no module-scope reassignment" precondition proven as its own REQ, not assumed; semantic oracle registered as a followup with its trigger |
| False positives create pressure to widen the exemption — where both prior CRITICALs lived | Medium | XPO REQ: exemptions are proof obligations on the file, never occurrence predicates; mandatory green corpus (namespace form, shadowed local, `instanceof`) makes false positives fail as red tests before they become review pressure |
| Regression against the 18 existing red-proofs on a file that took ~25 review rounds to stabilise | Medium | Strict TDD red-first per REQ (rule identity + exact count, never aggregate); zero test deletions without naming the surviving test that proves the property |
| Debt register sheds rows silently under a mechanism redesign | Medium | Five dispositions each with a mandatory evidence field; one row in ⇒ exactly one row out; mechanical row-count-delta check at `/evaluate`; mechanism rows may not absorb independent rows by adjacency |
| Scope creep to XL | Medium | Budget as HARD GATES: ≤4 new fitness functions, ≤3 new/amended ADRs, ≤20 committed mutants, zero new committed artefacts requiring updates on ordinary non-capability closure edits. Exceeding any gate is re-triage evidence, never a silent pass |
| The redesign forces a shipped-byte change ⇒ the change silently becomes cross-repo | Medium | Manifest byte-neutrality is a gate, not a hope: violation halts before slicing continues |
| C7 satisfied in the letter — gate present, `main` still unprotected, direct push publishes | Medium | The REQ asserts the *publish job itself* runs the suite, so bypass requires editing `publish.yml`; branch-protection status recorded as a registered followup with owner action |
| ADR-0075 reversal by accident / numbering collision (repo carries pre-existing 0073-0075 collisions) | Low | Start at 0079 (max on disk verified 0078); the placement ADR states placement-not-timing explicitly |

## Rollback Plan

The change ships **no runtime bytes** — C1-C6 and C8 touch build tooling, tests, docs and spec text only, and manifest byte-neutrality is an enforced gate, so `dist/` and `dist/runner-manifest.json` are identical before and after. There is therefore no artefact, data or consumer state to unwind.

- **S-000 (publish path)** is independently revertible: revert its commit, and `publish.yml` returns to the pre-change job graph. `fit-23` returns to its prior 18/18. No published artefact exists to recall — `npm publish` is `--dry-run` today and go-live is out of scope.
- **Mechanism slices** revert as units. Reverting restores the prior `denyScan` — weaker, but a functioning gate, i.e. the state `main` is in today.
- **Spec and guard revert together, always.** The unfrozen REQs (CST-04.2/04.3/06.1) describe a property the old code does not enforce; leaving the re-signed spec in place over a reverted guard produces a signed promise nothing enforces — strictly worse than the starting state. A revert that touches the guard MUST revert the spec re-signature in the same commit.
- **Validation after rollback**: `bun test` green at the pre-change count; `fit-23` 18/18; `fit-42` + `.negative` fully green with all 18 original red-proofs present; `bun run build` emits a manifest byte-identical to the recorded pre-change sha256; `openspec/specs/runner-integrity-manifest/spec.md` matches its pre-change signed text.
- **Abandonment bookkeeping**: if a slice merges and a later one is abandoned, the register gets a fresh dated RE-REGISTERED row naming what was abandoned and why. A row that quietly reverts to "still open" is the failure mode this change exists to end.

## Dependencies

- None external. `ts-morph@28.0.0` (already exact-pinned, frozen lockfile) remains the tripwire TCB; the trust assumption gets recorded, not expanded.
- Owner action outside this change: branch protection on `main` (registered as a followup — the C7 gate is necessary but not sufficient without it).

## Success Criteria

- [ ] Both confirmed live escapes — `globalThis["ev"+"al"]("1+1")` and `(()=>{}).constructor("return 1")()` — each produce ≥1 violation, asserted by rule identity and exact count
- [ ] Each of the four ruled-in primitives (`node:child_process`, `node:worker_threads`, `WebAssembly`, `module.register`/`registerHooks`) fails naming the primitive
- [ ] Totality is structural (classified-node count == present-node count) and red-proven by a mutation that routes an unrecognised node to a pass path
- [ ] Five disjointness spellings (`.//dist/transport`, `.`, `-odist/…`, `../<pkg>/dist/…`, `=$VAR`) each violate, with `=$VAR` as an explicit unclassifiable-construct
- [ ] Fail-closed biconditional (exit ≠ 0 ⟺ no manifest) driven per injected fault over ≥3 faults against a **pre-seeded** scratch root
- [ ] `dist/runner-manifest.json` is byte-identical to the pre-change build (violation ⇒ halt: the change became cross-repo)
- [ ] All 18 existing red-proofs green; zero test deletions without a named surviving test
- [ ] `publish.yml` runs the suite and declares the rebuild explicitly; `fit-23` 18/18 with R1-13 reading execution order rather than YAML declaration order
- [ ] Every one of the 23 register rows carries exactly one of the five dispositions with its evidence field; row-count delta fully explained; the three owed registrations (0.1.0-must-ship-manifest, integrity-mismatch diagnostic, M3.6) exist
- [ ] Budget gates respected: ≤4 new fitness functions, ≤3 new/amended ADRs, ≤20 committed mutants, zero new committed artefacts requiring updates on ordinary non-capability closure edits
- [ ] **judgment-day returns zero findings whose fix is "add another spelling"** — the only criterion that says whether we bought anything

> Deliberate budget deviation: the skill caps Success Criteria at 8. Eleven are carried because the eleventh *is* the change's definition of done and the preceding ten are its evidence; dropping three to fit the cap would drop evidence, not ceremony.

## Caveats from Exploration

`ready_for_proposal: yes` — no caveats to inherit. Exploration's three open questions are resolved or routed here: the `REQ-CST-04` unfreeze question is closed by ruling 1 (and widened to 04.2/04.3 + 06.1 + the two RMD rows); the ADR-form question is deferred to `sdd-design` under a ≤3 budget starting at 0079; the R1-16 question is answered "probe first, in both directions" — `derive-runner-closure.ts:177`'s comment and the register's R1-16 text contradict each other, so exactly one is false and the truth must be established by probe before any row is marked closed.

Exploration's own recommendation (Approach 1) is **superseded** by this proposal on evidence surfaced after it was written — three live escapes that survive it. That is recorded as a divergence, not a silent overwrite.
