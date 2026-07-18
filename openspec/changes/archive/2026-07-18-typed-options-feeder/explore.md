# Exploration: Typed Feeder for Array/Object `create` Options (typed-options-feeder)

**Triage**: M
**Persona lens**: none

## Cross-Change Lessons Consulted

`mem_search` (project-builder-sdk, type=pattern and type=discovery, query "options JSON.stringify array object encode create") returned no matches — no prior change touched this exact surface. Architecture baseline obs #652 (2026-07-16) consulted directly: confirms `directive-factory.ts` / `commons/index.ts` / `scaffold/expander.ts` are all mapped baseline components under the "Primary"/"Scaffold" scaffolding chains, and the `forceEntry` precedent (pure-transform-inlined-into-factory-method) is the dominant pattern for this exact file.

## Affected Flows

Not applicable — no user-facing UI/CLI flow; this is a library authoring-API DX change with no E2E user journey to map (author-facing API surface, exercised via unit/e2e tests, not a product flow).

## Current State

`create()`/`scaffold()` forward `options: JsonValue` verbatim to the engine. The engine's v1 wire promotes a **top-level `options` map VALUE** that is a string beginning with `[`/`{` into a real array/object before rendering (`docs/create-templates.md` §Appendix, confirmed verbatim). Authors currently hand-`JSON.stringify` each composite value at the call site (`docs/create-templates.md` §1 line 64 example, §Appendix line 494).

`DirectiveFactory.create()` (`src/core/directive-factory.ts:52-62`) is confirmed as the **sole real-emission choke point** — exhaustive sweep (`rg "factory\.create\("`) finds exactly two callers: `src/commons/index.ts:197` (both `template` and `templateFile` overloads converge here — `templateFile`'s content is read by `readTemplateFile()`/`classifyTransport()` and only feeds the `template` field, not `options`) and `src/scaffold/expander.ts:171` (`runScaffold`'s by-value branch). No third caller anywhere in `src/`.

**New finding not in the triage's model**: `src/scaffold/classify-transport.ts:156-159` independently **hand-builds** a `create` directive literal (`prospectiveDirective`) — bypassing `DirectiveFactory.create()` entirely — purely to measure the REQ-CCL-02 serialized-size budget (`serializedBatchSize`) BEFORE the real emission decides by-value vs by-reference. It uses the caller's raw, un-encoded `options`. This is a size **estimate**, never itself emitted to the wire, but it means `DirectiveFactory.create()` is not literally the only place the `create` wire shape (including `options`) gets constructed — see Open Questions.

Encode predicate (confirmed against docs + `JsonValue` type in `src/core/wire.ts:5-11`): shallow walk over `Object.entries(options)`; native array or plain object value → `JSON.stringify(value)`; string/number/boolean pass verbatim; `null` (a valid `JsonValue`, and the engine gives "present but null" a typed error per §2) must NOT be stringified — passes through as `null`. Nested composites inside an object/array value are carried by the single top-level `JSON.stringify` call (no recursion needed) — confirmed against the Appendix's `methods: JSON.stringify([{ name: "load" }, ...])` example, which is exactly a one-level-deep array of objects handled by one `JSON.stringify` call.

`src/testing/contract-fake.ts:180` destructures `{ pathTemplate, template, force }` from `directive.create` — **never reads `options`** — confirmed, no fake changes needed.

