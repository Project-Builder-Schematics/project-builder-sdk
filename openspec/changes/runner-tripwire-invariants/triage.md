# Triage: Runner Tripwire Invariants

**Classification**: L
**Decided at**: 2026-07-29T00:00:00Z
**Change name**: `runner-tripwire-invariants`

## Problem & Scope

> The `runner-integrity-manifest` cycle (archived 2026-07-25) ended judgment-day **ESCALATED — not approved**: the integrity tripwires (not the manifest, which shipped correct) carry known defects registered as debt — R2-3 (version-failure reuses the unreadable-file rule, 4/5 message lines false), R2-4 (malformed package.json fails OPEN, stale manifest), R2-5 (false positive on documented `module.createRequire(u).resolve(s)` idiom), R2-6 (path-spelling disjointness escape). Root-cause: these are AST-shape checks with a long tail — every fix round closes imagined spellings and judges find more. The ONE fix that held (R2-1) worked by inverting the invariant into a decidable structural property. Owner directs applying that approach to the class instead of another shape-matching round.

**Plan-verify final batch amendment (2026-07-29, finding A4)** — closes gap A4 of
`verify-plan-3.md`: the publish-pipeline-hardening family (`REQ-PPI-01..05`, slice
`S-000`) gained an `in_scope` arm (Scope Amendment (a) below) without this problem
statement ever naming the pain it addresses. Stated here: the publish path's zero-test
surface — `publish.yml` runs on every push to `main` with no suite gate and an
undeclared implicit rebuild dependency on `prepublishOnly` (W2/W1′) — is part of the
pain this change resolves, alongside the Constraint-4 tripwire debt named above.

```yaml
scope:
  in_scope:
    - "Close R2-3, R2-4, R2-5, R2-6 from the debt register"
    - "Redesign Constraint-4's guard class as structural invariants (decidable, no shape tail) per judgment-day.md's recorded fix direction and round2_lesson"
    - "Re-audit ~14 unresolved Round-1 findings + the meta-finding's child rows (R2-5, R1-7, R1-16, R1-17) in openspec/pending-changes.md — classify each subsumed-by-invariant-redesign / still-relevant-fix-here / stays-registered-debt"
  out_of_scope:
    - "0.1.0 publish sequence and its release-checklist row"
    - "User-reachable integrity-mismatch diagnostic (pre-live followup)"
    - "Loader observation for Constraint 1"
    - "Any engine-side work"
    - "Manifest generation/determinism machinery (shipped, correct)"
```

## Description Received

