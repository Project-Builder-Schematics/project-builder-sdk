# Outcome Verdict — copy-copyin-conformance-fixtures

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Triage**: L
**Steward**: purpose steward · **Dated**: 2026-07-22
**Verdict**: **delivered** — CONTINGENT on the owner engaging the 2 conscience questions below.
Silence is not consent; the gate does not fully pass until they are answered.

The AI-analysable dimensions (result→problem map, journey simulation, outputs-without-outcome,
promise↔delivery drift) show **no outcome-gap**. What remains is genuinely human judgment —
*worth it?* and *significant enough to declare delivered on a deferred oracle?* — which the
north-star explicitly filed forward to this reckoning. I do not fake a verdict on those.

---

## 1. Result → problem map (is the engine milestone actually unblocked?)

**Original pain** (triage.md): the engine's `copy-wire-inclusion` is hard-gated — its owner won't
merge while its conformance test skips, and the engine repo structurally cannot self-author the
fixture (`TestConformance_FixturesAreSDKOwned`, engine ADR-D). Only an SDK-owned fixture, landed
and pinnable on `main` BEFORE the engine change merges, removes the blocker.

| Delivered artefact | Maps to which pain | Resolves it? |
|---|---|---|
| `m2-copy` on `main` (`52952a9`, merged via `6b68aaa`), `corpus.json` lists it, fit-40 green at 6 fixtures/18 cases | Engine hard-gated, can't self-author the fixture | **YES — primary outcome.** The SDK-owned fixture now exists on `main`, SHA-pinnable, satisfying the engine's SDK-owned constraint. |
| `copy` added to all 3 sync sites (README, clause (e), regex `/move\/copy/`) in the same commit | Corpus must honestly declare `copy` representable | YES |
| Independently-mergeable PR #44, own commit, own corpus entry | SDK PR cadence gates the engine milestone | YES — engine can pin `6b68aaa`/`52952a9` today |
| `m2-copyin` fully authored + held on `m2-copyin-banked-arm` (origin `ee6501f`, draft PR #45), `main` copyIn-silent | `copyIn` readiness without a premature pin-ratchet | YES — banked per ADR-0074 |

**Is the engine milestone unblocked? YES, at the level this change owns.** The blocker is removed:
the SDK-owned `m2-copy` fixture is on `main`, well-formed, and consumable by the engine's Go
harness at submodule pin-advance. **One honest caveat, not a gap:** this repo proves the fixture's
declaration is internally consistent and well-formed; it NEVER proves engine behaviour (REQ-CFX-11
honesty boundary). The unblock is CONFIRMED only cross-repo when the engine harness runs `m2-copy`.
Until then it is provisional-but-real — exactly the state the north-star (§4) promised.

## 2. User-journey simulation

**(a) Engine team pins `main` + runs its harness against `m2-copy`.** Works end-to-end
structurally: pin SHA `6b68aaa` (or `52952a9`), `m2-copy` is in the corpus at 6/18, SDK-owned.
**Residual risk (honestly flagged, not a defect):** `m2-copy`'s `missing-source-twin` rejection
code (`"not-found"`) is an owner-confirmed *code-reading* declaration, not engine-harness-proven.
If that triple is wrong, the harness goes RED at pin-advance — turning "unblock" into a cross-repo
re-block. This is an irreducible property of the REQ-CFX-11 honesty boundary (un-hold checklist
item 5 re-verifies it). It is the reason conscience question 2 (below) is load-bearing.

**(b) Future un-hold executor picks up the banked arm.** They inherit: branch name
`m2-copyin-banked-arm` (pushed to origin — durable, not local-only), draft PR #45 URL, un-hold
trigger ("engine `copyIn` wire-inclusion in flight"), and the verbatim 5-item re-validation
checklist. They CAN succeed with what's recorded — **PROVIDED the ADR-0074 debt row is actually
registered in `project/pending-changes` at archive** (REQ-CCR-09.3). That registration is an
archive-time obligation, correctly N/A at verify, **not yet executed**. It is a hard completeness
gate for `sdd-archive`, not a conscience question — flagged in `next_recommended`.

**(c) Schematic author reads `conformance/README.md` on `main` today.** Told the truth: the
representable-ops sentence names `copy` (not `copyIn`); the honesty-boundary section is intact.
`copyIn` is NOT claimed representable on `main` while its fixture is branch-held — a false
`copyIn`-representable declaration would be "worse than an omission" (REQ-CFX-17), and none leaked.
Truth preserved.

## 3. Outputs-without-outcome detection

- **`m2-copy`**: NOT at risk. On `main`, consumable, IS its outcome (provisional pending the engine
  oracle). Clean.
- **`m2-copyin` banked arm** (the honest candidate): Analysed against the ADR-0074 posture that
  *authored + held IS the success state* for THIS change. By the owner's binding ruling, "fully
  authored + branch-held" is the delivered outcome this change owns — so by its own ruled scope it
  is **not** outputs-without-outcome. BUT the *deeper* outcome (`copyIn` proven end-to-end) is
  deferred to an external event — "queued next" with **no committed date** (north-star §6). Held
  honestly: if you measure against "copyIn works," it smells like output awaiting an outcome; if
  you measure against the owner's ruled scope ("bank readiness now"), it is delivered. That
  tension is not mine to collapse — it IS conscience question 1. Suspicion stated, not a verdict.

## 4. Promise ↔ delivery drift

The north-star (§4) pre-committed the honest delivered state; comparing it to what shipped:

| North-star promise | Shipped | Drift? |
|---|---|---|
| `m2-copy`: merged to `main`, structurally green at 6/18, engine-handed | `52952a9`/`6b68aaa`, fit-40 6/18 green, on `main` | None |
| `m2-copyin`: authored, green in isolation at 7/23, named branch, NOT merged, debt-registered at archive | Authored, 7/23 green in isolation, `m2-copyin-banked-arm` unmerged, debt-row content authored (S-005) | None in what shipped; debt-row *registration* correctly deferred to archive |
| Zero pin-ratchet on `main` (ADR-0074) | `main` at 6 fixtures, copyIn-silent at all 3 sync sites | None |

**One mechanism divergence, adjudicated immaterial:** slices rev4 pinned the atomic unit as the PR
*squash-merge*; the owner merged PR #44 via a *merge commit* (`6b68aaa`). Verify-report judged
REQ-CCR-04 intent satisfied regardless — `52952a9` is a single literal commit carrying the corpus
entry + full fixture set + both sync sites (20 files); the merge introduced zero content
(`git diff 52952a9..6b68aaa` empty). No substantive drift.

**Conclusion of AI-side analysis: no problem-fit gap, no scope gap, no design-misalignment, no
substantive drift, no outputs-without-outcome by the owner's ruled scope.** No AI-detectable
outcome-gap. The verdict rests on the human answering the two escalated questions.

---

## Conscience questions (human-only — gate does not pass until answered)

**CQ-1 (filed forward from north-star §5 — the banking-worth question).**
*Is banking `m2-copyin` NOW — fully authored and held, accruing an archive-time debt row plus
indefinite-hold rebase/schema-drift risk — worth it, versus authoring it fresh when the engine's
`copyIn` inclusion actually starts?*
- **What the evidence says:** the arm is complete, green in isolation (7/23), durable on origin,
  with a verbatim un-hold checklist. The cost is real: un-hold checklist items 1-2 explicitly
  anticipate that the schema/REQ set may shift while held, forcing a rebase-and-re-validate; the
  trigger has no committed date. The owner already rejected the m2-copy-only / m2-copyin-as-own-
  change path (PM's preference) for pair coherence + engine-independence of SDK authoring
  (ADR-0074). The design HONORS that ruling with full debt accounting rather than relitigating it.
- **What only the owner can rule:** whether that pair-coherence value outweighs the carrying cost
  of an indefinitely-held branch. This is a worth judgment, not a fact.

**CQ-2 (filed forward from north-star §6 — the deferred-oracle question).**
*Do we declare this change "delivered" at merge with the engine's Go harness as a DEFERRED oracle,
or do we couple this change's archive to an actual engine-harness run of `m2-copy`?*
- **What the evidence says:** `m2-copy`'s critical-path value is confirmable only cross-repo. Two
  rejection codes are owner-confirmed code-reading declarations, not engine-proven (`m2-copy`
  `missing-source` → `"not-found"`; `m2-copyin` `dest-dir` → `"collision"`). A wrong triple passes
  fit-40 locally but goes RED at engine pin-advance, re-blocking the very milestone this change
  unblocks. This is an irreducible property of the REQ-CFX-11 honesty boundary — the SDK repo
  structurally cannot run the engine harness. Coupling archive to the engine run would move the
  goalpost to a bar the owner ruled out of scope; NOT coupling means archiving on a provisional
  unblock.
- **What only the owner can rule:** the acceptable confidence bar for calling it delivered — accept
  the deferred oracle, or hold archive until the engine confirms.

**CQ-3 (NEW — surfaced by this reckoning: the staleness horizon).**
*Is there a hold-duration horizon beyond which the banked `m2-copyin` branch should be
abandoned-and-reauthored rather than un-held?* The trigger ("copyIn queued next") has no committed
date, and the un-hold checklist itself anticipates schema/REQ drift while held. Past some horizon,
"banked readiness" inverts into stale debt whose rebase cost exceeds fresh authoring — the exact
cost CQ-1 weighs, but as a function of time. Only the owner can set (or decline to set) that
horizon; recording "no horizon" is itself a valid, explicit answer.

---

## Verdict

**delivered** — on every dimension an AI can honestly assert: the primary outcome (engine
`copy-wire-inclusion` unblocked via an SDK-owned, pinnable `m2-copy` on `main`) is delivered
provisional-pending-the-cross-repo-oracle exactly as the north-star promised; the banked arm is
authored + held + honest per ADR-0074; no drift, no outputs-without-outcome by the ruled scope.

**This verdict is CONTINGENT on the owner engaging CQ-1, CQ-2, and CQ-3.** A "no" on CQ-1
(banking not worth it) or CQ-2 (require the engine oracle before archive) flips this to
`outcome-gap` (`not-significant` / `scope` respectively) — the owner's call, which I do not
pre-empt. Archive must ALSO execute the REQ-CCR-09.3 debt-row registration before closing.

---

## Owner rulings (2026-07-22, interactive session — gate closed)

- **CQ-1 — Banking worth it: YES.** The banked arm stands as success per ADR-0074; authoring with fresh m2-copy context was cheap and the un-hold checklist mitigates drift.
- **CQ-2 — Oracle: DEFERRED.** Archive proceeds; REQ-CFX-11 honesty boundary — this repo proves the declaration well-formed, the engine harness is and was always the real oracle, in its own milestone. Engine-unproven codes stay gated by un-hold checklist item 5.
- **CQ-3 — Staleness horizon: NONE (explicit).** Checklist item 1 (rebase + re-validate against then-current schema) absorbs drift; abandon-vs-unhold is decided at un-hold time with real data. "No horizon" is a deliberate ruling, not an omission.

**Final reckoning verdict: DELIVERED** — no contingencies remaining.
