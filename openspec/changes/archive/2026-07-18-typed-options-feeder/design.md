# Design: Typed Feeder for Array/Object `create` Options (typed-options-feeder)

**Spec**: V2 signed (2026-07-18) · **Triage**: M · **Persona lens**: none · **Store**: hybrid
**Architecture impact**: modifying · **Design revision**: rev 2 (blind-review fixes — see Revision Note)

## 4.1 Architecture Overview

One SDK-side encode step at the wire-construction layer. A pure exported helper
`encodeOptions(options)` lives beside `forceEntry` in `src/core/directive-factory.ts` (the
dominant "pure-transform-inlined-into-the-factory-file" precedent). `DirectiveFactory.create()`
runs it on `a.options` for real emission; `src/scaffold/classify-transport.ts` — which already
imports `forceEntry` from the same file — imports and runs the SAME helper when building its
`prospectiveDirective` so the REQ-CCL-02 budget estimate measures the true post-encode wire
size. One definition, two call sites. Because `commons.create()` (both `template`/`templateFile`
overloads) and `scaffold` expansion (`expander.ts:171`) both funnel through `factory.create()`,
the single factory site covers all three author-facing surfaces (REQ-TOE-06); no verb-layer edit.
The change crosses no module/transport boundary — it reshapes a `JsonValue` one layer above the
JSON-RPC client.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/directive-factory.ts` | Modify | `encodeOptions` + `isPlainObject` predicate + recursive `assertEncodable` walk + `rejectOption`; call `encodeOptions(a.options)` in `create()` |
| `src/scaffold/classify-transport.ts` | Modify | import `encodeOptions`; apply to `options` when building `prospectiveDirective` (post-encode sizing) |
| `docs/create-templates.md` | Modify | §1 example → native array; delete §Appendix; drop the appendix cross-ref; add testing-observability note |
| `test/golden-ir/fixtures.ts` | Modify | `GOLDEN_CREATE.create.options.methods` → encoded string `'[{"name":"load"},{"name":"save"}]'` |
| `test/core/encode-options.test.ts` | Create | REQ-TOE-01/02/03/04(unit)/05 + predicate + reject-message contract |
| `test/commons/encode-surface-parity.test.ts` | Create | REQ-TOE-06.1/.2 (inline vs templateFile vs scaffold, absolute anchor); REQ-TOE-04 through real `create()` scheduling path |
| `test/fake/encode-recorded-batch.test.ts` | Create | REQ-TOE-07.1 (recorded batch shows encoded string) + REQ-TOE-07.2 (raw `createOp` hand-built encoded oracle vs factory) |
| `test/dry-run/plan.test.ts` | Modify | REQ-TOE-08.1 (composite options → no options field in `DryRunEntry`) |
| `test/scaffold/classify-transport.test.ts` | Modify | REQ-CCL-02.4 (composite post-encode boundary → by-reference) |
| `test/skeleton/error-attribution.test.ts` | Modify | REQ-14.3 (Stage-2) fixture reconcile: swap the flush-time `unrepresentable-content` input from a function (now rejected earlier at scheduling by `encodeOptions`) to a top-level non-finite number (`NaN`/`Infinity`) — see §4.2d |
| `test/docs/encode-options-docs.test.ts` | Create | REQ-TOE-09.1/.2 (zero options `JSON.stringify`; native §1; no appendix; note preserved) |
| `test/fitness/fit-39-single-encode-site.test.ts` | Create | source-scan: options-encode lives only in directive-factory + classify-transport |
| `test/skeleton/directive-factory.test.ts` | Read-only | composite-options literal present but assertions check only `template` — churn-free |
| `test/fake/directive-builders.ts` | Read-only | `createOp` stays RAW (deliberate factory-bypass oracle); 8 consumers unchanged |

Non-test source files: 3 (well under the 10-file re-triage threshold).

### 4.2d Reconciliation: Stage-2 REQ-14.3 flush-time guard (ARCH-F1)

`test/skeleton/error-attribution.test.ts:197-213` (Stage-2 REQ-14.3) currently drives
`create("a.ts", { options: { fn: () => {} } })` and asserts a **flush-time** `AuthoringError`
(`reason: "unrepresentable-content"`, verb/path `undefined`, `appliedCount: 0`) raised by
`contract-fake.ts`'s round-trip-drop guard. Under this design that function value is rejected
**earlier** — at scheduling time inside `encodeOptions` (a plain `Error`) — so it never reaches the
flush-time guard and the test would go red.

The flush-time `unrepresentable-content` guard is **NOT unreachable** for create-options: this
change's encode rejects only the spec-listed kinds (`undefined`/function/symbol/BigInt/circular/
`Date`/`Map`/class). It deliberately does **not** pre-reject non-finite numbers (`NaN`, `Infinity`,
`-0`) — they are `typeof "number"` and pass through top-level verbatim (REQ-TOE-03), then the fake's
flush-time round-trip guard still catches them (they round-trip to `null`/`0`), exactly as
`test/fake/boundary-pass-through.test.ts` already pins. So REQ-14.3 keeps a live path.

Reconciled expectation: **swap REQ-14.3's fixture input from `{ fn: () => {} }` to a top-level
non-finite number** (e.g. `{ ratio: 0 / 0 }`) — an input that PASSES `encodeOptions` yet still trips
the flush-time guard — preserving REQ-14.3's assertion that a batch-level rejection never fabricates a
verb/path. The function-value case it vacates is now covered at scheduling time by TOE-04 (plain-Error
loud reject naming the key). No REQ-14.3 assertion values change (`reason`/`verb`/`path`/`appliedCount`
identical); only the trigger input moves to one the new SDK-side encode does not shadow.

## 4.2b Flow Changes

Not applicable — library authoring-API DX change, no user-facing UI/CLI flow (explore "Affected
Flows" = N/A). Author surfaces are exercised by unit/integration tests, not an E2E product journey.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/directive-factory.ts` | modify | new `encodeOptions` value-lowering inside `create()`; amends ADR-0013/KIT-03 factory-purity invariant | aligns |
| `src/scaffold/classify-transport.ts` | modify | budget estimate calls shared `encodeOptions` (pre-existing `../core/directive-factory.ts` import) | aligns |
| `docs/create-templates.md` | modify | native-array teaching; appendix removal | aligns |

