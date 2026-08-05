# North Star — `runner-tripwire-invariants`

**Checkpoint**: foresight (post-design, forward-looking) · **Triage**: L · **Verdict**: `aligned`
**Steward**: launched blind (artefacts only) · 2026-07-29

---

## 1. This is what we're going to do

Not "fix four registered defects". We are **inverting which set is committed**.

Today Constraint 4's guard commits the *forbidden* set: `denyScan` walks identifiers and
`continue`s whatever it does not recognise. Default is **pass**. Every judging round closed
the spellings someone imagined, and no round could establish the set was closed — because
under default-pass, closure is not a property you can assert, only a hope you can accumulate
evidence for.

After this change the guard commits the *permitted* set: every node of a closure file's
capability surface classifies into exactly one of `{admitted, violation, unclassifiable}`,
default **violation**, ambiguity **violation**, and totality is a structural equality
(`classified.length === enumerated.length`) proven by a paired enumerator/classifier split so
the count cannot be made self-consistent by one edit in one function.

That is the parent cycle's own terminal instruction, applied to the class instead of to one
finding. R2-1 — the single fix that held across two rounds — worked by making the anchor
*prove* a shape rather than searching for one. This change generalises that move.

## 2. Here's how it fits

Inside `scripts/`, the build-integrity cluster. Every architecture touchpoint reads `aligns`,
zero `deviates`; the change ships **no runtime bytes** and `dist/runner-manifest.json` is
byte-identical by enforced gate (`31cd5382…f333fde`, re-pinned 2026-08-05 from the superseded `bf6c983c…a530`). The one-derivation/three-consumers shape,
the BUILD/CI/ENGINE authority split (ADR-0075), and the cross-repo manifest contract are all
untouched. The mechanism adopted is not novel: `classifySpecifier` — total by construction,
two functions away in the same file — produced **zero** findings across both judging rounds
while `denyScan` produced every Constraint-4 finding in both. This is a boring in-repo
precedent applied to the one guard that never got it.

## 3. Here's the outcome we're chasing

**Not "fewer bugs". The outcome is: no third judging round on this guard class.**

Partial credit does not exist here. A mechanism that closes 90% of a tail buys 0% of the
outcome, because the thing being bought is *decidability* — the ability of the next judge,
the next maintainer, and the engine team to answer "is the set closed?" by reading the guard
rather than by exhausting their imagination against it.

Traced to the people who were hurting:

| Who | Pain today | What the design gives them |
|---|---|---|
| **The next blind judge** | "Is the property closed?" is unanswerable; two rounds of imagining spellings did not settle it | A committed admitted set + a totality equality they can read and falsify in minutes |
| **The maintainer/agent whose commit trips the guard** | Both prior CRITICALs lived in *exemptions* — a false rule name and a widenable predicate teach "widen the exemption" as the fix | Rule identity true of the defect (DGN-01), whole-verbatim messages (CST-06.1), exemptions as file-level proofs that forfeit (XPO-01) — so the resolution is "write it differently", never "widen the hole" |
| **The engine team** | Relying on a closure-sealing lemma guarded by a scanner with three probe-confirmed live escapes on `main` | The three escapes red-proven closed by *property*, not by spelling, plus fail-closed generation as a biconditional |
| **The register reader** | 23 rows of debt, some silently gated on a decision nobody had made | Every row leaves with exactly one evidenced disposition; row-count delta explained |

**What the outcome is NOT.** The engine is already unblocked — PR #50 shipped a correct,
deterministic, digest-verified manifest and the parent's terminal record says plainly that
abandoning the hardening had "no cost to the delivered outcome". This change buys **durability,
not delivery**. Nobody at reckoning may point at a working engine as evidence this change
landed. And ADR-0079 records honestly that marker sanctions are forgeable by anyone who can
commit — so this is a *drift* control against honest mistakes and agent edits, not an adversary
control. That honesty is a strength of the design, and it must survive to archive unembellished.

## 4. The filed question — does this, executed perfectly, resolve the pain?

**Yes, on the deny side, which is where the pain actually was.** Three live escapes get
red-proofs (CAP-03.1/03.2/04.1); R2-3/R2-4/R2-5/R2-6 each get a REQ; the four judge-suggested
primitives are ruled in; the 43 red-proofs are disciplined by the devices that make green mean
something (exact counts never thresholds, rule identity asserted, whole-verbatim messages,
mandatory green siblings, directory-enumerated corpora asserted in both directions). The
design's own inventory claims were spot-checked and hold — 47 `toContain` assertions exist
exactly as stated. The HIGH risk (hand-rolled scope analysis) was retired with a probe against
the real closure, not with hope: 22 free identifiers, 0/423 undecidable callees, 3 module-scope
reassignments each resolved by rule. D-1/D-2/D-3 are the marks of a design that met the real
tree and let it change the shape of the answer.

