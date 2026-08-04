# ADR-0079: Capability Admission Replaces the Constraint-4 Deny-Scan

**Status**: Accepted · **Date**: 2026-07-29 · **Change**: `runner-tripwire-invariants` · **Supersedes**: ADR-0076 on mechanism (its outright ban survives; its deny-scan realisation does not)

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

## Alternatives Considered

- **Per-guard positional predicates**: superseded on evidence — it leaves the default at *pass*,
  and all three confirmed escapes survive it.
- **Generated, committed capability baseline artefact**: declined (ruling 8) — it churns on
  ordinary edits, and rubber-stamping restores default-pass through the human. Property adopted,
  artefact declined.
- **ts-morph type checker / module resolution**: rejected — it makes a fail-closed build gate's
  verdict a function of install state.
