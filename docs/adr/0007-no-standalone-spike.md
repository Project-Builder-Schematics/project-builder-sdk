# ADR-0007: No standalone spike — validate the conversation in the walking skeleton

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Supersedes: roadmap §9.0 (the proposed time-boxed spike).

## Context

Roadmap §9.0 proposed a spike to prove `emit-IR → read-your-own-write` and to decide skeleton
altitude + the sync-vs-async signature. That was scoped when the engine was believed to be "a stub"
(roadmap §6).

## Decision

Drop the standalone spike. The engine has already **designed and partially built** the conversation:
read-through (engine ADR, two read surfaces), flush-before-read + Tree-first + no-SDK-shadow (engine
design.md §4), staging/rollback, and the **signed** wire contract (engine ADR-0028). The risk the
spike was de-risking has collapsed.

- The two decisions the spike owed are taken elsewhere: **sync-vs-async = async** (ADR-0001, this
  repo — reads cross the IPC boundary); skeleton altitude folds into the API design (ADR-0002/0004).
- Proof moves to the **walking skeleton** (`foundations-skeleton`) run against the **contract fake**
  (an `EngineClient` implementation, ADR-0002) — where read-your-own-write is exercised end-to-end
  naturally.

## Consequences

- No separate spike step; `foundations-skeleton` becomes the first executable change.
- The contract fake (the `EngineClient` impl) carries the spike's proof role — now a permanent test
  double rather than throwaway code.