No `deviates` rows — contained modification of existing components in the layered/IR-seam pattern,
which is unchanged. Impact is `modifying` (not `none`) because ADR-01 amends the accepted ADR-0013
KIT-03 invariant: the baseline's `directive-factory.ts` "pure args→Directive; never renders/transform"
characterization becomes outdated and needs a value-lowering note on the next refresh.

## 4.3 Data Model / Interface Contracts

No public type signature changes (`options: JsonValue` already admits arrays/objects; `create()`
runtime behavior changes, its signature does not). New non-exported-or-internal shapes in
`directive-factory.ts`:

```ts
export function encodeOptions(options: JsonValue): JsonValue;
// If options is not a non-null object → returned unchanged (REQ-TOE-01.8 tolerance).
// Else builds a NEW object; for each own-enumerable entry (Object.keys):
//   string → verbatim (REQ-TOE-02);  number|boolean|null → verbatim (REQ-TOE-03);
//   array | plain-object → assertEncodable(value, key) then JSON.stringify(value) (REQ-TOE-01);
//   else (undefined|function|symbol|bigint|Date|Map|class instance) → rejectOption(key) (REQ-TOE-04).
// Result entries written via Object.defineProperty (own data property) — never spread/`result[k]=`
//   — so an own "__proto__" key round-trips without prototype assignment (REQ-TOE-05).

function isPlainObject(v): boolean; // typeof "object" && !null && !Array.isArray && getPrototypeOf ∈ {Object.prototype, null}
function assertEncodable(value, optionKey, ancestors=Set): void; // recursive: rejects nested undefined/function/symbol/bigint, Date/Map/class (non-plain), and TRUE cycles
function rejectOption(optionKey, detail): never; // throws plain Error, message contract below
```

