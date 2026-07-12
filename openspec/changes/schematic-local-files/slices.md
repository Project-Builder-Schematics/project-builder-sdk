# Slices: schematic-local-files

**Triage**: L · **Spec version**: V3 signed (48 REQs / 81 scenarios, 8 domains + 2 delta-only)
**Design rev**: 2 · **Slices rev**: 2 (plan-verify iter 1: Executor Context expanded —
slices, coverage, and build order unchanged from rev 1) · **Total slices**: 6
(1 walking skeleton + 5 SPIDR)

A-first ordering is load-bearing (obs #915 ruling 15): S-001 ships the classifier's
by-reference verdict as a **fail-loud throw** (never terminal), S-003 swaps it for real
`copyIn` emission. Containment follows the same pattern: S-001 carries a MINIMAL lexical
guard (just enough to gate reads during classify-transport unit tests); S-002 REPLACES it
with the full realpath/segment/case-fold/no-oracle `containment.ts` + the 4 new
`AuthoringReason` members. **Deviation from the orchestrator's slice preview** (flagged,
not silently applied): "AuthoringVerb 7th member machinery" is moved from S-002 to S-003 —
`verbFor`/`primaryPath` switch over `Directive["op"]`, which does not include `"copyIn"`
until S-003 mints the wire op; keeping it in S-002 would not compile. S-002 ships only the
`AuthoringReason` 8→12 extension (REQ-AEC-10/11), which switches over `reason`, not `op`.

---

## S-000: Walking Skeleton — `packageRoot` ceiling + `create({templateFile})` end-to-end

**Scope**: walking-skeleton · **Dimension**: —
**Covers**: FEH-01.1, FEH-02.1/.2, PRC-02.1, PRC-03.1, RBV-06.1, DRE-05.3, AEC-12 (partial)
**Requires**: nothing · **Test layers**: e2e + unit (smoke)

**Acceptance**: GIVEN a package with a `collection.json` ancestor and a small template
file, WHEN `create("dest.ts", {templateFile})` runs, THEN it renders through the existing
`create` IR, commits via the fake, and `dryRun()` tags it `kind:"rendered"`; a package with
NO `collection.json` ancestor fails loud pre-body (RBV-06.1 sentinel ordering); a binary/
oversized `templateFile` fails loud (`invalid-input`), never silently copies.

### Tasks
- [ ] S-000.1 `RunContext` gains `packageDir`/`packageRoot` fields (`context.ts`, ADR-0046)
- [ ] S-000.2 `defineFactory`: eager `collection.json` ancestor walk at the existing
      pre-`als.run` chokepoint; missing ancestor → `invalid-input` fail-loud, pre-body
- [ ] S-000.3 Migration: seed a `collection.json` marker in `test/fixtures/typed-factory/`,
      `test/fixtures/harness-opted-in/`, and each of the 7 temp-dir suites (ADR-0046 A2:
      `canary-no-echo`, `run-boundary-validation`, `reserved-lifecycle-names`,
      `harness-opted-in`, `harness-in-memory-invariant`, `fit-12`, `fit-16`)
