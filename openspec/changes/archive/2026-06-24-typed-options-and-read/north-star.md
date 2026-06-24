# North Star — typed-options-and-read (foresight checkpoint, 2026-06-22)

**Verdict**: `aligned` (steward foresight, blind) · **Checkpoint**: foresight (post-design, pre-slice)

## Intent (quotable verbatim at reckoning)
After `typed-options-and-read`, a schematic author writes `create<S>(...)` and the compiler enforces
required keys, optional omission, per-key types, and excess rejection — a typed schematic becomes
mechanically distinguishable from an untyped script — AND can branch on disk state via
`find(path).read()` returning content / `undefined` (not-found) / `""` (empty) as three distinct,
statically branchable outcomes, enabling "scaffold if missing, seed if empty, else patch" without
`try/catch` and without clobbering a deliberately-empty file. The differentiator is not merely written
but CI-proven: a regression that re-permits the negative cases flips CI red.

## How it fits
Sub-change #2 of the `l1-author-surface` program — the "grow the VALUE half" step. Makes SEAM-01
(`OptionsOf<S>`) real and adds the read trichotomy, both BEFORE L1 freezes the semver surface. Stays
inside the single-layer library + IR-seam port pattern; no new layer/edge. Defers error attribution /
commit / read-staged to #3, dry-run / tarball to #4 — scope fences hold.

## Steward findings
- Both stated pains addressed head-on; no daylight between pain and design. No outcome-gap.
- All three trim candidates scrutinised — CI-guard redesign (closes a false-green that would let the
  differentiator silently rot), internal-only `OptionsOf<S>` (LESS surface than exporting),
  translate-absence-on-the-port (only shape that doesn't conflate not-found with failure) — each is
  ESSENTIAL, not gold-plating. No shorter path to the same outcome.

## Conscience questions (escalated to human — to surface at the verify-plan stop; non-blocking at foresight)
- **CQ-1 (usable)**: the read trichotomy's value depends on authors using `=== undefined`, never
  `if (!content)`. Design fences with a mandatory `@example` + documented anti-pattern. Is that steer
  sufficient for L1, or does it need a stronger affordance (lint rule / named result helper)?
- **CQ-2 (significant)**: `OptionsOf<S>` is proven only against synthetic test schemas. Does L1's value
  story need at least one real end-to-end typed-factory example, or is the type-proof matrix enough to
  claim the value half delivered?

Both CQ-1 and CQ-2 are potential scope ADDITIONS over the current minimum-viable scope — candidates for
the user to accept-now or register as followups. Neither blocks slice.

The reckoning checkpoint (pre-archive) will hold the delivered result against this intent verbatim.