`src/dry-run/plan.ts` (`dryRunPlan`) never surfaces `options` in a `DryRunEntry` (only `verb`/`path`/`kind`) — encoded strings cannot leak into `dryRun()` assertions. Confirmed no dry-run impact.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/directive-factory.ts` | modify | add shallow encode transform inside `create()`, mirroring the existing `forceEntry` pure-transform pattern in the same file | aligns |
| `src/scaffold/classify-transport.ts` | modify (likely) | its budget estimate must see the SAME encoded form `directive-factory.ts` will emit, or the estimate under-measures composite-valued options (see Open Questions) | aligns |
| `src/commons/index.ts` | none expected | already funnels both `create` overloads through `factory.create()` — no separate transform needed if factory is the choke point | aligns |
| `src/scaffold/expander.ts` | none expected | already funnels through `factory.create()` at line 171 | aligns |
| `docs/create-templates.md` | modify | §1 example + §Appendix move to native arrays (triage scope) | aligns |

No `deviates` rows — this is a contained modification of existing baseline components, not a new layer.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/directive-factory.ts` | Modify | encode transform in `create()` |
| `src/scaffold/classify-transport.ts` | Modify (pending design ruling) | budget-estimate accuracy for composite options |
| `test/golden-ir/fixtures.ts` | Modify | `GOLDEN_CREATE.create.options.methods` is a native array today — will no longer match the encoded factory output |
| `test/golden-ir/golden-ir.test.ts` | Read-only | asserts `toEqual(GOLDEN_CREATE)` — breaks once the fixture above is fixed, no test-logic change needed |
| `docs/create-templates.md` | Modify | §1 + §Appendix per scope |
| `src/commons/index.ts` | Read-only | confirmed both `create` overloads converge on `factory.create()`, no direct transform needed |
| `src/scaffold/expander.ts` | Read-only | confirmed convergence on `factory.create()` |
| `src/testing/contract-fake.ts` | Read-only | confirmed it never reads `options` |
| `src/dry-run/plan.ts` | Read-only | confirmed `options` never surfaces in `DryRunEntry` |
| `test/skeleton/directive-factory.test.ts` | Read-only | contains composite `options` literals but assertions never check the `options` field itself — churn-free |
| `test/fitness/fit-05-serializable-bytes.test.ts` | Read-only | composite `options` example, but roundtrip assertion is self-referential (compares factory output to itself) — passes regardless of encoding |

## Sensitive Areas Crosscheck

No sensitive areas touched. The registered sensitive surfaces (`security (code execution)` — transport/dialect-handle; `security (third-party trust)` — ts-morph; IPC/wire — `src/transport/**`) are untouched; this change stays inside `src/core/directive-factory.ts` and `src/scaffold/**`, one layer above the wire client, matching triage's own crosscheck.

## Approaches

### 1. Encode-in-factory (`DirectiveFactory.create()`)
**Description**: Add the shallow encode transform as a pure helper inside `directive-factory.ts` (sibling to `forceEntry`), applied to `a.options` before building the returned `Directive`.
**Pros**: One transform, one call site, matches the dominant `forceEntry` precedent exactly; `commons/index.ts` and `scaffold/expander.ts` need zero changes since both already converge here.
**Cons**: Does NOT, by itself, fix `classify-transport.ts`'s independent budget estimate (still measures raw options) — leaves a latent under-estimate for composite-valued options unless addressed explicitly.
**Effort**: Low. **Pattern fit**: matches existing `src/core/directive-factory.ts` `forceEntry`.