- [ ] S-000.4 `src/scaffold/index.ts`: `readTemplateFile` — stat + read relative to
      `packageDir`, minimal sniff gate (whole-file UTF-8 + no null + budget, reused fully
      by S-001's classifier)
- [ ] S-000.5 `commons`: `create(path, {templateFile, options, force?})` overload → existing
      `create` directive; fail-loud `invalid-input` on sniff-fail (REQ-FEH-02)
- [ ] S-000.6 `dry-run/plan.ts`: `DryRunEntry.kind?: "rendered"|"copied"`; `create` →
      `"rendered"`
- [ ] S-000.7 `test/e2e/scaffold.e2e.test.ts` (new): happy-path render + fail-loud, through
      fake + `dryRun()`

---

## S-001: Folder scaffold (by-value) + classifier — by-reference arm throws

**Scope**: happy-path · **Dimension**: D (Data — one file → many, folder walk)
**Covers**: FSC-01..05, FSC-06.1, FSC-07..09, CCL-01..06, AEC-12 (remaining fixtures)
**Requires**: S-000 · **Test layers**: unit + integration

**Acceptance**: GIVEN a package-local folder with mixed text/binary files, WHEN
`scaffold({from, to, ...})` runs, THEN every source classifies deterministically
(whole-file UTF-8+null sniff, stat-gate, serialized budget), by-value files emit `create`
directives per the mirrored/renamed/token-translated/`.template`-stripped path, and a
by-reference verdict THROWS fail-loud (temporary — S-003 swaps this).

### Tasks
- [ ] S-001.1 `src/scaffold/walk.ts`: enumeration, no symlinked-dir descent (`lstat`-based),
      10 000-entry bound
- [ ] S-001.2 `src/scaffold/filename-pipeline.ts`: rename → token-translation →
      `.template`-strip (pinned order); include/exclude glob; intra-collision detection
      naming all offending sources
- [ ] S-001.3 `src/scaffold/classify-transport.ts`: stat-gate → whole-file sniff → budget →
      verdict; MINIMAL lexical containment guard only (hardened in S-002); by-reference
      verdict = fail-loud throw
- [ ] S-001.4 `commons.scaffold(args): void`; zero-files-after-filter no-op vs
      filters-eliminate-all fail-loud (`invalid-input`)
- [ ] S-001.5 `test/scaffold/{walk,filename-pipeline,classify-transport,index}.test.ts`,
      `test/scaffold/expander.test.ts` (FSC-06.1 only — force pass-through, no by-reference
      fixture yet), `test/types/authoring-reason.test.ts` extended
- [ ] S-001.6 ADR-0005 marked Superseded (by ADR-0044)

---

## S-002: Package-root containment (hardened) — source guards + reason union

**Scope**: edge-case · **Dimension**: R (Rule)
**Covers**: PRC-01, PRC-04, PRC-05, PRC-07, PRC-08, PRC-09, AEC-10, AEC-11
**Requires**: S-001 · **Test layers**: unit + integration

**Acceptance**: GIVEN a source path outside the containment ceiling, a broken
ancestor-symlink, or a non-regular-file source, WHEN classified, THEN it rejects with the
correct one of `source-not-found`/`source-outside-package`/`source-not-regular-file`/
`source-unreadable` — no existence oracle for out-of-ceiling paths (ENOENT resolved only
after the nearest existing ancestor proves in-ceiling), zero content reads before the
verdict, package-relative messages only.

### Tasks
- [ ] S-002.1 `src/scaffold/containment.ts`: realpath, segment-aware + case-fold ceiling
      check, regular-file allow-list, destination lexical guard (PRC-09); REPLACES
      S-001.3's placeholder guard inside classify-transport
- [ ] S-002.2 `authoring-error.ts`: `AuthoringReason` 8→12 (4 `source-*` members),
      `originFor` arm, `messageFor` 4 neutral `"source file …"` templates (no `"copy
      failed:"` prefix)
- [ ] S-002.3 `test/scaffold/containment.test.ts` (ENOENT-ancestor ordering S1,
      sibling-prefix, absolute-source, FIFO-stub, lexical-vs-realpath); update S-001's
      placeholder-guard test expectations to the real reasons
- [ ] S-002.4 ADR-0018 amendment note (containment is a lowering heuristic, not the size
      authority — unrelated but same file touch)

---

## S-003: By-reference copy — `copyIn` wire op + verb + fake/vehicle/dry-run

**Scope**: happy-path · **Dimension**: P (Path — by-reference flow)
**Covers**: FSC-06.2, FEH-03..05, BRC-01,03,05,06,07, DRE-05.1/.2, DRE-06
**Requires**: S-002 · **Test layers**: unit + integration

**Acceptance**: GIVEN a `copyIn(from, to, {force})` call or a scaffold binary entry, WHEN
emitted, THEN a `copyIn` directive lands in the batch (package-relative `from`, never
source bytes), the fake/vehicle record dest-collision + emit-only (never `result.tree`),
`dryRun()` tags it `kind:"copied"` under author verb `"copyIn"`, and the S-001 fail-loud
throw is replaced by real emission.

### Tasks
- [ ] S-003.1 `wire.ts`: add `{op:"copyIn"; copyIn:{from; to; force?}}` (ADR-0043);
      `directive-factory.ts`: pure `copyIn()` method
- [ ] S-003.2 `authoring-error.ts`: `AuthoringVerb` 6→7 (`+"copyIn"`); `verbFor`/
      `primaryPath` gain the `copyIn` arm (`path: directive.copyIn.from`)
- [ ] S-003.3 `src/scaffold/classify-transport.ts` + `expander.ts`: swap the S-001
      fail-loud throw for `factory.copyIn(...)` emission; `commons.copyIn(from, to,
      opts?): void`
- [ ] S-003.4 `testing/contract-fake.ts`: `copyIn` branch (dest-collision, emit-only,
      never writes `#tree`); `conformance/run-vehicle.ts`: `copyIn` case — ADDS collision
      machinery `applyDirective` currently lacks (today's `"copy"` branch applies silently)
- [ ] S-003.5 `dry-run/plan.ts`: `DryRunVerb`+`"copyIn"`; `WIRE_TO_AUTHOR_VERB` 7th row;
      `copyIn`→`"copied"`, mixed-scaffold entries show both tags
- [ ] S-003.6 `test/scaffold/scaffold-fake.test.ts`, `test/fake/copyin-fidelity.test.ts`
      (BRC-06 missing-source → `source-not-found` through the harness), `test/skeleton/
      authoring-error.test.ts` (A1 verb/path pin)
- [ ] S-003.7 ADR-0019/0025 amendments (additive widening; 7th verb + `kind`)

---

## S-004: Batch-cap chunked flush — aggregate size never blocks; run-level atomicity

**Scope**: edge-case · **Dimension**: R (Rule)
**Covers**: REQ-04.1/.2/.3, REQ-05.1
**Requires**: S-001 · **Test layers**: integration

**Acceptance**: GIVEN a scaffold whose aggregate serialized size exceeds
`BATCH_CAP_BYTES` but no single flushed group does, WHEN scaffolded, THEN it completes via
multiple `session.flush()` calls with exactly one directive per source (none dropped/
duplicated/reordered); a later-chunk rejection commits NOTHING from earlier chunks
(`result.tree` empty, existing discard contract, no new mechanism).

### Tasks
- [ ] S-004.1 `src/scaffold/expander.ts`: serialized-size accumulator; `session.flush()`
      between groups when the next directive would exceed `BATCH_CAP_BYTES`
- [ ] S-004.2 `test/scaffold/batch-cap-chunk.test.ts`: aggregate-over/single-group-over/
      exactly-at-cap (`>` not `>=`); `runFactoryForTest` cross-chunk-failure → empty tree

**Cuttable**: auto-chunking policy sophistication is cuttable to a simpler grouping
heuristic if time-boxed; measurement (serialized-size accumulator itself) is NOT cuttable.

---

## S-005: Coverage tail — harness/conformance parity, seam docs, engine follow-ups

**Scope**: edge-case · **Dimension**: I (Interface — same directives, harness/conformance/
docs entry points)
**Covers**: ATH-14.1/.2, ATH-15.1/.2, ATH-16.1, BRC-02, BRC-04, BRC-08.1/.2, PRC-06
**Requires**: S-003 · **Test layers**: integration + architectural

**Acceptance**: GIVEN the full by-reference suite, WHEN scanned, THEN zero assertions
check `result.tree`/disk bytes for a by-reference target (BRC-04); the in-memory-only
invariant allow-list widens to within-ceiling scaffold/copyIn reads without exempting
harness-machinery reads (ATH-14); fake and conformance vehicle agree on every by-reference
fixture (ATH-16); the 3 engine pending-changes rows and JSDoc/README obligations exist.

### Tasks
- [ ] S-005.1 `test/fake/harness-in-memory-invariant.test.ts`: widen allow-list to
      within-ceiling factory reads (ATH-14.1/.2)
- [ ] S-005.2 `test/conformance/copyin-parity.test.ts`: same fixture set through fake +
      vehicle, same verdicts (ATH-16)
- [ ] S-005.3 `test/scaffold/evidence-boundary.test.ts`: architectural scan — no test
      asserts by-reference bytes in `result.tree`/disk (BRC-04)
- [ ] S-005.4 Document §Seam Contract obligations (BRC-02 engine ceiling re-derivation,
      BRC-08 path-form + single-pass render, PRC-06 post-render containment) — prose only,
      not SDK-testable
- [ ] S-005.5 Register 3 `openspec/pending-changes.md` rows (owner = engine repo, siblings
      to row 186): BRC-02, BRC-08, PRC-06 — named acceptance criterion, not prose intent
- [ ] S-005.6 README + JSDoc (T3 checklist): `scaffold`/`copyIn`/`create({templateFile})`/
      `DryRunEntry.kind` obligations per design §T3
- [ ] S-005.7 Regenerate `.d.ts` baselines + `pkg-surface-baseline.json` (FIT-04/14, 7-member
      `AuthoringVerb`/`DryRunVerb`)

---

## Build Order

| Step | Slice(s) | Notes |
|---|---|---|
| 1 | S-000 | skeleton — implicit blocker for all others |
| 2 | S-001 | folder scaffold + classifier (by-reference arm throws) |
| 3 | S-002, S-004 | independent — both require only S-001, may run in parallel |
| 4 | S-003 | requires S-002 (real `source-*` reasons must exist before by-reference emission attributes them) |
| 5 | S-005 | requires S-003 |

## Anti-Pattern Check

✅ No horizontal/layer-named slices — each cuts through commons→scaffold→core→fake/
dry-run for a distinct user-visible capability. ✅ No slice depends on >1 other (linear
chain + one parallel fork). ✅ Every slice covers ≥1 REQ-ID. One deliberate deviation from
the orchestrator's preview is flagged above (AuthoringVerb machinery moved S-002→S-003 —
compile-order necessity, not scope drift).

## Tripwires (carried from orchestrator, still armed)

- Net-new non-test LOC / net-new ADR count: monitor at each slice's `sdd-apply` close;
  >1200 LOC or 6+ ADRs (currently 4: 0043-0046) → halt re-triage.
- BRC-04 (no test asserts `result.tree` contains by-reference bytes) is S-005.5's own
  fitness function — a violation found there is a REJECT-IN-REVIEW finding, not a pass.

---

# Executor Context — READ THIS FIRST

Every fact below was verified against this repo at slicing time (file + line citations).
Where a fact and the live code disagree at build time, the live code wins — re-verify, do
not force the citation.

## 0. Mandatory reading list (before S-000)

Read, in this order — you work in this repo and all of these are committed:

1. `openspec/changes/schematic-local-files/specs/*/spec.md` — V3 signed, 48 REQs /
   81 scenarios across 10 domain files. **The scenario text IS the acceptance detail.
   Slice acceptance criteria SUMMARIZE; the spec scenarios GOVERN.**
2. `openspec/changes/schematic-local-files/design.md` (rev 2) — File Changes table
   (§A4), Test Derivation table, the pinned classification/filename/containment
   pipelines, §Seam Contract, §Migration/Rollout.
3. ADRs `openspec/decisions/0043..0046-*.md` + the amendment targets
   `0005` (Superseded), `0011`, `0018`, `0019`, `0025`.
4. `openspec/changes/schematic-local-files/north-star.md` — the promise the reckoning
   gate holds this change against (esp. the evidence-boundary honesty).

## 1. RunContext + the pre-`als.run` chokepoint

`src/core/context.ts`: `RunContext` is currently `{ session, factory, dialects }`
(lines 52-56). `defineFactory` (lines 231-278) runs the pre-`als.run` chokepoint at
lines 236-240: `if (options?.packageDir !== undefined) { resolvePackageDir(...) →
checkReservedNames(resolvedDir) → validateAtRunBoundary(resolvedDir, o) }`; the ctx
object is built at 241-245 and `als.run` fires at line 255. **S-000 inserts the
`collection.json` ancestor walk INSIDE that same `if` block** (after
`validateAtRunBoundary`), adds `packageDir`/`packageRoot` (both `string | undefined`)
to `RunContext`, and seeds them into the ctx literal. Bare `defineFactory(fn)` seeds
both `undefined` — byte-for-byte unchanged behavior (the untyped opt-out).

## 2. `collection.json` semantics

Presence-only marker — **NEVER parsed, never read as JSON** (charter L2 keeps the
manifest out of scope; proposal Out-of-Scope). Walk: from `packageDir` upward, stop at
the FIRST directory containing `collection.json`; that directory is `packageRoot`
(the containment ceiling). No hit at any ancestor → throw `invalid-input` fail-loud
pre-body (REQ-PRC-03, REQ-RBV-06.1's sentinel ordering). The Angular-compat name is
intentional — the motivating ecosystem's marker file.

## 3. Sniff + budget parameters

- Valid UTF-8, WHOLE-file scan — no sampling window; scenario REQ-CCL-03.2 (>64KB
  tail-null) exists precisely to kill fixed-window samplers.
- Zero null bytes (whole file), same scan.
- Budget = LOWERING HEURISTIC measured against SERIALIZED reality per ADR-0019
  semantics: `BATCH_CAP_BYTES = 4 * 1024 * 1024` (`src/core/wire.ts` line 50); the
  fake measures `Buffer.byteLength(JSON.stringify(batch), "utf8")`
  (`src/testing/contract-fake.ts` lines 77-93) and stays the SOLE size authority.
- Per-file gate lives in `classify-transport.ts` (serialized directive measure);
  aggregate accumulator lives in `expander.ts` (S-004).
- Stat-size gate BEFORE any content read (REQ-CCL-06): stat > budget ⇒ by-reference
  (or fail-loud for render requests) with ZERO content reads.
- Boundary is INCLUSIVE: exactly-at-budget → by-value; one byte over → by-reference
  (`>` not `>=`, REQ-CCL-02.3, consistent with batch-cap REQ-04.3).

## 4. `session.flush()` + run-level all-or-nothing

`src/core/session.ts`: `Session` holds only `#pending: Directive[]` + the client.
`flush()` (lines 53-65) no-ops on empty, else splices the whole buffer into ONE
`Batch{protocolVersion:1, force:false, instructions}` and `client.emit(batch)`,
wrapping rejection via `toAuthoringError`. `read()` flushes first. `commit()`/
`discard()` delegate to the client. The fake is two-phase (`contract-fake.ts`):
`emit` applies eagerly into staging `#tree`; `commit()` (lines 115-124) promotes
staging→`#committed` atomically; `discard()` clears staging. `defineFactory`'s
try/catch (context.ts 254-276) calls flush→commit on success, discard on ANY throw —
**run-level all-or-nothing across chunked flushes (REQ-05) is therefore FREE**: an
S-004 mid-run `session.flush()` stages only; a later-flush rejection routes to
discard and nothing was ever committed. No new mechanism.

## 5. Token syntax + filename pipeline

On-disk `__name@dasherize__` → wire `{= name | dasherize =}` inside the emitted
`pathTemplate` (obs #915 ruling 4; the engine substitutes — the SDK never renders).
Pipeline order is PINNED by REQ-FSC-05 (its compound scenario .1 governs):
(1) `rename` — matches the ORIGINAL source-relative path; (2) token translation on
the possibly-renamed path; (3) `.template` strip LAST. Destination lexical guard
(PRC-09) applies to the FINAL computed destination — post-rename, post-token —
so a `rename` map value smuggling `../` or an absolute path is caught (design S3).

## 6. include/exclude dialect

Implement EXACTLY the spec-pinned dialect, REQ-FSC-03: "glob-style patterns (`*` =
any run of characters within a segment, `**` = any run of segments) matched against
the source-relative path. `exclude` WINS on overlap with `include`. MVP semantics —
this is a documented, deterministic dialect, not TBD." Hand-roll it — the repo has NO
glob library (deps: `ts-morph` only, `package.json` line 70-72) and none may be
added. Zero-entries-on-disk → silent no-op vs filters-eliminate-everything →
`invalid-input` naming the filters (REQ-FSC-04 — two DISTINCT outcomes, never
collapsed).

## 7. AuthoringError machinery (current shape + who grows what, when)

`src/core/authoring-error.ts`:
- `AuthoringVerb` (line 26): `"create"|"modify"|"remove"|"rename"|"move"|"copy"` — 6.
- `AuthoringReason` (lines 52-60): `path-collision, path-not-found,
  unrepresentable-content, changes-too-large, outside-run, unknown, invalid-input,
  reserved-name` — 8.
- `originFor` (lines 81-98): exhaustive switch over reason, `never` default.
- `CODE_TO_REASON` (lines 102-107): EmitRejection code → reason.
- `verbFor` (lines 112-114): `op === "delete" ? "remove" : op` — over `Directive["op"]`.
- `primaryPath` (lines 120-135): exhaustive switch over `directive.op` (source-side
  path per verb; `copy` → `copy.from`).
- `messageFor` (lines 147-175): templates by reason; `invalid-input`/`reserved-name`
  REQUIRE caller-supplied `message` (constructor `fields.message`, line 225).
- **S-002 grows the REASON side only** (8→12: the four `source-*` members; `originFor`
  arms under `authoring-rejected`; `messageFor` four new arms with the AEC-11 V3
  NEUTRAL templates — `"source file not found: {path} does not exist in the package"`
  etc., NO `"copy failed:"` prefix; `{path}` package-relative — these are derivable
  from `path`, so no caller-supplied message needed). Compile pin
  `test/types/authoring-reason.test.ts` extends to 12.
- **S-003 grows the OP/VERB side** (`AuthoringVerb` 6→7 `+"copyIn"`; `verbFor` passes
  `copyIn` through; `primaryPath` gains `case "copyIn": return directive.copyIn.from`).
  This CANNOT land in S-002: both switches are exhaustive over `Directive["op"]`,
  which gains `"copyIn"` only when S-003 mints the wire op.
- SDK-side PRE-emit `source-*` rejections carry `verb: undefined` (no wire directive
  exists yet; `scaffold` is NOT an AuthoringVerb member — design §Data Model).

## 8. Wire + factory patterns

`src/core/wire.ts` lines 28-34: `Directive` = 6-member discriminated union, each
`{ op: "<name>"; <name>: {...} }`. S-003 adds
`| { op: "copyIn"; copyIn: { from: string; to: string; force?: boolean } }`
(ADR-0043). `from` is **packageDir-RELATIVE on the wire, never absolute** (REQ-BRC-07;
the resolution anchor, NOT the ceiling — S2 seam pin). `src/core/directive-factory.ts`:
pure `args→Directive` methods + `forceEntry(force)` for key-omission semantics
(`"force" in directive === false` when undefined, lines 41-43); `copyIn(a)` mirrors
`copy(a)` (lines 90-99) exactly: `{ op:"copyIn", copyIn: { from, to,
...forceEntry(a.force) } }`.

## 9. Fake vs conformance vehicle — today, and exactly what S-003.4 adds

- `src/testing/contract-fake.ts`: two-phase, full-fidelity. `copy` branch (lines
  246-256) does `#requireExists(from)` + `#rejectIfCollides(to, effective)` +
  content copy into staging. **The `copyIn` branch is DIFFERENT**: destination
  collision check (`#exists(to) && !effective` → EmitRejection `collision`) +
  record-only — it NEVER reads package disk (no source check — ADR-0045 division of
  labor: SDK-side containment/stat is the `source-*` origin) and NEVER writes
  `#tree` (emit-only, REQ-ATH-15.1).
- `src/conformance/run-vehicle.ts`: `applyDirective` (lines 30-67) is thin/eager
  with **NO collision or existence machinery for ANY op** (`copy` at 60-66 applies
  silently, guarded only by `content !== undefined`). **S-003.4 adds collision
  machinery to the `copyIn` case ONLY**: `tree.has(to) && !force` → throw; emit-only
  (no tree write). Without it ATH-16.1 fake-parity fails on the collision fixture.
  Do NOT retrofit collision checks onto the other six ops — out of scope.

## 10. Dry-run shapes

`src/dry-run/plan.ts`: `DryRunVerb` (line 39) = same 6 strings as AuthoringVerb;
`DryRunEntry` (lines 51-54) = `{ verb, path }`; `WIRE_TO_AUTHOR_VERB` (lines 61-69) =
`Object.freeze`d total `Record<Directive["op"], DryRunVerb>` (delete→remove, identity
elsewhere); `dryRunPlan` (lines 83-95) switches over `d.op` for the path. Growth:
`DryRunVerb` +`"copyIn"`; 7th map row `copyIn: "copyIn"`; `copyIn` renders
`path: d.copyIn.from`. `kind?: "rendered" | "copied"` is OPTIONAL and present ONLY on
content-materializing entries: `create` → `"rendered"` (ALWAYS — inline or
templateFile, DRE-05.3 indistinguishability), `copyIn` → `"copied"`; **ABSENT** for
modify/remove/rename/move/copy (design A4: tagging a plain remove would lie). Derived
purely from op — total, deterministic. S-000 ships `kind` for `create`; S-003 the
`copyIn` half.

## 11. Containment ordering (design rev 2, pinned — quote)

From design §Classification pipeline step 1, normative: "lexical `../`/absolute
screen → resolve + segment-aware ceiling check → (out-of-ceiling ⇒
`source-outside-package`, NO existence probe, PRC-07) → realpath. ENOENT ordering
(S1): on realpath ENOENT, `source-not-found` may be concluded ONLY AFTER the NEAREST
EXISTING ANCESTOR's realpath is proven in-ceiling; if that ancestor resolves outside
the ceiling, the verdict is `source-outside-package`." Segment-aware = ceiling + path
separator boundary, never bare `startsWith` (PRC-04.5 sibling-prefix kills it).
Case-fold segment comparison on case-insensitive platforms ONLY (product-ruled, Q24);
canonical-form hardening (UNC/device/reserved-DOS/drive-relative) is ENGINE-side
(BRC-08) — do not implement it SDK-side. Then `lstat` allow-list: `isFile()` only,
else `source-not-regular-file` (allow-list, never a directory blacklist — PRC-04.4
FIFO). Only after ALL of this may content be read (PRC-08).

## 12. PRC-09 destination guard

LEXICAL ONLY — no realpath (the destination may not exist yet). Applied to the FINAL
SDK-computed destination (post-rename, post-token-translation, immediately pre-emit).
Rejects a literal `../` segment and absolute paths → `invalid-input`. The engine's
post-render check (PRC-06/BRC-08) is the real control for rendered forms the SDK
cannot evaluate.

## 13. Commons signatures

`src/commons/index.ts`: existing `create(path, opts)` is positional-path + options
object with a typed overload (lines 145-159), returns `WritableHandle`. New surface:
- `scaffold(cfg): void` — `cfg = {from, to, options?, include?, exclude?, rename?,
  force?}` (REQ-FSC-01; defaults there).
- `copyIn(from, to, opts?: {force?: boolean}): void` — positional, mirroring
  `copy(from, to, opts?)` (line 227) minus the handle. **`void` rationale (T2, pinned
  scenario FEH-04.3)**: a `WritableHandle` chains over tree CONTENT; a by-reference
  destination's bytes exist only after the ENGINE applies — a handle would lie (the
  fake never materializes it). The asymmetry with `copy` is deliberate and must be
  documented in JSDoc.
- `create(path, { templateFile, options, force? })` — a THIRD overload alongside the
  existing two; `template` and `templateFile` are mutually exclusive forms. Thin
  wrappers only: all logic lives in `src/scaffold/` reached via `currentContext()`
  (FIT-01 allows `commons → ../scaffold → node:fs` — the rule bans external PACKAGES,
  not `node:` builtins; verified in design §Fitness).

## 14. The `collection.json` migration sites (S-000.3) — verified setup helpers

Static fixtures (marker file goes in or above the fixture dir):
1. `test/fixtures/typed-factory/` (consumed by `test/e2e/typed-factory.e2e.test.ts`
   and FIT-12/16 via `test/support/scan-roots.ts`).
2. `test/fixtures/harness-opted-in/` (consumed by `test/fake/harness-opted-in.test.ts`
   — which, note, is STATIC-fixture-based despite sitting in the design's temp-dir
   list; marker in the fixture dir covers it).

Temp-dir suites + their verified setup sites (a repo-level marker CANNOT cover these):
3. `test/security/canary-no-echo.test.ts` — local `mkdtempSync(join(tmpdir(),
   "canary-"))` helper at line ~41.
4. `test/skeleton/run-boundary-validation.test.ts` — seeds via `seedSchema(dir, ...)`
   from `test/support/canary.ts` (lines 20-27: `mkdirSync` + `writeFileSync`).
   **Seeding the marker inside `seedSchema` itself covers every suite that uses it —
   the highest-leverage single edit.**
5. `test/skeleton/reserved-lifecycle-names.test.ts` — local `scratchDir()` helper.
6. `test/fake/harness-opted-in.test.ts` — static fixture (see 2), BUT its
   `isDeclaredOptedInRead` predicate (line ~141) pins the EXACT allowed fs events
   (`readdirSync` arg === FIXTURE_DIR, `readFileSync` arg === SCHEMA_PATH). The
   S-000 ancestor walk adds NEW fs calls (stat/exists probes of ancestors) that will
   surface as UNDECLARED events → **this predicate MUST widen in S-000.3** or the
   suite reds for the wrong reason.
7. `test/fake/harness-in-memory-invariant.test.ts` — current factories never pass
   `packageDir` (strict zero-event floor, header lines 17-26), so S-000 may not touch
   it; the ATH-14 widening (S-005.1) adds opted-in scenarios that DO need a marker.
8. `test/fitness/fit-12-schema-parity.test.ts` — `mkdtempSync` scratch at line 81.
9. `test/fitness/fit-16-reserved-name-scan.test.ts` — no temp dirs found in code; its
   exposure is via the `typed-factory` static fixture in `ALWAYS_ON_SCAN_ROOTS`.

The design-rev-2 list of 2+7 is BINDING as the checklist; where a listed suite turns
out not to exercise `defineFactory({packageDir})` at S-000 build time, record the
no-op finding in apply-progress rather than forcing an edit.

## 15. Symlink policy

Detection is **`lstat`-based, never `stat`** (stat follows the link and reports the
TARGET's type, defeating non-descent — design S4, a `walk.ts` contract requirement).
Symlinked DIRECTORIES: never descended, even when the target is in-ceiling
(FSC-09.1 — skip silently, no error). Symlinked FILES: follow realpath containment —
in-ceiling target → eligible; out-of-ceiling → `source-outside-package` (PRC-04.7);
broken symlink to out-of-ceiling target → `source-outside-package`, NEVER
`source-not-found` (PRC-07.2 ENOENT-after-ancestor-proof). 10,000-entry walk bound
breach → `invalid-input` naming the bound (FSC-09.2; fixture may drive the bound via
an injected/test-scoped limit).

## 16. Fitness gates touched + baseline regeneration

- **FIT-04** (`test/fitness/fit-04-dts-semver-gate.test.ts`): diffs built `.d.ts`
  against `test/fitness/dts-baseline/*.d.ts`; removals = breaking, additions OK.
  Regen is MANUAL (documented in its header, lines 19-25): `bun run build`, then copy
  each `dist/**/*.d.ts` over its committed counterpart (mapping listed there —
  `dist/commons/index.d.ts` → `commons.index.d.ts`, etc.). No npm script exists.
- **FIT-14** (`fit-14-package-surface.test.ts`): diffs live package surface
  (package.json exports/deps/files/bin + `bun pm pack --dry-run` listing) against
  `test/fitness/pkg-surface-baseline.json`; update = edit that JSON to the authorized
  new surface.
- **FIT-12** (`fit-12-schema-parity.test.ts`): schema↔generated-type digest parity
  over `ALWAYS_ON_SCAN_ROOTS` (`test/support/scan-roots.ts`).
- **FIT-16** (`fit-16-reserved-name-scan.test.ts`): structural reserved-name scan +
  untethered-`defineFactory` substring signal over the same roots.
- Test/typecheck commands: `bun test`, `bun run typecheck` (package.json lines 59-63).

## 17. ATH allow-list mechanism + the ATH-14 widening

Today: `test/fake/harness-opted-in.test.ts` arms blanket pass-through spies on every
function-typed export of `node:fs`/`node:net`, Bun I/O members, `fetch`, plus
env/argv Proxy GET counters (`instrumentHarnessIO`, lines ~92-135); the allow-list is
the `isDeclaredOptedInRead(event)` predicate (line ~141) matching exactly two
(surface, key, arg) tuples. `harness-in-memory-invariant.test.ts` uses the same rig
with NO predicate (strict zero floor — its factories never opt in). **ATH-14
(S-005.1) widens by RESOLVED PATH, not by call name**: any factory-attributable
`node:fs` read whose resolved target lies within the run's resolved collection root
(`packageRoot`) is observed-not-flagged; reads outside the root, reads attributable
to harness machinery (ATH-14.2), and every other surface still fail closed.

## 18. `expander.ts` role (single owner of the fan-out)

`expander.ts` owns walk → filename-pipeline → classify → emit: it drives `walk.ts`,
applies `filename-pipeline.ts` per entry, calls `classify-transport.ts` for the
per-file verdict (classify stays a PURE per-file decision), and emits via
`currentContext().session.buffer(factory.create(...))`. In S-001, its handling of a
by-reference verdict is the FAIL-LOUD THROW; **S-003.3 swaps that throw site (in
expander, not in classify) for `factory.copyIn(...)` emission**. S-004's
serialized-size accumulator + `session.flush()` between groups also lives in
expander. `readTemplateFile`/`runCopyIn` orchestrators live in `scaffold/index.ts`
and share containment + classify with expander.

## 19. Product rulings (settled — do not re-open)

- **Q21 — copyIn is reference-only everywhere, fake/vehicle included** (obs #915
  rulings 9/16): no simulation surface ever materializes by-reference bytes; a test
  asserting them is a review-reject (BRC-04, enforced by S-005.3's evidence-boundary
  scan).
- **Q22 — chunking floor**: the acceptable v1 minimum is fail-loud on an over-cap
  single group (REQ-04.2 unchanged behavior); auto-chunking sophistication is the
  cuttable part. MEASUREMENT (the serialized-size accumulator) and COMPLETENESS
  (one directive per enumerated file — none dropped/duplicated/reordered, REQ-04.1)
  are NON-cuttable.
- **Q23 — seam-row acceptance wording** (design §Migration, S5, verbatim): "three
  `openspec/pending-changes.md` rows, owner = engine repo, siblings to row 186, MUST
  exist before this change archives: (1) BRC-02 — engine ceiling re-derivation +
  open-then-fstat TOCTOU closure; (2) BRC-08 — UNC/device/reserved-DOS/drive-relative
  rejection + single-pass literal-token render; (3) PRC-06 — post-render destination
  containment. Registering them is a named acceptance criterion of the final slice,
  not prose intent." The owner signs at the archive gate.
- **Q24 — case-folding**: segment comparison case-folds on case-insensitive platforms
  ONLY; canonical-form hardening is engine-side (BRC-08). Settled at design (S4).
- **Q25 — intermediate states**: slices land as commits on the feature branch; the PR
  opens after the change completes (established project practice — every prior stage
  shipped this way). A slice may leave the suite green with the change incomplete;
  that is expected, not a defect.
