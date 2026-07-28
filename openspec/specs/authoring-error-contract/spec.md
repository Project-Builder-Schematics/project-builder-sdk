# Delta for authoring-error-contract

**Spec version**: V3
**Status**: signed (owner, 2026-07-14 — V4 scope-reduction per foresight obs #2128)
**Change**: `author-write-surface`

(V3: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` calling convention is DEFERRED (`typescript-dialect` REQ-TSD-12
tombstoned). REQ-AEC-13's SUBSTANCE is UNCHANGED — the label `"modify"` is still kept regardless
of author call form; the only edit below is factual: the parenthetical enumerating call forms
drops "importable" since it no longer exists in this change's shipped surface.)

**Restoration note (`inline-collection-marker` S-000.1, pre-archive step)**: REQ-AEC-10/11/12
below were missing from this main family file — an archive-sync gap unrelated to
`author-write-surface` — and are restored here verbatim from the archived
`schematic-local-files` change's signed delta
(`openspec/changes/archive/2026-07-13-schematic-local-files/specs/authoring-error-contract/spec.md`),
which is the only archived change that ever wrote them. This restores the PRE-`inline-collection-marker`
state (union still twelve, `source-outside-package` included); `inline-collection-marker`'s own
MODIFIED blocks (its `specs/authoring-error-contract/spec.md` delta) narrow the union to eleven
at archive-sync, on top of this restored text — never applied here.

## ADDED Requirements

### REQ-AEC-10: Closed Reason Enum Extended — 4 By-Reference Reasons

`AuthoringError.reason` MUST extend from eight to TWELVE closed-union values, adding
exactly: `"source-not-found"`, `"source-outside-package"`, `"source-not-regular-file"`,
`"source-unreadable"` (obs #915 open items; MAJOR coordinated extension, precedented
by the Stage-2/4 `invalid-input`/`reserved-name` addition). All four cover failures
detected by the SDK's OWN pre-emit read/stat of a package-local source (`scaffold` /
`copyIn` / `create({templateFile})`) — never an engine round-trip refusal — so, per
REQ-AEC-02's origin-derivation rule (ADR-0021), `origin` for all four is ALWAYS
`"authoring-rejected"`, the same rationale as `invalid-input`/`reserved-name`.

| Value | Covers |
|---|---|
| `source-not-found` | an IN-CEILING package-local source path that does not exist (`by-reference-copy-wire` REQ-BRC-06) — NEVER reachable for out-of-ceiling paths (REQ-PRC-07) |
| `source-outside-package` | source resolves outside the containment ceiling (`package-root-containment` REQ-PRC-04/07) — fires BEFORE any existence probe, whether or not the target exists |
| `source-not-regular-file` | source is not a regular file per the allow-list lstat (directory, FIFO, socket, device; symlinked-dir descent) (REQ-PRC-04.3/.4) |
| `source-unreadable` | an in-ceiling, regular-file source that could not be read (permission, I/O error) |

`originFor`'s exhaustive switch (`src/core/authoring-error.ts`) MUST add all four
under the `authoring-rejected` arm; the existing compile-time exhaustiveness pin test
MUST be extended to the twelve-member union.

#### Scenario REQ-AEC-10.1: Each of the four new reasons classifies exactly and maps to authoring-rejected [SDK]

- GIVEN one fixture per new reason: missing in-ceiling source, out-of-ceiling source,
  directory-as-source, and an unreadable source exercised via the fake/conformance
  simulation or an injected read-failure (EACCES) seam — never a chmod-based CI
  fixture (S18: chmod fixtures are unreliable under root-running CI and container
  umasks)
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly the corresponding new value and `origin` is
  `"authoring-rejected"` for all four

#### Scenario REQ-AEC-10.2: originFor exhaustiveness pin extends to 12 members [SDK]

- GIVEN the compile-time exhaustiveness test (`test/types/authoring-reason.test.ts`)
- WHEN the `reason` union is extended to twelve members
- THEN `originFor`'s switch statement compiles only when all twelve arms are handled
  — a missing arm fails the build

### REQ-AEC-11: Message Template Rows for the 4 New Reasons

REQ-AEC-06/09's message-template table gains four rows, one per new reason, all
package-relative and no-echo (never the raw source content, never an absolute path,
never a raw OS errno string beyond a described category):

| Family | Reason | Template |
|---|---|---|
| Source missing (in-ceiling only) | `source-not-found` | `"source file not found: {path} does not exist in the package"` |
| Source outside package | `source-outside-package` | `"source file outside package: {path} resolves outside the package boundary"` |
| Source not a regular file | `source-not-regular-file` | `"source file invalid: {path} is not a regular file"` |
| Source unreadable | `source-unreadable` | `"source file unreadable: {path} could not be read"` |

`{path}` is always package-relative (never absolute), per `package-root-containment`
REQ-PRC-05.

**No-existence-oracle clause (B5)**: for a path resolving OUTSIDE the containment
ceiling, the ONLY reachable reason/template is `source-outside-package`, regardless of
whether the target exists — the `source-not-found` row is reachable EXCLUSIVELY for
in-ceiling paths. The not-found vs outside-package pair MUST NEVER differentiate
existing from non-existing out-of-ceiling targets (`package-root-containment`
REQ-PRC-07).

#### Scenario REQ-AEC-11.1: Each new-reason message follows its exact template, path relative [SDK]

- GIVEN one rejection per new reason, each with a known package-relative source path
- WHEN each message is inspected
- THEN it matches its exact template with the path substituted, and contains no
  absolute filesystem path

### REQ-AEC-12: Scaffold-Family Failures Reuse the EXISTING `invalid-input` Reason [OWNER]

The following scaffold-family failure modes MUST map to the EXISTING `invalid-input`
reason (`origin: "authoring-rejected"` per REQ-AEC-07's established derivation) —
owner-ruled 2026-07-12; they are author-misuse-of-the-authoring-surface failures, not
new source-access families, so the MAJOR union extension stays EXACTLY the four
`source-*` members of REQ-AEC-10 and the union arithmetic stays exactly TWELVE:

| Failure mode | Ruled by | REQ |
|---|---|---|
| `templateFile` binary/oversized fail-loud | [OWNER] | `file-escape-hatches` REQ-FEH-02 |
| Zero files after include/exclude filter | [OWNER] | `folder-scaffold` REQ-FSC-04 |
| Missing `collection.json` ancestor | [OWNER] | `package-root-containment` REQ-PRC-03 |
| `.template` sniff-fail inside a scaffold walk | same family (spec-derived — owner eyeball) | `content-classification` REQ-CCL-05 |
| Intra-scaffold destination collision | same family (spec-derived — owner eyeball) | `folder-scaffold` REQ-FSC-08 |
| Walk entry-count bound exceeded | same family (spec-derived — owner eyeball) | `folder-scaffold` REQ-FSC-09 |

#### Scenario REQ-AEC-12.1: The three owner-ruled modes classify as invalid-input, authoring-rejected [SDK]

- GIVEN one rejection per owner-ruled mode: a binary `templateFile`, a filter set
  eliminating every entry, and a package with no `collection.json` ancestor
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly `"invalid-input"` and `origin` is
  `"authoring-rejected"` for all three
- AND the compile-time union pin still counts exactly twelve members — none of these
  modes minted a new reason

### REQ-AEC-13: `AuthoringVerb`/`DryRunVerb` KEEP the label `"modify"` — wire-mutation vocabulary, deliberately unrenamed

`AuthoringVerb` (the closed set of verb labels attributed to a rejected write, REQ-AEC-04) and
`DryRunVerb` (the equivalent label surfaced by `dryRun()`'s plan) MUST both KEEP the literal
value `"modify"` to label ANY write-directive-level mutation — regardless of which AUTHOR-facing
call produced it. Both `.replaceContent(content)` (wholesale-replace) and `.modify(fn)`
(AST-fn escape hatch, chained form — the importable calling convention is DEFERRED, see
`typescript-dialect` REQ-TSD-12 tombstone) lower to the SAME wire directive `{op:"modify"}`
(`foundations-skeleton` REQ-KIT-03; wire IR is OUT OF this change's scope). This REQ is a
DELIBERATE PIN, owner-ratified (engram #2117): the vocabulary labels the WIRE mutation, not the
author method name — "modify" is honest at THAT altitude, even though no author-callable verb
is literally spelled `.modify(...)` when the string-replace form is used. No `AuthoringVerb`/
`DryRunVerb` member renames to `"replaceContent"`; the closed set gains no new member from this
change. This PIN exists so a future refactor does not "fix" what looks like a stale label —
the mismatch between the author call name and the wire-level `AuthoringVerb` label is
intentional and permanent absent a separate, explicitly-authorized amendment.

**Documentation surfaces (V2, closes a gap the council flagged — this pin lived only in JSDoc
in V1, and the two author-facing docs describing `verb`/vocabulary weren't updated to state it)**:
- `docs/authoring-errors.md` (the `verb` field's description, line ~28) MUST ALSO state that
  `verb` labels the WIRE MUTATION — i.e. that BOTH `.replaceContent()` and `.modify(fn)` surface
  as `verb: "modify"` — not merely list `"modify"` as one of the closed set's literal values.
- `docs/dry-run.md` (the "author vocabulary" claim, line ~14) MUST likewise state that the
  `verb` field on a `DryRunEntry` labels the wire mutation, not the author-facing call name, for
  the SAME reason.
- The rationale breadcrumb (WHY the label is deliberately unrenamed) goes in the AUTHOR-facing
  doc — `docs/authoring-verbs.md`'s `replaceContent` entry — not ONLY in JSDoc; JSDoc alone is
  invisible to a reader who only reads the published docs site, not the source.

(V2 also fixes: the inducer for REQ-AEC-13.1 was previously left generic ("e.g. a
`path-collision`/`path-not-found` family rejection") — narrowed to a concrete, reproducible
case; and REQ-AEC-13.2 now names the concrete field carrying the verb in `dryRun()`'s plan
entry shape.)

#### Scenario REQ-AEC-13.1: a failed `.replaceContent()` on a never-created path reports `verb: "modify"`

- GIVEN an author calls `.replaceContent(content)` targeting a path that was NEVER created in
  this run (the `source-not-found` family — the target simply does not exist), and the write is
  REJECTED by the engine
- WHEN the resulting `AuthoringError` is inspected
- THEN `verb` is EXACTLY `"modify"` — NOT `"replaceContent"` — because the wire directive both
  `.replaceContent()` and `.modify(fn)` produce is `{op:"modify"}`; the label reflects the wire
  mutation, not the author-facing call name

#### Scenario REQ-AEC-13.2: `dryRun()` over a pending `.replaceContent()` reports the SAME `"modify"` verb, on the `DryRunEntry.verb` field

- GIVEN a chain with an uncommitted `.replaceContent(content)` directive
- WHEN `dryRun()` is called mid-chain (`modify-coalescing` REQ-MC-05's plan-exposure contract)
- THEN the returned `DryRunEntry`'s `verb` field (the concrete plan-entry field this REQ pins,
  cross-referencing `foundations-skeleton`'s `dryRun()` shape) reads `"modify"` — the SAME label
  used for a `.modify(fn)`-produced directive's plan entry, since both are, at the wire level,
  the identical mutation kind

#### Scenario REQ-AEC-13.3: the pin is documented as deliberate, not a stale label — in JSDoc AND the author-facing docs

- GIVEN `AuthoringVerb`'s JSDoc, `docs/authoring-errors.md`'s `verb` field description, and
  `docs/dry-run.md`'s "author vocabulary" claim
- WHEN each is inspected
- THEN ALL THREE state explicitly that `"modify"` labels the WIRE mutation shared by BOTH
  `.replaceContent()` and `.modify(fn)`, and that this is intentional — guarding against a
  future contributor "fixing" the apparent name mismatch in ANY of the three locations; a guard
  test scans all three and fails RED if any is missing the statement

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) — closed `AuthoringReason` union, MAJOR coordinated extension | REQ-AEC-10, REQ-AEC-11, REQ-AEC-12 | Yes |
| public-api (contract) — `AuthoringVerb`/`DryRunVerb` closed-set membership unchanged, deliberate label pin | REQ-AEC-13 | Yes |