### 2. Encode-in-verb-layer (`commons/index.ts` + `scaffold/expander.ts`, before calling `factory.create()`/`classifyTransport()`)
**Description**: Apply the transform at both call sites, before options reach either `factory.create()` or `classifyTransport()`.
**Pros**: `classify-transport.ts`'s budget estimate automatically sees the final encoded form — no separate fix needed there.
**Cons**: Duplicates the transform call at 2 sites (violates "one choke point, no surface left inconsistent" more than approach 1 in spirit, even if the transform's *definition* is still shared); triage's own notes explicitly flag this as the pattern to avoid ("design should confirm this placement rather than duplicating the transform per call site").
**Effort**: Low-Medium. **Pattern fit**: new pattern for this codebase (verb-layer transforms are not the existing convention — `forceEntry` lives at the factory).

### 3. Encode-at-flush (`Session.flush()`)
**Description**: Encode composite `options` values generically over the whole pending batch at flush time, filtering to `op === "create"` directives.
**Pros**: Deepest single point, guarantees consistency across any future `create`-directive producer.
**Cons**: Couples the generic, op-agnostic `Session.flush()` to `create`-specific knowledge (breaks its current op-blind design); does not fix `classify-transport.ts`'s pre-flush budget estimate either (that estimate runs before any flush); `session.ts` was flagged read-only for at least one prior change slice, signalling change-cost sensitivity there.
**Effort**: Medium. **Pattern fit**: new pattern, deviates from the existing choke-point precedent.

## Recommendation

**Approach 1 (encode-in-factory), extended to close the gap it leaves**: implement the shallow encode as a standalone pure function exported alongside `forceEntry` in `src/core/directive-factory.ts` (e.g. `encodeOptions(options: JsonValue): JsonValue`), call it from `DirectiveFactory.create()` for real emission, AND call the SAME function from `classify-transport.ts`'s `prospectiveDirective` construction so the REQ-CCL-02 budget estimate measures the true post-encode wire size. This keeps the transform's *definition* singular (one function, no duplicated logic) while still touching two call sites — the duplication triage worried about is calling the shared helper twice, not reimplementing it twice. `classify-transport.ts` already imports `forceEntry` from the same file, so importing a sibling pure helper is precedented, not a new coupling. Approaches 2 and 3 are rejected: 2 for genuine logic duplication risk, 3 for breaking `Session.flush()`'s op-blind design and still not fixing the estimate.

## Risks

- **Budget-estimate drift** (the open question below): if design does not thread the encode transform into `classify-transport.ts`, a composite-valued scaffold entry near `EMIT_BATCH_BUDGET_BYTES` could be classified by-value (fits under budget pre-encode) but reject at real emit time (exceeds budget post-encode, since a JSON-string-embedded value costs more bytes than its structural-nesting form due to quote escaping) — turning a graceful by-reference fallback into a hard emit rejection.
- **Golden fixture churn is expected, not a regression**: `test/golden-ir/fixtures.ts`'s `GOLDEN_CREATE` must be updated to the encoded form — flag for slice/apply, not a surprise at verify time.
- **FIT-04 `.d.ts` baseline**: JSDoc examples in `commons/index.ts` are mirrored into `test/fitness/dts-baseline/commons.index.d.ts`. If design adds a new native-array JSDoc example, that baseline needs regenerating — optional, not forced by the current examples (none use composite values today).

## Open Questions

- type: technical
  question: "Should `classify-transport.ts`'s `prospectiveDirective` budget estimate call the same encode helper `DirectiveFactory.create()` uses, so REQ-CCL-02's size check measures the true post-encode wire size for composite-valued scaffold options?"
  why_it_matters: "Without this, a composite-valued scaffold entry near the emit budget boundary can be misclassified by-value pre-encode and then reject at real emit time post-encode — the graceful by-reference fallback classify-transport exists to provide would silently stop working for exactly the payloads this change targets."
- type: technical
  question: "Does design intend to add a native-array/object JSDoc example to `commons/index.ts`'s `create()` doc comment (showcasing the new DX), and if so, is regenerating the FIT-04 `.d.ts` baseline snapshot in scope for this change's slices?"
  why_it_matters: "JSDoc comments are mirrored verbatim into the committed `.d.ts` baseline; an uncoordinated doc edit would fail FIT-04 at verify time if the baseline isn't regenerated in the same slice."

## Ready for Proposal

**Status**: yes
**Reason**: The choke point, encode predicate, and every named investigation target from triage are confirmed against real code, with one materially new finding (the `classify-transport.ts` parallel directive-construction site) that sharpens rather than blocks the design — it resolves cleanly by sharing one helper function across two call sites. No sensitive-area escalation, no architectural deviation, test churn is bounded to one fixture file plus the two scoped docs sections.
**Recommended action**: Proceed to `sdd-propose` with the two open technical questions carried forward into `sdd-design` (both resolve at design time, neither needs user input).
