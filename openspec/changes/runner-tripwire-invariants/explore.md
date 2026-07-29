# Exploration: Constraint-4 structural-invariant redesign (runner-tripwire-invariants)

**Triage**: L
**Persona lens**: none (synthesis; council joins propose/spec/design)

## Cross-Change Lessons Consulted

- Decision `runner-integrity-manifest` judgment-day (archived 2026-07-25, `judgment-day.md` + `.sdd/state/runner-integrity-manifest.json` `round2_lesson`): "these are AST-shape checks and shapes have a long tail... fix direction for R2-1 is to INVERT THE INVARIANT... decidable, no tail." This IS the topic; there is no separate prior-change precedent beyond the one this change extends.
- ADR-0076 (Constraint-4 amendment history): records the exemption's two failed shape-matching attempts and the shipped inversion — the amendment log itself is the clearest statement of the technique to generalise.
- No other `pattern`/`discovery`-typed memory matches "AST shape scanner / decidable structural invariant" beyond the above — this repo has not applied the inversion technique outside Constraint-4 yet.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Contributor changes `scripts/derive-runner-closure.ts` or a closure-reachable file (`src/transport/**`) and opens a PR; CI's `fit-42` must catch any Constraint-4 regression before merge | none found — `fit-42-runner-closure-integrity.(negative.)test.ts` are fitness/red-proof tests, not e2e | Modify (fewer false-negative/false-positive gaps in the same gate) |
| Maintainer runs `bun run build`; `generate-runner-manifest.ts` (chained last) must fail closed on any malformed input rather than ship or leave a stale `dist/runner-manifest.json` | none found — build-time script, no e2e harness covers it | Modify (R2-3/R2-4 close the fail-open gap) |

No user-facing flow exists — this is a build-time/CI mechanism; the engine-side "verify before spawn" flow is explicitly out of scope (cross-repo).

## Current State

`scripts/derive-runner-closure.ts` (536 lines) is the single closure walker + classifier, with three separate consumers (build generator, maintainer baseline writer, `fit-42`) — architecture baseline confirms this "one-derivation/three-consumers" shape is deliberate and unchanged by this work.

`denyScan()` has two independently-flawed halves:
1. **Exemption logic** (createRequire at the anchor file) — R2-1 already inverted this from "search for the first occurrence, exempt it" to "prove the whole file contains exactly one unaliased `createRequire` binding, else forfeit and deny every bound name" (`createRequireBindingsIn`, `anchorExempt`, commit `4b4914a`). This is the reference implementation. R2-5 is the one gap left in it: the shape-proof only recognises the *named-import* binding form, so `module.createRequire(u).resolve(s)` — the form the anchor file's own header comments document — is denied as a false positive.
2. **Denial-matching logic** — still pure identifier/member TEXT matching (`DENIED_IDENTIFIERS = {createRequire, eval, Function}`, `DENIED_MEMBER_EXPRESSIONS = {Bun.plugin, process.binding}`, matched via `getDescendantsOfKind(Identifier)` and `PropertyAccessExpression`). This under-matches (`globalThis["eval"]`, `p["binding"]` via `ElementAccessExpression` — R1-7) and over-matches (`x instanceof Function` — R1-17), because "does this token's text appear anywhere in the file" has no notion of AST *position*. The file already has the needed template for a positional fix: `isResolveOnlyCreateRequireUse()` tests whether an identifier sits in callee-of-call-whose-result-is-`.resolve`d position — the same technique, applied to "is this identifier the callee of a `Call`/`New` expression", closes both R1-7 and R1-17 without adding new spellings to chase.

`generate-runner-manifest.ts` (103 lines): the version-validation branch (line 81-88) reuses the `unreadable-file` `ViolationRule` to report an unusable `version` field (R2-3 — wrong rule, 4/5 rendered lines false), and `JSON.parse(packageJsonBytes...)` (line 75) sits **outside** any try/catch or the `failClosed()` path, so a malformed `package.json` throws raw past the manifest-removing branch, leaving a stale manifest on disk (R2-4). This is the concrete instance of the still-open general row R1-5 ("route every generator failure through the manifest-removing path").

