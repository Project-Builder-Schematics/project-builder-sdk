# Outcome verdict — `runner-tripwire-invariants`

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Triage**: L
**Verdict**: `outcome-gap` · **gap_category**: `problem-fit`
**Steward**: launched blind (artefacts only) · 2026-08-05

> An `outcome-gap` here is not a claim that the work was bad. It is a claim that the outcome
> this change was commissioned to buy was not bought, that the change's own artefacts say so,
> and that the decision to archive anyway belongs to the owner rather than to the pipeline's
> momentum. Read §6 before reacting to the verdict word.

---

## 1. Our objective was THIS

From `triage.md`, verbatim:

> Root-cause: these are AST-shape checks with a long tail — every fix round closes imagined
> spellings and judges find more. The ONE fix that held (R2-1) worked by inverting the invariant
> into a decidable structural property. Owner directs applying that approach to the class
> instead of another shape-matching round.

From `north-star.md` §3, ratified by the owner at foresight before any hour was sunk:

> **Not "fewer bugs". The outcome is: no third judging round on this guard class.**
> Partial credit does not exist here. A mechanism that closes 90% of a tail buys 0% of the
> outcome, because the thing being bought is *decidability*.

That is the yardstick. Not "the specs are met" — they largely are. The commissioned outcome was
decidability, stated in the change's own words as admitting no partial credit.

## 2. Did we deliver it? Show me WHERE

### 2a. Result → problem map

Each claim in the problem statement, against evidence I resolved in the shipped tree.

| Problem-statement claim | Verdict | Evidence |
|---|---|---|
| **R2-3** version-failure reuses the `unreadable-file` rule, 4/5 message lines false | **Closed** | `scripts/derive-runner-closure.ts`: `manifest-version-invalid` is its own member of the closed `VIOLATION_RULES` union (`ViolationRule` is derived from it "so the two cannot drift"); `unreadable-file` now fires only on a `read()` failure, stated at the call site. REQ-DGN-01.1 / S-004 |
| **R2-4** malformed `package.json` fails OPEN, stale manifest | **Closed** | `scripts/generate-runner-manifest.ts`: one fail-closed boundary wrapping `generate()`, and the only write path is `writeFileSync(temp)` → `renameSync(temp, target)`. REQ-FCG-01 / S-004. Biconditional red-proofed over 3 injected faults (`test/fixtures/.../fail-closed/`: malformed JSON, unreadable closure file, generic throw) |
| **R2-5** false positive on `module.createRequire(u).resolve(s)` | **Closed** | REQ-XPO-01.2 / S-002; exemption is a file-level proof that forfeits on aliasing, re-export, or anchor drift (`findAnchorDriftViolations`) |
| **R2-6** path-spelling disjointness escape | **Closed 5/6** | `scripts/bundler-disjointness.ts` decides output targets by token grammar, not marker search (M3.1-M3.5). M3.6 (script chaining) is a distinct surface, owner-ruled out at ruling 3, re-registered at archive |
| **Redesign the guard class as structural invariants — decidable, no shape tail** | **NOT delivered** | See §2b. The mechanism is still a syntax-only AST allowlist with an open tail; the change's own spec, docs, and ADRs now say so |
| **Re-audit the 23-row debt register, one evidenced disposition each** | **Delivered as plan artefact; transcription owed at archive** | `slices.md` Excluded/Archive-Sync Ledger: 23 rows in → 23 dispositions out (4 CLOSED-BY-MECHANISM, 13 CLOSED-BY-FIX, 4 OUT-WITH-REASON, 1 archive-verifies, 1 RE-REGISTERED), each with a REQ/slice evidence cell. Not yet written into `pending-changes.md`; 3 owed registrations not yet created |
| **Publish path: `publish.yml` runs on every push to `main` with no suite gate and an undeclared implicit rebuild dependency (W1′/W2)** | **Fully delivered, load-bearing** | See §2c |

### 2b. The claim that did not survive — verified by me, not taken on trust

I did not accept the `Known gaps` section's self-report. I ran the shipped classifier
(`enumerateCapabilitySurface` → `buildFileContext` → `classifySurfaceNode`) against the three
documented residuals and against two controls:

