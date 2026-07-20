# Exploration: TS-dialect `addImport` merge-defect + collision fix (ts-addimport-collision)

**Triage**: L
**Persona lens**: none (synthesis; architect/security-engineer/qa-engineer/pm/ba findings folded in)

## Cross-Change Lessons Consulted

- Discovery `sdd/react-dialect/judgment-day-verdict` (#2299): **THE headline lesson — adopt the model, don't derive it empirically.** V8's CLAIMED model (`src/dialects/react/ops.ts`) is the complete, judgment-day-APPROVED answer; ADR-0039's `assertNoCollision` sat 20 lines from TS's own unvalidated `addImport` the whole time. Applies verbatim: this change PORTS V8, it does not re-derive a new algorithm from scratch.
- Architecture baseline `sdd/project-builder-sdk/architecture` (#2001, react-dialect delta): registers ARCH-2 (JSX-grammar placement debt, "one consumer", fires at dialect #3) and confirms ADR-0039 is already CROSS-DIALECT convention, not TS-only.
- Pending-changes rows 339/340/342/343/456/459/460 (`openspec/pending-changes.md`) — read in full; findings below.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author calls `ts.find(path).addImport(name, from)` to insert/merge an import | `test/e2e/dialect-modify.e2e.test.ts` ("Flow 1") | Modify — same call signature (frozen), new reject cases |
| Dialect conformance round-trip/fidelity for `addImport` | `test/conformance/typescript-conformance.test.ts` | Modify — adversarial + collision-reject coverage likely extends |
| Installed-package `./typescript` subpath op-set resolution | `test/e2e/installed-consumer.e2e.test.ts` | Read-only expected — op-set membership/signature unchanged |

## Current State

`src/dialects/typescript/ops.ts:22-32`'s `addImport` matches the FIRST declaration by module specifier (`getImportDeclaration`, singular) and merges unconditionally with no shape check — no validation on `name` or `from`. Confirmed defects: (1) type-only merge silently grafts a value binding into a type-only clause; (2) same-name across default/namespace/aliased shapes duplicates or silently no-ops; (3) cross-module/value-namespace collisions emit `SyntaxError`-triggering output. `assertNoCollision` (lines 54-75, ADR-0039) already exists in the same file and is used by `addFunction`/`addVariable`/`addClass` — NOT by `addImport`. `removeImport` (150-165) walks ALL matching declarations (judgment-day Issue 2 fix); `addImport` stays first-match-only — a shipped, undocumented asymmetry.

**Item 1 verified — JSX-independence**: react's V8 algorithm (`boundNamesIn`/`satisfiesIdempotency`/`isValueNamespaceClaimed`/orchestration, `react/ops.ts:81-234`) contains zero JSX-specific logic — it operates purely on `ImportDeclaration`/value-namespace AST nodes. `.ts` vs `.tsx` is irrelevant to the algorithm; only `setJsxProp` (react's other op) is JSX-specific. Confirmed: the model ports cleanly.

**Item 7 verified empirically**: mutated `addImport` (deleted the `alreadyPresent` guard) and ran `REQ-TSD-03.10` (`test/dialects/typescript/dialect.test.ts:239`) — it FAILED RED (duplicate `readFileSync, readFileSync` breaks the golden match). This REFINES pending-changes row 343: the test is NOT purely "determinism" as literally worded — it does catch a deleted guard. But it chains two `addImport` calls on ONE handle in ONE run, never proving that a FRESH, independent run seeded with the op's own prior output emits ZERO directives (the shape `ops-removeImport.test.ts`'s "absent binding … ZERO directives" test uses). Row 343's cited anti-pattern example, `REQ-TSD-09.6` (addFunction, two fully independent `runOnce()` calls, fresh Project each time), IS pure determinism and does not apply to addImport's own test. **Net**: backfill the true seed-with-own-output/zero-directive shape as an ADDITION, not a "replacement of a broken test."

**Item 4 verified**: `openspec/specs/typescript-dialect/spec.md` has NO `REQ-RXD-06.4`-equivalent regression pin for `from`-escaping, despite `addImport` resting on the identical ts-morph string-literal-escaping assumption. Gap.

**Item 6 verified**: applying V8's algorithm by hand to `import { X as X } from "m"` + `addImport("X", "m")` — `aliased: true` (alias node present) → fails `satisfiesIdempotency` → `claimed` (localName match) → REJECTS. Same false-positive pending row 456 registers for react. **V8 adopted verbatim LEAVES this defect, unchanged, now in both leaves** — neither resolves nor worsens it.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/typescript/ops.ts::addImport` | modify | port V8's 4-step algorithm | aligns — leaf-isolated logic change |
| `src/dialects/typescript/ops.ts::assertNoCollision` | reuse | TS already has the throwing value-namespace predicate addFunction/addVariable/addClass use | aligns |
| `src/core/jsx-name-validator.ts` (`assertValidImportBinding`, `IMPORT_RESERVED_WORDS`) | extend, new consumer | row-340 fold-in reuses the existing grammar/denylist, no new validator family | **deviates** — TS becomes its first non-JSX consumer, sharpening ARCH-2 sooner than "dialect #3" |
| Value-namespace collision predicate (hoist vs mirror) | new or extend | design ADR (item 3, mapped below) | mirror aligns (ADR-01 precedent) / hoist deviates (new core module) |
| `openspec/specs/typescript-dialect/spec.md` REQ-TSD-01 | modify (unfreeze) | encode V8-equivalent + asymmetry posture + from-escaping pin | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modify | port CLAIMED model; row-340 validator call |
| `src/core/jsx-name-validator.ts` | Modify/Read-only | reused as-is unless design relocates it |
| `src/core/dialect-handle.ts` (`handlePathFor`) | Read-only | confirm unchanged path-threading compat |
| `test/dialects/typescript/dialect.test.ts` | Modify | REQ-TSD-01/03.10 scenario growth |
| `test/dialects/typescript/ops-declarations.test.ts` | Modify | near-miss-mutant + hostile battery |
| `test/dialects/typescript/ops-removeImport.test.ts` | Read-only | reference shape for row-343 backfill |
| `test/e2e/dialect-modify.e2e.test.ts` | Read-only | confirm Flow 1 unaffected |
| `test/conformance/typescript-conformance.test.ts` | Modify (likely) | adversarial/collision coverage |
| `openspec/specs/typescript-dialect/spec.md` | Modify | unfreeze + amend REQ-TSD-01 |
| `openspec/pending-changes.md` | Modify | close/update rows 342/343/459/460/(340)/(456) |
| `src/dialects/react/ops.ts` | Read-only | source of truth for the port; zero changes expected |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution), high | `src/dialects/typescript/**` | Yes |

