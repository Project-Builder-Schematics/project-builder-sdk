# Outcome Override — runner-tripwire-invariants

**Date**: 2026-08-05
**Gate**: `steward_reckoning` → verdict `outcome-gap`, `gap_category: problem-fit`
**Decision**: **OVERRIDE** — accept the partial delivery, archive with the gap recorded.
**Decided by**: repository owner, answering the steward's `conscience_questions[]` with the
living map (`sdd/runner-tripwire-invariants/viz`) in front of them.

## The gap being overridden

`north-star.md` §3 commissioned **decidability**, stated as "no third judging round on this
guard class", with partial credit explicitly declared non-existent (criterion 9, read
symmetrically with criterion 11: "zero findings whose fix is 'add another spelling'").

A third judging round happened inside the change and a fourth is pre-registered. The
structural cause is one line: `CAPABILITY_BEARING_SEGMENTS` is a deny predicate over an
unbounded name space, so an unlisted capability-bearing property name passes. Three
residuals are documented in `docs/runner-integrity-invariants.md` § Known gaps; all three
classify at 0 violations and two execute:

- carrier property — `const w = { go: globalThis }; w.go.Reflect.get(w.go, "eval")`
- getter / class-accessor variant of the same
- indexer-function key laundering — `function pick(o, k) { return o[k] }`

## Owner's answers to the conscience questions

| Q | Answer |
|---|---|
| **CQ-R1** — is a green `fit-42` worth its ongoing cost as a drift control, knowing it will never be a security control? | **Yes, it is worth it.** |
| **CQ-R2** — does this change plus the queued successor discharge the "a lemma guarded by something that cannot be shown closed is not a lemma" premise, or must the lemma be weakened? | **Accepted as it stands** — the scoped claim plus the queued successor is the disposition; no further weakening required. |
| **CQ-R3** — the owner's own bar for done was not met: override, or does the bar stand? | **Override.** The bar was the decidability property, not the paperwork — criterion 3 and criterion 7's archive half were closed in the final pass; criterion 9/11 was not, and cannot be without dataflow analysis. |
| **CQ-R4** — who outside this repo believed the retracted claim? | **Notify.** The cross-repo row in `pending-changes.md` stands, and the notification to the engine owner goes out when PR #64 lands (until then `main` still ships the disproved claims). |

## Why override rather than re-route `problem-fit` to `sdd-propose`

Re-planning would spend a cycle on a road this change already proved closed with executed
evidence — three independent adversarial rounds each closed the spellings they were given
and each next round found new ones. The residual is registered with a correctly-shaped
successor (`capability-admission-oracle`, deliverable `FIT-CAP-ORACLE`) carrying an explicit
note that a member-path allowlist cannot be made sound without dataflow analysis. This
matches the steward's own recommendation.

## What the override does NOT excuse

The delivered value is real and independent of the gap: the publish path proves what it
ships (and PR #64 repairs the publish deadlock `main` currently carries), manifest
generation is fail-closed, tripwire messages are whole-verbatim, bundler paths are judged by
resolution, origin default-deny is real and mutant-killed, and the claims that outran the
mechanism are retracted in five places including the signed spec. The mechanism is a **drift
control against honest mistakes and agent edits** — not a bypass-prevention guarantee — and
every artefact now says so.
