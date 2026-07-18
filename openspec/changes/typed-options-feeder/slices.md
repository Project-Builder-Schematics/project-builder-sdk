# Slices: Typed Feeder for Array/Object `create` Options (typed-options-feeder)

**Triage**: M
**Spec version**: V2 (signed)
**Total slices**: 4 (1 walking skeleton + 3 SPIDR)
**Revision**: rev 3 — two residual technical questions from plan-verify iteration 2 (13→2, Judge A fully clean): defineProperty descriptor pinned + TW-F4 constraint inlined into S-003.5. rev 2 added the Executor Context section itself (plan-verify iteration 1, verdict `gaps`: blind simulated-executor judge found 13 blocking questions, root cause = REQ-IDs/filenames cited without load-bearing content). Slice structure/IDs/ordering/REQ mapping unchanged since rev 1 (Judge A passed them cleanly both iterations).

---

## Executor Context

**Word count exempt from the 800-word guidance** — gate-mandated foundational reference (verify-plan-2).

**Read-access note**: the blindness constraint above (slices.md-only) is the PLAN-VERIFY JUDGE's, not the builder's. `sdd-apply` MAY and SHOULD read the two signed spec files directly for full Given/When/Then prose: `specs/typed-options-encoding/spec.md` and `specs/content-classification/spec.md` (also mirrored under `openspec/changes/typed-options-feeder/specs/*/spec.md`). This section inlines only the load-bearing mechanics so the artefact stands alone even without that read.

**Problem** (from triage): Schematic authors currently hand-`JSON.stringify` every array/object-valued `create` option at every call site, because the engine's v1 wire only promotes a string beginning `[`/`{` into a real structure — this is SDK-owned DX friction, owner-ruled to resolve SDK-side. Audience: schematic authors calling `create()`/`scaffold()` from `@pbuilder/sdk`.

### File Map

| Path | Current signature / role |
|---|---|
| `src/core/directive-factory.ts` | `export function forceEntry(force: boolean \| undefined): { force?: boolean }` (line 47, sibling pattern). `export class DirectiveFactory { create(a: CreateArgs): Directive }` (line 51-62) returns `{ op: "create", create: { pathTemplate: a.pathTemplate, template: a.template, options: a.options, ...forceEntry(a.force) } }` — `options: a.options` (line 58) is the call site `encodeOptions(a.options)` replaces. `CreateArgs.options: JsonValue` (line 8). |
| `src/scaffold/classify-transport.ts` | `export function classifyTransport(params): ClassifyResult` (line 100). Builds `prospectiveDirective` (line 156-159): `{ op: "create", create: { pathTemplate: destPath, template: content, options, ...forceEntry(force) } }`, then measures it via `serializedBatchSize([prospectiveDirective])` (line 160) against `EMIT_BATCH_BUDGET_BYTES`. Already imports `forceEntry` from `directive-factory.ts` (line 24) — precedent for importing `encodeOptions` alongside it; `options` here is currently the RAW, pre-encode value. |
| `src/commons/index.ts` (read-only) | `export function create(path, opts: CreateOptions \| CreateFromTemplateFileOptions): WritableHandle` (line 187-193) calls `session.buffer(factory.create({...}))` (line 197) — funnels through `DirectiveFactory.create()`, no direct edit needed. |
| `src/scaffold/expander.ts` (read-only) | Calls `factory.create({...})` at line 171 during by-value scaffold expansion — same factory funnel, no direct edit needed. |
| `src/dry-run/plan.ts` (read-only) | `export interface DryRunEntry { verb: DryRunVerb; path: string; kind?: "rendered" \| "copied" }` (line 68-72) — no `options` field exists or should exist. `export function dryRunPlan(snapshot): DryRunEntry[]` (line 103) maps `Directive[]` to this shape. |
| `test/golden-ir/fixtures.ts` | `export const GOLDEN_CREATE: Extract<Directive, {op:"create"}>` (line 11-18); `create.options.methods` is currently the native array `[{ name: "load" }, { name: "save" }]` (line 16). S-000 re-records this field to the encoded string. |
| `test/skeleton/error-attribution.test.ts` | REQ-14.3 `describe` block, lines 197-213. The `it` (line 198-212) calls `create("a.ts", { template: "A", options: { fn: () => {} } as unknown as JsonValue })` (line 204) and asserts `err.reason === "unrepresentable-content"`, `err.verb`/`err.path` `undefined`, `err.appliedCount === 0`. |
| `test/fake/directive-builders.ts` | `export function createOp(pathTemplate, template, forceOrOptions?: boolean \| JsonValue): Directive` (line 19-28) writes `options` VERBATIM — no encoding. Third arg is either a `force` boolean or a raw `JsonValue` used directly as `options` (line 20). Stays raw per ADR-03. |
| `docs/create-templates.md` | §1 "One options object drives both fields" (line 53-81): example currently has `methods: JSON.stringify([{ name: "load" }, { name: "save" }])` (line 64) and cross-refs "[the appendix](#appendix-passing-arrays-and-objects-in-v1)" (line 80-81). `## Appendix: passing arrays and objects in v1` (line 483-501) is the section S-003 deletes entirely. |

