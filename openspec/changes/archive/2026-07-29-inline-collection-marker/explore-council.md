# Explore Council Synthesis — inline-collection-marker

Orchestrator synthesis of the L explore council (sdd-explore + architect + security-engineer + qa-engineer, run blind in parallel, 2026-07-28). Companion to `explore.md` (engram `sdd/inline-collection-marker/explore`, obs #2608). Owner rulings at the bottom are BINDING for propose/spec/design.

## Corrected justification (goes into ADR/spec verbatim — the old one is false)

The removal is NOT justified by "the engine re-derives the ceiling" alone. REQ-BRC-02 covers by-reference directives (paths on the wire) ONLY; by-value content (`create({templateFile})`, by-value scaffold entries — `src/core/wire.ts:29-39`, `src/scaffold/classify-transport.ts:132`, `src/scaffold/expander.ts:171-176`) reaches the engine as bytes with no provenance — nothing to re-derive against. The honest justification: the factory is arbitrary in-process code with full `node:fs` (`src/transport/runner.ts:271`, `src/core/context.ts:395`) — the SDK can never be a security boundary against its own author; SDK-side containment was DX/attribution theatre (the spec's own words, `package-root-containment/spec.md:47-48`), and its presence-marker breaks inline-collection projects. Never write "the engine is the only boundary control" — for the by-value path there is no boundary control, and that is accepted (v1 trusted-author model, `openspec/problem-statement.md:91`).

## Scope corrections vs the triage artefact (propose MUST restate scope with these)

1. `src/scaffold/containment.ts` is NOT deleted wholesale — it SPLITS: ceiling machinery deleted; source read-resolution (`{absPath, stat}` used by classify-transport's CCL-06 stat reuse at `classify-transport.ts:119,123`) and the three IO-hygiene reasons survive, renamed `source-resolve.ts`; `validateDestinationLexical` (`containment.ts:287-291`) survives per owner ruling 2.
2. Spec families to reconcile: SIX, not three — package-root-containment (retire/re-home), run-boundary-input-validation (REQ-RBV-06/06.1), conformance-fixtures REQ-CSC-02.3, conformance-corpus REQ-CCR-08 (+ fixtures m-16/m-17 deleted, m-18 kept, coverage-manifest), **by-reference-copy-wire (REQ-BRC-06/07 depend on surviving source checks — NOT retiring)**, scenario-matrix (REQ-PRC-06 refs).
3. Public API break: `AuthoringReason` closed union 12 → 11 (`source-outside-package` removed; the other three `source-*` reasons SURVIVE — REQ-BRC-06/REQ-AEC-10 still bind them). FIT-04 `.d.ts` baseline updated in the SAME commit; CHANGELOG entry; pre-1.0 permissible.
4. `src/transport/single-instance-probe.ts` `packageRootFor()` is an UNRELATED npm-package-root walk — do not touch (grep hazard).
5. `src/scaffold/walk.ts` untouched except comment rewrite: 10k entry bound + symlink-dir non-descent are loop-safety/DoS (re-home REQ-PRC-04's walk clause to folder-scaffold), `rootReadFailure` no-echo minting stays (keep `rootRelPath` threading).

## Rehome list (IO hygiene / wire shape — NOT containment; deleting breaks live specs)

- R1 regular-file allow-list (stops FIFO hang / `/dev/zero`) — hard requirement.
- R2 guarded stat minting `source-not-found`/`source-unreadable` with package-relative path only (no-echo + `instanceof AuthoringError`; REQ-BRC-06.1 for copyIn) — hard requirement; shared helper consumed by classify-transport AND runCopyIn (explore recommendation) vs inlined per-site = design question.
- R3 lexical absolute-path screen on emitted source paths (REQ-BRC-07: absolute never on the wire) — hard unless REQ-BRC-07 amended.
- R4 `validateDestinationLexical` (owner ruling 2: SURVIVES, re-homed as IR well-formedness).
- R5/R6/R7 walk.ts guards (see 5 above).
- NEW per owner ruling 3: minimal lexical screen (`../` + absolute rejected) on the TWO inline-content read sites (`readTemplateFile`, by-value scaffold `from`) — anchored on packageDir, no marker/realpath/manifest. Symlink escape stays residual, documented.
- Unpinned decision for spec: `stat` vs `lstat` in R1/R2 (security lean: `statSync` + written acceptance). Note QA risk R1: packageDir-anchored checks are a NARROWING for legit `packages/foo → collection-root/shared` symlink users — needs an explicit scenario deciding behaviour (owner has stated everything lives beside the factory).

## Security residual-risk paragraph (carry into spec/design verbatim — amended by owner ruling 3)

SDK-side containment is removed. Against a hostile factory author this loses nothing (in-process code, full fs access — the ceiling never constrained it). The engine's apply-time re-derivation covers path-carrying directives only. The SDK's own inline-content reads keep a minimal lexical screen (`../`/absolute rejected at the two read sites); symlink-based escape from packageDir remains possible and is accepted (v1 trusted-author model). Preserved as IO hygiene independent of containment: regular-file allow-list, AuthoringError-with-relative-path on every source rejection (no-echo), lexical destination guard, absolute-never-on-wire, walk loop-safety bounds. Error-reason differences form a filesystem existence/permission oracle — accepted, documented.

## Test plan skeleton (QA; sizing input for slice)

- New `test/scaffold/inline-collection.test.ts`: NO scratchDirFactory (it seeds the marker — vacuous-pass hazard); own mkdtemp + explicit `existsSync(...collection.json) === false` precondition asserts; scaffold+copyIn succeed asserting exact committed content; body-sentinel ordering pin ("body-ran" surfaces — inverse of flipped REQ-RBV-06.1).
- TDD order for removal: flip run-boundary tests RED → new inline test RED → delete walk/collapse anchors GREEN → second flips one at a time → split containment.ts → 13 mandatory suite rewrites (walk.test.ts + authoring-error-source.test.ts do arithmetic on the seeded marker; harness-opted-in.test.ts ordered read-set must keep ORDER assertion, not weaken to membership) → dead-test deletion LAST.
- New coverage required: ELOOP/symlink-cycle no-echo (zero coverage today); canary-no-echo does NOT cover scaffold/copyIn branches — add cases BEFORE deleting run-boundary.test.ts.
- Mutation guards: behavioural (body-sentinel) + structural fitness (literal `collection.json` appears in zero `src/**` files) — both required.

## Fitness functions (design must include)

FIT-NEW-A no-ceiling-regrowth (no collection.json literal / ancestor-walk idiom in src; RunContext has no ceiling-shaped field). FIT-NEW-B closed-union reachability (every AuthoringReason member mintable from src). FIT-04 updated same commit. canary-no-echo extended to scaffold source branches. FIT-22 re-run post-rename. fit-40: verify corpus inventory not keyed on conformance/collection.json before deleting it.

## ADR

Supersedes ADR-0046 (+ amends ADR-0045 division of labor). Number: next free — 0073/0074/0075 collide on disk (pre-existing hygiene issue, flag to pm). Context must state: (a) charter L2 no-parse → presence-marker hack → inline incompatibility; (b) in-process author code is uncontainable; (c) BRC-02 covers by-reference only, by-value never had engine coverage. Alternatives rejected: dual-marker; ceiling=packageDir (REQ-PRC-01 forbids conflating anchors; breaks REQ-PRC-01.1 layout); lexical-guards-only-as-ceiling-replacement (owner declined as containment substitute, but owner ruling 3 keeps a lexical screen scoped to the SDK's own inline reads — different purpose, record the distinction).

## Owner rulings (2026-07-28, binding)

1. **Engine enforcement is LIVE today** (REQ-BRC-02 re-derivation shipped) — no sequencing constraint. (Explore's ENGINE-GATED flag resolved by owner assertion.)
2. **`validateDestinationLexical` SURVIVES**, re-homed as IR well-formedness (REQ-PRC-09 re-homed, not retired).
3. **Minimal lexical screen on the two inline-content read sites SURVIVES** (`../` + absolute, packageDir-anchored, no marker); symlink residual accepted in writing.
4. (Earlier) Direction: full removal of SDK-side containment; SDK generates IR, engine owns the boundary. Dual-marker and ceiling=packageDir superseded.
