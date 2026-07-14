# North Star — Stage 6: Release shape & DX closure

**Checkpoint**: foresight (post-design, forward-looking) · **Change**: `stage-6-release-shape` · **Triage**: L
**Verdict**: `aligned` (with escalated conscience questions carried to reckoning)
**Held against**: the owner-signed `problem_statement` + its release-READINESS amendments — NOT the spec.

## 1. This is what we're going to do (outcome terms)

Stages 1–5 built the entire authoring surface but nothing *packages* it. Stage 6 makes that surface
**consumable and trustworthy locally, and provably ready to publish later** — without pressing the
publish button. Concretely, after this change:

- Any consumer installing `@pbuilder/sdk` **locally** (`bun link` first, packed tarball as the
  release-shape vehicle) resolves every public subpath (`.`, `./commons`, `./conformance`,
  `./testing`, `./typescript`) and canNOT reach `./core` — proven at parity across both legs.
- The team can **trust the publish pipeline**: the fork-reaches-OIDC hole is closed (W3 repo-owner
  guard, job-scoped `id-token`, trigger-surface pin), every action is SHA-pinned, the tarball is
  decided and documented (`dist/core/**` ships intentionally, unmapped; no `.d.ts.map`; no secrets),
  and the pipeline is rehearsed but **never fired**.
- A new author reaches a **passing typed factory using ONLY the docs** — machine-verified (fenced
  blocks run against the linked/installed package), consumer-typecheck-verified (`tsc --noEmit` in a
  scratch consumer against the generated `.d.ts`), and human-verified (a recorded one-pass walkthrough).
- The planning docs are reconciled so the repo tells ONE consistent story: release-readiness, not a
  release; L2+ out; the deferred live-publish work booked as debt.

## 2. Here's how it fits (architecture)

Additive. Stage 6 adds NO runtime behaviour to `src/`. Four additive seams sit in existing
conventions: an inert committed npm placeholder under `tools/` (joins the `bin/` build-tooling-
outside-`src/` convention), a hardened-but-never-fired `publish.yml`, a `docs/` set in the
`authoring-a-dialect.md` house style, and a `bun link` leg grown on the existing installed-consumer
e2e via a shared `scratch-consumer.ts` seam. The IR-seam pattern, invariant #5, the five-subpath
`exports` map, and the single `ts-morph` dependency are all byte-stable. `dist/core/**` keeps
shipping because `./testing` imports `../core/context.ts` at runtime — the ADR-0034 ship-unmapped
posture, extended.

**Editorial note (archive-time, does not rewrite the above)**: of the four seams named above, the
npm-placeholder seam under `tools/` was DEFERRED at foresight CQ2 — the owner ruled the `@pbuilder`
scope is already owner-controlled, so an inert stub buys no security today; its reasoning and the
`0.0.1` semver-floor decision travel to the future public-package plan (ADR-0040, kept Deferred).
Three of the four seams shipped this change; the placeholder did not.

## 3. Here's the outcome we're chasing (traced to the pain)

| Stated pain (problem_statement) | Design deliverable that heals it | Verdict |
|---|---|---|
| No guarantee every public subpath resolves from a real install; `/core` must stay unreachable | `local-consumption` REQ-LC-01 (bun link + tarball parity), `factory-package-shape` exports/surface baselines | **heals** |
| Tarball drags `dist/core/**` with no decision taken | REQ-FPS-06 + ADR-0034 amendment: document-not-strip, decision TAKEN & documented | **heals** |
| Actions not SHA-pinned | REQ-PPH-02 SHA pins (`publish.yml` + `ci.yml`) | **heals** |
| Team cannot publish confidently — W3 guard absent, fork reaches OIDC (verified live) | REQ-PPH-01 W3 guard + job-scoped `id-token` + trigger-surface pin (ADR-0042) | **heals (party (b))** |
| No single doc from install to a passing typed factory | `author-onboarding-docs` REQ-AOD-01/07/08/11 (quickstart + machine leg + consumer tsc leg + human walkthrough) | **heals the LEARN half** |
| External authors CANNOT use the SDK (never published; learn only by cloning + reading tests) | Docs replace "read tests"; **live publish DEFERRED by owner** → install-by-registry NOT healed this change | **partial by owner ruling — see CQ1/CQ3** |
| ROADMAP / problem-statement / pending-changes drift after the reframe | REQ-AOD-09/10/12 reconciliation | **heals (closes its own drift)** |

**Outputs-without-outcome scan**: no orphan deliverables — every file change traces to a REQ and
every REQ to a scope item. The one proportionality concern (the npm placeholder machinery against an
already-owner-controlled scope) is owner-ruled *in* but flagged for reconsideration before slice
(CQ2). The planning-doc reconciliation (REQ-AOD-09/10/12) is the piece closest to "ceremony" but is
explicit 6.4 scope and closes the promise↔posture drift, so it earns its place.

## 4. User-journey simulation — where a real person still stumbles

**Journey A — author: local install → docs-only → passing typed factory**
- `bun link` resolves against BUILT `dist/`, so the producer repo must be cloned and built first. For
  the near-term ecosystem consumer this is fine; for a genuinely external author it is the SAME clone
  the problem statement named as today's pain — the docs heal "learn by reading tests," not the
  install-by-registry half (CQ3).
- Forget-to-build failure mode: a human running the two-step ritual by hand can link a stale `dist/`.
  Mitigated by the `link:sdk` convenience script (one documented command), **not closed** — no e2e
  covers the hand-run path (ADR-0041 architect dissent, owner-ruled).
- Re-linking after a later `src/` edit is not covered by `link:sdk` — real friction for a consumer
  iterating on the SDK; stated in the quickstart, encoded by `ensureTscBuild()`.
