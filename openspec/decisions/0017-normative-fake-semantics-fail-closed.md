# ADR-0017: Fake semantics are normative — fail-closed `move` (+ `force`) and existence-required `modify`

- Status: Accepted
- Date: 2026-07-04
- Deciders: Daniel (Hyperxq)
- Builds on: `openspec/problem-statement.md` (the fake is the legitimate counterpart, not a
  stopgap); ADR-0015 (all-or-nothing commit); ADR-0013 (verb→IR lowering).
- Closes: DECISION D1 (`openspec/objectives-plan.md`, Stage 1.2).

## Context

Two fake behaviors were registered in `pending-changes.md` as "engine-fidelity questions —
resolve against the real engine":

1. Fake `move` silently overwrites an existing destination (no fail-closed / `force`), unlike
   `create`/`rename`/`copy`.
2. Fake `modify` of a non-existent path materializes the file rather than erroring.

The ratified problem statement makes the contract fake the **normative counterpart** — these
questions can no longer defer to a real engine. Deferred, they would freeze inconsistent
semantics into golden-IR fixtures and the Stage 2 error-attribution contract.

## Decision

Ratified **fail-closed, with `force` on `move`** (owner, 2026-07-04):

1. **`move` onto an existing destination FAILS unless `force: true`.** The `move` wire
   directive gains an optional `force?: boolean`, making the destructive-overwrite posture
   symmetric across all four destination-colliding verbs (`create`/`rename`/`copy`/`move`).
   The author surface (`move(path, toDir, opts?)` and handle `.move`) accepts the same
   trailing-options shape its sibling verbs already use.
2. **`modify` of a non-existent path is an ERROR.** `modify` means "replace the content of an
   existing file"; it never materializes. Creating content at a new path is `create`'s job —
   the verbs stay semantically disjoint (ADR-0013's lowering table remains one-to-one).

Rejections from both rules surface to the author per the Stage 2 attribution contract (author
vocabulary, applied-boundary reporting); they are attributable errors, unlike read not-found,
which stays a value (ADR-0016).

## Consequences

- `src/core/wire.ts` `move` directive adds `force?: boolean` — a wire change made NOW, before
  golden fixtures and semver freeze it absent (Stage 1.1 fixtures pin the new shape ± `force`).
- The contract fake implements both rules; `test/fake/` pins them unmocked (Stage 1.3).
- The author surface (`src/commons/index.ts` `move` + handle `.move`) grows the trailing
  `{ force?: boolean }` its siblings already have.
- `remove` stays idempotent (deleting an absent file is not an error) — unchanged and now the
  documented, deliberate asymmetry: destructive *collisions* fail closed; absent *targets* of
  deletion do not.
- The "engine-fidelity questions" section of `pending-changes.md` is resolved by this ADR; if a
  real engine later disagrees, reconciling is an engine-board conversation against this
  ratified contract, not a silent SDK change.
