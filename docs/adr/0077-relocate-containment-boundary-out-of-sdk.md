# ADR-0077: Relocate the Containment Boundary Out of the SDK

- Status: Accepted (2026-07-28, `inline-collection-marker` archive)
- Date: 2026-07-28
- Deciders: Daniel (Hyperxq)
- Origin: change `inline-collection-marker` (design V2.2).
- Supersedes: ADR-0046 (`RunContext.packageRoot` — eager ceiling seeding at the run
  boundary), ADR-0067 (`collection.json` package-anchor marker).
- Amends: ADR-0045 (package-read source validation & the SDK/fake division of labor).
- Cross-refs (sanity-check at authoring): ADR-0051, ADR-0063, ADR-0073.

## §A Context

(a) Charter L2 forbids the SDK parsing the manifest, so containment was anchored on a
*presence-only* `collection.json` marker — a hack that inline-collection CLI projects
break by construction (the collection lives inside `project-builder.json`; no
`collection.json` ever exists on disk for that mode). (b) A factory is arbitrary
**in-process** code with full `node:fs` (`src/transport/runner.ts:271`,
`src/core/context.ts:395`) — the SDK can never be a security boundary against its own
author; SDK-side containment was DX/attribution theatre. (c) `by-reference-copy-wire`
REQ-BRC-02's engine re-derivation covers **by-reference** directives only; by-value/inline
content crosses as bytes with no provenance and never had engine coverage either. Never
write "the engine is the only boundary control" — for the by-value path there is *no*
boundary control.

## §B Decision — per-path-class boundary table

| Path class | Boundary control | Owner |
|---|---|---|
| By-reference (path crosses the wire) | Apply-time ceiling re-derivation (`by-reference-copy-wire` REQ-BRC-02) | Engine |
| By-value / inline content (bytes cross the wire) | **None**; lexical screen only, trusted-author v1 | SDK (hygiene, not security) |
| Destinations | Lexical guard at emit (`ir-path-well-formedness` REQ-IPF-02) + post-render containment (`by-reference-copy-wire` REQ-BRC-08) | SDK (lexical) + engine (apply) |

## §C Decision — `packageDir` is the sole run anchor

`resolvePackageRoot` and the ancestor walk are deleted; the bootstrap read-set shrinks
3 → 2 in a pinned order (reserved names, then schema) — `package-dir-run-anchor`
REQ-MFB-01.

## §D Decision — corpus marker deleted

ADR-0067's own text proves engine-safety ("the SDK reads it, never the engine's Go
loader"); `runner.ts`'s unconditional `packageDir = dirname(<factory module>)` needs no
ancestor marker. `conformance/collection.json` is deleted (`conformance-corpus`
REQ-CCR-08, retired).

## §E Decision — `AuthoringReason` 12 → 11

`source-outside-package` retires with the concept that defined it. `originFor`'s
exhaustive switch re-narrows; the FIT-04 `core.authoring-error.d.ts` baseline updates in
the **SAME commit** — a mismatch is a hard failure, never a follow-up.

## §F Decision — `statSync`, not `lstatSync` (resolved here per spec REQ-PSH-03)

The spec pins observable behaviour and defers the API. Behaviour matrix:

| Input | `statSync` (chosen) | `lstatSync` |
|---|---|---|
| in-package symlink → in-package regular file (REQ-PSH-03.1) | `isFile()` true → **accept** ✅ | `isSymbolicLink()`, `isFile()` false → `source-not-regular-file` ❌ **cannot satisfy** |
| symlink cycle / `ELOOP` (REQ-PSH-03.2) | throws `ELOOP` → `source-unreadable` ✅ | never throws — the link itself is fine ❌ |
| broken symlink (REQ-PSH-02.4) | throws `ENOENT` → `source-not-found` ✅ | succeeds → wrong verdict ❌ |
| in-package symlink → OUTSIDE regular file (REQ-PSH-04.1) | accept — the documented residual ✅ | reject ❌ (would silently re-impose a boundary) |
| FIFO / directory (REQ-PSH-01.1/.2/.3) | `isFile()` false → `source-not-regular-file` ✅ | same ✅ |

`lstatSync` is **rejected**: it cannot satisfy REQ-PSH-03.1's transparent read without a
hand-rolled readlink-follow loop that would re-implement the kernel's own cycle
detection — more code, a second `ELOOP` implementation, and a new bug surface. Today's
code already behaves like `statSync` (a disk-canonicalization pass **then** `lstatSync`
on the canonical target = follow-then-check); `statSync` preserves that verdict with one
call and no canonicalization step. `stat.size` is the **target's** size, matching today's
CCL-06 reuse exactly.

## §G Decision — one shared helper, not per-site inlining

`statSourceForRead` is consumed by `classify-transport.ts` (serving `readTemplateFile`
**and** scaffold per-entry) and by `runCopyIn`; `validateSourceLexical` is called at the
three named sites. Ruling 5 mandates **one** predicate; three copies would drift and
would need three `AuthoringError` mappings. FIT-45 makes both the single-implementation
and the exactly-three-call-sites properties mechanical. Cost: `path-guards.ts` hosts
three guards (source lexical, source hygiene, destination lexical) — accepted because all
three share `isLexicallyEscaping`/`sourceRejection` and exist solely to serve the same
three verbs; splitting would produce two-line modules and cross-imports for no isolation
gain. The module is named for what it holds (path guards), not for one of its functions.

## §H Consequences

(+) inline-collection projects run — the reported bug closes. (+) bootstrap read-set
3 → 2. (+) ~250 lines of disk-canonicalization/ceiling machinery and its
ancestor-symlink ENOENT-ordering subtlety disappear. (−) **Two breaking changes**: the
union narrowing, and the emit→apply timing shift for by-reference rejections where
applicable. (−) Residual risk, **verbatim** (never edited in place; amendments append a
dated line):

