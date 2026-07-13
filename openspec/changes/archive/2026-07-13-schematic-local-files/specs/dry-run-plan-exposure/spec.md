# Delta for Dry-Run Plan Exposure

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3 (owner micro-unfreeze, 2026-07-12): [OWNER] ruling on the `DryRunEntry` tag
strings — the author-facing values are `"rendered" | "copied"`, NOT
`"by-value"/"by-reference"` (transport jargon stays in ADR/spec prose, never on the
author surface). REQ-DRE-05 type and all scenario strings updated. REQ-IDs stable.

V1 → V2 (blind council fixes applied): scenario DRE-05.3 (create({templateFile}) →
by-value tag, S19); REQ-DRE-06 gains the doc-note that scaffold-classified binaries
surface under verb `copyIn`. All V1 REQ-IDs preserved.

## ADDED Requirements

### REQ-DRE-05: Per-Entry Rendered/Copied Classification Tag

`DryRunEntry` MUST carry a `kind: "rendered" | "copied"` tag (additive field —
existing `{verb, path}` shape unchanged) reflecting `content-classification`'s decision
for that entry (obs #915 ruling 14/18 — the honesty mechanism). The author-facing
strings are `"rendered"` (the by-value/rendered path) and `"copied"` (the
by-reference/verbatim path) — [OWNER] ruling 2026-07-12: "by-value"/"by-reference"
stay transport jargon in ADR/spec prose, NEVER on the author surface. `scaffold`'s
emitted entries carry whichever tag their per-file classification produced;
`create({templateFile})` entries are ALWAYS `"rendered"` (a render request that either
renders or fails loud — `file-escape-hatches` REQ-FEH-02 — never silently copied);
`copyIn` entries are ALWAYS `"copied"` (`file-escape-hatches` REQ-FEH-03).

#### Scenario REQ-DRE-05.1: A scaffold call with mixed content shows both tags [SDK]

- GIVEN a `scaffold` call over a folder with one small text file and one binary file
- WHEN `dryRun()` is called
- THEN the entries show `kind: "rendered"` for the text file and
  `kind: "copied"` for the binary file

#### Scenario REQ-DRE-05.2: copyIn entry is always tagged copied [SDK]

- GIVEN a `copyIn` call on a plain text file
- WHEN `dryRun()` is called
- THEN the entry's `kind` is `"copied"` — never `"rendered"`, regardless of the
  source's own text-vs-binary shape

#### Scenario REQ-DRE-05.3: create({templateFile}) entry is tagged rendered [SDK]

- GIVEN a `create("dest.ts", { templateFile: "tpl.ts.template", options: {} })` call
  on a valid, under-budget text template
- WHEN `dryRun()` is called
- THEN the entry's `kind` is `"rendered"` — the templateFile render request surfaces
  as a rendered entry, indistinguishable in kind from an inline-template `create`

### REQ-DRE-06: Author-Verb Rendering Is Wire-Encoding Agnostic for By-Reference Entries

Regardless of which wire encoding `sdd-design` ratifies for the by-reference directive
(a new op, or a `copy` source discriminator — `by-reference-copy-wire` REQ-BRC-01),
`dryRun()` MUST render it under author verb `"copyIn"`. The frozen
`WIRE_TO_AUTHOR_VERB` totality map (`dry-run/plan.ts`) MUST be extended to cover
whichever encoding wins, preserving the existing 1-wire-shape↔1-author-verb rendering
guarantee for every OTHER entry.

**Doc note**: the `dryRun()` JSDoc/docs MUST state that a binary file classified
by-reference INSIDE a `scaffold` call also surfaces under verb `"copyIn"` — even
though the author never called `copyIn` — so an author reading the plan is not
surprised by entries under a verb they did not invoke.

#### Scenario REQ-DRE-06.1: By-reference directive renders as author verb "copyIn" [SDK]

- GIVEN a by-reference directive present in the buffered snapshot (via `copyIn` or a
  by-reference `scaffold` entry)
- WHEN `dryRun()` renders it
- THEN its `verb` field is exactly `"copyIn"`
