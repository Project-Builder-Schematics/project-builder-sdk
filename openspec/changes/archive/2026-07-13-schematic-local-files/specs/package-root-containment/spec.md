# Package Root Containment Specification

**Spec version**: V5
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized); V3→V4 is a POST-SIGNING FINAL-VERIFY REMEDIATION ADDITION (2026-07-13, owner-ratified fix-now); V4→V5 is a judgment-day iteration 2 owner-ratified fix-now amendment (2026-07-13), pending owner-signed micro-amend at archive

**Change**: `schematic-local-files`

V4 → V5 (judgment-day iteration 2 fix, owner-ratified 2026-07-13, PENDING owner
sign-off at archive): REQ-PRC-10.3 amended — a blind adversarial judge found the
walk ROOT's missing/non-directory case reached `walkFolder`'s raw `readdirSync`
unguarded, throwing a plain Node `Error` (ENOENT/ENOTDIR) instead of an
`AuthoringError` — breaking the no-echo guarantee every other scaffold-family
rejection holds (the raw error's message echoes the ABSOLUTE filesystem path) and
the `AuthoringError` contract itself (`copyin-parity` asserts `instanceof
AuthoringError` for every SDK-side rejection). Scenario REQ-PRC-10.3 now requires
BOTH a missing `from` and a `from` that resolves to a regular file to reject
`AuthoringError` (reason `invalid-input`) naming only the package-relative path.
REQ-ID stable (10.3 amended in place, scenario added); no other REQ-PRC-10
scenario changes.

V3 → V4 (final-verify remediation, owner-ratified 2026-07-13, PENDING owner sign-off
at archive): REQ-PRC-10 added — `scaffold`'s walk ROOT (`from`) must be
containment-checked BEFORE `walkFolder` enumerates it; the blind Council's final-verify
pass found `runScaffold` walked an unvalidated root, letting an escaping/symlinked
`from` enumerate (readdir/lstat, bounded by the 10k-entry cap) an out-of-ceiling
subtree before any per-entry check could fire. REQ-IDs stable; additive only.

V2 → V3 (owner micro-unfreeze, 2026-07-12): scenario REQ-PRC-07.2 added — a symlink
lexically inside the ceiling whose out-of-ceiling target does NOT exist still rejects
`source-outside-package` (kills the existence-oracle-via-ENOENT mutant). REQ-IDs
stable.

V1 → V2 (blind council fixes applied): REQ-PRC-07 (no existence oracle — ruling 10
clause restored, B5); REQ-PRC-08 (validation-before-read ordering, S12); REQ-PRC-09
(SDK lexical destination guard, S17); REQ-PRC-04 reworded to an ALLOW-LIST regular-file
control (S13) and gains scenarios .4 (non-regular-non-directory), .5 (sibling-prefix,
S14), .6 (absolute source, S15), .7 (lexical-vs-realpath, S16); REQ-PRC-06 cross-refs
the REQ-BRC-08 path-form/render seam clauses (S8). All V1 REQ-IDs preserved.

## Purpose

Pins the dual-anchor containment model (obs #915 ruling 10/12) that keeps
`scaffold`/`copyIn`/`create({templateFile})` from reading or writing outside the
schematic package's own boundary. Two anchors are DISTINCT and never conflated: the
RESOLUTION anchor (where a relative `from` is resolved against — the factory/package
directory) and the CONTAINMENT ceiling (the boundary nothing may escape — the nearest
`collection.json` ancestor of the package). SDK emit-time enforcement is DX/attribution
(the real security control is the engine's apply-time re-derivation, `by-reference-copy-wire`
REQ-BRC-02 — out of this domain's SDK-side scope).

## Requirements

### REQ-PRC-01: Two Distinct Anchors

The RESOLUTION anchor MUST be the factory module's own package directory (`packageDir`,
matching the existing `defineFactory({packageDir})` convention). The CONTAINMENT
ceiling MUST be the nearest `collection.json` ancestor directory of that package. A
`from`/`copyIn` source path resolves against the resolution anchor; containment is
checked against the ceiling — these are never the same check, and design/implementation
MUST NOT substitute one for the other.

#### Scenario REQ-PRC-01.1: Resolution and containment use different anchors [SDK]

- GIVEN a package at `packages/foo/` (containing `schema.json`) whose nearest
  `collection.json` ancestor is the repo root
- WHEN `scaffold({ from: "./files", to: "src/" })` resolves `./files` against
  `packages/foo/` AND checks containment against the repo root
- THEN a source under `packages/foo/files/` passes both resolution and containment,
  even though the two anchors are different directories

### REQ-PRC-02: Ceiling Fixed Once at Run Boundary, Never Re-Walked, Never Wire-Authoritative

The containment ceiling MUST be derived ONCE, at run boundary, by the trusted
run-context (from `packageDir`, mirroring the ADR-0011 dialects-field seeding pattern)
— never re-walked per source path within the same run. The SDK-derived ceiling is NEVER
authoritative on the wire: the engine independently re-derives its own ceiling from its
own invocation context (`by-reference-copy-wire` REQ-BRC-02) and does not trust an
SDK-supplied root value.

#### Scenario REQ-PRC-02.1: Ceiling resolved once, reused across multiple scaffold/copyIn calls in one run [SDK]

- GIVEN a run that calls `scaffold` twice and `copyIn` once
- WHEN the run executes
- THEN the collection.json ancestor walk happens exactly once for the run, and all
  three calls check containment against that same resolved ceiling

### REQ-PRC-03: Missing `collection.json` Ancestor → Fail-Loud

If no `collection.json` exists at or above the package directory, run-boundary
resolution of the containment ceiling MUST fail loud with reason `invalid-input`
(owner mapping, REQ-AEC-12) — there is no fallback ceiling (e.g. filesystem root, or
"no containment").

#### Scenario REQ-PRC-03.1: No collection.json ancestor anywhere → fail-loud [SDK]

- GIVEN a package directory with no `collection.json` at any ancestor level
- WHEN a factory using `scaffold`/`copyIn`/`create({templateFile})` runs
- THEN it fails loud before any source file is read, naming the missing ancestor

### REQ-PRC-04: Source Containment — Realpath, Segment-Aware, Regular-Files Allow-List

Every resolved source path MUST be realpath'd (symlinks resolved) and checked
SEGMENT-AWARE against the ceiling — a path string containing `../` is rejected
independent of the realpath check, and prefix comparison respects segment boundaries
(never a bare string `startsWith`). Eligibility is an ALLOW-LIST: only a path whose
resolved lstat is a regular file (`isFile()`/`S_IFREG`) is eligible — never a
"reject directories" blacklist (FIFOs, sockets, devices are equally ineligible). The
walk MUST NOT descend into a symlinked directory. Both checks are SDK emit-time
(DX/attribution; `REQ-ATH-11.2`-style carve-out — the ENGINE apply-time check is the
real control, out of this domain).

#### Scenario REQ-PRC-04.1: Traversal string rejected [SDK]

- GIVEN `copyIn("../../etc/passwd", "dest.txt")`
- WHEN called
- THEN it rejects fail-loud before any read, citing containment

#### Scenario REQ-PRC-04.2: Symlink pointing outside the ceiling rejected [SDK]

- GIVEN a `from` folder containing a symlink whose realpath resolves outside the
  containment ceiling
- WHEN scaffolded
- THEN the symlinked entry rejects fail-loud; the walk does not descend into it

#### Scenario REQ-PRC-04.3: Non-regular file (directory-as-source) rejected [SDK]

- GIVEN a `from` entry that is a directory presented where a regular file is expected
  (e.g. `copyIn` given a directory path as `from`)
- WHEN called
- THEN it rejects — `source-not-regular-file` (`authoring-error-contract` REQ-AEC-10)

#### Scenario REQ-PRC-04.4: Non-regular, non-directory source (FIFO) rejected via the allow-list branch [SDK]

- GIVEN a source that is neither a regular file nor a directory — a FIFO fixture
  (where a FIFO is unfixturable in CI, the allow-list branch is asserted directly at
  unit level against a stubbed non-`S_IFREG` lstat, and the scenario is marked so)
- WHEN called
- THEN it rejects `source-not-regular-file` — proving the control is an isFile()
  allow-list, not a directory-rejection blacklist a FIFO would slip past

#### Scenario REQ-PRC-04.5: Sibling-prefix path rejected — segment-aware comparison (kills bare startsWith) [SDK]

- GIVEN a containment ceiling at `/pkg` and a source whose realpath is `/pkg-evil/x`
- WHEN checked
- THEN it rejects `source-outside-package` — a bare string-prefix comparison
  (`"/pkg-evil/x".startsWith("/pkg")`) would wrongly admit it

#### Scenario REQ-PRC-04.6: Absolute-path source rejected (no `..` present — kills the dotdot-only mutant) [SDK]

- GIVEN `copyIn("/etc/passwd", "dest.txt")` — an absolute source containing no `..`
  segment
- WHEN called
- THEN it rejects fail-loud, citing containment — a mutant that only screens for
  `../` substrings wrongly admits it

#### Scenario REQ-PRC-04.7: Lexically-inside, realpath-outside symlink rejected [SDK]

- GIVEN a source path that is LEXICALLY inside the ceiling but is a symlink whose
  realpath resolves outside it
- WHEN checked
- THEN it rejects `source-outside-package` — a lexical-only containment check would
  wrongly admit it; the realpath verdict governs

### REQ-PRC-05: Package-Relative Error Messages

Every containment rejection's message MUST name the offending path RELATIVE to the
package or collection root — never an absolute filesystem path (no-echo vocabulary,
mirroring `context.ts`'s existing `relativeDir` convention).

#### Scenario REQ-PRC-05.1: Rejection message contains no absolute path [SDK]

- GIVEN any containment rejection from REQ-PRC-03/04
- WHEN the error message is inspected
- THEN it contains no absolute filesystem path — only package/collection-relative
  segments

### REQ-PRC-06: Destination Containment Post-Render is a Seam Contract

Destination containment (the rendered `to`/`pathTemplate`, evaluated AFTER token
substitution, landing inside the workspace tree) is IN SCOPE on both sides, but its
post-render enforcement is the ENGINE'S — the SDK cannot evaluate a `pathTemplate`'s
rendered form pre-emit (rendering is engine territory, ADR-0001); the SDK's own
PRE-emit lexical destination guard is REQ-PRC-09. The engine's obligations extend to
path-FORM rejection (UNC/device/reserved/drive-relative) and single-pass literal-token
rendering — pinned in `by-reference-copy-wire` REQ-BRC-08. This REQ pins the CONTRACT
obligation only; it is not independently SDK-testable.

#### Scenario REQ-PRC-06.1: Destination containment is a documented engine obligation [SEAM] [ENGINE-GATED]

- GIVEN a `to`/pathTemplate whose rendered form would resolve outside the workspace
  tree
- WHEN the engine applies the directive
- THEN the engine MUST reject it fail-closed — this scenario documents the seam
  contract; it is exercised by the engine's own test suite, not this SDK's

### REQ-PRC-07: No Existence Oracle for Out-of-Ceiling Paths

For ANY source resolving outside the containment ceiling, the containment verdict
MUST PRECEDE any existence/stat probing of the out-of-ceiling target: the observable
failure is the SINGLE, non-differentiating reason and message shape
(`source-outside-package`) WHETHER OR NOT the target actually exists (obs #915 ruling
10 clause restored). A containment rejection MUST never function as an existence
oracle for paths outside the package — `source-not-found` is reachable ONLY for
in-ceiling paths (`authoring-error-contract` REQ-AEC-10/11).

#### Scenario REQ-PRC-07.1: Existing and non-existing out-of-ceiling targets are indistinguishable [SDK]

- GIVEN two out-of-ceiling source paths — one pointing at a file that EXISTS on the
  host, one at a path that does NOT exist
- WHEN each is rejected
- THEN both rejections carry reason `source-outside-package` with the identical
  message shape (modulo the path text) — nothing in reason, message, timing-relevant
  structure, or error fields differentiates the existing from the non-existing target

#### Scenario REQ-PRC-07.2: Broken symlink to an out-of-ceiling target still rejects source-outside-package, never source-not-found [SDK]

- GIVEN a source path LEXICALLY inside the ceiling that is a symlink whose
  out-of-ceiling target does NOT exist
- WHEN checked
- THEN it rejects `source-outside-package` — NOT `source-not-found` — pinning that
  ENOENT classification happens only AFTER the resolved location is proven
  in-ceiling; a mutant that classifies the ENOENT first would answer
  `source-not-found` and leak target-existence for out-of-ceiling paths

### REQ-PRC-08: Containment and Eligibility Validated Before Any Content Read

For every source, containment (REQ-PRC-04's realpath + segment checks) and
regular-file eligibility (the allow-list lstat) MUST complete BEFORE any content read
of that source — no byte of an unvalidated path is ever read (ordering clause, with
`content-classification` REQ-CCL-06's stat-size gate layered after these checks).

#### Scenario REQ-PRC-08.1: Out-of-ceiling source is never content-read [SDK]

- GIVEN an out-of-ceiling source (existing on the host) and fs read instrumentation
  active
- WHEN the rejection fires
- THEN zero content-read calls are recorded for that path — the containment verdict
  came first

### REQ-PRC-09: SDK Emit-Time Lexical Destination Guard

The SDK MUST reject, pre-emit, a `to` (on `scaffold` or `copyIn`) that contains a
literal `../` segment or is an absolute path — symmetric with the source-side lexical
screen (REQ-PRC-04). This is a lexical guard only: the engine's post-render check
(REQ-PRC-06, REQ-BRC-08) remains the real control for rendered forms the SDK cannot
evaluate.

#### Scenario REQ-PRC-09.1: Literal `../` or absolute `to` rejected pre-emit [SDK]

- GIVEN `copyIn("asset.svg", "../escape.svg")` and, in a separate fixture,
  `scaffold({ from: "./files", to: "/abs/path" })`
- WHEN each is called
- THEN each rejects fail-loud before any directive is emitted

### REQ-PRC-10: Scaffold Walk ROOT Is Containment-Checked Before Enumeration [ADDED V4 — post-signing remediation, pending owner sign-off; 10.3 AMENDED V5 — judgment-day iteration 2 fix, pending owner sign-off]

`scaffold`'s `from` (the walk ROOT, a directory — never file-checked) MUST pass the
SAME lexical + realpath ceiling checks REQ-PRC-04 applies to individual sources
(reusing the shared containment machinery — no parallel check) BEFORE `walkFolder`
enumerates it. An escaping or out-of-ceiling root rejects `source-outside-package`
with NO enumeration of the out-of-ceiling subtree (no `readdirSync`/`lstatSync` call
against it) — closing the metadata-enumeration oracle / bounded-DoS gap the walk's
10k-entry cap alone did not prevent (the cap still bounds an out-of-ceiling walk that
DID start, it does not stop one from starting). A root that IS in-ceiling but is not a
readable directory (legitimately ABSENT, or resolves to a regular FILE) is left by the
containment check for `walkFolder` itself to answer (V4's original scope: this REQ
never invents a new CONTAINMENT verdict for those cases) — but `walkFolder`'s answer
MUST itself be `AuthoringError` (reason `invalid-input`), naming only the
package-relative root path, never a raw Node `Error` that echoes the absolute
filesystem path (V5 amendment, scenario REQ-PRC-10.3 below).

#### Scenario REQ-PRC-10.1: Lexically escaping `from` rejects before any enumeration [SDK]

- GIVEN `scaffold({ from: "../secrets", to: "out" })` where `../secrets` resolves
  outside the containment ceiling
- WHEN called
- THEN it rejects `source-outside-package` and zero `readdirSync`/`lstatSync` calls
  are ever made against the out-of-ceiling subtree

#### Scenario REQ-PRC-10.2: Symlinked `from` whose realpath escapes rejects before any enumeration [SDK]

- GIVEN a `from` that is LEXICALLY inside the ceiling but is a symlinked directory
  whose realpath resolves outside it
- WHEN scaffolded
- THEN it rejects `source-outside-package` — the realpath verdict governs, and the
  walk never descends into the symlinked target

#### Scenario REQ-PRC-10.3: Missing or non-directory in-ceiling `from` rejects AuthoringError, package-relative path only [SDK] [AMENDED V5]

- GIVEN a `from` that is lexically and really in-ceiling but does not exist on disk
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw ENOENT `Error`, never the absolute
  filesystem path

#### Scenario REQ-PRC-10.3b: In-ceiling `from` that resolves to a regular file rejects AuthoringError, package-relative path only [SDK] [ADDED V5]

- GIVEN a `from` that is lexically and really in-ceiling but resolves to a regular
  FILE, not a directory
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw ENOTDIR `Error`, never the absolute
  filesystem path

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation / containment) | REQ-PRC-01 through REQ-PRC-10 | Yes |
