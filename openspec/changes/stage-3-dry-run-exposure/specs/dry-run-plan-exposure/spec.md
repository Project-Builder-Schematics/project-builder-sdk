# Dry-Run Plan Exposure Specification

**Spec version**: V2
**Status**: signed — V2, owner, 2026-07-06 (accessor name `dryRun` ratified)
**Change**: `stage-3-dry-run-exposure`
**Domain**: NEW

V2 — blind council findings applied (business-analyst + tech-writer, both
approve-with-notes): cross-domain integration scenario added (REQ-DRE-01.5);
JSDoc discoverability requirement added (REQ-DRE-04); provisional name changed
`dryRunPlan` → `dryRun` per tech-writer ruling; scenario hardening on
REQ-DRE-01.1/.3; outside-run message-omission coordination point recorded;
`DryRunVerb` union narrowing flagged for design. All V1 REQ-IDs preserved.

## Purpose

Gives authors a read-only, ambient way to see the plan of what their run is about to
emit — closing objective O2 coverage line 5. The existing `dryRunPlan` renderer
(`src/dry-run/plan.ts`) is pure and complete but unreachable: nothing wires it to the
`Session`'s buffer or exposes it publicly. This capability adds ONE accessor to
`./commons` that reads the current run's buffered directives ambiently and renders
them in author vocabulary. It is exposure-only — no renderer logic changes here (that
domain is `dry-run-plan-skeleton`, modified separately in this same change).

## Requirements

### REQ-DRE-01: Accessor Reflects Buffered Plan

The system MUST expose, from `@pbuilder/sdk/commons`, a zero-argument accessor
(PROVISIONAL name `dryRun` — see Accessor Naming below) that returns
`DryRunEntry[]` reflecting exactly the directives currently buffered in the active
run's `Session` (`pendingSnapshot()`, rendered through the existing `dryRunPlan`
renderer), evaluated at call time. The accessor MUST NOT accept a snapshot argument —
it sources its input ambiently via `currentContext()`, mirroring every other verb in
`./commons`.

**Temporal contract (documented, not incidental)**: the accessor reflects what is
STILL PENDING, not everything the run has ever buffered. `Session.flush()` (fired by
`read()` or at run end) splices `#pending` empty; directives already flushed are gone
from a subsequent snapshot. An author who calls the accessor after a `read()` sees
only directives buffered SINCE that flush — this is the honest answer to "what will
this run still emit", not "what has this run emitted in total."

**Outside-run behaviour**: the accessor MUST NOT special-case the no-active-run case
with a fallback (e.g. an empty array or a swallowed error). It MUST propagate exactly
the error `currentContext()` raises for any other verb called outside a
`defineFactory` run — no accessor-specific try/catch.

