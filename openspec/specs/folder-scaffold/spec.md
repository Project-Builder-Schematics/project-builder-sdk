# Folder Scaffold Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3: no V3 deltas targeted this domain — content unchanged; version/status bump
only.

V1 → V2 (blind council fixes applied): REQ-FSC-07 (returns void, ruling 13), REQ-FSC-08
(intra-scaffold destination collision), REQ-FSC-09 (walk enumeration bounds + in-ceiling
symlinked dirs); scenarios FSC-01.3 (missing `to` mirror), FSC-06.2 (scaffold-level
collision w/wo force); REQ-FSC-04 gains the tarball-packaging doc note and the
`invalid-input` reason mapping (REQ-AEC-12). All V1 REQ-IDs preserved.

## Purpose

Gives schematic authors a declarative way to walk a package-local folder and mirror it
into the target tree — the `scaffold` verb. It owns folder-walk mechanics (mirrored
structure, filename pipeline, include/exclude filtering, force pass-through); the
by-value/by-reference decision per file is `content-classification`'s contract
(including the `.template` sniff-fail fail-loud, REQ-CCL-05), and source/destination
safety is `package-root-containment`'s contract.

## Requirements

### REQ-FSC-01: Mandatory/Optional Argument Shape

`scaffold` MUST accept exactly `{from, to, options, include, exclude, rename, force}`
(ruling 7/8, obs #915). `from` and `to` are MANDATORY; `options` defaults `{}`,
`include` defaults "match everything", `exclude` defaults "match nothing" (exclude
wins on overlap), `rename` defaults "no remap", `force` defaults `false`. A call
missing `from` or `to` MUST reject fail-loud before any file is walked.

#### Scenario REQ-FSC-01.1: Missing mandatory `from` rejects [SDK]

- GIVEN `scaffold({ to: "src/" })` (no `from`)
- WHEN called
- THEN it rejects fail-loud before any directory read occurs

#### Scenario REQ-FSC-01.2: Optional args default correctly [SDK]

- GIVEN `scaffold({ from: "./files", to: "src/" })` (no other keys) over a folder with
  two files
- WHEN called
- THEN both files scaffold with no filtering, no rename, `force: false`

#### Scenario REQ-FSC-01.3: Missing mandatory `to` rejects [SDK]

- GIVEN `scaffold({ from: "./files" })` (no `to`)
- WHEN called
- THEN it rejects fail-loud before any directory read occurs

### REQ-FSC-02: Mirrored Structure Under `to`

Every source-relative path under `from` MUST map 1:1 to the same relative path under
`to`, unless remapped by `rename` (REQ-FSC-05). `to` itself MAY carry filename tokens
(REQ-FSC-05), applied identically to every mirrored entry's destination prefix.

#### Scenario REQ-FSC-02.1: Nested folder structure mirrors exactly [SDK]

- GIVEN `from` containing `a.ts` and `nested/b.ts`, `scaffold({ from, to: "out/" })`
- WHEN called
- THEN entries target `out/a.ts` and `out/nested/b.ts`

### REQ-FSC-03: Include/Exclude Match Syntax

`include`/`exclude` MUST accept glob-style patterns (`*` = any run of characters
within a segment, `**` = any run of segments) matched against the source-relative
path. `exclude` WINS on overlap with `include`. MVP semantics — this is a
documented, deterministic dialect, not TBD.

| Pattern | Matches | Does not match |
|---|---|---|
| `*.txt` | `a.txt` | `nested/a.txt` |
| `**/*.txt` | `a.txt`, `nested/a.txt` | `a.ts` |
| `nested/**` | `nested/a.txt`, `nested/b/c.ts` | `a.txt` |

#### Scenario REQ-FSC-03.1: Exclude wins over include on overlap [SDK]

- GIVEN `from` with `a.txt`, `b.txt`; `include: ["*.txt"]`, `exclude: ["a.txt"]`
- WHEN scaffolded
- THEN only `b.txt` is emitted

#### Scenario REQ-FSC-03.2: Negative example — pattern does not cross segment boundary [SDK]

- GIVEN `from` with `nested/a.txt`; `include: ["*.txt"]` (no `**`)
- WHEN scaffolded
- THEN `nested/a.txt` is NOT emitted (zero files after filter — REQ-FSC-04)

### REQ-FSC-04: Zero-Files-After-Filter vs Empty-Source-Folder

A `from` folder with zero entries on disk MUST scaffold as a silent no-op (nothing to
walk). A `from` folder with one or more entries where `include`/`exclude` leave ZERO
surviving entries MUST fail loud with reason `invalid-input` (owner mapping,
REQ-AEC-12), naming the `include`/`exclude` patterns that eliminated everything —
these are two distinct outcomes and MUST NOT collapse to the same behaviour.

**Doc note (packaging caveat)**: the empty-folder no-op depends on the folder existing
on disk at run time; npm tarball packaging commonly DROPS empty directories. The
`scaffold` docs MUST carry this caveat so authors never rely on an empty folder
surviving publish.

#### Scenario REQ-FSC-04.1: Truly empty source folder no-ops [SDK]

- GIVEN `from` is an existing folder with zero entries
- WHEN scaffolded
- THEN it completes with zero directives emitted, no error

#### Scenario REQ-FSC-04.2: Filters eliminate every entry — fail-loud naming the filters [SDK]

- GIVEN `from` with `a.ts`, `b.ts`; `exclude: ["*.ts"]`
- WHEN scaffolded
- THEN it rejects fail-loud with reason `invalid-input`, the error naming
  `exclude: ["*.ts"]` as the cause

### REQ-FSC-05: Filename Pipeline — Pinned Order (rename → token translation → `.template` strip)

For each source-relative path, exactly ONE pipeline order applies, in this sequence:
(1) `rename` — if a rule matches the ORIGINAL source-relative path, remap it to the
rule's destination-relative path; (2) filename token translation — `__x__` segments
in the (possibly renamed) path translate to `{= x =}` in the wire `pathTemplate`
(`__name@dasherize__` → `{= name | dasherize =}`); (3) `.template` suffix strip —
if the path (post-translation) ends in `.template`, strip it from the destination
filename. This order is PINNED — rename matches original names (so authors don't
have to predict token-translated names), tokens translate next, and the marker
strips last since it must survive translation to be recognized.

#### Scenario REQ-FSC-05.1: Compound — rename + token translation + `.template` strip on one filename [SDK]

- GIVEN a source file `__name@dasherize__.service.ts.template` and
  `rename: { "__name@dasherize__.service.ts.template": "__name@dasherize__.svc.ts.template" }`
- WHEN scaffolded with `options: { name: "MyThing" }`
- THEN the emitted destination `pathTemplate` is `{= name | dasherize =}.svc.ts` —
  renamed first (`.service.` → `.svc.`), then token-translated
  (`__name@dasherize__` → `{= name | dasherize =}`), then `.template` stripped last

### REQ-FSC-06: `force` Pass-Through

`scaffold`'s `force` (default `false`) MUST pass through unchanged to every directive
it emits for that call — no per-file override (per-file `options` is out of scope,
obs #915 ruling 14).

#### Scenario REQ-FSC-06.1: `force: true` passes to every emitted directive [SDK]

- GIVEN `scaffold({ from, to, force: true })` over a folder of 3 files
- WHEN called
- THEN every emitted directive carries `force: true`

#### Scenario REQ-FSC-06.2: Scaffold-level collision — mixed by-value/by-reference, with and without force [SDK]

- GIVEN a `scaffold` over a folder with one text file and one binary file, where the
  binary's destination path already exists in the tree, called without `force`
- WHEN emitted
- THEN the run rejects fail-closed (collision)
- AND the same scaffold with `force: true` succeeds — both the by-value and the
  by-reference entries are overwrite-eligible under the single scaffold-level flag

### REQ-FSC-07: `scaffold` Returns `void`

`scaffold` MUST return `void` (obs #915 ruling 13) — fire-and-forget, no chainable
handle group. The emitted `.d.ts` declares the return type as exactly `void`.

#### Scenario REQ-FSC-07.1: Return type is exactly void [SDK]

- GIVEN `scaffold`'s exported declaration in the regenerated `.d.ts` baseline and an
  `expectTypeOf`-style type test
- WHEN inspected
- THEN the return type is exactly `void` — no handle, promise-of-handle, or entry
  list is returned

### REQ-FSC-08: Intra-Scaffold Destination Collision — Fail-Loud, Deterministic, Names Both Sources

When TWO OR MORE sources in the same `scaffold` call map to the SAME destination path
after the REQ-FSC-05 pipeline (rename and/or `.template` strip collapsing names), the
call MUST fail loud deterministically, naming BOTH (all) offending source paths —
never last-writer-wins, never dependent on walk order.

#### Scenario REQ-FSC-08.1: Two sources collapsing to one destination reject, naming both [SDK]

- GIVEN `from` containing `a.ts` AND `a.ts.template` (both map to destination `a.ts`
  after the `.template` strip)
- WHEN scaffolded
- THEN it rejects fail-loud, the error naming BOTH `a.ts` and `a.ts.template` as the
  colliding sources

### REQ-FSC-09: Walk Enumeration — Symlinked Directories Never Traversed; Entry-Count Bound

The walk MUST NOT descend into ANY symlinked directory — including one whose target
resolves INSIDE the containment ceiling (uniform with `package-root-containment`
REQ-PRC-04's no-descent rule; the docs MUST state symlinked directories are never
traversed). The walk MUST also enforce a documented upper bound of 10,000 enumerated
entries per `scaffold` call, failing loud (naming the bound) when exceeded — a
resource guard, generous enough that no real schematic collection approaches it.

#### Scenario REQ-FSC-09.1: In-ceiling symlinked directory is skipped, not an error [SDK]

- GIVEN `from` containing a regular `a.ts` and a symlinked directory (target inside
  the containment ceiling) containing `b.ts`
- WHEN scaffolded
- THEN only `a.ts` is emitted; `b.ts` is absent; no error is raised for the skip

#### Scenario REQ-FSC-09.2: Entry-count bound exceeded fails loud [SDK]

- GIVEN a `from` tree whose enumerated entry count exceeds the documented 10,000
  bound (fixture MAY drive the bound via an injected/test-scoped limit if
  materializing 10,001 files is CI-hostile — the assertion targets the bound branch)
- WHEN scaffolded
- THEN it rejects fail-loud, naming the bound

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation / containment) | REQ-FSC-04, REQ-FSC-08, REQ-FSC-09 | Yes |
| public-api (contract) | REQ-FSC-01, REQ-FSC-06, REQ-FSC-07 | Yes |
