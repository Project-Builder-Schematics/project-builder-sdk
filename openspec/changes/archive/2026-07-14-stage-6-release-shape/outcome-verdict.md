# Outcome Verdict — Stage 6: Release shape & DX closure

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Change**: `stage-6-release-shape` · **Triage**: L
**Verdict**: `delivered` (re-run 2026-07-14) — superseding the prior `escalated-to-owner` (preserved below as history). The one owner action (G-2 human walkthrough, REQ-AOD-08) is now discharged by a completed FAIL→fix→PASS `walkthrough-record.md` with all attestations checked, and the two human-only facts (live bun-link consumer; adjusted bar) are reaffirmed. See the "RE-RUN" section at the end for the full re-verification.
**Held against**: the owner-signed `problem_statement` + the North Star memo + the owner affirmations (CQ1/CQ2/CQ3, 2026-07-12) — NOT the spec.
**Verification already said**: final verify `pass-with-followups`; judgment-day `APPROVED` (R1 clean). Those answered *"built it right?"*. This answers *"did we build the RIGHT thing, is it usable, does it matter?"*

---

## 1. Our objective was THIS

Stages 1–5 built the whole authoring surface; nothing packaged it. Stage 6's owner-signed objective (as amended): make that surface **consumable and trustworthy locally, and provably ready to publish later — without pressing publish**. Concretely: every public subpath resolves from a real local install with `./core` unreachable; the team can trust a hardened-but-never-fired publish pipeline; a new author reaches a passing typed factory from the docs alone; the planning docs tell ONE consistent release-READINESS story. Party (a) external npm-installing authors are explicitly OUT of near-term scope (CQ3); the near-term consumer is the Project Builder ecosystem via `bun link` (CQ1).

## 2. Did we deliver it? Result → problem map (I verified each in the shipped tree, not the claims)

| Stated pain | Where it is healed in the tree | My independent check | Verdict |
|---|---|---|---|
| No guarantee every public subpath resolves from a real install; `/core` must stay unreachable | `test/e2e/installed-consumer.e2e.test.ts` exercises BOTH legs (bun-link + tarball); REQ-LC-01..05 | 11 bun-link/link-store references in the e2e; both legs asserted at parity; verify ran 44/44 change-legs green | **HEALED** |
| Tarball drags `dist/core/**` with no decision taken | README "`dist/core/**` ships, documented, not stripped" + ADR-0034 amendment + `fit-14` | README diff shows the documented posture; decision is TAKEN, not deferred | **HEALED** |
| Actions not SHA-pinned | `publish.yml` + `ci.yml` full-SHA pins | Diff shows `checkout@34e1148…`, `setup-node@49933ea…`, `setup-bun@0c5077e…`; verify resolved each to a real tag via `gh api` | **HEALED** |
| Team cannot publish confidently — W3 guard absent, fork reaches OIDC | `publish.yml` W3 repo-owner guard + job-scoped `id-token` + trigger fence (ADR-0042) | Diff shows `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'`, `id-token: write` moved onto the job block, `on: push: [main]` only; `fit-23` guards it (26 assertions) | **HEALED (party b)** |
| No single doc from install to a passing typed factory | `docs/quickstart.md` + verbs/errors/dry-run set; machine leg (`quickstart-docs.test.ts` runs the fenced blocks) + consumer-tsc leg (`tsc --noEmit` in a scratch consumer) | Both test files present and real; docs ship a full install→schema→codegen→factory→green-test path with the pinned bin contract | **HEALED (machine + consumer-tsc halves)** |
| — the SAME doc's HUMAN-verified half (REQ-AOD-08) | `walkthrough-record.md` | **Still a pure template** — every `_(fill in)_` placeholder, all three attestation boxes unchecked, no verdict | **NOT DISCHARGED — see §5** |
| External authors CANNOT `npm install` the SDK | Deferred by explicit owner ruling (CQ3, out of near-term scope) | North-star + triage both record the ruling | **OUT OF SCOPE by owner** |
| ROADMAP / problem-statement / pending-changes drift after the reframe | REQ-AOD-09/10/12 reconciliation across README, ROADMAP, problem-statement, objectives-plan, pending-changes | Read all five diffs: the release-READINESS story is now told identically everywhere; six pending rows RETIRED with change-attributed strikethroughs; engine-gated rows RE-TAGGED not closed; the required-reviewers go-live precondition is BOOKED | **HEALED (drift closed by design)** |

## 3. Is it usable / significant? (escalated — human-only)

- **Usable**: the docs-only path is machine-proven and consumer-typecheck-proven, but "a real fresh reader reaches green using ONLY the docs" is precisely the human judgement the plan reserved for this checkpoint — and it has not been performed. My *suspicion*: the docs are strong (bin contract pinned so they cannot show wrong flags; re-link-after-edit friction is stated honestly), so I expect a PASS — but a suspicion is not the attestation the G-2 ruling demands.
- **Significant**: the entire near-term significance rests on ONE human-only fact — that the `bun link` ecosystem consumer is live and depending on this path TODAY. The owner AFFIRMED this at foresight (CQ1). No in-repo artefact can prove a live external consumer; reckoning must hear the owner reaffirm it still holds, because if it does not, this change is scaffolding for a deferred publish rather than a delivered outcome.

