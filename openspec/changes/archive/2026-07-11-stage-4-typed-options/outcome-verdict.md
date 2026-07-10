# Outcome Verdict — stage-4-typed-options (Steward Reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `DELIVERED` (with escalated conscience questions — proceed to archive on the human's affirmation) · **Triage**: L · **Date**: 2026-07-11

> Held against the ORIGINAL `problem_statement` (triage.md § Problem & Scope) and the North Star memo — NOT the spec. verify-final + two blind judges already judged spec conformance and APPROVED; this gate judges OUTCOME.

## Our objective was THIS (quoted)

- **problem_statement**: `schema.json` is the schematic's INPUT CONTRACT but "has no teeth in the SDK": the factory takes resolved inputs as a bare hand-supplied `defineFactory<O>` generic, nothing validates resolved inputs at the run boundary, and nothing keeps schema.json ↔ factory-input-type ↔ CLI prompts in sync (three-way drift). The differentiator "one source, parity enforced" **does not exist**. Plus the transferred ownership item: reserved lifecycle names (`add`/`remove`/`pre-execute`/`post-execute`) are SDK-side with **zero coverage**. **Why now**: pre-v1 the input-typing mechanism is cheap to decide and **semver-locked once published**.
- **North Star** (foresight promise): give `schema.json` teeth along three planes — compile-time (codegen bin → `type Input`, author writes `defineFactory<Input>`), build-time (FIT-12/13 make drift a BUILD FAILURE), run-time (fail-closed RBV pre-`als.run`, reserved-name rejection). Alignment declared **conditional on 4b following** for installed-author reachability.

## Did we deliver it? Show me WHERE (AI analysis, evidence I generated)

I drove the real author journey myself in a scratch package (fresh schema richer than the in-repo fixture: `number` + `enum` + optional `string`), not just re-read tests.

| Stated pain | Delivered? | Evidence I generated |
|---|---|---|
| `schema.json` has no teeth | ✅ Real | Ran `pbuilder-codegen mypkg` on a fresh schema → emitted `schema.generated.ts` with content-derived `@schema-digest`. Sufficiency **hard-failed** a real missing-`label` schema (`property "x" is missing a label`, exit 1) and a malformed JSON with a **position locator** (`invalid JSON (line 1, column 17)`) — the schema is now load-bearing, refused when insufficient. |
| bare hand-supplied `defineFactory<O>` | ✅ Real (bin ships) | The bin is a real `package.json#bin`; I executed it end-to-end and got a typed `Input` (incl. an `"dev" \| "prod"` enum union and `note?` optional). |
| nothing validates resolved inputs at the run boundary | ✅ Real | e2e reject test asserts a schema-violating input throws `AuthoringError` **before** the factory body (`committedTree().size === 0`, `stagingTree().size === 0`) with message `invalid input: port must be number` — no raw-value echo (RBV-02/04 canary). |
| three-way drift (schema ↔ type ↔ prompts) | ✅ As contract | FIT-12 (digest parity, both directions) + FIT-13 (sufficiency: type/label/enum hard-fail so the Go CLI can derive prompts). SDK guarantees sufficiency; prompt RENDERING stays engine/Go-CLI territory (correctly out of scope). |
| differentiator "one source, parity enforced" | ✅ Exists + proven in-repo — ⚠️ **not yet reachable from an installed package** | I removed the `@ts-expect-error` guards and tsc **rejected** `env: "staging"` (TS2322) and a missing required `port` (TS2741) — the generated type has genuine compile-time teeth. But `defineFactory` is reachable only via the in-repo relative path `../../../src/core/context.ts`; it is NOT in `package.json#exports` (umbrella `.` re-exports commons only; FIT-08 keeps it internal by design). Owner-deferred to `stage-4b-testing-harness`. |
| reserved names, zero prior coverage | ✅ Real | RLN-01/02/03 + FIT-16 always-on scan; `pre-execute`/`post-execute` rejected from module structure (`add`/`remove` documented, deferred to L2). |
| **pin the mechanism pre-v1 (the actual "why now")** | ✅ **DELIVERED — the primary outcome** | D4 = codegen bin ratified (ADR-0027); the semver-locked DX call is made, recorded, and proven before publish. |