### Encoding Contract (REQ-TOE-01)

Compact `JSON.stringify(value)` per top-level composite entry — no spacing/indent argument. Insertion order of `options`' own keys is preserved (iteration order, NOT a canonical/alphabetical sort). Shallow: one `JSON.stringify` call per top-level composite value; nested content rides inside that single call, never independently re-stringified. Result object assembled via `Object.defineProperty` per entry (never spread `{...options}` or `result[k] = v`), so an own `"__proto__"` key round-trips as a normal data property, not a prototype write. **Pinned descriptor** (LOAD-BEARING): `Object.defineProperty(result, key, { value: encodedOrPassthroughValue, enumerable: true, writable: true, configurable: true })` — `defineProperty` defaults to `enumerable: false`, and an unenumerable key is silently dropped when the directive is `JSON.stringify`'d at the wire boundary (golden-fixture and surface-parity assertions would fail with no obvious cause — the key exists, `JSON.stringify` just skips it). `enumerable: true` must be explicit on every entry.

### Plain-Object Predicate (design §4.3)

`isPlainObject(v)`: `typeof v === "object" && v !== null && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)`. Arrays and plain objects (including `Object.create(null)` dict-shapes) → ENCODE. Anything else non-primitive (`Date`, `Map`, class instances — prototype outside that set) → REJECT via `rejectOption`.

### Cycle Detection (design §4.3, ARCH-F2)

`assertEncodable(value, key, ancestors = new Set())` walks recursively; a node is ADDED to `ancestors` on descent and DELETED on ascent (scoped try/finally, or add-recurse-delete around each object/array node) — never a global "ever-visited" `WeakSet`. Only a value that is its own ancestor (a true cycle) rejects. An acyclic SHARED reference (e.g. `const s = {x:1}; ({a: s, b: s})`) is NOT flagged — it must ENCODE normally, matching native `JSON.stringify` behavior; a global-visited approach would false-positive this case.

### Error Contract (ADR-03 + TW-F1)

Throw a plain `Error` — not `AuthoringError` (full attribution parity is a registered followup; deliberate owner/PM ruling, Stage-4 precedent). Message template, verbatim:
`option "<key>" is not a plain-JSON value the engine can render (<Kind> at <path>). Options must be strings, numbers, booleans, null, arrays, or plain objects.`
`<key>` = the top-level offending option key. `<path>` = a dotted/indexed path for nested cases (e.g. `methods[0].tag`) or just the kind description for a top-level reject. `<Kind>` names the offending type (`Date`, `function`, `symbol`, `BigInt`, `undefined`, a circular reference, a class instance). NEVER raw serializer text (no "Do not know how to serialize a BigInt", no "Converting circular structure to JSON").

### §4.2d — REQ-14.3 Reconciliation (Stage-2 fixture swap, lands in S-002)

