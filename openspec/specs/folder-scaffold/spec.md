# Folder Scaffold Specification

**Spec version**: V3.5
**Status**: signed (owner, 2026-07-29 — micro-unfreeze V3.4→V3.5, ruling 17, judgment-day round 3)
**Change**: `inline-collection-marker`

V3 → V3.5 (archive-sync, `inline-collection-marker`, 2026-07-29): the Purpose section's cross-reference to the retired containment family is rewritten to name its actual re-homed successors. REQ-FSC-09's symlinked-directory non-descent rationale is rewritten from a containment-ceiling framing to enumeration-determinism/cycle-safety (the RULE — never descend, 10,000-entry cap — is unchanged); a walk ROOT that is itself a symlinked directory now REJECTS instead of being silently skipped or transparently followed (judgment-day round 1, ruling 16 — a real regression the blind judges caught: `walkFolder`'s root branch had no `lstatSync` guard). New REQ-FSC-10 (re-homed from the retired family's own walk-root/recursive-read-failure clause): a missing, non-directory, or otherwise-unreadable walk root — or a recursive read failure mid-walk — rejects `AuthoringError` naming only the package-relative path, never a raw Node error or an absolute path. New REQ-FSC-11 (judgment-day round 3, ruling 17): a degenerate `from` (`""`, `"."`, `"./"`) that resolves to the package directory itself now rejects instead of silently walking the entire package. REQ-IDs stable; REQ-FSC-01 through REQ-FSC-08 unaffected.

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
(including the `.template` sniff-fail fail-loud, REQ-CCL-05), and source hygiene is
`package-source-io-hygiene`'s contract; source/destination lexical well-formedness is
`ir-path-well-formedness`'s contract.

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

The walk MUST NOT descend into ANY NESTED symlinked directory, regardless of where its
target resolves — enumeration determinism and cycle-safety are the rationale (a symlinked
directory could point anywhere, including into a cycle; never descending is the simplest
invariant that is safe under all targets). The walk MUST also enforce a documented upper
bound of 10,000 enumerated entries per `scaffold` call, failing loud (naming the bound)
when exceeded — a loop-safety/DoS resource guard, generous enough that no real
schematic collection approaches it.

> **Ruling 16 (2026-07-29)**: the walk ROOT (`from` itself) is held to a STRICTER standard
> than a nested symlinked directory. A nested symlink is silently skipped (no author
> intent points at it directly); the root is what the author EXPLICITLY named as `from` —
> silently skipping it would make `scaffold` a no-op indistinguishable from a genuinely
> empty folder (REQ-FSC-04.1), and transparently following it (the walk's prior,
> unimplemented behaviour) reads content the author never lexically named at all. A
> symlinked root therefore REJECTS with `AuthoringError` (reason `invalid-input`,
> package-relative locator, no absolute-path echo) — see REQ-FSC-09.3.

#### Scenario REQ-FSC-09.1: A symlinked directory is skipped, not an error [preservation-pin]

- GIVEN `from` containing a regular `a.ts` and a symlinked directory containing `b.ts`
- WHEN scaffolded
- THEN only `a.ts` is emitted; `b.ts` is absent; no error is raised for the skip — this
  holds regardless of where the symlink's target resolves

#### Scenario REQ-FSC-09.2: Entry-count bound exceeded fails loud [preservation-pin]

- GIVEN a `from` tree whose enumerated entry count exceeds the documented 10,000 bound
  (fixture MAY drive the bound via an injected/test-scoped limit if materializing 10,001
  files is CI-hostile — the assertion targets the bound branch)
- WHEN scaffolded
- THEN it rejects fail-loud, naming the bound

#### Scenario REQ-FSC-09.3: A symlinked walk ROOT rejects, never followed or silently skipped (ruling 16, 2026-07-29) [preservation-pin]

- GIVEN `from` itself is a symlinked directory (whether its target resolves inside or
  outside the package)
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never the absolute filesystem path, never a silent skip, and
  never a transparently-followed read of the target's content

