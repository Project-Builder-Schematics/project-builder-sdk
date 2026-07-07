# Slices: Stage 3 — Dry-Run Plan Exposure

**Triage**: M · **Spec**: V2 signed · **Design**: rev 5 · **Total slices**: 3 (1 skeleton +
2 SPIDR). **Revision**: 4 — plan-verify iteration 3 closed by OWNER RULING (fixes + direct
ready); two clerical closures mirrored from design rev 5: `src/index.ts` PKG-01 propagation
note added to the reading list, and `dry-run-public-contract.test.ts` RED posture split
per-assertion (REQ-DRE-03.1 must-fail-first; REQ-DRE-04.* stay characterization). Boundaries,
coverage, DAG, seeds all unchanged from rev 3 (rev 3: run-end flush seed pins — GREEN path
only; rev 2: §4.6b enrichment; rev 1: initial).
**Test**: `bun test <path>` · full `bun test` · types `bun run typecheck`.

## Executor Context (mandatory)

> Handoff-plumbing appendix, mirroring stage-2's precedent (Judge B executor self-sufficiency).
> The ≤800-word artifact budget governs the slice blocks (unchanged); this section is exempt —
> deviation noted, not silent.

### Mandatory reading list (read BEFORE any slice)

REQ-IDs and constraint numbers in this file resolve against those artefacts; **this file is
the build ORDER, those are the build CONTENT**:

1. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/openspec/changes/stage-3-dry-run-exposure/design.md` — esp. §4.3 (data model), §4.4 (JSDoc content contract), §4.6 (test derivation), **§4.6b (Test Mechanics — pinned idioms; the PRIMARY executor reference for test mechanics — sdd-apply copies these, it does not invent)**, §4.8 (binding sequencing)
2. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/openspec/changes/stage-3-dry-run-exposure/spec.md`
3. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/openspec/changes/stage-3-dry-run-exposure/specs/dry-run-plan-exposure/spec.md` (NEW domain, REQ-DRE-01..04)
4. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/openspec/changes/stage-3-dry-run-exposure/specs/dry-run-plan-skeleton/spec.md` (MODIFIED domain, REQ-04 delta)
5. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/src/dry-run/plan.ts` (renderer to modify)
6. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/src/commons/index.ts` (author surface — append point at file END)
7. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/src/core/context.ts` (read-only — `currentContext()` throw REQ-DRE-01.4 inherits)
8. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/src/core/session.ts` (read-only — `pendingSnapshot()`)
9. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/src/index.ts` (read-only — bare `export * from "./commons/index.ts"` (PKG-01): the new public symbols propagate to the root `.` subpath with ZERO source edit; the same-slice `index.d.ts` baseline regen captures them)
10. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/dry-run/plan.test.ts` (current state — to be rebaselined)
11. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/fitness/fit-04-dts-semver-gate.test.ts` (baseline regen mechanism)
12. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/fitness/fit-06-example-jsdoc.test.ts` (`@example` gate, defining-site re-export resolution)
13. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/support/contract-fake.ts` (e2e engine fake — `new ContractFake({ seed })`; fail-closed enforcement lines: `:179` modify target must exist, `:198` rename source, `:221` copy source, `:239` move source)
14. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/support/spy-client.ts` (skeleton harness — `makeSpyClient(seed)`)
15. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/e2e/author-to-tree.e2e.test.ts` (e2e harness idiom source — in-fn `expect` precedent)
16. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/skeleton/handle-chaining.test.ts` (`makeSpyClient` idiom source)
17. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/types/typed-create.test.ts` (`expect-type` idiom source — never-invoked-arrow proofs)
18. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/plan-stage-3-dry-run-exposure/test/fake/directive-builders.ts` — **read to know it exists, DO NOT use**: its own header says its wire-literal builders exist for hand-built `ContractFake` input bypassing commons/context; stage-3's active-run tests buffer directives via author verbs, and `plan.test.ts` keeps its existing inline `Directive` literals (§4.6b)

### Binding constraints (verbatim from design §4.8 — violating any is a slicing/build defect)

