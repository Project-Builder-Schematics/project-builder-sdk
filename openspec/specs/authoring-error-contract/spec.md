# Delta for authoring-error-contract

**Spec version**: V4
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3 → V4 (archive-sync, `inline-collection-marker`, 2026-07-29): `AuthoringError.reason` narrows from twelve to ELEVEN closed-union values — the reason value covering an out-of-ceiling source is retired along with the family that defined the ceiling it named (a MAJOR, breaking narrowing consumers must handle in their exhaustive `switch(reason)` blocks; `originFor`'s exhaustiveness pin and the FIT-04 `.d.ts` baseline both re-narrow in the same commit as this sync per the change's own signed requirement). REQ-AEC-11's message-template table drops the retired reason's row and splits the single ruling-5 lexical-screen row into two independent rows (source and destination, each driven from its own REQ — the prior single row conflated two different message shapes). REQ-AEC-12 drops its "missing ancestor" row (the ancestor walk it referenced no longer exists) and gains two rows for the new lexical-screen failure modes, reusing the same `invalid-input` reason. REQ-IDs stable; REQ-AEC-13 unaffected.

(V3: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` calling convention is DEFERRED (`typescript-dialect` REQ-TSD-12
tombstoned). REQ-AEC-13's SUBSTANCE is UNCHANGED — the label `"modify"` is still kept regardless
of author call form; the only edit below is factual: the parenthetical enumerating call forms
drops "importable" since it no longer exists in this change's shipped surface.)

## Requirements

### REQ-AEC-10: Closed Reason Enum — 3 By-Reference Reasons (Eleven Total)

`AuthoringError.reason` MUST hold ELEVEN closed-union values, including exactly:
`"source-not-found"`, `"source-not-regular-file"`, `"source-unreadable"`. All three
cover failures detected by the SDK's OWN pre-emit read/stat of a package-local source
(`scaffold` / `copyIn` / `create({templateFile})`) — never an engine round-trip refusal
— so, per REQ-AEC-02's origin-derivation rule (ADR-0021), `origin` for all three is
ALWAYS `"authoring-rejected"`.

| Value | Covers |
|---|---|
| `source-not-found` | a package-local source path that does not exist (`by-reference-copy-wire` REQ-BRC-06, `package-source-io-hygiene` REQ-PSH-02) |
| `source-not-regular-file` | source is not a regular file per the allow-list stat (directory, FIFO, socket, device) (`package-source-io-hygiene` REQ-PSH-01) |
| `source-unreadable` | a source that could not be read (permission, I/O error, embedded NUL byte, or a symlink cycle/`ELOOP`) (`package-source-io-hygiene` REQ-PSH-02/03) |

`originFor`'s exhaustive switch (`src/core/authoring-error.ts`) MUST drop the
prior out-of-ceiling arm under the `authoring-rejected` case; the compile-time
exhaustiveness pin test MUST be re-narrowed to the eleven-member union. The `.d.ts`
fitness baseline (FIT-04) MUST be updated in the SAME commit as this union shrink — a
FIT-04 mismatch (baseline still showing twelve members) is itself a hard failure of this
REQ, never a follow-up.

#### Scenario REQ-AEC-10.1: Each of the three surviving reasons classifies exactly and maps to authoring-rejected [preservation-pin]

- GIVEN one fixture per surviving reason: missing source, directory-as-source, and an
  unreadable source exercised via the fake/conformance simulation or an injected
  read-failure (EACCES) seam — never a chmod-based CI fixture
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly the corresponding value and `origin` is
  `"authoring-rejected"` for all three

#### Scenario REQ-AEC-10.2: `originFor` exhaustiveness pin re-narrows to 11 members, FIT-04 updated same commit [preservation-pin]

- GIVEN the compile-time exhaustiveness test (`test/types/authoring-reason.test.ts`) and
  the FIT-04 `.d.ts` baseline
- WHEN the `reason` union shrinks to eleven members
- THEN `originFor`'s switch statement compiles only when all eleven arms are handled —
  a stale twelfth arm fails the build — AND the FIT-04 baseline is updated to eleven
  members in the SAME commit, never a follow-up

### REQ-AEC-11: Message Template Rows for the 3 Surviving Reasons and the Ruling-5 Screen (Source and Destination, Split)

REQ-AEC-06/09's message-template table carries FIVE rows — three for the surviving
`source-*` reasons (one, `source-not-regular-file`, with two variant forms), one for the
ruling-5 SOURCE screen (`ir-path-well-formedness` REQ-IPF-01), and one for the
destination guard (`ir-path-well-formedness` REQ-IPF-02) — all package-relative and
no-echo (never the raw source content, never an absolute path, never a raw OS errno
string beyond a described category):

| Family | Reason | Template |
|---|---|---|
| Source missing | `source-not-found` | `"source file not found: {path} does not exist in the package"` |
| Source not a regular file — directory | `source-not-regular-file` | `"source file invalid: {path} is a directory, not a regular file — use scaffold() to copy a folder"` |
| Source not a regular file — other (FIFO/socket/device) | `source-not-regular-file` | `"source file invalid: {path} is not a regular file"` |
| Source unreadable | `source-unreadable` | `"source file unreadable: {path} could not be read (permission or I/O error \| symlink cycle \| path contains an invalid character)"` — exactly ONE of the three pipe-delimited categories is substituted per instance, matching the actual failure class |
| Ruling-5 lexical screen, SOURCE (`ir-path-well-formedness` REQ-IPF-01) | `invalid-input` | `"source path invalid: {path} must not contain a '..' segment or be absolute — everything a schematic reads lives inside its package (packageDir)"` |
| Ruling-5 lexical screen, DESTINATION (`ir-path-well-formedness` REQ-IPF-02) | `invalid-input` | `"invalid input: destination \"{path}\" escapes the workspace tree (literal '..' segment or absolute path)"` — the EXISTING `destinationEscapeMessage` function's output, carried verbatim, never re-derived |

`{path}` is always package-relative (never absolute).

#### Scenario REQ-AEC-11.1: Each surviving-reason message follows its exact template, path relative, including both `source-not-regular-file` variants [preservation-pin]

- GIVEN one rejection per surviving `source-*` reason — `source-not-found`,
  `source-not-regular-file` via a DIRECTORY-as-source fixture, `source-not-regular-file`
  via a non-directory-non-regular (FIFO) fixture, and `source-unreadable` — each with a
  known package-relative source path
- WHEN each message is inspected
- THEN each matches its exact template (the directory case naming `scaffold()`
  actionably; the FIFO case using the generic form; `source-unreadable` naming its
  actual failure category — permission/IO, symlink cycle, or invalid character —
  matching the real cause) with the path substituted, and contains no absolute
  filesystem path

#### Scenario REQ-AEC-11.2: Each ruling-5 message is driven from its OWN REQ, source and destination never conflated [preservation-pin]

- GIVEN a rejection from `ir-path-well-formedness` REQ-IPF-01 (a package-local SOURCE
  containing `..` or absolute) in ONE fixture, and a rejection from REQ-IPF-02 (a
  computed DESTINATION containing `..` or absolute) in a SEPARATE fixture — each with a
  known package-relative path
- WHEN each message is inspected
- THEN the REQ-IPF-01 fixture's message matches the SOURCE template row exactly; the
  REQ-IPF-02 fixture's message matches the DESTINATION template row exactly (the
  existing `destinationEscapeMessage` text, verbatim) — the two are NEVER
  interchangeable, and neither message contains an absolute filesystem path

### REQ-AEC-12: Scaffold-Family Failures Reuse the EXISTING `invalid-input` Reason

The following scaffold-family failure modes MUST map to the EXISTING `invalid-input`
reason (`origin: "authoring-rejected"`) — they are author-misuse-of-the-authoring-surface
failures, not source-access families:

| Failure mode | Ruled by | REQ |
|---|---|---|
| `templateFile` binary/oversized fail-loud | [OWNER] | `file-escape-hatches` REQ-FEH-02 |
| Zero files after include/exclude filter | [OWNER] | `folder-scaffold` REQ-FSC-04 |
| `.template` sniff-fail inside a scaffold walk | same family | `content-classification` REQ-CCL-05 |
| Intra-scaffold destination collision | same family | `folder-scaffold` REQ-FSC-08 |
| Walk entry-count bound exceeded | same family | `folder-scaffold` REQ-FSC-09 |
| Walk root missing / non-directory / unreadable (no-echo) | same family | `folder-scaffold` REQ-FSC-10 |
| Ruling-5 lexical `../`/absolute source screen | [OWNER, ruling 5] | `ir-path-well-formedness` REQ-IPF-01 |
| Lexical destination guard | [OWNER, ruling 2] | `ir-path-well-formedness` REQ-IPF-02 |

#### Scenario REQ-AEC-12.1: The owner-ruled scaffold-family modes classify as invalid-input, authoring-rejected [preservation-pin]

- GIVEN one rejection per owner-ruled mode: a binary `templateFile`, a filter set
  eliminating every entry, and a lexically-escaping source path
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly `"invalid-input"` and `origin` is `"authoring-rejected"` for
  all three
- AND the compile-time union pin still counts exactly eleven members — none of these
  modes mints a new reason

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
| public-api (contract) — closed `AuthoringReason` union, MAJOR narrowing | REQ-AEC-10, REQ-AEC-11, REQ-AEC-12 | Yes — closed-union MAJOR narrowing |
| public-api (contract) — `AuthoringVerb`/`DryRunVerb` closed-set membership unchanged, deliberate label pin | REQ-AEC-13 | Yes |
