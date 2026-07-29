# Delta for Folder Scaffold

**Spec version**: V3.5
**Status**: signed (owner, 2026-07-29 — micro-unfreeze V3.4→V3.5, ruling 17, judgment-day
round 3; V3.4 signed 2026-07-29, ruling 16, judgment-day round 1; V3.3 signed 2026-07-28,
ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see
proposal.md)
**Change**: `inline-collection-marker`

**Ruling 17 (2026-07-29, judgment-day round 3)**: two blind judges proved a degenerate
`from` (`""`, `"."`, or `"./"`) resolves to `packageDir` itself and — since none of these
three literals contain a `..` segment or an absolute form — sailed straight past
`validateSourceLexical` into `walkFolder`, silently enumerating the ENTIRE package. Owner
ruling: these three forms REJECT `AuthoringError` (reason `invalid-input`), same posture
as the symlinked-root rejection (ruling 16) — `scaffold` mirrors a FOLDER an author
deliberately named, never the package wholesale. New requirement REQ-FSC-11 below.

**Ruling 16 (2026-07-29, judgment-day round 1 — the load-bearing fix)**: two blind judges
proved `walkFolder`'s ROOT branch called `readdirSync(fromAbs)` with no `lstatSync` ahead
of it, so a symlinked `from` was FOLLOWED rather than held to REQ-FSC-09's own "MUST NOT
descend into ANY symlinked directory" rule — only the NESTED case was implemented and
tested. Owner ruling: a symlinked walk ROOT REJECTS with `AuthoringError` (reason
`invalid-input`, package-relative locator, no absolute-path echo) — an explicit error, not
a silent skip and not a documented residual. New scenario REQ-FSC-09.3 below; the prior
ADR-0077 residual test asserting a symlinked root was transparently followed is retired
(superseded, never deleted from history — see `test/scaffold/expander.test.ts`).