**Promise↔delivery drift check**: ZERO. All five items the North Star said reckoning would demand are present and I verified the load-bearing ones first-hand (bin end-to-end, type teeth via tsc, sufficiency hard-fail, no-echo rejection at the site, reserved-name rejection). The single "conditional" residual (installed reachability of `defineFactory` + the testing harness) is intact as a **documented, owner-ratified deferral** to 4b — not a silent drop. The README carries a truthful qualifier (`shipping incrementally — the external-author API … lands with stage-4b`), tested by REQ-FPS-05.

**Outputs-without-outcome scan**: the author gets real OUTCOME, not just artefacts — typed options with compile-time teeth (safer), drift-as-build-failure, fail-closed run-boundary validation (safer), author-vocabulary errors with no internal leak (better DX). I confirmed each behaviourally. No gold-plating detected: the security surface (write-containment, symlink-escape refusal, no-echo canary, allow-listed emit) is proportionate to the genuinely-new `#bin` supply-chain surface — I exercised the containment/locator paths and they fail closed.

## Is it usable / significant? (ESCALATED — human-only, my recommendation attached)

The AI can assert the mechanism works and matches the promise; whether the **increment is significant enough to stand as Stage 4's delivery given 4b is committed-next, and whether the deferred last-mile leaves a coherent step vs a stranded half** is a judgement of worth only the owner can make. My evidence-based recommendation on each is below — the gate does not pass until the human engages these.

### CQ-1 — Is this a coherent, usable increment, or a stranded half-step? (the deferral question)
An installed author today can run `pbuilder-codegen` and get a typed `Input`, but CANNOT `import { defineFactory }` to consume it in a runnable factory from the package — that lands in 4b. **My recommendation: coherent increment, PROCEED.** Rationale: (a) `defineFactory` has ALWAYS been internal across the SDK (FIT-08), so this change regresses nothing and breaks no previously-shipped path; (b) the deferral was owner-ratified at foresight and is the planned Stage-4→4b seam, not a discovery; (c) the README qualifier is present and truthful (no false promise of installed reachability); (d) the codegen bin half is independently usable the moment the package ships. This is an additive advance with a documented next step, not a broken half.

### CQ-2 — Is the increment significant enough to BE Stage 4's delivery?
**My recommendation: significant, PROCEED.** The problem statement's own "why now" is *pin the semver-locked input-typing mechanism pre-v1* — that is fully delivered and ADR-ratified (D4/ADR-0027). The schema→type derivation is proven with real compile-time teeth; run-boundary validation ships fail-closed; a transferred-ownership gap (reserved names, zero prior coverage) is now covered. The urgency driver of the whole change is satisfied, not deferred.

### CQ-3 — Confirmation that in-repo-proven-only (not installed-author-proven) is acceptable for THIS stage
The differentiator is proven end-to-end ONLY via in-repo relative imports; the full installed-author journey (bin → type → typed `defineFactory` → run against a public fake) is not reachable until 4b exports `defineFactory` + a `./testing` harness. **My recommendation: acceptable for Stage 4, PROCEED** — provided `stage-4b-testing-harness` stays committed-next and is not silently dropped; if 4b slips indefinitely, the differentiator's *author-facing* value stays theoretical and CQ-1/CQ-2 should be revisited. Recommend the owner reaffirm 4b's commitment as the condition of this proceed.

## Verdict

**DELIVERED.** The outcome the original problem asked for is present, proven, and matches the foresight promise with zero drift; the sole residual (installed-author reachability) is an owner-ratified, truthfully-documented deferral to 4b, not an outcome gap. Escalated conscience questions CQ-1/2/3 carry my recommendation to PROCEED, conditioned on the human affirming significance and 4b's continued commitment. No `outcome-gap` halt.

## Skill resolution

`injected` — steward SKILL.md + purpose-lifecycle.md + sdd-phase-common.md read directly per launch instruction; no project-specific compact rules needed for a purpose-validation gate (project-agnostic).
