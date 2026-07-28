# Delta for Fitness Guards

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write; plan-verify-3 findings B1/B4): clause (e)'s allowlist now explicitly
scopes ITSELF to `openspec/specs/**` — a live REQ-PRC-/`package-root-containment`/
`source-outside-package` hit inside `openspec/specs/**` clears ONLY at archive-sync,
never before; pre-archive, the CURRENTLY-live `package-root-containment/spec.md` (not
yet replaced) and the S-000.1 pre-archive restore of REQ-AEC-10/11/12 (which legitimately
narrates the retiring value while restoring it) are EXPECTED, temporary hits — clause
(e) does not run, and is not violated, before archive-sync. `test/e2e/author-emulation/corpus/coverage-manifest.md`'s
own prose line dropping the retired citations is explicitly OUT of clause (e)'s scope
(it is a generated test artefact, not under `openspec/specs/`) — that cleanup is slice
task S-004.6's job, unchanged. REQ-FTG-06.4 is clarified: it is a FIXTURE-PAIR scenario
that ships IN-CHANGE (fit-43, buildable and green-able NOW, never scanning the real
tree) — distinct from clause (e)'s own separate, real-`openspec/specs/`-tree sweep,
which is archive-sync only; REQ-FTG-06.4 tests the sweep LOGIC, not the real tree.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 finding F2): REQ-FTG-06's clauses are now fully
lettered — the `test/**` fabrication-scan allowlist sentence (previously unlabeled
prose) is now explicit clause (d); NEW clause (e) gives the `openspec/specs/` rg sweep
(the `package-root-containment` delta's falsifiable acceptance criterion) a formal
ARCHIVE-SYNC fitness-guards home, owned by `sdd-archive` rather than a `src/**` runtime
test — cross-referencing, not duplicating, slice S-006.3's broader code/docs/conformance
sweep. New scenario REQ-FTG-06.4.

V3 → V3.1 (owner micro-unfreeze, 2026-07-28, ruling 11 — pre-authorized, signed-on-write):
REQ-FTG-06 gains clause (f): zero `realpathSync`/`realpath` references (code or comment)
anywhere in `src/scaffold/**` or `src/core/context.ts`; the sole exception is the SAME
symbol-scoped allowlist entry clause (a) already carries
(`src/transport/single-instance-probe.ts#packageRootFor`) — otherwise the allowlist is
empty. Rationale: backs the cross-repo handoff claim ("the SDK no longer realpath-resolves
sources," `proposal.md` §Dependencies) with a MECHANICAL guard — plan-verify Judge A
finding #5 noted this shipped hard gate previously had no signed REQ behind it. New
scenario REQ-FTG-06.3 (NOT `.2` — that scenario ID is already taken by the symbol-scoped
allowlist test from V2; per id-stability, a new scenario never reuses an occupied
number).

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only. (REQ-FTG-06's
`RunContext`/FIT-04-baseline reference is unaffected by the `package-dir-run-anchor`
capability rename — it cites the FIT-04 artefact, not the capability name.)

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): REQ-FTG-06's
allowlist entry is now SYMBOL-scoped (not file-scoped — a file-scoped allowlist would
reopen the hole by permitting any new function in that file); clause (c) is bound
explicitly to the FIT-04 `.d.ts` baseline. REQ-FTG-07's mintability scan explicitly
EXCLUDES the union type declaration and `originFor`'s switch arms (both would otherwise
report every member vacuously "reachable"); the non-runnable REQ-FTG-07.2 is replaced
with a concrete, executable assertion. REQ-FTG-08 and all negative scenarios are now
specified as pure functions over an injectable root/file-list, run against FIXTURE
directories — never live mutation of `src/**` — with FIT-NEW-C's detector precisely
defined.

## ADDED Requirements

### REQ-FTG-06: FIT-NEW-A — No Ceiling Regrowth