## 4. Did we drift? Promise ↔ delivery

- **Promise kept, no gold-plating.** The North Star promised release-READINESS, not a release — and the shipped tree performs ZERO registry writes (only `npm publish --dry-run`, guarded and never-fireable). The npm placeholder the foresight memo ruled to DEFER (CQ2) is genuinely absent: zero placeholder artefacts, zero `tools/npm-placeholder/*`, no fit-22 inertness suite. The promise to shrink the change was honoured.
- **No silent under-delivery.** The "publishable product the day it closes" prose from the original why-now was softened to release-READINESS by an explicit, signed owner amendment, and REQ-AOD-09 makes every planning doc consistent with it. The reframe is disclosed, not hidden.
- **One honest bounded limitation**, named in the North Star and booked as debt: in-repo tests cannot gate a direct push to `main` by a write-access holder who strips the guard/`--dry-run`. The mandatory GitHub Environment required-reviewers precondition for go-live is now a pending-changes row (REQ-AOD-09.6). Dormant while no live publish exists — acceptable at this posture.

**Outputs-without-outcome scan**: none. Every shipped file traces to a REQ and every REQ to a scope item. The planning reconciliation is the closest thing to ceremony, but it closes real promise↔posture drift and is explicit 6.4 scope, so it earns its place.

## 5. G-2 RULING — the gate cannot pass on the human-walkthrough dimension

REQ-AOD-08 (human walkthrough) is discharged **only** by a completed `walkthrough-record.md` — the plan-verify G-2 ruling is explicit that a template does NOT discharge it and that "build complete" must never be misread as "AOD-08 discharged". The file is, as of this reckoning, a pure template. Therefore:

- The gate **does not pass** on the human-walkthrough dimension.
- This is not a defect in the code and not a re-spec — it is an **owner action** that only a human can perform.

**Exactly what the owner (or a designated fresh reader) must do before archive:**
1. Take a reader who has NOT previously read this SDK's `src/` or `test/`.
2. Follow `docs/quickstart.md` (and only the docs it links) end to end: local-install via `bun run link:sdk` (or the tarball path) → write `schema.json` → `pbuilder-codegen .` → write `factory.ts` → run `factory.test.ts`.
3. Reach a GREEN test using ONLY the published docs — never opening any file under `src/` or `test/`.
4. Fill `walkthrough-record.md` with the real Date, Reader, binary **PASS/FAIL** verdict, the exact steps followed (noting any point the docs were unclear), and check all three Constraint Attestation boxes.
5. If FAIL → this is an `outcome-gap` (`not-usable`), routing to Planner to fix the docs; re-run reckoning after.

Until that record holds a real completed verdict, archive must not proceed as if REQ-AOD-08 were met.

## 6. Verdict

`escalated-to-owner`. Everything a machine can validate is **delivered and coherent** — the pains that can be healed in-repo are healed, the release-READINESS story is told consistently everywhere a person would look, the promise was kept with no gold-plating and no hidden under-delivery. What remains is genuinely human-only and blocks the gate until answered: the G-2 walkthrough must be performed and recorded, and the two human-only facts (usability confirmation via that walkthrough; the live bun-link consumer that carries all near-term significance) must be affirmed by the owner. The conscience does not fake a `delivered` on meaning it cannot measure.

## Conscience questions (the gate does not pass until the owner engages)

1. **[OWNER ACTION — blocking] G-2 human walkthrough (REQ-AOD-08).** `walkthrough-record.md` is still a template. Perform the docs-only walkthrough per §5 and record a real PASS/FAIL verdict with all three attestation boxes checked. A PASS discharges REQ-AOD-08 and clears this dimension; a FAIL is an `outcome-gap (not-usable)` routing back to Planner for doc fixes. My suspicion is PASS (docs are strong, bin contract pinned) — but suspicion is not the attestation the ruling requires.
2. **[REAFFIRM — significance] Is the `bun link` ecosystem consumer live and depending on this local-consumption path TODAY?** All near-term significance rests on this single human-only fact. You affirmed it at foresight (CQ1, 2026-07-12); reckoning asks you to confirm it still holds now. If yes, release-readiness is significant today and the outcome is real; if no, this change is scaffolding for the deferred live publish and its significance waits.
3. **[CONFIRM — scope] Is judging this change against the adjusted bar (serve the ecosystem consumer + party (b) the team; party (a) external npm-installing authors explicitly OUT) still correct?** You ruled this at foresight (CQ3). I judged §2 against exactly that bar. Confirm the bar has not shifted — if external authors are now in-near-term-scope, the install-by-registry pain is unhealed and this is an `outcome-gap`.

---

## RE-RUN — 2026-07-14 — verdict `delivered`

The prior verdict above (`escalated-to-owner`) is preserved as history. All three conscience questions have since been answered; I RE-VERIFIED each answer is real (not asserted) before flipping the verdict. **New verdict: `delivered`.**

