# Package-Dir Run Anchor Specification

**Spec version**: V3.5
**Status**: signed (owner, 2026-07-29 — micro-unfreeze V3.4→V3.5, ruling-17 follow-through + round-3 hardening coverage, owner-ratified at reckoning; V3.4 signed 2026-07-29, ruling 16 follow-through, judgment-day round 2; V3.3 signed 2026-07-28, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

**Ruling 17 follow-through + round-3 hardening coverage (2026-07-29, owner-ratified at
reckoning)**: two further behaviour changes landed after V3.4 signed — the degenerate
`from` rejection (`folder-scaffold` REQ-FSC-11, owner ruling 17) and the round-3
error-handling hardening batch (rename `..` pre-join rejection, include/exclude shape
validation, outside-run reporting parity with `copyIn`, normalized-path collision
detection, and the walk bound counting every enumerated dirent) — neither had a
CHANGELOG entry: the `## 0.2.0` section carried only the FOUR entries V3.4 pinned.
REQ-MFB-02 below now requires SIX entries: a FIFTH (ruling 17) and a SIXTH (round-3
hardening, grouped) are appended; the four V3.4 entries stay byte-identical.

**Ruling 16 follow-through (2026-07-29)**: judgment-day round 2 found the walk-ROOT
symlink rejection (F1, `folder-scaffold` REQ-FSC-09.3, owner ruling 16) — breaking,
author-visible behaviour — had no CHANGELOG entry: the `## 0.2.0` section carried only
the THREE entries this REQ originally pinned. REQ-MFB-02 below now requires a FOURTH
entry documenting the rejection plus a one-line migration hint (replace the symlink with
a real directory, or point `from` at the target inside the package); the three original
entries stay byte-identical, only a fourth is appended.

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write; plan-verify-3 findings B9/A3/B5): REQ-MFB-02 gains a
`docs/authoring-verbs.md` entry carrying the SAME qualified verbatim author rule
`ir-path-well-formedness` REQ-IPF-01 now states (finding B9); its greppable checklist
is extended to cover the three dated ADR supersession/amendment headers (0045/0046/0067)
— closing the "silent skip undetectable" hole in the sweep-allowlist qualification
(finding A3: an ADR is only a legitimate allowlisted home for retired vocabulary if it
actually CARRIES its dated header, never assumed). REQ-MFB-01.2 text-alignment sweep
(finding B5) confirmed clean within THIS spec's own content — no straggler "byte-exact"
copyIn phrasing found beyond the V3.2 fix; `design.md` §7/S-000 Acceptance criteria
still carry stale byte-exact copyIn language and need their own reconciliation pass
(design/slice artefacts, not spec's to edit here).

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 findings Q4/F4): REQ-MFB-01.2's `copyIn` leg is now
pinned as an EMITTED-DIRECTIVE-SHAPE assertion (package-relative `from`/`to`
correctness on the wire), NOT a byte-exact committed-tree assertion — the contract fake
and run vehicle deliberately never materialize `copyIn` bytes
(`src/testing/contract-fake.ts:237-247`); the `scaffold`/`create` legs keep their
byte-exact committed-tree assertion unchanged. NEW REQ-MFB-02 gives the CHANGELOG's
three drafted entries + preamble amendment a normative home, written against **v0.2.0**
(owner ruling 12: the version bump ships IN this change, `package.json` 0.1.0 → 0.2.0
— not "Unreleased").

**Family renamed (owner ruling 7, 2026-07-28)**: `marker-free-run-bootstrap` →
`package-dir-run-anchor` (positive invariant naming — "what the anchor IS," not "what
marker is absent"). REQ prefix `MFB` is HISTORICAL (family formerly
`marker-free-run-bootstrap`, renamed pre-archive per owner ruling 7) — REQ-IDs
REQ-MFB-01/.1/.2/.3 stay EXACTLY as-is for id-stability; only the family/folder name and
this file's title changed. Every cross-reference to this capability by name elsewhere in
this change's spec deltas is updated to `package-dir-run-anchor`; REQ-ID citations
(`REQ-MFB-01` etc.) are unaffected.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): split the
self-contradictory REQ-MFB-01.1 (a sentinel-throw scenario cannot ALSO assert the body
committed three verbs' worth of directives) into an ordering-pin scenario (.1) and a
separate end-to-end scenario (.2); the ordering pin's precondition now walks the FULL
ancestor chain, not one level; the packageAnchors-shape scenario (old .2) renumbers to
.3 and asserts via `Object.keys` deep-equality + the FIT-04 baseline, never
`toBeUndefined()`; Sensitive Areas wording corrected — this capability provides no
boundary control, it is a bootstrap simplification, not a "replacement" for containment.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write
per the `schematic-local-files` V2→V3 precedent): no content deltas targeted this
domain beyond the capability rename above (ruling 7) — version/status bump to keep this
change's spec bundle in lockstep at the shared sign-off point.

## Purpose

