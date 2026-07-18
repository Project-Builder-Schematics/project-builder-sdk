# Proposal: Typed Feeder for Array/Object `create` Options (typed-options-feeder)

**Triage**: M · **Persona lens**: none · **Store**: hybrid

## Intent

Schematic authors must hand-`JSON.stringify` every array- and object-valued `create`/`scaffold` option at each call site, because the engine's v1 wire only promotes string values beginning `[`/`{` into real structures. This is SDK-owned DX friction: the author is forced to know how options travel the wire. `docs/create-templates.md` (PR #36) just shipped documenting the workaround. Closing the gap while the surface is fresh keeps that appendix short-lived and removes a papercut that scales with every composite option an author writes.

## Scope

### In Scope
- One SDK-side encode step at the wire boundary that JSON-encodes top-level array/object option values, defined in a single shared helper.
- Consistent behavior across all option-emitting surfaces: `create()` inline template, `create({templateFile})`, and scaffold expansion — no surface left inconsistent.
- Loud rejection (Stage-2 `AuthoringError`) of non-plain-JSON option values (`undefined`/function/symbol/`BigInt`/circular).
- Budget-estimate accuracy: the classify-transport size estimate measures the post-encode wire form.
- Docs: `docs/create-templates.md` REMOVES the `JSON.stringify` workaround teaching entirely — the §Appendix "passing arrays and objects in v1" mechanism section AND the `JSON.stringify` in the §1 example. Owner rationale: the author must not need to know the under-the-hood wire mechanism we use to send everything to the engine; authors pass native arrays/objects, period. `[owner-decision-pending: legacy compat line in docs — keep one behavioral line ("previously JSON.stringify'd values keep working unchanged") vs zero mention]`
- Docs: keep the testing-observability note (recorded batches in `@pbuilder/sdk/testing` show composite options in wire form — the AC-4 surface); this is observable author behavior, not internals, unless spec decides otherwise.
- Tests per Strict TDD.

### Out of Scope
- Engine-side native-JSON ratification (PC-PROTO-01).
- `pbuilder-codegen` typed-options schema changes.
- Any new template-language feature.

## Capabilities (contract with sdd-spec)

### New Capabilities
- `typed-options-encoding`: SDK encodes native array/object option values to JSON at the wire boundary; rejects non-plain-JSON loudly.

### Modified Capabilities
- `content-classification`: REQ-CCL-02 budget estimate must measure post-encode option bytes, not raw.

## Approach

Implement the encode as a standalone pure function beside the existing `forceEntry` in `src/core/directive-factory.ts` (e.g. `encodeOptions`), shallow-walking `Object.entries(options)`: native array/plain-object → `JSON.stringify`; string/number/boolean/`null` verbatim (string passthrough IS the backward-compat mechanism — pre-stringified strings are never re-encoded). Call it from `DirectiveFactory.create()` (real emission) AND from `classify-transport.ts`'s `prospectiveDirective` (byte budget) — one definition, two call sites; classify-transport already imports `forceEntry`, so this is precedented, not new coupling. Non-plain-JSON values that `JSON.stringify` would silently drop, coerce, or throw raw on are caught at the SDK boundary and re-raised as an attributed `AuthoringError`. Design must formalise: the ADR-0013/KIT-03 amendment (value-lowering IS lowering; template-render/AST bans stand), encoding-depth = top-level-only, and the two carried explore questions (sharing the helper into classify-transport; whether a native-array JSDoc example forces a FIT-04 `.d.ts` regen). Behavior-change note the spec must own: `@pbuilder/sdk/testing` recorded batches will now show encoded strings for composite options; `dryRun()` stays options-blind.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/directive-factory.ts` | Modified | new `encodeOptions` helper + call in `create()` |
| `src/scaffold/classify-transport.ts` | Modified | budget estimate calls the shared encode helper |
| `test/golden-ir/fixtures.ts` | Modified | `GOLDEN_CREATE` re-recorded to encoded form |
| `docs/create-templates.md` | Modified | §1 + §Appendix move to native arrays |
| `src/commons/index.ts`, `src/scaffold/expander.ts` | Read-only | already converge on `factory.create()` |
| `src/testing/contract-fake.ts`, `src/dry-run/plan.ts` | Read-only | confirmed never read `options` |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Budget-estimate drift: composite misclassified by-value pre-encode, hard-rejects at emit post-encode | Medium | thread the shared encode helper into classify-transport (in scope) |
| Raw `TypeError`/silent drop at factory bypassing `AuthoringError` | Medium | loud-rejection REQ + tests for `undefined`/function/symbol/`BigInt`/circular |
| Pass-through string beginning `[`/`{` promoted by engine confuses authors | Low | document as engine-owned behavior; do not fix here |
| Golden-IR fixture churn | High | expected re-record, flagged for apply — not a regression |

## Rollback Plan

Single additive commit (helper + two call sites + fixture + docs); no migration, no persisted state. Rollback = `git revert` of that commit: `encodeOptions` and both call sites vanish, `DirectiveFactory.create()` returns to forwarding raw options, and `GOLDEN_CREATE` reverts to its native-array form. Forward string-passthrough is preserved, so authors still hand-`JSON.stringify`ing keep working in both directions; only native-array call sites written during the feature window need re-wrapping, which the reverted docs re-document. No engine, wire-protocol, or data-store state changes — nothing is unrecoverable. Validate rollback: full `bun test` green + `docs/create-templates.md` back to the string-workaround appendix.

## Dependencies

- None. PC-PROTO-01 (engine native-JSON) is a future no-op reducer for this feeder, not a prerequisite.

## Success Criteria

- [ ] Native array/object option values render correctly across `create()` inline, `create({templateFile})`, and scaffold expansion (one shared helper, verified per surface).
- [ ] Pre-`JSON.stringify`'d string option values pass through byte-identical (backward-compat, tested).
- [ ] `null`, string, number, boolean option values pass verbatim (never stringified).
- [ ] Non-plain-JSON values (`undefined`/function/symbol/`BigInt`/circular) raise an attributed `AuthoringError`, never a raw `TypeError` or silent drop.
- [ ] classify-transport budget estimate measures post-encode bytes (no by-value/by-reference misclassification near the 4 MiB budget).
- [ ] `GOLDEN_CREATE` re-recorded; full `bun test` suite green.
- [ ] `docs/create-templates.md` no longer teaches the `JSON.stringify` workaround: the §Appendix "passing arrays and objects in v1" mechanism section is removed and the §1 example uses a native array (zero `JSON.stringify` for options) — owner-ruled binary criterion of done.
