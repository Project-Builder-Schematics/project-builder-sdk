# Package Source IO Hygiene Specification

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.
(REQ-PSH-04's residual paragraph already covers the symlink caveat REQ-IPF-01's V3.3
qualifier now cross-links; no wording change needed HERE.)

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write; plan-verify-2 findings Q4/Q5/F4): REQ-PSH-03.1 and REQ-PSH-04.1's
`copyIn` legs are now pinned as EMITTED-DIRECTIVE-SHAPE assertions (the `from` field
names the symlink's package-relative path correctly), NOT content-read assertions — the
contract fake/run vehicle never materialize `copyIn` bytes
(`src/testing/contract-fake.ts:237-247`); the `create({templateFile})`/scaffold legs
keep their content-read assertion unchanged. REQ-PSH-02.3's `scaffold` case is now
explicitly sanctioned at the `classifyTransport` boundary via a direct unit call — the
SAME pattern REQ-PSH-01.3 already uses — because a walk-discovered entry name cannot
contain a NUL byte (filesystems reject it), so the per-verb rule is satisfied without a
live walk fixture. NEW REQ-PSH-05 gives `SECURITY.md`'s five-point trust posture (owner
ruling 9) a normative home.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): REQ-PSH-01 restates
its own package-relative/no-echo obligation (the retired REQ-PRC-05 pointer was
under-discharged), restores real-FIFO-first framing, adds a zero-content-read
mutant-kill assertion, and gains a degenerate-source scenario (`""`, `.`, `./`).
REQ-PSH-02 gains an explicit carve-out pointing scaffold's WALK ROOT to
`folder-scaffold` REQ-FSC-10 and drops `scaffold` from its per-entry "missing source"
scenario (a per-entry file is walk-discovered to exist; a "missing" verdict for it is
TOCTOU-only, never a primary scenario); its guard is now stated as TOTAL (any throw —
errno or not, including `ERR_INVALID_ARG_VALUE` for an embedded NUL byte — translates,
never propagates raw); gains a NUL-byte scenario and a broken-symlink scenario (noting
the verdict CHANGE from the retired REQ-PRC-07.2). REQ-PSH-03 drops the backwards
"security lean" framing (following symlinks is the PERMISSIVE choice, not a stricter
one) and defers the `statSync`/`lstatSync` API choice to ADR-0077 — spec states
observable behaviour only. NEW REQ-PSH-04 pins the accepted security residuals
(verbatim residual paragraph + dated ruling-5 amendment) with a positive tripwire
scenario. All per-verb scenarios now read "driven once per verb (three cases)," never
"any of the three verbs," to close the 2-of-3 mutant gap.

## Purpose

Re-homes the IO-hygiene guards that were never containment (R1/R2 of the proposal's
re-home table) — they stop resource hazards (FIFO hang, unreadable source) and preserve
the `AuthoringError`-with-relative-path no-echo obligation `by-reference-copy-wire`
REQ-BRC-06/06.1 still binds, independent of the deleted containment ceiling. Binds
per-entry package-local reads at `readTemplateFile`, `copyIn`, and scaffold's per-entry
classify — but see REQ-PSH-02's explicit carve-out: scaffold's walk ROOT is
`folder-scaffold` REQ-FSC-10's concern, not this domain's. Symlink-based escape from
`packageDir` is an ACCEPTED, documented residual (REQ-PSH-04) — this domain is hygiene,
never a security boundary.

## Requirements

### REQ-PSH-01: Regular-File Allow-List Before Any Content Read, Package-Relative No-Echo

Every resolved package-local source MUST be eligible via an ALLOW-LIST: only a path
whose stat is a regular file is eligible for reading — never a "reject directories"
blacklist (a FIFO, socket, or device is equally ineligible). This check completes BEFORE
any content read, at all three read verbs (scaffold's per-entry files included — the
walk already proves an entry exists as SOME dirent, but not that it is a regular file).
A rejection is an `AuthoringError` naming ONLY the offending path's package-relative
form — never an absolute filesystem path (no-echo); this restates, for this REQ
specifically, the obligation the retired `package-root-containment` REQ-PRC-05 pinned
generally.

#### Scenario REQ-PSH-01.1: Non-regular, non-directory source (FIFO) rejected via the allow-list branch, zero content-read calls [preservation-pin]

- GIVEN a REAL FIFO fixture (created via `mkfifo`, where the CI environment supports
  it) that is neither a regular file nor a directory — OR, where FIFO creation is
  unavailable in CI, a stubbed non-regular-file stat asserted directly at unit level,
  marked as a CI fallback — driven once per verb (three cases)
