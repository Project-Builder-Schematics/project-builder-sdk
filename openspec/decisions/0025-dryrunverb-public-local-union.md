# ADR-0025: Narrow `DryRunEntry.verb` to a public LOCAL `DryRunVerb` union

- Status: Accepted
- Date: 2026-07-07
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0024 (frozen six-row wire→author map — the runtime guarantee this type
  surfaces); ADR-0013 (six frozen wire ops); ADR-0009 (author DATA types cross the core
  boundary).
- Origin: change `stage-3-dry-run-exposure` (archived 2026-07-07).

## Context

`DryRunEntry.verb` was `string`, hiding the six-verb runtime guarantee the frozen map
(ADR-0024) establishes; an author's `switch(entry.verb)` gets no exhaustiveness help.
The type was not yet public (dead code), so this was the moment to shape it before the
semver freeze.

## Decision

Narrow `verb` to a LOCAL exported union
`DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy"` defined in
`src/dry-run/plan.ts`, exported through `./commons` with a defining-site `@example` that
demonstrates the exhaustive `switch(verb)`/`never`-arm idiom and states in prose that the
six members are FROZEN (growth = MAJOR) — the rationale surfaces where the author reads
it, not only in this ADR.

It intentionally DUPLICATES stage-2's identical `AuthoringVerb` (same values, different
module) — never imported across, same no-coupling rule as the map (ADR-0024 part 3).

## Consequences

- (+) Compile-time exhaustiveness for authors; consistent with `AuthoringVerb`.
- (+) Additive: net-new public type, FIT-04 flags no removal.
- (−) A new semver-locked type whose growth is a MAJOR event — acceptable because the
  six wire ops are already frozen (ADR-0013).
- (−) A second `DryRunVerb`/`AuthoringVerb` copy — covered by the same single-source
  extraction followup as the map (`openspec/pending-changes.md`, post stage-2+3 merge).

## Alternatives Considered

- **Keep `string`** — rejected: hides the guarantee, no author benefit.
- **Import `AuthoringVerb` from stage-2 core** — rejected: no-import fitness forbids
  core imports inside `src/dry-run/**`, and it would couple two independently-scheduled
  builds.
