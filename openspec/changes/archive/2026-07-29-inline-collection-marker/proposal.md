# Proposal: Remove SDK-Side Containment Enforcement (`inline-collection-marker`)

**Triage**: L · **Persona lens**: none (council synthesis + council review are the binding inputs) · **Spec source**: internal
**Revision**: V2 — amended after council review `yes-with-fixes` (BA, PM, architect) and **owner ruling 5**.
**Spec-phase addendum (2026-07-28)**: owner rulings 6/7/8 authorize the spec's V3
micro-unfreeze (signed-on-write) — ruling 6 pre-authorizes the V3 delta set; ruling 7
renames `marker-free-run-bootstrap` → `package-dir-run-anchor` (REQ prefix `MFB`
unchanged); ruling 8 brings the pre-existing recursive-walk no-echo gap in scope as a
conscious ride-along (`folder-scaffold` REQ-FSC-10.4). Rulings 9-13 (same addendum,
signed-on-write): ruling 9 decides `SECURITY.md`'s five-point trust posture (normative
home: `package-source-io-hygiene` REQ-PSH-05); ruling 10 upgrades the REQ-BRC-02
ENGINE-GATED retirement to first-hand owner verification; ruling 11 adds fitness-guards
REQ-FTG-06 clause (f) (zero `realpathSync`/`realpath` outside the allowlisted symbol);
**ruling 12 ships the version bump `package.json` 0.1.0 → 0.2.0 IN this change** —
wherever a delta references the CHANGELOG preamble/entries, they are written against
`0.2.0`, never "Unreleased" (normative home: `package-dir-run-anchor` REQ-MFB-02); ruling
13 closes plan-verify iteration 2's six scope findings (F1/F2/F4/F5, Q4/Q5) via targeted
spec deltas — see `verify-plan-2.md`.

**Plan-verify closure (owner ruling 14, 2026-07-28)**: `verify-plan-3.md` (iteration
3/3, FINAL) returned verdict `gaps → plan-verify-failed` after 3 iterations exhausted —
problem-fit was CLEAN across all three consecutive judge passes; every remaining finding
(A1-A5, B1-B9) was traceability/accounting or doc-wording, ZERO design flaws, ZERO
executor-blocking unknowns about the code. Per the protocol's escalation options, the
OWNER declared **ready-with-known-items** and closed the plan-verify gate by override
rather than commissioning a fourth judge round (all remaining items were deterministic
bookkeeping — the batched V3.3 fix list below IS the fix, not new analysis). This is a
recorded override, not a passed gate: `sdd-design`/`sdd-slice` proceed on the strength
of 3 clean problem-fit judgments + this batched mechanical closure;
`sdd-verify --mode=final` is the net that catches anything this override missed.

**Ruling 15 (same override, 2026-07-28, V3.3)**: closes the plan-verify-3 spec-side
subset (B9, B1, B4, B5, A3, A5) via targeted deltas — see `verify-plan-3.md`. The
slice-side subset (A1, A2, A4, B2/B3, B6, B7, B8) is `sdd-slice`'s to close, not spec's;
recorded here so the split is explicit, not silently dropped.

This proposal's own `Revision` field stays V2 —
these are spec-artefact rulings, not a proposal re-authoring.
**Pre-declared for design**: `architecture_impact: breaking` (see Approach — design MUST NOT under-call this to `modifying`).

## Intent

Every SDK factory run in a CLI inline-collection project dies before the factory body executes:
`AuthoringError invalid-input: "no collection.json found at or above <dir>"`. The whole collection
lives inside `project-builder.json`; no `collection.json` ever exists on disk, so
`resolvePackageRoot`'s ancestor walk (`src/core/context.ts:199-217`, ADR-0046) never terminates
successfully. **Why now: this is a hard blocker for every inline-collection project, discovered in
real use** (triage.md:23) — not a latent defect but a total failure of a supported CLI mode.

The marker walk exists to derive a containment ceiling — a responsibility the SDK cannot correctly
hold: it may not parse the manifest (charter L2), so it guards a boundary it cannot define, via a
presence-marker hack that inline mode breaks. We remove the mechanism instead of widening the marker.