### REQ-FSC-10: Walk ROOT and Recursive Read Failures Reject `AuthoringError`, Package-Relative Path Only

A `scaffold` walk ROOT (`from`) that is legitimately ABSENT, resolves to a regular FILE
rather than a directory, or is otherwise UNREADABLE for a reason other than
missing/non-directory (e.g. a permission error), MUST reject `AuthoringError` (reason
`invalid-input`) naming ONLY the package-relative `from` path — never a raw Node `Error`
that echoes the absolute filesystem path. The SAME mapping applies to a RECURSIVE read
failure encountered mid-walk (a subdirectory whose `readdirSync` raises EACCES, or an
entry that vanishes between `readdir` and `lstat`) — `walk.ts` reuses its existing
`rootReadFailure` treatment for this case rather than introducing a parallel one, so a
nested read failure is no-echo and package-relative exactly like a root failure.

#### Scenario REQ-FSC-10.1: Missing walk root rejects AuthoringError, package-relative path only [preservation-pin]

- GIVEN a `from` that does not exist on disk
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw ENOENT `Error`, never the absolute filesystem
  path

#### Scenario REQ-FSC-10.2: Walk root that resolves to a regular file rejects AuthoringError, package-relative path only [preservation-pin]

- GIVEN a `from` that resolves to a regular FILE, not a directory
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw ENOTDIR `Error`, never the absolute filesystem
  path

#### Scenario REQ-FSC-10.3: Walk root unreadable for a non-ENOENT/ENOTDIR reason rejects AuthoringError, package-relative path only [preservation-pin]

- GIVEN a `from` that exists and is a directory but cannot be read for another reason
  (e.g. an injected EACCES permission-denied seam)
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw `EACCES` `Error`, never the absolute filesystem
  path

#### Scenario REQ-FSC-10.4: Recursive walk read failure below the root rejects AuthoringError, package-relative path only [preservation-pin]

- GIVEN a walk subtree containing a subdirectory that raises `EACCES` on `readdirSync`
  during recursive enumeration — and, as a second case, an entry that is deleted between
  `readdir` and `lstat` (a TOCTOU race surfacing an ENOENT mid-walk)
- WHEN `scaffold` walks the tree
- THEN each failure surfaces as `AuthoringError` (reason `invalid-input`) naming ONLY the
  package-relative path of the offending subdirectory/entry — never a raw Node error,
  never an absolute filesystem path — reusing the SAME `rootReadFailure` mapping the walk
  ROOT already uses, not a second, parallel implementation

### REQ-FSC-11: Degenerate `from` Rejects — the Package Root Is Never an Implicit Walk Target

A `from` that resolves to `packageDir` itself — the literal forms `""`, `"."`, or `"./"` —
MUST reject `AuthoringError` (reason `invalid-input`) naming the literal `from` value,
rather than walking the entire package. None of these three forms contain a `..` segment
or an absolute path, so `ir-path-well-formedness` REQ-IPF-01's lexical screen does not
catch them; this is a DISTINCT, `scaffold`-specific check, same posture as the
walk-ROOT symlink rejection (REQ-FSC-09.3) — an author who legitimately wants a
whole-package mirror must still name a real subfolder, never rely on an implicit
degenerate form.

#### Scenario REQ-FSC-11.1: A degenerate `from` rejects instead of enumerating the whole package [preservation-pin]

- GIVEN `from` is `""`, `"."`, or `"./"` — each resolving to `packageDir` itself
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming the literal `from`
  value — never a silent walk of the entire package

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation) | REQ-FSC-04, REQ-FSC-08, REQ-FSC-09, REQ-FSC-10, REQ-FSC-11 | Yes — label drops "containment": this family's guards are loop-safety, collision-safety, and no-echo hygiene, never a containment boundary |
| public-api (contract) | REQ-FSC-01, REQ-FSC-06, REQ-FSC-07 | Yes |
