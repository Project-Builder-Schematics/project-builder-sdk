# IR Path Well-Formedness Specification

**Spec version**: V3.3
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write; plan-verify-3 finding B9): REQ-IPF-01's verbatim author-facing rule
gains an honest qualifier — the unqualified "always" promise, read alone, contradicts
the published symlink-escape residual (`package-source-io-hygiene` REQ-PSH-04); the
qualifier makes both promises consistent for the same reader. The SAME qualified
sentence is required in `package-dir-run-anchor` REQ-MFB-02's new `docs/authoring-verbs.md`
entry (its doc home, per `design.md:414`).

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
no content deltas targeted this domain — version/status bump only. (REQ-AEC-11's
destination-message row, which this REQ's REQ-IPF-02 feeds, is split at V3 in
`authoring-error-contract` — no wording change needed HERE, since REQ-IPF-02 already
deferred its exact destination message to the existing `destinationEscapeMessage`
function, verbatim.)

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3, plus one
self-verified correction): predicate wording made precise (segment-aware over BOTH `/`
and `\`, "any path segment equal to `..`" — never a substring test); the verbatim
author-facing rule is now quoted in REQ-IPF-01's body; new edge-case scenario
REQ-IPF-01.6 (`..`, `sub/..`, `..\x`, multi-segment traversal); REQ-IPF-01.1 gains a
zero-stat/read-calls assertion (screen-before-stat, kills the existence-oracle +
post-stat-screen mutant); one sentence added stating UNC/device/drive-relative Windows
forms are explicitly out of this screen's scope (engine obligation, REQ-BRC-08);
REQ-IPF-02.1 now names `invalid-input` explicitly.

**Correction to REQ-IPF-01.4 (self-verified against `src/scaffold/containment.ts` and
the proposal's own Author-Visible Behaviour Change table)**: the ORIGINAL V1 scenario
claimed a literal-string `from: "../shared/base.txt"` was previously ACCEPTED and is
newly rejected by ruling 5 — this is FALSE. `containment.ts`'s `resolveContainedRealpath`
Step 1 (`isLexicallyEscaping`) rejected ANY literal `..` segment UNCONDITIONALLY,
INDEPENDENT of the ceiling, under the retired regime too — confirmed by direct source
read; the proposal's own table (`Before` column for every `../x` row) says "rejected
`source-outside-package`," never "accepted." There is no narrowing for a literal `..`
string; REQ-IPF-01.1/.2 already correctly state this was and remains rejected. The row
in the proposal's table actually describing an `accepted → rejected` flip
("in-package via `../shared/` symlink escape... accepted (realpath resolved inside high
ceiling)") is about a DIFFERENT case entirely: an author-supplied path with NO literal
`..` (e.g. `from: "shared/base.txt"`) that resolves through an in-package SYMLINK to a
target outside `packageDir`. Ruling 5's lexical screen inspects only the literal input
string — it CANNOT detect or reject a symlink's target, by construction. That case is
therefore NOT rejected after this change either; it remains ACCEPTED, now via a WIDER
mechanism (no ceiling check exists at all, vs. previously being checked against a real,
if permissive, ceiling) — this is `package-source-io-hygiene` REQ-PSH-04.1's tripwire
scenario and REQ-PSH-04's dated residual-risk amendment, not a rejection scenario here.
**Recommendation to the proposal owner**: correct proposal.md's Author-Visible
Behaviour Change table row and the matching Risks-table row — both currently say
"rejected — ruling-5 narrowing, breaking" for a case that is, and remains, accepted;
the CHANGELOG/migration-note framing for that row should be dropped (no migration is
needed since nothing rejects there). REQ-IPF-01.4 below is rewritten to state the
verified reality rather than the disproven premise.

## Purpose

Pins the lexical well-formedness guards on paths the SDK computes or emits, now that
containment (a realpath ceiling comparison) no longer exists. These are NOT a
containment substitute (owner ruling 3/5 keeps them scoped to a different purpose: IR
shape, not a security boundary): (a) owner ruling 5's UNIFIED lexical source screen —
one predicate, rejecting any path SEGMENT equal to `..` or an absolute-looking path,
applied at exactly THREE call sites; (b) owner ruling 2's destination lexical guard,
re-homed from `package-root-containment` REQ-PRC-09; (c) the emitted-source-path-never-
absolute guarantee `by-reference-copy-wire` REQ-BRC-07 promises. Canonical-form
hardening (UNC, device-namespace, reserved-DOS-name, drive-relative Windows forms) is
explicitly OUT of this screen's scope by design — that is `by-reference-copy-wire`
REQ-BRC-08's engine-side obligation, not a lexical concern the SDK resolves.

## Requirements

### REQ-IPF-01: Ruling-5 Unified Lexical Source Screen — Three Call Sites, `../`/Absolute Rejected

The SDK MUST reject, before any hygiene/stat check runs, a package-local source whose
path, split on BOTH `/` and `\` separators, contains ANY segment exactly equal to `..`,
or whose path is absolute (POSIX leading `/` or a Windows drive letter) — a
SEGMENT-AWARE test, never a substring test (`"..foo"` or `"foo.."` contain no `..`
segment and are NOT rejected by this predicate). ONE predicate, applied at exactly
THREE call sites: `readTemplateFile`, `scaffold`'s root `from` (BEFORE `walkFolder`
enumerates it — the check-before-walk ordering an escaping root must never be
enumerated ahead of is PRESERVED), and `copyIn`'s `from`. The rejection is an
`AuthoringError` with reason `invalid-input` (styled on the existing destination-escape
message: package-relative path only, no-echo). Author-facing rule (verbatim, to be
documented — qualified at V3.3 per plan-verify-3 finding B9, so the same reader never
holds two contradictory promises): *"the SDK rejects lexical `../` or absolute source
paths, always; everything a schematic reads lives inside its package — symlinks are
followed without target verification (see SECURITY.md)."* This is a LEXICAL screen
scoped to the SDK's own reads — it is NOT a containment substitute; a symlink lexically
inside the package whose target escapes `packageDir` is an accepted residual
(`package-source-io-hygiene` REQ-PSH-04's posture), never rejected by this screen.

#### Scenario REQ-IPF-01.1: `../` source rejected at all three call sites, zero stat/read calls recorded [red-today]

- GIVEN `../x` passed as the source to each of the three call sites, driven once per
  verb (three cases) — where the target `../x` EXISTS on disk as a regular file
  (proving the rejection is not merely an existence-check side effect)
- WHEN each is called
- THEN each rejects `AuthoringError` reason `invalid-input` before any read, the message
  naming only the package-relative literal, never an absolute path
- AND zero stat or read calls are recorded against the target — the lexical screen
  fires strictly BEFORE any filesystem touch (kills both the existence-oracle mutant
  and a mutant that reorders the screen after a stat)

#### Scenario REQ-IPF-01.2: Absolute source rejected at all three call sites

- GIVEN `/abs/x` (an absolute path containing no `..` segment) passed as the source to
  each of the three call sites, driven once per verb (three cases)
- WHEN each is called
- THEN each rejects `AuthoringError` reason `invalid-input` — a predicate that screens
  only for `../` substrings would wrongly admit this

#### Scenario REQ-IPF-01.3: `scaffold`'s escaping root rejects before any enumeration

- GIVEN `scaffold({ from: "../secrets", to: "out" })`
- WHEN called
- THEN it rejects `invalid-input` and zero `readdirSync`/`lstatSync` calls are ever made
  against the out-of-package subtree — the check-before-walk ordering this screen
  replaces (`validateSourceRootContainment`) is preserved exactly

#### Scenario REQ-IPF-01.4: Literal `..`/absolute source forms were ALWAYS rejected — no narrowing here (corrected) [preservation-pin]

- GIVEN a literal-string source such as `from: "../shared/base.txt"`, driven once per
  verb (three cases)
- WHEN called under BOTH the retired `package-root-containment` model and this screen
- THEN it rejects in BOTH regimes — `containment.ts`'s lexical-escape check
  (`isLexicallyEscaping`) already rejected any literal `..` segment unconditionally,
  independent of the ceiling, before this change; ruling 5 changes the HOME of this
  check (from `containment.ts` into this dedicated screen), not its outcome for this
  input shape
- **This is NOT the ruling-5 narrowing.** The actual behaviour-affecting case — an
  author-supplied path with NO literal `..` that resolves through an in-package
  SYMLINK to a target outside `packageDir` — is unaffected by this lexical screen (it
  cannot see through a symlink) and remains ACCEPTED; see
  `package-source-io-hygiene` REQ-PSH-04.1 for that scenario and its residual-risk
  framing

#### Scenario REQ-IPF-01.5: Traversal and absolute source paths both reject (re-cited from `scenario-matrix` M-16)

- GIVEN `../` and absolute source paths, driven through the `author-emulation` factory
  fixture `scenario-matrix` M-16 already exercises
- WHEN called
- THEN both reject with reason `invalid-input` — M-16's citation moves to this REQ (its
  rationale was previously "containment cited"; it now cites the ruling-5 lexical
  screen, the exact behaviour this REQ mandates)

#### Scenario REQ-IPF-01.6: Segment-aware edge cases reject at all three call sites [red-today]

- GIVEN each of `".."`, `"sub/.."`, `"..\\x"` (backslash separator), `"a/../../x"`
  (multi-segment traversal), and `"./a/../../x"`, driven once per verb (three cases
  each)
- WHEN called
- THEN each rejects `AuthoringError` reason `invalid-input` — proving the predicate
  splits on BOTH `/` and `\`, checks EVERY segment (not just the first or last), and
  is not fooled by a leading `./` or nested traversal

### REQ-IPF-02: SDK Emit-Time Lexical Destination Guard (re-homed from `package-root-containment` REQ-PRC-09)

The SDK MUST reject, pre-emit, with reason `invalid-input`, a `to` (on `scaffold` or
`copyIn`) that contains a literal `../` segment or is an absolute path — symmetric with
REQ-IPF-01's source screen. This is a lexical guard only: the engine's post-render check
(`by-reference-copy-wire` REQ-BRC-08) remains the real control for rendered forms the
SDK cannot evaluate. (Owner ruling 2: this requirement SURVIVES the containment
removal unchanged in substance, re-homed here as IR well-formedness rather than
containment.)

#### Scenario REQ-IPF-02.1: Literal `../` or absolute `to` rejected pre-emit with reason `invalid-input` [preservation-pin]

- GIVEN `copyIn("asset.svg", "../escape.svg")` and, in a separate fixture,
  `scaffold({ from: "./files", to: "/abs/path" })`
- WHEN each is called
- THEN each rejects `AuthoringError` reason `invalid-input`, fail-loud before any
  directive is emitted

### REQ-IPF-03: Emitted Source Path Is Never Absolute

Because REQ-IPF-01 rejects an absolute source before any directive is built, the
package-local source path on an emitted by-reference directive is, by construction,
never absolute — the mechanism satisfying `by-reference-copy-wire` REQ-BRC-07's
promise (previously an implicit consequence of containment's realpath-based
resolution flow; now this screen is the enforcing mechanism).

#### Scenario REQ-IPF-03.1: No absolute filesystem path appears in an emitted directive [preservation-pin]

- GIVEN by-reference directives emitted via `copyIn` and via a by-reference `scaffold`
  entry
- WHEN each directive's full serialized form is scanned
- THEN no absolute filesystem path appears anywhere in it

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (IR shape, explicitly NOT a containment boundary) | REQ-IPF-01, REQ-IPF-02, REQ-IPF-03 | Yes — re-homed from `package-root-containment`; scoped to lexical well-formedness, never realpath-based containment |