> SDK-side containment is removed. Against a hostile factory author this loses nothing
> (in-process code, full fs access — the ceiling never constrained it). The engine's
> apply-time re-derivation covers path-carrying directives only. The SDK's own
> inline-content reads keep a minimal lexical screen (`../`/absolute rejected at the two
> read sites); symlink-based escape from packageDir remains possible and is accepted (v1
> trusted-author model). Preserved as IO hygiene independent of containment: regular-file
> allow-list, AuthoringError-with-relative-path on every source rejection (no-echo),
> lexical destination guard, absolute-never-on-wire, walk loop-safety bounds. Error-reason
> differences form a filesystem existence/permission oracle — accepted, documented.

> **Dated amendment (owner ruling 5, 2026-07-28)**: the paragraph above says "the two
> read sites" — pre-ruling-5 language. Ruling 5 unifies the lexical screen across THREE
> call sites (`readTemplateFile`, scaffold's walk-root `from`, `copyIn`'s `from`), and the
> accepted symlink-escape residual WIDENS accordingly: it now covers BOTH path classes —
> (a) inline/by-value content reads (`readTemplateFile`, scaffold's by-value classify) AND
> (b) by-reference SOURCES crossing the wire (`copyIn`'s `from`, and a by-reference
> scaffold entry) — an in-package symlink pointing outside `packageDir` reaches the wire
> UNFILTERED for by-reference directives too, not only for inline content. This is wider
> than the original paragraph's scope, not narrower: previously a by-reference source's
> containment was disk-canonicalization-checked against a (possibly higher) ceiling; now
> there is no ceiling check for it at all, only the ruling-5 LEXICAL screen, which cannot
> see through a symlink.

> **Dated amendment (design V2, 2026-07-28) — resolved source path semantics**: the
> absolute path handed to `readFileSync` changes from **disk-canonicalized** to
> **lexical** (`resolve(join(packageDir, relPath))`). Consequence: the TOCTOU window
> between the stat and the read now spans one additional level of indirection — a
> symlink swapped between `statSync` and `readFileSync` is followed at read time, where
> previously the read targeted an already-resolved canonical path. Under the v1
> trusted-author model this is nil (the author owns the process and the filesystem), but
> it is a real semantic shift and is recorded rather than absorbed silently.

## §I Alternatives Rejected

- **Dual-marker** (accept `collection.json` *or* `project-builder.json`) — keeps the
  misplaced responsibility and doubles the marker surface; inline mode may ship neither.
- **Optional marker, fail-open** — the minimal fix; rejected because a boundary that
  silently disappears when a file is absent is worse than no boundary: it reads as a
  control in review and is not one.
- **`ceiling = packageDir`** — rejected on **scope/purpose** grounds: it retains SDK-side
  containment under a new anchor, i.e. keeps the responsibility the charter says is the
  engine's. Ruling 5 makes the resulting narrowing deliberate rather than an accidental
  side effect.
- **Parse the manifest to derive a real root** — rejected, charter L2.
- **Lexical guards as a containment substitute** — declined as a *substitute*. Distinct
  from ruling 5's adopted screen, which is scoped to the SDK's own reads (IR shape + IO
  hygiene) and is documented as explicitly NOT a security boundary. The distinction is
  the point: same code shape, different claimed purpose.

## §J Decision — `RunContext`'s `.d.ts` baseline is KIT-INTERNAL, not part of FIT-04's public list

`package-dir-run-anchor` REQ-MFB-01.3 and `fitness-guards` REQ-FTG-06(c) both bind the
`packageAnchors` shape to "the FIT-04 `.d.ts` baseline", but no such baseline existed
before this change and `RunContext` is **unmapped** (baseline §Public API: `src/core/**`
ships in the tarball with no subpath export, no public symbol). Creating
`test/fitness/dts-baseline/core.context.d.ts` inside FIT-04's *public* pair list would
promote a kit-internal type into the public semver contract as a side effect of a drift
guard — a real, unintended widening. Decision: the file is created and checked by the
same FIT-04 *mechanism*, in a **separate kit-internal baseline set**, so the shape is
pinned without any semver claim. Precedent: `dialect-error.ts`/`deep-equal.ts`/
`emit-rejection.ts` all ship unmapped with no public symbol.

**Q8 — the baseline alone is VACUOUS for this change's actual risk, so it is not left
alone.** FIT-04's comparison is `findBreakingRemovals(baseline, current) =
baseline.filter(line => !currentSet.has(line))` — **removal-only**. A regrown
`packageRoot`-shaped **additive** field on `RunContext` adds a line the baseline lacks
and therefore **passes silently** — which is precisely the regression REQ-FTG-06 exists
to catch. The complement is pinned in two places: **static, positive** — `fit-43` clause
(c) asserts `RunContext.packageAnchors`'s type literal **equals** `{ packageDir: string
}`, string-compared against the kit-internal `core.context.d.ts` baseline line —
equality, never containment, a superset must fail; **runtime, positive** —
`package-dir-run-anchor` REQ-MFB-01.3's `Object.keys(packageAnchors)` deep-equal against
`["packageDir"]`, owned by `test/skeleton/run-boundary-validation.test.ts`.

## Related ADRs

- **ADR-0045** (amended by this ADR): package-read source validation & the SDK/fake
  division of labor — the `source-*` family's origin/attribution rules survive
  unchanged; only the containment half of the division retires.
- **ADR-0046** (superseded by this ADR): `RunContext.packageRoot` eager ceiling seeding —
  the ceiling itself is deleted; `packageDir` is the sole anchor (§C).
- **ADR-0067** (superseded by this ADR): `collection.json` package-anchor marker — the
  marker this ADR's §D deletes.