`test/skeleton/error-attribution.test.ts:204` currently drives `options: { fn: () => {} }`. Under this change, that function value is rejected AT SCHEDULING (inside `encodeOptions`, built in S-002, as a plain `Error` naming the key — REQ-TOE-04) — it never reaches the flush-time `unrepresentable-content` guard, so the existing assertion would go red once S-002 lands. Fix (S-002 task): swap the fixture's trigger to a top-level non-finite number, e.g. `{ ratio: 0 / 0 }` (`NaN`). Why this specific replacement works: `NaN` is `typeof "number"`, so it PASSES `encodeOptions` unencoded (REQ-TOE-03 passthrough) — it still trips `contract-fake.ts`'s flush-time round-trip-drop guard downstream (`NaN`/`Infinity` round-trip to `null`/`0` through JSON, failing the guard's `deepEqual` check). All four assertion VALUES stay identical (`reason`/`verb`/`path`/`appliedCount`); only the triggering input changes. This is why the reconcile is scoped to S-002, not S-000: nothing rejects at scheduling time until `assertEncodable`/`rejectOption` exist — the shadowing is a direct, documented consequence of ADR-03.

### fit-39 — single-encode-site (design §4.7, S-003)

Source-scan fitness test (`test/fitness/fit-39-single-encode-site.test.ts`): asserts the encode call (`encodeOptions` name, or an options-targeting `JSON.stringify`) appears ONLY in `src/core/directive-factory.ts` and `src/scaffold/classify-transport.ts`. Asserts it is ABSENT from `src/commons/index.ts` and `src/scaffold/expander.ts`. Tolerates: comments/imports referencing the name. Does NOT tolerate: a second independent encode call site anywhere else in `src/` — that would mean the "one choke point" property broke.

### TW-F4 — Observability Note Constraint (docs, S-003.5)

The testing-observability note added to `docs/create-templates.md` (that `@pbuilder/sdk/testing` recorded batches show composite options in encoded wire form, REQ-TOE-09.2) is constrained two ways:

(a) **Wire-term ban** — `test/docs/doc-set-content.test.ts`'s `WIRE_INTERNAL_TERMS` (line 38: `["EmitRejection", "Directive", "Batch", /\bdelete\b/]`) bans the case-sensitive literals `EmitRejection`, `Directive`, `Batch`, and the word `delete` ANYWHERE in the doc set, and separately no sentence in the note may START with `Batches` or `Directive` (capitalized, sentence-initial). Lowercase "batches"/"directives" mid-sentence is fine (`Batch`/`Directive` capitalized is what's banned, not the lowercase word) — use author vocabulary, e.g. "recorded batches", "options in encoded string form", never the capitalized wire-internal nouns.

(b) **Observable-behavior framing, not mechanism teaching** — the note must describe WHAT an author will SEE when asserting against a recorded batch (encoded string form of composite options), never HOW/WHY the SDK does it. No "the SDK converts/encodes for you" explanation — owner ruling: authors don't need to learn the under-the-hood wire mechanism this whole change exists to hide. `test/docs/encode-options-docs.test.ts` (TOE-09.2) should assert the note's presence via an author-vocabulary phrase match, not a wire-term.

### REQ-CCL-02 Contract

`.1`–`.3` (existing behavior, DO NOT BREAK, regression-only — no new production code): same-content budget-crossing size flip classifies deterministically by-reference/by-value (`.1`); raw-under-budget but serialized-over-budget (escaping inflation) classifies by-reference (`.2`); exactly-at-`EMIT_BATCH_BUDGET_BYTES` classifies by-value, one-byte-over classifies by-reference — `>` not `>=` (`.3`). `.4` (NEW, S-003): when the prospective directive's `options` carries a composite value, `classify-transport.ts`'s size estimate (line 156-160) must measure the SAME post-encode (JSON-stringified, escaped) bytes the real `create()` emission path produces — never the caller's raw pre-encode shape — closing the pre-encode/post-encode misclassification gap. Boundary asserted: pre-encode structural size fits budget, post-encode (with quote/backslash escaping) exceeds it → classifies by-reference; the resulting by-reference directive carries NO `options` field at all (by-reference verdicts never carry `create.options`).

### GOLDEN_CREATE Re-record + `createOp` Oracle Mechanism