V3.2 → V3.3 (owner micro-unfreeze, 2026-07-28, ruling 15 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V3.1 → V3.2 (owner micro-unfreeze, 2026-07-28, ruling 13 — pre-authorized,
signed-on-write): no content deltas targeted this domain — version/status bump only.

V2 → V3 (owner micro-unfreeze, 2026-07-28, ruling 6 — pre-authorized, signed-on-write):
adds REQ-FSC-10.4 (owner ruling 8 brings a pre-existing recursive-walk no-echo gap IN
SCOPE as a conscious ride-along, alongside the walk-ROOT cases REQ-FSC-10.1-.3 already
cover): a RECURSIVE read failure mid-walk (a subdirectory that raises EACCES on
`readdirSync`, or an entry deleted between `readdir` and `lstat`) now surfaces the SAME
`AuthoringError`/no-echo treatment the walk ROOT already gets, reusing the existing
`rootReadFailure` mapping rather than inventing a parallel one.

V1 → V2 (blind spec council — BA/QA/security, `yes-with-edits` ×3): adds
REQ-FSC-10.3 (walk-root unreadable for a non-ENOENT/ENOTDIR reason, e.g. EACCES); the
Sensitive Areas Coverage label drops the word "containment" (this family never held
containment — R5/R6/R7 were always loop-safety/hygiene/no-echo concerns wearing a
containment-derived rationale, now corrected); a Purpose Amendment note updates the main
family spec's cross-reference to the now-retired `package-root-containment`.

## Purpose Amendment

The main family spec's Purpose section (`openspec/specs/folder-scaffold/spec.md`)
states: "source/destination safety is `package-root-containment`'s contract." That
family is retired wholesale. At archive sync, this sentence MUST be rewritten to:
"source hygiene is `package-source-io-hygiene`'s contract; source/destination lexical
well-formedness is `ir-path-well-formedness`'s contract" — reflecting the re-homed
destinations, never re-introducing the retired containment framing.

## ADDED Requirements

### REQ-FSC-10: Walk ROOT and Recursive Read Failures Reject `AuthoringError`, Package-Relative Path Only (re-homed from `package-root-containment` REQ-PRC-10.3/10.3b, R7)

A `scaffold` walk ROOT (`from`) that is legitimately ABSENT, resolves to a regular FILE
rather than a directory, or is otherwise UNREADABLE for a reason other than
missing/non-directory (e.g. a permission error), MUST reject `AuthoringError` (reason
`invalid-input`) naming ONLY the package-relative `from` path — never a raw Node `Error`
that echoes the absolute filesystem path. This is `walk.ts`'s own `rootReadFailure`
no-echo fix, independent of the (now-retired) containment ceiling check: the
`from`-relative-path threading this REQ pins survives verbatim; only its home changes.
The SAME mapping applies to a RECURSIVE read failure encountered mid-walk (a
subdirectory whose `readdirSync` raises EACCES, or an entry that vanishes between
`readdir` and `lstat`) — `walk.ts` reuses its existing `rootReadFailure` treatment for
this case rather than introducing a parallel one, so a nested read failure is no-echo
and package-relative exactly like a root failure.

(Previously: this behaviour was pinned as `package-root-containment` REQ-PRC-10.3/
10.3b, framed as "a root that IS in-ceiling but not a readable directory." That framing
is retired along with the ceiling concept — the walk ROOT's own no-echo obligation
belongs to `folder-scaffold`, which owns walk enumeration, not to a containment domain.
The lexically-escaping-root case this REQ-PRC-10 family also covered is superseded by
`ir-path-well-formedness` REQ-IPF-01's lexical screen, applied at the scaffold-root call
site BEFORE this REQ's check ever runs. V2 added the non-ENOENT/ENOTDIR unreadable-root
case, which the retired family never explicitly separated from the missing case. V3
(owner ruling 8) brings the pre-existing RECURSIVE walk no-echo gap in scope as a
conscious ride-along — this REQ was previously silent on failures below the walk root.)

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

(Dated correction, 2026-07-28, ruling-6 umbrella, design V2 verification against
`walk.ts:61-69`: marker corrected from `[red-today]` to `[preservation-pin]` —
`rootReadFailure`'s generic non-ENOENT/ENOTDIR arm already exists and is green today;
only this scenario's TEST is new, not the behaviour. No normative text changes.)

- GIVEN a `from` that exists and is a directory but cannot be read for another reason
  (e.g. an injected EACCES permission-denied seam)
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never a raw `EACCES` `Error`, never the absolute filesystem
  path

#### Scenario REQ-FSC-10.4: Recursive walk read failure below the root rejects AuthoringError, package-relative path only [red-today]

- GIVEN a walk subtree containing a subdirectory that raises `EACCES` on `readdirSync`
  during recursive enumeration — and, as a second case, an entry that is deleted between
  `readdir` and `lstat` (a TOCTOU race surfacing an ENOENT mid-walk)
- WHEN `scaffold` walks the tree
- THEN each failure surfaces as `AuthoringError` (reason `invalid-input`) naming ONLY the
  package-relative path of the offending subdirectory/entry — never a raw Node error,
  never an absolute filesystem path — reusing the SAME `rootReadFailure` mapping the walk
  ROOT already uses, not a second, parallel implementation

### REQ-FSC-11: Degenerate `from` Rejects — the Package Root Is Never an Implicit Walk Target (owner ruling 17, 2026-07-29)

A `from` that resolves to `packageDir` itself — the literal forms `""`, `"."`, or `"./"` —
MUST reject `AuthoringError` (reason `invalid-input`) naming the literal `from` value,
rather than walking the entire package. None of these three forms contain a `..` segment
or an absolute path, so `ir-path-well-formedness` REQ-IPF-01's lexical screen does not
catch them; this is a DISTINCT, `scaffold`-specific check, same posture as the
walk-ROOT symlink rejection (ruling 16, REQ-FSC-09.3) — an author who legitimately wants a
whole-package mirror must still name a real subfolder, never rely on an implicit
degenerate form.

#### Scenario REQ-FSC-11.1: A degenerate `from` rejects instead of enumerating the whole package [red-today]

- GIVEN `from` is `""`, `"."`, or `"./"` — each resolving to `packageDir` itself
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming the literal `from`
  value — never a silent walk of the entire package

## MODIFIED Requirements

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

(Previously: this REQ derived symlinked-directory non-descent from "uniform with
`package-root-containment` REQ-PRC-04's no-descent rule," including the specific case of
"one whose target resolves INSIDE the containment ceiling." `package-root-containment`
is retired and the ceiling concept no longer exists — there is nothing for a symlink's
target to be "inside" or "outside" of at this layer. The rationale rewrites to
enumeration-determinism/cycle-safety, and the entry-count bound's rationale rewrites
from a bare "resource guard" to the more precise loop-safety/DoS framing — the RULE
itself (never descend; 10,000-entry cap) is UNCHANGED, only its stated reason.)

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

#### Scenario REQ-FSC-09.3: A symlinked walk ROOT rejects, never followed or silently skipped (ruling 16, 2026-07-29) [red-today]

- GIVEN `from` itself is a symlinked directory (whether its target resolves inside or
  outside the package)
- WHEN scaffolded
- THEN it rejects `AuthoringError` (reason `invalid-input`) naming only the
  package-relative `from` — never the absolute filesystem path, never a silent skip, and
  never a transparently-followed read of the target's content

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation) | REQ-FSC-04, REQ-FSC-08, REQ-FSC-09, REQ-FSC-10, REQ-FSC-11 | Yes — label drops "containment": this family's guards are loop-safety, collision-safety, and no-echo hygiene, never a containment boundary |
| public-api (contract) | REQ-FSC-01, REQ-FSC-06, REQ-FSC-07 (unchanged) | Yes |