- Docs-only closure itself is strong: the bin contract is pinned (`pbuilder-codegen <package-dir>`,
  one positional arg, no flags) so docs cannot show wrong flags and silently fail the human leg.

**Journey B — maintainer: build → pack → rehearse → trust**
- Full closure of "publish confidently": prebuild-clean → declarationMap-off → baseline regen (strict
  sequencing, REQ-PPH-06) → FIT-14 (no `.d.ts.map`, no secrets, `dist/core` present) → fit-21
  (mutation-resistant workflow guard) → fit-22 (placeholder inertness).
- **Bounded trust**: in-repo tests cannot gate a direct push to `main` by a write-access holder that
  strips the guard/`--dry-run`. Named honestly (ADR-0042), booked as go-live debt (Environment
  required-reviewers gate, REQ-AOD-09.6). Dormant while no live publish exists — acceptable at the
  release-readiness posture.
- The placeholder's `deprecated` status is a live-registry fact no in-repo test can verify; deferred
  to an archive-time pending-changes followup (design §4.12).

## 5. Promise ↔ delivery drift

- **No gold-plating that breaches scope.** The placeholder is owner-ruled in (CQ2 asks for
  proportionality, not scope removal). The consumer-side `tsc` leg and the recorded human walkthrough
  are directly responsive to the "passing typed factory / docs-only" bar, not embellishment.
- **No silent under-delivery.** The original "why now" prose promised "a publishable product the day
  it closes"; the owner amendment softens that to release-READINESS. This is an EXPLICIT, signed
  reframe — and REQ-AOD-09 makes ROADMAP + problem-statement + pending-changes consistent with it, so
  the drift is *closed by design*, never hidden.
- **One honest bounded limitation** (maintainer trust vs direct-push-to-main), named and deferred.

## 6. The filed question

*Does this design, executed perfectly, RESOLVE the pain — or merely produce correct outputs?*
For party (b) (the team) and the near-term ecosystem consumer (bun link): **yes, concretely.** For
party (a) (external authors): **half** — learning is healed, install-by-registry is deferred by
explicit owner ruling. The remaining questions are human-only (significance of release-readiness
without a release; proportionality of the placeholder machinery; whether (a) counts as served now)
and are escalated below. No shorter path to the SAME owner-scoped outcome was found; the design
reuses existing vehicles (installed-consumer e2e, docs-as-test harness, ADR-0034 posture) rather than
forking them.

## Conscience questions (carried to reckoning — the owner must engage before it counts as delivered)

1. **Significance of release-readiness without a release.** The publish button is never pressed and
   the #1 hurting party (external authors) still cannot `npm install` the SDK after this change — by
   explicit owner deferral. The near-term outcome rests entirely on the Project Builder ecosystem
   consuming via `bun link`. Is that consumer live and active TODAY, so "release-readiness" is
   significant now — or does the true outcome wait for the deferred live publish, making this change
   scaffolding? (Owner has affirmed the reframe; this asks for explicit reaffirmation that the
   bun-link consumer is real, not hypothetical.)

2. **Proportionality of the npm placeholder — buildable cost cuttable before slice.** The owner's own
   explore ruling found the `@pbuilder` scope is owner-controlled and `@pbuilder/sdk` 404s (free
   inside the owned scope) — the squatting threat "NEUTRALIZED." Given the name is already safe, is
   publishing an inert placeholder NOW — with its full machinery (ADR-0040, the 10-scenario fit-22
   inertness suite, the RUNBOOK, permanent consumption of `0.0.1`, immediate deprecation) —
   proportionate, or should the placeholder + its guards defer to the public-package plan alongside
   the other carved-out remote-channel work, shrinking this change? This is cost the owner can cut
   before build if the answer is "defer."

3. **Usability for the actual external author (party (a)).** The documented "local install" via
   `bun link` still requires cloning and building the SDK producer repo — the same clone the problem
   statement named as today's pain. The docs heal the "learn by reading tests" half; the install half
   persists until live publish. Is the docs-only walkthrough (proven against a bun-link/tarball
   consumer) usable enough to count as healing (a)'s pain now — or is (a) simply out of near-term
   scope, with only the ecosystem and party (b) served? (Frames WHO the change serves so reckoning
   judges against the right person.)

## Owner affirmations (2026-07-12, foresight gate)

The owner engaged all three conscience questions directly:

- **CQ1 — significance of release-readiness without a release: AFFIRMED.** The bun-link ecosystem
  consumer is live and active TODAY, not hypothetical. The near-term outcome does not wait for the
  deferred live publish — "release-readiness" is significant now because a real consumer already
  depends on the local-consumption path this change proves.
- **CQ2 — proportionality of the npm placeholder: RULED — DEFER to the public-package plan.** The
  owner's own reasoning: the `@pbuilder` scope is already owner-controlled and `@pbuilder/sdk` 404s
  inside it — the squatting threat is neutralized today without publishing anything. A placeholder
  stub, its full inertness machinery (ADR-0040, the fit-22 suite, the RUNBOOK, the permanent
  consumption of `0.0.1`), buys no additional security given that fact. This is a PROPORTIONALITY
  ruling, not a scope-removal veto: the placeholder, `tools/npm-placeholder/*`, the RUNBOOK,
  ADR-0040, REQ-PPH-07/08, and the fit-22 suite all move to the future public-package plan. Stage-6
  now performs ZERO registry writes of any kind — the change SHRINKS.
- **CQ3 — usability for the external author (party (a)): RULED — OUT OF NEAR-TERM SCOPE.** Party
  (a) (external, npm-installing authors) is explicitly not served by this change; only the
  ecosystem consumer and party (b) (the team) are served now. Reckoning judges this change against
  that adjusted bar — it does not need to heal party (a)'s install-by-registry pain to count as
  delivering its outcome.