- WHEN read
- THEN it rejects `source-not-regular-file` — proving the control is a regular-file
  allow-list, not a directory-rejection blacklist a FIFO would slip past
- AND zero content-read (`readFileSync`) calls are recorded against the source before
  the allow-list check completes — killing the readFileSync-before-stat mutant that
  would otherwise hang on a real FIFO with no writer

#### Scenario REQ-PSH-01.2: Directory-as-source rejected [preservation-pin]

- GIVEN a source path that resolves to a directory where a regular file is expected,
  driven once per verb at `create({templateFile})` and `copyIn` (two cases — scaffold's
  per-entry classify never receives a directory as a "source" candidate: `walkFolder`
  recurses into directories rather than passing them to classify, so this case cannot
  be constructed at that call site; this is a deliberate scope note, not an omission)
- WHEN called
- THEN it rejects `source-not-regular-file`

#### Scenario REQ-PSH-01.3: Degenerate source strings resolve to `packageDir` itself, rejected as non-regular [red-today]

- GIVEN a source of `""`, `"."`, or `"./"` — each resolves (via `resolve(join(packageDir,
  relPath))`) to `packageDir` itself, a directory — driven once per verb (three cases)
- WHEN called
- THEN it rejects `source-not-regular-file` (the same allow-list branch as
  REQ-PSH-01.2) — never a crash, never a different reason; the classic empty-string
  crash input is pinned to a normal, handled outcome

### REQ-PSH-02: Guarded Existence/Read Check — `source-not-found` / `source-unreadable`, Package-Relative, No-Echo, TOTAL

Every package-local PER-ENTRY source read — `create({templateFile})`'s `templateFile`
and `copyIn`'s `from` — MUST be preceded by a guarded existence/readability check that
mints `source-not-found` (source does not exist) or `source-unreadable` (exists but
could not be read, or the underlying stat/read call threw for ANY reason at all) as an
`AuthoringError` naming ONLY the package-relative path — never a raw Node error, never
an absolute filesystem path. The guard is TOTAL: ANY throw from the underlying stat/read
call — an errno exception (ENOENT, EACCES, ELOOP, …) OR a non-errno exception (e.g.
`ERR_INVALID_ARG_VALUE`, thrown for a path string containing an embedded NUL byte) —
MUST translate to one of these two reasons; a raw Node error/exception MUST NEVER
propagate to the author.

