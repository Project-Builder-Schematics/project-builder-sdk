# Design: ts-addimport-collision

**Change**: `ts-addimport-collision` · **Triage**: L (sensitivity override — `security (code execution): high`)
**Spec**: V3.1 signed (owner, 2026-07-17) · **Persona lens**: architect (synthesis) · **Store**: hybrid

## 4.1 Architecture Overview

Port the judgment-day-APPROVED React `addImport` (CLAIMED four-branch V8, `src/dialects/react/ops.ts:81-234`) into the TypeScript leaf's `src/dialects/typescript/ops.ts`, replacing today's naive first-match unconditional merge (`:22-32`). The port is leaf-isolated: `boundNamesIn`, `satisfiesIdempotency`, `isNonTypeOnlyNamedImportClause` transfer verbatim (architect matrix — pure ts-morph reads, JSX-independent); the value-namespace half is already present as `assertNoCollision`'s disjunction (`:56-64`) and is EXTRACTED into a shared boolean `isValueNamespaceClaimed(ast, name)` consumed by BOTH `assertNoCollision` and the new `addImport` — no new intra-leaf copy. Name validation folds in by importing `assertValidImportBinding` from `src/core/jsx-name-validator.ts` AS-IS (arm a), calling it INLINE as `addImport`'s first line (TS house style — matching `addFunction`/`addVariable`/`addClass`'s inline `assertNoCollision`), NOT React's `validatedOp` wrapper. The only cross-leaf edge added is TS → core (sanctioned direction), which makes `jsx-name-validator.ts` genuinely two-consumer — the ARCH-2 "one consumer" premise is falsified and registered as debt, the module is NOT relocated (react stays byte-sealed). Seam: no boundary crossed, no new engine port — the op rides the existing `dialect-handle.ts` coalescing controller.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modify | Port four-branch `addImport` (idempotency→claimed→merge→create, ORDER-INVARIANT); inline `assertValidImportBinding(name)` gate first; port `boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause`; extract `isValueNamespaceClaimed` shared with refactored `assertNoCollision`; directive-prologue-aware Create; TS house-style path-ful collision tail. **REWRITE `addImport`'s behavioural JSDoc** — four branches, throws-on-collision/validation, idempotency shapes, side-effect coexistence — modeled on `react/ops.ts:166-204` (the shipped header is now FALSE; distinct from the REQ-TSD-13.5 trust-boundary sentence). Plus the REQ-TSD-13.5 trust-boundary JSDoc affirmatively naming the sibling ops' `name`/`source`/`initializer` as still-raw. Two one-line WHY comments (F6): at the `assertValidImportBinding` import (misnomer + ADR-02 pointer), at the reject sites (deliberate two-shape posture + REQ-TSD-13 pointer) |
| `src/core/jsx-name-validator.ts` | Read-only | Consume `assertValidImportBinding`/`IMPORT_RESERVED_WORDS`/`JSX_NAME_DENYLIST` verbatim; NOT relocated (ARCH-2 debt registered, ADR-02) |
| `src/core/reject-tail.ts` | Read-only | React path-less builders; TS collision tail built inline in ops.ts |
| `src/core/dialect-handle.ts` | Read-only | `handlePathFor(ast)` — path channel for the collision tail |
| `src/dialects/typescript/index.ts` | Read-only | Module JSDoc already reads `.modify()` (REQ-TSD-01.4 already green) |
| `src/dialects/react/ops.ts` | Read-only | Port source of truth; ZERO changes (arm a keeps react sealed) |
| `test/dialects/typescript/ops-addImport.test.ts` | Create | Merge/idempotency/collision battery + injection/validation battery + asymmetry + JSDoc guard (REQ-TSD-01.5–.23,.25–.33; REQ-TSD-13.1–.5) |
| `test/dialects/typescript/dialect.test.ts` | Modify | REQ-TSD-01.24 ordering; REQ-TSD-03.11 seed-with-own-output (.2/.03.10 exist) |
| `test/dialects/typescript/ops-exact-set.test.ts` | Read-only | REQ-TSD-01.1 exact op-set (membership unchanged) |
| `test/dialects/typescript/ops-removeImport.test.ts` | Read-only | Zero-directive no-op assertion shape (.11); search-all/remove-first half of asymmetry (.25, corrected per spec V3.2 — S-004.1 empirical finding) |
| `test/dialects/typescript/golden/*.txt` | Create | Byte-exact goldens: merge/create shapes, CRLF (.8), directive-prologue (.21, QA note b) |
| `test/fitness/fit-39-addimport-parity.test.ts` | Create | Predicate-PARITY fitness — TS vs React `addImport` verdict agreement per shared battery, with the self-alias row as an explicit expected-divergence assertion (ADR-01 obligation) |
| `test/dialects/typescript/ops-declarations.test.ts` | Read-only | Sibling-collision coverage anchor — addFunction/addVariable/addClass reject suite MUST stay green after the `isValueNamespaceClaimed` extraction (Sec N2, behaviour-preservation guard) |
| `test/fitness/fit-raw-sweep.test.ts` | Read-only | REQ-TSD-01.3/.4 `.raw(`-absence regression (already green repo-wide) |
| `test/e2e/dialect-modify.e2e.test.ts` | Modify | One e2e: shape-safe merge + collision reject through the public handle (Flow 1, frozen signature) |
| `test/e2e/installed-consumer.e2e.test.ts` | Read-only | Op-set membership + signature parity (success criterion #6) |
| `CHANGELOG.md` | Create | Public-package changelog (does not yet exist). The "Behaviour Changes" entry is lifted VERBATIM from the signed spec's behaviour-change note: Class A five buckets (type-only merge; cross-module + value-namespace collisions; aliased-to-different-name collisions; same-local-name idempotency vs default/namespace/mixed; directive-prologue placement) + the sole Class B member (side-effect import preserved, `.modify()` escape). Under ADR-03's `.33` fallback arm: NO shebang behaviour-change entry — the deferred followup is noted instead. No migration guide (pre-release, 0.0.0) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author `ts.find(path).addImport(name, from)` | Modify | REQ-TSD-01, REQ-TSD-13 | `test/e2e/dialect-modify.e2e.test.ts` (extend) | Frozen signature; new reject/no-op surface on previously-mis-merged inputs |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/typescript/ops.ts::addImport` | modify | Port V8 four-branch algorithm | aligns — leaf-isolated logic |
| `src/dialects/typescript/ops.ts::assertNoCollision` | modify | Extract shared `isValueNamespaceClaimed` boolean; behaviour-preserving | aligns |
| `src/core/jsx-name-validator.ts` | extend (new consumer) | Fold-in `name` validation, consumed as-is | **deviates** — TS becomes 2nd, non-JSX consumer; falsifies ARCH-2 one-consumer premise → ADR-02 |
| Predicate-parity fitness (FIT-39) | new | Guard the cross-dialect TS/React predicate duplication (arm a) | aligns — joins existing fitness layer |
| `src/dialects/typescript/**` insertion path | modify | Directive-prologue-aware Create (.21); shebang stays fail-closed (.33 fallback) | aligns |

`deviates` row → ADR-02. Impact derived below.

## 4.3 Data Model

Ported from React (plain records, ts-morph reads only — no new persisted state, no wire change):

```ts
interface BoundName { localName: string; kind: "default" | "namespace" | "named"; aliased: boolean; valueBound: boolean; }
function boundNamesIn(decl: ImportDeclaration): BoundName[];        // default+namespace+named, valueBound = !declTypeOnly && !specifierTypeOnly
function satisfiesIdempotency(bound: BoundName): boolean;           // valueBound && (kind !== "named" || !aliased)
function isNonTypeOnlyNamedImportClause(decl: ImportDeclaration): boolean;
function isValueNamespaceClaimed(ast: SourceFile, name: string): boolean; // function/const/let/var/class/enum/namespace (extracted from assertNoCollision)
function leadingDirectiveCount(ast: SourceFile): number;           // leading string-literal ExpressionStatements
```

## 4.4 Interface Contracts

`addImport(name: string, from: string): void` — call signature FROZEN. Two deliberate reject shapes (owner-ratified, unification declined):
- **Validation reject** (REQ-TSD-13, runs FIRST): `assertValidImportBinding(name)` throws its verbatim React path-LESS `dialectError` — naming `` `name` `` + rule text ("valid JavaScript identifier" / "reserved word" / "reserved name"), zero echo for grammar failures, ≤16-char echo for reserved/denylist.
- **Collision reject** (REQ-TSD-01 Step 2): TS house-style path-FUL tail, built inline mirroring `assertNoCollision` — `addImport("{name}") on "{handlePathFor(ast)}" — a value or import binding named "{name}" already exists; TypeScript forbids two bindings sharing a name. …` — the `already exists` substring + path clause are the distinguishing assertions. The trailing clause reads **"two bindings sharing a name"**, NOT `assertNoCollision`'s "two value declarations" (F10): `addImport`'s collision surface now also fires on import-vs-import and type-only claims, which are not value declarations. Both throw SYNCHRONOUSLY before any AST mutation; contained per the `"dialect operation failed: "` convention.

**Two-shape contract, pinned in BOTH directions** (F12): the validation reject message MUST NOT contain the `on "{path}"` clause (a positive substring assertion on the validation side is insufficient — a "consistency fix" mutant that adds a path to `assertValidImportBinding` must die against an explicit NEGATIVE assertion that the path clause is ABSENT from a validation reject). See Test Derivation row 13.x-neg.

**Design note — cross-dialect collision wording legitimately diverges (F14, no action)**: React's collision tail reads `…already bound elsewhere in the file…` (`claimedNameTail`); TS's reads `…already exists…` (house style, this design). This text divergence is DELIBERATE and correct — each leaf keeps its own house voice. FIT-39 asserts VERDICT agreement, never message text, so the wording gap is invisible to it. The eventual arm-b unification (should the owner ever ratify it) is where this message seam reconciles; until then the two spellings coexist by design.

Create branch: `leadingDirectiveCount === 0 → ast.addImportDeclaration(...)` (preserves REQ-TSD-01.2 frozen golden byte-for-byte AND leaves shebang's fail-closed `ManipulationError`→contained reject intact); `> 0 → ast.insertImportDeclaration(count, ...)` (REQ-TSD-01.21 fix).

## 4.5 ADRs

### ADR-01: Mirror the collision/idempotency predicate in the TS leaf + predicate-parity fitness (hoist-vs-mirror, correlated with ARCH-2)

**Status**: Proposed. **Context**: The value-namespace + import-binding predicate family now lives in both dialect leaves (ADR-0039 cross-dialect, ADR-01 react duplication precedent). Arm b (hoist to a new `src/core/import-model.ts`, single source) is PROVEN clean by the architect but RE-OPENS the archived, signed react leaf (must refactor react to consume it, risking REQ-RXD-05) — a scope expansion the PM ruling binds to explicit owner ratification. **Decision**: Arm a — keep the predicate in the TS leaf (react byte-sealed). Reduce intra-leaf duplication by extracting one `isValueNamespaceClaimed` boolean shared by `assertNoCollision` and `addImport`; the remaining TS-copy/React-copy duplication is guarded by a MANDATORY predicate-PARITY fitness (FIT-39) asserting both dialects' `addImport` return identical verdicts on a shared battery. **Self-alias is encoded as a POSITIVE expected-divergence assertion, NEVER a row exclusion** (N1): every battery row asserts verdict EQUALITY, and the self-alias row (REQ-TSD-01.15) asserts the KNOWN pair explicitly — TS = no-op, React = reject — so that any FUTURE drift on that row (e.g. react's twin fix landing) fails RED instead of being silently masked by an exclusion. **Consequences**: (+) react stays sealed; honours owner standalone-TS scope; no react-reopen risk. (−) two live copies of the predicate — FIT-39 substitutes arm b's drift-DETECTION benefit, NOT its single-point-of-maintenance benefit (N3): a genuine predicate change still costs a two-place edit; FIT-39 only guarantees the divergence surfaces, it does not remove the double-maintenance. That residual cost is the accepted price of keeping react sealed. Enables arm b later without pressure. **Alternatives**: Arm b (single source) — rejected: re-opens signed react, owner-ratification-gated, and FIT-39 substitutes for its drift-detection benefit. Mirror without FIT-39 — rejected: three defect-prone copies with no agreement check is halt-worthy.

### ADR-02: Fold in `name` validation by consuming `jsx-name-validator.ts` as-is, inline; register the ARCH-2 rename debt

**Status**: Proposed. **Context**: Closing the CONFIRMED `name`-splice injection needs the grammar+reserved-word+denylist chain that already ships as `assertValidImportBinding`. Reusing it makes the TS dialect the module's SECOND, first non-JSX consumer — sharpening ARCH-2 (the "one consumer" placement premise) before "dialect #3". TS ops are plain functions calling asserts inline; react wraps every op in `validatedOp`. **Decision**: Import `assertValidImportBinding` verbatim (no TS narrowing) and call it INLINE as `addImport`'s first statement, matching the leaf's own `assertNoCollision` house style — NOT the `validatedOp` wrapper (a react-ism foreign to this leaf; mixing styles in one file is worse than either). Do NOT relocate the module; register it as ARCH-2's now-realised second trigger in the baseline. **Consequences**: (+) one validator family, no second skeleton; closes the injection now on an already-sensitive op; validate-before-mutate preserved by the inline first-line. (−) ARCH-2 debt compounds (two consumers pre-#3) — a placement/cohesion note, not a dependency breach (edge is dialect→core). **Alternatives**: `validatedOp` wrapper — rejected: inconsistent with the TS leaf, no benefit over inline here. Relocate module now (pull split forward) — rejected: that is arm b's react-reopen cost without arm b.

### ADR-03: REQ-TSD-01.33 ships the pre-authorized FALLBACK — pin shebang containment, defer insertion

**Status**: Proposed. **Context**: `.33` primary path wants shebang files upgraded from today's fail-closed reject to successful insertion via `.21`'s mechanism. **Decision**: Ship the fallback. Empirically probed against pinned ts-morph@28.0.0: `insertImportDeclaration(afterDirectiveIndex)` cleanly fixes the directive prologue, but EVERY top-of-file insertion on a shebang file throws `ManipulationError: A syntax error was inserted` — the shebang is SourceFile leading trivia, not a statement, so a correct insertion requires a DIFFERENT text-surgery mechanism (strip line → insert → re-prepend, the class of `ast.ts`'s BOM handling), not `.21`'s statement-index insertion. Per the spec's pre-authorized fallback: PIN the existing branded fail-closed reject (`dialect operation failed: addImport() on "{path}" threw`, `.cause` undefined, zero directives, byte-unchanged) as a regression guard; register shebang-aware insertion as a `project/pending-changes` followup. **Containment level (Sec N1, honest statement)**: today's shebang reject is contained at the HANDLE level, not the op level — `addImport` does not catch anything; ts-morph's `ManipulationError` propagates out of the op and is caught by `dialect-handle.ts`'s `#invokeContained` (`:248-258`), which brands it as a `dialectError` with the generic foreign-wrap tail. The SIGNED spec V3.1 already documents this (two independent probes through the public handle); the reviewer's op-level-crash reading cited stale V2 text. The `.33` test therefore asserts the HANDLE-contained shape — `.cause` undefined + zero directives + target byte-unchanged — so any future refactor that lets a ts-morph internal (message text, `.cause`, a partial mutation) leak past the containment boundary fails RED. **Consequences**: (+) no shebang behaviour change (nothing was silently broken — a contained reject is safe); keeps scope on the port+validation core; no security surface added on a sensitive op. (−) shebang files still cannot receive imports — deferred, tracked. **Alternatives**: Build text-surgery now — rejected: distinct mechanism needs its own containment + newLineKind + security reasoning; scope expansion the spec explicitly pre-authorized deferring.

## 4.6 Test Derivation (outside-in)

Assertion discipline: byte-exact golden (`toBe`) on every merge/create/idempotency; zero-directive = `collectModifies(emitted).toHaveLength(0)`; reject = synchronous throw + target byte-unchanged on catch + distinguishing substring. Strict TDD: every row RED-first (defect-family scenarios carry a documented pre-fix RED, success criterion #1).

| REQ-ID | Scenario | Level | Test | Flow |
|---|---|---|---|---|
| 01.1 | exact op-set `toEqual` | contract | ops-exact-set.test.ts | — |
| 01.2 | fresh-insert byte golden (exists) | integration | dialect.test.ts | — |
| 01.3/01.4 | collision-hint + JSDoc say `.modify()` not `.raw()` (already green) | architectural | fit-raw-sweep.test.ts | — |
| 01.5 | merge into named clause | integration | ops-addImport.test.ts | — |
| 01.6/01.8 | type-only decl / inline `type X` reject | integration | ops-addImport.test.ts | — |
| 01.7/01.9 | type-only + diff name / aliased type-only → create (GREEN) | integration | ops-addImport.test.ts | — |
| 01.10/01.13 | default / namespace same-name idempotent no-op | integration | ops-addImport.test.ts | — |
| 01.11/01.12 | default / namespace diff name → separate create | integration | ops-addImport.test.ts | — |
| 01.14 | aliased-to-different-name reject | integration | ops-addImport.test.ts | — |
| 01.15 | self-alias `{ X as X }` no-op (owner deviation) | integration | ops-addImport.test.ts | — |
| 01.16 | cross-module value-namespace reject (file-wide scan) | integration | ops-addImport.test.ts | — |
| 01.17 | 8-kind value-namespace collision battery reject | integration | ops-addImport.test.ts | — |
| 01.18 | `type`/`interface` coexist → create (GREEN) | integration | ops-addImport.test.ts | — |
| 01.19 | no prior decl → fresh create | integration | ops-addImport.test.ts | — |
| 01.20 | side-effect import preserved + separate named (Class B) | integration | ops-addImport.test.ts | — |
| 01.21 | directive prologue → import AFTER, byte golden | integration | ops-addImport.test.ts + golden | — |
| 01.22 | multi-decl same module → merge FIRST, scan ALL | integration | ops-addImport.test.ts | — |
| 01.23 | empty `{}` clause is a valid merge target | integration | ops-addImport.test.ts | — |
| 01.24 | ordering — idempotency BEFORE claimed (mutant-kill) | integration | dialect.test.ts | — |
| 01.25 | asymmetry: addImport merges first-declaration-only / removeImport searches ALL declarations but removes exactly one hit (spec V3.2 correction — all-match removal was a factual error, only observable on illegal duplicate-binding input) | integration | ops-addImport.test.ts | — |
| 01.26/01.27 | type-only default / namespace specifier reject | integration | ops-addImport.test.ts | — |
| 01.28 | aliased-underlying merge (local-name keying, GREEN for .14) | integration | ops-addImport.test.ts | — |
| 01.29/01.30 | mixed default+named: merge to named / default-name no-op | integration | ops-addImport.test.ts | — |
| 01.31 | unaliased named idempotency symmetry row | integration | ops-addImport.test.ts | — |
| 01.32 | collision tail echoes full 29-char name, uncut | integration | ops-addImport.test.ts | — |
| 01.33 | shebang → fail-closed contained reject PINNED (fallback); zero directives, byte-unchanged, `.cause` undefined | integration | ops-addImport.test.ts | — |
| 03.10 | duplicate addImport one line (exists) | integration | dialect.test.ts | — |
| 03.11 | seed-with-own-output → ZERO directives (fresh run) | integration | dialect.test.ts | — |
| 13.1 | confirmed injection reject, zero import, zero echo | integration | ops-addImport.test.ts | — |
| 13.2 | reserved-word + denylist battery + negative substrings | integration | ops-addImport.test.ts | — |
| 13.3 | grammar battery reject, zero echo | integration | ops-addImport.test.ts | — |
| 13.4 | `from`-escaping regression — hostile specifier stays ONE string | integration | ops-addImport.test.ts | — |
| 13.5 | trust-boundary JSDoc affirmatively names still-raw ops | architectural | ops-addImport.test.ts | — |
| 13.6 | precedence — validation reject before collision | integration | ops-addImport.test.ts | — |
| 13.x-neg | NEGATIVE: a validation reject message does NOT contain the `on "{path}"` clause (kills the consistency-fix mutant; two-shape contract pinned both ways) | integration | ops-addImport.test.ts | — |
| 01/13 (repr.) | shape-safe merge + collision reject via public handle | e2e | dialect-modify.e2e.test.ts | Flow 1 |
| parity | TS vs React verdict AGREEMENT on the shared battery; self-alias row asserts the explicit expected-divergence pair (TS no-op / React reject), NEVER excluded | architectural | fit-39-addimport-parity.test.ts | — |

QA note (03.11 vs 03.10): `.10` chains two calls in one run; `.11` is a SEPARATE run seeded with the prior op's output — distinct claim. `.33` note: fallback arm asserts zero directives (NOT `collectModifies===1`, which was the primary-arm note).

## 4.7 Fitness Functions

- **Predicate-parity (FIT-39, NEW)**: a shared `(seed, name, from) → verdict` battery run through BOTH `@pbuilder/sdk/typescript` and `@pbuilder/sdk/react` `addImport`; verdicts (no-op / reject / merge / create) MUST agree on every row. The self-alias row (REQ-TSD-01.15) is a POSITIVE expected-divergence assertion (TS no-op / React reject), never a row exclusion (N1). The battery is cross-referenced to the REQ-TSD-01.5–.33 corpus so branch coverage is deliberate — one row per shape family (N2/N6): **merge** (.5/.22/.23/.28/.29), **idempotency no-op** (.10/.13/.15/.30/.31), **create/separate** (.7/.9/.11/.12/.18/.19), **type-only collision** (.6/.8/.26/.27), **cross-module + value-namespace collision** (.14/.16/.17), and the **self-alias divergence** (.15). FIT-39 checks VERDICTS, not message text (see the §4.4 cross-dialect wording design note, F14). This is arm a's mandatory parity guard (ADR-01).
- **FIT-02 continuity**: TS leaf imports NO sibling dialect (only `../../core/*`) — the new `jsx-name-validator` import is core, sanctioned.
- **FIT-37/38 continuity**: `jsx-name-validator.ts` is AST-library-free; the TS-leaf edge to it adds no ts-morph reach into core; parser construction stays confined to the two `ast.ts` files.
- **Idempotency pin (REQ-TSD-03.11)**: seed-with-own-output → zero directives, a fitness-grade durability proof of the no-op promise.
- **`.raw(`-absence (fit-raw-sweep)**: enforces REQ-TSD-01.3/.4 repo-wide.

## 4.8 Migration / Rollout

No data migration, no wire change, no persisted state — `git revert`-able (proposal Rollback). Pre-release semver posture ratified: a CHANGELOG "Behaviour Changes" entry records Class A (five members) + Class B (side-effect, `.modify()` escape) ONLY; under the `.33` fallback arm, NO shebang changelog entry beyond the followup. **Archive-time (sdd-archive, NOT apply)**: reconcile `openspec/pending-changes.md` — CLOSE rows 342/343(reword→close, record the empirical refutation)/459/340; STRIKE 339(a); row 456 close TS side / keep-or-broaden React twin; sync the delta into the main `typescript-dialect` spec.

Row 460 (trust-boundary JSDoc) — **partial close, NOT full close** (Sec N3): this change delivers `addImport`'s JSDoc trust note ONLY (REQ-TSD-13.5 — `addImport`'s header affirmatively naming the siblings as still-raw); the sibling ops' OWN JSDoc headers are NOT edited (item 2's rewrite is `addImport`-scoped). Since 460 required the siblings' own docs to carry trust notes, the sibling-doc obligation FOLDS INTO the new sibling-exposure row below rather than closing 460 outright.

REGISTER THREE NEW rows: (1) **sibling `name` raw-splice exposure** — `addFunction`/`addVariable`/`addClass` `name`/`source`/`initializer` stay unvalidated + un-trust-noted in their own JSDoc (the injection asymmetry this change creates by fixing only `addImport`; absorbs 460's sibling-doc remainder); (2) **shebang-aware insertion** followup (ADR-03); (3) **sibling collision-scan asymmetry** (Arch N4) — post-change `addImport` (via `boundNamesIn`) detects default/namespace import collisions, but `assertNoCollision`'s import scan (`ops.ts:66-69`) still walks `getNamedImports()` ONLY, so `addFunction`/`addVariable`/`addClass` stay BLIND to a default/namespace import collision (e.g. `import Foo from "m"` + `addFunction("Foo", …)` does not reject). The `isValueNamespaceClaimed` extraction does NOT touch this scan; closing it is a separate change.

## 4.9 Performance Considerations

No significant impact. The claimed scan walks all import declarations once (file-scale, same order as the prior first-match plus a full-file pass — negligible; identical to the shipped react op).

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: The `src/core/jsx-name-validator.ts` touchpoint DEVIATES — the change falsifies the baseline's ARCH-2 "one consumer" premise (the TS dialect becomes its second, first non-JSX consumer, ADR-02) and adds a cross-dialect predicate-parity fitness (FIT-39). No boundary is removed and no pattern replaced (dialect→core stays the sanctioned direction, dependency-additive), so not `breaking`; but the one-consumer baseline assertion becomes outdated → `modifying`. Drives `arch_refresh_post_verify` to update the ARCH-2 note post-build.

## 4.11 Open Questions

None.

---
**adversarial_review**: required (L + `security (code execution): high` sensitive area — verify-final should run judgment-day blind).