1. The `dryRun` export + `DryRunEntry`/`DryRunVerb` re-exports + their `@example`s (FIT-06) land
   NO LATER than the slice introducing the consuming e2e/accessor tests — they must compile
   against the public surface in their own slice.
2. The `.d.ts` baseline regen (`bun run build`; `cp dist/{commons/index,index}.d.ts` →
   `test/fitness/dts-baseline/`) rides the SAME slice that adds the export — else FIT-04
   compares a stale baseline (silent gap, stage-1 lesson).
3. The `plan.ts` verb flip + `plan.test.ts` re-baseline + REQ-04.4 decoy ride together (the flip
   breaks the old wire-tag expectation).
4. Keep the `src/commons/index.ts` edit small and appended (accessor + imports/re-exports at
   file end) to minimise rebase against stage-2's `AuthoringError` clusters in the same file.
5. REQ-DRE-04's FULL JSDoc content — all four §4.4 elements INCLUDING the outside-run
   `@throws`/precondition note — AND its doc-obligation tests land in the SAME slice as the
   `dryRun` export. No false RED/GREEN window on a spec-mandated deliverable.
6. The `DryRunVerb`/`DryRunEntry` defining-site `@example`s (incl. the exhaustive-switch/
   `never`-arm example and the frozen-growth prose) ride the SAME slice that narrows and
   exports them.