`test/support/closure-integrity-checks.ts`'s `normaliseForComparison()` (R2-6): strips one leading `"./"` and a single trailing `/`, then `posix.normalize()`s. `.//dist/x` still starts with `"./"` (chars 0-1), so the strip leaves `/dist/x` — now absolute-rooted, breaking equality with the un-prefixed closure path. `--outdir .` normalises to `"."` (length 1, trailing-slash strip skipped), and the closure path never starts with `"./"` so the `startsWith(`${target}/`)` containment check misses total-root targeting. Both are canonicalisation-completeness gaps, not AST gaps, but the same "compare provable-equal forms, not spellings" family.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `scripts/` build-integrity cluster (`scripts/derive-runner-closure.ts`, `scripts/generate-runner-manifest.ts`) | modify | Constraint-4 exemption/deny-scan redesign (R2-5, R1-7, R1-16, R1-17) + R2-3/R2-4 bugfixes | aligns — baseline already documents this cluster and its "one walk, three consumers" split (ADRs 0073-0076) |
| `test/support/closure-integrity-checks.ts` (BDI-01 disjointness) | modify | R2-6 path-canonicalisation fix | aligns |
| `test/fitness/fit-42-runner-closure-integrity.(negative.)test.ts` | modify | new red-proofs per closed finding, Strict TDD | aligns |
| `docs/runner-integrity-invariants.md` | modify | R1-11 (bind hardcoded 23/24 counts to the derivation) + mechanism-promise update (Constraint-4 is now proof-based, not enumeration-based) | aligns |
| `openspec/decisions/` (ADR-0076 amendment or new ADR) | new | mechanism decision must be recorded per the meta-finding's own instruction ("decide the mechanism before patching the rows") | aligns — ADR budget already used 4/4 on this subsystem; triage flags next numbering starts at 0079 |

