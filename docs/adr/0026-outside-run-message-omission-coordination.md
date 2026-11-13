# ADR-0026: Outside-run message-omission — defer via post-merge pending-change, do not edit `context.ts`

- Status: Accepted
- Date: 2026-07-07
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0011 (ambient run context — the throw site in question); ADR-0024
  (the `dryRun()` accessor that inherits the throw).
- Origin: change `stage-3-dry-run-exposure` (archived 2026-07-07).

## Context

`currentContext()`'s throw (`src/core/context.ts:20-24`) enumerates seven verbs and omits
`dryRun`; an author calling `dryRun()` outside a run gets an error listing every verb
except the one they called. The stage-3 spec forbade shipping the omission by DEFAULT and
offered three resolutions. Stage-2 rewrites this exact throw site into an
`AuthoringError`, relocating the prose VERBATIM into its constructor — preserving the
substring pin; generalising the enumeration is OUT of stage-2's scope.

## Decision

Option (c) — coordinate, not edit: stage-3 does NOT edit `context.ts`. A STANDALONE
post-merge pending-change is registered (`openspec/pending-changes.md`; default owner:
nobody's current lane — it targets the message wherever it lives after both stages merge;
target end-state: generalise the message away from a verb enumeration, preserving the
pinned "…can only be used while a schematic is running…" substring). REQ-DRE-01.4 pins
only that the SAME error propagates, not its text.

Until the followup lands, `dryRun`'s JSDoc COMPENSATES: a precondition line plus a
`@throws` note stating the standard error will not name `dryRun` (doc-test-pinned in
`test/skeleton/dry-run-public-contract.test.ts`) — the deferral is honest to the AUTHOR,
not just the changelog. Closing the followup also retires this compensating `@throws`
caveat.

## Consequences

- (+) Stage-3 stays off the contended lifecycle file (honors the triage condition + M
  scope); no merge conflict with stage-2's verbatim relocation.
- (+) The author is warned at the JSDoc surface they actually read.
- (−) The enumeration omission ships until the pending-change lands — deliberate,
  recorded, and doc-compensated, not silent.

## Alternatives Considered

- **(a) Extend the enumeration** — rejected: edits the contended throw AND re-introduces
  a verb list to keep in sync.
- **(b) Generalise now** — rejected: still edits the multi-line throw both stages touch,
  producing a textual conflict with stage-2's verbatim relocation.
- **Assign the followup to stage-2's message work** — rejected: stage-2 relocates the
  enumeration verbatim by design; generalisation is not in its scope, so "owned by
  stage-2" would orphan the fix.