**Is there a shorter path to the same outcome?** The council already ran that exercise (PM's
"minimum durable shape" M1-M7) and the owner ratified it across eight rulings, including three
explicit declines (baseline artefact, 60-mutant harness, semantic oracle). I find no cheaper
path that still buys the outcome — the mechanism and its totality fitness function are
inseparable, and dropping the diagnostic/fail-closed/path work would leave known-false
instances inside a change whose bar is "a judge finds nothing of this class".

**Where it is thinner than it reads: the risk moved, and one side of the move is unpinned.**
See CQ-1.

## 5. Conscience questions — the owner's ratified answers become the reckoning commitment

### CQ-1 — The committed set moved to the *admitted* side. It is pinned weaker than the set it replaced.

`DENIED_CAPABILITY_PRIMITIVES` gets an exact-set assertion (REQ-PRM-01.1), a per-member fixture
obligation (PRM-01.2), and a red-proof that a widened register is caught (CST-04.3.2).
`ADMITTED_GLOBALS` (22) and `ADMITTED_NODE_SURFACES` (6) get **none of the three**. The design's
data model comments them "pinned by exact count (22 today)", but no REQ, no scenario, and no
fitness function carries that pin — §6's coverage table has no row for it.

This matters because it is the *same class* as the original pain, relocated. ADR-0079's central
affordability claim — "an ordinary closure edit requires zero table edits, so there is nothing
to rubber-stamp" — is only true if a table edit is **loud**. Nothing in the signed spec makes it
loud. A PR adding one entry to `ADMITTED_GLOBALS` reintroduces exactly one default-pass hole,
silently. ADR-0080 rejects "totality as a code-review convention" because prose exhaustiveness
claims are what failed twice; an unenforced affordability claim in ADR-0079 is the same
artefact.

Cheap closure, no budget impact: one scenario asserting both admitted tables as exact sets, plus
one red-proof that a widened admitted table is caught. No fifth fitness function needed (the ≤4
gate stands). Requires a scenario addition under REQ-CAP-04 — an owner call, since the spec is
signed.

**Owner question**: close CQ-1 now with a scenario addition, or accept an unpinned admitted set
and record that acceptance as the bet?

### CQ-2 — Is criterion 11 symmetric? Under default-deny, "add another spelling" changes polarity.

Success criterion 11 is the change's own definition of done: *judgment-day returns zero findings
whose fix is "add another spelling"*. Under default-**pass** a spelling finding was a false
negative (a hole). Under default-**deny** the same class of finding surfaces as a false
*positive* — "the guard rejects this legitimate idiom" — and its fix is *admitting* another
spelling. That is still the tail; it merely changed sign.

If criterion 11 is read as covering only denial-side misses, the change can pass its own bar
while a judge files six admission-side idiom findings, and the third judging round happens
anyway. I propose the symmetric reading and want it ratified before build, not argued at the
finish line:

> Criterion 11 passes iff **no** judgment-day finding's minimal fix is adding or removing one
> entry from a spelling/shape list on **either** side — denied register, admitted tables,
> surface exclusions (E1-E4), or flag-token readings.

The design's probe (0/423 undecidable callees, 22 free identifiers on the real tree) is genuine
evidence the admission side is small and measured — this is a bounded risk, not an open-ended
one — but bounded is not zero.

**Owner question**: is the symmetric reading the bar, or is criterion 11 denial-side only?

### CQ-3 — Significance, asked once, now, before hours are sunk.

This is an L cycle — 22 REQs, 65 scenarios, 43 red-proofs, ~15 files, 3 ADRs, 4 fitness
functions — that ships **zero runtime bytes**, on a guard protecting a 23-file build-time
closure, in a pre-1.0 SDK, whose maintainer population is effectively one person plus agents,
where the artefact being guarded already shipped correct and the engine is already unblocked.
The parent cycle needed ~25 review rounds and its own terminal record called that count "itself
the finding".

The reasoning I can see in the artefacts is momentum-shaped — *the debt exists and judgment-day
escalated, therefore we close it* — which is a reason to act but not a measure of worth. The
worth case I can construct, and believe, is: **this repo's product IS its guarantees.** The SDK's
value to the engine is a closure-sealing lemma; a lemma guarded by something that cannot be
shown closed is not a lemma. And the cost of *not* doing it compounds — the next contributor,
the next agent edit, the next go-live checklist all inherit an unfalsifiable claim.