**Outside-run message-omission coordination point (design-phase decision, not
silently shipped)**: the inherited error message (`src/core/context.ts:20-24`)
enumerates seven verbs (`create, find, modify, remove, rename, move, copy`) and does
NOT mention this accessor — an author calling it outside a run would today get an
error listing every verb except the one they called. Design MUST resolve the omission
deliberately, choosing one of: (a) add the accessor to the enumeration, (b) generalise
the message away from a verb list, or (c) explicitly register the coordination to
stage-2 (whose REQ-AEC-02 also edits `currentContext()`'s throw, in parallel). This
spec pins only that the omission is resolved by decision, not by default.

#### Scenario REQ-DRE-01.1: Accessor returns buffered directives in author vocabulary

- GIVEN a run that buffers `create("src/a.ts", { template: "…", options: {} })` then
  `modify("src/b.ts", "content")` (no `read()` call yet)
- WHEN the accessor is called
- THEN it returns exactly
  `[{ verb: "create", path: "src/a.ts" }, { verb: "modify", path: "src/b.ts" }]` —
  the two buffered directives, in buffer order, rendered in author vocabulary

#### Scenario REQ-DRE-01.2: Empty buffer returns an empty array, not an error

- GIVEN a run has started but no directive has been buffered yet
- WHEN the accessor is called
- THEN it returns `[]`

#### Scenario REQ-DRE-01.3: Accessor reflects only directives buffered since the last flush

- GIVEN a run buffers `create("src/a.ts", …)`, calls `find("src/a.ts").read()`
  (flushing and emptying `#pending`), then buffers `modify("src/b.ts", "content")`
- WHEN the accessor is called after the `read()`
- THEN it returns exactly `[{ verb: "modify", path: "src/b.ts" }]` — the one
  directive buffered AFTER the flush
- AND no entry for `src/a.ts` appears (already emitted, no longer pending) — the
  pre- and post-flush directives differ in verb AND path, so a wrong-entry result
  cannot pass on count alone

#### Scenario REQ-DRE-01.4: Accessor called outside an active run propagates the same error as other verbs

- GIVEN the accessor is called with no `defineFactory` run active (no ambient context)
- WHEN it executes
- THEN it throws the same error `currentContext()` raises for `create`/`find`/etc.
  called outside a run — no accessor-specific fallback or swallowed error

#### Scenario REQ-DRE-01.5: End-to-end — a remove() call surfaces as verb "remove" through the accessor

- GIVEN a run that calls `find("src/gone.ts").remove()` (buffering a wire
  `{ op: "delete" }` directive)
- WHEN the accessor is called
- THEN it returns exactly `[{ verb: "remove", path: "src/gone.ts" }]` — `remove`,
  never `delete` — proving the author-visible payoff THROUGH the accessor, spanning
  both domains (ambient wiring + author-vocabulary rendering); the renderer-only
  decoy (`dry-run-plan-skeleton` REQ-04.4) and the identity-verb happy path
  (REQ-DRE-01.1) cannot detect a mis-wired integration on their own

### REQ-DRE-02: Public Surface Type Boundary

The accessor's return type MUST be `DryRunEntry[]` exclusively. The `readonly
Directive[]` wire snapshot type returned by `Session.pendingSnapshot()` MUST NOT be
re-exported, referenced, or otherwise reachable from the public `./commons` `.d.ts`
surface — `pendingSnapshot()` and `Directive` stay core-internal (ADR-0009 boundary).

**Flag for design (tech-writer)**: `DryRunEntry.verb` is currently typed `string` in
the public surface, hiding the six-verb guarantee the frozen map
(`dry-run-plan-skeleton` REQ-04) establishes at runtime. Design decides whether to
narrow it — candidate: a LOCAL union
`type DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy"`
living in `src/dry-run/**`, NEVER imported from stage-2's
`src/core/authoring-error.ts` (the no-import fitness and the no-coupling rule both
forbid it). This spec does not mandate the narrowing; it mandates the decision be
made at design, not defaulted.

#### Scenario REQ-DRE-02.1: No wire type reference in the regenerated `.d.ts` baseline

- GIVEN the regenerated `commons.index.d.ts` baseline after the accessor is added
- WHEN its contents are scanned
- THEN no reference to `Directive` or `pendingSnapshot` appears anywhere in the file

#### Scenario REQ-DRE-02.2: Accessor's emitted type signature returns `DryRunEntry[]` only

- GIVEN the accessor's exported declaration in the `.d.ts` baseline
- WHEN inspected
- THEN it reads as a zero-parameter function returning `DryRunEntry[]` — no parameter
  or return position typed as `Directive[]` or `readonly Directive[]`

### REQ-DRE-03: Additive Export, No New Subpath

The accessor MUST be exported as a named export of `@pbuilder/sdk/commons`.
`package.json#exports` MUST NOT gain a new subpath key — the exact key set stays
`[".", "./commons", "./conformance"]` (ADR-0014).

#### Scenario REQ-DRE-03.1: Accessor is a named export of `./commons`

- GIVEN `src/commons/index.ts` after this change
- WHEN its exports are inspected
- THEN the accessor's name is among the named exports, alongside
  `create`/`modify`/`remove`/`rename`/`move`/`copy`/`find`

#### Scenario REQ-DRE-03.2: FIT-09 exact-subpath assertion is unchanged

- GIVEN `package.json#exports` after this change
- WHEN FIT-09's exact-subpath assertion runs
- THEN the sorted key set is exactly `[".", "./commons", "./conformance"]`

### REQ-DRE-04: Accessor Doc Discoverability

The accessor's emitted JSDoc MUST carry, at its defining site (mirroring stage-2's
REQ-AEC-04.3 / REQ-AEC-03.2 doc-obligation convention):

- (a) an `@example` block showing the accessor called INSIDE a run and reading
  `verb` and `path` off the returned entries;
- (b) the temporal contract in prose: the plan reflects STILL-PENDING directives
  and empties after a `read()`/flush — the honest answer to "what will this run
  still emit", not "what has this run emitted in total";
- (c) the shape-level guarantee: entries carry `{ verb, path }` only — no content
  or byte preview.

The spec-level temporal and shape contracts are worthless to an author who never
reads this spec; the JSDoc is the surface where the author actually meets them.

#### Scenario REQ-DRE-04.1: @example shows in-run usage reading verb and path

- GIVEN the accessor's emitted JSDoc
- WHEN its `@example` block is inspected
- THEN it shows the accessor called inside a factory run and reads `verb` and
  `path` from the returned entries

#### Scenario REQ-DRE-04.2: JSDoc states the temporal contract

- GIVEN the accessor's emitted JSDoc
- WHEN its prose is inspected
- THEN it states that the plan reflects still-pending directives AND that a
  `read()`/flush empties the pending buffer (directives already flushed no longer
  appear)

#### Scenario REQ-DRE-04.3: JSDoc states the shape-level guarantee

- GIVEN the accessor's emitted JSDoc
- WHEN its prose is inspected
- THEN it states entries carry verb and path only — no content or byte preview

## Accessor Naming (RATIFIED — `dryRun`, owner, 2026-07-06)

Ratified name: **`dryRun`** (tech-writer ruling at V1 council review; V1 proposed
`dryRunPlan`). Rationale: (1) maximally consistent with the exported entry type
`DryRunEntry` — the author sees `dryRun(): DryRunEntry[]` as one vocabulary;
(2) zero source-level collision with the internal pure renderer
`dryRunPlan(snapshot)`, so the `commons` call site needs no import alias;
(3) the query-vs-action nuance (accessors read, verbs write) is resolved by
REQ-DRE-04's mandated `@example`, which shows it as a read.

**Owner's fallback alternative** (recorded for signing, not chosen here): keep
`dryRunPlan()` as the public name and rename the internal renderer to
`renderDryRunPlan(snapshot)` — dissolves the collision at the cost of editing the
main-spec REQ-04 signature wording (`dry-run-plan-skeleton`).

This name is NOT frozen: owner sign-off ratifies it. REQ-IDs in this domain
(`REQ-DRE-*`) are capability-based and do not embed the name, so either outcome
does not break ID stability.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | REQ-DRE-02, REQ-DRE-03 | Yes — triage's risk list flags `package.json#exports` as a registered sensitive area; additive-only, confirmed by REQ-DRE-03 |

No auth/payments/privacy/security/data-migration surface touched.
