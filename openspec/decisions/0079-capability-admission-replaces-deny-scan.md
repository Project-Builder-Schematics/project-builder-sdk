# ADR-0079: Capability Admission Replaces the Constraint-4 Deny-Scan

**Status**: Accepted (amended in implementation — see Amendment) · **Date**: 2026-07-29 · **Change**: `runner-tripwire-invariants` · **Supersedes**: ADR-0076 on mechanism (its outright ban survives; its deny-scan realisation does not)

> **Amended by the judgment-day scope correction (2026-08-05)**: the Decision's "default is
> violation; ambiguity is violation" holds for ORIGIN admission and is retracted as a property of
> the mechanism as a whole. The superseded wording is preserved below, unedited, with the amendment
> after Consequences.

## Context

`denyScan` iterates identifiers and `continue`s the unrecognised — default **pass**, committed set
the *forbidden* one. Two judging rounds closed five AST spellings and neither could establish the
set was closed. Three escapes are probe-confirmed live on `main`: `globalThis["ev"+"al"]("1+1")`,
`(()=>{}).constructor("return 1")()`, and `node:child_process`. The shape tail is a consequence of
which branch is the default, not of AST checking.

## Decision

Every node of a closure file's capability surface classifies into exactly one of `{admitted,
violation, unclassifiable-construct}`; default is violation; ambiguity is violation. The admitted
set is two closed tables in `scripts/capability-admission.ts` — probe-measured at 21 globals, 6
`node:` module surfaces, and 30 admitted member paths on this branch's real closure — versioned
with the guard, changed only by a PR that also changes the guard's tests. Three legs, all
syntax-only: callee decidability, origin admission, positional decidability for denied roots.

**Digest provenance note**: design.md's own probe (HEAD `e6dcde2`) recorded 22 globals and 28
member paths. Re-verified against this branch's HEAD, the true counts are 21 and 30 — traced to
two JSDoc-comment-only edits landed on `main` after that probe (`src/core/context.ts`,
`src/core/wire.ts`; `git diff e6dcde2 HEAD` confirms zero AST/identifier-surface change, comment
text only). Flagged for the owner to reconcile design.md's prose; not an implementation defect —
`sdd-apply`'s own re-verification is the authoritative count for what ships.

## Consequences

- An ordinary closure edit introducing no new capability requires zero table edits, so there is
  nothing to rubber-stamp; adding a genuine capability is exactly the event that should stop a
  reviewer.
- Cost: a hand-rolled scope walk with its own tail, biased permissive-is-fatal. Mitigated by
  ambiguity⇒violation as a REQ, the no-reassignment precondition as its own REQ, and the real
  closure classifying with zero violations (423 call/`new` sites).
- Trust assumptions recorded, not expanded: ts-morph + the build env remain the tripwire TCB; a
  manifest is an inclusion list and cannot express absence — Constraints 2/3 remain the only things
  converting "listed" into "executed".

## Amendment — the admitted set is not closed, and default-violation is not a whole-mechanism property (2026-08-05)

The Decision above claims a closed admitted set with "default is violation; ambiguity is violation"
as the property that replaces `denyScan`'s default-PASS. A third adversarial round (blind
judgment-day, two independent judges) demonstrated executable bypasses again, with `execSync("id")`,
real `eval`, and a `Function` construction printing the Node version. That makes three rounds — the
original build, a remediation batch, and judgment day — each of which closed the spellings it was
shown and left the next round's shapes open. The Decision's property is therefore split:

1. **Retained, and red-proofed**: ORIGIN admission is default-deny. A root binding that is not
   local, not a closure import of an admitted name, and not an `ADMITTED_GLOBALS` member is a
   violation in every position. This branch previously had no fixture at all — replacing it with
   `{admitted, via: "local"}` left the entire suite green — and now carries three red-proofs plus a
   green sibling, verified to kill that mutant.
2. **Retracted**: "the admitted set is closed" and "ambiguity is violation" as properties of the
   mechanism. Two halves are permissive by construction, not by oversight:
   - The member PATH off a root the tables cannot decide (a local, a parameter, a closure import, a
     safe terminal) is checked against a DENY predicate over property names derived from the
     register — `CAPABILITY_BEARING_SEGMENTS`. An unbounded name space cannot be closed by a deny
     list; a carrier property named anything else launders its base.
   - Enumeration totality is relative to the enumerator's five `SurfaceNodeKind`s. A construct it
     does not reach is invisible, not unclassifiable. Tagged templates were exactly that for two
     rounds.
3. **The reason it cannot be patched into soundness**: deciding what an aliasing/reflection graph
   can reach is dataflow analysis. This ADR deliberately rejected the ts-morph type checker so a
   fail-closed build gate's verdict would not depend on install state — a choice this amendment does
   not reverse, because the alternative trades a bounded gap for an unbounded one. The consequence
   is that a member-path allowlist over an AST cannot be made sound, and no further round of
   spelling-closure will change that.

**What the mechanism is for, stated so no future reader has to infer it**: a DRIFT control against
honest mistakes and agent edits that widen the runner's executed surface — the framing this change's
own `north-star.md` already used — never an adversary control. The demonstrated residual bypasses are
recorded verbatim in `docs/runner-integrity-invariants.md#known-gaps`, and the one mechanism that
would have caught all three rounds (`FIT-CAP-ORACLE`, the differential oracle deferred in design §7)
is registered as its own future change, `capability-admission-oracle`, in
`openspec/pending-changes.md`.

## Alternatives Considered

- **Per-guard positional predicates**: superseded on evidence — it leaves the default at *pass*,
  and all three confirmed escapes survive it.
- **Generated, committed capability baseline artefact**: declined (ruling 8) — it churns on
  ordinary edits, and rubber-stamping restores default-pass through the human. Property adopted,
  artefact declined.
- **ts-morph type checker / module resolution**: rejected — it makes a fail-closed build gate's
  verdict a function of install state.
