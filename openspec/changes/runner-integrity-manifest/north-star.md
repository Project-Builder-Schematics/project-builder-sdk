# Steward Foresight — North Star (runner-integrity-manifest)

**Gate**: `steward_foresight` (post-design, forward-looking) · **Verdict**: **aligned** · **gap_category**: none
**Date**: 2026-07-25 · Run BLIND (artefacts only, no orchestrator transcript)

---

## The outcome, in one sentence

> **A production engine can finally spawn our real runner, because every published copy of the SDK
> carries a byte-exact, machine-checkable description of the 24 files that execute before the author's
> code does — and our build refuses to produce one when that set stops being sealable.**

**Primary observable**: the first real engine run against an installed `@pbuilder/sdk@0.1.0` executes
`dist/bin/pbuilder-runner.js` and does **not** fail closed — PC-RUN-01 flips from blocked to done —
with **zero** integrity-mismatch reports originating from installs nobody tampered with.

**Secondary observable (the half that is actually security)**: over the next handful of
closure-touching PRs, at least one tripwire or baseline-drift message fires on a real change, and the
maintainer's response is to fix the code or deliberately regenerate the baseline — **never** to weaken
the check. Zero firings *and* zero closure changes in a year means the tripwires were insurance nobody
needed; a false alarm reaching a user means R-1 materialised and prevention was insufficient.

## Where the blockage lifts

`bun run build` emits the manifest last → `npm pack` carries it → **the engine, before every spawn,
reads `<SDKRoot>/dist/runner-manifest.json` by literal join, cross-checks `packageVersion`, verifies 24
digests, and execs.** Today that read finds nothing and the engine fails closed by design. After this
change it finds a valid file. That is the whole gate.

**Partial lift, honestly scoped**: the engine can integrate against a `bun link`ed build the day this
merges; the end-to-end demo additionally needs `0.1.0` on a registry, which is gated by an as-yet
unplanned go-live batch.

## Outputs vs outcome — the uncomfortable finding, and why it is still aligned

**As an anti-tamper control the manifest is near-ceremonial under BOTH threat models** — the original
(author has no SDK-tree write access → their surface is entirely on the far side) and the corrected one
(the CLI falsified that premise; the channel was closed by an **engine-side ingestion write-denial**,
not by the manifest). In neither model is the manifest what stops the modelled adversary. Both parties
now say so in writing.

It is nonetheless **not** outputs-without-outcome, for three reasons in descending strength:

1. **It is a hard functional dependency, not optional ceremony.** The engine fails closed without it; a
   `0.1.0` without the file cannot be executed by a production engine. It is a required handshake token
   on the critical path — which is exactly what the problem statement claims.
2. **The durable security value is the tripwires, and they are in this change, at build time.**
   Constraints 2/3/3a/4 keep a bare specifier, a second dynamic `import()`, and any
   `createRequire`/`eval`/`vm`/`Bun.plugin`/`process.binding` reference out of the executed bootstrap.
   Constraint 4 is not appetite — the engine **adopted it into their own mirror check** and called it
   the correction that mattered most.
3. **The design solved the honesty problem structurally rather than hiding it.** Capability 8's docs
   page is machine-guarded: five Constraints each carrying `enforced-by:` resolved against a file that
   must exist on disk; `packageRootFor()` asserted **absent** as a justification; the `bun link`
   degradation stated; the C2 residual recorded. A control whose stated purpose is enforced by a test
   is the opposite of ceremony.

**What would flip the verdict** (neither present): shipping the docs page with the *original* story
("stops a malicious schematic author") → `outcome-gap / problem-fit`; or trimming the tripwires as scope
relief, leaving only the JSON emitter → `not-significant`.

## Framing correction carried to the reckoning gate

The triage's problem statement still opens in the **security** register. That framing is now stale — the
world moved under it. The operative clause (*PC-RUN-01 is blocked, hard build gate*) is unchanged and
still true. **This is NOT problem-drift**: the plan did not drift from the problem; the counterparty
retracted a premise and the plan adapted, in writing. But the problem statement should be re-read as a
**compatibility gate that happens to carry security tripwires**, not as a security gate. It survives
that re-reading intact.

## User journeys

- **(a) Build fails on a tripwire** — works. Frictions: the line is emitted-realm (argued, accepted);
  failure arrives at the end of the chain (correct tradeoff). **Check at apply time**: the `fix:` line
  must say "move it behind the factory boundary, or open a cross-repo contract round" — NOT "remove the
  import". For a maintainer who genuinely needs the dependency, the latter is confidently wrong in the
  one case where they are not making a mistake.