Pins the bootstrap invariant after SDK-side containment removal (owner ruling 4):
`packageDir` is the SOLE run anchor. No ancestor `collection.json` marker walk exists
anywhere in the pre-`als.run` chokepoint or afterward — the mechanism that broke every
inline-collection CLI project (no `collection.json` ever exists on disk for that mode)
is deleted, not widened. Where the boundary lies for a path that crosses the wire is an
apply-time, engine-owned decision (`by-reference-copy-wire` REQ-BRC-02, unchanged) —
this capability itself provides NO boundary control; it only removes a bootstrap read
that no longer has a legitimate reason to exist.

## Requirements

### REQ-MFB-01: `packageDir` Is the Sole Run Anchor — No Ancestor Marker Walk

`RunContext.packageAnchors` MUST collapse to `{ packageDir: string }` — the
`packageRoot` field and the `resolvePackageRoot()` ancestor walk for `collection.json`
(the retired containment family's own anchor/ceiling requirements) are DELETED. No read verb
(`scaffold`, `copyIn`, `create({templateFile})`) may resolve or require a containment
ceiling above `packageDir`; the pre-`als.run` bootstrap chokepoint performs exactly TWO
reads, in a PINNED ORDER — reserved-name checking, THEN schema validation
(`run-boundary-input-validation` REQ-RBV-06) — never a third, marker-seeking read.

#### Scenario REQ-MFB-01.1: Missing-ancestor rejection no longer pre-empts the factory body [red-today]

- GIVEN a factory defined via `defineFactory(fn, { packageDir })` in a package with NO
  `collection.json` anywhere on the ENTIRE ancestor chain from `packageDir` to the
  filesystem root — an own `mkdtemp`, never a marker-seeding scratch-dir helper, with an
  explicit precondition asserting `existsSync(join(dir, "collection.json")) === false`
  at EVERY directory `dir` from `packageDir` up to (and including) the filesystem root,
  not merely at `packageDir` itself — and whose body's FIRST statement is a sentinel
  `throw new Error("body-ran")`
- WHEN the factory runs
- THEN the thrown value IS the sentinel `"body-ran"` — proving no ancestor-marker
  rejection precedes the body (the inverse of the retired
  `run-boundary-input-validation` REQ-RBV-06.1 ordering pin, which proved the OPPOSITE
  for the ceiling-walk mechanism this change deletes)

#### Scenario REQ-MFB-01.2: All three read verbs commit with no `collection.json` anywhere — the inline-collection regression, closed [red-today]

- GIVEN the SAME no-marker-anywhere precondition as REQ-MFB-01.1 (own `mkdtemp`,
  full-ancestor-chain absence asserted), but WITHOUT a sentinel — the factory body
  exercises ALL THREE read verbs (`create({templateFile})`, `scaffold`, `copyIn`)
  against real package-local fixtures
- WHEN the factory runs
- THEN the `create({templateFile})` and `scaffold` legs commit, and the resulting
  committed tree carries BYTE-EXACT content for each
- AND the `copyIn` leg commits an emitted directive whose `from`/`to` fields are
  BYTE-EXACT-PACKAGE-RELATIVE-CORRECT on the wire (an EMITTED-DIRECTIVE-SHAPE
  assertion, not a committed-tree content assertion) — the contract fake and run
  vehicle deliberately never materialize `copyIn` bytes
  (`src/testing/contract-fake.ts:237-247`), so no test may assert `copyIn`'s
  committed byte content
- AND this temp-dir layout (a package directory with no marker anywhere above it) is
  EXPLICITLY EQUIVALENT to a real CLI inline-collection project, where the whole
  collection lives inside `project-builder.json` and no `collection.json` ever exists
  on disk

#### Scenario REQ-MFB-01.3: `packageAnchors` carries only `packageDir`, pinned at runtime AND in the `.d.ts` baseline [red-today]

- GIVEN a `RunContext` constructed by `defineFactory({ packageDir })`
- WHEN `packageAnchors` is inspected
- THEN `Object.keys(packageAnchors)` deep-equals exactly `["packageDir"]` — never
  asserted via `packageAnchors.packageRoot === undefined` (`toBeUndefined()`), which
  would pass even if a differently-named ceiling-shaped field regrew
- AND the FIT-04 `.d.ts` baseline for `RunContext` reflects the same single-field shape
  in the SAME commit

### REQ-MFB-02: CHANGELOG Documents the Six Behaviour-Change Entries Against v0.2.0 (owner rulings 9/12; ruling 16 follow-through, 2026-07-29; ruling-17 follow-through + round-3 hardening coverage, 2026-07-29, owner-ratified at reckoning)

`CHANGELOG.md` MUST carry, under a **`## 0.2.0`** heading (never `## Unreleased` — owner
ruling 12 ships the version bump `package.json` 0.1.0 → 0.2.0 IN this change), exactly
SIX entries: (a) the HEADLINE `Fixed` entry — the inline-collection regression this
capability closes; (b) a `Changed` (breaking) entry — the `AuthoringReason` union
narrowing 12 → 11, with migration text; (c) a `Changed` entry — the honest realpath/
symlink timing statement, cross-linking `SECURITY.md` (`package-source-io-hygiene`
REQ-PSH-05); (d) **[ruling 16 follow-through, 2026-07-29]** a `Changed` (breaking) entry —
the walk-ROOT symlink rejection (`folder-scaffold` REQ-FSC-09.3, owner ruling 16): a
`from` symlinked to a shared templates directory used to be FOLLOWED transparently and now
hard-rejects `invalid-input`, with a one-line migration hint (replace the symlink with a
real directory, or point `from` at the target inside the package); (e) **[ruling 17,
2026-07-29]** a `Changed` (breaking) entry — a degenerate `from` (`""`, `"."`, or `"./"`)
used to walk the ENTIRE package silently and now rejects `invalid-input`
(`folder-scaffold` REQ-FSC-11), with a one-line migration hint (name the intended
subfolder explicitly); (f) **[round-3 hardening, 2026-07-29]** ONE grouped `Fixed` entry
covering the round-3 error-handling hardenings — rename values containing `..` now
reject pre-join instead of silently relocating outside `to` (`folder-scaffold`
REQ-FSC-02), `include`/`exclude` must be arrays of strings, a `scaffold` call outside a
run now reports `outside-run`, destination collisions are detected on normalized paths,
and the 10,000-entry walk bound counts every enumerated dirent. The existing preamble's
premise ("pre-release, `0.0.0`, zero live consumers … nothing here requires a migration
guide") MUST be amended to name the REAL audience — the engine repo and the conformance
corpus consume this contract today even though no npm consumer does — so the
breaking/behaviour entries above carry migration text for THEM, not a summary claiming no
migration is needed.

`docs/authoring-verbs.md` MUST ALSO carry the SAME qualified verbatim author rule
`ir-path-well-formedness` REQ-IPF-01 states: *"the SDK rejects lexical `../` or absolute
source paths, always; everything a schematic reads lives inside its package — symlinks
are followed without target verification (see SECURITY.md)."* — this is the rule's
documented HOME (`design.md:414`); REQ-IPF-01 pins the normative behaviour, this clause
pins that the author-facing doc actually carries it, verbatim, with the qualifier.

`ADR-0077` MUST supersede/amend ADR-0046, ADR-0067, and ADR-0045 respectively, EACH with
a DATED supersession/amendment header on the superseded/amended file itself
(`ADR-0046`/`ADR-0067`: "Superseded by ADR-0077, {date}"; `ADR-0045`: "Amended by
ADR-0077, {date}") — this is part of THIS REQ's greppable checklist because those three
headers are the qualifying condition for the retired containment family's own falsifiable
acceptance criterion allowlist ("superseded ADRs... are... legitimate places this
vocabulary survives"): an ADR that still mentions the retired vocabulary but was NEVER
given its dated header is not legitimately allowlisted — a silent skip would otherwise
be undetectable. Checking for the headers' PRESENCE closes that hole.

#### Scenario REQ-MFB-02.1: CHANGELOG carries all six entries under `## 0.2.0`, preamble amended [red-today]

- GIVEN `CHANGELOG.md`
- WHEN inspected
- THEN a `## 0.2.0` heading exists (not `## Unreleased`) containing all six entries
  (a)/(b)/(c)/(d)/(e)/(f) above, each present and mechanically `rg`-greppable by its
  distinguishing phrase; AND the preamble no longer claims "nothing here requires a
  migration guide" without qualification — it names the engine repo and the conformance
  corpus as the real audience the breaking entries' migration text serves
- AND `package.json#version` reads `"0.2.0"`, bumped in the SAME commit as the
  CHANGELOG update

#### Scenario REQ-MFB-02.2: `docs/authoring-verbs.md` carries the qualified verbatim rule [red-today]

- GIVEN `docs/authoring-verbs.md`
- WHEN inspected
- THEN it contains the qualified verbatim author rule above, word-for-word including
  the symlink/SECURITY.md qualifier — not the unqualified pre-B9 form

#### Scenario REQ-MFB-02.3: ADR-0045/0046/0067 each carry their dated supersession/amendment header [red-today]

- GIVEN `openspec/decisions/0046-*.md`, `openspec/decisions/0067-*.md`, and
  `openspec/decisions/0045-*.md`
- WHEN inspected
- THEN `0046`/`0067` each carry a dated "Superseded by ADR-0077" header and `0045`
  carries a dated "Amended by ADR-0077" header — a missing header on any of the three
  fails this check, closing the allowlist-qualification hole finding A3 identified

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation / containment) | REQ-MFB-01 | Yes — this capability is the successor HOME for the deleted ancestor-walk mechanism; it carries no boundary control of its own (no ceiling, no re-derivation) — the flag reflects provenance, not an active guard |
| public-api (release vehicle) | REQ-MFB-02 | Yes — version bump + CHANGELOG for a MAJOR (breaking) narrowing |