```
carrier-property     nodes=4 violations=0 unclassifiable=0
indexer-launder      nodes=5 violations=0 unclassifiable=0
getter-carrier       nodes=4 violations=0 unclassifiable=0
CONTROL-direct-eval  nodes=1 violations=1  constraint-4-inadmissible-origin
CONTROL-computed     nodes=1 violations=1  constraint-4-undecidable-callee
```

And I executed them, to confirm they are capability reaches and not paper shapes:

```
carrier -> v24.3.0
indexer -> v24.3.0
```

`const w = { go: globalThis }; w.go.Reflect.get(w.go, "eval")("process.version")` reaches `eval`
and prints the Node version, with **zero findings** from the guard as it ships. The structural
reason is one line: `CAPABILITY_BEARING_SEGMENTS` is consulted via
`path.find((segment) => CAPABILITY_BEARING_SEGMENTS.has(segment))` — a deny predicate over an
unbounded name space. A carrier property named anything not in that set passes.

The `Known gaps` section is accurate. The retraction is honest. And the pain named in the problem
statement — "AST-shape checks with a long tail; every fix round closes imagined spellings and
judges find more" — describes the shipped mechanism as exactly as it described the one it
replaced. Three rounds became three rounds plus a fourth pre-registered
(`capability-admission-oracle`).

### 2c. What WAS delivered, and it is not small

I want this weighed at full value, because the verdict word will otherwise flatten it.

- **The publish path went from zero coverage to a real gate.** `publish.yml` now stamps → runs an
  explicit `bun run build` → runs `bun test` → dry-run publishes, and every verdict about that
  ordering goes through `stepPrecedes()` with a `needs:` ancestry check rather than YAML
  declaration order (R1-13). I verified branch protection live against the API, not from the
  artefacts: `required_pr: true`, `strict: true`, required check `"Test, typecheck, build"` —
  which matches `ci.yml`'s job name exactly, and `ci.yml` runs the suite that contains `fit-42`.
  The guard is genuinely load-bearing: you cannot merge to `main` or publish without it green.
  This half of the problem statement is fully solved.
- **Origin admission is default-deny for real.** That branch previously had *no fixture at all* —
  a judge replaced it with an admit and the entire suite stayed green (2605/0). It now carries
  red-proofs with the mutant verified killed. This is a genuine hole closed, not a claim.
- **The unfalsifiable claim is gone from every place it lived** — `docs/runner-integrity-invariants.md`
  (Constraint 4 + a new `Known gaps`), ADR-0079's Amendment, ADR-0080's scope-correction note,
  the guards' own doc comments, and — after a blind judge caught that the signed spec had been
  left behind — REQ-CAP-01/03/04, REQ-PRM-01 and REQ-CST-04.2, with zero Given/When/Then altered.
  A downstream reader can no longer mistake a green `fit-42` for a soundness result.
- **The decidability question is now answered rather than open.** Before this cycle the team had a
  hypothesis: R2-1's technique would generalise to the class. This change tested that hypothesis at
  full scale and refuted it with executed repros, and named the shape of the actual answer (a
  runtime differential oracle, because a member-path allowlist over an AST cannot be made sound
  without dataflow). That is expensive knowledge, and it is durable.
- **Design judgement I want to record because it is the opposite of ceremony**: the
  byte-neutrality gate was deliberately built as a *relation between two regenerations of the same
  tree*, not equality against a recorded digest — because a digest constant would have gone red on
  every `0.0.0-dev.<sha>` version stamp, made the hardened publish job permanently red, and
  "invited the first person to hit it to add `continue-on-error`, which is the outcome ruling 6
  exists to prevent." Someone reasoned about the failure mode of their own gate on a real human.
  That is the instinct this checkpoint exists to reward.

### 2d. Reckoning criteria (`north-star.md` §6)