> Owner-directed 2026-07-29: apply the structural-invariant approach (the one fix that held, R2-1) across the Constraint-4 guard class, closing R2-3..R2-6 and re-auditing the debt register, instead of another AST-shape-matching round.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | ~7-9: `scripts/derive-runner-closure.ts`, `scripts/generate-runner-manifest.ts`, `test/support/closure-integrity-checks.ts`, `test/fitness/fit-42-runner-closure-integrity.test.ts` (+`.negative.test.ts`), `docs/runner-integrity-invariants.md`, `openspec/specs/runner-integrity-manifest/spec.md`, new/amended ADR | L |
| Lines affected (estimated) | Mechanism redesign + red-proof per closed finding (Strict TDD) across 4-6 findings | M-L boundary |
| Bounded contexts | 1 (the runner-integrity-manifest / Constraint-4 tripwire subsystem) | M |
| New patterns | The "prove a structural property, don't search for a shape" technique already has ONE precedent in this codebase (R2-1's own fix) — extending it to R1-7/R1-17/R2-5's siblings is a variant of an existing precedent, not greenfield | M (variant) |
| Test types | Existing (fitness tests + red-proofs), no new test infrastructure | M |

### Overrides Triggered
- **Sensitivity override (SUBJECT test fires)**: this change alters a security boundary's behaviour — the Constraint-4 deny-scan validation rules that gate arbitrary-code-execution bypass of the digest-verified closure. Per the steward's recorded framing ("COMPATIBILITY gate that happens to carry security tripwires"), the *parent* manifest work was compatibility-first — but *this* change's entire subject is the tripwire validation logic itself, not the manifest. Forces M minimum + security-engineer persona + mandatory verify final.
- **Escalation to L**: the sensitive mechanism (Constraint-4's guard class) IS the core subject of this change — analogous to "rewriting auth logic" in the rubric's own example, not passthrough proximity. This is independently re-derived from the subject test, not inherited from the prior cycle's L (which the owner explicitly warned against copying) — the size criteria alone sit at the M/L boundary, but the subject-is-core clause is unambiguous here.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → ready for `/build`
- Slice target: 4-7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — this is debt-closure against a registered register; scope discipline matters (owner already drew a tight in/out-of-scope line) |
| Architect | Always for L — the core deliverable IS a mechanism/ADR decision (structural invariant vs shape scanner), amending ADR-0076 |
| QA Engineer | Always for L — Strict TDD red-proofs per closed finding; this class of defect was previously missed by 5 in-loop verifies, a 4-lens simplify, and a final verify, so adversarial test design is the crux |
| Security Engineer | Sensitivity override fired (validation-rule alteration on a security boundary) |
| Tech Writer | `docs/runner-integrity-invariants.md` is explicitly in scope (R1-11) and the mechanism redesign changes what the doc promises about enforcement |

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Spec-compat flag**: `REQ-CST-04` (CST-04.1-04.4) is the REQ family the redesign touches directly. Spec.md's CST-04.1 inline note ("*A call-vs-`.resolve()` rule is evaded by...*") documents the FIRST rejected mechanism, not the shipped exactly-one-unaliased-binding invariant — `sdd-spec` should assess whether this needs a clarifying amendment or a MODIFIED block (unfreeze). Likely non-freezing (the REQ text itself doesn't mandate an implementation shape), but flag for owner confirmation before design proceeds.
- `REQ-BDI-01` (BDI-01.1/01.2, R2-6 path normalisation) and `REQ-RCD-03.3` (RP-12, already resolved by deletion in the prior cycle) are lower-risk — likely satisfied by implementation-only fixes with no REQ wording change, but re-verify compliance holds under the new mechanism.
- No REQ governs the R2-3/R2-4 version-failure classification (`ViolationRule` shaping is implementation-internal) — pure bugfix, no spec impact expected.
- **Registry gap found during triage**: two `carry_to_archive` items from the prior cycle's terminal state — "0.1.0 MUST ship dist/runner-manifest.json (hard-fail release-checklist row)" and "user-reachable integrity-mismatch diagnostic (pre-live followup)" — do NOT appear in `openspec/pending-changes.md` under any searchable phrasing, despite both being explicitly out-of-scope reference points for this change. This may be a repeat of this repo's known haiku-archive-registration-skip pattern (see engram `haiku-archive-verification`). Not this change's job to fix, but worth a separate followup to confirm/register.
- The 23-row debt register mixes items gated on the Constraint-4 mechanism decision (R1-7, R1-17, R2-5, R1-16, the meta-finding) with independent items (R1-9/10/12/13 test-quality, R1-14/15 unrelated security gaps, R1-18 case-sensitivity) — re-audit (scope item 3) must not let the mechanism redesign become an excuse to silently re-scope the independent rows out.
- ADR numbering: current max on disk is 0078 — new/amended ADRs for this change start at 0079 (do not collide; the repo already has TWO pre-existing 0073/0074/0075 filename collisions from an earlier concurrent-archive numbering slip, unrelated to this change but worth avoiding a repeat).

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read `judgment-day.md`'s full Round 1 + Round 2 tables (not just the confirmed criticals) to source the "AST-shape has a long tail" evidence per finding, and should treat R2-1's actual diff (commit `4b4914a`) as the reference implementation of the structural-invariant technique to extend. `sdd-design` must produce ADRs deciding the mechanism (per the meta-finding's own instruction: "decide the mechanism before patching the rows") before touching R1-7/R1-16/R1-17/R2-5 individually.

## Scope Amendment (2026-07-29, owner rulings 2/5/6/7 — recorded post-hoc; the rulings themselves predate this note)

`sdd-verify --mode=plan` iteration-1 (`verify-plan-1.md`, findings #1/#3/#4) found this triage's
`in_scope`/`out_of_scope` bullets lagging decisions the owner had already ratified at the
explore→propose gate (`explore-council.md` rulings 2/5/6, `explore-council.md` ruling 7). This
amendment closes the lag. It is additive — the original scope block above is untouched; this
section is the authoritative reconciliation.

**(a) `in_scope` gains** (both already built into the signed specs and slices; this note is the
triage-side paper trail):

- **Publish-path integrity** — W1′ (behavioural stamp→rebuild→pack proof) + W2 (publish-job
  suite gate) + R1-13 (execution-order guard) + the `react-conformance.test.ts` per-file timeout
  (ruling 2 put W1/W2 in scope; ruling 5 reshaped W1 into the behavioural form and pulled R1-13
  in; ruling 6 bundled the conformance timeout with W2 so a flaky gate cannot become a reason to
  route around it). REQ family: `REQ-PPI-01..05` (`specs/publish-pipeline-hardening/spec.md`).
  Slice: `S-000`.
- **Spec-honesty bundle** — `REQ-RCD-03` (R1-15 fix, `node:` validation vs `builtinModules`),
  `REQ-RCD-04.1`-adjacent directory-specifier honesty (R1-8, `REQ-DGN-01.2`), `REQ-RMD-05.1` and
  `REQ-RMD-01.2` wording deviations (ruling 7: "this IS the spec touch their trigger names").
  These are spec-text-and-enforcement alignment fixes, not new machinery — see (b) below for why
  they do not contradict `out_of_scope` bullet 5.

**(b) Clarifications to the existing `out_of_scope` bullets** (the bullets themselves are
unchanged; this is a reading, not a rewrite):

- Bullet 1, *"0.1.0 publish sequence and its release-checklist row"* — refers to the **go-live**
  sequence (the 0.1.0 release checklist item, "dist/runner-manifest.json MUST ship" as a
  hard-fail gate). It does **not** cover current-pipeline publish integrity — the fact that
  `publish.yml` runs today, on every push to `main`, with zero test coverage (W2) and an
  undeclared implicit rebuild dependency (W1′) is a present-tense correctness gap, not a
  future-release concern. Ruling 2 draws this line explicitly.
- Bullet 5, *"Manifest generation/determinism machinery (shipped, correct)"* — covers the
  generation **code path and its byte-determinism guarantee**, both of which ship unchanged
  (REQ-CAP-06 gates this: byte-identical `dist/runner-manifest.json`, halt on mismatch). It does
  **not** cover the two REQ **text** fixes (`REQ-RMD-05.1`, `REQ-RMD-01.2`) — those requirements
  were signed with wording the shipped enforcement cannot satisfy (a bare-substring username scan
  false-positives on `dist/transport/runner.js`; a cross-process locale scenario Bun's collator
  cannot fail), so fixing the wording to match reality is spec-honesty, never a machinery change.
  Zero bytes of `scripts/generate-runner-manifest.ts`'s determinism guarantee move.

**(c) `in_scope` item 3 (debt-register re-audit) — delivery vehicle named**: the re-audit's
delivery vehicle is the **archive gate**, not a slice, with this acceptance criterion: *every
`openspec/pending-changes.md` register row in scope for this change carries exactly one of the 5
dispositions (`CLOSED-BY-MECHANISM`, `CLOSED-BY-FIX`, `ALREADY-DISCHARGED`, `RE-REGISTERED`,
`OUT-WITH-REASON`) with a populated evidence field; row-count delta fully explained.* The
disposition **mapping** — which row gets which disposition — now lives IN the plan set as
`slices.md`'s own Excluded/Archive-Sync Ledger (the full 23-row table, plan-verify iteration-2
amendment, finding C), drafted against `propose-council.md` §"BA lens" and
`openspec/pending-changes.md`'s live register, and is **finalised (re-verified against the
actually-built code)** at `sdd-archive` time, not before — the register itself is a document
property (spec Open Item 3), not a code-behaviour REQ, so no Given/When/Then scenario tests it.

## Scope Amendment — plan-verify iteration-2 sub-note (2026-07-29, findings D/E/F/H)

Closes `verify-plan-2.md` findings D, E, F, H. Additive to the Scope Amendment above; nothing
in the original triage block or (a)/(b)/(c) above is rewritten.

**(D) Bullet-5 reconciliation extended** (finding D): amendment (b) above reconciles
`out_of_scope` bullet 5 ("Manifest generation/determinism machinery (shipped, correct)") only
against the two REQ **text** fixes (`REQ-RMD-05.1`, `REQ-RMD-01.2`). It does not yet name that
**`REQ-FCG-01`'s fail-closed-boundary rewrite of `generate-runner-manifest.ts`'s write/error
paths is `in_scope` item 1** ("Redesign Constraint-4's guard class as structural invariants"),
not a bullet-5 exception — R2-4's fix (malformed `package.json` fails OPEN) lives in exactly
that file, and `REQ-FCG-01`'s single fail-closed boundary is a structural-invariant redesign of
the generator's failure CHANNEL, the same technique item 1 applies to the Constraint-4 guard.
Bullet 5's "machinery unchanged" reading scopes to the manifest's **derivation and determinism
logic** (what bytes get computed, REQ-CAP-06's byte-neutrality gate) — never to the **failure
channel** (how a fault is reported and whether a manifest survives it), which is exactly what
`REQ-FCG-01`/S-004 rewrites. Zero contradiction: the derivation algorithm and its byte output
are frozen; the error-handling wrapper around it is not, and was never claimed to be.

**(E) Ruling 3 (M2.9, four primitives denied) — paper trail + boundary sentence** (finding E):
owner ruling 3 (recorded at `explore-council.md`'s propose gate) denies four additional
capability primitives — `node:child_process`, `node:worker_threads`, `WebAssembly`,
`module.register`/`registerHooks` — realised as `REQ-CST-04.2.6-.9` and `REQ-PRM-01.1`'s
11-member register (`specs/runner-integrity-manifest/spec.md`). This triage file did not
previously record ruling 3 in the Scope Amendment; it is recorded here. **Boundary sentence**:
static DENIAL of loader-hook APIs (`module.register`/`registerHooks` — the primitive is
forbidden from appearing in the closure surface at all) is `in_scope` under item 2 (structural
invariants for the Constraint-4 guard class); loader-hook **observation** (instrumenting what a
permitted loader hook actually DOES at runtime) remains `out_of_scope` bullet 3 ("Loader
observation for Constraint 1") — denying a primitive's static presence is a different
mechanism from observing an admitted one's runtime behaviour, and ruling 3 only ever touched
the former.

**(F) File-estimate note** (finding F): the Criteria Evaluation table's file-estimate row
(above, "~7-9" files) predates ruling 6, which pulls `test/conformance/react-conformance.test.ts`
into scope (its per-file timeout, `REQ-PPI-04`) bundled with the publish suite gate
(`REQ-PPI-03`) so a flaky gate cannot become a reason to route around it. The file count grows
by one: `test/conformance/react-conformance.test.ts` (Modify). No re-triage action follows —
the addition is a single-line timeout declaration (design.md §2 File Changes), not a size-class
event; the L classification and its size criteria stand as scored.

**(H) "Closes R2-6" clarified against M3.6** (finding H): wherever this change's artefacts say
`in_scope` item 1 or the register "closes R2-6" (this file's `in_scope` bullet 1 above;
`REQ-PTH-01`'s normative sentence in `specs/runner-integrity-manifest/spec.md`), the closure is
the **five confirmed spellings M3.1-M3.5** (`REQ-PTH-01.1-.5`), never M3.6. **M3.6**
(script-chaining/indirection through a second `package.json#scripts` entry) is a DISTINCT
surface, a sibling finding to M3.1-M3.5 but not one of the five R2-6 named — owner-ruled OUT of
scope at ruling 3, registered as a fresh dated debt row at `sdd-archive` (see `slices.md`'s
Deferred-to-archive list and its Excluded Ledger row for R2-6). This sub-note is the single
authoritative clarification; `specs/runner-integrity-manifest/spec.md`'s own dated note under
`REQ-PTH-01` (plan-verify iteration-2, finding H) cross-references it rather than repeating it
in full.

## Scope Amendment — plan-verify final-batch sub-note (2026-07-29, finding A7)

Closes finding A7 of `verify-plan-3.md`. Additive to the iteration-2 sub-note above; extends
its finding (D), does not rewrite it.

**(I) Bullet-5 reconciliation, success-path leg** (finding A7): amendment (D) above reconciles
`out_of_scope` bullet 5 against `REQ-FCG-01`'s **failure-channel** rewrite only ("how a fault
is reported and whether a manifest survives it"). `REQ-FCG-01`'s normative text also fixes the
**success** write path: "The only write path MUST be write-temp-then-rename..." governs every
generator run, clean or faulted, not only the faulted ones. Both legs — the failure channel
((D) above) and the success-path write mechanism (this note) — are `in_scope` item 1
(structural-invariant redesign of the Constraint-4 guard class, realised by `REQ-FCG-01`/S-004),
bounded by the same byte-neutrality gate (`REQ-CAP-06`): the write MECHANISM changes (atomic
write, single fail-closed boundary), the derived BYTES do not.
