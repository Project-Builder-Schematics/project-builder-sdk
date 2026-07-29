# Design: Remove SDK-Side Containment Enforcement (`inline-collection-marker`)

**Design version**: V2.2 (plan-verify iteration 3 — B5/B7/B8; owner rulings 14-15) ·
**Spec**: V3.2 · **Triage**: L · **Architecture impact**: **breaking** · **Open Questions**: None

V2.1 → V2.2 (final): §7's copyIn legs aligned to spec V3.2's directive-shape re-pin (B5);
the fit-04 registration edit assigned an owner and a regen procedure (B7); the
coverage-manifest's renumbered M-17 keeps its `REQ-BRC-06.1` entry alongside the new
`REQ-PSH-02.1` one (B8); the authoring-verbs rule publishes QUALIFIED (ruling 15).

V2 → V2.1: the message architecture is pinned (Q1 — `messageFor` cannot express spec V3.1's
variants, so an explicit-`message` route is specified); `runCopyIn`'s statement order and
both-escape winner are fixed (Q2); REQ-FSC-10.4 gets entry-specific message texts rather
than reusing root-specific ones (Q3); the kit-internal `.d.ts` baseline's removal-only
vacuity is closed by a positive shape assertion (Q8). Ruling 12 adds the `0.1.0 → 0.2.0`
version bump; ruling 13 retargets the CHANGELOG drafts from `Unreleased` to `0.2.0`.

V1 → V2: three structural properties the design asserted but never pinned are now mechanical
(FIT-45 clause (b) call-site count, fit-43 clause (f) realpath-free, per-verb Test Derivation
re-leveling); the TOTAL guard is made genuinely total (non-string input, resource-exhaustion
errnos, post-stat read failure); tech-writer renames adopted (`path-guards.ts`,
`validateSourceLexical`, `statSourceForRead`); owner ruling 8 adds walk.ts's recursive-read
guard; docs/CHANGELOG entries drafted inline instead of deferred to slice time. Rulings 6/7
land as the REQ-AEC-11 row-4 split and the `package-dir-run-anchor` capability rename
(REQ-MFB ids stable).

## 1. Architecture Overview

The SDK stops deriving and enforcing a containment ceiling. `packageDir` — already the
RESOLUTION anchor — becomes the **sole** run anchor; the `collection.json` ancestor walk
(`resolvePackageRoot`) and the realpath ceiling comparison (`containment.ts`) are deleted.
The SDK's remaining obligation for package-local sources is **IO hygiene** (does this
resolve to a readable regular file?) and **IR well-formedness** (is the literal path shape
emittable?) — never a boundary. The boundary moves per path class: by-reference paths →
engine apply-time re-derivation (`REQ-BRC-02`, live); by-value/inline bytes → **no**
boundary control on either side, accepted under the v1 trusted-author model.

Three seams change. (a) The **pre-`als.run` bootstrap chokepoint** in `context.ts` shrinks
from three reads to two, ordered: `checkReservedNames` → `validateAtRunBoundary`. (b) The
**scaffold leaf's** `containment.ts` is replaced by `path-guards.ts` — same leaf, same
one-way `commons → scaffold → node:fs` direction (FIT-22), narrower job. (c) The **public
`AuthoringReason` closed union** shrinks 12 → 11.

No new layer, no new dependency, no dependency-direction change.

**Pattern**: existing — matches the `src/scaffold/*` leaf-module precedent (`walk.ts`,
`filename-pipeline.ts`, `classify-transport.ts`): one cohesive module per concern, consumed
by `index.ts`/`expander.ts`. `path-guards.ts` is the same shape as the file it replaces,
minus the ceiling.

## 2. Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Factory bootstrap (`defineFactory({packageDir})` → `als.run`) | Modify | REQ-MFB-01, REQ-RBV-06 | `test/e2e/scaffold.e2e.test.ts` (extend) | Before: 3 reads, missing marker rejects pre-body. After: 2 ordered reads, body always runs. |
| Inline-collection project runs all three read verbs | Create | REQ-MFB-01.2 | `test/scaffold/inline-collection.test.ts` (new) | The reported bug, closed. No marker anywhere on the ancestor chain. |
| `create({templateFile})` read | Modify | REQ-IPF-01, REQ-PSH-01/02/03 | `test/e2e/scaffold.e2e.test.ts` (extend) | `source-outside-package` verdict disappears; `../`/absolute → `invalid-input`. |
| `scaffold({from})` walk | Modify | REQ-IPF-01.3, REQ-FSC-10, REQ-PSH-01 | `test/e2e/author-emulation-scaffold.e2e.test.ts` (modify) | Screen-before-walk ordering preserved; root **and recursive** read failures → `invalid-input` (ruling 8). |
| `copyIn({from,to})` emit | Modify | REQ-IPF-01/02, REQ-PSH-02, REQ-BRC-06/07 | `test/conformance/copyin-parity.test.ts` (modify) | Destination screen now runs **before** the source stat (§4). |
| Author reads an error `reason` (public switch) | Modify | REQ-AEC-10/11/12 | `test/e2e/error-attribution.e2e.test.ts` (modify) | Breaking: exhaustive `switch(reason)` loses one arm. |

## 3. Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/context.ts` run-boundary validation site (baseline lines 66, 141) | modify | ancestor-marker read deleted; `packageAnchors` collapses to one field | **deviates** → ADR-0077 §B, §C |
| `src/scaffold/` leaf (baseline Layers, line 89) | modify | `containment.ts` removed, `path-guards.ts` added — leaf boundary and FIT-22 direction unchanged | aligns |
| `conformance/` root corpus layer (baseline line 20, ADR-0067) | modify | documented layer artefact `collection.json` deleted | **deviates** → ADR-0077 §D |
| Public API `./commons` (`AuthoringReason`, baseline line 104) | modify | closed union 12 → 11, MAJOR narrowing | **deviates** → ADR-0077 §E |
| `test/fitness/` guard layer | extend | fit-43/44/45 join the sequential `fit-NN` convention | aligns |
| `src/transport/single-instance-probe.ts` | — (read-only) | `packageRootFor()` is an unrelated npm-root walk; symbol-allowlisted, never touched | aligns |