But that is my reconstruction, not the owner's ratification, and worth is not mine to assert.

**Owner question**: is closing this class worth an L cycle **now**, versus deferring it to the
0.1.0 go-live batch and carrying the register debt one more cycle? Answer it here — reckoning
will not re-ask it after the hours are spent.

### CQ-4 — REQ-PPI-03's suite gate is knowingly incomplete, and its completion has no owner.

The BA lens named it and the spec's own Open Item 1 concedes it: the suite gate makes the
publish *job* run the suite, but `main` carries no branch protection (confirmed live), so W2 is
"satisfied in the letter". Branch protection is explicitly out of REQ scope and lives as a
registered followup with no owner and no date.

The gate is not worthless — bypass now requires editing `publish.yml`, which is a visible act.
But S-000's stated purpose is "make Constraint 4 load-bearing at publish time", and it is
load-bearing only up to that residual.

**Owner question**: is branch protection on `main` an action you will take (when?), or is the
publish gate accepted as-is with the residual recorded? This one is *deferred value* by
construction — reckoning cannot evaluate it inside the change.

## 6. Reckoning criteria — evaluable pre-archive

Every criterion below can be checked before archive. The reckoning gate will hold delivery
against exactly these, and against the owner's ratified answers to CQ-1..CQ-4.

1. Both confirmed live escapes (`globalThis["ev"+"al"]("1+1")`, `(()=>{}).constructor("return 1")()`)
   and `node:child_process` each produce ≥1 violation, asserted by **rule identity and exact
   count** — never an aggregate.
2. Totality is structural (`classified == present`, exact equality) and red-proven by a mutation
   routing an unrecognised node to a pass path.
3. All **four** surface exclusions E1-E4 carry a red-proof. The design's own text says each
   exclusion is pinned; its table leaves E4's red-proof cell empty. Delivery must close that or
   name why E4 is unfalsifiable.
4. All 18 S-000-tier red-proofs survive **behaviourally** (same violation, rule identity + exact
   count); assertions moved only *stricter*; zero deletions without the surviving test named in
   the commit message. Existing red-proof #12 stays green **in the same commit** that lands
   REQ-XPO-01.2.
5. `dist/runner-manifest.json` byte-identical to `31cd5382…f333fde` (re-pinned 2026-08-05 from
   the superseded `bf6c983c…a530`). A mismatch is a halt, not a
   warning — it means the change became cross-repo.
6. Fail-closed biconditional holds **per injected fault** over ≥3 faults against a **pre-seeded**
   scratch root.
7. Every one of the 23 register rows leaves with exactly one **evidenced** disposition; row-count
   delta fully explained; the three owed registrations exist (0.1.0-must-ship-manifest,
   integrity-mismatch diagnostic, M3.6). No mechanism row absorbs an independent row by adjacency.
8. Budget gates held: ≤4 fitness functions, ≤3 ADRs, ≤20 mutants, zero new committed artefacts
   requiring updates on ordinary non-capability closure edits. Exceeding any is re-triage
   evidence, never a silent pass.
