# Error Attribution Skeleton Specification

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-21)
**Change**: `l1-author-surface-skeleton`
**Seam**: SEAM-04

## Purpose

Introduces a thin error-attribution wrap over `EngineClient.emit` / `.read` so that
a single forced rejection surfaces an `AuthoringError` in author vocabulary (verb +
path) instead of the raw `ContractFake:` / `OpMove` strings the engine currently
leaks. Seeds SEAM-04 so that `error-and-commit-contract` (#3) can grow the full
attribution across every verb and mid-chain rejection into an already-working slot.
The skeleton exercises one real forced rejection from the `ContractFake` — never a
mock.

**Sensitive areas**: None (pre-release; no published consumer).

## Requirements

### REQ-10: AuthoringError Type

The SDK MUST define an `AuthoringError` type carrying at minimum `verb` (the
author vocabulary word for the failing operation: `"create"`, `"modify"`,
`"remove"`, `"rename"`, `"move"`, `"copy"`) and `path` (the primary path of
the failing directive, `undefined` for batch-level rejections — see REQ-14.3).

#### Scenario REQ-10.1: AuthoringError carries verb and path

- GIVEN an `AuthoringError` value produced from a failed `create` directive on
  path `"src/foo.ts"`
- WHEN its fields are inspected
- THEN `verb` is `"create"` and `path` is `"src/foo.ts"`

#### Scenario REQ-10.2: The wire op "delete" translates to author verb "remove"

- GIVEN a directive with wire op `"delete"` (produced by a `remove(...)`
  call)
- WHEN the attribution translation layer derives the author verb for that
  directive
- THEN the resulting verb is `"remove"` — NEVER `"delete"`
- NOTE: this is deliberately a TRANSLATION-LAYER (verb-map) assertion, not a
  live fake-rejection test — `remove` never rejects (REQ-16 non-site), so no
  end-to-end rejection can exercise this mapping; the unit-level map proof is
  the honest framing, with no contradiction against REQ-16

### REQ-11: Engine Vocabulary Hidden from Author

When an `EngineClient.emit` call throws, the error surfaced to the factory author
MUST be an `AuthoringError`. The raw engine error text (`ContractFake:`, `OpMove`,
or any engine-internal vocabulary) MUST NOT appear in the surfaced error message or
type.

#### Scenario REQ-11.1: Forced-rejection collision surfaces AuthoringError, not engine text

- GIVEN a `ContractFake` seeded with `"src/existing.ts": "old"` and a factory that calls `create("src/existing.ts", …)` without `force: true`
- WHEN the runner executes the factory
- THEN the error thrown from the runner is an `AuthoringError`
- AND `verb` is `"create"` and `path` is `"src/existing.ts"`
- AND the error message does NOT contain `"ContractFake:"` or `"OpMove"`

#### Scenario REQ-11.2: AuthoringError propagates through defineFactory

- GIVEN a factory that triggers a forced rejection (as above)
- WHEN the runner's returned promise is awaited
- THEN the promise rejects with an `AuthoringError` (not a generic `Error`)

### REQ-12: Attribution Wrap Covers emit Call Site

The attribution wrap MUST intercept errors thrown by `EngineClient.emit` at the
`Session.flush` call site and translate them to `AuthoringError` before the error
reaches `defineFactory`'s `finally`/catch handling. The wrap MUST NOT swallow the
error; it MUST re-throw the `AuthoringError` so that `defineFactory` still
propagates it and triggers the discard path (REQ-07). The wrap MUST attribute to
the ACTUAL failing directive, located via the rejection's structured metadata
(`emit-rejection-metadata` REQ-ERM-01) — not `instructions[0]`.

#### Scenario REQ-12.1: Wrap intercepts emit error and attributes to the actual offender

- GIVEN a `Session` whose `EngineClient.emit` throws a rejection carrying
  `failedIndex: 2` for a 3-directive batch
- WHEN `Session.flush` is called
- THEN `flush` re-throws an `AuthoringError` (not the raw error)
- AND the `AuthoringError` carries the verb and path of directive index `2`
  — NOT index `0`

#### Scenario REQ-12.2: Discard fires after AuthoringError (integration with REQ-07)

- GIVEN a factory that triggers a forced rejection (raw engine error →
  AuthoringError)
- WHEN the runner executes the factory
- THEN the committed tree is empty (discard fired — REQ-07 integration)
- AND the error received by the test is an `AuthoringError`
- AND the fake's staging tree is discarded

### REQ-13: Single Real Forced Rejection in Cross-Boundary Test

At least one cross-boundary test MUST exercise SEAM-04 with the `ContractFake`
unmocked on BOTH sides: the fake throws a real collision error; the session attribution
wrap converts it; the factory runner propagates the `AuthoringError`; the test asserts
the committed tree is empty (SEAM-03 + SEAM-04 combined). No mock of the attribution
or commit/discard path is permitted in this test.

#### Scenario REQ-13.1: End-to-end forced-rejection cross-boundary test

- GIVEN a `ContractFake` seeded with a path that will collide, a real `Session`, and the attribution wrap active
- WHEN a `defineFactory`-wrapped function calls `create` on the colliding path
- THEN the runner rejects with `AuthoringError { verb: "create", path: <colliding path> }`
- AND the `ContractFake`'s committed tree is empty
- AND no mock intercepted the `emit`, attribution, or commit/discard path

### REQ-14: Every-Verb + Rejection-Family Attribution Coverage

Every directive-level verb (`create`, `modify`, `remove`, `rename`, `move`,
`copy`) MUST attribute its rejection to the ACTUAL failing directive — not
`instructions[0]` — with the correct author verb, primary path, AND exact
`reason` value, using the structured rejection metadata
(`emit-rejection-metadata` REQ-ERM-01). Every batch-level family
(`changes-too-large`, `unrepresentable-content`) MUST carry its `reason`
with NO fabricated verb or path (`verb`/`path` are `undefined`).

The exists-when bar: a batch of ≥3 directives failing at a NON-FIRST index
MUST assert the exact verb+path of the actual offender (not the first
directive) AND a non-zero `appliedCount` via `toEqual` — a single-directive
scenario cannot see the `instructions[0]` bug this REQ exists to kill.

[RED: **must-fail-first** — no test today exercises a multi-directive batch
with a non-first failing directive; today's `session.ts` hardcode passes
every existing (single-directive) test while shipping this bug silently.]

#### Scenario REQ-14.1: Mid-batch failure attributes to the actual offender, not index 0

- GIVEN a factory that buffers `create("a.ts", …)`, `create("b.ts", …)`, then
  `modify("missing.ts", …)` (target does not exist) — 3 directives, offender
  at index 2, whose verb DIFFERS from index 0's (so a lazy `instructions[0]`
  read yields wrong verb AND wrong path, not just wrong path)
