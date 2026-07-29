# Delta for Authoring Error Contract

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write; plan-verify-3 finding A5): one-line scope note recorded where the
REQ-AEC-11 template upgrades live — **the `source-unreadable` category passthrough and
the `source-not-regular-file` directory-actionable variant (both introduced at V3) are
pre-authorized by owner ruling 6 as an author-experience improvement, deliberately
BEYOND minimal containment reconciliation** — the judge finding that flagged this scope
question is recorded here as ACCEPTED, not silently absorbed.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.
(REQ-MFB-02's CHANGELOG entry (b), which restates this REQ family's union-shrink
verbatim, is unaffected — it cites the union shrink, not this file's own text.)

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
design council found V2's REQ-AEC-11 row 4 contradictory — it bound BOTH the ruling-5
SOURCE screen (REQ-IPF-01) and the destination guard (REQ-IPF-02) to one "source path
invalid" message shape, but design re-homes the destination message VERBATIM from the
existing `destinationEscapeMessage` function, a DIFFERENT shape. Split into two rows,
same reason (`invalid-input`), each naming its own role and REQ. REQ-AEC-11.2 now drives
each template from its own REQ instead of a conflated "source or destination" GIVEN.
Also (pre-authorized, minor): `source-unreadable`'s template passes its failure category
through instead of a single flat phrase; `source-not-regular-file` gains an actionable,
directory-specific variant (pointing the author at `scaffold()`) while the generic
non-directory-non-regular form is unchanged. No reason changes, no scenario semantics
change beyond .2's split.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): REQ-AEC-11 gains a
fourth message-template row for the ruling-5 lexical-screen rejection (reason
`invalid-input`, a new message shape distinct from the three `source-*` rows it
otherwise governs — the shared property is "package-relative, no-echo," not the reason
value).

**Provenance note**: `openspec/specs/authoring-error-contract/spec.md` (the main family
file) currently shows only the most recent `author-write-surface` delta (REQ-AEC-13) —
REQ-AEC-10/11/12 are not visible there, an apparent archive-sync gap unrelated to this
change (their full text was recovered from the archived `schematic-local-files` change's
delta, `openspec/changes/archive/2026-07-13-schematic-local-files/specs/authoring-error-contract/spec.md`).
This MODIFIED block is written against that recovered text. **Disposition (ratified in
V2, per blind-council item 18)**: this drift is OWNED by `inline-collection-marker` and
MUST be resolved BEFORE archive — restore REQ-AEC-10/11/12 into
`openspec/specs/authoring-error-contract/spec.md` from the archived `schematic-local-files`
delta (provenance verified: `rg` confirms only that one archived change ever wrote these
REQs), THEN apply this change's MODIFIED blocks on top. This is a pre-archive step, not a
mid-spec blocker; it stands even now that this delta is signed.

## MODIFIED Requirements

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
`source-outside-package` arm under the `authoring-rejected` case; the compile-time
exhaustiveness pin test MUST be re-narrowed to the eleven-member union. The `.d.ts`
fitness baseline (FIT-04) MUST be updated in the SAME commit as this union shrink — a
FIT-04 mismatch (baseline still showing twelve members) is itself a hard failure of this
REQ, never a follow-up.

(Previously: TWELVE values, additionally including `"source-outside-package"` — source
resolves outside the containment ceiling, fired before any existence probe. That value
is RETIRED: `package-root-containment`, the family that defined "outside the ceiling," is
retired wholesale — there is no ceiling for a source to be "outside" of. Union: 12 → 11,
a MAJOR (breaking) narrowing consumers must handle in their exhaustive `switch(reason)`
blocks.)

#### Scenario REQ-AEC-10.1: Each of the three surviving reasons classifies exactly and maps to authoring-rejected [preservation-pin]

- GIVEN one fixture per surviving reason: missing source, directory-as-source, and an
  unreadable source exercised via the fake/conformance simulation or an injected
  read-failure (EACCES) seam — never a chmod-based CI fixture
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly the corresponding value and `origin` is
  `"authoring-rejected"` for all three

#### Scenario REQ-AEC-10.2: `originFor` exhaustiveness pin re-narrows to 11 members, FIT-04 updated same commit [red-today]

- GIVEN the compile-time exhaustiveness test (`test/types/authoring-reason.test.ts`) and
  the FIT-04 `.d.ts` baseline
- WHEN the `reason` union shrinks to eleven members (dropping `source-outside-package`)
- THEN `originFor`'s switch statement compiles only when all eleven arms are handled —
  a stale twelfth arm fails the build — AND the FIT-04 baseline is updated to eleven
  members in the SAME commit, never a follow-up

### REQ-AEC-11: Message Template Rows for the 3 Surviving Reasons and the Ruling-5 Screen (Source and Destination, Split)

REQ-AEC-06/09's message-template table carries FIVE rows — three for the surviving
`source-*` reasons (one, `source-not-regular-file`, with two variant forms), one for the
ruling-5 SOURCE screen (REQ-IPF-01), and one for the destination guard (REQ-IPF-02) —
all package-relative and no-echo (never the raw source content, never an absolute path,
never a raw OS errno string beyond a described category):

| Family | Reason | Template |
|---|---|---|
| Source missing | `source-not-found` | `"source file not found: {path} does not exist in the package"` |
| Source not a regular file — directory | `source-not-regular-file` | `"source file invalid: {path} is a directory, not a regular file — use scaffold() to copy a folder"` |
| Source not a regular file — other (FIFO/socket/device) | `source-not-regular-file` | `"source file invalid: {path} is not a regular file"` |
| Source unreadable | `source-unreadable` | `"source file unreadable: {path} could not be read (permission or I/O error \| symlink cycle \| path contains an invalid character)"` — exactly ONE of the three pipe-delimited categories is substituted per instance, matching the actual failure class |
| Ruling-5 lexical screen, SOURCE (`ir-path-well-formedness` REQ-IPF-01) | `invalid-input` | `"source path invalid: {path} must not contain a '..' segment or be absolute — everything a schematic reads lives inside its package (packageDir)"` |
| Ruling-5 lexical screen, DESTINATION (`ir-path-well-formedness` REQ-IPF-02) | `invalid-input` | `"invalid input: destination \"{path}\" escapes the workspace tree (literal '..' segment or absolute path)"` — the EXISTING `destinationEscapeMessage` function's output, carried verbatim, never re-derived |

`{path}` is always package-relative (never absolute).

(Previously: a fourth row existed for `source-outside-package`
(`"source file outside package: {path} resolves outside the package boundary"`). That
row is DELETED along with the reason it templated — retired, no successor. The
no-existence-oracle clause this row's neighbour paragraph referenced
(`package-root-containment` REQ-PRC-07) is likewise dropped: there is no longer an
in-ceiling/out-of-ceiling distinction for `source-not-found` to be exclusive to. V2
added a NEW fourth row for the ruling-5 screen's `invalid-input` message, binding it to
BOTH REQ-IPF-01 (source) and REQ-IPF-02 (destination) with a single template — this was
itself CONTRADICTORY (design re-homes the destination message verbatim from
`destinationEscapeMessage`, a different shape than the source screen's message) and is
SPLIT in V3 into two independent rows, one per REQ. `source-not-regular-file` also
gains an actionable directory-specific variant at V3 — the underlying REASON is
unchanged, only the message text for that one failure shape.)

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

#### Scenario REQ-AEC-11.2: Each ruling-5 message is driven from its OWN REQ, source and destination never conflated [red-today]

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

(Previously: this table's "Missing `collection.json` ancestor" row mapped
`package-root-containment` REQ-PRC-03 to `invalid-input`. That failure mode is DELETED —
`package-dir-run-anchor` REQ-MFB-01 removes the ancestor walk entirely, so there is no
longer a "missing ancestor" failure to map. The row is dropped, not replaced. Two rows
are ADDED for the new `ir-path-well-formedness` failure modes, which reuse the SAME
`invalid-input` reason by the same owner ruling. The union arithmetic note below updates
from "twelve" to "eleven.")

#### Scenario REQ-AEC-12.1: The owner-ruled scaffold-family modes classify as invalid-input, authoring-rejected [red-today]

- GIVEN one rejection per owner-ruled mode: a binary `templateFile`, a filter set
  eliminating every entry, and a lexically-escaping source path
- WHEN each is translated to an `AuthoringError`
- THEN `reason` is exactly `"invalid-input"` and `origin` is `"authoring-rejected"` for
  all three
- AND the compile-time union pin still counts exactly eleven members — none of these
  modes mints a new reason

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api (contract) | REQ-AEC-10, REQ-AEC-11, REQ-AEC-12 | Yes — closed-union MAJOR narrowing |