**Circular-detection discipline** (ARCH-F2): `ancestors` is an **ANCESTor-path** `Set` — a value is
added on descent and **removed on ascent** (a scoped try/finally or add-recurse-delete around each
object/array node), NOT a global "ever-visited" `WeakSet`. A global visited set false-positives an
acyclic **shared reference** (`const s = { x: 1 }; { a: s, b: s }`) as circular and rejects data that
`JSON.stringify` encodes fine — a silent REQ-TOE-01 violation no scenario would otherwise catch. Only
a value that is its own ancestor (a true cycle, REQ-TOE-04.4) is rejected; a DAG of shared references
encodes normally.

**Reject message contract** (REQ-TOE-04, TW-F1): `` `option "${optionKey}" is not a plain-JSON value
the engine can render (${detail}). Options must be strings, numbers, booleans, null, arrays, or plain
objects.` `` — always names the top-level key; `detail` names the offending kind and, for nested cases,
a dotted/indexed path (e.g. `Date at when`, `undefined at methods[0].tag`); the trailing sentence
echoes the allowed set from docs §8 for actionability. Never contains raw serializer text ("Do not
know how to serialize a BigInt", "Converting circular structure to JSON"). Spec-admissible: REQ-TOE-04
pins key + author vocabulary + no-raw-TypeError, not the literal string. No signature threads through
`classify-transport.ts` beyond the existing `options` param.

## 4.5 Architecture Decisions

### ADR-01: Option value-lowering is lowering, not rendering (ADR-0013 / KIT-03 amendment)

**Status**: Proposed

**Context**: KIT-03 (ADR-0013) pins `DirectiveFactory` as "pure args→Directive; never renders
templates, never touches AST." JSON-encoding a native array/object option value at the factory is
a new transform on author input — the council asked whether this breaches KIT-03.

**Decision**: Amend ADR-0013 to state that JSON-encoding a serializable option value is
**wire value-lowering** (adapting a `JsonValue` to the shape the engine's v1 wire consumes),
categorically distinct from template **rendering** (DSL interpretation) and AST manipulation — both
of which remain banned. The factory already shapes directives (`forceEntry` key-omission); a shallow
per-entry `JSON.stringify` is the same class of pure wire shaping. Encoding is shallow/top-level: one
`JSON.stringify` call per composite entry (REQ-TOE-01); nested content rides inside that single call.
This "value-lowering" vocabulary names the code directly: the transform is the exported `encodeOptions`
helper (§4.3) — an ADR reader mapping decision→code lands on that one function.

**Consequences**: + Authors pass native arrays/objects everywhere. + `template`/`pathTemplate` bytes
still cross verbatim (unchanged; asserted by the skeleton test). − The baseline's factory-purity line
needs a lowering clarification (drives a post-verify refresh). − `create()` runtime output changes for
composite options (expected golden-fixture re-record).

**Alternatives Considered**: **Encode in the verb layer (`commons`/`expander`)** — rejected: two live
call sites duplicate the transform invocation and leave `classify-transport`'s estimate unfixed.
**Encode at `Session.flush()`** — rejected: couples op-blind flush to create-specific knowledge and
still misses the pre-flush budget estimate.

### ADR-02: String passthrough is the backward-compat mechanism (type discrimination, not a flag)

**Status**: Proposed

**Context**: `docs/create-templates.md` (PR #36) already teaches authors to hand-`JSON.stringify`
composite options. Turning on native encoding must not break those existing call sites.

**Decision**: Discriminate on each option value's runtime type. A value already a `string` (including a
pre-`JSON.stringify`'d one, or one beginning `[`/`{`) passes byte-identical — never re-encoded
(REQ-TOE-02). Only native array/plain-object values are encoded. Type discrimination IS the compat
seam; no version flag, opt-in mode, or dual code path.

**Consequences**: + Zero migration; both hand-stringified and native call sites work, in both revert
directions. + Idempotent (encoding an encoded string is a no-op). − The engine's v1 promotion of an
*ordinary* string beginning `[`/`{` (REQ-TOE-02.2) stays an engine-owned, documented limit the SDK
does not guard.

**Alternatives Considered**: **Version flag / opt-in feeder mode** — rejected: two behaviors to
maintain and test, and it forces authors to know the wire mechanism the whole change exists to hide.

### ADR-03: Interim plain `Error` + `createOp` stays an independent hand-built oracle

**Status**: Proposed

**Context**: The proposal framed rejection as a Stage-2 `AuthoringError`; the fidelity suites build
wire literals via `createOp`, deliberately bypassing the factory (its header). Two calls: error class,
and whether `createOp` should mirror the real encode.

**Decision**: (a) Throw a **plain `Error`** with the spec-pinned message (owner/pm ruling, Stage-4
interim precedent) — full `AuthoringError` `originFor` attribution is a registered followup, not built
here (constructing it needs a verb/path/reason the encode site does not own). (b) `createOp` stays
**raw** (writes `options` verbatim); REQ-TOE-07.2 parity is proven by an equivalence test comparing the
live factory/recorded output against a `createOp` expectation whose options carry the **hand-written
encoded string** (the absolute anchor).

**Consequences**: + `directive-factory.ts` keeps its light dependency footprint (no authoring-error
import). + `createOp` remains an independent oracle — a bug in `encodeOptions` cannot corrupt both sides
identically (the "shared encode-mutation makes both surfaces wrong identically" trap REQ-TOE-06.1
warns of). − Rejection lacks structured attribution until the followup lands. − One hand-maintained
encoded anchor string. − **Attribution regression (explicit)**: the scheduling-time plain-`Error`
SHADOWS Stage-2's structured `unrepresentable-content` `AuthoringError` for function/BigInt/symbol
values in create-options — those inputs previously reached the flush-time batch-level guard (verb/path
`undefined`, `appliedCount 0`) and now reject earlier as a plain `Error` naming the key (see §4.2d).
The registered `AuthoringError`-parity followup closes this: it restores structured attribution to the
scheduling-time reject. Non-finite numbers still reach the Stage-2 guard, so REQ-14.3 stays live.

**Alternatives Considered**: **`createOp` calls `encodeOptions`** — rejected: makes the oracle a mirror
of the code under test, blind to encode bugs. **Build `AuthoringError` now** — rejected per owner ruling;
unconstructible without inventing a verb/path here.

## 4.6 Test Derivation

| REQ-ID / scenario | Level | Test |
|---|---|---|
| TOE-01.1–.7 (encode, order, nested-ride, null-proto, empty, empty-opts) | unit | `test/core/encode-options.test.ts` |
| TOE-01.8 (options absent) | integration | `test/commons/encode-surface-parity.test.ts` |
| TOE-02.1–.2 (string passthrough) | unit | `test/core/encode-options.test.ts` |
| TOE-03.1–.2 (scalar/null verbatim) | unit | `test/core/encode-options.test.ts` |
| TOE-04.1,.3–.7 (loud reject, name key, no raw TypeError, allowed-set echo) | unit | `test/core/encode-options.test.ts` |
| TOE-04.2,.8 (nested undefined/function/symbol reject) | unit | `test/core/encode-options.test.ts` |
| TOE-04.4 (true cycle rejects — ancestor-path discipline) | unit | `test/core/encode-options.test.ts` |
| TOE-01 (acyclic shared reference `{a:s,b:s}` ENCODES — kills global-visited false-positive) | unit | `test/core/encode-options.test.ts` |
| TOE-04 (rejection surfaces at `create()` scheduling) | integration | `test/commons/encode-surface-parity.test.ts` |
| TOE-05.1 (`__proto__` own key, no prototype pollution) | unit | `test/core/encode-options.test.ts` |
| TOE-06.1 (inline vs scaffold, absolute anchor) | integration | `test/commons/encode-surface-parity.test.ts` |
| TOE-06.2 (templateFile == inline == anchor) | integration | `test/commons/encode-surface-parity.test.ts` |
| TOE-07.1 (recorded batch shows encoded string) | integration | `test/fake/encode-recorded-batch.test.ts` |
| TOE-07.2 (`createOp` oracle byte-matches factory) | integration | `test/fake/encode-recorded-batch.test.ts` |
| TOE-08.1 (dryRun options-blind) | unit | `test/dry-run/plan.test.ts` |
| TOE-09.1 (zero options `JSON.stringify`; native §1; no appendix) | architectural | `test/docs/encode-options-docs.test.ts` |
| TOE-09.2 (testing-observability note present) | architectural | `test/docs/encode-options-docs.test.ts` |
| CCL-02.1–.3 (existing size-flip/serialized/at-budget) | unit | `test/scaffold/classify-transport.test.ts` (regression) |
| CCL-02.4 (composite post-encode boundary → by-reference) | integration | `test/scaffold/classify-transport.test.ts` |
| REQ-14.3 (Stage-2 regression reconcile — NaN input still hits flush-time guard) | integration | `test/skeleton/error-attribution.test.ts` |
| single-encode-site (fitness) | architectural | `test/fitness/fit-39-single-encode-site.test.ts` |

Every REQ-ID/scenario from this spec covered. The REQ-14.3 row is a cross-change regression reconcile
(§4.2d), not a new REQ. No Flow Changes → no e2e rows required.

## 4.7 Fitness Functions

- **single-encode-site** (NEW, `fit-39`): options encoding (`encodeOptions`/options-targeting
  `JSON.stringify`) appears only in `directive-factory.ts` + `classify-transport.ts`; never in
  `commons/index.ts` or `scaffold/expander.ts`. Source-scan.
- **both-surfaces-identical**: TOE-06.1/.2 assert inline/templateFile/scaffold byte-equal to the
  absolute encoded anchor (not mere cross-equality).
- **string-passthrough invariant**: TOE-02 pins byte-identical passthrough.
- **encoded-bytes-measured**: CCL-02.4 pins the estimate uses post-encode size.
- **dryRun-options-blindness**: TOE-08.1 pins no options path into `DryRunEntry`.

## 4.8 Migration / Rollout

No migration, no flag, no persisted state. Single atomic PR (helper + two call sites + `GOLDEN_CREATE`
re-record + docs + tests) reverting together via one `git revert` (proposal Rollback). REQ-CCL-02.4
fixture: built at **real EMIT_BATCH_BUDGET_BYTES scale via deterministic escaping arithmetic**, matching
`test/fake/batch-cap-fixtures.ts` (quote-escaping inflation) and the existing CCL-02.3 real-scaffold
boundary test — NOT a test-local budget override (permitted by the spec note, rejected for
pattern-consistency; `classifyTransport` has no injectable budget param and adding one is unwarranted).
No native-array JSDoc example is added to `commons/index.ts` (resolves explore OQ2) — the DX teaching
stays in `docs/create-templates.md`, so the FIT-04 `.d.ts` baseline is untouched.

**Slice-author caution (TW-F4)**: the added testing-observability note is scanned by
`test/docs/doc-set-content.test.ts`, whose `WIRE_INTERNAL_TERMS` bans the case-sensitive literals
`EmitRejection`, `Directive`, `Batch`, and the word `delete`. The note must use author vocabulary
(lowercase "recorded batches", "options in encoded string form") and must NOT begin a sentence with
`Batches`/`Directive` or contain capital `Batch`/`Directive`/`delete`. `test/docs/encode-options-docs.test.ts`
should assert the note's presence via an author-vocabulary phrase, not a wire-term.

## 4.9 Performance

Negligible: one shallow pass over top-level `options` entries plus, per composite value, one linear
validation walk and one `JSON.stringify`. No new IO/network. `classify-transport` gains one
`encodeOptions` call per by-value candidate (bounded by the existing serialize it already runs).

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: ADR-01 amends the accepted ADR-0013/KIT-03 factory-purity invariant (touchpoint row
`directive-factory.ts` action=modify) to admit value-lowering, making the baseline's factory
characterization outdated — a post-verify refresh is warranted. No boundary, dependency, module, or the
layered/IR-seam pattern is added or removed, so not additive-only and not breaking.

## 4.11 Open Questions

None. (Explore's two technical open questions are resolved: OQ1 — classify-transport shares the encode
helper, §4.1; OQ2 — no `commons` JSDoc change, no FIT-04 regen, §4.8.)

**Docs note (add-vs-preserve)**: the REQ-TOE-09.2 testing-observability note (recorded batches show
composite options in encoded wire form) does not exist in the current `docs/create-templates.md`; the
design ADDS it. This satisfies the scenario's required end-state (note present in final doc); "preserve"
vs "add" is a mechanism detail, not a spec ambiguity.

## Followups (registered at archive)

- **`AuthoringError`-parity for scheduling-time option rejection** (from ADR-03): upgrade
  `encodeOptions`' plain-`Error` reject to a structured `AuthoringError` with `originFor` attribution,
  restoring the Stage-2 `unrepresentable-content` attribution depth the interim plain `Error` shadows
  for function/BigInt/symbol create-options (§4.2d, ADR-03 Consequence). **TW-F3 folds here**: there is
  currently no author-facing doc home describing the scheduling-time (vs flush-time) reject; that
  documentation lands with this followup, once the reject carries structured attribution worth
  documenting. Interim behavior (plain `Error` naming the key + allowed-set echo) is fully spec-covered
  by REQ-TOE-04 and needs no separate doc entry now.

- **ARCH-F1 (council fix round, post-final-verify)**: construction-direction fitness guard — assert
  that production `create` directives originate ONLY at `DirectiveFactory`. fit-39 (§4.2c) blocks a
  second `encodeOptions`/options-`JSON.stringify` call site but does not block a fourth surface that
  hand-builds a `create` directive literal bypassing the factory entirely (`createOp`'s test-only raw
  construction is the sanctioned exception, ADR-03). Style precedent: FIT-15/22.
- **QA-F3 (council fix round)**: `toJSON`-bearing plain objects reject as non-plain-JSON under this
  change's predicate, stricter than native `JSON.stringify` (which honors a `toJSON` method and
  serializes its return value instead of throwing). Document the divergence or revisit whether
  `toJSON`-bearing values should be admitted, when this area is next touched.
- **QA-F4 (council fix round)**: exotic inputs — a throwing getter, a hostile `Proxy`, or ~50k-deep
  nesting — surface their raw underlying error (stack overflow, proxy trap exception) rather than the
  key-named `rejectOption` contract REQ-TOE-04 promises for the documented non-plain-JSON kinds. Known
  limit; a depth/guard mechanism is a candidate for a future slice, not scoped here.
- **QA-F5 (council fix round)**: the classify-transport stat-gate's `>` boundary comparison (§4.2c /
  `classify-transport.ts`) is unpinned by a dedicated exact-boundary test — benign (verdict-equivalent
  to `>=` for the byte-count domain in play) but worth a pinning test if that comparator is ever
  touched again.

## Revision Note (rev 2)

Blind-review round (architect `revise`, tech-writer `approve-with-notes`). REQ-IDs untouched —
design-layer fixes only.

- **ARCH-F1 (HIGH)**: added `test/skeleton/error-attribution.test.ts` to §4.2 + new §4.2d reconciling
  Stage-2 REQ-14.3 — its flush-time `unrepresentable-content` fixture moves from a function value (now
  rejected at scheduling) to a non-finite number (still reaches the flush guard); the function case
  moves to TOE-04. Added the shadow-attribution Consequence to ADR-03.
- **ARCH-F2 (MED)**: §4.3 circular detection pinned to an ANCESTOR-PATH set (add-on-descent /
  delete-on-ascent), not a global visited `WeakSet`; added a shared-reference-DAG-encodes test row
  beside the true-cycle-rejects row.
- **TW-F1 (MED)**: reject message template now appends the docs §8 allowed-set echo.
- **TW-F2 (LOW)**: ADR-01 ties "value-lowering" vocabulary to the `encodeOptions` function name.
- **TW-F4 (LOW)**: §4.8 adds a slice-author caution — the observability note must dodge
  `doc-set-content.test.ts`'s case-sensitive wire-term ban (`Batch`/`Directive`/`delete`).
- **TW-F3 (folded)**: no-doc-home concern folded into the `AuthoringError`-parity followup (§Followups).

file_changes_count (rev 2): 5 Create, 6 Modify, 2 Read-only.