| # | Criterion | Verdict |
|---|---|---|
| 1 | Live escapes + `node:child_process` produce ≥1 violation by rule identity and exact count | **Met** — controls reproduced above |
| 2 | Totality structural (`classified == present`), red-proven by mutation | **Met, scoped** — the equality is exact and the classifier mutant is killed, but totality is relative to the enumerator (JD-3); both walkers range over the same closed `SurfaceNodeKind` union |
| 3 | All four exclusions E1-E4 carry a red-proof, or E4 is named unfalsifiable | **Not met** — E1 has REQ-CAP-01.7; E2 (`declaration-name`) and E4 (`type-position`) have none. Named as JD-5's "doctrinal residue" and registered, but neither closed nor justified as unfalsifiable |
| 4 | 18 S-000-tier red-proofs survive behaviourally; assertions stricter-only | **Met** — all five expectation changes judged strictly stronger by the independent verify gate; DR-6's REQ-XPO-01.2 regression did not materialise |
| 5 | `dist/runner-manifest.json` byte-identical to `bf6c983c…a530`; mismatch is a halt | **Spirit met, letter stale** — `git diff f7428e8...HEAD -- src/` is **empty**: this change moves zero runtime bytes. The pin went stale from unrelated JSDoc edits between the probe and the branch base; re-pinned to `31cd5382…f333fde` and verified byte-identical across the mechanism diff. **But the signed spec still names the superseded digest** — see §5 |
| 6 | Fail-closed biconditional per injected fault, ≥3 faults, pre-seeded scratch root | **Met** — `FIT-FAILCLOSED-BICONDITIONAL` + the 3-fixture `fail-closed/` corpus |
| 7 | 23 rows one evidenced disposition each; 3 owed registrations exist | **Partial** — 23/23 dispositioned with evidence in `slices.md`; transcription into `pending-changes.md` and the 3 owed registrations are archive-executed and not yet done |
| 8 | Budget gates: ≤4 fitness functions, ≤3 ADRs, ≤20 mutants | **Met** — 3 ADRs on disk (0079/0080/0081); 4 change-owned fitness functions |
| 9 | **Criterion 11, read symmetrically** — zero judgment-day findings whose minimal fix is one entry added to or removed from a spelling/shape list on **either** side | **Not met, decisively** — see below |
| 10 | All mechanism slices landed, not just S-000 | **Met** — S-000 through S-005 all complete. DR-1, the sharpest drift risk, did not materialise |

**On criterion 9.** This was the change's own definition of done, and the owner ratified the
symmetric reading at foresight, pre-sunk-cost, precisely so it could not be argued at the finish
line. Judgment-day round 1's Part 1 findings 1, 2, 3, 5 and 6 were each fixed by adding segments
to a deny set, enumerating one more node kind, or handling one more root kind — spelling/shape-list
edits, on the nose. JD-1 and JD-2 remain open as the same class by construction. The bar was not
met, it was not met marginally, and the change's own register says the class is open.

## 3. Is it usable? — escalated, not answered here

See §6. I do not get to answer this one.

What I can supply is the journey walk, because three of the four personas in the launch brief
turn out to have no journey at all, and that is worth knowing before anyone argues about usability.

- **A schematic author who trips a tripwire.** *This journey does not exist.* `fit-42` is a
  build-time gate over the SDK's own 23-file pre-factory closure. A schematic author never runs
  it, never sees its output, and sits explicitly outside the manifest's threat boundary
  (`docs/runner-integrity-invariants.md`, *Why this exists*). No pain was removed from this
  persona and none added. Any future claim that this change protects schematic authors is false.
- **A maintainer bumping a dependency.** Also essentially no journey — the closure contains zero
  `node_modules` files by construction (Constraint 3 bans bare specifiers), so a dependency bump
  cannot perturb it. And because the byte-neutrality gate is relational rather than a pinned
  constant (§2c), an ordinary version bump does not turn the publish job red. This is the
  affordability claim ADR-0079 made, and unlike at foresight it is now actually enforced.
- **An agent editing runner code.** *This is the persona the change genuinely serves.* Introduce
  a free identifier and you get `constraint-4-inadmissible-origin` with a whole-verbatim message
  and a rule identity that is true of the defect — the two prior CRITICALs were both false rule
  names and widenable predicates that taught "widen the exemption" as the fix. The `createRequire`
  exemption is now a file-level proof that forfeits entirely on aliasing, re-export, or anchor
  drift, so the resolution is "write it differently", never "widen the hole". Branch protection
  means the edit cannot land regardless. This journey is materially better than it was.
