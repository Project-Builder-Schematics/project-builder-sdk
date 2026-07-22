# North Star — copy-copyin-conformance-fixtures

**Checkpoint**: foresight (post-design) · **Verdict**: aligned · **Triage**: L
**Steward**: purpose steward · **Dated**: 2026-07-22

The durable statement of intent the reckoning checkpoint will hold the delivered result against.
Written from the ORIGINAL problem_statement (triage.md), not the spec.

## 1. This is what we're going to do (outcome terms, not implementation)

Hand the engine team the one thing it cannot make for itself: an **SDK-owned, well-formed,
pinnable `m2-copy` conformance fixture** that lets the engine's hard-gated `copy-wire-inclusion`
change merge. In the same change, **bank `copyIn` readiness** (`m2-copyin`, fully authored) on an
unmerged branch so it is ready the moment the engine's copyIn inclusion is in flight — without
ratcheting the engine's submodule pin on main today.

We are NOT resolving the schematic author's zero-bytes-on-disk pain directly. That pain is only
lifted when the engine's `copy-wire-inclusion` merges — which is out of this repo's scope by
design. This change removes the BLOCKER (`TestConformance_FixturesAreSDKOwned` fails the engine
build on engine-authored fixtures; the engine owner won't merge while the conformance test skips)
so the engine CAN lift it.

## 2. Here's how it fits

Two declarative fixtures join the root `conformance/` corpus layer (ADRs 0063-0067), each a
template-clone of the established `class: wire-mutation` + per-case `factory`-override pattern.
`m2-copy` (6 cases) is a pure `m2-rename-move` clone — the lowest-risk, most-precedented shape, so
the CRITICAL-PATH outcome rides the safest artefact. `m2-copyin` (5 engine-plane cases) introduces
one genuinely new structure — a package-local in-fixture `assets/` source dir (ADR-0073) — kept off
main via branch-hold. Architecture impact: **additive** (the baseline gains a fixture-subdir kind;
nothing in it becomes wrong). No `src/**` change, no engine-repo change, no new schema keys under
the strict `DisallowUnknownFields` decoder.

## 3. Here's the outcome we're chasing (traced to the problem statement)

| Problem-statement pain | What resolves it | Owned by THIS change? |
|---|---|---|
| Engine `copy-wire-inclusion` hard-gated — can't merge while its conformance test skips, engine can't self-author the fixture | `m2-copy` lands on main, SDK-owned, structurally green, pinnable | **YES — the primary outcome** |
| SDK PR cadence gates an engine milestone (fixture must land + pin BEFORE the engine change merges) | m2-copy independently mergeable, own commit, own corpus.json entry (REQ-CCR-04/09) | **YES** |
| `copyIn` is queued next engine-side; readiness should not force a premature pin-ratchet | `m2-copyin` authored fully, held on an unmerged branch; zero pin-ratchet on main (ADR-0074) | **YES — banked, not delivered** |
| Schematic author calling `copy()` gets zero bytes on disk | Engine's `copy-wire-inclusion` merging (engine-side) | **NO — out of scope by design; this change UNBLOCKS it** |

## 4. The honest delivery definition (what reckoning must hold to — read before archiving)

This change will archive in a state that is NOT "merged + engine-proven end-to-end." Reckoning must
NOT be ambushed by that. Per the owner's binding bundle-with-held-debt ruling and the REQ-CFX-11
honesty boundary, the honest DELIVERED state is:

- **m2-copy**: merged to main, structurally green at 6 fixtures / 18 cases, handed to the engine.
  Its outcome is **provisional** — CONFIRMED only cross-repo, post-merge, when the engine's Go
  harness runs it at submodule pin-advance (the proposal's own "REAL signal"). This repo proves the
  declaration is internally consistent and well-formed; it NEVER proves engine behaviour (REQ-CFX-11).
- **m2-copyin**: fully authored, green in isolation at 7/23, committed on a named branch but
  **NOT merged**; registered at archive as an authored-but-held debt row (branch name, un-hold
  trigger = engine copyIn inclusion in flight, 5-item re-validation checklist per REQ-CCR-09.3).

A reckoning that demands a merged-and-engine-proven end state would be holding the work to a bar the
owner explicitly ruled out of scope. The reckoning bar is: (a) m2-copy on main + structurally green
+ engine-consumable; (b) m2-copyin authored + held + debt-registered honestly.

## 5. The filed foresight question and the shorter-path check

**Does this design, executed perfectly, RESOLVE the pain or merely produce correct outputs?** It
resolves the pain this change OWNS (engine unblocked), provisionally-pending the cross-repo oracle.
It does not — and by scope must not — resolve the downstream schematic-author pain; it removes the
gate blocking that resolution. No outputs-without-outcome for the in-scope outcome.

**Is there a shorter path to the SAME outcome?** Yes for the IMMEDIATE outcome: `m2-copy` alone
unblocks `copy-wire-inclusion`; `m2-copyin` contributes nothing to it. The owner knowingly rejected
the m2-copy-only / m2-copyin-as-own-change path (PM's preference) for pair coherence and
engine-independence of SDK authoring (ADR-0074 Alternatives). The design HONORS that ruling with
full debt accounting rather than relitigating it. Not a gap.

## 6. Residual truths carried to reckoning (not blocking foresight)

- The critical-path outcome is confirmable only cross-repo. Several declared rejection codes are
  owner-confirmed-but-engine-unconfirmed (m2-copy `missing-source` → `not-found`; m2-copyin
  `dest-dir` → `collision`; writtenPaths `[]`; assets/ loader inertness). A wrong triple passes
  fit-40 locally but goes RED at engine pin-advance — turning "unblock" into a cross-repo re-block.
  The design is honest about this (Risks + un-hold checklist item 5 re-verifies the two riskiest
  codes). This is an irreducible property of the REQ-CFX-11 honesty boundary, not a design defect.
- m2-copyin's value is contingent on an external event ("queued next") with no committed date.
