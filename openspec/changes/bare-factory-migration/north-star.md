# North Star — bare-factory-migration (foresight, post-design)

**Checkpoint**: foresight · **Verdict**: `aligned` · **Steward**: sdd-steward · **Date**: 2026-07-14

## 1. This is what we're going to do (outcome terms)

Delete the `defineFactory` wrap from the schematic author's vocabulary entirely. An author's
schematic becomes a plain typed `(input: Input) => void | Promise<void>` export — nothing to
wrap, nothing to pass at the definition site. `defineFactory` graduates to
runner/harness-internal machinery: `runFactoryForTest` (tests) and the future `pbuilder-runner`
(production) become the ONLY things that wrap, through a single shared seam.

## 2. Here's how it fits (architecture)

No layer, port, or dependency direction moves. The change NARROWS one facade (`./testing` drops
the `defineFactory` re-export) and RECLASSIFIES one symbol public → internal. `defineFactory`
stays declared in `src/core/context.ts` (impl frozen); a new import-reachability guard (FIT-29)
plus the narrowed FIT-08 export allowlist make the internal-only status STRUCTURAL, not
conventional. `runFactoryForTest` becomes the single wrap seam, delegating to the same
`defineFactory` the runner will call — proven now by a wrap-parity harness (REQ-ATH-19). This is
the symmetric counterpart to the earlier subpath-surface work; architecture impact: modifying.

## 3. Here's the outcome we're chasing (traced to the problem statement)

The problem statement names three pains and one timing reason:

| Stated pain / reason | How the design resolves it |
|---|---|
| "wrap their factory in `defineFactory` — ceremony encoding no decision" | The wrap is REMOVED from every author surface: exports, docs, JSDoc, scaffold error strings. Author writes a bare fn. |
| "forgettable failure point (missing/double-wrap → cryptic TypeError)" | Structurally eliminated — you cannot forget to wrap, or double-wrap, what you never wrap. The wrap moves to machinery the author doesn't touch. |
| "cost scales with schematic count" | The per-schematic ceremony is gone; N schematics × 0 wrap = 0. |
| "why now: engine↔SDK wire assumes bare shape; migrate first" | Bare shape lands NOW, single-wrap-seam parity proven NOW (REQ-ATH-19), so `pbuilder-runner` (out of scope) can consume the final shape and future author artefacts land already-correct. |

## 4. The filed question — does this RESOLVE the pain, or produce correct outputs?

**It resolves the pain.** The stated pain is the WRAP ceremony on the author surface; the design
deletes it from every author-facing surface and enforces its absence structurally. The chosen
path (hard cut, no dual-shape shim) is the SHORTEST path to the outcome — a shim would be MORE
work and would PRESERVE the very ambiguity the migration deletes. No lighter route reaches the
same outcome.

**Outputs-without-outcome scan — clean.** Every deliverable traces to the outcome: export
removal + FIT-08/FIT-29 (enforce the relocation), 5 docs + JSDoc + scaffold-error rewrites
(scrub the ceremony from author onboarding/failure surfaces), wrap-parity harness (prove the
relocated wrap doesn't drift from the runner seam), corpus/fixture regen (author artefacts land
in final shape). FIT-16 3rd-signal retirement is correct cleanup of a signal this change makes
vacuous, not standalone output.

**Promise↔delivery drift — none at foresight.** All three problem-statement promises map to
concrete signed REQs across the 5 delta domains.

## 5. Residual, honestly named (not a gap)

`packageDir` relocates from the author's `defineFactory(fn,{packageDir})` definition to the
caller — `runFactoryForTest`'s options bag in tests, the runner's invocation in production. For
a test-writing author, `packageDir` MOVES rather than vanishes. But (a) it was never the stated
pain — the WRAP was; (b) it is optional (untyped tier passes none); (c) the author's SHIPPED
artefact is clean. The residual plain-`TypeError` on misuse (REQ-ATH-18.1, non-function input)
is an accepted hard-cut tradeoff, not the author's forgettable-wrap failure mode (which is gone).

## Conscience questions (escalated — human-only judgments)

1. **Significance / timing.** The "migrate NOW, first, before the runner" urgency rests entirely
   on the live `pbuilder-runner` + engine↔SDK-wire direction (owner obs #2070). The DX win
   (ceremony removed) stands on its own regardless — but the *sequencing* rationale weakens if
   the runner is deferred. Confirm the runner direction is still live and "first" is still the plan.
2. **Usability of the packageDir relocation.** Does moving `packageDir` from the definition to the
   `runFactoryForTest` call read, to a real author, as *ceremony removed* or *ceremony moved*? The
   wrap is genuinely gone; `packageDir` is the residual. Suspicion: net win (optional + clean
   shipped artefact) — but that's a lived-experience call.

Neither question constitutes an `outcome-gap`; both are forward-looking flags for the human to
glance at before/during build. Verdict stands: **aligned** — slice may proceed.
