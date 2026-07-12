# Design: schematic-local-files

**Change**: `schematic-local-files` · **Triage**: L · **Spec**: V2 signed → V3 micro-unfreeze
in flight (AEC-11 neutral "source file…" templates; BRC-06/ATH-15.2 end-to-end wording;
PRC ancestor-symlink+ENOENT scenario; copyIn-void scenario; `kind` labels
`"rendered" | "copied"`) · **Design rev**: 2 (blind-council fixes A1-A4, S1-S5, T1-T3) ·
**Persona lens**: architect + security-engineer + tech-writer

**Architecture impact**: **modifying** — a new `src/scaffold/` leaf layer (additive) PLUS a
tightened `defineFactory({packageDir})` contract, a widened closed reason union (8→12), and a
7th member in THREE frozen public vocabularies moving together: the `Directive` op union,
`DryRunVerb`, AND `AuthoringVerb` (A1: `verbFor`/`primaryPath` are exhaustive over
`Directive["op"]` — the wire growth FORCES the author-vocabulary growth). Derived from the
Architecture Touchpoints table (§4): three `deviates` rows, each with an ADR.

## Architecture Overview

The by-value half rides the EXISTING `create` IR with zero engine change; the by-reference
half is a new, additive `copyIn` wire op (ADR-0043). All disk-read + directive-emit logic
lives in a new isolated leaf, `src/scaffold/` (ADR-0044), reached by thin `commons` wrappers
via `currentContext()`; `DirectiveFactory` stays pure and gains only a `copyIn` lowering.
`RunContext` gains `packageDir` (resolution anchor) and `packageRoot` (the `collection.json`
containment ceiling), both seeded once at the pre-`als.run` boundary (ADR-0046, mirroring the
ADR-0037 `dialects` pattern). Source validation for by-reference copy is SDK-side against real
disk (the `source-*` reasons, ADR-0045); the fake/vehicle own only destination-collision +
emit-only recording — no bytes ever land in `result.tree`. Chunked flush reuses the existing
`session.flush()`/deferred-`commit()` contract, so run-level all-or-nothing survives chunking
with no new atomicity mechanism.

**Architectural seams**: (1) the new `src/scaffold/` → `core` boundary; (2) the by-reference
**wire/engine seam** (engine re-derives its ceiling, path-form hardening, single-pass render —
§Seam Contract, engine-gated).