A fitness test MUST statically scan `src/**` and assert: (a) the literal string
`"collection.json"` appears in ZERO files; (b) no ancestor-walk idiom (a loop calling
`dirname` upward searching for a marker file) exists anywhere; (c) `RunContext`'s
`packageAnchors` field shape matches the FIT-04 `.d.ts` baseline exactly (single-field
`{packageDir}`) — bound to the SAME baseline artefact FIT-04 already maintains, not a
second, ad hoc runtime check. The scan's allowlist for the pre-existing, UNRELATED
`packageRootFor()` walk is SYMBOL-scoped —
`src/transport/single-instance-probe.ts#packageRootFor` specifically, not the whole
file — because that function is a structural TWIN of the banned ancestor-walk idiom; a
file-scoped allowlist would let any OTHER function added to that file regrow the banned
idiom undetected. (d) the scan's allowlist additionally covers `test/**` with an
EXPLICIT, per-symbol allowlist of any surviving marker-fabricating fixture helper — a
deliberate, reviewed entry, never invisible debt. (e) — SCOPED TO `openspec/specs/**`
ONLY, and enforced AT ARCHIVE-SYNC TIME ONLY (NOT a `src/**` runtime fitness test, NOT
enforced pre-archive — an `sdd-archive`-owned check, per plan-verify-2 finding F2,
scoping refined at V3.3 per finding B1): once this change archives and its delta syncs
into the main specs, `rg 'package-root-containment|REQ-PRC-|source-outside-package'
openspec/specs/` returns ZERO hits, excepting the version-history/changelog allowlist
the `package-root-containment` delta's falsifiable acceptance criterion defines.
PRE-archive, this clause does not run and is not violated by the currently-live
`package-root-containment/spec.md` (not yet replaced) or by slice task S-000.1's
pre-archive restore of `REQ-AEC-10/11/12` (which legitimately narrates the retiring
value while restoring it — an expected, temporary hit). `test/e2e/author-emulation/corpus/coverage-manifest.md`'s
own prose-line cleanup is explicitly OUT of this clause's scope (a generated test
artefact, not under `openspec/specs/`) — that is slice task S-004.6's job, unaffected.
This is the SPECS-side sibling of slice S-006.3's broader sweep (`src/**`, `docs/**`,
`test/**`, `conformance/**` — the retired marker message and `source-outside-package`,
with its own allowlist) — cross-referenced, not duplicated: S-006.3 owns the
code/docs/conformance surfaces, clause (e) owns the `openspec/specs/` surface, and only
at archive-sync. (f) the literal string
`"realpathSync"` and the literal string `"realpath"` appear in ZERO code or comment
lines anywhere under `src/scaffold/**` or `src/core/context.ts` — the sole exception is
the SAME symbol-scoped allowlist entry clause (a)/(c) already carry
(`src/transport/single-instance-probe.ts#packageRootFor`); the allowlist for this clause
is otherwise EMPTY. Rationale: this backs the cross-repo engine handoff's claim that
"the SDK no longer realpath-resolves sources" (`proposal.md` §Dependencies) with a
mechanical guard rather than an unverified assertion — plan-verify Judge A finding #5
noted this shipped hard gate previously had no signed REQ behind it.

#### Scenario REQ-FTG-06.1: FIT-NEW-A fails if `collection.json` or an ancestor walk regrows in `src/**` [red-today]

- GIVEN a deliberately reintroduced `collection.json` literal or ancestor-walk loop
  under `src/**`, run against a FIXTURE file tree (the scanner is a pure function over
  an injectable file list, not a live mutation of the real `src/**`)
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the offending file

#### Scenario REQ-FTG-06.2: The symbol-scoped allowlist does not shadow a new offending symbol in the same file [red-today]

- GIVEN a fixture mirroring `single-instance-probe.ts`'s shape, with the allowlisted
  `packageRootFor` symbol PLUS a second, deliberately reintroduced ancestor-walk
  function in the SAME file
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the second (non-allowlisted) function — proving the allowlist
  is symbol-scoped, not file-scoped

#### Scenario REQ-FTG-06.3: FIT-NEW-A fails if a `realpathSync`/`realpath` reference regrows outside the allowlisted symbol [red-today]

- GIVEN a fixture file tree under `src/scaffold/**` (or mirroring `src/core/context.ts`)
  containing a deliberately reintroduced `realpathSync`/`realpath` reference — in code
  OR in a comment — OUTSIDE the allowlisted
  `src/transport/single-instance-probe.ts#packageRootFor` symbol, run against the SAME
  injectable fixture-file-list pure function REQ-FTG-08 already establishes as this
  family's pattern
- WHEN FIT-NEW-A runs against that fixture
- THEN it fails, naming the offending file and line — the allowlisted
  `packageRootFor` symbol itself, present in the SAME fixture set, does NOT trigger a
  failure

