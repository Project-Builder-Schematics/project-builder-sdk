# ADR-0023: `AuthoringError` public promotion via `./commons`

- Status: Accepted
- Date: 2026-07-06
- Deciders: Daniel (Hyperxq) — promotion owner-ratified 2026-07-05
- Builds on: ADR-0009 (two-audiences contributor boundary); ADR-0013 (author vocabulary —
  `verb: "remove"`, never wire `"delete"`); ADR-0014 (subpath shape).
- Origin: change `stage-2-error-attribution` (2026-07-06).

## Context

An author could not `instanceof`-check or import `AuthoringError` (unexported) — the type was
not usable as a caught type. ADR-0009 keeps `core` behind the contributor boundary, so the
promotion had to be an explicit boundary decision, not a drive-by export.

## Decision

Re-export the `AuthoringError` class + its three supporting types (`AuthoringVerb`,
`AuthoringReason`, `AuthoringOrigin`) from `@pbuilder/sdk/commons` via the two-step
`import { … }; export { … };` form `FoundHandle`/`WritableHandle` already use. The rule this
encodes: **author-facing DATA types legitimately cross the core→commons boundary; kit
MACHINERY (`EngineClient`, `Session`, `DirectiveFactory`) does not** — exactly what FIT-08's
`KIT_SYMBOL_NAMES` scan enforces, now with a characterization pin freezing the distinction for
the error family.

The exported `.d.ts` freezes `verb: AuthoringVerb | undefined` and `path: string | undefined`
(the `undefined` arms ARE the batch-level contract, REQ-14.3). FIT-04 confirms the change is
additive, with dedicated `core.authoring-error.d.ts` and `commons.classify-content.d.ts`
baseline pairs guarding the emitted shape; FIT-06 demands defining-site `@example`s on every
exported alias.

## Consequences

- (+) `instanceof AuthoringError` + `switch(reason)` work across the `defineFactory` boundary;
  precedent-consistent with the handle types.
- (−) A new semver-locked public surface (sensitive area `public-api`) — frozen here
  deliberately; growth of any of the closed unions is MAJOR (ADR-0020).
- (−) A future one-step `export … from "../core"` would slip past FIT-08's two-step detection
  — a pre-existing FIT-08 limitation, not introduced here.

## Alternatives Considered

- **New `./errors` subpath** — rejected: an extra subpath for one type; `./commons` is where
  authors already are (ADR-0014).
- **Leave unexported** — rejected: the type stays uncatchable, which is the core problem this
  change solves.

## Related

ADR-0009 (boundary), ADR-0013 (author vocabulary), ADR-0020/0021 (the frozen members),
ADR-0022 (the port-internal counterpart that does NOT cross).