- **A release engineer running the publish job.** Stamp → explicit rebuild → full suite → dry-run
  publish, ordered by `needs:` ancestry. Two residuals they will meet: N-3, the
  `installed-consumer.e2e` flake now gates publish; and JD-4, two concurrent `bun test` runs still
  collide on the real `dist/` — now one named error naming the holder pid instead of six
  mysterious failures, which is a real improvement over silence but is not isolation.

## 4. Did we drift? — promise vs delivery

**The purpose framing did not drift. The capability claim did.**

This distinction is the fairest thing I can say about this change, and I want it recorded
precisely, because "they retracted their claims at the end" reads like goalpost-moving and this
was not that.

`north-star.md` §3 already said, at plan time, before a line was built:

> ADR-0079 records honestly that marker sanctions are forgeable by anyone who can commit — so this
> is a *drift* control against honest mistakes and agent edits, not an adversary control. That
> honesty is a strength of the design, and it must survive to archive unembellished.

It survived, and then went further than planned. The drift-control framing is not a retreat
invented after the bypasses; it is the framing the change was authorised under. What actually
moved is narrower and real: the plan believed the admitted-set inversion made classification
**total and default-deny as a whole-mechanism property**, and round 3 proved two of its three
halves permissive (path admission is a deny predicate; enumeration totality is relative to the
enumerator). So the shortfall is a genuine capability miss against a plan-time belief, detected by
an adversarial gate and disclosed in five places rather than buried.

**So was the problem solved, or partly redefined?** Partly redefined — and I have to say that
plainly because the launch brief asked for the honest answer rather than the comfortable one. The
problem statement commissioned a mechanism that is *decidable, no shape tail*. What shipped is a
substantially better shape-matcher wearing an accurate label. The label is a real deliverable and
the improvement is real, but relabelling the tail is not the same act as removing it, and the
change's own success criterion was written specifically to prevent that substitution from passing
unnoticed. It did not pass unnoticed — the pipeline caught it, the owner ruled on it, and the
artefacts record it. The gate is doing its job; so is this one.

**One promise to a named persona is still outstanding, and nobody carries it.** See §5, CQ-R4.

## 5. Concrete items that should not cross the archive line unexamined

1. **The signed spec still pins the superseded manifest digest.** `specs/runner-integrity-manifest/spec.md`
   REQ-CAP-06.1's finding-B6 clarification names `bf6c983c…a530`; the enforced and shipped value is
   `31cd5382…f333fde`. Verify-final flagged this as W-2; the Part 3b correction landed the two
   *count* re-pins (21, 30) but not the digest. This is a live spec↔implementation divergence
   shipping inside the change whose Part 3b exists to eliminate exactly that class. Mechanical,
   one line, should land before archive.
2. **Criterion 3 is open**: E2/E4 carry no red-proof and no unfalsifiability justification.
3. **Criterion 7's archive-executed half is still owed**: the 23-row disposition table into
   `pending-changes.md`, plus the three owed registrations (0.1.0-must-ship-manifest,
   integrity-mismatch diagnostic, M3.6). The change's `pending-changes.md` section currently
   carries only the JD rows.
4. **The retraction has no cross-repo carrier** — the substantive one. See CQ-R4.

## 6. Conscience questions — human-only, the gate does not pass until these are engaged

Each is answerable in a sentence by someone who has not read the thread.

### CQ-R1 — Is a green `fit-42` still worth having, now that you know what it does and does not prove?

The guard catches honest widening of the runner's executed surface — a new free identifier, a
register primitive at its own occurrence, a computed callee — and blocks the merge. It does not
catch a capability laundered through a carrier property or an indexer, both demonstrated
executable above. You are the maintainer population this serves, plus your agents. **Is that
drift-control value worth the guard's ongoing cost to you — running it, maintaining its tables,
and occasionally arguing with a false positive — given it will never be a security control?**

### CQ-R2 — The premise your significance ruling rested on did not materialise. Does the ruling stand?