S-000 re-records `test/golden-ir/fixtures.ts:16` — `create.options.methods` changes from the native array to the encoded string `'[{"name":"load"},{"name":"save"}]'`. `createOp` (`test/fake/directive-builders.ts:19-28`) stays RAW — writes whatever `JsonValue` it's given verbatim as `options`, deliberately never calling `encodeOptions` itself (ADR-03: independent oracle — a bug in `encodeOptions` cannot corrupt both sides identically). REQ-TOE-07.2 parity (S-003) is proven by an EQUIVALENCE test: compare live-factory/recorded output for `options.methods = [{ name: "load" }]` against a `createOp(...)` call whose third argument is the HAND-WRITTEN encoded string `'[{"name":"load"}]'` (the "absolute anchor") — never by making `createOp` call `encodeOptions`.

### dryRun Invariant Direction (REQ-TOE-08)

`dryRun()` options-blindness is DELIBERATE and PERMANENT — not a gap this change closes, a property it must preserve. `DryRunEntry` (`src/dry-run/plan.ts:68-72`) has no `options` field and none should be added. The S-003 test (`test/dry-run/plan.test.ts`) asserts ABSENCE: run a `create()` call with composite `options` under `dryRun()`, inspect the resulting `DryRunEntry`, assert it carries only `verb`/`path`/`kind` — no options-shaped key at all, encoded or native.

### Hard AC — Byte-Identical Across Surfaces (REQ-TOE-06)

Cross-surface consistency is a HARD requirement anchored to an ABSOLUTE expected string, not mere cross-equality between two surfaces. For `options = { methods: [{ name: "load" }] }`: `commons.create()` inline template, `create({templateFile})`, and scaffold by-value expansion must ALL produce `create.options.methods === '[{"name":"load"}]'` exactly — asserting only that two surfaces match each other is insufficient (a shared encode-mutation bug could make both wrong identically and still pass a mere-equality test).

---

## S-000: Walking Skeleton — Native array option encodes at the wire boundary

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-TOE-01.1, REQ-TOE-01.2
**Requires**: nothing
**Test layers**: unit + golden fixture

**Acceptance**: GIVEN `options.methods = [{name:"load"},{name:"save"}]` WHEN `create()` schedules THEN `GOLDEN_CREATE`'s emitted `create.options.methods` is the JSON string.

### Tasks
- [x] S-000.1 RED: `test/core/encode-options.test.ts` — array/object encode (TOE-01.1/.2)
- [x] S-000.2 GREEN: add `isPlainObject` + minimal `encodeOptions` (composite→`JSON.stringify`, else passthrough) in `directive-factory.ts`
- [x] S-000.3 Wire `encodeOptions(a.options)` into `create()`
- [x] S-000.4 Re-record `test/golden-ir/fixtures.ts` `GOLDEN_CREATE.create.options.methods`
- [x] S-000.5 Confirm full suite green (no other collateral breaks)

---

## S-001: Composite/scalar value shapes encode or pass through correctly

**Scope**: happy-path
**Dimension**: D (Data)
**Covers**: REQ-TOE-01.3–.8, REQ-TOE-02.1–.2, REQ-TOE-03.1–.2, REQ-TOE-05.1
**Requires**: S-000
**Test layers**: unit + integration

**Acceptance**: GIVEN nested/empty/null-proto/`__proto__`-keyed/mixed-order options and pre-stringified/scalar/null values WHEN encoded THEN each behaves per its scenario (encode vs. byte-identical passthrough), insertion order preserved.

### Tasks
- [ ] S-001.1 RED: encode-shape cases — nested-ride, mixed-order, null-proto, empty composite/options (TOE-01.3–.7)
- [ ] S-001.2 RED: string/scalar/null passthrough cases (TOE-02, TOE-03)
- [ ] S-001.3 RED: `__proto__` own-key case (TOE-05.1)
- [ ] S-001.4 GREEN: harden `isPlainObject` (null-proto) + switch result assembly to `Object.defineProperty`
- [ ] S-001.5 RED+GREEN: `test/commons/encode-surface-parity.test.ts` (create) — absent-options tolerance (TOE-01.8)

---

## S-002: Non-plain-JSON option values reject loud at scheduling

**Scope**: happy-path
**Dimension**: R (Rule)
**Covers**: REQ-TOE-04.1–.8, REQ-TOE-01 (shared-ref DAG non-false-positive), REQ-14.3 (Stage-2 reconcile, §4.2d)
**Requires**: S-000
**Test layers**: unit + integration