### CQ1 — G-2 human walkthrough (REQ-AOD-08): DISCHARGED

`walkthrough-record.md` now holds a REAL, completed binary verdict, not a template. I read it in full and confirm:

- **Binary verdict present**: `PASS` on walkthrough 2 (fixed docs, 2026-07-14), after a recorded `FAIL` at step 4 on walkthrough 1.
- **FAIL→fix→PASS trajectory intact**: WT1 documents the exact stall (ts(2307), `@pbuilder/sdk` unresolved) and 5 findings (no consumer workspace, no tsconfig instruction, link flow learned from console not doc, missing `@types/bun`/`bun:test` ambient types, filenames only in invisible fence metadata). WT2 walks the FIXED doc from a fresh folder to green.
- **All three Constraint Attestation boxes checked** `[X]`: docs-only, never opened `src/`/`test/`, real binary verdict.

Per the G-2 ruling, a completed record with a PASS discharges REQ-AOD-08. It is discharged.

### Verification the fix is REAL (not asserted) — I checked the tree and ran the tests

- **`docs/quickstart.md`** now teaches, in order: §1 consumer workspace (`mkdir my-factories`, names all four files, states `bun link` needs no separate `bun init`); §2 `bun add -d typescript @types/bun` + a copy-pasteable `tsconfig.json` fence with `moduleResolution: NodeNext` + `allowImportingTsExtensions: true` + `types: ["bun"]`, each explained as load-bearing; §5/§6 prose naming `factory.ts` / `factory.test.ts` at their blocks (not just fence metadata). Every WT1 finding is addressed at its root.
- **`test/docs/quickstart-docs.test.ts`** carries the new `walkthrough outcome-gap fix (G-2)` describe block — 5 guard `it`s (tsconfig content+placement, workspace setup, `@types/bun` instruction, filename-in-prose, PATH-resolved codegen), added RED-first per apply-progress Run 6. The REQ-AOD-11 consumer-tsc leg was rewired to consume the DOC'S OWN extracted `tsconfig.json` (not a harness-provisioned duplicate) and now typechecks `factory.test.ts` in addition to `factory.ts` — closing the exact self-provisioning gap that let the bug ship machine-invisible.
- **I ran `bun test test/docs/` myself → 56 pass / 0 fail** (174 assertions, 4 files). Apply-progress Run 6 records the full suite at 1122/0, 2x stable. Evidence, not claim.

### CQ2 — significance (live bun-link consumer): REAFFIRMED

Owner reaffirmed 2026-07-14 (engram obs #2066, verbatim intent "sí sigue vivo"): the bun-link ecosystem consumer is alive and depending on this local-consumption path today. All near-term significance rests on this human-only fact; it holds. Release-readiness is significant now.

### CQ3 — the adjusted bar: CONFIRMED

Owner confirmed 2026-07-14 (obs #2066, "confirmado"): the adjusted bar stands — serve the ecosystem consumer + party (b) the team; external npm-installing authors explicitly OUT of near-term scope. §2's result→problem map was judged against exactly this bar; the bar has not shifted, so the deferred install-by-registry pain is correctly OUT, not an unhealed gap.

### Delivered-dimensions re-check post-fix

The doc fix touched **docs + doc-tests only** — I confirmed via the working tree: the only source-of-truth files modified since the prior reckoning pass are `docs/quickstart.md` and `test/docs/quickstart-docs.test.ts` (plus `dist/**` build output and SDD metadata). **Zero `src/` changes** (git status shows no `src/` entries), zero workflow changes since the prior pass. The two judgment-day inline fixes (extractDescribeBlock anchor in `installed-consumer.e2e.test.ts`, package.json description verb list) predate the prior reckoning (judgment-day ran 11:24, before the 11:27 prior verdict) and were already in the tree my earlier pass judged. Every §2/§4 delivered dimension therefore stands unchanged.

### Owner design direction — registered as future-work, NOT smuggled in

The walkthrough surfaced an owner direction for the deferred `defineFactory` graduation (author exports the bare `(input) => …` function; the runner wraps it). I confirmed it is registered as a `decision` at engram obs #2070 (topic `project/defineFactory-graduation-direction`), explicitly flagged "Deliberately NOT acted on in stage-6-release-shape — touching the authoring surface would be problem-drift." `quickstart.md` only NOTES it as future ("will graduate to a core entry once an engine-backed surface lands"). It is future-work input for the graduation followup at archive, not a change to this change's authoring surface. No scope creep.

### Verdict

`delivered`. Every machine-analysable dimension was already delivered and coherent at the prior pass; the only things that blocked the gate were three human-only facts, and all three are now answered with REAL evidence I re-verified: a completed FAIL→fix→PASS walkthrough record with all attestations checked (CQ1), the reaffirmed live bun-link consumer (CQ2), and the confirmed adjusted bar (CQ3). The doc fix was real, scoped to docs + doc-tests, and green under my own test run. The conscience passes: this change solves its stated problem, is usable (owner-attested), and is significant today. Archive may proceed.