At foresight you affirmed CQ-3 on this reasoning, ratified as your own: *"this repo's product is
its guarantees, and a closure-sealing lemma guarded by something that cannot be shown closed is
not a lemma."* The guard still cannot be shown closed — that is now proven rather than suspected.
I am not re-asking whether the work was worth doing; sunk cost makes that answer worthless and you
answered it honestly when it was cheap. **I am asking whether you accept this change plus the
queued `capability-admission-oracle` as together discharging that reasoning, or whether the lemma
claim itself now needs weakening.**

### CQ-R3 — Your own bar for "done" was not met. Override, or does the bar stand?

Criterion 11, ratified symmetric at foresight specifically so it could not be softened at the
finish line, required zero judgment-day findings whose minimal fix is a one-entry spelling/shape
edit. Round 1 produced several, and two remain open by construction. **Do you override the bar and
archive on the value actually delivered, or does the bar stand and the change stay open?** My own
read is in §7 — but this is your call, not mine.

### CQ-R4 — The engine believes something about Constraint 4 that is no longer true. Who tells them?

`docs/runner-integrity-invariants.md` states two things that now sit badly together: the engine's
closure-sealing lemma *"holds only while all five of the properties below hold"*, and of
Constraint 4, *"the engine adopted it into their own mirror check."* Constraint 4's guarantee was
materially scoped down in this change. The retraction landed in five SDK-side places — but
`pending-changes.md`, which is this repo's register of record for cross-repo obligations and uses
an explicit engine-repo flag convention throughout, has **no row** for it. A contributor-facing doc
page is pull, not push: it only works if someone re-reads a page they already read. `north-star.md`
§3 named the engine team as one of the four hurting personas and promised them *"the three escapes
red-proven closed by property, not by spelling"* — they are instead getting a retraction, and as
of this commit nobody has been assigned to deliver it. **Should a cross-repo notification row be
registered before archive, and does the engine's mirror check or their lemma need revisiting on
their side?** No other gate asks this — verify checks spec conformance, judgment-day checks the
diff, the architecture audit checks layering. None of them asks who outside this repo believed the
claim we just retracted.

## 7. Verdict

`outcome-gap`, `gap_category: problem-fit`.

The work does not address the stated pain as stated. The pain was *"AST-shape checks have a long
tail and every round finds more"*; the delivered mechanism is an AST-shape check with a long tail,
now accurately labelled and meaningfully raised. The change's own definition of done (criterion 11,
ratified symmetric pre-sunk-cost) was not met, its own register moved the meta-finding from
`CLOSED-BY-MECHANISM` to `RE-REGISTERED`, and its own signed spec now retracts the property the
change existed to establish. I can point to a great deal that shipped; I cannot point to the place
that resolves the commissioned pain, because the artefacts agree it is not there.

**This is not outputs-without-outcome, and I do not want the verdict word read that way.** Output
theatre is machinery that leaves the pain where it was while claiming otherwise. This change moved
one whole half of its problem statement to done — the publish path is gated and load-bearing,
verified live — closed R2-3/R2-4/R2-5 and five-sixths of R2-6, red-proofed a default-deny branch
that previously had no fixture at all, dispositioned all 23 register rows, and then did the
expensive, unrewarding thing: it measured its own central mechanism, found it wanting, and
retracted the claim in five places including the signed spec rather than shipping a green suite
over a false property. The pipeline's honesty is the most valuable artefact in this diff.

**My recommendation, which is not my decision.** Routing `problem-fit` back to `sdd-propose` would
be the wrong move here, and I want to say so rather than let the routing table decide by default.
Re-proposing would spend another cycle on a road this change has already proven closed, with
executed evidence. The residual is registered, scoped, and has a named successor with the right
shape (`capability-admission-oracle` / `FIT-CAP-ORACLE`, runtime differential oracle). The honest
disposition is almost certainly an **owner override**: accept the partial delivery, archive with
the gap recorded, and let the successor change carry the commissioned outcome — after closing the
four items in §5 and answering CQ-R1..CQ-R4. The conscience can be overruled. It should just never
be bypassed silently, and the thing I most want on the record is CQ-R4: a retracted guarantee that
another repo still believes is the one residual here with a live blast radius outside this
codebase.