No `deviates` rows — this change operates entirely inside the already-documented `scripts/` cluster; no new layer or component is introduced.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `scripts/derive-runner-closure.ts` | Modify | denyScan exemption-shape extension (R2-5) + positional deny-matching (R1-7, R1-17) + R1-16 re-verification |
| `scripts/generate-runner-manifest.ts` | Modify | R2-3 (own `ViolationRule`) + R2-4/R1-5 (route `JSON.parse` through `failClosed`) |
| `test/support/closure-integrity-checks.ts` | Modify | R2-6 path canonicalisation |
| `test/fitness/fit-42-runner-closure-integrity.test.ts` | Modify | R1-10 non-vacuity guard (substring → AST identifier count), R1-11-adjacent doc-binding assertions |
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` | Modify | new red-proofs, one per closed finding (Strict TDD) |
| `docs/runner-integrity-invariants.md` | Modify | R1-11 + mechanism-promise wording |
| `openspec/specs/runner-integrity-manifest/spec.md` | Modify | `REQ-CST-04.1`'s inline note documents the FIRST rejected mechanism, not the shipped one — likely non-freezing clarification (owner confirmation flagged at triage) |
| `openspec/decisions/00xx-*.md` | Created | mechanism ADR (extends 0076 or new) |
| `openspec/pending-changes.md` | Modify (at archive) | re-audit dispositions for all 23 rows |
| `openspec/architecture.md` | Read-only | already refreshed 2026-07-29 covering this cluster — confirmed current, no touch needed by this change (see risk below) |
| `openspec/sensitive-areas.md` | Read-only | `scripts/derive-runner-closure.ts` is NOT a registered path (rows cover `src/dialects/**`, `src/core/dialect-handle.ts`, publish surface) — confirmed via direct read, not assumed |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution) | `scripts/derive-runner-closure.ts` (Constraint-4 guard) | Yes — triage fired the sensitivity override via the SUBJECT test, independently re-derived rather than registry-matched, because `openspec/sensitive-areas.md`'s rows literally list `src/dialects/**`/`src/core/dialect-handle.ts`/the publish surface, NOT `scripts/**`. This is expected, not a gap: the register is *file-path* scoped and this mechanism lives in build tooling; triage's override logic already accounted for that mismatch. No escalation needed. |

## Approaches

### 1. Per-guard structural inversion (targeted extension of R2-1's shipped pattern)

**Description**: Apply the exact technique that already shipped, guard by guard. Extend the anchor's shape-proof to accept the namespace form alongside the named-import form (closes R2-5, still "exactly one qualifying occurrence or forfeit"). Convert the deny-side matching from text-only (`DENIED_IDENTIFIERS`/`DENIED_MEMBER_EXPRESSIONS` scanned by raw name) to a positional predicate reusing `isResolveOnlyCreateRequireUse`'s existing shape-test style — "is this identifier/access the callee of a `Call`/`New` expression" — which closes R1-7 (computed `ElementAccessExpression` access was invisible to text matching) and R1-17 (`Function` in non-call position like `instanceof` no longer false-positives) in one mechanism. R1-16 gets re-verified rather than re-coded, per judgment-day's own note that the inverted invariant likely already dissolves it.

**Decidability test per row**: R2-5 — was "does the anchor happen to import via the named form" (partial, spelling-dependent) → becomes "does the anchor prove one of two closed shapes" (decidable, no tail beyond the two forms Constraint-3 already sanctions). R1-7/R1-17 — was "does this token's text appear anywhere" (unbounded — bracket access, `instanceof`, aliasing all defeat or over-trigger it) → becomes "is this identifier in callee-of-call/new position" (a closed, structurally decidable AST predicate already proven out by `isResolveOnlyCreateRequireUse`).

**Pros**: Directly matches the owner's stated direction ("apply that approach to the class instead of another shape-matching round") — no new abstraction, reuses an in-file pattern the codebase and its ADR already trust. Minimal blast radius on a security-critical, heavily red-proofed file (18 existing red-proofs must survive byte-for-byte). Each proof is independently decidable and independently testable.
**Cons**: Still N separate proof-sites rather than one unified mechanism — a *future* Constraint-4 primitive (something beyond `eval`/`Function`/`createRequire`/`Bun.plugin`/`process.binding`/`node:vm`) requires writing a new bespoke shape-proof again, though each one is now individually tail-free.
**Effort**: Medium. **Pattern fit**: matches existing `scripts/derive-runner-closure.ts:198-263` (`isResolveOnlyCreateRequireUse`) directly.

### 2. Declarative invariant table (unify the mechanism)

**Description**: Replace `DENIED_IDENTIFIERS`/`DENIED_MEMBER_EXPRESSIONS` plus the anchor's bespoke exemption code with one declarative table — one row per primitive, each row naming its admission predicate (callee-of-call/new, or unconditional zero-occurrence) and optional exemption shape (anchor file, exact binding count, unaliased). `denyScan` becomes a generic interpreter; `node:vm`'s already-separate special case in `classifySpecifier` folds into the same table (closing the registered "altitude fold" debt row as a side effect), and `docs/runner-integrity-invariants.md`'s enumeration could render from the same source, closing R1-11 structurally rather than by hand-binding counts.

**Pros**: The next Constraint-4 primitive becomes a one-row table addition, not new imperative code — serves the "one derivation, single source of truth" ethos the architecture baseline already credits this cluster with. Table rows are unit-testable in isolation from the AST walk.
**Cons**: Materially larger refactor of a security-critical file that took ~25 review-and-fix rounds to stabilise — higher regression risk against the 18 existing red-proofs under Strict TDD, and it is scope beyond what the owner asked for ("apply that approach to the class," not "build a rule-table DSL"). Risks re-litigating a mechanism decision the owner has already made a narrower call on.
**Effort**: High. **Pattern fit**: new pattern for this file (data-driven scanner), though the *concept* — one source of truth interpreted by multiple consumers — matches the cluster's existing philosophy.

## Recommendation

**Approach 1 (per-guard structural inversion)** — it is the direct, minimal-risk extension of the technique the owner explicitly directed ("apply that approach to the class instead of another shape-matching round"), it reuses an already-proven in-file pattern (`isResolveOnlyCreateRequireUse`) rather than inventing new architecture, and it keeps the diff small on a file where every prior round of enlargement produced a new judged defect. Approach 2's unification is a legitimate idea but is design-phase scope creep relative to a debt-closure change with an explicit tight scope line at triage — if the mechanism decision (which `sdd-design` still owes an ADR for, per the meta-finding's own instruction) later concludes a table is warranted, that is a `sdd-design` call to make deliberately, not a default reached by exploration momentum.

R2-3/R2-4 (version-validation bugfix) and R2-6 (path canonicalisation) are NOT part of the AST-shape class — they are independent, already-decidable bugfixes explicitly named in triage's in-scope list, done alongside in the same files the mechanism work touches.

## Risks

- **Red-proof regression surface**: 18 existing red-proofs in `fit-42-*.(negative.)test.ts` pin exact violation shapes/messages; any deny-matching change must keep every one green while adding new ones (Strict TDD red-first is non-negotiable here given the QA persona's explicit concern that this defect class survived 5 in-loop verifies, a 4-lens simplify, and a final verify).
- **Spec REQ-CST-04.1 wording drift**: its inline note documents the *rejected* call-vs-resolve mechanism, not the shipped invariant-proof one — `sdd-spec` needs an owner call on amend-vs-freeze before design proceeds (already flagged at triage).
- **R1-16 could be a false "already closed"**: judgment-day's own text says the inverted invariant "can no longer steal the exemption slot" for JSDoc identifiers — but that claim needs an actual red-proof under the *redesigned* (post-R2-5/R1-7/R1-17) matcher, not just the R2-1-only state, before it is marked closed.
- **Architecture baseline is current** (refreshed 2026-07-29, explicitly folds in `runner-integrity-manifest`) — the registered "architecture baseline refresh" debt row is stale/already-discharged; worth flagging to the PM persona for retirement at archive rather than re-doing it.
- **ADR numbering collision risk**: triage already flags two pre-existing 0073/0074/0075 filename collisions from an unrelated concurrent-archive slip; this change's new/amended ADR must start at 0079 and not repeat the pattern.

## Open Questions

- type: product
  question: "REQ-CST-04.1's inline note ('A call-vs-.resolve() rule is evaded by...') documents the mechanism the redesign is moving PAST, not the shipped exactly-one-unaliased-binding invariant — does this need a MODIFIED-block spec amendment (unfreeze), or is it non-freezing clarification the owner can wave through at sdd-spec?"
  why_it_matters: "Strict TDD + signed-spec discipline means proceeding to design against stale REQ prose risks the executor building against the wrong contract; triage already flagged this as owner-confirmation-needed, not resolved."
- type: technical
  question: "Should the mechanism ADR (meta-finding's 'decide the mechanism before patching the rows') live as an amendment to ADR-0076, or as a new ADR (0079+) documenting the per-guard-inversion decision as its own record?"
  why_it_matters: "ADR-0076 already carries the R2-1 amendment history in-place; a design-time call on whether R2-5/R1-7/R1-17's fixes extend that same amendment section or start a fresh ADR affects both numbering (avoid repeating the 0073-0075 collision) and future readability of 'the' mechanism decision."
- type: technical
  question: "Is R1-16 (JSDoc identifiers scanned) closeable by re-verification alone (a new red-proof against the post-redesign matcher proving it no longer misfires), or does it need its own code change?"
  why_it_matters: "Judgment-day's own note says this is likely dissolved by the mechanism change, but that is a hypothesis, not a proof — sdd-spec/sdd-design should decide whether a red-proof-only closure is acceptable evidence or whether the row needs an explicit REQ."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: The mechanism decision has a clear, evidence-grounded recommendation (Approach 1); every in-scope debt row has a classification; no sensitive-area escalation is needed beyond the one triage already fired; the open questions are product/technical items for the next phases to carry forward, not blockers to proposing.
**Recommended action**: Proceed to `sdd-propose`, carrying the approach recommendation, the full 23-row classification (below), and the three open questions (one product, two technical) into the proposal/spec phases.

---

## Debt Register Re-Audit (23 rows, `openspec/pending-changes.md` "From `runner-integrity-manifest` archive" section)

| Row | Classification | Note |
|---|---|---|
| Meta-finding (Constraint-4 mechanism decision) | subsumed-by-invariant-redesign | This change IS the mechanism decision; delivers the ADR |
| R2-3 (version-failure wrong rule) | independent-fix-in-scope | Explicit triage scope item, not AST-shape class |
| R2-4 (JSON.parse outside failClosed) | independent-fix-in-scope | Explicit triage scope item; generalises R1-5 |
| R2-5 (namespace-form false positive) | subsumed-by-invariant-redesign | Named meta-finding child |
| R2-6 (disjointness path escape) | independent-fix-in-scope | Explicit triage scope item; canonicalisation bug, not AST |
| R1-5 (post-derivation throw, stale manifest) | still-relevant-fix-here | Generalisation of R2-4; same fix site, natural to close together |
| R1-6 (non-atomic writeFileSync) | stays-registered-debt | Not in triage scope; different concern (atomicity) |
| R1-7 (computed member access evades deny set) | subsumed-by-invariant-redesign | Named meta-finding child |
| R1-8 (directory specifier misdiagnosed) | stays-registered-debt | classifySpecifier/relative-resolution, unrelated to Constraint-4 |
| R1-9 (BOM guard `>0` vs `===23`) | stays-registered-debt | Test-quality nit, unrelated to mechanism |
| R1-10 (CST-04.3 substring vs AST count) | still-relevant-fix-here | Non-vacuity guard on Constraint-4's own scanner; cheap, same-file, would drift further if left substring-based |
| R1-11 (docs hardcode 23/24 counts) | still-relevant-fix-here | Explicitly in scope per triage's Tech Writer persona reasoning |
| R1-12 (BPI-04.1 mutates real dist/ mid-suite) | stays-registered-debt | Test isolation, unrelated to mechanism |
| R1-13 (publishRunSteps YAML order assumption) | stays-registered-debt | Unrelated to Constraint-4 |
| R1-14 (symlink-escape not on entry file) | stays-registered-debt | Different code path (entry resolution vs relative-specifier resolution) |
| R1-15 (node: prefix not validated against builtinModules) | stays-registered-debt | Unrelated to Constraint-4 |
| R1-16 (JSDoc identifiers scanned) | subsumed-by-invariant-redesign | Named meta-finding child; judgment-day's own note says likely dissolved — needs re-verification red-proof, see Open Questions |
| R1-17 (bare Function identifier over-denies) | subsumed-by-invariant-redesign | Named meta-finding child |
| R1-18 (srcPathFor lowercase-only rewrite) | stays-registered-debt | Unrelated to Constraint-4 |
| Architecture baseline refresh | already-discharged (not this change's job) | Confirmed DONE by the 2026-07-29 refresh (`inline-collection-marker` post-verify) — flag for PM to retire the row at archive |
| node:vm altitude fold | subsumed-by-invariant-redesign | Row's own text: "folds naturally into the Constraint-4 mechanism decision" |
| react-conformance.test.ts timeout | stays-registered-debt | Row's own text: "owned by the react dialect, not by this change" |
| Two spec-wording deviations (RMD-05.1, RMD-01.2) | stays-registered-debt | About the manifest itself, which is explicitly out of scope ("shipped, correct") |

## Skill Resolution

Registry: `.atl/skill-registry.md` present but empty per judgment-day.md's own note ("No project skill registry is configured") — proceeded against repo conventions and direct code reading. `fallback-registry`.
