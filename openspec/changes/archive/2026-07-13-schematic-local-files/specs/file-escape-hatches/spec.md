# File Escape Hatches Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3 (owner micro-unfreeze, 2026-07-12): scenario REQ-FEH-04.3 added — `copyIn`
returns `void`, mirroring `folder-scaffold` REQ-FSC-07. REQ-IDs stable.

V1 → V2 (blind council fixes applied): dangling REQ-CCL-05 reference in REQ-FEH-03
corrected to REQ-CCL-04 (note: V2 now ALSO adds a real REQ-CCL-05 — the `.template`
scaffold sniff-fail — which is a different concern); REQ-FEH-02 names its owner-ruled
reason `invalid-input` (REQ-AEC-12); scenario FEH-04.2 (missing `from` mirror). All V1
REQ-IDs preserved.

## Purpose

Gives authors two per-file primitives beneath `scaffold`: `create({templateFile})` (an
explicit RENDER request for one package-local file) and `copyIn(from, to, {force})` (an
explicit NEVER-RENDER copy of one package-local file). Both are escape hatches —
`scaffold` is the common case, these handle the single-file exception and the
"don't render this" override.

## Requirements

### REQ-FEH-01: `create({templateFile})` — Mandatory Arg and By-Value Render Request

`create` MUST accept a `templateFile` form: a package-local path read at emission time,
whose content becomes the `create` directive's `template` (existing `create` IR, zero
wire change). `templateFile` is MANDATORY when this form is used — it explicitly
REQUESTS rendering (obs #915 ruling 17), so it is never silently treated as
by-reference.

#### Scenario REQ-FEH-01.1: templateFile content becomes the create directive's template [SDK]

- GIVEN a package-local file `tpl.ts.template` containing `export const x = {= x =};`
- WHEN `create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } })` is called
- THEN the emitted `create` directive's `template` field is the file's exact content

### REQ-FEH-02: `create({templateFile})` Binary/Oversized → Fail-Loud

A `templateFile` that fails the by-value sniff (`content-classification` REQ-CCL-01) —
not valid UTF-8, contains a null byte, or does not fit the frame budget — MUST reject
fail-loud with reason `invalid-input` (owner mapping, REQ-AEC-12). Because
`templateFile` REQUESTS a render, there is no silent by-reference fallback (obs #915
ruling 17) — this is a distinct failure mode from `scaffold`'s by-value/by-reference
classification of unmarked files, which never fails on this basis alone.

#### Scenario REQ-FEH-02.1: Binary templateFile fails loud, never silently copies [SDK]

- GIVEN a package-local file containing a null byte
- WHEN `create("dest.png", { templateFile: "asset.png" })` is called
- THEN it rejects fail-loud with reason `invalid-input` — no directive is emitted,
  and the rejection never silently falls back to a by-reference copy

#### Scenario REQ-FEH-02.2: Oversized templateFile fails loud [SDK]

- GIVEN a package-local text file whose content does not fit the serialized frame
  budget (`content-classification` REQ-CCL-02)
- WHEN `create("dest.ts", { templateFile: "huge.ts.template" })` is called
- THEN it rejects fail-loud with reason `invalid-input`

### REQ-FEH-03: `copyIn` — Always By-Reference, No Classification

`copyIn(from, to, { force })` MUST ALWAYS emit a by-reference copy — it never
classifies, never renders, regardless of the source content's text-vs-binary shape
(obs #915 ruling 16: "copy verbatim, never render"). This is the author's explicit
no-render escape for a text asset that would otherwise be classified by-value by
`scaffold`'s sniff (e.g. a text asset containing `{= =}`-like sequences that must
travel verbatim — see `content-classification` REQ-CCL-04).

#### Scenario REQ-FEH-03.1: copyIn on a text file still copies verbatim, unrendered [SDK]

- GIVEN a package-local text file containing `{= this looks like a token =}`
- WHEN `copyIn("literal.txt", "dest/literal.txt")` is called
- THEN the emitted directive is by-reference (never a `create` with rendered
  `template`) — the file travels as-is, no classification performed

### REQ-FEH-04: `copyIn` Signature — Mandatory Args, Rejection, `void` Return

`from` and `to` are MANDATORY on `copyIn`; `force` defaults `false`. A call missing
`from` or `to` MUST reject fail-loud before any emission. `copyIn` MUST return `void`
(mirroring `folder-scaffold` REQ-FSC-07's fire-and-forget posture) — the emitted
`.d.ts` declares the return type as exactly `void`.

#### Scenario REQ-FEH-04.1: Missing `to` rejects [SDK]

- GIVEN `copyIn("asset.svg")` (no `to`)
- WHEN called
- THEN it rejects fail-loud, no directive emitted

#### Scenario REQ-FEH-04.2: Missing `from` rejects [SDK]

- GIVEN `copyIn(undefined, "dest/asset.svg")` (no `from`)
- WHEN called
- THEN it rejects fail-loud, no directive emitted

#### Scenario REQ-FEH-04.3: Return type is exactly void [SDK]

- GIVEN `copyIn`'s exported declaration in the regenerated `.d.ts` baseline and an
  `expectTypeOf`-style type test
- WHEN inspected
- THEN the return type is exactly `void` — mirroring REQ-FSC-07.1's pin for
  `scaffold`

### REQ-FEH-05: Collision With/Without `force` — Both Escape Hatches

`create({templateFile})` onto an existing target without `force` MUST reject with the
existing `path-collision` reason (unchanged `create` semantics); with `force: true` it
overwrites. `copyIn` onto an existing target without `force` MUST reject with the
by-reference wire op's collision reason (`by-reference-copy-wire` REQ-BRC-05); with
`force: true` it overwrites.

#### Scenario REQ-FEH-05.1: create({templateFile}) collision without force rejects; with force overwrites [SDK]

- GIVEN a target path that already exists in the tree
- WHEN `create(path, { templateFile })` is called without `force`, then again with
  `force: true`
- THEN the first call rejects `path-collision`; the second overwrites

#### Scenario REQ-FEH-05.2: copyIn collision without force rejects; with force overwrites [SDK]

- GIVEN a target path that already exists in the tree
- WHEN `copyIn(from, to)` is called without `force`, then again with `force: true`
- THEN the first call rejects (by-reference collision reason); the second overwrites

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation) | REQ-FEH-02, REQ-FEH-04 | Yes |
| public-api (contract) | REQ-FEH-01, REQ-FEH-03 | Yes |