## Flow Changes (A1)

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author scaffolds a package-local folder into the tree | Create | FSC-01..09, CCL-*, PRC-*, REQ-04/05 | `test/e2e/scaffold.e2e.test.ts` (new) | mixed by-value/by-reference walk, chunked flush |
| Author ships one templateFile via `create({templateFile})` | Create | FEH-01/02, CCL-06 | `test/e2e/scaffold.e2e.test.ts` (new) | render request, fail-loud on binary/oversized |
| Author copies one file via `copyIn` | Create | FEH-03/04/05, BRC-*, PRC-* | `test/e2e/scaffold.e2e.test.ts` (new) | always by-reference, emit-only |
| Author previews scaffold/copyIn via `dryRun()` | Modify | DRE-05/06 | `test/e2e/dry-run.e2e.test.ts` (extend) | per-entry `kind`, `copyIn` verb |

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/commons/index.ts` (author surface) | extend | `scaffold`/`copyIn` verbs + `create({templateFile})` overload | aligns |
| `src/scaffold/` (new leaf layer) | new | first disk-read + directive-emit combiner | **deviates → ADR-0044** |
| `src/core/wire.ts` `Directive` union | modify | 7th op `copyIn` (additive union member) | aligns (ADR-0013 precedent) |
| `src/core/directive-factory.ts` | extend | pure `copyIn` lowering | aligns |
| `src/core/context.ts` / `RunContext` | modify | `packageDir`+`packageRoot`; eager ceiling; tightened `{packageDir}` contract | **deviates → ADR-0046** |
| `src/core/authoring-error.ts` reason union | modify | closed 8→12 union; `AuthoringVerb` 6→7 (`copyIn`); `originFor`/`messageFor`/`verbFor`/`primaryPath` arms | **deviates → ADR-0045** |
| `src/dry-run/plan.ts` (frozen verb map) | modify | 7th verb `copyIn` + `kind` tag | aligns (ADR-0025 anticipated growth) |
| `src/testing/contract-fake.ts` + `src/conformance/run-vehicle.ts` | extend | `copyIn` branch (collision + emit-only) | aligns |

Baseline (`openspec/architecture.md`) is stale (claims stage-5 unmerged; git shows PR #16/#17
merged) — recommend `/sdd-architecture refresh` alongside; judged against CODE here.

## File Changes (A4 — contract with sdd-slice)

| Path | Action | Purpose |
|---|---|---|
| `src/scaffold/index.ts` | Create | Orchestrators `runScaffold`/`runCopyIn`/`readTemplateFile` |
| `src/scaffold/walk.ts` | Create | Folder enumeration; no symlink-dir descent; 10 000-entry bound (FSC-09) |
| `src/scaffold/filename-pipeline.ts` | Create | Pure rename→token→`.template`-strip; include/exclude glob; intra-collision (FSC-03/05/08) |
| `src/scaffold/classify-transport.ts` | Create | Classifier: stat-gate→sniff→budget→verdict + render-request fail-loud (CCL-*) |
| `src/scaffold/containment.ts` | Create | Ceiling resolution + source/dest guards + `source-*` throws (PRC-*) |
| `src/scaffold/expander.ts` | Create | Scaffold algorithm + serialized-size chunked flush (REQ-04/05) |
| `src/core/wire.ts` | Modify | Add `copyIn` op to `Directive` |
| `src/core/directive-factory.ts` | Modify | `CopyInArgs` + pure `copyIn()` method |
| `src/core/context.ts` | Modify | `RunContext.packageDir`+`packageRoot`; eager ceiling resolution; export the two |
| `src/core/authoring-error.ts` | Modify | `AuthoringReason` 8→12 (`originFor`+`messageFor` 4 `source-*` arms); `AuthoringVerb` 6→7 (`+"copyIn"`); `verbFor` passes `copyIn` through; `primaryPath` gains `case "copyIn": return directive.copyIn.from` (A1 — both switches are exhaustive over `Directive["op"]` and will not compile otherwise) |
| `src/commons/index.ts` | Modify | Export `scaffold`/`copyIn`; `create({templateFile})` overload; **docs**: `dryRun()` JSDoc "verb and path only" sentence updated for `kind`; per-export JSDoc obligations (T3 checklist below) |
| `src/dry-run/plan.ts` | Modify | `DryRunVerb`+`copyIn`; `WIRE_TO_AUTHOR_VERB` 7th row; `DryRunEntry.kind?: "rendered" \| "copied"`; `dryRunPlan` copyIn + kind; `kind` JSDoc incl. scaffold-binary-surfaces-under-copyIn note (DRE-06) |
| `src/testing/contract-fake.ts` | Modify | `copyIn` branch: dest-collision + emit-only (no tree write) |
| `src/conformance/run-vehicle.ts` | Modify | `copyIn` case — **ADDS collision machinery the vehicle lacks today** (A3): `applyDirective` currently applies silently with zero collision/existence throws; the `copyIn` case introduces `tree.has(to) && !force` → throw, or ATH-16.1 fake-parity is unmet on the collision fixture |
| `test/scaffold/*.test.ts` | Create | Unit suites per leaf module (walk, filename-pipeline, classify-transport, containment, expander) |
| `test/e2e/scaffold.e2e.test.ts` | Create | Scaffold/copyIn/templateFile end-to-end flows |
| `test/types/authoring-reason.test.ts` | Modify | 12-member exhaustiveness pin (AEC-10.2) |
| `test/dry-run/plan.test.ts`, `test/dry-run/vocabulary-consistency.test.ts` | Modify | 7-verb map + `kind` tag |
| `test/fake/harness-in-memory-invariant.test.ts` | Modify | Widen allow-list to within-ceiling factory reads (ATH-14) |
| `test/fake/*` (copyIn fidelity), `test/conformance/*` (parity) | Create/Modify | FAKE-06 by-reference + vehicle parity (ATH-15/16, BRC-05/06) |
| `test/skeleton/authoring-error.test.ts` | Modify | `AuthoringVerb` membership/attribution coverage: copyIn collision attributes `verb: "copyIn"`, `path: copyIn.from` (A1; the compile pin is the `.d.ts` baseline — no dedicated verb pin test exists) |
| `test/fitness/dts-baseline/*.d.ts`, `test/fitness/pkg-surface-baseline.json` | Modify | Regenerated `.d.ts` + surface baselines (FIT-04/14) — includes the 7-member `AuthoringVerb`/`DryRunVerb` |
| `{packageDir}` run sites — full A2 enumeration | Modify | `collection.json` marker per site: static `test/fixtures/typed-factory/` (+e2e), `test/fixtures/harness-opted-in/`; runtime temp-tree helpers in `test/security/canary-no-echo.test.ts` (`mkdtempSync`), `test/skeleton/run-boundary-validation.test.ts`, `test/skeleton/reserved-lifecycle-names.test.ts`, `test/fake/harness-opted-in.test.ts`, `test/fake/harness-in-memory-invariant.test.ts`, `test/fitness/fit-12-schema-parity.test.ts`, `test/fitness/fit-16-reserved-name-scan.test.ts` — each temp-dir setup helper seeds the marker (no single shared marker covers temp dirs) |
| `README.md` | Modify | Verb list: add missing `copy` + new `scaffold`/`copyIn`; short "Scaffolding a folder" section (T3) |
| `openspec/decisions/0043..0046-*.md` | Create | New ADR drafts |
| `openspec/decisions/0005/0011/0018/0019/0025-*.md` | Modify | Superseded / amendment notes |
| `src/core/session.ts` | Read-only | `flush()` reused as-is for chunking; no change |

**T3 JSDoc obligations checklist** (carried per-export into the `commons` slice): `scaffold` —
mandatory/optional table + defaults, empty-folder-vs-zero-after-filter distinction, npm-tarball
empty-dir caveat (FSC-04), symlink-dir non-descent + 10 000-entry bound (FSC-09), returns
`void`, rename-is-a-remap-table disambiguation; `copyIn` — always copied/never renders
(FEH-03), contrast with tree→tree `copy`, the `{= =}`-verbatim escape (CCL-04), `void` +
rationale, `force`; `create({templateFile})` — render request → fail-loud (FEH-02),
`.template` strip, token translation; `DryRunEntry.kind` — label meaning + a
scaffold-classified binary surfaces under verb `copyIn` even though the author never called
it (DRE-06 doc note).

## Data Model & Interface Contracts

**Wire (`wire.ts`)** — additive union member (ADR-0043):
```ts
| { op: "copyIn"; copyIn: { from: string; to: string; force?: boolean } }
```
`from` is relative to the RESOLUTION anchor `packageDir`, never absolute (BRC-07; the S2
seam clause pins the engine to the same anchor); `to` may carry `{= =}` tokens (FSC-05);
text-only invariant preserved — no content field (BRC-01.2, ADR-0019 amendment).

**DirectiveFactory** — pure: `copyIn(a: { from; to; force? }): Directive` (mirrors `copy`,
`...forceEntry(a.force)`).

**RunContext** (`context.ts`): `{ session, factory, dialects, packageDir?: string,
packageRoot?: string }`. `packageRoot` = nearest `collection.json` ancestor of `packageDir`,
walked eagerly pre-`als.run`; absent → throw `invalid-input` fail-loud (PRC-03/RBV-06).

**AuthoringReason / AuthoringVerb** (`authoring-error.ts`): reason union extends to TWELVE —
add `source-not-found`, `source-outside-package`, `source-not-regular-file`,
`source-unreadable`. `originFor`: all four under the `authoring-rejected` arm. `messageFor`:
four new cases returning the REQ-AEC-11 (V3 neutral) `"source file …"` templates — derivable
from the existing `path` field, so NO caller-supplied message needed (unlike
`invalid-input`/`reserved-name`). **`AuthoringVerb` extends to SEVEN (`+"copyIn"`)** (A1):
`verbFor`/`primaryPath` are exhaustive over `Directive["op"]` and stop compiling the moment
`copyIn` joins the wire union; a `copyIn` destination collision (emit seam) attributes
`verb: "copyIn"` (the author never called `copy`), `path: directive.copyIn.from`
(source-side, per the frozen primaryPath table). SDK-side PRE-emit `source-*` rejections
carry `verb: undefined` (no wire directive exists yet; `scaffold` is not an `AuthoringVerb`
member and a partial per-call vocabulary would lie). Scaffold-family misuse (templateFile
binary/oversized, zero-after-filter, missing-collection.json, `.template` sniff-fail,
intra-collision, entry-count) reuses EXISTING `invalid-input` with a caller-supplied
`message` (AEC-12) — union arithmetic stays 12.

**Author surface (`commons`)**: `scaffold(args): void` (FSC-07); **`copyIn(from, to, opts?):
void`** — pinned `void` (T2, spec V3 scenario): a `WritableHandle` chains reads/writes over
tree CONTENT, but a by-reference destination's bytes exist only after the ENGINE applies the
directive — a handle over it would lie about tree content (the fake never materializes it,
ATH-15). The asymmetry with `copy` (which returns a handle over tree→tree content the fake
DOES stage) is deliberate and documented. `create<S>(path, { templateFile, options, force? })`
overload. All thin wrappers → `src/scaffold`. **No resolution anchor** (A4): calling
`scaffold`/`copyIn`/`create({templateFile})` inside a bare `defineFactory(fn)` run (no
`packageDir`) fails loud with `invalid-input` — there is nothing to resolve `from` against;
never a cwd fallback.

**DryRun (`plan.ts`)**: `DryRunVerb` +`"copyIn"`; `WIRE_TO_AUTHOR_VERB` gains
`copyIn: "copyIn"`; `copyIn` renders `path: d.copyIn.from`. `DryRunEntry` gains **`kind?:
"rendered" | "copied"`** (owner-ruled labels, T1; internal classifier vocabulary stays
by-value/by-reference). Honest semantics pinned (A4): `kind` is present ONLY on
content-materializing entries — `create` → `"rendered"` (every create IS a render request,
inline or templateFile — DRE-05.3's indistinguishability), `copyIn` → `"copied"`; ABSENT for
`modify`/`remove`/`rename`/`move`/`copy`, whose entries neither render nor classify (calling a
plain `remove` "rendered" would be a lie). Derived purely from op — total, deterministic.

### Classification pipeline (pinned order, `classify-transport.ts` + `containment.ts`)
1. **Containment + eligibility BEFORE any content read** (PRC-08): lexical `../`/absolute
   screen → resolve + segment-aware ceiling check → (out-of-ceiling ⇒ `source-outside-package`,
   NO existence probe, PRC-07) → realpath. **ENOENT ordering (S1, closes the ancestor-symlink
   oracle)**: on realpath ENOENT, `source-not-found` may be concluded ONLY AFTER the NEAREST
   EXISTING ANCESTOR's realpath is proven in-ceiling; if that ancestor resolves outside the
   ceiling, the verdict is `source-outside-package` — otherwise a symlinked in-ceiling
   directory pointing outside would let not-found-vs-outside differentiate existence beyond
   the boundary (spec V3 pins the scenario). Then `lstat` allow-list (`isFile()` only, else
   `source-not-regular-file`). Segment comparison CASE-FOLDS on case-insensitive platforms
   (S4); canonical-form hardening (UNC/device/reserved names) stays engine-side per BRC-08.
2. **Stat-size gate** (CCL-06): stat size > budget ⇒ by-reference (or fail-loud for a
   render-request) with zero content read.
3. **Whole-file sniff** (CCL-01/03): read entire file; valid UTF-8 AND no null byte?
4. **Serialized budget** (CCL-02): JSON-serialized form ≤ `BATCH_CAP_BYTES` (`>` rejects)?
5. **Verdict**: pass 3+4 ⇒ by-value (`create`); else by-reference (`copyIn`). **Carve-out**: a
   `.template`/`templateFile` render request failing 2/3/4 ⇒ throw `invalid-input` fail-loud,
   NEVER degrade to by-reference (CCL-05/FEH-02).

### Filename pipeline (pinned order, FSC-05) & filtering
rename (matches ORIGINAL source-relative name) → token translation (`__x__` → `{= x =}` in the
wire `pathTemplate`) → `.template` strip (last). include/exclude: glob dialect `*`=within-segment,
`**`=across-segments, exclude wins (FSC-03). Intra-scaffold destination collision names ALL
offending sources, deterministic (FSC-08). Destination lexical guard (PRC-09, S3): applied to
the **FINAL SDK-computed destination** — post-rename, post-token-translation, immediately
pre-emit — not merely the raw `to` argument: a `rename` map value smuggling `../` (or an
absolute path) is caught at the same guard ⇒ `invalid-input`. Walk (S4): symlinked-directory
detection is **`lstat`-based, never `stat`** (stat follows the link and would report the
TARGET's type, defeating non-descent) — a slice-contract requirement for `walk.ts`.

### Batch-cap chunked flush (`expander.ts`, REQ-04/05)
The expander maintains a serialized-size accumulator (`Buffer.byteLength(JSON.stringify(
directive))` + envelope overhead); when the next directive would push the current group `>`
`BATCH_CAP_BYTES`, it calls `session.flush()` first, then starts a new group. The SDK NEVER
rejects on aggregate size (lowering heuristic, ADR-0018 amendment); an over-cap single group
still rejects at the fake's `emit` unchanged (REQ-04.2). Run-level all-or-nothing (REQ-05)
needs NO new mechanism: intra-run `flush()`es stage to the fake, `commit()` fires ONCE at run
end in `defineFactory`; a later-flush rejection propagates → `defineFactory` catch → `discard()`
→ nothing committed.

## Seam Contract (engine obligations — [SEAM] [ENGINE-GATED])
The engine, not the SDK, is the real security control. **BRC-02** engine re-derives its OWN
ceiling (open-then-fstat, TOCTOU-closed), never trusts the SDK-resolved root; **[SEAM] anchor
pin (S2)**: the emitted `copyIn.from` is relative to the RESOLUTION anchor (`packageDir`) —
the engine MUST resolve `from` against its own re-derived `packageDir`, NOT against its
ceiling (the two anchors are distinct on the engine side exactly as on the SDK side,
PRC-01); **BRC-08** engine rejects non-canonical path forms (UNC/device/reserved-DOS/
drive-relative) for source AND rendered destination, and renders `pathTemplate` single-pass
(substituted values are literal segments, never re-scanned); **PRC-06** engine enforces
destination containment post-render. SDK-side checks are DX/attribution only. These three
obligations are an **archive-gated deliverable** — see Migration / Rollout.

## ADRs minted / amended
- **ADR-0043** by-reference wire shape — new `copyIn` op (rejects `copy` discriminator; loser
  registered as pending-changes reconsideration debt). Rev 2: consequences now name ALL THREE
  7th-member growths (wire op, `DryRunVerb`, `AuthoringVerb` — A1) + the S2 anchor-pin seam
  clause.
- **ADR-0044** `src/scaffold/` expansion leaf module (**supersedes ADR-0005**).
- **ADR-0045** package-read source validation & SDK/fake division of labor. Rev 2: S1
  ENOENT-after-ancestor-proof ordering; consequence added — classify-time vs apply-time
  content drift is inherent to by-reference (the engine re-reads real bytes at apply; the
  SDK's classification is a point-in-time prediction, never a content pin); the REQ-BRC-06
  council-attention clause is CLOSED by spec V3's end-to-end wording.
- **ADR-0046** `RunContext.packageRoot` eager ceiling seeding (`{packageDir}` tightening).
  Rev 2: migration consequence corrected to the full A2 run-site enumeration.
- Amendments: **0005** Superseded; **0011** `packageRoot`/`packageDir` fields; **0018**
  chunking/containment are lowering heuristics not size/security authority; **0019** the
  anticipated additive by-reference widening (text-only invariant preserved); **0025** 7th
  verb `copyIn` + `kind?: "rendered" | "copied"` (owner labels, present only on
  content-materializing entries).

## Test Derivation (coverage commitment — every REQ)

| REQ (scenarios) | Level | Test (path) |
|---|---|---|
| FSC-01 (.1/.2/.3) | unit | `test/scaffold/index.test.ts` |
| FSC-02 (.1) | unit | `test/scaffold/expander.test.ts` |
| FSC-03 (.1/.2) | unit | `test/scaffold/filename-pipeline.test.ts` |
| FSC-04 (.1/.2) | unit | `test/scaffold/expander.test.ts` |
| FSC-05 (.1) | unit | `test/scaffold/filename-pipeline.test.ts` |
| FSC-06 (.1/.2) | unit+integration | `test/scaffold/expander.test.ts` (.2 via fake collision) |
| FSC-07 (.1) | contract | `test/fitness/dts-baseline` type test |
| FSC-08 (.1) | unit | `test/scaffold/filename-pipeline.test.ts` |
| FSC-09 (.1/.2) | unit | `test/scaffold/walk.test.ts` |
| FEH-01 (.1) | unit | `test/scaffold/index.test.ts` |
| FEH-02 (.1/.2) | unit | `test/scaffold/classify-transport.test.ts` |
| FEH-03 (.1) | unit | `test/scaffold/index.test.ts` |
| FEH-04 (.1/.2) | unit | `test/scaffold/index.test.ts` |
| FEH-05 (.1/.2) | integration | `test/scaffold/scaffold-fake.test.ts` |
| CCL-01 (.1–.5) | unit | `test/scaffold/classify-transport.test.ts` |
| CCL-02 (.1/.2/.3) | unit | `test/scaffold/classify-transport.test.ts` |
| CCL-03 (.1/.2) | unit | `test/scaffold/classify-transport.test.ts` |
| CCL-04 (.1) | integration | `test/scaffold/scaffold-fake.test.ts` |
| CCL-05 (.1) | unit | `test/scaffold/classify-transport.test.ts` |
| CCL-06 (.1) | unit | `test/scaffold/classify-transport.test.ts` (fs read spy) |
| PRC-01 (.1) | unit | `test/scaffold/containment.test.ts` |
| PRC-02 (.1) | integration | `test/scaffold/containment.test.ts` (walk-once spy) |
| PRC-03 (.1) | integration | `test/scaffold/run-boundary.test.ts` |
| PRC-04 (.1–.7) | unit | `test/scaffold/containment.test.ts` |
| PRC-05 (.1) | unit | `test/scaffold/containment.test.ts` |
| PRC-06 (.1) | seam (engine-gated) | documented in §Seam Contract; not SDK-run |
| PRC-07 (.1) | unit | `test/scaffold/containment.test.ts` (no-oracle) |
| PRC-08 (.1) | unit | `test/scaffold/containment.test.ts` (read spy) |
| PRC-09 (.1) | unit | `test/scaffold/containment.test.ts` |
| BRC-01 (.1/.2) | unit | `test/scaffold/scaffold-fake.test.ts` |
| BRC-02 (.1) | seam (engine-gated) | §Seam Contract |
| BRC-03 (.1) | contract | `test/fitness/dts-baseline` (`create` shape diff) |
| BRC-04 (.1) | architectural | `test/scaffold/evidence-boundary.test.ts` (no tree/disk assertion scan) |
| BRC-05 (.1) | integration | `test/scaffold/scaffold-fake.test.ts` |
| BRC-06 (.1) | integration | `test/fake/copyin-fidelity.test.ts` (harness end-to-end) |
| BRC-07 (.1) | unit | `test/scaffold/scaffold-fake.test.ts` |
| BRC-08 (.1/.2) | seam (engine-gated) | §Seam Contract |
| AEC-10 (.1/.2) | unit+contract | `test/types/authoring-reason.test.ts` (12-member pin) |
| AEC-11 (.1) | unit | `test/core/authoring-error-source.test.ts` |
| AEC-12 (.1) | unit | `test/core/authoring-error-source.test.ts` |
| REQ-04 (.1/.2/.3) | integration | `test/scaffold/batch-cap-chunk.test.ts` |
| REQ-05 (.1) | integration | `test/scaffold/batch-cap-chunk.test.ts` (`runFactoryForTest`) |
| DRE-05 (.1/.2/.3) | unit | `test/dry-run/plan.test.ts` |
| DRE-06 (.1) | unit | `test/dry-run/vocabulary-consistency.test.ts` |
| ATH-14 (.1/.2) | integration | `test/fake/harness-in-memory-invariant.test.ts` |
| ATH-15 (.1/.2) | integration | `test/fake/copyin-fidelity.test.ts` |
| ATH-16 (.1) | integration | `test/conformance/copyin-parity.test.ts` |
| RBV-06 (.1) | integration | `test/scaffold/run-boundary.test.ts` (sentinel pre-emption) |
| V3: ancestor-symlink+ENOENT → `source-outside-package` | unit | `test/scaffold/containment.test.ts` (S1 ordering) |
| V3: `copyIn` returns exactly `void` | contract | `test/fitness/dts-baseline` type test (T2) |
| A1: copyIn collision attributes `verb:"copyIn"`, `path: from` | unit | `test/skeleton/authoring-error.test.ts` |

All 48 V2 REQ-IDs covered (+ the V3-added scenarios above; exact V3 scenario IDs bind at
slice time once the parallel spec agent lands them); every Create/Modify Flow row has ≥1 e2e
row (`scaffold.e2e.test.ts`, `dry-run.e2e.test.ts`). SEAM rows (PRC-06, BRC-02, BRC-08) are
engine-gated documentation, not SDK-run — the evidence boundary (BRC-04) is itself asserted
(`evidence-boundary.test.ts`).

## Fitness Functions
- **Existing preserved**: FIT-01 — verified against the actual test (A4): it is a TRANSITIVE
  relative-import graph walk whose invariant is "zero external PACKAGES reachable from
  commons"; `node:`/`bun:` builtins are explicitly allowed, so `commons → ../scaffold →
  node:fs` is compliant by the rule's own terms (not by scoping luck). The disk logic still
  lives in `src/scaffold/`, never `commons`. FIT-07 (no tree in core), FIT-10 (only
  `src/core` reaches the port), FIT-04/14 (`.d.ts`/surface semver gate — new exports,
  including the 7-member `AuthoringVerb`/`DryRunVerb`, regenerate baselines).
- **New/relied-on**: evidence-boundary scan — no test asserts `result.tree`/disk bytes for a
  by-reference destination (BRC-04.1); `originFor`/`messageFor` 12-member exhaustiveness pin
  (AEC-10.2); `WIRE_TO_AUTHOR_VERB` total `Record<Directive["op"], DryRunVerb>` (7 rows,
  frozen); `src/scaffold/` leaf-rule (imports core only via `currentContext()`, no reverse dep).

## Migration / Rollout
Pre-publish surface is additive EXCEPT the ADR-0046 `{packageDir}` tightening: every
`defineFactory({packageDir})` RUN SITE now requires a `collection.json` ancestor (A2 — full
enumeration, correcting rev 1's "~8 fixtures / one shared marker" claim):

- **Static fixtures**: `test/fixtures/typed-factory/` (consumed by `test/e2e/typed-factory`),
  `test/fixtures/harness-opted-in/` — add a marker file in (or above) each fixture package.
- **Runtime temp-dir suites** (each builds its OWN tree; a repo-level marker CANNOT cover
  them): `test/security/canary-no-echo.test.ts` (`mkdtempSync`),
  `test/skeleton/run-boundary-validation.test.ts`, `test/skeleton/reserved-lifecycle-names.test.ts`,
  `test/fake/harness-opted-in.test.ts`, `test/fake/harness-in-memory-invariant.test.ts`,
  `test/fitness/fit-12-schema-parity.test.ts`, `test/fitness/fit-16-reserved-name-scan.test.ts`
  — each temp-tree setup helper seeds a `collection.json` marker alongside (or above) the
  package dir it fabricates.

Regenerate `.d.ts` + `pkg-surface-baseline`. **Post-publish caveat**: once the `copyIn` wire
op is consumed by any engine build it becomes a semver wire contract — removal is then a
breaking change, not a clean revert. Slice A-first (by-value; classifier's by-reference arm =
fail-loud throw), then the B slice swaps the throw for `copyIn` emission — never ship A as
terminal scope.

**Archive-gated deliverable (S5)**: three `openspec/pending-changes.md` rows, **owner = engine
repo**, siblings to row 186, MUST exist before this change archives: (1) BRC-02 — engine
ceiling re-derivation + open-then-fstat TOCTOU closure; (2) BRC-08 — UNC/device/reserved-DOS/
drive-relative rejection + single-pass literal-token render; (3) PRC-06 — post-render
destination containment. Registering them is a named acceptance criterion of the final slice,
not prose intent.

## Performance Considerations
Classification's stat-size gate (CCL-06) bounds cost — a multi-GB asset is never slurped to be
told it is over budget (only stat). Walk is bounded at 10 000 entries (FSC-09). Chunked flush
keeps peak serialized-batch memory ≤ one `BATCH_CAP_BYTES` group. No hot-path concern.

## Open Questions
None. Rev 1's two council-attention items are closed: ADR-0045's end-to-end reading of
REQ-BRC-06 is RATIFIED by the spec V3 micro-unfreeze (BRC-06/ATH-15.2 reworded without
`#requireExists`); ADR-0046's `{packageDir}` tightening stands with the full A2 run-site
migration enumerated above. Slice-time dependency (not a question): the V3 spec text must be
landed by the parallel spec agent before `sdd-slice` binds the V3 scenario IDs referenced in
Test Derivation.