- WHEN the run rejects
- THEN `AuthoringError` has `verb: "modify"`, `path: "missing.ts"`, and
  `reason: "path-not-found"` — NOT the first directive's
  `verb: "create"` / `path: "a.ts"`
- AND `appliedCount` is `2` (asserted via `toEqual`, not a truthy check)

#### Scenario REQ-14.2: Every directive-level verb + failure form attributes correctly

- GIVEN one single-directive rejection per case: create-collision,
  modify-not-found, rename-collision, rename-source-not-found,
  move-collision, move-source-not-found, copy-collision,
  copy-source-not-found (`remove` has no rejection path — non-site, REQ-16)
- WHEN each rejects
- THEN `verb` matches the AUTHOR verb called (`"remove"` never `"delete"`),
  `path` matches the primary path per verb (REQ-10), AND `reason` is EXACTLY
  `"path-collision"` for the collision cases and `"path-not-found"` for the
  not-found cases — the exact-value assertion per case prevents `"unknown"`
  from acting as a silent sink

#### Scenario REQ-14.3: Batch-level rejections never fabricate a verb

- GIVEN a batch that exceeds `BATCH_CAP_BYTES`, and a batch with a
  non-serializable `options` value
- WHEN each rejects
- THEN `reason` is `"changes-too-large"` / `"unrepresentable-content"`
  respectively, BOTH have `verb: undefined` and `path: undefined`, AND both
  surfaced `AuthoringError`s have `appliedCount: 0` (pinned at the PUBLIC
  level, not only on the port-internal `EmitRejection`)

### REQ-15: Mid-Chain / Multi-Flush Applied-Boundary Reporting

`appliedCount` is scoped to the SINGLE flush (`emit` call) that rejected —
directive-level, 1:1 with author verbs in v1 (no coalescing yet; revisited
at Stage 5 coalescing, ADR-0006). It is NOT cumulative across a run's
multiple flushes: an earlier flush's successes are not "at risk" from a
later flush's failure — they are separate `emit()` calls, already staged.