- **(b) Closure legitimately grew** — best-designed journey. Build succeeds (growth is allowed), CI
  fails with a permissive-register message naming the added node **and the edge that admitted it**. The
  "my build was green, why is CI red" moment is pre-empted by the message's own second paragraph.
- **(c) End user hits an integrity check** — **THE BREAK.** They see an *engine* error; the SDK has no
  surface. Version skew now lands calmly as a distinct `version-mismatch`, but a genuine
  integrity-mismatch leaves them with no `pbuilder verify`, no troubleshooting entry, and a docs page
  filed under *Contributor notes*. The design's answer is entirely **preventive** — correct priority,
  thoroughly executed — but the residual journey is **unowned**, and patching files to work around it
  *changes digests*, so there is no workaround by construction.
- **(d) The engine team** — gets everything asked plus the two corrections they ratified. Does **not**
  get the one thing they explicitly flagged: **Addendum 2's exit-code confirmation**, which their own
  purpose gate called *"the highest outcome-per-effort remaining"* and whose absence means *"every
  requirement of ours could be green and the first real run of your runner would still be
  misreported"*. Zero code. Currently held by nothing but a bullet in `triage.md`'s out-of-scope block.

## Promise ↔ delivery

All six acceptance boxes **delivered**, three of them sharpened beyond the ask (install round-trip;
locale + space/non-ASCII determinism; per-site dynamic-import scoping). Nothing promised is undelivered.
Reverse direction: Constraint 4 was adopted by the engine themselves; the tripwires were explicitly
asked for; **BDI-01 (bundler-output disjointness) is the weakest addition** — it scans only
`package.json#scripts`, with workflow steps, `Bun.build({outdir})` and `scripts/*.ts` calls explicitly
out of scope, so one third of the Constraint-1 machinery guards the naive form of the drift only. The
design **discloses** this rather than overselling it, which is the right call.

## Risks to the OUTCOME (not to the code)

1. **The cross-repo replies are unheld.** The exit-code confirmation and the `ModuleRoot` standing offer
   exist only as a bullet in an out-of-scope list — not in the spec, the file table, or
   `pending-changes.md`.
2. **Registration is an archive-time promise, and this repo's archives have a track record.** Project
   memory records the archive agent skipping Engram/registration writes **three separate times**. The
   `0.1.0` MANDATORY-precondition row and the C1 mechanism handoff are both "registered at archive" —
   i.e. the two things carrying this change's outcome past its own merge are the two most likely to
   vanish. **Verify these writes explicitly at archive; do not trust the envelope.**
3. **C1 is deferred to a batch nobody has planned.** Residual failure surfaces as *"integrity mismatch
   on a clean registry install"* — by the engine's own words the single worst false positive this
   control can produce, because it teaches people the check is unreliable.
4. **Tier C's network dependency vs the "fail loudly, never skip" rule.** PMF-02.3 is the only scenario
   covering the production install path. The outcome risk is not the flake — it is the pressure to quiet
   it, which would silently remove the only proof that `npm-normalize-package-bin` does not rewrite
   entry #24 on a real install.
5. **`BASELINE_DRIFT_MESSAGE`'s instruction is "regenerate and commit".** The path of least resistance
   for every future maintainer is to regenerate without reading the Constraints. Over a year, that is
   how a sealed closure quietly stops being sealed — and **no test can catch it, because regeneration is
   the sanctioned action.** The long-run decay path of this invariant; mitigation is review discipline,
   which this change cannot enforce.
6. **Zero-firing is indistinguishable from working.** The 18 red-proofs prove the checks *can* fire, not
   that they fire on the real drift when it comes.

## Conscience questions — GATE DOES NOT PASS UNTIL ANSWERED

1. **Sequencing / significance.** Should the engine integrate against a `bun link`ed build in the
   interim — where the manifest is, by IID-06, fully self-asserted — or should this change and the
   go-live batch be planned as one sequence, so the manifest is verified in anger rather than sitting a
   release cycle unexercised?
2. **Usability of the failure the whole design exists to prevent.** Is "prevention only, no user-facing
   remedy" acceptable for `0.1.0`, or does the outcome require a user-reachable troubleshooting surface
   before the first live publish?
3. **The cheapest outcome on the table, currently held by nothing.** Do you want the engine's Addendum-2
   exit-code confirmation answered now, out-of-band, rather than deferred to a followup that does not
   yet exist?

**Answers**: _pending owner_
