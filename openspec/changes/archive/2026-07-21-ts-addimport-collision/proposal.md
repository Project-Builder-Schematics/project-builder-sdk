# Proposal: TS-dialect `addImport` collision + injection fix (ts-addimport-collision)

**Triage**: L (sensitivity override — `security (code execution): high` on `src/dialects/typescript/**`)
**Persona lens**: none (synthesis — architect/security/qa/pm/ba findings folded in)

## Intent

The shipped, publicly-exported `@pbuilder/sdk/typescript` `addImport` (`src/dialects/typescript/ops.ts:22-32`) is the original naive ten-liner the React dialect was later copied and hardened from. It matches the FIRST declaration by module specifier and merges unconditionally — emitting silently broken code on ordinary input: a type-only clause gets a value binding grafted in (erased at compile → runtime `ReferenceError`); a same-name across default/namespace/aliased shapes duplicates or silently no-ops; a cross-module or value-namespace collision emits `SyntaxError`-triggering output. Separately, `name` is spliced RAW, a CONFIRMED code-execution injection (`addImport('x } from "evil"; import { y', ...)` emits an attacker-chosen import). The judgment-day-APPROVED remedy (React spec V8's CLAIMED model, `src/dialects/react/ops.ts`) and the ready-made validator kit both already exist — this change PORTS them; it does not re-derive. Fixing it now is cheapest while the model is fresh and the file is already the registered high-sensitivity leaf.

## Scope

### In Scope
- addImport merge-defect family (rows 459/342) via React's CLAIMED four-branch model V8
- `name` validation (row 340 fold-in, CONFIRMED) reusing `assertValidImportBinding` + `IMPORT_RESERVED_WORDS` verbatim
- `from`-escaping regression pin (REQ-RXD-06.4-equivalent — currently ABSENT in TS)
- Seed-with-own-output zero-directive idempotency test (row 343 — an ADDITION, not a fix)
- Trust-boundary JSDoc (row 460) per security's framing
- Unfreeze + amend REQ-TSD-01; explicit posture on the addImport(first-match)/removeImport(all-matches) match-cardinality asymmetry (shipped pair only)
- `import { X as X }` self-alias posture pinned in spec (row 456 bookkeeping)

### Out of Scope
- Resuming `ts-dialect-backend-ops` Group 1 (row 339) — stays paused
- `name` exposure on addFunction/addVariable/addClass (registry rows 340/341) — this change must NOT claim "the TS injection surface is closed"
- Other TS dialect ops
- The semver/consumer-impact call on silent-merge → loud-reject — OWNER-reserved at spec time

## Capabilities (contract with sdd-spec)

### New Capabilities
None.

### Modified Capabilities
- `typescript-dialect`: the delta below. All requirement-contract handles land in this one domain's delta spec.

Stable requirement-contract handles for sdd-spec:
- `CAP-1 addimport-collision-model`: addImport adopts V8's four branches — already-bound idempotent no-op → claimed reject → merge → create — reusing TS's own `assertNoCollision` for the value-namespace half. LOAD-BEARING ordering invariant: idempotency check runs BEFORE the claimed check (else the second identical addImport regresses REQ-TSD-03.10). Closes rows 459/342.
- `CAP-2 addimport-name-validation`: reject invalid/hostile `name` before any mutation, via `assertValidImportBinding` + `IMPORT_RESERVED_WORDS`. Reject-tail is TS house style (`on "{handlePathFor(ast)}"`), NOT React's path-less tail — do not reuse verbatim.
- `CAP-3 addimport-from-escaping-pin`: regression scenario proving `from` cannot break out of the ts-morph string literal.
- `CAP-4 addimport-idempotency-seed`: fresh run seeded with addImport's own prior output emits ZERO directives.
- `CAP-5 reqtsd01-amendment`: unfreeze + amend REQ-TSD-01 to encode the new model; state the match-cardinality asymmetry posture and the self-alias (row 456) posture.
- `CAP-6 addimport-trust-boundary-jsdoc`: JSDoc marking `name`/`from` channels; must not imply parity with the still-raw addFunction/addVariable/addClass `name`.

## Approach

Port React V8 to the TS leaf (the only viable approach once lesson #1 — "adopt, don't derive" — is binding). The port is mechanical against the architect's port matrix: `boundNamesIn`/`satisfiesIdempotency` transfer identically (zero/ts-morph-only reads); `isValueNamespaceClaimed` ALREADY exists as `assertNoCollision`'s value half (ADR-0039, cross-dialect); `isNonTypeOnlyNamedImportClause` is React-only and must be ported; the reject-tail needs the TS path-ful variant. `.ts` vs `.tsx` is irrelevant — import semantics are ScriptKind-independent.

**DESIGN-RESERVED fork (do not decide here) — hoist-vs-mirror, CORRELATED with ARCH-2 handling.** The value-namespace/validator predicate can be either:
- **Arm a (mirror-in-leaf)**: aligns ADR-01's duplication precedent and the owner's "standalone, TS-only" framing; keeps archived `react/ops.ts` byte-untouched. Deviates DRY — triplicates a predicate class already responsible for 3 judgment-day rounds → REQUIRES a predicate-sync fitness function (shared fixture battery against both dialects) and consumes `jsx-name-validator.ts` as-is, registering TS as ARCH-2's second (non-JSX) consumer NOW — the module-rename becomes tracked debt.
- **Arm b (hoist to core)**: extract the AST-free predicate + `assertValidImportBinding`/`IMPORT_RESERVED_WORDS` to a new core module (e.g. `core/js-identifier.ts`), single source, no sync fitness (FIT-37/38 become the guard). Deviates: new-core-module ADR + RE-OPENS the archived react leaf (react must consume the shared predicate or arm b is pointless), risking signed REQ-RXD-05 scenarios.

The correlation is non-negotiable for design: arm b → pull the ARCH-2 split forward (react re-open already paid); arm a → consume as-is + register rename debt + one ADR sentence. Design's ADR must engage arm b's real tradeoff (duplication + sync-fitness vs single-source + react-reopen) — dismissing it as "too entangled" is halt-worthy; the architect proved it clean. **Recommendation (non-binding): lean arm a** — it honours the owner's standalone-TS scope and leaves react sealed, PROVIDED design commits to the sync-fitness obligation; flip to arm b only if design's cost analysis shows the sync-fitness burden exceeds the react-reopen risk. Also design-reserved: `validatedOp`-wrapper vs inline-validator style (both wire cleanly through `defineOpPack`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | port V8 four-branch algorithm; row-340 validator call; JSDoc |
| `src/core/jsx-name-validator.ts` | Modified / Read-only | reused as-is (arm a) or relocated (arm b) |
| `src/core/dialect-handle.ts` (`handlePathFor`) | Read-only | confirm path-threading compat for reject-tail |
| `openspec/specs/typescript-dialect/spec.md` | Modified | unfreeze + amend REQ-TSD-01; asymmetry + self-alias posture |
| `test/dialects/typescript/ops-declarations.test.ts` | Modified | near-miss-mutant + hostile battery + row-343 backfill |
| `test/dialects/typescript/dialect.test.ts` | Modified | REQ-TSD-01/03.10 scenario growth |
| `test/conformance/typescript-conformance.test.ts` | Modified (likely) | adversarial/collision coverage |
| `src/dialects/react/ops.ts` | Read-only (arm a) / Modified (arm b) | port source; touched only if arm b |
| `openspec/pending-changes.md` | Modified | close/update rows 342/343/459/460/(340)/(456) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Silent-merge → loud-reject is a semver-relevant behaviour change on a shipped exported op | High | OWNER-reserved at spec; must land as an explicit spec clause, not resolved in design |
| Mirror (arm a) triplicates the predicate without a sync guard | Medium | Mandatory predicate-sync fitness function if arm a chosen |
| Hoist (arm b) re-opens archived react leaf, risking signed REQ-RXD-05 | Medium | Design ADR weighs explicitly; FIT-37/38 as extraction guard; re-verify react scenarios if chosen |
| Row 456 self-alias false-positive inherited into TS unchanged | Medium | Pin posture in spec (CAP-5); archive reconciles ledger (broaden 456 or twin) |
| ARCH-2 debt compounds (TS becomes 2nd non-JSX consumer before "dialect #3") | Medium | Design decides accept-debt (arm a) vs relocate-now (arm b); baseline note either way |
| Ordering invariant broken → second identical addImport regresses REQ-TSD-03.10 | Medium | Idempotency-before-claimed is a named, mutant-killing test scenario |
| Strict-TDD test volume underweighted → triage line estimate optimistic | Medium | Slice test volume explicitly (near-miss mutants + hostile battery) |

## Rollback Plan

The change is fully reversible — no data migration, no persisted state, no irreversible wire contract. Rollback: `git revert` the implementation commits touching `src/dialects/typescript/ops.ts`, the `typescript-dialect` delta spec, and the TS test files; if arm b shipped, its core-module extraction and react-consumer edit are separate commits, revertible independently (restoring `react/ops.ts` and `jsx-name-validator.ts` to their archived byte-state). Validate rollback by running the full `bun test` suite and confirming green at the prior baseline, plus a byte-diff of the frozen `.d.ts` and `pkg-surface-baseline.json` (the `addImport` signature is frozen, so both must be unchanged whether the change lands or reverts). Safe to leave forward-compatible: the row-460 JSDoc and the row-343 seed-with-own-output test are additive and harmless if the algorithm reverts. No unrecoverable data — the only user-visible effect of a revert is that silent-merge behaviour returns; any code an author emitted during the feature window is already flushed to their own tree and is unaffected by the SDK revert.

## Dependencies

None. ts-morph@28.0.0 (already the sole exact-pinned runtime dep) and the existing React V8 model / validator kit are all in-repo. No external service, SDK upgrade, or infra change.

## Success Criteria

- [ ] addImport LOUD-rejects type-only merge, cross-module value-namespace collision, and same-name-across-shapes — each with a passing reject test naming explicit values/argument positions
- [ ] No addImport input emits a binding that erases at compile or triggers `SyntaxError` at consumer parse (covered by the adversarial/collision battery)
- [ ] The CONFIRMED injection `addImport('x } from "evil"; import { y', ...)` is rejected; hostile battery discriminates WHICH validator is wired (backtick-bounded assertions)
- [ ] `from`-escaping regression scenario is green (CAP-3)
- [ ] Fresh run seeded with addImport's own prior output emits ZERO directives (CAP-4)
- [ ] REQ-TSD-01 unfrozen, amended, re-signed; match-cardinality + self-alias postures stated (CAP-5)
- [ ] Full `bun test` suite green x2; frozen `.d.ts` + `pkg-surface-baseline.json` byte-unchanged (signature frozen)
- [ ] Near-miss mutants killed for every new validator/collision branch (Strict TDD)