**Multi-flush scenario (explicit)**: a run that flushes `create A`
successfully (via an intervening `read()`), then buffers `modify B` +
`modify C` where `C` fails — the rejecting `AuthoringError` reports
`appliedCount: 1` (only `B`, from `C`'s OWN batch) — it does NOT report `2`
(it does not count `A` from the earlier, already-succeeded flush). If the
factory then propagates the error (making the whole run fail), `defineFactory`
discards ALL staged writes across the ENTIRE run — including `A`'s — per the
existing all-or-nothing run-level contract (ADR-01). The error's
`appliedCount` describes what applied within the failing batch; it does not
promise anything about the run's final committed state.

[RED: **must-fail-first** — no test today exercises more than one flush per
run with a rejection in a later flush.]

#### Scenario REQ-15.1: appliedCount is per-batch, not cumulative across flushes

- GIVEN a `ContractFake` seeded with `B`'s path (so the `modify B` directive
  APPLIES — without this precondition `modify B` itself would reject at
  index 0 and `appliedCount: 1` would be unreachable), and a factory that
  `create`s `A`, calls `find("A").read()` (flushes `A` successfully), then
  buffers `modify("B", …)` then `modify("C", …)` where `C`'s target does not
  exist
- WHEN the run rejects
- THEN `appliedCount` is `1` (just `B`, the true index-0 predecessor of the
  index-1 offender `C` in the failing batch) — NOT `2`

#### Scenario REQ-15.2: A later-batch failure discards the whole run, including earlier flushes

- GIVEN the same setup as REQ-15.1
- WHEN the run's promise settles
- THEN the fake's STAGING tree is empty after the rejection — proving the
  run-level discard actually fired and wiped `A`'s earlier successful flush
  along with `B` (the committed tree is empty on ANY failed run regardless,
  so asserting it alone proves nothing about discard)

### REQ-16: Intentional Non-Sites Declared

The following are declared NON-SITES for this stage — NOT counted as
attribution coverage, and no REQ in this change requires touching them:

| Non-site | Why |
|---|---|
| Commit-time rejection | `ContractFake#commit()` never rejects; every attributable rejection in v1 is necessarily flush-time (`emit`). This collapses the "flush-time vs commit-time" question: there is no observable commit-time case to discriminate against, so no separate discriminant is introduced. |
| `remove` (wire `delete`) | Idempotent by design (ADR-0017) — deleting an absent path succeeds. `remove` never produces an `AuthoringError`. |
| Read transport | The fake's `read()` never rejects (not-found is a VALUE, `undefined`, per ADR-0016) — genuine read-transport failures have no fake-side proof today. |
| Template-render rejection | Engine-origin family: the fake stores templates unrendered (rendering is the engine's concern); a render failure is unobservable until the real engine lands at Stage 6. Declared now so Stage 6 attribution picks it up deliberately. |
| `context.ts` double-fault (E1/E2) machinery | OUT OF SCOPE — a discard()-during-catch rejection silently dropping E2 is a pre-existing, documented limitation (pending-changes.md, `stage-1-ir-bedrock` follow-up). No REQ in this change touches it. |

#### Scenario REQ-16.1: Declared non-sites are named, not silently absent

- GIVEN the design and verify-final review of this change
- WHEN reviewers check for missing coverage
- THEN each of the five non-sites above is found explicitly named with a
  reason, not simply missing from the test suite

### REQ-17: Full E2E Author-Reads-The-Error Proof

At least one END-TO-END test MUST exercise the complete real path: a
`defineFactory` schematic → the runner → a real `ContractFake` → a rejection
carrying full structured metadata → the author's own `catch` block reading
`AuthoringError.reason`, `.origin`, `.verb`, `.path`, and `.appliedCount` —
and then SWITCHING on `reason` to take a distinct branch, proving the closed
enum is USABLE as designed (branch-and-recover), not merely readable.
No mock anywhere in this path (extends REQ-13's narrower single-family proof
with the full post-2.1 field set).

#### Scenario REQ-17.1: Author reads a fully-attributed error end-to-end and branches on it

- GIVEN a `ContractFake` seeded with a colliding path, and a `defineFactory`
  schematic that triggers the collision after two prior successful directives
- WHEN the runner's returned promise rejects and the caller inspects the
  caught value
- THEN it is `instanceof AuthoringError` with `reason: "path-collision"`,
  `origin: "write-rejected"`, the correct `verb`/`path`, and
  `appliedCount: 2`
- AND the catch block `switch`es on `reason` and demonstrably reaches the
  `"path-collision"` case arm (not a default/fallthrough) — the branch taken
  is asserted