**Baseline refresh citation list** (for `arch_refresh_post_verify`, mandatory at `breaking`):
lines **20** (`conformance/` marker), **66** (run-boundary validation site), **89** (scaffold
leaf file list), **104** (public union "12 members"), **141** (scaffold flow "containment …
dual-anchor realpath ceiling"). The baseline is additionally **stale** independent of this
change (predates `fit-42`, `conformance/m2-copy`, `m2-copyin`) — noted, not overruled.

## 4. Data Model / Interface Contracts

```ts
// src/core/context.ts — RunContext (BREAKING shape narrowing)
packageAnchors?: { packageDir: string };                       // was { packageDir, packageRoot }
export function requirePackageAnchors(msg: string): { packageDir: string };
// DELETED: resolvePackageRoot, missingPackageRootMessage

// src/core/authoring-error.ts — public, BREAKING
export type AuthoringReason = /* 11 members; "source-outside-package" REMOVED */;
// originFor: drop the source-outside-package arm; messageFor: drop its template arm
// TSDoc :40-49 "Exactly twelve values" → eleven (this text SHIPS in the emitted .d.ts)

// src/scaffold/path-guards.ts — NEW (replaces containment.ts)
/** Ruling-5 lexical screen. Non-string input → `invalid-input`. Segment-aware over `/`
 *  and `\`; ANY segment === ".." or an absolute path (POSIX `/` or Windows drive) →
 *  `invalid-input`. Zero fs calls. Called at EXACTLY three sites (REQ-IPF-01). */
export function validateSourceLexical(relPath: string): void;

/** IO hygiene, TOTAL guard. absPath = resolve(join(packageDir, relPath)) — LEXICAL, no
 *  realpath. `statSync` (follows symlinks) → allow-list isFile(). Returned `stat` is
 *  reused by classify-transport for the CCL-06 size gate. */
export function statSourceForRead(p: { packageDir: string; relPath: string }):
  { absPath: string; stat: Stats };

/** Re-homed from containment.ts (owner ruling 2, REQ-IPF-02). Message body
 *  `destinationEscapeMessage` unchanged VERBATIM (owner ruling 6). */
export function validateDestinationLexical(relPath: string): void;

/** Q1 — the variant selector. `detail` is a CLOSED enum; path-guards.ts maps
 *  (reason, detail) to the exact REQ-AEC-11 template and passes it to the
 *  AuthoringError constructor as an explicit `message`. */
type RejectionDetail =
  | "directory"                       // source-not-regular-file, actionable variant
  | "permission or I/O error"         // source-unreadable category 1
  | "symlink cycle"                   // source-unreadable category 2
  | "path contains an invalid character";  // source-unreadable category 3
// private: sourceRejection(reason, relPath, detail?) → AuthoringError

// moved unchanged (private): isLexicallyEscaping, destinationEscapeMessage
// moved MODIFIED (private): sourceRejection — its reason union drops
//   "source-outside-package" and it gains the `detail` parameter (Q1)
// DELETED with the ceiling: isWithinCeiling, resolveRealCeiling, fold,
// validateSourceContainment, validateSourceRootContainment, resolveContainedRealpath,
// nearestExistingAncestorRealpath, resolveBrokenSymlinkTargetRealAncestor

// src/scaffold/classify-transport.ts — internal narrowing
interface ClassifyParams { packageDir: string; relPath: string; /* … */ }  // packageRoot, realCeiling DROPPED

// src/scaffold/walk.ts — Q3: entry-specific texts for the recursive guard (ruling 8)
// NEW, alongside the three EXISTING root-specific texts (which stay untouched):
function entryUnreadableMessage(entryRelPath: string | undefined): string;   // "…could not be read"
function entryDisappearedMessage(entryRelPath: string | undefined): string;  // "…disappeared during the walk"
function entryReadFailure(err: unknown, entryRelPath: string | undefined): Error;
```

**`statSourceForRead` error mapping — TOTAL. The `try` wraps BOTH the path computation
(`resolve`/`join`, which throw on a non-string or NUL-bearing argument) AND the `statSync`
call. No raw Node error ever escapes.**

| # | Condition | Reason | `detail` |
|---|---|---|---|
| 0 | `typeof relPath !== "string"` (screen, pre-fs) | `invalid-input` | — |
| 1 | `statSync` throws `ENOENT` (missing, or broken symlink) | `source-not-found` | — |
| 2a | `statSync` throws `ELOOP` | `source-unreadable` | `"symlink cycle"` |
| 2b | path computation **or** `statSync` throws a non-errno `ERR_INVALID_ARG_VALUE` (embedded NUL) | `source-unreadable` | `"path contains an invalid character"` |
| 2c | `statSync` throws any other errno (`EACCES`, `EPERM`, `EMFILE`, `ENFILE`, `EINTR`, …) | `source-unreadable` | `"permission or I/O error"` |
| 3a | stat succeeds, `stat.isDirectory()` | `source-not-regular-file` | `"directory"` |
| 3b | stat succeeds, `!stat.isFile()` and not a directory (FIFO, socket, device) | `source-not-regular-file` | — (generic form) |
| 4 | later `readFileSync` throws post-stat (classify-transport) | `source-unreadable` | `"permission or I/O error"` |

Resource-exhaustion errnos (`EMFILE`/`ENFILE`/`EINTR`) map to `source-unreadable` with the
`"permission or I/O error"` category **deliberately**: they are transient host conditions,
not author-input faults, and the SDK has no author-vocabulary reason for them. The errno
itself **must never be interpolated** — only the fixed category word is emitted.

**Message architecture (Q1 — pinned; this supersedes V2's "`messageFor` derives the
template")**. Spec V3.1's REQ-AEC-11 requires message VARIANTS that `messageFor` cannot
express: it derives from `reason` + `path` alone, its `source-*` arms are fixed strings, and
its `invalid-input` arm **throws by design** (*"construct AuthoringError with an explicit
`message`"* — the REQ-AEC-09-sanctioned route, already used by the existing
`invalidInput(message)` helper). Therefore:

- `sourceRejection(reason, relPath, detail?)` maps `(reason, detail)` to the exact REQ-AEC-11
  template inside `path-guards.ts` and passes it to the `AuthoringError` constructor as an
  explicit `message`.
- **`messageFor` is not modified** beyond dropping its retired `source-outside-package` arm
  (§5 §E). It keeps deriving the templates for the reasons it already owns; the `source-*`
  rows it still carries become the fallback for a construction site that supplies no
  `message`, not the path this design uses.
- `path` is always the **package-relative** literal. No absolute path, no errno text. When
  `relPath` is unrepresentable (embedded NUL), the fixed placeholder
  `"<unprintable source path>"` substitutes (REQ-PSH-02.3).

**Screen call sites (exactly three, REQ-IPF-01)** — the screen is a *separate* call, never
folded into `statSourceForRead`, so the count is structural and FIT-45-checkable:

1. `readTemplateFile` — `src/scaffold/index.ts`, before `classifyTransport`
2. `runScaffold` — `src/scaffold/expander.ts`, **replacing** `validateSourceRootContainment`, before `walkFolder` (check-before-walk ordering preserved verbatim)
3. `runCopyIn` — `src/scaffold/index.ts`, before `statSourceForRead`

Per-entry scaffold sources are SDK-computed from an already-screened root and are **not**
re-screened; they go through `statSourceForRead` only (hygiene). This carve-out's safety
rests on `runFilenamePipeline` never altering `sourceRelPath` (only `destRelPath`) — the fact
`expander.ts` relies on when it builds `posix.join(args.from, result.sourceRelPath)`, and
which §7 pins with an explicit assertion in `filename-pipeline.test.ts`. It is also why
REQ-PSH-01's scaffold case is driven at the `classifyTransport` boundary, not the verb
boundary.

**`runCopyIn` statement order (Q2 — pinned exactly, after the two mandatory-arg checks)**:

1. `validateDestinationLexical(args.to)`
2. `validateSourceLexical(args.from)`
3. `statSourceForRead({ packageDir, relPath: args.from })`

**Both-escape winner: the DESTINATION template**, because step 1 runs first. This is
deterministic and must be asserted, not left to fixture luck — REQ-AEC-11.2 requires the
source and destination messages to be **never interchangeable**, so a both-escape fixture is
the sharpest test of that: it must yield exactly the `destinationEscapeMessage` text and
never the source-screen text. The reorder (today destination runs *after* the source check)
narrows a free existence oracle — a bad destination no longer requires a valid, existing
source to be diagnosed — and makes REQ-IPF-02.1 source-state-independent. The slice's
reorder-safety re-pin uses this exact order. Apply-time check: confirm no existing fixture
depends on the old source-first verdict before landing.

**Walk recursive-guard messages (Q3 — pinned)**. Ruling 8's "reuse `rootReadFailure`" is
correct about the *shape* (`AuthoringError`, `invalid-input`, package-relative, no-echo) but
its three texts are **root**-specific (`scaffold "from" folder (X) does not exist`) and would
misname a per-entry failure. Two NEW templates, entry-specific:

| Failing call | Condition | Message |
|---|---|---|
| recursive `readdirSync` (`walk.ts:119`), per-entry `lstatSync` (`:125`) | any errno except `ENOENT` | `invalid input: scaffold entry (X) could not be read` |
| same two calls | `ENOENT` — the entry vanished between enumeration and stat | `invalid input: scaffold entry (X) disappeared during the walk` |

`X` is the **package-relative** path, computed as `posix.join(rootRelPath, entryRelPath)`
where `entryRelPath` is the loop's existing `relPath` (already posix-separated, relative to
the walk root) and `rootRelPath` is the `from` the caller already threads. When `rootRelPath`
is `undefined` (only the direct unit-test callers in `walk.test.ts`), both templates fall
back to the locator-free phrasing exactly as the three root texts already do — never an
absolute path. This grows ruling 8's ~6-line estimate by two small text helpers plus
threading `relPath` into the catch; the guard itself is still the same reuse.

## 5. ADR-0077 — Relocate the Containment Boundary Out of the SDK

**File**: `openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md`
**Status**: Proposed → Accepted at archive.
**Supersedes** ADR-0046 (dual-anchor containment) **and** ADR-0067 (`collection.json`
package-anchor marker). **Amends** ADR-0045 (division of labour). Cross-refs to sanity-check
at authoring: ADR-0051, ADR-0063, ADR-0073.

**§A Context**. (a) Charter L2 forbids the SDK parsing the manifest, so containment was
anchored on a *presence-only* `collection.json` marker — a hack that inline-collection CLI
projects break by construction (the collection lives inside `project-builder.json`; no
`collection.json` ever exists on disk). (b) A factory is arbitrary **in-process** code with
full `node:fs` (`src/transport/runner.ts:271`, `src/core/context.ts:395`) — the SDK can never
be a security boundary against its own author; SDK-side containment was DX/attribution
theatre. (c) `REQ-BRC-02`'s engine re-derivation covers **by-reference** directives only;
by-value/inline content crosses as bytes with no provenance and never had engine coverage
either. Never write "the engine is the only boundary control" — for the by-value path there
is *no* boundary control.

**§B Decision — per-path-class boundary table**:

| Path class | Boundary control | Owner |
|---|---|---|
| By-reference (path crosses the wire) | Apply-time ceiling re-derivation (`by-reference-copy-wire` REQ-BRC-02) | Engine |
| By-value / inline content (bytes cross the wire) | **None**; lexical screen only, trusted-author v1 | SDK (hygiene, not security) |
| Destinations | Lexical guard at emit (REQ-IPF-02) + post-render containment (REQ-BRC-08) | SDK (lexical) + engine (apply) |

**§C Decision — `packageDir` is the sole run anchor**. `resolvePackageRoot` and the ancestor
walk are deleted; the bootstrap read-set shrinks 3 → 2 in a pinned order (reserved names,
then schema).

**§D Decision — corpus marker deleted**. ADR-0067's own text proves engine-safety ("the SDK
reads it, never the engine's Go loader"); `runner.ts`'s unconditional
`packageDir = dirname(<factory module>)` needs no ancestor marker.

**§E Decision — `AuthoringReason` 12 → 11**. `source-outside-package` retires with the
concept that defined it. `originFor`'s exhaustive switch re-narrows; the FIT-04
`core.authoring-error.d.ts` baseline updates in the **SAME commit** — a mismatch is a hard
failure, never a follow-up.

**§F Decision — `statSync`, not `lstatSync` (resolved here per spec REQ-PSH-03)**. The spec
pins observable behaviour and defers the API. Behaviour matrix:

| Input | `statSync` (chosen) | `lstatSync` |
|---|---|---|
| in-package symlink → in-package regular file (REQ-PSH-03.1) | `isFile()` true → **accept** ✅ | `isSymbolicLink()`, `isFile()` false → `source-not-regular-file` ❌ **cannot satisfy** |
| symlink cycle / `ELOOP` (REQ-PSH-03.2) | throws `ELOOP` → `source-unreadable` ✅ | never throws — the link itself is fine ❌ |
| broken symlink (REQ-PSH-02.4) | throws `ENOENT` → `source-not-found` ✅ | succeeds → wrong verdict ❌ |
| in-package symlink → OUTSIDE regular file (REQ-PSH-04.1) | accept — the documented residual ✅ | reject ❌ (would silently re-impose a boundary) |
| FIFO / directory (REQ-PSH-01.1/.2/.3) | `isFile()` false → `source-not-regular-file` ✅ | same ✅ |

`lstatSync` is **rejected**: it cannot satisfy REQ-PSH-03.1's transparent read without a
hand-rolled readlink-follow loop that would re-implement the kernel's own cycle detection —
more code, a second `ELOOP` implementation, and a new bug surface. Today's code already
behaves like `statSync` (`realpathSync` **then** `lstatSync(realAbs)` = follow-then-check);
`statSync` preserves that verdict with one call and no realpath. `stat.size` is the
**target's** size, matching today's CCL-06 reuse exactly.

**§G Decision — one shared helper, not per-site inlining**. `statSourceForRead` is consumed
by `classify-transport.ts` (serving `readTemplateFile` **and** scaffold per-entry) and by
`runCopyIn`; `validateSourceLexical` is called at the three named sites. Ruling 5 mandates
**one** predicate; three copies would drift and would need three `AuthoringError` mappings.
FIT-45 makes both the single-implementation and the exactly-three-call-sites properties
mechanical. Cost: `path-guards.ts` hosts three guards (source lexical, source hygiene,
destination lexical) — accepted because all three share `isLexicallyEscaping`/
`sourceRejection` and exist solely to serve the same three verbs; splitting would produce
two-line modules and cross-imports for no isolation gain. The module is named for what it
holds (path guards), not for one of its functions.

**§H Consequences**. (+) inline-collection projects run — the reported bug closes. (+)
bootstrap read-set 3 → 2. (+) ~250 lines of realpath/ceiling machinery and its
ancestor-symlink ENOENT-ordering subtlety disappear. (−) **Two breaking changes**: the union
narrowing, and the emit→apply timing shift for by-reference rejections where applicable.
(−) Residual risk, **verbatim** (never edited in place; amendments append a dated line):

> SDK-side containment is removed. Against a hostile factory author this loses nothing
> (in-process code, full fs access — the ceiling never constrained it). The engine's
> apply-time re-derivation covers path-carrying directives only. The SDK's own
> inline-content reads keep a minimal lexical screen (`../`/absolute rejected at the two
> read sites); symlink-based escape from packageDir remains possible and is accepted (v1
> trusted-author model). Preserved as IO hygiene independent of containment: regular-file
> allow-list, AuthoringError-with-relative-path on every source rejection (no-echo),
> lexical destination guard, absolute-never-on-wire, walk loop-safety bounds. Error-reason
> differences form a filesystem existence/permission oracle — accepted, documented.

> **Dated amendment (owner ruling 5, 2026-07-28)**: the paragraph above says "the two read
> sites" — pre-ruling-5 language. Ruling 5 unifies the lexical screen across THREE call
> sites (`readTemplateFile`, scaffold's walk-root `from`, `copyIn`'s `from`), and the
> accepted symlink-escape residual WIDENS accordingly: it now covers BOTH path classes —
> (a) inline/by-value content reads (`readTemplateFile`, scaffold's by-value classify) AND
> (b) by-reference SOURCES crossing the wire (`copyIn`'s `from`, and a by-reference scaffold
> entry) — an in-package symlink pointing outside `packageDir` reaches the wire UNFILTERED
> for by-reference directives too, not only for inline content. This is wider than the
> original paragraph's scope, not narrower: previously a by-reference source's containment
> was realpath-checked against a (possibly higher) ceiling; now there is no ceiling check
> for it at all, only the ruling-5 LEXICAL screen, which cannot see through a symlink.

> **Dated amendment (design V2, 2026-07-28) — resolved source path semantics**: the absolute
> path handed to `readFileSync` changes from **realpath'd** (`realpathSync(lexicalAbs)`) to
> **lexical** (`resolve(join(packageDir, relPath))`). Consequence: the TOCTOU window between
> the stat and the read now spans one additional level of indirection — a symlink swapped
> between `statSync` and `readFileSync` is followed at read time, where previously the read
> targeted an already-resolved real path. Under the v1 trusted-author model this is nil (the
> author owns the process and the filesystem), but it is a real semantic shift and is
> recorded rather than absorbed silently.

**§I Alternatives rejected**.
- **Dual-marker** (accept `collection.json` *or* `project-builder.json`) — keeps the
  misplaced responsibility and doubles the marker surface; inline mode may ship neither.
- **Optional marker, fail-open** — the minimal fix; rejected because a boundary that
  silently disappears when a file is absent is worse than no boundary: it reads as a control
  in review and is not one.
- **`ceiling = packageDir`** — rejected on **scope/purpose** grounds: it retains SDK-side
  containment under a new anchor, i.e. keeps the responsibility the charter says is the
  engine's. (The previously-recorded reason "REQ-PRC-01.1's layout breaks" is **false** —
  that scenario's source is inside `packageDir`; corrected here.) Ruling 5 makes the
  resulting narrowing deliberate rather than an accidental side effect.
- **Parse the manifest to derive a real root** — rejected, charter L2.
- **Lexical guards as a containment substitute** — declined as a *substitute*. Distinct from
  ruling 5's adopted screen, which is scoped to the SDK's own reads (IR shape + IO hygiene)
  and is documented as explicitly NOT a security boundary. The distinction is the point: same
  code shape, different claimed purpose.

**§J Decision — `RunContext`'s `.d.ts` baseline is KIT-INTERNAL, not part of FIT-04's public
list**. REQ-MFB-01.3 and REQ-FTG-06(c) both bind the `packageAnchors` shape to "the FIT-04
`.d.ts` baseline", but no such baseline exists today and `RunContext` is **unmapped**
(baseline §Public API: `src/core/**` ships in the tarball with no subpath export, no public
symbol). Creating `test/fitness/dts-baseline/core.context.d.ts` inside FIT-04's *public* pair
list would promote a kit-internal type into the public semver contract as a side effect of a
drift guard — a real, unintended widening. Decision: the file is created and checked by the
same FIT-04 *mechanism*, in a **separate kit-internal baseline set**, so the shape is pinned
without any semver claim. Precedent: `dialect-error.ts`/`deep-equal.ts`/`emit-rejection.ts`
all ship unmapped with no public symbol.

**Q8 — the baseline alone is VACUOUS for this change's actual risk, so it is not left alone.**
Verified: FIT-04's comparison is `findBreakingRemovals(baseline, current) =
baseline.filter(line => !currentSet.has(line))` — **removal-only**. A regrown
`packageRoot`-shaped **additive** field on `RunContext` adds a line the baseline lacks and
therefore **passes silently** — which is precisely the regression REQ-FTG-06 exists to catch.
The complement is pinned in two places:

- **Static, positive** — `fit-43` clause **(c)** owns it: assert `RunContext.packageAnchors`'s
  type literal **equals** `{ packageDir: string }`, as a string comparison against the
  kit-internal `core.context.d.ts` baseline line. Equality, never containment — a superset
  must fail.
- **Runtime, positive** — REQ-MFB-01.3's `Object.keys(packageAnchors)` deep-equal against
  `["packageDir"]`, owned by **`test/skeleton/run-boundary-validation.test.ts`** (named in §6
  and §7; it was unassigned in V2). The spec already forbids the weaker
  `packageAnchors.packageRoot === undefined` form, which a differently-named ceiling field
  would survive.

## 6. File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/context.ts` | Modify | delete `resolvePackageRoot` + `missingPackageRootMessage` + now-unused `existsSync`/`join` imports; `packageAnchors` → `{packageDir}`; narrow `requirePackageAnchors`; drop the ADR-0046 comment block |
| `src/scaffold/containment.ts` | Delete | ceiling machinery + realpath helpers |
| `src/scaffold/path-guards.ts` | Create | `validateSourceLexical`, `statSourceForRead`, `validateDestinationLexical`; **owns the REQ-AEC-11 template mapping** via `sourceRejection(reason, relPath, detail?)` with the closed `RejectionDetail` enum, passing an explicit `message` to the `AuthoringError` constructor (Q1, §4) |
| `src/scaffold/index.ts` | Modify | screen sites 1 & 3; destination-before-source ordering in `runCopyIn`; drop `packageRoot` threading; doc-comment rewrite |
| `src/scaffold/expander.ts` | Modify | screen site 2 replaces `validateSourceRootContainment`; drop `resolveRealCeiling`/`realCeiling` threading; comment rewrite (`:105`, `:114`) |
| `src/scaffold/classify-transport.ts` | Modify | drop `packageRoot`/`realCeiling` params; call `statSourceForRead`; keep CCL-06 `stat.size` reuse; comment rewrite (`:10`) |
| `src/scaffold/walk.ts` | Modify (**code**, ruling 8 + Q3) | guard the **recursive** `readdirSync` (`:119`) and the per-entry `lstatSync` (`:125`) — same `AuthoringError`/`invalid-input`/no-echo shape as `rootReadFailure`, but via **two NEW entry-specific texts** + `entryReadFailure` (§4); thread the loop's `relPath` into the catch; closes REQ-FSC-10.4's raw-`Error` no-echo hole; plus header / `:86` / `rootReadFailure` rationale → enumeration-determinism, cycle-safety, loop-safety-DoS |
| `src/core/authoring-error.ts` | Modify | union 12 → 11; drop the `originFor` + `messageFor` `source-outside-package` arms **only** — `messageFor` is otherwise untouched (Q1); **fix the `:40-49` TSDoc "Exactly twelve values"** (it ships in the emitted `.d.ts`) and the JSDoc switch sample |
| `package.json` | Modify | **`0.1.0` → `0.2.0`** (ruling 12) — SAME commit as the union shrink + FIT-04 baseline (§9 step 6) |
| `src/transport/single-instance-probe.ts` | Read-only | `packageRootFor()` — grep hazard, must NOT be touched |
| `test/scaffold/inline-collection.test.ts` | Create | REQ-MFB-01.1/.2/.3 — own `mkdtemp`, full-ancestor-chain precondition, NO `scratchDirFactory` |
| `test/scaffold/path-guards.test.ts` | Create | module-level coverage for REQ-PSH-01/02/03/04, REQ-IPF-01/02 — an **addition** to, never a substitute for, the per-verb integration rows (§7) |
| `test/scaffold/containment.test.ts` | Delete | its subject is gone (deleted inside the merged step, §9) |
| `test/scaffold/{run-boundary,walk,expander,classify-transport,index}.test.ts` | Modify | flip marker/ceiling expectations; `walk.test.ts` bound arithmetic **corrected, never bound-bumped**; REQ-FSC-10.3/10.4 rows |
| `test/scaffold/filename-pipeline.test.ts` | Modify | one-line pin: `runFilenamePipeline` never alters `sourceRelPath` (the fact §4's walk carve-out rests on) |
| `test/skeleton/run-boundary-validation.test.ts` | Modify | **owns REQ-MFB-01.3's runtime pin** — `Object.keys(packageAnchors)` deep-equals `["packageDir"]` (Q8; unassigned in V2) |
| `test/core/authoring-error-source.test.ts` | Modify | drop the `source-outside-package` fixture; REQ-AEC-10.1 / 11.1 / 11.2 / 11.3 / 12.1 |
| `test/types/authoring-reason.test.ts` | Modify | 11-member exhaustiveness pin (REQ-AEC-10.2) |
| `test/fitness/dts-baseline/core.authoring-error.d.ts` | Modify | 11 members — **SAME commit** as the union shrink (FIT-04) |
| `test/fitness/dts-baseline/core.context.d.ts` | Create | `RunContext` single-field `packageAnchors` pin — **kit-internal set**, not FIT-04's public list (ADR-0077 §J) |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modify (**slice S-002**, same commit as the union shrink) | register the kit-internal pair **OUTSIDE** the public `DTS_PAIRS` list (ADR-0077 §J) — a second, separately-labelled set running the SAME removal-only diff leg. **Regen procedure**: `tsc -p tsconfig.build.json` declaration emit → copy `dist/core/context.d.ts` → `test/fitness/dts-baseline/core.context.d.ts`. Positive equality is NOT this file's job — `fit-43` clause (c) owns it (Q8) |
| `test/support/scratch-dir.ts` | Modify | drop marker fabrication (`:34`) |
| `test/fixtures/author-emulation/factory.ts` | Modify | drop marker fabrication (`:175`) + `packageAnchors` replica (`:184`) |
| `test/support/conformance-validators.ts` | Modify | delete `checkCollectionJsonMarker` (`:269-273`) |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modify | delete the marker `describe` (`:146-149`) **and** the REQ-CFX-14.1 dist-leak filter arm (`:327-332`) |
| `test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` | Modify | delete the marker negative (`:179-187`) |
| `test/support/src-invariant-scans.ts` | Create | the PURE scanners over an injectable file list |
| `test/fitness/fit-43-no-ceiling-regrowth.test.ts` | Create | FIT-NEW-A (REQ-FTG-06) |
| `test/fitness/fit-44-authoring-reason-reachability.test.ts` | Create | FIT-NEW-B (REQ-FTG-07) |
| `test/fitness/fit-45-single-lexical-predicate.test.ts` | Create | FIT-NEW-C (REQ-FTG-08) |
| `test/fixtures/red/src-invariant-scans/**` | Create | negative fixture trees (never walked by the live scans) |
| `test/security/canary-no-echo.test.ts` | Modify | drop marker seeding (`:43-48`); extend the driven branch set incl. mapping row 4 (REQ-RBV-04.1); canary seeded in the **absolute prefix** (§7) |
| `test/fake/{harness-opted-in,harness-in-memory-invariant}.test.ts` | Modify | ORDERED two-read assertion (never sorted membership); drop the `isWithinCeiling` import (`:40`) |
| `test/e2e/{scaffold,author-emulation-scaffold,error-attribution}.e2e.test.ts`, `test/conformance/copyin-parity.test.ts` | Modify | flip the RBV-06.1 sentinel (`scaffold.e2e:80`); M-16 reason `source-outside-package` → `invalid-input`; the per-verb rows from §7 |
| `test/e2e/author-emulation/scenarios.ts` | Modify | **where the renumber actually lives** — delete `m-17` / `no-existence-oracle-nonexisting` (`:249`), renumber m-18→m-17 (new slug), m-19→m-18, m-20→m-19, m-21→m-20; update the scratch-backed row list (`:53`) and the `m-01..m-21` range comment (`:57`) |
| `scripts/regen-corpus.ts` | Run (no edit expected) | transcripts are **REGENERATED**, never hand-renamed; `test/e2e/author-emulation/corpus/*.transcript.json` is regenerated output |
| `test/support/corpus-format.ts` | Modify | `:75` `scenarioId` comment `"m-21"` → `"m-20"` |
| `test/fitness/fit-28-corpus-determinism.test.ts` | Modify | SCENARIOS list follows `scenarios.ts` |
| `test/fitness/fit-26-report-hygiene-citations.test.ts` | Modify (**archive-sync commit**, §9) | `rows.length` 21 → 20 (`:92`) + the 21-row comment (`:10`); **NEW** assertions for REQ-GCC-08.1 (four NOT-EXERCISED literals) and REQ-SCM-02.1 (`REQ-BRC-08` ledger-only) — verified absent today, so new fitness code, not edits |
| `test/e2e/author-emulation/corpus/coverage-manifest.md` | Modify | drop `REQ-PRC-04.1` / `04.6` / `07.1` (`:48-50`) and the `REQ-PRC-06` literal (`:67`, `:72`); re-key every shifted M-row. **B8 (decided)**: the renumbered M-17 cites **BOTH** `REQ-PSH-02.1` **and** `REQ-BRC-06.1` — its GWT ("missing package-local `copyIn` source → `source-not-found`, run via the harness") genuinely exercises both, so the EXERCISED ledger **keeps** the existing `REQ-BRC-06.1` entry (`:51`, re-keyed M-18 → M-17) **alongside** a new `REQ-PSH-02.1 | M-17` entry. Dropping it would satisfy REQ-GCC-08 item 1 only by losing corpus coverage of a preservation-pin REQ |
| `conformance/collection.json` | Delete | REQ-CCR-08 retired |
| `conformance/README.md` | Modify | `:55` marker requirement removed |
| `docs/authoring-verbs.md` | Modify | **prose, not just reason lists**: `:70` ("resolves outside the package boundary"), `:190` ("package containment"), `:262-263` ("resolves inside the package boundary") + the three reason lists; **new**: the author rule published **QUALIFIED** per ruling 15 / the adjusted spec verbatim — *"the SDK rejects lexical `../` or absolute source paths, always; everything a schematic reads lives inside its package — **symlinks are followed without target verification, see SECURITY.md**"* — plus a short "what the boundary is now" paragraph (ADR-0077 §B's three facts). The qualifier is not optional: the unqualified rule would read as a containment promise the SDK no longer makes |
| `docs/authoring-errors.md` | Modify | `:60` table row + `:81` switch sample; **new**: the `invalid-input` row gains the ruling-5 screen |
| `docs/engine-sdk-wire-design.md` | Modify | **`:151`** — the false line ("containment-ceiling anchor (ADR-0046)" in the `defineFactory` responsibilities list). `:179/:186` **NOT touched** — verified to be the CLI collection-manifest `schema`-field discussion, a different concern (the V1 citation was wrong) |
| `SECURITY.md` | Modify | trust-model statement: symlink escape from `packageDir` accepted, v1 trusted-author |
| `CHANGELOG.md` | Modify | 3 entries drafted inline (§9) + preamble amendment naming the real audience |
| `CONFORMANCE-CORPUS-HANDOFF.md` | Modify | **`:117-122`** the SDK-side marker note (deleted) and **`:114`** its cross-reference from the `assets/` note; `:107`'s corpus-root-ambiguity stray-file *example* is a **separate** edit. Adds **Addendum 3** (§9) |
| `SDK-EXIT-CODE-CONFIRMATION.md` | Modify | `:55` reason list + a dated HISTORICAL note written into the file (§9) |
| `openspec/pending-changes.md` | Modify | rows 268-270 re-cited (BRC-02 LIVE; BRC-08 case-fold premise stale; PRC-06 → REQ-IPF-02) |
| `openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md` | Create | ADR-0077 (§5) |
| `openspec/specs/authoring-error-contract/spec.md` | Modify | **PRE-ARCHIVE step** — restore REQ-AEC-10/11/12 before the MODIFIED blocks apply (§9 step 0) |

## 7. Test Derivation

Markers: `[R]` red-today, `[P]` preservation-pin. **"×3 verbs"** = driven through the three
REAL verbs (`create({templateFile})`, `scaffold`, `copyIn`) at integration level, per the
spec's "driven once per verb (three cases)" phrasing, which exists expressly to close the
2-of-3 mutant gap. `path-guards.test.ts` rows are **additions**, never substitutes.

| REQ-ID | Level | Test | Flow ref |
|---|---|---|---|
| REQ-MFB-01.1 `[R]` sentinel ordering, full-ancestor precondition | integration | `test/scaffold/inline-collection.test.ts` | Factory bootstrap (Modify) |
| REQ-MFB-01.2 `[R]` three verbs commit with no marker anywhere — `scaffold`/`create` legs assert **byte-exact** committed content; the `copyIn` leg asserts the **emitted-directive shape** (spec V3.2 re-pin: fakes never materialize copyIn bytes, so a byte-exact copyIn assertion is not constructible) | e2e | `test/scaffold/inline-collection.test.ts` | Inline-collection run (Create) |
| REQ-MFB-01.3 `[R]` runtime `Object.keys` deep-equals `["packageDir"]` **+ static type-literal equality** (Q8 — FIT-04 alone is removal-only, hence vacuous for additive regrowth) | unit + architectural | `test/skeleton/run-boundary-validation.test.ts` (runtime) + `fit-43` clause (c) (static equality) + `fit-04-dts-semver-gate.test.ts` (`core.context.d.ts`, removal leg) | — |
| REQ-RBV-06.1 | — | RETIRED, id kept as a pointer — deliberately untested | — |
| REQ-RBV-06.2 two reads, in order, fs-instrumented | integration | `test/fake/harness-opted-in.test.ts` (ORDERED, not membership) | Factory bootstrap (Modify) |
| REQ-RBV-04.1 canary scan, extended branch set (incl. mapping row 4) | security | `test/security/canary-no-echo.test.ts` | — |
| REQ-RBV-04.2 `[P]` key names may appear, values never | security | `test/security/canary-no-echo.test.ts` | — |
| REQ-PSH-01.1 `[P]` FIFO → `source-not-regular-file`, zero content reads | integration ×3 verbs (spec-sanctioned unit fallback where `mkfifo` is unavailable in CI, marked as such) | `test/e2e/scaffold.e2e.test.ts`, `test/scaffold/expander.test.ts`, `test/conformance/copyin-parity.test.ts` (+ `path-guards.test.ts`) | all three read flows |
| REQ-PSH-01.2 `[P]` directory-as-source | integration ×2 verbs | `test/e2e/scaffold.e2e.test.ts`, `test/conformance/copyin-parity.test.ts` | `templateFile` / `copyIn` |
| REQ-PSH-01.3 `[R]` `""`/`"."`/`"./"` → `source-not-regular-file` | integration ×3 verbs (scaffold case at the `classifyTransport` boundary, §4) | as above (+ `classify-transport.test.ts`) | all three read flows |
| REQ-PSH-02.1 `[P]` missing → `source-not-found` | integration ×2 verbs | `test/e2e/scaffold.e2e.test.ts`, `test/conformance/copyin-parity.test.ts` | `templateFile` / `copyIn` |
| REQ-PSH-02.2 `[P]` unreadable → `source-unreadable` (injected EACCES seam, never chmod) | integration ×3 verbs (`spyOn(fs,"statSync")`) | as the REQ-PSH-01.1 row (+ `path-guards.test.ts`) | all three read flows |
| REQ-PSH-02.3 `[R]` embedded NUL → `source-unreadable`, placeholder message | integration ×3 verbs | as above | all three read flows |
| REQ-PSH-02.4 `[R]` broken symlink → `source-not-found` | integration ×3 verbs | as above | all three read flows |
| REQ-PSH-03.1 `[P]` in-package symlink → in-package regular file accepted — `readTemplateFile`/`scaffold` legs assert the target's content byte-exact; the `copyIn` leg asserts the emitted-directive shape (V3.2 re-pin) | integration ×3 verbs | as above | all three read flows |
| REQ-PSH-03.2 `[R]` symlink cycle → `source-unreadable`, no-echo | integration ×3 verbs | as above | all three read flows |
| REQ-PSH-04.1 `[R]` symlink → OUTSIDE file **succeeds** (positive residual + realpath tripwire) — `readTemplateFile`/`scaffold` legs assert the outside file's content is returned; the `copyIn` leg asserts the directive **emits** rather than rejecting (V3.2 re-pin). The tripwire holds either way: a regrown `realpathSync` check fails all three legs | integration ×3 verbs | as above | all three read flows |
| **Mapping row 4** `[R]` post-stat `readFileSync` throw → `source-unreadable` | integration ×2 (`readTemplateFile` + a by-value scaffold entry, `spyOn(fs,"readFileSync")`) | `test/e2e/scaffold.e2e.test.ts`, `test/scaffold/expander.test.ts`; joins the canary set | `templateFile` / `scaffold` |
| **Mapping row 0** `[R]` non-string `relPath` → `invalid-input` | unit | `test/scaffold/path-guards.test.ts` | — |
| REQ-IPF-01.1 `[R]` `../x` rejects, **zero stat/read calls at the verb boundary** | integration ×3 verbs (`instrumentHarnessIO`) | `test/e2e/scaffold.e2e.test.ts`, `test/scaffold/expander.test.ts`, `test/conformance/copyin-parity.test.ts` | all three read flows |
| REQ-IPF-01.2 `/abs/x` rejects | integration ×3 verbs | as above | all three read flows |
| REQ-IPF-01.3 escaping scaffold root rejects before any enumeration | integration | `test/scaffold/expander.test.ts` (zero `readdirSync`/`lstatSync`) | `scaffold` walk (Modify) |
| REQ-IPF-01.4 `[P]` literal `..` rejected in BOTH regimes (no narrowing) | unit | `test/scaffold/path-guards.test.ts` | — |
| REQ-IPF-01.5 M-16 re-cited under the ruling-5 screen | e2e | `test/e2e/author-emulation-scaffold.e2e.test.ts` (`:352`) | `scaffold` walk (Modify) |
| REQ-IPF-01.6 `[R]` `".."`,`"sub/.."`,`"..\\x"`,`"a/../../x"`,`"./a/../../x"` | integration ×3 verbs | as the REQ-IPF-01.1 row (+ `path-guards.test.ts`) | all three read flows |
| REQ-IPF-02.1 `[P]` literal `../`/absolute `to` rejects pre-emit, **source-state-independent** | unit + integration | `test/scaffold/path-guards.test.ts` + `expander.test.ts` | `copyIn` emit (Modify) |
| REQ-IPF-03.1 `[P]` no absolute path in an emitted directive | integration | `test/scaffold/expander.test.ts` | `copyIn` emit (Modify) |
| REQ-FSC-10.1 `[P]` missing walk root → `invalid-input`, relative only | unit | `test/scaffold/walk.test.ts` | `scaffold` walk (Modify) |
| REQ-FSC-10.2 `[P]` walk root is a regular file → `invalid-input` | unit | `test/scaffold/walk.test.ts` | `scaffold` walk (Modify) |
| REQ-FSC-10.3 `[P]` walk root EACCES → `invalid-input` (injected seam) | unit | `test/scaffold/walk.test.ts` (`spyOn(fs,"readdirSync")`) | `scaffold` walk (Modify) |
| REQ-FSC-10.4 `[R]` **recursive** `readdirSync` / per-entry `lstatSync` failure → `invalid-input`, **entry-specific** text naming `posix.join(rootRelPath, relPath)`, no absolute-path echo — both arms (`ENOENT` → "disappeared during the walk"; other errno → "could not be read") | unit | `test/scaffold/walk.test.ts` (`spyOn` on the nested call) | `scaffold` walk (Modify) |
| REQ-FSC-09.1 `[P]` symlinked directory skipped, no error | unit | `test/scaffold/walk.test.ts` | — |
| REQ-FSC-09.2 `[P]` 10 000-entry bound fails loud (arithmetic corrected, not bumped) | unit | `test/scaffold/walk.test.ts` | — |
| REQ-AEC-10.1 `[P]` three surviving reasons → `authoring-rejected` | unit | `test/core/authoring-error-source.test.ts` | — |
| REQ-AEC-10.2 `[R]` `originFor` 11-arm exhaustiveness + FIT-04 same commit | type-level + architectural | `test/types/authoring-reason.test.ts` + `fit-04-dts-semver-gate.test.ts` | Author error switch (Modify) |
| REQ-AEC-11.1 `[P]` all FIVE template rows incl. **both** `source-not-regular-file` variants (directory naming `scaffold()`, FIFO generic) and `source-unreadable`'s three categories each matching its real cause | unit | `test/core/authoring-error-source.test.ts` (one fixture per `detail` value, §4) | — |
| REQ-AEC-11.2 `[R]` source vs destination templates driven from their OWN REQs, **never interchangeable** — incl. the both-escape `copyIn` fixture, where the DESTINATION template must win (Q2) | unit | `test/core/authoring-error-source.test.ts` + `test/scaffold/path-guards.test.ts` | `copyIn` emit (Modify) |
| REQ-AEC-12.1 `[R]` owner-ruled modes → `invalid-input`; union still 11 | unit | `test/core/authoring-error-source.test.ts` | — |
| REQ-BRC-02.1 `[P]` `[SEAM]` no SDK-resolved root on the wire | contract | `test/scaffold/expander.test.ts` | — |
| REQ-BRC-06.1 `[P]` missing source → `source-not-found` through the harness | e2e | `test/conformance/copyin-parity.test.ts` | `copyIn` emit (Modify) |
| REQ-BRC-07.1 `[P]` no absolute path in the emitted directive | contract | `test/scaffold/expander.test.ts` | `copyIn` emit (Modify) |
| REQ-FTG-06.1 `[R]` FIT-NEW-A fails on a regrown marker/ancestor walk | architectural | `test/fitness/fit-43-no-ceiling-regrowth.test.ts` | — |
| REQ-FTG-06.2 `[R]` symbol-scoped allowlist does not shadow a sibling offender | architectural | `test/fitness/fit-43-no-ceiling-regrowth.test.ts` | — |
| REQ-FTG-07.1 `[R]` FIT-NEW-B fails on an unreachable surviving reason | architectural | `test/fitness/fit-44-authoring-reason-reachability.test.ts` | — |
| REQ-FTG-07.2 `[R]` `CODE_TO_REASON` contains zero `source-*` values | architectural | `test/fitness/fit-44-authoring-reason-reachability.test.ts` | — |
| REQ-FTG-08.1 `[R]` FIT-NEW-C fails on a second lexical predicate | architectural | `test/fitness/fit-45-single-lexical-predicate.test.ts` | — |
| REQ-SCM-01.1 `[R]` matrix row count exactly 20 | architectural | `fit-26-report-hygiene-citations.test.ts` (**archive-sync commit**) | — |
| REQ-SCM-02.1 `[R]` `REQ-BRC-08` only in the NOT-exercised ledger | architectural | `fit-26-report-hygiene-citations.test.ts` (NEW assertion) | — |
| REQ-GCC-08.1 `[R]` manifest passes the FOUR-point checklist | architectural | `fit-26-report-hygiene-citations.test.ts` (NEW assertion) | — |
| REQ-CSC-02.1 `[P]` dangling `expected` reference fails | architectural | `fit-40-conformance-corpus-integrity.test.ts` | — |
| REQ-CSC-02.2 `[P]` missing `factory.ts` fails | architectural | `fit-40-conformance-corpus-integrity.test.ts` | — |
| REQ-CCR-08 / REQ-PRC-01..10 | — | REMOVED — retirement verified by `package-root-containment`'s own post-archive-sync `rg` criterion, executed by `sdd-archive` (§8) | — |

**Scenario arithmetic**: **49** scenarios across 13 delta families — MFB 3, PSH 10, RBV 4,
IPF 8, FSC 6, AEC 5, FTG 5, BRC 3, SCM 2, CSC 2, GCC 1; `package-root-containment` and
`conformance-corpus` contribute 0 (all REMOVED). **48 tested** — REQ-RBV-06.1 is retired with
its id kept as a pointer and is deliberately untested. (V1 stated 46, a miscount; the
council's 48/47 was the pre-V3 figure, which REQ-FSC-10.4 raises to 49/48.) Two rows beyond
the spec's scenario set — mapping rows 0 and 4 — carry no REQ-ID of their own; they discharge
REQ-PSH-02's TOTAL clause. Every Create/Modify flow has ≥1 e2e or integration row.

**Canary seeding rule (pinned)**: REQ-AEC-11's templates *require* the package-relative path
in the message, so seeding the canary into the relative literal would make REQ-RBV-04.1
self-contradictory. The canary is therefore seeded into the **absolute prefix** — the
`mkdtemp` directory name — and the assertion is *"no absolute path component leaked"*. This
is the same key-name/value asymmetry REQ-RBV-04.2 already pins, applied to paths.
**Known-vacuous row, recorded honestly**: for the REQ-PSH-02.3 NUL branch the message is the
fixed `"<unprintable source path>"` placeholder and contains no path at all, so the canary
scan passes trivially there — that row is not evidence of no-echo and must not be counted as
such.

## 8. Fitness Functions

- **FIT-NEW-A** (`fit-43`, REQ-FTG-06) — pure `scanForCeilingRegrowth(files, allowlist)`.
  (a) literal `"collection.json"` in **zero** `src/**` files; (b) no ancestor-walk idiom (a
  loop calling `dirname` upward probing for a marker file) in `src/**`;
  **(c) POSITIVE shape assertion (Q8)** — `RunContext.packageAnchors`'s type literal
  **equals** `{ packageDir: string }`, string-compared against the kit-internal
  `core.context.d.ts` baseline line. **Equality, never containment**: FIT-04's own diff is
  removal-only (`baseline.filter(l => !currentSet.has(l))`), so an additive regrown
  `packageRoot`-shaped field passes it silently — this clause is the complement that catches
  it (ADR-0077 §J);
  (d) `test/**` scanned for marker **fabrication** (a write call whose path argument ends in
  `collection.json`) against an explicit, per-symbol allowlist — **initially empty**, so any
  future entry is a reviewed addition; **(f) zero `realpathSync`/`realpath` references — code
  or comment — in `src/scaffold/**` and `src/core/context.ts`**, sole symbol-scoped exception
  `src/transport/single-instance-probe.ts#packageRootFor`.
  Clause (f) is verified reachable: every current `realpath` hit in those trees lives in
  `containment.ts` (deleted) or in comments in `classify-transport.ts:10` /
  `expander.ts:105,114` (rewritten here); `src/core/context.ts` has none; and
  `bin/pbuilder-codegen.ts`'s ADR-0031 write-containment realpath is out of scope by path.
  The allowlist is **symbol**-scoped: a file-scoped one would let any other function in
  `single-instance-probe.ts` regrow the idiom (REQ-FTG-06.2).
  **Clause (e) deliberately NOT included**: the `rg 'package-root-containment|REQ-PRC-|
  source-outside-package' openspec/specs/` sweep would be RED for the whole change (the main
  specs retire only at archive sync). It stays where the spec put it — a post-archive-sync
  acceptance criterion owned by `package-root-containment` and executed by `sdd-archive` —
  rather than shipping a permanently-red fitness test.
- **FIT-NEW-B** (`fit-44`, REQ-FTG-07) — positive scan over **two** mint shapes: the
  `CODE_TO_REASON` value set, and direct construction evidence (a `reason:` property literal,
  or a reason-parameter union on a rejection-minting helper such as `sourceRejection`). The
  `AuthoringReason` union declaration and `originFor`'s switch arms are excluded from the
  scanned text — both list every member by definition and would make the check vacuous.
  `messageFor`'s `case` labels match neither mint shape, so they cannot credit a member
  either. `CODE_TO_REASON` alone mints **no** `source-*` reason (REQ-FTG-07.2 asserts this
  executably), which is why the union of the two mechanisms is the definition.
- **FIT-NEW-C** (`fit-45`, REQ-FTG-08) — pure scanners over an injectable file list.
  **(a) One implementation**: detects a function body containing BOTH a separator split
  (`/[\\/]+/` or equivalent) with a `".."` segment membership test, AND an absolute-path test
  (leading `/` or a drive-letter regex); asserts exactly ONE `(file, function)` pair, equal to
  `src/scaffold/path-guards.ts#isLexicallyEscaping`.
  **(b) Exactly three call sites**: `validateSourceLexical` is invoked from exactly
  `{src/scaffold/index.ts#readTemplateFile, src/scaffold/expander.ts#runScaffold,
  src/scaffold/index.ts#runCopyIn}` — a fourth call site, or a missing one, fails and names
  the diff. This is the mechanical pin for the property §4 asserts.
  **Known limit, stated rather than implied**: both clauses are *clone detectors keyed on
  shape*. A second predicate written differently — a single regex, a `normalize()`-based
  check, a hand-rolled character scan — evades clause (a); an indirect invocation (through a
  variable or a wrapper) evades clause (b). They raise the cost of accidental duplication;
  they do not make it impossible, and must not be cited as proof that it cannot happen.
- All scanners are **pure functions over an injectable root/file-list**, living in
  `test/support/src-invariant-scans.ts`; negatives run against fixture trees under
  `test/fixtures/red/src-invariant-scans/**` — never a live mutation of `src/**`.
- **Existing guards that must stay green**: FIT-04 (public `.d.ts` baseline, same commit),
  FIT-14, FIT-22 (scaffold leaf one-way, re-run after the rename), FIT-26 (see the
  archive-sync constraint in §9), FIT-28, FIT-40.

## 9. Migration / Rollout & TDD Order

**Not every step ends green — and that is the point.** Steps 1, 2 and 8 land **deliberately
RED** (Strict TDD: the failing assertion is the proof the behaviour is not yet there). Steps
0, 3, 4+5, 6, 7, 9 each end green. Any other red is a defect.

0. **PRE-ARCHIVE PREREQUISITE, sequenced FIRST**: restore REQ-AEC-10/11/12 into
   `openspec/specs/authoring-error-contract/spec.md` from
   `openspec/changes/archive/2026-07-13-schematic-local-files/specs/authoring-error-contract/spec.md`.
   The MODIFIED blocks are written against that recovered text and cannot apply without it.
1. **Flip run-boundary expectations RED** — `test/scaffold/run-boundary.test.ts` (the
   scaffold-side suite), `test/e2e/scaffold.e2e.test.ts:80` (RBV-06.1 sentinel inverts),
   `test/fake/harness-opted-in.test.ts` (three reads → two, ORDERED). *(Distinct from
   `test/skeleton/run-boundary-validation.test.ts`, which carries REQ-MFB-01.3 in step 4+5.)*
2. **Add the new inline-collection test RED** — `test/scaffold/inline-collection.test.ts`.
3. **Land `canary-no-echo` + ELOOP coverage GREEN** — must exist **before** step 1's old
   assertions are deleted, so the no-echo obligation is never uncovered.
4+5. **Single merged step — delete the marker machinery AND split `containment.ts` →
   `path-guards.ts`.** These cannot be separated: collapsing `packageAnchors` to
   `{packageDir}` does not typecheck while `validateSourceContainment` /
   `validateSourceRootContainment` / `resolveRealCeiling` still take `packageRoot`. Inside
   this step: wire the three screen sites, apply the `runCopyIn` destination-before-source
   reorder, land ruling 8's walk.ts recursive guard, **delete
   `test/scaffold/containment.test.ts`**, and **remove the `isWithinCeiling` import at
   `test/fake/harness-in-memory-invariant.test.ts:40`** — both are compile-breakers that
   cannot survive the split.
6. **Union shrink 12 → 11 + FIT-04 public baseline + the kit-internal `core.context.d.ts`
   baseline + the `authoring-error.ts` TSDoc fix + `package.json` `0.1.0 → 0.2.0`
   (ruling 12) — SAME commit.** The version bump belongs here, not at release time: it is
   the artefact that makes the MAJOR narrowing legible, and a baseline/version split would
   let a consumer see the shrunk union under an unchanged version.
7. **Suite rewrites** (est. ~13 files — an estimate, not a contract; `bun test` green is the
   gate), then the corpus renumber via `scenarios.ts` + `scripts/regen-corpus.ts`, then docs /
   `SECURITY.md` / CHANGELOG / handoff.
8. **Add fit-43/44/45** with red-proofs against their fixture trees.
9. **Delete dead tests LAST** — the retired corpus row and the retired `run-boundary`
   assertions.

**Archive-sync constraint (not an apply step)**: `fit-26`'s row-count assertion reads
`openspec/specs/scenario-matrix/spec.md` — the **main-family** file that `sdd-archive`
rewrites. Flipping 21 → 20 during apply would break a green test against an unchanged file.
The `fit-26` edits (count flip + the new REQ-GCC-08.1 / REQ-SCM-02.1 assertions) therefore
land in the **archive spec-sync commit**, together with the file they assert against.

**Slice pre-flight**: re-verify the marker-deletion claim against the **current** fixture set
before executing — `conformance/m2-copy` and `m2-copyin` post-date the architecture baseline
and were not in the propose-time inventory.

**CHANGELOG — three entries under a `## 0.2.0` heading (ruling 12/13), not `Unreleased`,
drafted here so slice does not invent them**:

- **(a) HEADLINE — `Fixed`**: *"A schematic package no longer needs a `collection.json`
  ancestor to run. Previously `defineFactory({ packageDir })` walked upward for a
  `collection.json` marker and failed the run before the factory body executed when none was
  found — which is every inline-collection project, where the collection lives inside
  `project-builder.json` and no `collection.json` ever exists on disk. `packageDir` is now the
  sole run anchor."* (This replaces V1's "the screen moved to a new file" entry — a
  file-location change has zero consumer value.)
- **(b) `Changed` (breaking)**: *"`AuthoringReason` narrows from twelve members to eleven:
  `source-outside-package` is removed. **Migration**: delete the `case
  "source-outside-package":` arm from any exhaustive `switch (err.reason)` — TypeScript will
  point at it. A source path with a literal `..` segment or an absolute path now rejects
  `invalid-input` (it rejected `source-outside-package` before, but was always rejected — this
  is a reason change, not a new rejection). A source that resolves outside the package through
  an in-package symlink is **no longer rejected by the SDK at all**."*
- **(c) `Changed` — honest timing entry**: *"The SDK no longer resolves package-local source
  paths through `realpath`, so an in-package symlink pointing outside `packageDir` is no
  longer rejected by the SDK. Whether such a source is rejected at all now depends on the
  engine's own apply-time ceiling re-derivation — the SDK makes no claim either way. See
  SECURITY.md for the v1 trust model."*
- **Preamble amendment**: the current text ("pre-release, zero live consumers … nothing here
  requires a migration guide") is amended on two counts. (i) It names the real audience — the
  **engine repo and the conformance corpus** consume this contract today even though no npm
  consumer does, so breaking entries carry migration text for them. (ii) Its `0.0.0` claim is
  **stale against `package.json`, which already reads `0.1.0`** — the preamble must stop
  asserting a version at all and defer to the version headings below it, now beginning at
  `0.2.0`. Only `0.0.0-dev.<sha>` prereleases publish from `main`, so the bump changes no
  distribution mechanics; it changes what a reader is told the contract is.

**Cross-repo engine handoff — named delivery vehicle**: **Addendum 3** in
`CONFORMANCE-CORPUS-HANDOFF.md`, mirroring Addendum 2's format, with the PR description
quoting the warning verbatim. `SDK-EXIT-CODE-CONFIRMATION.md` is ruled **HISTORICAL**, with
the dated note **written into the file**: *"Historical as of 2026-07-28: the
authoring-rejected list lost `source-outside-package`; see CHANGELOG 0.2.0."* Re-cite
`openspec/pending-changes.md` rows 268-270. Verbatim warning:

> The SDK no longer realpath-resolves or case-folds package-local sources at all — if your
> ceiling re-derivation assumes a case-folded or realpath-resolved SDK-side value to compare
> against, that assumption no longer holds; and if your re-derivation is itself lexical rather
> than realpath-based, in-package symlinks now reach you completely unfiltered.
> **Windows forms**: root-relative (`\foo`), UNC (`\\server\share`) and drive-relative
> (`C:foo`) source paths are **not** screened SDK-side — the ruling-5 predicate covers a
> leading `/` and a `C:\`/`C:/` drive-letter form only — and reach you unfiltered.
> `REQ-BRC-08`'s canonical-form hardening must handle them.

**Rollback**: revert the whole merge or nothing — code and `.d.ts` baselines must revert
together (FIT-04 fails on a mismatch). No persisted state, no wire-shape change.

## 10. Performance

Net improvement, unmeasured and unclaimed as a goal: the bootstrap loses an unbounded upward
`existsSync` walk, and every per-entry source read loses a `realpathSync` (plus, on the ENOENT
path, a second upward existence walk). One `statSync` replaces `realpathSync` + `lstatSync`.
No new hot path.

## 11. Architecture Impact

**Architecture impact**: **breaking**

**Rationale**: derived from §3 — four `deviates` rows, three of them *removals* of documented
baseline elements: the `collection.json` package-anchor marker (baseline line 20, ADR-0067) is
deleted; `context.ts`'s ceiling-derivation step (baseline lines 66, 141) is deleted; and the
public `AuthoringReason` closed union (baseline line 104, "CLOSED union, 12 members") narrows
to 11 — a MAJOR break for consumers' exhaustive `switch(reason)`. Baseline lines
**20 / 66 / 89 / 104 / 141** all describe machinery this change removes.
`arch_refresh_post_verify` is **mandatory**.

## 12. Sensitive Areas Coverage

| Area | Files | Covered in spec? |
|---|---|---|
| public-api (contract) | `src/core/authoring-error.ts`, `test/fitness/dts-baseline/core.authoring-error.d.ts` | Yes — `authoring-error-contract` REQ-AEC-10/11/12 |
| security (input validation / containment) | `src/core/context.ts`, `src/scaffold/**` | Yes — `package-dir-run-anchor`, `package-source-io-hygiene`, `ir-path-well-formedness`, `run-boundary-input-validation`, `folder-scaffold`, `fitness-guards` |
| security (code execution) | not touched — no `src/dialects/**` or `src/transport/**` diff | n/a |

No sensitive area surfaces here that the signed spec does not already cover.

## 13. Open Questions

**None.** `stat` vs `lstat` → ADR-0077 §F; shared helper → §G; kit-internal `.d.ts` tier and
its removal-only vacuity → §J + fit-43 clause (c); message-variant mechanism → §4 (Q1);
`runCopyIn` order and both-escape winner → §4 (Q2); walk entry texts → §4 (Q3);
FIT-NEW-A/B/C shapes and their stated limits → §8; fit-43(e) and fit-26 sequencing → decided
in §8/§9, not deferred; pre-archive REQ-AEC restore → §9 step 0; version bump → §6 + §9 step 6.

**Recommendation to spec V3 (evidence-backed; design cannot self-apply a spec marker)**:
REQ-FSC-10.3's marker should be `[preservation-pin]`, not `[red-today]` — `walk.ts:61-69`'s
`rootReadFailure` already carries the generic non-ENOENT/ENOTDIR arm returning
`invalidInput(rootUnreadableMessage(...))`, so the behaviour is green today and only the test
is new. REQ-FSC-10.4 (ruling 8) is correctly `[red-today]`: `walk.ts:119` / `:125` are
genuinely unguarded.
