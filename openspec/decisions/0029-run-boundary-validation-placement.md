# ADR-0029: Run-boundary validation placement + error-taxonomy wiring

- Status: DRAFT (Proposed; promoted at stage-4-typed-options archive)
- Date: 2026-07-06
- Change: `stage-4-typed-options`
- Builds on: ADR-0011 (ambient run context); ADR-0030 (ADR-0018 scoping); Stage-2 `authoring-error-contract`

## Context

Resolved inputs reach the factory through `defineFactory`'s returned runner, which today builds the
`RunContext` and calls `als.run(ctx, () => fn(o))` with zero validation (`src/core/context.ts`). The
spec requires fail-closed schema-conformance validation of `o` at a site distinct from the emit seam,
with nothing staged on rejection, and requires present-but-unparseable `schema.json` to fail closed AT
RUN TIME (REQ-RBV-05) — implying a runtime disk read, not a codegen-time snapshot.

## Decision

Validate at the existing pre-`als.run` chokepoint, at the top of the returned runner, BEFORE `RunContext`
is built — so a rejection throws with nothing buffered (all-or-nothing trivially preserved) and never
reaches the emit seam. When `options.packageDir` is present: (1) run the reserved-name file scan
(ADR-0028); (2) discover `schema.json` in `packageDir` and read it fresh from disk each run.

**Read-path error posture (SEC-3).** ONLY an `ENOENT` (file genuinely absent) maps to the RBV-03
opt-out/warning path. Any OTHER read error — `EACCES`/`EPERM`/`EISDIR` — FAILS CLOSED (interim as a
plain `Error`, upgraded to `AuthoringError` in S-006); an unreadable schema is never silently downgraded
to "no schema".
Then: absent → RBV-03 warning + proceed; unreadable (non-ENOENT) → fail closed; malformed JSON/shape →
fail closed (RBV-05.1); empty (zero properties) → RBV-05.2 warning + proceed; valid →
`validateInput(schema, o)`.

**Safe iteration (SEC-7).** Both the parse/sufficiency pass over `schema.json` and the validation pass
over the resolved input iterate via `Object.keys`/`Object.hasOwn` (or a null-prototype accumulator),
never property access that could trigger a `__proto__`/`constructor`/`prototype` getter — a
`__proto__`-DECLARING schema is inspected without polluting the prototype chain (a canary asserts it,
extending REQ-RBV-01.6's input-side check to the schema-parse/sufficiency side). Findings map to a thrown
rejection through a single isolated module, `src/core/schema/input-rejection.ts` — interim a plain `Error`
(no Stage-2 coupling), upgraded at S-006 to `AuthoringError`, at which point it becomes the ONLY code
coupled to Stage 2's error taxonomy.

**S-006-only Stage-2 gate (Gaps 2/3/4 — Option A, plain-`Error` interim).** The Stage-1 `AuthoringError`
on this build's base carries only `verb`+`path` (READ-ONLY here) and has NO `origin`/`reason` fields; more
decisively, Stage-2 DERIVES `origin` from a CLOSED `reason` enum (ADR-0021), so an interim
`AuthoringError{origin:"authoring-rejected"}` is UNCONSTRUCTIBLE until the two new enum members land. This
change therefore does NOT construct one interim:

- **INTERIM (S-000..S-005) — a plain `Error`.** Every interim rejection throws a plain `Error` whose
  `.message` is the EXACT pinned REQ-AEC-09 template literal. This has NO Stage-2 dependency — so there is
  NO whole-build precondition (the rev-3 "Tier-1 Stage-2-build-merged" precondition is REMOVED). Tests
  assert SITE + fail-closed + exact message literal + no-echo, and do NOT assert `instanceof AuthoringError`,
  `origin`, or `reason`.
- **S-006 — the `AuthoringError` UPGRADE.** Only S-006 requires Stage-2 ARCHIVED plus its coordinated
  `sdd-spec` amendment (REQ-AEC-07/08/09: origin/reason fields + the `invalid-input`/`reserved-name` enum
  members + the AEC-09 message rows). S-006's first task verifies `authoring-error.ts` carries them (else
  HALT `stage-2-precondition-missing`), then swaps the plain-`Error` throw for
  `AuthoringError{origin:"authoring-rejected", reason:…}` and flips the deferred assertions on.

`AuthoringError` (Stage-2-owned) is never edited by this change. Validation logic (parse/validate/sufficiency/
discovery/digest) and every interim throw are pure and Stage-2-independent; only `input-rejection.ts`'s
class UPGRADE at S-006 depends on Stage 2.

## Consequences

- One run-boundary site handles both reserved-name and schema rejections, throwing pre-`als.run` (interim a
  plain `Error`, S-006 an `AuthoringError`) — clean for RBV-04's uniform error-surface scan and for slicing
  (Stage-2-coupled code isolated to one file, upgraded in one slice).
- Disk-read-per-run satisfies REQ-RBV-05's runtime semantics and its acknowledged orphan-schema evasion.
- Cost: a SINGLE Stage-2 gate at S-006 (the interim plain-`Error` shape removes any whole-build precondition);
  S-006 sequences after Stage-2 archive + its coordinated amendment.
- No-echo (RBV-02/04) is structural: messages name field + expected type (or offending key) only, never the value.

## Alternatives Considered

- **Validate inside `als.run`/after context build**: would stage/observe run state before rejecting,
  muddying the all-or-nothing boundary and the site contrast with the emit seam.
- **Embed the parsed schema in the generated `.ts` and validate against that (no runtime disk read)**:
  cannot satisfy REQ-RBV-05's present-but-unparseable-at-run-time fail-closed requirement.
- **Throw a plain `Error` PERMANENTLY, never `AuthoringError`**: rejected as the END state — it forfeits the
  `authoring-rejected` origin/`reason` contract authors switch on. A plain `Error` IS used as the deliberate
  INTERIM bridge (Option A), because Stage-2's origin-derived-from-`reason` design makes an interim
  `AuthoringError{origin:"authoring-rejected"}` unconstructible; the final shape is still `AuthoringError`,
  restored at S-006. RBV-04's structured-surface scan is shape-agnostic (it scans message/`.stack`/fields/
  streams), so it holds over both the interim plain `Error` and the final `AuthoringError`.