Plus the suite-boundary rule: every slice leaves the suite GREEN and `tsc` clean at its
boundary. Cross-change guard: no slice touches `Session.flush`/attribution or `context.ts`
(stage-2's lane, ADR-0026) — `context.ts` is read ONLY, never edited.

### RED-posture taxonomy (definitions)

- **[must-fail-first]** — write the test, watch it fail for the right reason, then implement.
- **[characterization]** — pins a contract not yet observable any other way; RED waived with
  justification (e.g. a `.d.ts`/JSDoc scan whose target doesn't exist until the same slice
  writes it).
- **[permanent-fixture]** — an existing gate reconfirmed green, not newly authored red.

RED-locus annotations (rev 3, §4.6b — WHERE the red manifests, not just whether):

- **REQ-DRE-02 narrowing row** (`types/dry-run-verb.test.ts`): RED manifests at
  `bun run typecheck`, NOT at `bun test` runtime — the file runs green under `bun test`
  (never-invoked-arrow proofs are runtime no-ops) and carries its teeth in typecheck; it can
  only be authored in the slice where `DryRunVerb` exists (constraint 6).
- **D3 consistency row** (`vocabulary-consistency.test.ts`): must-fail-first is achieved by
  the RUNTIME halves — before the slice's code lands, `WIRE_TO_AUTHOR_VERB` is unexported
  (import fails) / wrong-valued (`delete→delete`), so the `toEqual` and values-bridge
  assertions fail for the right reason; the `expectTypeOf` half is compile-time carried.

### Harness idioms (pinned, design §4.6b (rev 3 + rev 4) — copy, don't invent)

- **Run-end flush safety rule (rev 4)**: `defineFactory` runs an UNCONDITIONAL `flush()` after
  `fn` returns (`context.ts:50`); every buffered directive is APPLIED by the fake at that
  moment, fail-closed — a rejecting run-end flush fails the test AFTER its in-fn `dryRun()`
  assertion already passed (`await run(...)` REJECTS). So: **seed EVERY modify target and every
  remove/rename/move/copy SOURCE not created in-run; NEVER seed a create target or a
  rename/move/copy DESTINATION** (fail-closed rejects from the other side).
  `makeSpyClient(seed)` constructs a real `ContractFake({ seed })` and delegates `emit` to it —
  enforcement is IDENTICAL across both harnesses; no per-harness divergence exists.
- **e2e** (`test/e2e/dry-run.e2e.test.ts`): mirror `test/e2e/author-to-tree.e2e.test.ts` —
  `const fake = new ContractFake({ seed: { "src/b.ts": "old" } })` for REQ-DRE-01.1 (modify
  target pre-exists; **never seed `src/a.ts`** — the run-end create would collide fail-closed);
  `const run = defineFactory<void>(async () => { …author verbs…; expect(dryRun()).toEqual([...]) })`
  with assertions INSIDE `fn` (the in-fn-`expect` precedent is the move-with-force e2e);
  `await run(undefined, { client: fake })`. REQ-DRE-01.5 seeds `{ "src/gone.ts": "…" }` so
  `find("src/gone.ts").remove()` targets a real file (delete is idempotent in the fake — the
  seed keeps the scenario honest).
- **skeleton** (`test/skeleton/dry-run-accessor.test.ts`): `const { client } =
  makeSpyClient({ "src/b.ts": "old" })` for REQ-DRE-01.3, from `test/support/spy-client.ts` —
  the `test/skeleton/handle-chaining.test.ts` precedent. REQ-DRE-01.2 needs no seed: `fn`
  buffers nothing and `Session.flush()` early-returns on an empty buffer (`session.ts:53`).
- **REQ-DRE-01.3 in-fn sequence**: `create("src/a.ts", …)` (NOT seeded) →
  `await find("src/a.ts").read()` (read triggers the flush, emptying `#pending`) →
  `modify("src/b.ts", "content")` →
  `expect(dryRun()).toEqual([{ verb: "modify", path: "src/b.ts" }])`; the run-end flush
  applies the modify against the seeded file and resolves.
- **REQ-DRE-01.4**: calls `dryRun()` OUTSIDE any run —
  `expect(() => dryRun()).toThrow(…substring…)` — no run, no flush, no harness needed.

### Load-bearing literals (copied exactly from the signed spec/design — do not paraphrase)

- **`DryRunVerb` (six values)**: `"create" | "modify" | "remove" | "rename" | "move" | "copy"`.
- **`WIRE_TO_AUTHOR_VERB` map**: `create→create, modify→modify, delete→remove, rename→rename,
  move→move, copy→copy` — LOCAL to `src/dry-run/**`, never imported from stage-2's
  `authoring-error.ts` (ADR-0024/0025). Rev 3: it is an **EXPORTED symbol from
  `../../src/dry-run/plan.ts`** so the consistency test can assert the map object itself —
  test-only reach, NOT re-exported by any barrel or `./commons`; per design §4.7 this export
  touches NO gate (not in any FIT-04 baselined file, not scanned by FIT-06, unreachable to
  package consumers — no `./dry-run` subpath).
- **`RATIFIED_AUTHOR_VERBS`** (§4.6b): test-local as-const literal declared IN
  `vocabulary-consistency.test.ts` — `["create", "modify", "remove", "rename", "move", "copy"]
  as const` — the SINGLE source both halves of the consistency test anchor to (runtime
  `toEqual` on the exported map + values-bridge; compile-time
  `expectTypeOf<DryRunVerb>().toEqualTypeOf<(typeof RATIFIED_AUTHOR_VERBS)[number]>()`).
- **Type-test import path**: `test/types/dry-run-verb.test.ts` imports (type-only) from
  `../../src/commons/index.ts` — deliberately the PUBLIC re-export surface, NOT the `plan.ts`
  defining site (the pin is that the types survive re-export; §4.6b(3)).
- **`dryRun()` signature**: `dryRun(): DryRunEntry[]` = `dryRunPlan(currentContext().session.pendingSnapshot())` — zero-arg, no accessor-specific try/catch.
- **REQ-DRE-04 JSDoc assertion tokens** (design §4.4 table — the tokens ARE the contract):
  (a) `@example` block containing `dryRun()`, `defineFactory`, `entry.verb`, `entry.path`;
  (b) prose containing BOTH `pending` AND `read()`; (c) prose containing `verb` AND `path` AND
  the negation `no content or byte preview`; (d) `@throws` tag present AND substring
  `can only be used while a schematic is running`.
- **`package.json#exports` key set**: stays exactly `[".", "./commons", "./conformance"]`
  (FIT-09, ADR-0014) — read-only, no new subpath.
- **REQ-DRE-01.1 exact expectation**: `[{verb:"create",path:"src/a.ts"},{verb:"modify",path:"src/b.ts"}]`.
  Seed pin (rev 4): `seed: { "src/b.ts": "old" }` — **never seed `src/a.ts`** (the run-end
  create would collide fail-closed).
- **REQ-DRE-01.5 exact expectation**: `[{verb:"remove",path:"src/gone.ts"}]` from `find("src/gone.ts").remove()`.
- **REQ-DRE-01.3 exact expectation**: after `create(a)` → `find(a).read()` (flush) → `modify(b)`,
  `dryRun()` returns exactly `[{verb:"modify",path:"src/b.ts"}]` — `src/a.ts` absent.
- **REQ-04.4 decoy**: single `delete` op → `verb` EXACTLY `"remove"`, NOT `"delete"`.
- **Outside-run throw substring**: `"can only be used while a schematic is running"` (unchanged
  by this change; `context.ts:20-24`, ADR-0026 defers the enumeration fix as a standalone
  post-merge followup).

---

## S-000: Walking Skeleton — Author Reaches the Buffered Plan in Author Vocabulary

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers** (16): REQ-DRE-01.1, REQ-DRE-01.5, REQ-DRE-02.1, REQ-DRE-02.2, REQ-DRE-02(narrowing),
REQ-DRE-03.1, REQ-DRE-03.2, REQ-DRE-04.1–.3, REQ-DRE-04(d, rev2), REQ-04.1–.4, D3 map consistency

**Acceptance**: GIVEN a run that buffers `create("src/a.ts",…)`+`modify("src/b.ts",…)` then calls
`find("src/gone.ts").remove()` WHEN `dryRun()` is called from `@pbuilder/sdk/commons` THEN it
returns author-vocabulary entries including `verb:"remove"` (never `"delete"`); the regenerated
`.d.ts` names neither `Directive` nor `pendingSnapshot`; `DryRunVerb`/JSDoc contracts hold.

### Tasks
- [must-fail-first] `plan.ts`: EXPORTED `WIRE_TO_AUTHOR_VERB` map (test-only reach, §4.6b),
  `export type DryRunVerb`, narrow `DryRunEntry.verb`, defining-site `@example`s (exhaustive
  switch + frozen-growth prose), header rewrite (retire "§4.4 wire-tag")
- [must-fail-first] `plan.test.ts`: rebaseline delete→remove (REQ-04.2), add REQ-04.4 decoy,
  rewrite doc comment (keeps inline `Directive` literals — no `directive-builders.ts`)
- [must-fail-first] `vocabulary-consistency.test.ts`: create — §4.6b(1) hybrid: runtime
  `toEqual` on the exported map + `expectTypeOf<DryRunVerb>` + values-bridge, all anchored to
  the test-local `RATIFIED_AUTHOR_VERBS` literal
- [characterization] `dry-run/index.ts`: barrel `export type { DryRunVerb }`
- [must-fail-first] `commons/index.ts`: append `dryRun()` accessor + full REQ-DRE-04 JSDoc
  (all 4 elements incl. outside-run `@throws`) + two-step type re-exports (file END)
- [must-fail-first] `e2e/dry-run.e2e.test.ts`: create (REQ-DRE-01.1 + REQ-DRE-01.5; §4.6b
  (rev 3 + rev 4) harness — REQ-DRE-01.1 uses the pinned
  `new ContractFake({ seed: { "src/b.ts": "old" } })` (**never seed `src/a.ts`**), in-fn
  `expect`, 01.5 seeds `src/gone.ts`)
- [per-assertion, design rev 5 §4.6] `skeleton/dry-run-public-contract.test.ts`: create —
  REQ-DRE-03.1 export-presence assertion is [must-fail-first] (genuine RED against the
  pre-regen baseline / missing export); the `.d.ts` scans REQ-DRE-02.1/.2 and the JSDoc token
  scans REQ-DRE-04.1–.3 + (d) stay [characterization]
- [characterization] `types/dry-run-verb.test.ts`: create (narrowing + never-arm exhaustive
  switch; §4.6b(3) idiom — type-only imports from `../../src/commons/index.ts`, RED at
  `bun run typecheck`, not `bun test`)
- [permanent-fixture] confirm FIT-09 (REQ-DRE-03.2), FIT-06, `no-import.test.ts` stay green
- regen `dts-baseline/{commons.index,index}.d.ts` (`bun run build` + cp, constraint 2)

---

## S-001: Outside-Run Propagation — No Accessor-Specific Fallback

**Scope**: happy-path · **Dimension**: P (Path — failure path vs the in-run happy path) ·
**Requires**: S-000
**Covers** (1): REQ-DRE-01.4

**Acceptance**: GIVEN `dryRun()` is called with no active `defineFactory` run WHEN it executes
THEN it throws the exact same error `currentContext()` raises for any other verb (substring
`can only be used while a schematic is running`) — no accessor-specific try/catch or fallback.

### Tasks
- [must-fail-first] `skeleton/dry-run-accessor.test.ts`: create — REQ-DRE-01.4 case only
  (§4.6b: `expect(() => dryRun()).toThrow(…substring…)` OUTSIDE any run — no harness needed)

---

## S-002: Buffer-State Variants — Empty and Post-Flush Temporal Contract

**Scope**: happy-path · **Dimension**: D (Data — buffer-state variants: empty vs
populated-since-last-flush; no new logical path) · **Requires**: S-001 (soft — shared file,
sequencing only, no logical coupling)
**Covers** (2): REQ-DRE-01.2, REQ-DRE-01.3

**Acceptance**: GIVEN a run with no buffered directive WHEN `dryRun()` is called THEN it returns
`[]`. GIVEN a run that buffers `create(a)`, flushes via `find(a).read()`, then buffers
`modify(b)` WHEN `dryRun()` is called THEN it returns exactly `[{verb:"modify",path:"src/b.ts"}]`
— `src/a.ts` absent (already flushed).

### Tasks
- [must-fail-first] `skeleton/dry-run-accessor.test.ts`: extend — REQ-DRE-01.2 + REQ-DRE-01.3
  cases (§4.6b (rev 3 + rev 4): 01.3 uses `makeSpyClient({ "src/b.ts": "old" })` and the pinned
  in-fn create → `await read()` flush → modify → assert-single-entry sequence; the run-end
  flush applies the modify against the seeded file and resolves; 01.2 needs no seed)

---

## Build Order

| Order | Slice | Note |
|---|---|---|
| 1 | S-000 | implicit blocker for all; delivers the full author-visible capability + vocabulary fix + public-contract/doc gates in one pass (design §4.8 constraints force near-total consolidation) |
| 2 | S-001 | requires S-000 |
| 3 | S-002 | soft-requires S-001 (shared file `dry-run-accessor.test.ts` — sequencing only, mirrors stage-2's S-001/S-002 precedent) |

## Coverage Check

16 + 1 + 2 = **19/19** design §4.6 Test Derivation rows mapped (16 signed-spec V2 scenarios +
2 design-added rows [narrowing pin, D3 map consistency] + 1 rev-2-added JSDoc row), no
orphans/duplicates. The sole e2e integration scenario (REQ-DRE-01.5) is traceable to exactly
one slice (S-000).

## Deviations Flagged (not silent)

1. **Walking skeleton retained despite the launch brief's "no walking-skeleton mandate" for M.**
   The `sdd-slice` skill mandates S-000 unconditionally ("no exceptions for M, L, or XL"); it is
   also the only cut that satisfies design §4.8 constraints 1/5/6 simultaneously (export +
   vocabulary + full JSDoc + doc-obligation tests must co-land), so it is not extra ceremony —
   it IS the natural first vertical slice here.
2. **Only 3 total slices (skeleton + 2), at the low end of the 2–4 M target.** Design's binding
   constraints force nearly the entire feature into S-000; the two remaining REQs (01.2/.3/.4)
   are accessor-mechanism responses over already-shipped S-000 behavior, not new logical paths —
   splitting them further would fragment one test file without adding real decomposition value.
3. **`skeleton/dry-run-accessor.test.ts` is split across S-001 (create) and S-002 (extend)** —
   same file, sequenced to avoid churn, no logical coupling — identical precedent to stage-2's
   S-001/S-002 sharing `error-attribution.test.ts`.
