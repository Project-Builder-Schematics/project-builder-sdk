# Design: stage-3-dry-run-exposure

**Spec**: V2 (signed, owner, 2026-07-06 — accessor name `dryRun` ratified) · **Triage**: M
**Persona lens**: synthesis (architect + tech-writer join per triage Condition 2)
**Architecture impact**: **additive**
**Revision**: 5 — plan-verify iteration 3 closed by OWNER RULING (2026-07-06, verify-plan-3.md):
two clerical closures, no iteration 4. (1) Umbrella propagation recorded as normative fact:
`src/index.ts` is a bare `export * from "./commons/index.ts"` (verified; PKG-01 / ADR-0009 header
comment) — root `.` reachability of `dryRun`/`DryRunEntry`/`DryRunVerb` requires ZERO source edit,
symbols propagate automatically, and the same-slice `index.d.ts` regen captures them; a
pre-existing consequence of the umbrella design, not new scope. `src/index.ts` added to the
Read-only rows; the `index.d.ts` regen row carries the fact. (2) REQ-DRE-03.1 RED posture
reconciled PER-ASSERTION within `dry-run-public-contract.test.ts`: the export-presence assertion is
genuine must-fail-first; the REQ-DRE-04.* JSDoc-scan assertions in the same file remain
characterization. Nothing else changed.
**Revision**: 4 — plan-verify iteration 2, one surgical §4.6b amendment (Judge B): the pinned
REQ-DRE-01.1/01.3 sequences buffered `modify("src/b.ts", …)` against a never-created, never-seeded
path — `defineFactory`'s UNCONDITIONAL run-end `flush()` (`context.ts:50`) would hit `ContractFake`'s
modify-target-existence enforcement (`contract-fake.ts:179`) and REJECT the run AFTER the in-fn
assertion already passed. §4.6b now pins per-sequence seeds, a general seed rule (seed every modify
target; NEVER seed a create target — fail-closed collision rejects from the other side), records
that `makeSpyClient` delegates `emit` to a real `ContractFake` (identical enforcement — no
per-harness divergence), and documents the flush-safety sweep of EVERY pinned sequence (01.2 safe:
`session.ts:53` empty-flush early return; 01.4: no run, no flush; 01.5: delete idempotent, seed
kept). Seeding chosen over a `.rejects` wrapper — justified inline. No REQ, slice-boundary, ADR, or
impact change.
**Revision**: 3 — plan-verify iteration 1 (Judge A clean; Judge B, simulated executor: 3
question-technical items, all routed here). Test mechanics pinned normatively in the NEW §4.6b:
(1) `WIRE_TO_AUTHOR_VERB` becomes an EXPORTED const from `plan.ts` — not re-exported by the dry-run
barrel or `./commons`, zero FIT-04/FIT-06 impact (argued in §4.7) — with the consistency test's
exact import lines and assertion shapes (runtime map half + compile-time `expectTypeOf` half over
one shared ratified literal); (2) run-harness convention pinned: e2e mirrors
`author-to-tree.e2e.test.ts` (raw `ContractFake` + `defineFactory`, assertions inside `fn`),
skeleton uses `makeSpyClient` per `handle-chaining.test.ts`; `test/fake/directive-builders.ts`
deliberately NOT used (wire-literal builders are for hand-built fake input, not ambient runs);
(3) `test/types/dry-run-verb.test.ts` follows the `typed-create.test.ts`/`wire-content-string.test.ts`
idiom — bun-test blocks + `expectTypeOf` in never-invoked arrows, importing from
`src/commons/index.ts` to pin the PUBLIC surface; RED manifests under `bun run typecheck`. File
Changes gained two Read-only harness rows. Nothing else changed.
**Revision**: 2 — council iteration (architect + tech-writer, blind, both approve-with-notes):
2 majors (outside-run compensating JSDoc — precondition + `@throws` + doc-test pin; JSDoc CONTENT
and assertion tokens pinned per symbol — the tokens ARE the contract) and 4 minors (`DryRunVerb`
exhaustive-switch `@example` + frozen-growth prose; `plan.ts` header back-pointer to the public
`dryRun()` name; ADR-0026 followup re-registered as a standalone post-merge pending-change by
default; §4.10 refresh-record note) folded in. Rev-1 approach, boundaries, the defining-site-import
shape, and the `additive` call were verified by both lenses — unchanged. (Rev 1 — first draft.)

## 4.1 Architecture Overview

Stage 3 makes the already-complete pure renderer (`src/dry-run/plan.ts`) reachable by authors, and
corrects its output to the author vocabulary its own signed spec (`dry-run-plan-skeleton` REQ-04)
always mandated. Two moves, no new layer, no boundary crossed that the handle types do not already
cross:

1. **Ambient exposure (`dryRun`)** — a zero-argument accessor added to `src/commons/index.ts`:
   `dryRun(): DryRunEntry[]` returns `dryRunPlan(currentContext().session.pendingSnapshot())`. It
   sources its input ambiently via `currentContext()` — the identical idiom every author verb already
   uses — so it needs no snapshot argument and no `Session`/`context.ts` edit. `pendingSnapshot()` is
   consumed unchanged (read-only; `Session` mutation is stage-2's lane). The wire snapshot
   (`readonly Directive[]`) is consumed INSIDE the body and never appears in the accessor's signature,
   so it never reaches the public `.d.ts` (REQ-DRE-02).

2. **Vocabulary conformance (`plan.ts`)** — the renderer today emits the wire tag `verb: "delete"`
   for the delete op under a retired "design §4.4" note. This change applies a frozen LOCAL 6-entry
   wire→author map so the delete op renders `verb: "remove"`; the other five are identity. The map is
   duplicated local to `src/dry-run/**` and NEVER imported from stage-2's
   `src/core/authoring-error.ts` (the no-import fitness forbids core imports in `src/dry-run/**`, and
   cross-importing would couple two independently-scheduled builds). A consistency test gates the map
   against the ratified six-verb set.

The accessor is exposed by adding a named export to the EXISTING `./commons` subpath — no new
`package.json#exports` key (ADR-0014 keeps exactly three). `DryRunEntry` (and the newly narrowed
`DryRunVerb`) are author-facing DATA types that cross the ADR-0009 core boundary the same way
`FoundHandle`/`WritableHandle` already do; kit machinery does not. `plan.ts` stays AST-blind and
core-blind (one type-only `Directive` import), so `test/dry-run/no-import.test.ts` stays green.

The commons edit is deliberately small and APPENDABLE (accessor + its imports/re-exports added at the
end of the file) to minimise rebase pain against stage-2's parallel `AuthoringError` re-export
clusters in the same file.

## 4.2 File Changes (contract with sdd-slice)

| Path | Action | Purpose |
|---|---|---|
| `src/dry-run/plan.ts` | Modify | frozen LOCAL `export const WIRE_TO_AUTHOR_VERB: Record<Directive["op"], DryRunVerb>` map (delete→remove, else identity; EXPORTED for the consistency test, rev 3 §4.6b — NOT re-exported by any barrel); `dryRunPlan` reads it; narrow `DryRunEntry.verb` `string`→`DryRunVerb`; add `export type DryRunVerb`; add defining-site `@example` on `DryRunEntry` AND `DryRunVerb` (FIT-06 resolves re-exports here) — `DryRunVerb`'s `@example` demonstrates the exhaustive `switch(verb)` with a `never` default arm and its prose notes the six members are FROZEN (growth = MAJOR, ADR-0025); header comment rewritten to state the frozen table, RETIRE the "§4.4 wire-tag" rationale, and add a one-line back-pointer: this internal `dryRunPlan(snapshot)` renderer is surfaced to authors as the zero-arg `dryRun()` accessor in `src/commons` — renderer edits are publicly visible under that name. Signature of `dryRunPlan` unchanged |
| `src/dry-run/index.ts` | Modify | barrel gains `export type { DryRunVerb } from "./plan.ts"` (already re-exports `dryRunPlan`/`DryRunEntry`); deliberately does NOT re-export `WIRE_TO_AUTHOR_VERB` (test-only reach via direct `plan.ts` import, rev 3) |
| `src/commons/index.ts` | Modify | add `dryRun(): DryRunEntry[]` = `dryRunPlan(currentContext().session.pendingSnapshot())`; runtime `import { dryRunPlan } from "../dry-run/index.ts"`; `import type { DryRunEntry, DryRunVerb } from "../dry-run/plan.ts"` (DEFINING site, so FIT-06 + `.d.ts` emit resolve there) + two-step `export type { DryRunEntry, DryRunVerb }`. Full REQ-DRE-04 JSDoc on `dryRun` per the §4.4 content contract: in-run `@example` reading `verb`/`path`, temporal-contract prose, shape-guarantee prose, PLUS the outside-run compensating note — precondition line (call within an active `defineFactory` run, like every other `./commons` verb) and `@throws` stating the standard "…can only be used while a schematic is running…" error (which does not yet name `dryRun`; ADR-0026 followup). Appended at end of file |
| `package.json` | Read-only | `#exports` UNCHANGED — no new subpath; `./commons` module surfaces one more named export (REQ-DRE-03) |
| `src/index.ts` | Read-only | NOT edited (rev 5, owner ruling) — the umbrella is a bare `export * from "./commons/index.ts"` (PKG-01 / ADR-0009 header), so `dryRun`/`DryRunEntry`/`DryRunVerb` reach the root `.` subpath with ZERO source edit; root reachability is a pre-existing consequence of the umbrella design, not new scope |
| `src/core/session.ts` | Read-only | `pendingSnapshot()` consumed as-is (stage-2 owns `flush`/attribution) |
| `src/core/context.ts` | Read-only | NOT edited — outside-run message-omission deferred via standalone post-merge pending-change, compensated in `dryRun`'s JSDoc (ADR-0026) |
| `test/dry-run/plan.test.ts` | Modify | delete-op expectation flips `"delete"`→`"remove"` (REQ-04.2); add REQ-04.4 decoy (single delete → verb EXACTLY `"remove"`, NOT `"delete"`); doc comment (`:5-14`) rewritten to the frozen table, retiring "§4.4 wire tag" prose |
| `test/dry-run/vocabulary-consistency.test.ts` | Create | D3 consistency test per §4.6b mechanism: runtime `toEqual` on the exported `WIRE_TO_AUTHOR_VERB` (exact six rows) + compile-time `expectTypeOf<DryRunVerb>` equality against the shared `RATIFIED_AUTHOR_VERBS` literal + runtime values-vs-literal bridge (drift guard) |
| `test/dry-run/no-import.test.ts` | Read-only | stays green — `plan.ts` gains only pure data + type-only import (REQ-05) |
| `test/e2e/dry-run.e2e.test.ts` | Create | REQ-DRE-01.1 (in-run buffers create+modify → exact entries) + REQ-DRE-01.5 (`find().remove()` → `verb:"remove"` through the accessor, cross-domain proof). Harness per §4.6b: raw `ContractFake` + `defineFactory`, assertions inside `fn` (mirrors `author-to-tree.e2e.test.ts`) |
| `test/skeleton/dry-run-accessor.test.ts` | Create | REQ-DRE-01.2 (empty→`[]`), REQ-DRE-01.3 (post-flush temporal, distinguishable entries), REQ-DRE-01.4 (outside-run propagates `currentContext()`'s throw, no accessor-specific catch). Harness per §4.6b: `makeSpyClient` (mirrors `handle-chaining.test.ts`) |
| `test/skeleton/dry-run-public-contract.test.ts` | Create | `.d.ts` scan: REQ-DRE-02.1 (no `Directive`/`pendingSnapshot` in `commons.index.d.ts`), REQ-DRE-02.2 (`dryRun` reads as `(): DryRunEntry[]`), REQ-DRE-03.1 (named export present); JSDoc scan of `src/commons/index.ts`: REQ-DRE-04.1/.2/.3 asserting the EXACT token sets pinned in §4.4, plus the outside-run doc pin (`@throws` tag + the "can only be used while a schematic is running" substring) |
| `test/types/dry-run-verb.test.ts` | Create | REQ-DRE-02 narrowing pin per §4.6b idiom: bun-test blocks + `expectTypeOf` in never-invoked arrows, importing types from `src/commons/index.ts` (pins the PUBLIC surface); `DryRunEntry.verb` is `DryRunVerb` not `string`; exhaustive `switch(verb)` with a `never` default arm compiles |
| `test/support/contract-fake.ts` | Read-only | e2e harness client (rev 3, §4.6b) — normative engine counterpart, passed as `{ client: fake }` |
| `test/support/spy-client.ts` | Read-only | skeleton harness (rev 3, §4.6b) — `makeSpyClient(seed)` → `{ client, emitted }` wrapping `ContractFake` |
| `test/fake/directive-builders.ts` | Read-only | NOT used by stage-3 tests (rev 3) — wire-literal builders for hand-built fake input; stage-3's active-run tests buffer via author verbs, and `plan.test.ts` keeps its existing inline literals |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Read-only | REQ-DRE-03.2 — key set stays `[".", "./commons", "./conformance"]`, green |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Read-only | additive; green after baseline regen (flags removals only) |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Read-only | covers `dryRun`/`DryRunEntry`/`DryRunVerb` unchanged via re-export resolution to `plan.ts` |
| `test/fitness/dts-baseline/commons.index.d.ts` | Modify | regen — adds `dryRun`, `DryRunEntry`, `DryRunVerb` (additive) |
| `test/fitness/dts-baseline/index.d.ts` | Modify | regen — the bare `export *` umbrella propagates the new exports to the root `.` subpath automatically (rev 5 normative fact: no `src/index.ts` edit exists or is needed); the same-slice regen captures them |
| `openspec/decisions/0024..0026-*.md` | Create | 3 ADRs below (materialized at archive) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author previews the buffered plan before flush | Create | REQ-DRE-01.1, REQ-DRE-01.5 | `test/e2e/dry-run.e2e.test.ts` (new) | first dry-run author journey; REQ-DRE-01.5 proves `remove` (never `delete`) surfaces THROUGH the accessor, spanning both domains |

REQ-DRE-01.2/.3/.4 are accessor-mechanism responses verified at integration (`test/skeleton`), not
separate author journeys — mirroring the stage-1/stage-2 seam-behavior precedent.

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `commons/index.ts` (author surface) | extend | new read-only `dryRun` accessor via the existing `currentContext()` idiom; re-exports author DATA types `DryRunEntry`/`DryRunVerb` | aligns — same core→commons crossing as `FoundHandle`/`WritableHandle` (ADR-0009) |
| `dry-run/plan.ts` (SEAM-02 renderer) | modify | value-level vocabulary conformance (delete→`remove`) + `verb` type narrowed; shape `{verb,path}` and the AST/core-blind boundary unchanged | aligns — the seam CONTRACT (author vocabulary, REQ-04) is unchanged; code was violating it |
| `dry-run/index.ts` (barrel) | modify | re-export the new `DryRunVerb` type | aligns |
| `package.json#exports` (public API) | none | no subpath added; `./commons` surfaces one more named export | aligns (ADR-0014) |
| `core/session.ts` (`pendingSnapshot`) | none | consumed read-only, unchanged | aligns |
| `core/context.ts` (`currentContext`) | none | outside-run message deferred to a post-merge pending-change, not edited here; JSDoc compensates | aligns (ADR-0026) |
| fitness / dts-baseline layer | modify | regen `commons.index.d.ts` + `index.d.ts`; new dry-run/skeleton tests join their canonical dirs | aligns |

No `deviates` rows. Impact derivation: every action is `extend`/`modify`-within-boundary or
`none`; the `plan.ts` modify is a value-level conformance correction (no signature/shape/boundary
change), and the `commons` extend adds an export to an existing layer → **additive** (see 4.10).

## 4.3 Data Model

```ts
// src/dry-run/plan.ts (LOCAL — never imported from stage-2's authoring-error.ts)
export type DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy";
export interface DryRunEntry { verb: DryRunVerb; path: string; } // verb narrowed string→DryRunVerb
export const WIRE_TO_AUTHOR_VERB: Record<Directive["op"], DryRunVerb> = {
  create: "create", modify: "modify", delete: "remove",
  rename: "rename", move: "move", copy: "copy",
}; // frozen six-row map — delete→remove, else identity. EXPORTED for the consistency test
// (rev 3, §4.6b); NOT re-exported by src/dry-run/index.ts or ./commons — test-only reach.
// The Record<Directive["op"], DryRunVerb> annotation is itself load-bearing: totality over
// wire ops and value-membership in DryRunVerb are compile-enforced at the declaration.
export function dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[]; // signature UNCHANGED

// src/commons/index.ts (public via ./commons)
export function dryRun(): DryRunEntry[]; // zero-arg; = dryRunPlan(currentContext().session.pendingSnapshot())
export type { DryRunEntry, DryRunVerb }; // two-step re-export (author DATA types cross ADR-0009)
```

`path` extraction is unchanged (primary source path per op: `pathTemplate` for create, `path` for
modify/delete/rename/move, `from` for copy). `dryRun` performs no fallback: it lets
`currentContext()` throw outside a run (REQ-DRE-01.4).

## 4.4 Interface Contracts

Public (`@pbuilder/sdk/commons`, additive per FIT-04): function `dryRun(): DryRunEntry[]`; types
`DryRunEntry`, `DryRunVerb`.

- **Return-type boundary (REQ-DRE-02)**: `dryRun`'s signature is `(): DryRunEntry[]` — `Directive`
  and `pendingSnapshot` appear only in the body, so the emitted `commons.index.d.ts` names neither.
- **Re-export form**: two-step `import type { … } from "../dry-run/plan.ts"; export type { … };`.
  Types are imported from the DEFINING module (`plan.ts`), not the `index.ts` barrel, so both FIT-06's
  re-export resolver and tsc's `.d.ts` emitter reach the defining-site JSDoc/declaration (verified
  against the current `commons.index.d.ts` baseline shape).
- **Outside-run**: `dryRun` propagates whatever `currentContext()` raises — no accessor-specific
  try/catch or empty-array fallback (REQ-DRE-01.4). The message-omission fix is deferred (ADR-0026);
  the JSDoc COMPENSATES for the deferral (element (d) below) so the author is warned at the surface
  they actually read.

**JSDoc content contract (REQ-DRE-04 + outside-run note — the assertion tokens ARE the contract).**
The doc-obligation test (`dry-run-public-contract.test.ts`) asserts these exact tokens against
`dryRun`'s defining-site JSDoc; sdd-apply writes prose containing them, not prose "about" them:

| Element | Content (normative draft) | Required assertion tokens |
|---|---|---|
| (a) `@example` (REQ-DRE-04.1) | in-run usage: `defineFactory(() => { create("src/index.ts", { template, options }); find("src/legacy.ts").remove(); for (const entry of dryRun()) { console.log(entry.verb, entry.path); // "create src/index.ts", then "remove src/legacy.ts" } })` | `@example` block containing `dryRun()`, `defineFactory`, `entry.verb`, `entry.path` |
| (b) temporal (REQ-DRE-04.2) | "The plan reflects STILL-PENDING directives only — the honest answer to 'what will this run still emit', not 'what has this run emitted in total'. A `read()` (or any flush) empties the pending buffer, so directives already flushed no longer appear." | prose contains BOTH `pending` AND `read()` (flush reference) |
| (c) shape (REQ-DRE-04.3) | "Entries carry `verb` and `path` only — no content or byte preview." | prose contains `verb` AND `path` AND the negation `no content or byte preview` |
| (d) outside-run (compensating, rev 2) | precondition: "Call it inside an active `defineFactory` run, like every other `./commons` verb." + `@throws` "outside a run it throws the standard error — '…can only be used while a schematic is running…' (the message does not yet name `dryRun`; see the ADR-0026 followup)." | `@throws` tag present AND substring `can only be used while a schematic is running` |

`DryRunVerb`'s defining-site `@example` (`plan.ts`) demonstrates the exhaustive `switch (entry.verb)`
over all six members with a `default: { const exhaustive: never = entry.verb; }` arm (mirroring
stage-2's `AuthoringVerb` example and consistent with `test/types/dry-run-verb.test.ts`); its prose
carries one line: the six members are FROZEN — adding a member is a MAJOR event (ADR-0025).
- **Additivity argued out-of-band** (FIT-04 same-change-regen blindness, stage-1 lesson): `dryRun`,
  `DryRunEntry`, `DryRunVerb` are net-new symbols; no existing `./commons` export is removed,
  renamed, or narrowed — additive by construction, independent of the gate.

## 4.5 Architecture Decisions (ADRs)

### ADR-0024: Dry-run exposure shape + author-verb vocabulary (★ D3)
**Status**: Proposed. **Context**: The pure `dryRunPlan` renderer is complete but unreachable by
authors (O2 line 5 unmet), and it emits the wire tag `delete` where the author verb is `remove`. D3
must fix BOTH the exposure shape and the vocabulary without touching `Session`, `context.ts`
lifecycle, or stage-2's lane. **Decision — owner-ratified**: (1) EXPOSURE — fold a zero-argument
read-only accessor `dryRun()` into `./commons` over `currentContext().session.pendingSnapshot()` →
`dryRunPlan`; no new subpath. (2) VOCABULARY — render the author verb for every op (`remove`, never
wire `delete`) via a frozen six-row map. (3) MAP LOCATION — the map is DUPLICATED local to
`src/dry-run/**`, gated by a consistency test; single-source extraction is a post-merge followup.
**Consequences**: (+) matches the dominant author-verb idiom; zero new subpaths; `plan.ts` stays
core-blind; `Session`/`context.ts` untouched. (−) a second copy of the wire→author map (drift risk,
mitigated by the consistency test + registered extraction followup). **Alternatives**:
- *Runner-level dry-run mode* — rejected: reaches into `context.ts`'s all-or-nothing transaction
  boundary, triggering triage Condition 1 (re-triage to L); disproportionate for exposure-only glue.
- *New `./dry-run` subpath exporting `dryRunPlan(snapshot)`* — rejected: a standalone renderer is
  useless to an author with no snapshot, and grabbing ambient context needs a runtime core import
  that `no-import.test.ts` forbids inside `src/dry-run/**`; also a permanent 4th semver subpath
  (ADR-0014 deviation).
- *Keep wire-tag `delete` vocabulary* — rejected: ships two vocabularies for one operation
  (`remove` in stage-2 errors, `delete` in the dry-run plan) to the same author in the same window.
- *Shared map in `src/core`* — rejected: `plan.ts` is core-blind (no-import fitness); couples two
  independently-scheduled builds and reopens stage-2's frozen design.

### ADR-0025: Narrow `DryRunEntry.verb` to a public `DryRunVerb` union
**Status**: Proposed. **Context**: `DryRunEntry.verb` is `string`, hiding the six-verb runtime
guarantee the frozen map establishes; an author's `switch(entry.verb)` gets no exhaustiveness help.
The type is not yet public (dead code), so this is the moment to shape it. **Decision**: narrow
`verb` to a LOCAL exported union `DryRunVerb = "create"|"modify"|"remove"|"rename"|"move"|"copy"`
defined in `plan.ts`, exported through `./commons` with a defining-site `@example` that demonstrates
the exhaustive `switch(verb)`/`never`-arm idiom and states in prose that the six members are frozen
(growth = MAJOR) — the rationale surfaces where the author reads it, not only in this ADR. It
intentionally DUPLICATES stage-2's identical `AuthoringVerb` (same values, different module) — never
imported across, same no-coupling rule as the map. **Consequences**: (+) compile-time exhaustiveness for
authors; consistent with `AuthoringVerb`; additive (net-new public type, FIT-04 flags no removal).
(−) a new semver-locked type whose growth is a MAJOR event — acceptable because the six wire ops are
already frozen (ADR-0013); (−) second `DryRunVerb`/`AuthoringVerb` copy (same extraction followup as
the map). **Alternatives**: *keep `string`* — rejected: hides the guarantee, no author benefit;
*import `AuthoringVerb` from stage-2 core* — rejected: no-import fitness + cross-build coupling.

### ADR-0026: Outside-run message-omission — defer via post-merge pending-change, do not edit `context.ts`
**Status**: Proposed. **Context**: `currentContext()`'s throw (`context.ts:20-24`) enumerates seven
verbs and omits `dryRun`; an author calling `dryRun()` outside a run gets an error listing every verb
except the one they called. The spec forbids shipping the omission by DEFAULT and offers three
resolutions. Stage-2 rewrites this exact throw site into an `AuthoringError`, relocating the prose
VERBATIM into its constructor — preserving the substring pin; generalising the enumeration is OUT of
stage-2's scope. **Decision — option (c)**: stage-3 does NOT edit `context.ts`; register a STANDALONE
post-merge pending-change (default owner: nobody's current lane — it targets the message wherever it
lives after both stages merge; target end-state: generalise the message away from a verb enumeration,
preserving the pinned "…can only be used while a schematic is running…" substring). REQ-DRE-01.4 pins
only that the SAME error propagates, not its text. Until the followup lands, `dryRun`'s JSDoc
COMPENSATES: a precondition line + `@throws` note stating the standard error will not name `dryRun`
(§4.4 element (d), doc-test-pinned) — the deferral is honest to the AUTHOR, not just the changelog.
**Consequences**: (+) stage-3 stays off the contended lifecycle file (honors triage Condition 1 + M
scope); no merge conflict with stage-2's verbatim relocation; the author is warned at the JSDoc
surface. (−) the enumeration omission ships until the pending-change lands — deliberate, recorded,
and doc-compensated, not silent. **Alternatives**: *(a) extend the enumeration* — rejected: edits the
contended throw AND re-introduces a verb list to keep in sync; *(b) generalise now* — rejected: still
edits the multi-line throw both stages touch → textual conflict with stage-2's verbatim relocation;
*assign the followup to stage-2's message work* — rejected: stage-2 relocates the enumeration
verbatim by design; generalisation is not in its scope, so "owned by stage-2" would orphan the fix.

## 4.6 Test Derivation

| REQ-ID | Scenario | Level | Test | RED posture |
|---|---|---|---|---|
| REQ-DRE-01.1 | in-run create+modify → exact entries | e2e | `test/e2e/dry-run.e2e.test.ts` | must-fail-first |
| REQ-DRE-01.2 | empty buffer → `[]` | integration | `test/skeleton/dry-run-accessor.test.ts` | must-fail-first |
| REQ-DRE-01.3 | reflects only post-flush directives (distinguishable) | integration | `test/skeleton/dry-run-accessor.test.ts` | must-fail-first |
| REQ-DRE-01.4 | outside-run propagates `currentContext()` throw | integration | `test/skeleton/dry-run-accessor.test.ts` | must-fail-first |
| REQ-DRE-01.5 | `find().remove()` → `verb:"remove"` via accessor | e2e | `test/e2e/dry-run.e2e.test.ts` | must-fail-first |
| REQ-DRE-02.1 | no `Directive`/`pendingSnapshot` in `.d.ts` | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-DRE-02.2 | accessor reads `(): DryRunEntry[]` | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-DRE-02 (narrowing) | `verb` is `DryRunVerb`; exhaustive `never` arm (§4.6b idiom; RED at `bun run typecheck`) | contract | `test/types/dry-run-verb.test.ts` | characterization |
| REQ-DRE-03.1 | `dryRun` is a named `./commons` export | architectural | `test/skeleton/dry-run-public-contract.test.ts` | must-fail-first — PER-ASSERTION (rev 5): the export-presence assertion runs RED against the missing export/pre-regen baseline and goes GREEN when export + regen land in the same slice; the REQ-DRE-04.* JSDoc-scan assertions in this SAME file remain characterization (their target text cannot exist before the JSDoc is written) |
| REQ-DRE-03.2 | `#exports` key set stays the three | architectural | `test/fitness/fit-09-*.test.ts` | permanent-fixture |
| REQ-DRE-04.1 | `@example` in-run — tokens: `@example` block with `dryRun()`, `defineFactory`, `entry.verb`, `entry.path` (§4.4a) | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-DRE-04.2 | temporal contract — tokens: `pending` AND `read()` both present (§4.4b) | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-DRE-04.3 | shape guarantee — tokens: `verb`, `path`, negation `no content or byte preview` (§4.4c) | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-DRE-04 (d, rev 2) | outside-run compensating doc — tokens: `@throws` tag + substring `can only be used while a schematic is running` (§4.4d) | architectural | `test/skeleton/dry-run-public-contract.test.ts` | characterization |
| REQ-04.1 | create directive → author vocabulary | unit | `test/dry-run/plan.test.ts` | characterization |
| REQ-04.2 | all six ops → author verbs (`remove` for delete) | unit | `test/dry-run/plan.test.ts` | must-fail-first |
| REQ-04.3 | write-only chain snapshot equals plan | integration | `test/dry-run/plan.test.ts` | characterization |
| REQ-04.4 | decoy: delete op → EXACTLY `remove`, NOT `delete` | unit | `test/dry-run/plan.test.ts` | must-fail-first |
| D3 map consistency | exported map `toEqual` six frozen rows; `expectTypeOf<DryRunVerb>` == ratified literal; values-bridge (§4.6b mechanism) | unit | `test/dry-run/vocabulary-consistency.test.ts` | must-fail-first |

REQ-03 / REQ-05 (UNCHANGED delta) remain covered by existing `test/skeleton/session.test.ts` and
`test/dry-run/no-import.test.ts` (both read-only). Every spec REQ-ID/scenario across both domains is
covered; the sole Create flow (REQ-DRE-01.1/.5) has its e2e rows.

## 4.6b Test Mechanics — pinned idioms (rev 3 + rev 4, plan-verify)

Normative answers to the three executor questions; sdd-apply copies these, it does not invent.
Rev 4 adds the run-end flush safety rule + per-sequence seeds under (2).

**(1) Vocabulary-consistency mechanism** — hybrid: runtime half on the EXPORTED map, compile-time
half on the type, both anchored to ONE shared ratified literal declared in the test:

```ts
// test/dry-run/vocabulary-consistency.test.ts
import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import { WIRE_TO_AUTHOR_VERB } from "../../src/dry-run/plan.ts";
import type { DryRunVerb } from "../../src/dry-run/plan.ts";

const RATIFIED_AUTHOR_VERBS = ["create", "modify", "remove", "rename", "move", "copy"] as const;

// (a) runtime — the map is EXACTLY the six frozen rows (delete→remove, identity elsewhere)
expect(WIRE_TO_AUTHOR_VERB).toEqual({
  create: "create", modify: "modify", delete: "remove",
  rename: "rename", move: "move", copy: "copy",
});
// (b) compile-time — DryRunVerb === the ratified set (type is erased; expect-type carries it)
const _verbSetProof = () => {
  expectTypeOf<DryRunVerb>().toEqualTypeOf<(typeof RATIFIED_AUTHOR_VERBS)[number]>();
};
void _verbSetProof;
// (c) runtime bridge — the map's VALUES equal the same ratified literal (set equality)
expect([...Object.values(WIRE_TO_AUTHOR_VERB)].sort()).toEqual([...RATIFIED_AUTHOR_VERBS].sort());
```

Rejected: an unexported map + indirect observation through `dryRunPlan` output (cannot assert the
map object itself — a hardcoded switch would pass); a separate runtime six-verb const in `plan.ts`
(second artifact to drift). The `Record<Directive["op"], DryRunVerb>` annotation already
compile-enforces key totality and value membership at the declaration; the test adds exact-value
and set-equality proof against the ratified literal.

**(2) Run-harness convention** (post-stage-1 /simplify helpers verified in-repo):

**Run-end flush safety rule (rev 4)** — `defineFactory` runs an UNCONDITIONAL `flush()` after `fn`
returns (`context.ts:50`); every buffered directive is APPLIED by the fake at that moment, fail-closed
(`contract-fake.ts`: modify target must exist `:179`; rename/move/copy sources must exist
`:198/:239/:221`; create/rename/move/copy targets must NOT exist unless `force`). A sequence whose
run-end flush rejects fails the test AFTER its in-fn `dryRun()` assertion already passed — the
rejection propagates `Session.flush` → defineFactory catch/discard → `await run(...)` REJECTS. So:
**seed EXACTLY the paths pre-existing state requires (every modify target; every remove/rename/move/
copy SOURCE not created in-run) and NEVER seed a create target or a rename/move/copy DESTINATION**.
`makeSpyClient(seed)` constructs a real `ContractFake({ seed })` and delegates `emit` to it —
enforcement is IDENTICAL across both harnesses; no per-harness divergence exists.

- **e2e** (`dry-run.e2e.test.ts`): mirror `test/e2e/author-to-tree.e2e.test.ts` — `const fake = new
  ContractFake({ seed })` (`test/support/contract-fake.ts`); `const run = defineFactory<void>(async
  () => { …author verbs…; expect(dryRun()).toEqual([...]) })` with assertions INSIDE `fn` (the
  in-fn-`expect` precedent is the move-with-force e2e); `await run(undefined, { client: fake })`.
  Per-sequence seeds (rev 4): **REQ-DRE-01.1** — `create("src/a.ts", …)` + `modify("src/b.ts", …)`
  needs `seed: { "src/b.ts": "old" }` (modify target pre-exists; `src/a.ts` NOT seeded — the
  run-end create would collide fail-closed). **REQ-DRE-01.5** — `seed: { "src/gone.ts": "…" }`
  (kept: delete is idempotent in the fake, so the run resolves either way; the seed keeps the
  scenario honest — removing a file that exists).
- **skeleton** (`dry-run-accessor.test.ts`): `const { client } = makeSpyClient(seed)` from
  `test/support/spy-client.ts` — the `test/skeleton/handle-chaining.test.ts` precedent. Per-sequence
  seeds (rev 4): **REQ-DRE-01.3** — `makeSpyClient({ "src/b.ts": "old" })`; in-fn sequence:
  `create("src/a.ts", …)` (NOT seeded) → `await find("src/a.ts").read()` (read triggers the flush,
  applying the create and emptying `#pending`) → `modify("src/b.ts", "content")` →
  `expect(dryRun()).toEqual([{ verb: "modify", path: "src/b.ts" }])`; the run-end flush then applies
  the modify against the seeded file and resolves. **REQ-DRE-01.2** — no seed needed: `fn` buffers
  nothing and `Session.flush()` early-returns on an empty buffer (`session.ts:53`). **REQ-DRE-01.4**
  calls `dryRun()` OUTSIDE any run — no run, no flush, no harness:
  `expect(() => dryRun()).toThrow(…substring…)`.
- **Posture choice (rev 4)**: seeding over a `.rejects` wrapper. The tests' teeth are the in-fn
  `dryRun()` assertions; awaiting the run's REJECTION would (a) smuggle an error-shape dependency
  into stage-3 tests while stage-2 is rewriting `AuthoringError` in parallel — exactly the coupling
  this change avoids everywhere else — and (b) assert behaviour the REQ scenarios never mention.
  A cleanly resolving run keeps the assertion surface exactly the scenarios' THEN clauses.
- `test/fake/directive-builders.ts` is NOT used: its wire-literal builders exist for hand-built
  `ContractFake` input (its own header says so); stage-3's active-run tests buffer directives via
  author verbs, and `plan.test.ts` keeps its existing inline `Directive` literals.

**(3) `test/types/dry-run-verb.test.ts` structure** — the `typed-create.test.ts` /
`wire-content-string.test.ts` idiom: bun-test `describe`/`test` blocks; `expectTypeOf` from
`expect-type`; proofs inside never-invoked arrows (`const _proof = () => {…}; void _proof;`).
Imports come from `../../src/commons/index.ts` (type-only) — pinning the PUBLIC re-export, not just
the defining module. Assertions: `expectTypeOf<DryRunEntry["verb"]>().toEqualTypeOf<DryRunVerb>()`;
the exhaustive `switch (entry.verb)` over the six members with `default: { const exhaustive: never
= entry.verb; }`. No `@ts-expect-error`/permissive-proof half is needed (positive pins only). Suite
demands: the file runs green under `bun test` (runtime no-ops) and carries its teeth in `bun run
typecheck` — the RED for this file manifests at TYPECHECK, and it can only be authored in the slice
where `DryRunVerb` exists (constraint 6, §4.8).

## 4.7 Fitness Functions

No NEW fitness function. This design relies on four existing gates:
- **FIT-06 `@example` gate** — `dryRun` (function in commons) and the re-exported `DryRunEntry`/
  `DryRunVerb` (resolved to `plan.ts` defining site) each carry an `@example`, landing in the SAME
  slice as the export or the gate goes red.
- **FIT-09 exact-subpath** (REQ-DRE-03.2) — key set stays `[".", "./commons", "./conformance"]`.
- **FIT-04 `.d.ts` semver gate** — additive; baselines regen in the export slice (flags removals only).
- **FIT-dry-run-no-import** (REQ-05) — `plan.ts` gains only a pure const map + type-only import → green.

The wire-type-leak check (REQ-DRE-02.1) is a `.d.ts` baseline scan in
`dry-run-public-contract.test.ts`, not a permanent fitness fixture — proportionate to M.

**Exported-map non-impact (rev 3)**: exporting `WIRE_TO_AUTHOR_VERB` from `plan.ts` touches NO gate.
FIT-04 diffs only the baselined files (`commons.index.d.ts`, `index.d.ts`, `conformance.index.d.ts`,
`core.*.d.ts`) — nothing under `dist/dry-run/` is baselined, and the map is not re-exported into any
baselined surface, so the regen delta is identical with or without the export. FIT-06 scans only the
`commons`/`conformance` barrels plus names THEY re-export — `WIRE_TO_AUTHOR_VERB` is not among them,
so no `@example` obligation attaches. `package.json#exports` maps no `./dry-run` subpath, so the
symbol stays unreachable to package consumers (same standing as every `src/core` module in the
shipped tarball — architecture.md Notes).

## 4.8 Migration / Rollout

No data, no migration, no flags. **Binding sequencing constraints** (sdd-slice owns the final cut):

1. The `dryRun` export + `DryRunEntry`/`DryRunVerb` re-exports + their `@example`s (FIT-06) land NO
   LATER than the slice introducing the consuming e2e/accessor tests — they must compile against the
   public surface in their own slice.
2. The `.d.ts` baseline regen (`bun run build`; `cp dist/{commons/index,index}.d.ts` →
   `test/fitness/dts-baseline/`) rides the SAME slice that adds the export — else FIT-04 compares a
   stale baseline (silent gap, stage-1 lesson).
3. The `plan.ts` verb flip + `plan.test.ts` re-baseline + REQ-04.4 decoy ride together (the flip
   breaks the old wire-tag expectation).
4. Keep the `src/commons/index.ts` edit small and appended (accessor + imports/re-exports at file
   end) to minimise rebase against stage-2's `AuthoringError` clusters in the same file.
5. (rev 2, council) REQ-DRE-04's FULL JSDoc content — all four §4.4 elements INCLUDING the
   outside-run `@throws`/precondition note — AND its doc-obligation tests land in the SAME slice as
   the `dryRun` export. No false RED/GREEN window on a spec-mandated deliverable.
6. (rev 2, council) The `DryRunVerb`/`DryRunEntry` defining-site `@example`s (including the
   exhaustive-switch/`never`-arm example and the frozen-growth prose) ride the SAME slice that
   narrows and exports them.

**Archive-time followups to register in `pending-changes`**: (a) single-source wire→author map
extraction once stage-2 and stage-3 both merge; (b) `DryRunVerb`/`AuthoringVerb` duplication
convergence (same extraction); (c) outside-run message generalization — a STANDALONE post-merge
pending-change (ADR-0026; not owned by stage-2, whose design relocates the enumeration verbatim);
closing it also retires `dryRun`'s compensating `@throws` caveat. Rollback: clean branch revert
(proposal §Rollback) — fully additive, no persisted state.

## 4.9 Performance

No significant impact. `dryRun` is a defensive-copy snapshot plus a pure O(n) map over the in-memory
pending buffer; it runs only when the author calls it.

## 4.10 Architecture Impact

**Architecture impact**: **additive**
**Rationale**: derived from 4.2c — the `commons/index.ts extend` touchpoint adds a new author-surface
export within the existing commons layer, and the `dry-run/plan.ts modify` is a value-level
vocabulary conformance with no signature/shape/boundary change. No boundary, dependency direction, or
pattern is altered; `architecture.md`'s ./commons Public-API listing (line 41) and dry-run-path note
(line 55) GAIN entries but nothing in the baseline becomes wrong (line 55 already documents
author-vocabulary rendering). Distinct from stage-2's `modifying`, which changed SEAM-04 data flow
and the `AuthoringError` shape. Post-verify refresh (additive → prompt): append
`dryRun`/`DryRunEntry`/`DryRunVerb` to the ./commons listing and note the renderer now emits author
`remove`. The refresh record MUST carry the considered-and-rejected counterargument — "the runtime
output of an existing module (`plan.ts`) changes, arguably `modifying`" — and why it lost (value-level
conformance to the seam's own signed contract, no shape/boundary change), so the refresh is not
mistaken for a no-op.

## 4.11 Open Questions

None.