9. **Criterion 11, read symmetrically per CQ-2** (subject to the owner's ruling): judgment-day
   returns zero findings whose minimal fix is one entry added to or removed from a spelling/shape
   list on either side.
10. **All mechanism slices landed.** Not just S-000. See drift risk DR-1 — this repo has already
    shipped the easy half of exactly this work and registered the hard half.

**Deferred — NOT reckoning criteria** (named here so they re-open instead of dying at archive):

| Deferred item | Activates when | What to check then |
|---|---|---|
| Branch protection on `main` (CQ-4) | Owner action, outside this change | REQ-PPI-03 becomes load-bearing without a `publish.yml`-edit bypass |
| The durable form of "no third judging round" | The next change that touches a tripwire | Did its judges file spelling-shaped findings? This cycle's judgment-day is a one-shot **proxy**, not proof of the durable property — say so at archive |
| `FIT-CAP-ORACLE` and the four other deferred fitness functions | Their registered re-open triggers | Registered with triggers, not silently dropped |
| R1-14 (entry file exempt from symlink containment) | Re-registered with the security lens's Tier-1 ranking | A known security-ranked hole ships open by ruling 7 — a blind judge will find it; that is expected, not a regression |

## 7. Drift risks — build-time watch items

- **DR-1 (sharpest).** S-000 is independently mergeable and carries the least contested value.
  The parent cycle merged PR #50 (the easy, valuable half) and escalated PR #51 (the hardening)
  into debt — *this change is that debt*. The identical failure mode is available here: S-000
  merges, mechanism slices stall, the register gets partial dispositions, and the outcome buys
  nothing. Treat "all mechanism slices landed" as a delivery criterion, not an aspiration.
- **DR-2.** Surface exclusions E1-E4 are the cheapest route back to default-pass, and ADR-0080
  says so in its own Consequences. Any widening of an exclusion during build is a spec-level
  event, not an implementation detail. E4 has no red-proof today (criterion 3).
- **DR-3.** The 47 `toContain` → whole-verbatim conversions are where a weakened assertion can
  hide inside a diff that reads as a strengthening. Every conversion is stricter-only.
- **DR-4.** Any *new* permissive line added to the scope-analysis table during build (the way
  "TDZ not modelled" is one today) is a mechanism change, not an implementation detail. The
  design measured 159-vs-22 to prove partial scope handling is useless — the table is
  load-bearing, and it may only grow in the restrictive direction without a spec touch.
- **DR-5.** `ADMITTED_GLOBALS`/`ADMITTED_NODE_SURFACES` growing during build to make a red test
  green. That is the rubber-stamp ruling 8 declined the baseline artefact to prevent, arriving
  through the back door. Any table growth needs a named justification in the commit.
- **DR-6.** REQ-XPO-01.2 (namespace form green at the anchor) closed by *relaxing* existing
  red-proof #12 (namespace form denied in a non-anchor file) instead of by scoping. The design
  named this; it is the highest-probability regression in the change.

---

**Verdict**: `aligned`. The design closes the original pain by the mechanism the parent's own
terminal record prescribed, with the real closure probed rather than assumed, and its honest
limits recorded rather than sold. It is not output theatre. Four questions need the owner
before build — CQ-1 (the admitted set is pinned weaker than the set it replaces), CQ-2 (is
criterion 11 symmetric), CQ-3 (worth, asked pre-sunk-cost), CQ-4 (deferred value with no owner).

## Foresight ratification (2026-07-29)

Owner answered all four conscience questions. Gate cleared — proceeding to build.

- **CQ-1 — micro-amendment AUTHORIZED and APPLIED.** The admitted side (`ADMITTED_GLOBALS`,
  22 members; `ADMITTED_NODE_SURFACES`, 6 modules) is now pinned symmetric to the denied
  register: `openspec/changes/runner-tripwire-invariants/specs/runner-integrity-manifest/spec.md`
  gained two new scenarios under the existing REQ-CAP-04 (Origin Admission) — **REQ-CAP-04.4**
  (exact-membership assertion on both tables) and **REQ-CAP-04.5** `[red-proof]` (a silent
  table widening turns the assertion red). Additive only, dated, same pattern as the parent
  cycle's ruling-16/17 notes — no existing REQ text was touched; all 22 REQ-IDs signed at V1
  are unchanged. ADR-0079's "nothing to rubber-stamp" affordability claim is now enforced, not
  merely stated.
- **CQ-2 — criterion 11 ratified SYMMETRIC.** The success criterion reads: *zero judgment-day
  findings whose minimal fix is adding or removing one entry from a spelling/shape list on
  EITHER side* — denied register, admitted tables, surface exclusions (E1-E4), or flag-token
  readings. A judge filing an admission-side idiom finding counts against the bar exactly like
  a denial-side spelling miss; this is the reading `sdd-verify` and judgment-day judge against,
  not the denial-side-only reading.
- **CQ-3 — significance AFFIRMED.** The full L cycle proceeds now, not deferred to the 0.1.0
  go-live batch. The worth case this document reconstructed (¶137-157 above) is ratified as the
  owner's own reasoning, not merely a plausible inference: this repo's product is its
  guarantees, and a closure-sealing lemma guarded by something that cannot be shown closed is
  not a lemma. The register debt does not carry one more cycle.
- **CQ-4 — CLOSED FOR REAL.** Branch protection is enabled on `main` (2026-07-29): PR required
  + required status check `"Test, typecheck, build"`, strict mode — verified via `gh api`
  against the live branch-protection endpoint, not merely configured-and-assumed. REQ-PPI-03's
  suite gate is now load-bearing in full: bypass requires both editing `publish.yml` AND
  defeating branch protection, closing the letter/spirit gap CQ-4 named. The "Deferred — NOT
  reckoning criteria" table's CQ-4 row (§6) is retired as of this date — reckoning may now
  evaluate REQ-PPI-03 without the residual carve-out.

No fifth fitness function was introduced (CQ-1's closure rides the existing REQ-CAP-04 test
surface); the ≤4 fitness-function budget stands. `sdd-design`'s file-changes table and slice
plan are unaffected — the amendment is spec-only, landing inside whichever slice already
implements REQ-CAP-04's origin-admission leg.