**Honest justification** (the old one is false): REQ-BRC-02's engine-side re-derivation covers
**by-reference** directives (paths on the wire) only. **By-value** content (`create({templateFile})`,
by-value scaffold entries — `src/core/wire.ts:29-39`, `classify-transport.ts:132`,
`expander.ts:171-176`) reaches the engine as bytes with no provenance; there is nothing to re-derive
against, and there never was engine coverage for it. The reason the SDK-side ceiling is safe to
delete is that the factory is arbitrary in-process code holding full `node:fs`
(`src/transport/runner.ts:271`, `src/core/context.ts:395`) — **the SDK can never be a security
boundary against its own author**. SDK-side containment was DX/attribution theatre (the retiring
spec's own words, `package-root-containment/spec.md:47-48`).

### Boundary ownership by path class (the positive statement — use this, not a prohibition)

| Path class | Boundary control | Owner |
|---|---|---|
| By-reference (path crosses the wire) | Apply-time ceiling re-derivation, REQ-BRC-02 | Engine |
| By-value / inline content (bytes cross the wire) | **No boundary control**; lexical screen only, trusted-author v1 | SDK (hygiene, not security) |
| Destinations | Lexical guard at emit + post-render containment | SDK (lexical) + engine (apply) |

## Author-Visible Behaviour Change (before → after)

Under **owner ruling 5** the lexical screen is UNIFIED: one predicate, three call sites, `../` **and**
absolute rejected everywhere.

| Verb | Source form | Before | After | Timing |
|---|---|---|---|---|
| `create({templateFile})` | `../x` | rejected `source-outside-package` (realpath ceiling) | **rejected** (lexical screen) | emit-time → emit-time |
| `create({templateFile})` | `/abs/x` | rejected `source-outside-package` | **rejected** (lexical screen) | emit-time → emit-time |
| `scaffold({from})` | `../x` | rejected `source-outside-package` before walk | **rejected** before walk (ordering preserved) | emit-time → emit-time |
| `scaffold({from})` | `/abs/x` | rejected `source-outside-package` | **rejected** (lexical screen) | emit-time → emit-time |
| `copyIn(from)` | `../x` | rejected `source-outside-package` | **rejected** (lexical screen) | emit-time → emit-time |
| `copyIn(from)` | `/abs/x` | rejected `source-outside-package` | **rejected** (lexical screen) | emit-time → emit-time |
| any verb | in-package via `../shared/` symlink escape | accepted (realpath resolved inside high ceiling) | **CORRECTED (2026-07-28, spec V2) — still accepted, WIDER**: ruling 5's screen is lexical-only and cannot see through a symlink; this case is unaffected by it and remains accepted, now via a broader mechanism (no ceiling exists at all, vs. previously being checked against a real ceiling). See `package-source-io-hygiene` REQ-PSH-04 for the residual-risk framing and its positive tripwire scenario. | emit-time |
| any verb | in-package `sub/x` that exists | accepted | accepted (unchanged) | — |
| any verb | in-package `sub/x` missing | `source-not-found` | `source-not-found` (unchanged) | emit-time |
| by-reference path escaping at apply | engine re-derivation | engine re-derivation (unchanged) | apply-time |

**Spec must pin the reason and message the ruling-5 screen mints.** Proposed (spec to ratify):
reason `invalid-input`, message styled on the existing `destinationEscapeMessage`
(`containment.ts:271`) — package-relative path only, no-echo, `instanceof AuthoringError`.
Author-facing rule to document verbatim: *"the SDK rejects lexical `../` or absolute source paths,
always; everything a schematic reads lives inside its package."*

## Scope

### In Scope

- Delete `resolvePackageRoot` + the marker ancestor walk + missing-marker fail-loud; collapse
  `packageAnchors {packageDir, packageRoot}` to `packageDir` as the sole run anchor.
- **Delete + New** on `src/scaffold/containment.ts`. Deleted with the ceiling: `isWithinCeiling`,
  `resolveRealCeiling`, `validateSourceContainment` (today's `{absPath, stat}` producer — it is
  realpath-based, so it dies rather than survives), `validateSourceRootContainment`, `fold`,
  `nearestExistingAncestorRealpath`, `resolveBrokenSymlinkTargetRealAncestor`,
  `resolveContainedRealpath`. **New** in `source-resolve.ts`: `resolveSourceForRead()` returning
  `{absPath, stat}` with `absPath = resolve(join(packageDir, relPath))` — lexical, **no realpath**.
  Moving across unchanged: `isLexicallyEscaping`, `sourceRejection`, `destinationEscapeMessage`,
  `validateDestinationLexical` (owner ruling 2).
- **Ruling-5 unified lexical screen at exactly THREE call sites** (this list is normative; Scope and
  Affected Areas must not diverge):
  1. `readTemplateFile` — `src/scaffold/index.ts:63`
  2. scaffold root `from` — `src/scaffold/expander.ts:117`, **replacing** `validateSourceRootContainment`
     and **preserving the owner-ratified check-before-walk ordering** (`expander.ts:110-116` states
     why: an escaping `from` must never be enumerated before the check fires)
  3. `runCopyIn` `from` — `src/scaffold/index.ts:114`
- Re-home the guards the deletion must NOT take with it (R1-R7) — see the R-table below.
- Drop marker fabrication in test support (`test/support/scratch-dir.ts:34`,
  `test/fixtures/author-emulation/factory.ts:175`) and the `conformance/collection.json` fixture.
- Public-API delta: `AuthoringReason` closed union **12 → 11** (`source-outside-package` removed;
  the other three `source-*` reasons SURVIVE), FIT-04 `.d.ts` baseline updated in the SAME commit.
- Reconcile the six spec families (below); publish ADR-0077.
- Fitness functions FIT-NEW-A / FIT-NEW-B / FIT-NEW-C; extend `canary-no-echo` to the scaffold and
  `copyIn` source branches; add ELOOP/symlink-cycle no-echo coverage.
- Cross-repo handoff to the engine team (deliverable, see Dependencies).

### Re-home Table (R1-R7)

| # | Guard | Destination | Rationale after re-home |
|---|---|---|---|
| R1 | regular-file allow-list | `package-source-io-hygiene` | stops FIFO hang / `/dev/zero` — IO safety, never containment |
| R2 | guarded stat → `source-not-found`/`source-unreadable`, package-relative, no-echo | `package-source-io-hygiene` | REQ-BRC-06.1 for `copyIn`; error-contract obligation |
| R3 | lexical absolute-path screen on emitted source paths | `ir-path-well-formedness` | REQ-BRC-07 — absolute never on the wire |
| R4 | `validateDestinationLexical` | `ir-path-well-formedness` | IR well-formedness (owner ruling 2) |
| R5 | 10k entry-count bound | **already home**: `folder-scaffold` REQ-FSC-09.2 | rationale rewrite only → loop-safety / DoS bound |
| R6 | symlink-dir non-descent | **already home**: `folder-scaffold` REQ-FSC-09.1 | rationale rewrite only → **enumeration determinism + cycle safety** |
| R7 | `rootReadFailure` no-echo + `rootRelPath` threading | **genuine re-home** → `folder-scaffold` | currently a REQ-PRC-10.3 amendment; new REQ-ID in destination |

> **Architect fix 7, corrected on verification**: R5 and R6 do **not** need re-homing — they already
> live in `folder-scaffold` as REQ-FSC-09.2 / REQ-FSC-09.1. What they need is a **rationale rewrite
> in place**, because their current text derives them from the ceiling: `folder-scaffold/spec.md:191`
> ("REQ-PRC-04's no-descent rule"), `:196` ("**In-ceiling** symlinked directory…"), `:215` (Sensitive
> Areas row citing `input validation / containment`), and `walk.ts:86` ("even when their target
> resolves inside the containment ceiling"). Only **R7** is a true re-home. The architect's intent —
> explicit homes + non-containment rationales — is fully honoured; the mechanism differs.

### Out of Scope

- Any CLI/engine-repo **code** change (owner ruling 1: engine enforcement is LIVE — no sequencing gate).
  Note this is *not* the same as "no engine-team handoff" — see Dependencies.
- Parsing any manifest file (charter L2 stands).
- New public API options.
- `src/transport/single-instance-probe.ts`'s `packageRootFor()` — UNRELATED npm-package-root walk (grep hazard).
- Symlink-based escape from `packageDir` beyond the lexical screen — accepted residual (see Risks).
- Fixing the four ADR-numbering collisions (see Followup Accounting).

## Capabilities

### New Capabilities

- `package-dir-run-anchor` (renamed from `marker-free-run-bootstrap`, owner ruling 7,
  2026-07-28, positive invariant naming; REQ prefix `MFB` stays historical/unchanged):
  `packageDir` is the sole run anchor; no ancestor marker walk.
- `package-source-io-hygiene`: existence / regular-file / readable + no-echo across **all three read
  verbs** (renamed from `scaffold-source-io-hygiene` — it binds `copyIn`'s REQ-BRC-06.1 and
  `readTemplateFile`, not just scaffold).
- `ir-path-well-formedness`: destination lexical guard, absolute-never-on-wire, ruling-5 source screen.

### Modified Capabilities

- `package-root-containment`: RETIRED — ceiling derivation and enforcement removed.
- `run-boundary-input-validation`: REQ-RBV-06 / 06.1 lose the "no opt-out for containment" clause;
  bootstrap read-set 3 → 2.
- `by-reference-copy-wire`: REQ-BRC-06 / 06.1 / 07 re-anchored on surviving checks — **NOT retiring**.
- `conformance-self-check`: REQ-CSC-02.3 marker rule removed.
- `conformance-corpus`: REQ-CCR-08 reconciled; corpus marker + fixtures deleted (see M-16 correction).
- `scenario-matrix`: REQ-PRC-04/06/07 references updated.
- `folder-scaffold`: R5/R6 rationale rewrite + R7 re-home destination.
- `authoring-error-contract`: REQ-AEC-10 union 12 → 11.
- `fitness-guards`: FIT-04 baseline + FIT-NEW-A/B/C.
- `golden-corpus-contract`: **ADDED at spec V2** (blind-council security-blocking finding,
  not originally pinned at propose time) — REQ-GCC-08's coverage-manifest checklist drops
  the `REQ-PRC-06` literal (five → four required NOT-EXERCISED entries); as originally
  specified, this change would have failed its own final-verify completeness gate.
- `conformance-fixtures`: marker cross-reference at the `m2-copyin` seam note (~:580) only.
  **Reconciled (spec V2)**: this is deliberately NOT a formal delta file — reproducing
  REQ-CFX-16's entire ~90-line requirement (all five scenarios, fixture layout, case
  table) to fix one cross-reference sentence would violate the "partial MODIFIED is
  destructive" rule. It is treated as prose/doc cleanup, owned by this proposal's own
  `rg -F 'source-outside-package'`/marker-reference falsifiable criterion (Success
  Criteria, below) and `package-root-containment`'s post-archive-sync `rg` criterion —
  not a spec-level requirement change. `openspec/changes/inline-collection-marker/specs/`
  therefore has 13 files total: 3 new capabilities + 9 delta families (the 10 named
  above, minus `conformance-fixtures` which has none) + `golden-corpus-contract` (added
  at spec V2, a 10th delta family not in the original propose-time list).

> **The binding SIX reconciliation families, corrected (PM fix 12, verified)**:
> `package-root-containment`, `run-boundary-input-validation`, **`conformance-self-check`**,
> `conformance-corpus`, `by-reference-copy-wire`, `scenario-matrix`.
> **V2 addendum**: `golden-corpus-contract` joins as a SEVENTH touched family, surfaced
> during blind spec council review (not at propose time) — a delta destination
> (REQ-GCC-08 citation fix), not a "reconciliation" in the sense the six below are; the
> "binding SIX" language is left as historical record of the propose-time-verified set,
> not restated as seven.
> REQ-CSC-02.3 is owned by `conformance-self-check/spec.md:70` — the council synthesis attributed it
> to `conformance-fixtures`, which is wrong. **Partial pushback**: the review also claimed a
> `conformance-fixtures:581` cross-ref to REQ-CSC-02.3; `rg "REQ-CSC-02.3" openspec/specs/` returns
> exactly ONE hit repo-wide. `conformance-fixtures` does carry a *marker* touchpoint near :580 (the
> `m2-copyin` seam note citing "`conformance-corpus` REQ-CCR-08's `collection.json` note") — recorded
> above as such. The other four capabilities are re-home / delta destinations, not reconciliations.

### Re-home REQ-ID Rule (binding on spec)

A re-homed requirement gets a **NEW REQ-ID in its destination family**; the source REQ is **retired
with a pointer**. Normative text never lives in two families simultaneously.

## Approach

This is the responsibility move the baseline's IR seam already implies: the SDK produces IR; where
the boundary lies is an apply-time decision. The change deletes ceiling derivation (`context.ts`) and
ceiling comparison (`containment.ts`), and re-homes what was never containment — IO hygiene and IR
well-formedness. The shared-vs-inlined shape of the hygiene helper and the `stat`-vs-`lstat` choice
are **decided inside ADR-0077 as sections**, not as separate ADRs.

**`architecture_impact: breaking`** is pre-declared and design must not soften it: a public closed
union shrinks (12 → 11), a documented architecture-layer artefact (`conformance/collection.json`) is
deleted, and `architecture.md` lines 20 / 89 / 104 all describe machinery this change removes.

### ADR-0077 (required skeleton)

- **Supersedes ADR-0046 AND ADR-0067** (`0067-collection-json-package-anchor-marker.md` justifies the
  exact file being deleted — and its own text proves engine-safety: *"the SDK reads it, never the
  engine's Go loader"*). Amends ADR-0045's division of labour. Design sanity-check: ADR-0051 / 0063 /
  0073 also reference the marker.
- **Context**: (a) charter L2 no-parse → presence-marker hack → inline incompatibility; (b) in-process
  author code is uncontainable (`runner.ts:271`, `context.ts:395` carry this claim **alone** — the
  weak `problem-statement.md:91` citation is dropped); (c) BRC-02 covers by-reference only, by-value
  never had engine coverage.
- **Boundary table**: reproduce the per-path-class table from Intent (positive statement, not a
  "never write X" prohibition).
- **Alternatives rejected**: (1) dual-marker; (2) **optional-marker fail-open** — the minimal fix,
  rejected because it keeps the misplaced responsibility alive; (3) **parse the manifest** — rejected,
  charter L2; (4) `ceiling = packageDir` — rejected on **scope/purpose** grounds (it retains SDK-side
  containment under a new anchor). *Correction: the previously-recorded reason "REQ-PRC-01.1's layout
  breaks" is false — REQ-PRC-01.1's source is INSIDE `packageDir`. Note that ruling 5 makes the
  resulting narrowing deliberate and chosen, rather than an accidental side effect.* (5)
  lexical-guards-as-containment-substitute — declined as a *substitute*; ruling 5's screen is scoped
  to the SDK's own reads, a different purpose.
- **Consequences**: (+) inline collections run; (+) bootstrap read-set 3 → 2; (−) the residual-risk
  paragraph **verbatim**; (−) TWO breaking changes — union 12 → 11 **and** the ruling-5 narrowing;
  (−) symlink escape accepted.
- **Section: `stat` vs `lstat`** — must carry the symlink behaviour matrix and demand a spec scenario
  for *"in-package symlink → in-package regular file"*. Non-obvious input: today's code does
  `realpathSync` **then** `lstatSync` on the resolved path (`containment.ts:211-232`), which behaves
  like follow-then-reject-non-file. Dropping realpath changes this; the matrix must state the new
  verdict explicitly rather than inherit it.
- **Section: shared helper vs per-call-site inlining** — with ruling 5 mandating one predicate at
  three sites, the shared shape is now strongly indicated (and FIT-NEW-C enforces it).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/context.ts` | Modified | `resolvePackageRoot` + walk deleted; `packageAnchors` → `{packageDir}` |
| `src/scaffold/containment.ts` | **Deleted** | ceiling machinery + realpath helpers die with it |
| `src/scaffold/source-resolve.ts` | **New** | `resolveSourceForRead()` (lexical `{absPath, stat}`) + moved `isLexicallyEscaping` / `sourceRejection` / `destinationEscapeMessage` / `validateDestinationLexical` |
| `src/scaffold/index.ts` | Modified | screen sites 1 (`:63` `readTemplateFile`) and 3 (`:114` `runCopyIn`) + re-homed hygiene |
| `src/scaffold/expander.ts` | Modified | screen site 2 (`:117`), replaces `validateSourceRootContainment`, check-before-walk ordering preserved |
| `src/scaffold/classify-transport.ts` | Modified | drop `packageRoot`/`realCeiling` params; keep CCL-06 stat reuse (`:119,:123`) |
| `src/scaffold/walk.ts` | Modified (comment) | `:86` ceiling-derived rationale rewritten to determinism/cycle-safety |
| `src/core/authoring-error.ts` | Modified | union 12 → 11; three `source-*` reasons stay |
| `src/transport/single-instance-probe.ts` | Read-only | `packageRootFor()` unrelated — must NOT be touched |
| `test/**` (scaffold, e2e, fake, security, fitness, support, fixtures) | Modified/Deleted | est. ~13 suite rewrites; `canary-no-echo.test.ts:43-48`, `harness-in-memory-invariant.test.ts:108`; `harness-opted-in` read-set stays ORDERED |
| `conformance/collection.json` + corpus fixtures + coverage-manifest | Deleted/Modified | see the four named deletions in Success Criteria |
| Docs & cross-repo: `docs/authoring-verbs.md` (`:71,:191,:269`), `docs/authoring-errors.md` (`:81` switch sample), `CONFORMANCE-CORPUS-HANDOFF.md:107-119`, `conformance/README.md:55`, `docs/engine-sdk-wire-design.md`, `SDK-EXIT-CODE-CONFIRMATION.md:55`, `openspec/decisions/0067-*.md`, `CHANGELOG` | Modified | public + cross-repo surfaces naming the reason or the marker |

## Risks

**Security residual-risk statement (carry verbatim into spec/design/ADR)**:

> SDK-side containment is removed. Against a hostile factory author this loses nothing (in-process
> code, full fs access — the ceiling never constrained it). The engine's apply-time re-derivation
> covers path-carrying directives only. The SDK's own inline-content reads keep a minimal lexical
> screen (`../`/absolute rejected at the two read sites); symlink-based escape from packageDir
> remains possible and is accepted (v1 trusted-author model). Preserved as IO hygiene independent of
> containment: regular-file allow-list, AuthoringError-with-relative-path on every source rejection
> (no-echo), lexical destination guard, absolute-never-on-wire, walk loop-safety bounds. Error-reason
> differences form a filesystem existence/permission oracle — accepted, documented.

> **Dated amendment (owner ruling 5, 2026-07-28 — discharged in spec V2)**: the paragraph above says
> "the two read sites" — pre-ruling-5 language. Ruling 5 unifies the lexical screen across THREE call
> sites, and the accepted symlink-escape residual WIDENS accordingly: it now covers BOTH path classes —
> (a) inline/by-value content reads AND (b) by-reference SOURCES crossing the wire (`copyIn`'s `from`,
> a by-reference `scaffold` entry) — an in-package symlink pointing outside `packageDir` reaches the
> wire UNFILTERED for by-reference directives too, not only for inline content. This is wider than the
> original paragraph's scope: previously a by-reference source's containment was realpath-checked
> against a (possibly higher) ceiling; now there is no ceiling check for it at all, only the ruling-5
> lexical screen, which cannot see through a symlink. Carried verbatim (with this amendment) into
> `package-source-io-hygiene` REQ-PSH-04.

> **Correction (2026-07-28, spec V2, self-verified against `src/scaffold/containment.ts`
> and this proposal's own Before/After table above)**: this row's original framing
> ("DECIDED breaking change... CHANGELOG line, migration framing") is WRONG. The
> `packages/foo → ../shared/` case that actually flips is the SYMLINK-escape row above,
> which ruling 5's lexical screen cannot detect (it inspects only the literal input
> string) — that case remains ACCEPTED before and after this change, just via a wider
> mechanism (no ceiling at all, vs. a real one previously). There is no migration to
> write and no CHANGELOG line to add for a "narrowing" that does not occur. Every
> LITERAL `../`/absolute string form (the OTHER rows in the table above) was ALREADY
> rejected before this change (`containment.ts`'s `isLexicallyEscaping` step ran
> unconditionally, independent of the ceiling) and remains rejected — no narrowing there
> either. The row below is retained for traceability but its Mitigation column no longer
> describes real work.

| Risk | Likelihood | Mitigation |
|---|---|---|
| ~~Ruling-5 narrowing breaks existing `packages/foo → ../shared/` authors~~ — **corrected: no such narrowing exists** (see correction above) | ~~High~~ N/A | ~~DECIDED breaking change...~~ Superseded — the accepted-symlink-escape residual is documented instead (`package-source-io-hygiene` REQ-PSH-04) |
| Silent loss of a re-homed guard (R1-R7) | High | R-table is normative; TDD flips tests RED before deleting; FIT-NEW-B proves surviving reasons stay mintable |
| Vacuous-pass in the new regression test (helper seeds the marker) | High | own `mkdtemp`, never `scratchDirFactory`, explicit `existsSync(...) === false` precondition |
| Deleting M-16 would delete ruling-5's own coverage | Medium | **M-16 is RETAINED and re-cited** — see the correction below |
| Symlink escape from `packageDir` past the lexical screen | Medium | Accepted residual, documented verbatim above |
| Blind grep/rename hits `single-instance-probe.ts` | Medium | Explicitly out of scope; FIT-22 re-run post-rename |
| `walk.test.ts` 10k-bound arithmetic counts the seeded marker | Medium | Fix the arithmetic; a lazy bound-bump would silently weaken R5 coverage |
| Ceiling machinery regrows under a new name | Medium | FIT-NEW-A + FIT-NEW-C |
| FIT-04 baseline drifts from the union shrink | Low | Same-commit update is a success criterion |

### Correction to the council synthesis: M-16 survives

The synthesis (written **before** ruling 5) instructed "fixtures m-16/m-17 deleted, m-18 kept".
Verified: `scenario-matrix/spec.md:63` M-16 = *"GIVEN `../` and absolute source paths WHEN called
THEN both reject"* — **that is precisely the behaviour ruling 5 mandates**. Deleting M-16 would
delete coverage of the new screen. Corrected instruction for spec:

- **M-16 — RETAIN, re-cite** (rationale moves from `REQ-PRC-04.1/04.6` containment to the ruling-5
  lexical screen; the "containment cited" clause in its THEN must be rewritten).
- **M-17 — DELETE** (`:64`, "identical `source-outside-package` shape") — correct: the reason is
  removed and the residual-risk paragraph now explicitly *accepts* the existence oracle it guarded.
- **M-18 — KEEP** (`:65`, REQ-BRC-06.1 `source-not-found`) — unchanged.

## Rollback Plan

Deletion-heavy, single-branch, no persisted state, no migration, no wire-shape change — so
`git revert -m 1 <merge-sha>` restores in one step: `containment.ts`, `resolvePackageRoot`/
`packageAnchors`, the 12-member union, the FIT-04 baseline, `conformance/collection.json`, and the
deleted corpus fixtures.

**Partial rollback is NOT safe**: code and `.d.ts` baseline must revert together (FIT-04 fails on a
mismatch); reverting only spec/ADR prose leaves the specs claiming a ceiling the code no longer has.
Revert the whole merge or nothing.

**Validating a rollback**: `bun test` green; `tsc --noEmit` clean; `rg -F 'collection.json' src/`
returns the pre-change hit set; `core.authoring-error.d.ts` shows 12 members;
`run-boundary.test.ts`'s missing-marker fail-loud assertion passes again.

**Unrecoverable**: factories authored during the window relying on the relaxed behaviour break on
revert. **Ruling 5 shrinks this exposure** — the narrowing means fewer newly-accepted inputs exist to
depend on. Bounded further: only `0.0.0-dev.<sha>` prereleases publish from `main`, no stable tag.

## Dependencies

**No engine code change.** Owner ruling 1: REQ-BRC-02 re-derivation is LIVE, so no sequencing gate.

**But a cross-repo handoff IS a deliverable** — "no engine code change" ≠ "no engine-team handoff":
notify the engine team of (a) the corpus-marker deletion and (b) the union shrink; update
`CONFORMANCE-CORPUS-HANDOFF.md` and `SDK-EXIT-CODE-CONFIRMATION.md:55`, or explicitly rule the latter
historical in writing.

**Re-cited (spec V2, blind council security-blocking finding): `openspec/pending-changes.md` rows
268-270 (BRC-02, BRC-08, PRC-06 engine-gated obligations) are an engine-handoff deliverable of THIS
change, not just of `schematic-local-files`.** Verified: the BRC-08 row's text states "canonical-form
hardening is explicitly OUT of SDK scope — `package-root-containment` REQ-PRC-04/Q24 case-folds on
case-insensitive platforms SDK-side only; this row is the engine-side complement" — that premise
becomes STALE the moment `containment.ts` (and its `FOLD_CASE`/`isWithinCeiling` case-folding logic)
is deleted: the SDK no longer case-folds anything, on any platform. The handoff to the engine team
MUST say, in addition to the two items above: **"the SDK no longer realpath-resolves or case-folds
package-local sources at all — if your ceiling re-derivation assumes a case-folded or realpath-resolved
SDK-side value to compare against, that assumption no longer holds; and if your re-derivation is itself
lexical rather than realpath-based, in-package symlinks now reach you completely unfiltered (see
`package-source-io-hygiene` REQ-PSH-04's residual-risk statement)."** The PRC-06 row's citation of
`package-root-containment` REQ-PRC-09 (`validateDestinationLexical`) also needs updating at the
handoff: that REQ is re-homed to `ir-path-well-formedness` REQ-IPF-02, unchanged in substance.

## Success Criteria

- [ ] **User-seat criterion**: a factory exercising ALL THREE read verbs (`create({templateFile})`,
      `scaffold`, `copyIn`) completes successfully in a package with **no `collection.json` at or
      above it** — the temp-dir layout being explicitly equivalent to a real inline-collection
      project (no marker anywhere on the ancestor chain, which is exactly what inline mode produces).
- [ ] The exact string `no collection.json found at or above` occurs **nowhere in `src/**`**
      (falsifiable link to the reported bug), and `test/scaffold/inline-collection.test.ts` is green:
      own `mkdtemp`, `existsSync(.../collection.json) === false` precondition, scaffold + copyIn
      commit byte-exact content, body-sentinel ordering pin.
- [ ] Ruling-5 scenario green at all three call sites: `../x` and `/abs/x` both reject with the
      spec-pinned reason/message; the retained M-16 scenario passes under its new citation.
- [ ] Full `bun test` green and `tsc --noEmit` clean. *(The "13 suite rewrites" figure is an
      **estimate**, not a contract — `bun test` green is the gate.)*
- [ ] FIT-NEW-A (no `collection.json` literal / ancestor-walk idiom in `src/**`; no ceiling-shaped
      `RunContext` field), FIT-NEW-B (every surviving `AuthoringReason` member reachable — see
      definition note below), FIT-NEW-C (**exactly ONE** implementation of the `../`/absolute lexical
      predicate in `src/**`) all green.
- [ ] `canary-no-echo` extended with scaffold + `copyIn` source-rejection branches and one
      ELOOP/symlink-cycle case — green, landed BEFORE `run-boundary.test.ts` is deleted.
      *(ELOOP is a conscious ride-along: pre-existing coverage gap, kept deliberately.)*
- [ ] FIT-04 `.d.ts` baseline updated in the SAME commit as the 12 → 11 shrink; FIT-14, FIT-22 green.
- [ ] Six spec families reconciled; `rg -F 'source-outside-package'` returns **zero** hits in
      `docs/**` and the cross-repo handoff docs — only permitted hits are superseded ADRs + CHANGELOG.
- [ ] ADR-0077 published (supersedes ADR-0046 **and ADR-0067**, amends ADR-0045) with its Consequences
      section; **three** CHANGELOG entries shipped — union 12 → 11 (incl. the
      `docs/authoring-errors.md:81` switch-sample fix), ruling-5 narrowing (with migration guidance),
      and the emit→apply timing shift where applicable — plus the stale CHANGELOG preamble ("0.0.0,
      nothing requires a migration guide") amended in the same commit.
- [ ] Four named marker deletions complete: `fit-40-…test.ts:146-149`,
      `fit-40-…negative.test.ts:179-187`, `conformance-validators.ts:269-273`, and the REQ-CFX-14.1
      dist-leak filter arm at `fit-40:327-332` — with `walk.test.ts`'s 10k-bound arithmetic corrected
      (not bound-bumped).

> **FIT-NEW-B definition (architect fix 24, corrected)**: "mintable" must be defined over the **union
> of two mechanisms** — the `CODE_TO_REASON` value set (`authoring-error.ts:132`) **and** direct
> `AuthoringError` construction sites (`sourceRejection`'s reason parameter union at
> `containment.ts:60` → `source-resolve.ts`, plus literal `reason:` properties such as
> `classify-transport.ts:136`). `CODE_TO_REASON` **alone is insufficient**: it maps only
> `EmitRejectionCode` → five reasons (`path-collision`, `path-not-found`, `unrepresentable-content`,
> `changes-too-large`, `unknown`) and mints **no `source-*` reason at all** — the exact family this
> change touches. Defined via `CODE_TO_REASON` alone, FIT-NEW-B would pass vacuously after the shrink.

## Followup Accounting

| Item | Disposition |
|---|---|
| ADR numbering collisions | **FOUR**, not three — verified `0050`, `0073`, `0074`, `0075` each have two files (`ls openspec/decisions/ \| uniq -d`). Next free number is **0077**. Register a `project/pending-changes` row **at archive** — that row is the destination, not "flag to pm". |
| Residual marker fabrication in non-`scratchDirFactory` suites | **Decision: extend FIT-NEW-A's scan to `test/**` with an explicit allowlist** (chosen over a pending-change row — an allowlist makes each surviving fabrication a deliberate, reviewed entry rather than invisible debt). |
| `SDK-EXIT-CODE-CONFIRMATION.md:55` | Update or explicitly rule historical in writing — not left ambiguous. |

## Caveats from Exploration (`ready_for_proposal: partial`)

- **Engine-readiness (product)** → resolved by owner ruling 1.
- **REQ-PRC-09 destination guard (product)** → resolved by owner ruling 2 (survives, re-homed to
  `ir-path-well-formedness`).
- **Cross-verb screen consistency** → resolved by **owner ruling 5** (unified, three sites).
- **Shared helper vs inlined (technical)** → folded into ADR-0077 as a section; ruling 5 + FIT-NEW-C
  make the shared shape strongly indicated.
- **`stat` vs `lstat` (technical)** → ADR-0077 section with a symlink behaviour matrix + a required
  spec scenario for in-package-symlink → in-package-regular-file.
- **Registry gap** → `openspec/sensitive-areas.md` row promoted at `sdd-archive`.