**Carve-out**: `scaffold`'s WALK ROOT (`from`, the directory itself) is NOT governed by
this REQ — its missing/non-directory/unreadable-root failure modes are
`folder-scaffold` REQ-FSC-10's concern (reason `invalid-input`, not `source-not-found`/
`source-unreadable`). This REQ governs scaffold's PER-ENTRY files (discovered by the
walk, then classified) only insofar as a per-entry file can independently fail to
exist/read — which, since the walk already proved the entry exists as a dirent, is a
TOCTOU-only condition, not a primary scenario (see REQ-PSH-02.1's verb scope).

#### Scenario REQ-PSH-02.1: Missing source rejects `source-not-found`, driven once per verb where directly constructible (two cases) [preservation-pin]

- GIVEN a package-local source path that does not exist, driven once per verb at
  `create({templateFile})` and `copyIn` — NOT scaffold: a scaffold per-entry source is
  discovered by `walkFolder`'s own directory read, so it is proven to exist as a dirent
  before classify ever runs; a "missing" verdict for a scaffold per-entry source is
  constructible ONLY via a TOCTOU race (deleted between walk and read), never as a
  primary, deterministic scenario
- WHEN called
- THEN each rejects an `AuthoringError` with reason `source-not-found`, naming only the
  package-relative path — for `copyIn` this is the end-to-end obligation
  `by-reference-copy-wire` REQ-BRC-06.1 binds

#### Scenario REQ-PSH-02.2: Unreadable source rejects `source-unreadable`, no-echo [preservation-pin]

- GIVEN an in-package, existing, regular-file source whose read fails (an injected
  read-failure seam, e.g. EACCES — never a chmod-based CI fixture, which is unreliable
  under root-running CI and container umasks), driven once per verb (three cases)
- WHEN read
- THEN it rejects `source-unreadable`, the message naming only the package-relative
  path — never the raw errno text, never an absolute path

#### Scenario REQ-PSH-02.3: Embedded NUL byte in a source path rejects `source-unreadable`, no-echo [red-today]

- GIVEN a source path string containing an embedded NUL byte (`"a\0b"`) — Node's
  `fs` calls throw `ERR_INVALID_ARG_VALUE` for this input, a NON-errno `TypeError`,
  driven once per verb (three cases). The `scaffold` case is SANCTIONED at the
  `classifyTransport` boundary via a DIRECT unit call passing a NUL-containing
  `relPath` — the SAME sanctioned pattern REQ-PSH-01.3 already uses for its scaffold
  case — because a walk-discovered entry name structurally CANNOT contain a NUL byte
  (the filesystem itself rejects NUL in filenames, so `walkFolder` can never produce
  one); this satisfies the per-verb rule without requiring a live walk fixture that
  could never be constructed
- WHEN called
- THEN it rejects `AuthoringError` reason `source-unreadable`, naming only the
  package-relative form of the offending path (or a fixed placeholder if the NUL byte
  itself makes the path unrepresentable in a message) — the raw `ERR_INVALID_ARG_VALUE`
  exception NEVER propagates to the author

#### Scenario REQ-PSH-02.4: Broken symlink rejects `source-not-found` — a verdict CHANGE from the retired regime [red-today]

- GIVEN a package-local source that is a symlink whose target does not exist (a broken
  symlink) — `statSync` throws `ENOENT` — driven once per verb (three cases)
- WHEN called
- THEN it rejects `AuthoringError` reason `source-not-found`
- **Behaviour change, noted explicitly**: the retired `package-root-containment`
  REQ-PRC-07.2 pinned that a broken symlink lexically inside the (then-existing)
  ceiling whose target did not exist rejected `source-outside-package` — NEVER
  `source-not-found` — because the ceiling verdict had to precede existence
  classification. That distinction no longer exists (there is no ceiling to
  precede-or-follow): a broken symlink now simply fails existence resolution and is
  classified `source-not-found` directly, like any other missing target

### REQ-PSH-03: Symlink Resolution Follows Targets — In-Package Symlink to In-Package Regular File Is Accepted; Symlink Cycles Rejected

Package-local source resolution MUST follow a symlink to its target (rather than
treating the symlink itself as the subject of the regular-file check) — the MORE
PERMISSIVE of the two possible choices, written here as an explicit, deliberate
acceptance: an in-package symlink whose target is itself an in-package regular file is
a legitimate read (the symlink is followed transparently, exactly as a direct reference
to a regular file would be). A symlink whose resolution enters a CYCLE MUST reject
`source-unreadable` — never a raw Node error, never an absolute path. The specific API
call used to implement this (`statSync` vs. `lstatSync` plus a manual follow) is a
design/ADR-0077 decision, not pinned here — this REQ states the OBSERVABLE behaviour
only.

#### Scenario REQ-PSH-03.1: In-package symlink resolving to an in-package regular file is accepted [preservation-pin]

- GIVEN a package containing a regular file `real.txt` and a symlink `link.txt` whose
  target is `real.txt` (both inside `packageDir`), driven once per verb (three cases)
- WHEN `link.txt` is read via `create({templateFile})` or `scaffold`
- THEN the read succeeds, returning `real.txt`'s content — the symlink is followed,
  never rejected merely for being a symlink
- WHEN `link.txt` is read via `copyIn`
- THEN the emitted directive's `from` field names `link.txt`'s package-relative path
  correctly (an EMITTED-DIRECTIVE-SHAPE assertion) — NOT a content-read assertion: the
  contract fake and run vehicle deliberately never materialize `copyIn` bytes
  (`src/testing/contract-fake.ts:237-247`), so no test may assert what content
  `copyIn` "read" through the symlink

#### Scenario REQ-PSH-03.2: Symlink cycle rejects `source-unreadable`, no-echo [red-today]

- GIVEN a package-local source path that resolves through a symlink cycle (`ELOOP`),
  driven once per verb (three cases)
- WHEN read
- THEN it rejects `source-unreadable`, naming only the package-relative path — never a
  raw `ELOOP` error, never an absolute filesystem path

### REQ-PSH-04: Accepted Security Residuals (v1 Trusted-Author Model)

The following residual-risk statement is RATIFIED and MUST be carried VERBATIM into
design/ADR-0077 — never edited in place; amendments append a dated line instead:

> SDK-side containment is removed. Against a hostile factory author this loses nothing
> (in-process code, full fs access — the ceiling never constrained it). The engine's
> apply-time re-derivation covers path-carrying directives only. The SDK's own
> inline-content reads keep a minimal lexical screen (`../`/absolute rejected at the two
> read sites); symlink-based escape from packageDir remains possible and is accepted (v1
> trusted-author model). Preserved as IO hygiene independent of containment: regular-file
> allow-list, AuthoringError-with-relative-path on every source rejection (no-echo),
> lexical destination guard, absolute-never-on-wire, walk loop-safety bounds. Error-reason
> differences form a filesystem existence/permission oracle — accepted, documented.

> **Dated amendment (owner ruling 5, 2026-07-28)**: the paragraph above says "the two
> read sites" — pre-ruling-5 language. Ruling 5 unifies the lexical screen across THREE
> call sites (`readTemplateFile`, scaffold's walk-root `from`, `copyIn`'s `from`), and the
> accepted symlink-escape residual WIDENS accordingly: it now covers BOTH path classes —
> (a) inline/by-value content reads (`readTemplateFile`, scaffold's by-value classify)
> AND (b) by-reference SOURCES crossing the wire (`copyIn`'s `from`, and a by-reference
> scaffold entry) — an in-package symlink pointing outside `packageDir` reaches the wire
> UNFILTERED for by-reference directives too, not only for inline content. This is wider
> than the original paragraph's scope, not narrower: previously a by-reference source's
> containment was realpath-checked against a (possibly higher) ceiling; now there is no
> ceiling check for it at all, only the ruling-5 LEXICAL screen, which cannot see through
> a symlink.

**Per-path-class boundary table** (reproduced from the proposal's Intent section — the
positive statement of who controls what):

| Path class | Boundary control | Owner |
|---|---|---|
| By-reference (path crosses the wire) | Apply-time ceiling re-derivation, `by-reference-copy-wire` REQ-BRC-02 | Engine |
| By-value / inline content (bytes cross the wire) | **No boundary control**; lexical screen only, trusted-author v1 | SDK (hygiene, not security) |
| Destinations | Lexical guard at emit (`ir-path-well-formedness` REQ-IPF-02) + post-render containment (engine, REQ-BRC-08) | SDK (lexical) + engine (apply) |

#### Scenario REQ-PSH-04.1: In-package symlink to an OUTSIDE regular file is accepted — the residual, asserted positively [red-today]

- GIVEN a symlink INSIDE `packageDir` whose target is a regular file OUTSIDE
  `packageDir` (anywhere on the filesystem, not merely a sibling), read via EACH of the
  three verbs (three cases)
- WHEN read via `create({templateFile})` or `scaffold`
- THEN the read SUCCEEDS, returning the outside file's content — asserted POSITIVELY,
  so retiring this acceptance requires a deliberate, reviewed change to this scenario,
  never a silent regression
- WHEN read via `copyIn`
- THEN the emitted directive's `from` field names the symlink's package-relative path
  correctly and the directive commits WITHOUT rejection (an EMITTED-DIRECTIVE-SHAPE +
  no-rejection assertion) — NOT a content assertion: the contract fake/run vehicle
  never materialize `copyIn` bytes, so "returning the outside file's content" is not a
  constructible assertion for this leg
- **Regression tripwire**: a retained or regrown `realpathSync`-based containment check
  (anywhere in the read path) MUST FAIL this scenario (all three legs) — its
  reappearance is exactly the ceiling-regrowth `fitness-guards` REQ-FTG-06 (FIT-NEW-A)
  is built to catch, and this scenario is this residual's own behavioural counterpart
  to that static guard

### REQ-PSH-05: `SECURITY.md` Publishes the Full v1 Trust Posture (owner ruling 9)

`SECURITY.md` MUST carry, as five distinct, mechanically-greppable points, the DECIDED
trust posture: (1) the SDK provides NO containment guarantee; (2) path-carrying
directives are re-checked by the engine at apply time (`by-reference-copy-wire`
REQ-BRC-02, verified LIVE); (3) by-value/inline content has no boundary control on
either side — v1 trusted-author model; (4) symlink escape from `packageDir` is an
accepted, documented residual (REQ-PSH-04); (5) Windows UNC/drive-relative source forms
are not screened SDK-side (engine obligation, `by-reference-copy-wire` REQ-BRC-08).
Cross-links ADR-0077 (`package-source-io-hygiene` REQ-PSH-04;
`by-reference-copy-wire` REQ-BRC-02/REQ-BRC-08; `ir-path-well-formedness`'s
Windows-out-of-scope note). This gives `sdd-verify --mode=final` a mechanical
completeness check where previously only a slice task existed with no REQ behind it.

#### Scenario REQ-PSH-05.1: `SECURITY.md` contains all five posture points [red-today]

- GIVEN `SECURITY.md`
- WHEN inspected
- THEN all five posture points above are present, each as a distinguishable, greppable
  statement — removing any one fails this check

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (IO hygiene, explicitly NOT a containment boundary) | REQ-PSH-01, REQ-PSH-02, REQ-PSH-03, REQ-PSH-04, REQ-PSH-05 | Yes — re-homed from `package-root-containment`, which was flagged; symlink escape from `packageDir` is an accepted, documented residual, not a guarded boundary |