**Acceptance**: GIVEN an `undefined`/function/symbol/`BigInt`/circular/`Date`/`Map`/class value (top-level or nested) WHEN scheduled THEN it throws naming the key, never a raw serializer `TypeError`; an acyclic shared reference still encodes.

### Tasks
- [ ] S-002.1 RED: top-level + nested reject cases (TOE-04.1–.3, .5–.8)
- [ ] S-002.2 RED: true-cycle rejects (TOE-04.4) vs. shared-ref DAG encodes (ancestor-path, add-on-descent/delete-on-ascent)
- [ ] S-002.3 GREEN: `assertEncodable` + `rejectOption` (message names key, no raw TypeError, allowed-set echo)
- [ ] S-002.4 RED+GREEN: `test/commons/encode-surface-parity.test.ts` — rejection surfaces at scheduling (TOE-04 integration)
- [ ] S-002.5 Reconcile `test/skeleton/error-attribution.test.ts` REQ-14.3: swap fixture from `{fn: () => {}}` to a top-level non-finite number (§4.2d) — same assertions, new trigger

---

## S-003: Encoding is consistent across every author-facing surface

**Scope**: happy-path
**Dimension**: I (Interface)
**Covers**: REQ-TOE-06.1–.2, REQ-TOE-07.1–.2, REQ-TOE-08.1, REQ-TOE-09.1–.2, REQ-CCL-02.4 (+.1–.3 regression), fit-39
**Requires**: S-001, S-002
**Test layers**: unit + integration + architectural

**Acceptance**: GIVEN the same composite options WHEN routed through `create()` inline/`templateFile`/scaffold, the testing recorder, `dryRun()`, and the budget estimator THEN all surfaces agree on the encoded bytes, `dryRun()` stays options-blind, and docs/fitness confirm the invariant.

### Tasks
- [ ] S-003.1 RED+GREEN: `test/scaffold/classify-transport.test.ts` — post-encode boundary (CCL-02.4); import `encodeOptions` into `classify-transport.ts`
- [ ] S-003.2 RED: `encode-surface-parity.test.ts` — inline/scaffold/templateFile byte-identical to absolute anchor (TOE-06.1/.2)
- [ ] S-003.3 RED: `test/fake/encode-recorded-batch.test.ts` — recorded batch encoded (TOE-07.1) + `createOp` oracle parity (TOE-07.2)
- [ ] S-003.4 RED: `test/dry-run/plan.test.ts` — no options field in `DryRunEntry` (TOE-08.1)
- [ ] S-003.5 Docs: rewrite `docs/create-templates.md` (native §1, delete Appendix, TW-F4-safe observability note — see constraint below) + `test/docs/encode-options-docs.test.ts` (TOE-09.1/.2)
- [ ] S-003.6 `test/fitness/fit-39-single-encode-site.test.ts` — source-scan, single encode site

---

## Build Order

1. S-000 (skeleton — implicit blocker for all)
2. S-001, S-002 — independent, buildable in parallel (both depend only on S-000)
3. S-003 — requires S-001 + S-002 (shares/extends `encode-surface-parity.test.ts`; closes the change)

## REQ Coverage Matrix

| REQ-ID | Slice |
|---|---|
| TOE-01.1–.2 | S-000 |
| TOE-01.3–.8 | S-001 |
| TOE-01 (shared-ref DAG) | S-002 |
| TOE-02.1–.2 | S-001 |
| TOE-03.1–.2 | S-001 |
| TOE-04.1–.8 | S-002 |
| TOE-05.1 | S-001 |
| TOE-06.1–.2 | S-003 |
| TOE-07.1–.2 | S-003 |
| TOE-08.1 | S-003 |
| TOE-09.1–.2 | S-003 |
| CCL-02.1–.3 (regression) / .4 (new) | S-003 |
| REQ-14.3 (Stage-2 reconcile) | S-002 |
| fit-39 (fitness) | S-003 |

No REQ orphaned; every REQ-TOE-01..09 and REQ-CCL-02.1..4 maps to exactly one slice (shared-ref DAG additionally cross-referenced under S-002 where its implementation lands).