No new sensitive area surfaced.

## Approaches

### 1. Port react's V8 CLAIMED model to the TS leaf (adopt, don't derive)
**Description**: implement TS `addImport` with V8's four steps — narrowed already-bound/idempotency check, file-wide claimed-name union (import-specifier binding + value-namespace declaration), merge, create — reusing TS's own `assertNoCollision` for the value-namespace half if the mirror arm is chosen.
**Pros**: matches lesson #1 verbatim; proven correct after 3 judgment-day rounds; zero re-derivation risk.
**Cons**: two sub-decisions stay open by design (fold-in, hoist-vs-mirror) — intentionally deferred, not a gap.
**Effort**: Medium (triage estimate 250-450 lines incl. tests).
**Pattern fit**: direct port of `src/dialects/react/ops.ts` — no new pattern.

This is the only viable approach for the core topic; no alternative to "port vs. don't" exists once lesson #1 is binding.

## Recommendation

Port V8 (Approach 1). **Row 340 fold-in — RECOMMENDED (fold in)**: containment holds — one call to `assertValidImportBinding` reusing the existing grammar/denylist verbatim, no second mechanism family, no second skeleton; marginal cost ≈1 slice already inside triage's 4-6 band; it closes a CONFIRMED code-execution injection on an already-shipped, already-sensitive op rather than leaving it live for another change cycle. Tradeoff owner/architect must weigh: it makes TS-dialect ARCH-2's second real (non-JSX) consumer NOW, not at "dialect #3" — design should decide whether to accept the compounded debt or relocate the module concurrently.

**Hoist-vs-mirror (item 3) — MAPPED, not decided**, per the launch brief: mirror is lower-cost and matches ADR-01's leaf-duplication precedent, but triplicates a predicate class already responsible for 3 judgment-day rounds; hoist eliminates that risk permanently but requires touching already-shipped/archived `react/ops.ts` — crossing the owner's "standalone, TS-only" scope framing — plus a new core module and ADR. Architect council input required before design commits.

## Risks

- Triplication risk if mirror ships without a predicate-sync fitness function.
- Row 456 self-alias false-positive is inherited into TS unchanged — archive bookkeeping must reconcile (broaden row 456 or twin it).
- `from`-parameter trust assumption stays silently assumed unless REQ-TSD-01's amendment adds a `from`-escaping regression scenario.
- Silent-merge→loud-reject is a semver-relevant behavior change — owner-reserved at spec time; must land as an explicit spec clause.
- Near-miss-mutant/hostile-battery discipline (Strict TDD, binding) makes the triage line estimate optimistic if slicing underweights test volume.

## Open Questions

- type: technical
  question: "Does folding row 340 in (TS becomes a 2nd, non-JSX consumer of `jsx-name-validator.ts`) warrant relocating/renaming that module now, or does it compound ARCH-2's debt until dialect #3?"
  why_it_matters: "Affects design's ADR scope and whether this change touches a module outside its own leaf."
- type: technical
  question: "Hoist-vs-mirror ADR: which arm for the value-namespace collision predicate, given triplication-risk vs. scope-crossing-into-archived-react-code?"
  why_it_matters: "Determines whether this change stays TS-leaf-isolated or touches already-shipped react/ops.ts."
- type: technical
  question: "Does REQ-TSD-01's amendment need a REQ-RXD-06.4-equivalent `from`-escaping regression scenario?"
  why_it_matters: "TS's addImport rests on the same ts-morph escaping assumption react's spec pins explicitly; TS's doesn't, today."
- type: technical
  question: "Row 456 bookkeeping: broaden to cross-dialect scope, or register a TS-scoped twin, once V8 ships in both leaves?"
  why_it_matters: "Keeps the pending-changes ledger honest about a debt now live in two places."
- type: technical
  question: "Does TS's addImport adopt the full `validatedOp` wrapper (react's convention) or an inline validator call (TS's current unwrapped-function style)?"
  why_it_matters: "Both wire cleanly through `defineOpPack` (verified) — a style choice for design, not a blocker."

## Ready for Proposal

**Status**: yes
**Reason**: The core approach (port V8) is unambiguous per the binding lesson; all seven brief items were investigated and grounded in real code/tests, including two empirical verifications (JSX-independence, REQ-TSD-03.10 mutation survival). The two sub-decisions intentionally left open (row-340 fold-in recommendation given; hoist-vs-mirror mapped, not decided) match the launch brief's own instructions and are technical open questions routed to design/spec, not blockers.
**Recommended action**: Proceed to `sdd-propose`.