#### Scenario REQ-FTG-06.4: The `openspec/specs/` sweep LOGIC fails on a live (non-historical) orphaned citation — fixture-pair, ships IN-CHANGE [red-today]

- GIVEN a FIXTURE PAIR (never the real `openspec/specs/` tree — this scenario is
  buildable and green-able NOW, inside fit-43, exactly like REQ-FTG-06.1/.2/.3's own
  fixture-driven pattern): fixture A mirrors `openspec/specs/` containing a LIVE
  (non-version-history) mention of `package-root-containment`, `REQ-PRC-`, or
  `source-outside-package` — i.e., OUTSIDE any `(Previously: ...)` or `V{n} → V{n+1}`
  marker; fixture B contains ONLY allowlisted version-history mentions of the same terms
- WHEN clause (e)'s sweep LOGIC runs against each fixture
- THEN fixture A fails, naming the offending file and line; fixture B does NOT fail —
  proving the logic credits the allowlist, not merely string-matching
- **Distinct from clause (e) itself**: this scenario tests the SWEEP'S LOGIC via
  fixtures; it does NOT invoke the sweep against the real `openspec/specs/` tree — that
  invocation is clause (e)'s own separate, archive-sync-only obligation, never exercised
  by this in-change test

### REQ-FTG-07: FIT-NEW-B — Closed-Union Reachability Over BOTH Minting Mechanisms

A fitness test MUST assert every surviving `AuthoringReason` member is mintable from
`src/**` through the UNION of two mechanisms: the `CODE_TO_REASON` value set
(`authoring-error.ts`) AND direct `AuthoringError` construction sites (the
`sourceRejection`-equivalent reason parameter union, plus literal `reason:` properties
at construction sites such as `classify-transport.ts`) — EXCLUDING, from the scan
itself, the `AuthoringReason` union type declaration and `originFor`'s switch arms
(both list every member BY DEFINITION; including them would make every member
vacuously "reachable" regardless of whether any real construction site mints it).
`CODE_TO_REASON` ALONE is insufficient — it maps only `EmitRejectionCode` to five
reasons and mints no `source-*` reason at all, the exact family this change touches;
defined via `CODE_TO_REASON` alone, this check would pass vacuously after the union
shrink.

#### Scenario REQ-FTG-07.1: FIT-NEW-B fails if a surviving reason is unreachable from either mechanism [red-today]

- GIVEN a surviving `source-*` reason deliberately made unreachable (removed from both
  `CODE_TO_REASON` and every direct construction site, but still present in the union
  declaration and `originFor`'s switch — proving the scan does not credit those two
  excluded locations), run against a fixture module set
- WHEN FIT-NEW-B runs against that fixture
- THEN it fails, naming the unreachable reason

#### Scenario REQ-FTG-07.2: `CODE_TO_REASON`'s value set contains zero `source-*` reasons [red-today]

- GIVEN `CODE_TO_REASON`'s value set (`authoring-error.ts`)
- WHEN scanned for any `source-*`-prefixed value
- THEN none is found — a concrete, executable assertion proving `CODE_TO_REASON` alone
  can never satisfy REQ-FTG-07 for this family of reasons, replacing the non-runnable
  V1 scenario that only explained the risk in prose

### REQ-FTG-08: FIT-NEW-C — Exactly One Lexical Predicate Implementation

A fitness test MUST statically scan `src/**` and assert that every occurrence of the
`..`-segment/absolute-path lexical rejection idiom (`ir-path-well-formedness`
REQ-IPF-01's predicate — segment-aware over `/` and `\`, checking for a `..` segment or
an absolute-looking path) resolves to a SINGLE file-and-function pair — never one
implementation per call site, never a second parallel predicate introduced for a
different verb. The scanner is exposed as a PURE function over an injectable
root/file-list, so both the passing case and its negative scenarios run against fixture
directories, never against a live-mutated copy of the real `src/**`.

#### Scenario REQ-FTG-08.1: FIT-NEW-C fails if a second lexical predicate implementation appears [red-today]

- GIVEN a fixture file tree containing the real predicate PLUS a deliberately
  introduced second, parallel `../`/absolute-path check function implementing the same
  idiom
- WHEN FIT-NEW-C runs against that fixture
- THEN it fails, naming both predicate implementations (file + function for each)

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (regrowth/reachability guards for the retired containment mechanism) | REQ-FTG-06, REQ-FTG-07, REQ-FTG-08 | Yes |
