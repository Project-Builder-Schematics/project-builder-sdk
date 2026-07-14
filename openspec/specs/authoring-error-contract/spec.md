# Delta for authoring-error-contract

**Spec version**: V3
**Status**: signed (owner, 2026-07-14 — V4 scope-reduction per foresight obs #2128)
**Change**: `author-write-surface`

(V3: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` calling convention is DEFERRED (`typescript-dialect` REQ-TSD-12
tombstoned). REQ-AEC-13's SUBSTANCE is UNCHANGED — the label `"modify"` is still kept regardless
of author call form; the only edit below is factual: the parenthetical enumerating call forms
drops "importable" since it no longer exists in this change's shipped surface.)

## ADDED Requirements

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
| public-api (contract) — `AuthoringVerb`/`DryRunVerb` closed-set membership unchanged, deliberate label pin | REQ-AEC-13 | Yes |
