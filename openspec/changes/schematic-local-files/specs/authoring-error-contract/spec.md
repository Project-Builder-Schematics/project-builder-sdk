# Delta for Authoring Error Contract

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3 (owner micro-unfreeze, 2026-07-12): REQ-AEC-11 templates reworded — the
`"copy failed:"` prefix dropped (tech-writer blocking: it misattributed
scaffold/`create({templateFile})` failures and collided with the real `copy` author
verb); neutral `"source file …"` templates substituted, package-relative/no-echo/
no-differentiation properties intact. REQ-IDs stable.

V1 → V2 (blind council fixes applied): REQ-AEC-12 added ([OWNER] — templateFile
fail-loud / zero-files-after-filter / missing-collection.json-ancestor map to the
EXISTING `invalid-input` reason; union arithmetic stays exactly twelve); REQ-AEC-10/11
gain the no-existence-oracle clause (B5 — `source-not-found` reachable only in-ceiling)
and the injected-seam fixture note for `source-unreadable` (S18). All V1 REQ-IDs
preserved.

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

(Previously V2: each template opened with a `"copy failed:"` prefix — dropped at V3
because these reasons also fire for `scaffold` and `create({templateFile})`, not only
the copy-family verbs, and the prefix collided with the real `copy` author verb.)

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
