# Design: SDK Plain-Error Note

**Change**: `sdk-plain-error-note`
**Spec**: signed 2026-08-01 (V2: REQ-RUN-09, REQ-WPS-07 addendum +07.6 UNC/WSL closure)
**Triage**: M (sensitivity override — disclosure control)

## 4.1 — Architecture Overview

The runner's terminal catch (`runRunnerBody`, `src/transport/runner.ts:332-346`) currently
picks the stderr note text via a 3-branch `instanceof` ternary: curated classes
(`AuthoringError`/`TransportFault`/`IntentRejectedError`) surface `.message`, everything
else collapses to the literal `"run failed"`. This design widens that ternary to a
4-branch shape: curated classes stay byte-identical; any OTHER `Error` instance now
surfaces its `.message`, scrubbed of absolute-path-shaped substrings; a non-`Error` throw
keeps the literal fallback. The scrub is a new pure function in `src/transport/error-text.ts`
— the module architecture.md already names as the single owner of transport error-text
logic — reusing the existing `toProjectRelativePath`/`formatRelativeCandidate` pipeline as
its per-match formatter. `note()`/`boundMessage()` are called exactly as today; SEAM-01's
composed-note shape (`pbuilder-runner: <text>\n`) is unchanged.

## 4.1b — Pattern Check

1. No established project pattern covers "find path-shaped substrings anywhere in free
   text" — `toProjectRelativePath` only formats a single already-known path value.
2. The problem's shape does not match a named design/architectural pattern — it is a
   linear regex-scan-and-replace over one string.
3. → simplest structure that satisfies the REQ-IDs: one new function, two regexes, reusing
   the existing formatter. **Pattern**: none — simplest structure (the new-abstraction ADR
   trigger is covered by ADR-01, below).

## 4.2 — File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/transport/runner.ts` | Modify | Widen the terminal-catch ternary (lines 340-343) to 4 branches: curated classes unscrubbed → uncurated `Error` scrubbed → non-`Error` fixed fallback. Import `scrubAbsolutePaths`. |
| `src/transport/error-text.ts` | Modify | Add `scrubAbsolutePaths(message, projectRoot?)`: Windows-drive-shaped or UNC/WSL backslash-prefixed matches → `OUTSIDE_PROJECT_TOKEN` unconditionally; POSIX multi-segment matches → `toProjectRelativePath(match, projectRoot)`. No change to existing exports. |
| `test/transport/error-text.unit.test.ts` | Modify | Pure-function coverage for `scrubAbsolutePaths`: POSIX match+replace, Windows match+replace, UNC/WSL backslash-prefixed match+replace, `file://`-embedded absolute-path passthrough (07.4's existing promise), secret-shaped non-path passthrough, ordering (Windows/UNC-first) proof. |
| `test/transport/runner.unit.test.ts` | Modify | New `REQ-RUN-09` describe block: 09.1 (plain-Error message reaches note), 09.2 (non-Error fixed fallback), 09.3 (curated regression ×3), 09.4 (cap discipline on the composed note), plus the WPS-07.5 in-process residual pin. |
| `test/fake/exit-matrix.e2e.test.ts` | Modify | Case (d) gains a stderr-content assertion (the crash fixture's message, not `"run failed"`); new canary-seeded describe block spawning the real runner bin against `canary-path-leak` and `unc-path-leak` to prove POSIX, Windows, and UNC/WSL absolute-path canaries never reach stderr raw. |
| `test/fixtures/frame-runner/{plain-error,throw-non-error,curated-authoring,curated-transport,curated-intent,long-plain-error,secret-error,canary-path-leak,unc-path-leak}/factory.ts` | Create | 9 tiny single-purpose fixtures (one behavior each, matching the existing `happy`/`collide`/`crash`/`sabotage` convention), detailed per-REQ in the Test Derivation table below. `unc-path-leak` mirrors `canary-path-leak`'s shape but seeds a UNC/WSL-shaped canary (`\\server\share\...` / `\\wsl.localhost\...`) instead of a POSIX/Windows-drive one. |

No `dist/`/build files change. No file outside `src/transport/` and `test/` is touched.

## 4.2b — Flow Changes

Not applicable — no user-facing CLI/API surface changes (carried from explore: this is a
stderr text enrichment inside an already-existing failure path — same command, same exit
codes, richer message).

## 4.2c — Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/transport/` cluster — `runner.ts` terminal catch | modify | widen the 4-branch ternary to admit any `Error`'s scrubbed message | aligns |
| `src/transport/error-text.ts` (WPS-07 module) | extend | add `scrubAbsolutePaths`, reusing the module's own `toProjectRelativePath`/`formatRelativeCandidate` — matches architecture.md's "every transport error message routes through `error-text.ts`" convention | aligns |

No new component, no new layer, no new dependency, no boundary crossing — both rows extend
an existing baseline component with `aligns`. Consistent with explore's own Architecture
Touchpoints table (same two rows, same verdict).

## 4.3 — Data Model

No data model changes. `scrubAbsolutePaths` is a pure `string → string` transform; no new
types beyond its signature (§4.4).

## 4.4 — Interface Contracts

SEAM-01's composed note shape is UNCHANGED: `pbuilder-runner: <text>\n`, written to stderr
only, never the wire. What changes is which `<text>` values are admissible (any `Error`'s
message, not just the three curated classes) and that uncurated text is pre-scrubbed.

```ts
// src/transport/error-text.ts — new export, alongside the existing WPS-07 surface
export function scrubAbsolutePaths(message: string, projectRoot?: string): string;
```

Illustrative (not final) matching shape — sdd-apply pins exact behavior via Strict TDD:

```
WINDOWS_UNC_ABS_PATH = /(?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|\\\\)[^\s'"<>]*/g   // drive-letter OR UNC/WSL backslash-prefix — replaced FIRST, always → OUTSIDE_PROJECT_TOKEN
POSIX_ABS_PATH        = /\/(?:[^\s'"<>]+\/)+[^\s'"<>]*/g       // replaced SECOND, via toProjectRelativePath per match
```

The POSIX pattern requires at least two `/`-delimited segments (leading `/` + ≥1 more) so a
lone slash inside prose (`and/or`, `24/7`) is never mistaken for a path root — a documented,
deliberate under-match, consistent with "best-effort, not a security boundary." The
`WINDOWS_UNC_ABS_PATH` alternation's second branch (`\\`) matches the literal double-backslash
prefix shared by UNC (`\\server\share\...`) and WSL-interop (`\\wsl.localhost\...`, `\\wsl$\...`)
paths — never a single escaped backslash inside prose.

The drive-letter branch carries a negative lookbehind because a bare `[A-Za-z]:[\\/]` also matches
the `e:/` inside `file:///home/user/x.json`, which would consume the whole URL and mangle the message
to `fil<outside-project>`. That URL's embedded absolute segment belongs to `POSIX_ABS_PATH`; the
lookbehind requires the drive letter not to be preceded by a word character, so the two passes keep
the ownership boundary stated below. It applies to the drive-letter branch only — a UNC prefix has no
such ambiguity. Cost: a drive-letter path glued directly to a preceding word character with no
delimiter (`abcC:/x`) is not matched; no REQ-WPS-07 scenario requires that shape.

Both branches route unconditionally to
`OUTSIDE_PROJECT_TOKEN` for the same reason: `node:path`'s POSIX-default `isAbsolute`/`relative`
cannot correctly classify a drive-letter- or backslash-prefixed path on this SDK's POSIX hosts,
so computing a relative form would risk silently misclassifying it instead of failing safe
(ADR-02).

`runner.ts`'s widened ternary (illustrative):

```ts
const label =
  err instanceof AuthoringError || err instanceof TransportFault || err instanceof IntentRejectedError
    ? err.message
    : err instanceof Error
      ? scrubAbsolutePaths(err.message)
      : "run failed";
```

No new error taxonomy identity, no new exit-code mapping — `classifyExitCode` is untouched
(REQ-RUN-09's own text).

**Security demands, cited to where they land in this design**:
- *Scrub applied BEFORE `boundMessage()`, message-only (no stack)*: `scrubAbsolutePaths`
  runs on `err.message` (a string, never `err.stack`) to produce `label`; `note()` then
  applies `boundMessage()` to the COMPOSED `pbuilder-runner: ${label}` string exactly as
  today (§4.1, §4.2 row 1) — the cap discipline is unchanged and always runs LAST.
- *Not a security boundary*: stated explicitly in ADR-01/ADR-02 Consequences and in the
  signed proposal/spec's REQ-WPS-07 addendum — this design does not claim otherwise
  anywhere.
- *Negative tests assert content presence/absence, not just "no crash"*: every row in
  §4.6 for WPS-07.4/.5 and RUN-09.3 asserts on stderr TEXT CONTENT (`toContain`/
  `not.toContain`/byte-equality), never merely an exit-code or "did not throw" check.
- *Curated-class regression pin is byte-exact*: REQ-RUN-09.3's three fixtures assert the
  composed note equals `err.message` verbatim, unscrubbed — no partial-match assertion.
- *`--input-file`/terminal-catch scrub sharing*: ADR-01 — both call sites route their
  per-match formatting through the SAME `toProjectRelativePath`; only the outer shape
  differs (one known value vs. free-text scan), which is the justified, minimal divergence
  the two use cases actually require.

## 4.5 — Architecture Decisions

### ADR-01: The scrub function lives in `error-text.ts` and reuses `toProjectRelativePath` as its per-match formatter

**Status**: Proposed

**Context**: REQ-WPS-07's addendum requires scrubbing absolute-path-shaped substrings from
an uncurated `Error`'s free-text message before composing the note. The codebase already
has `toProjectRelativePath`/`formatRelativeCandidate` in `error-text.ts`, used today by
`resolveInput`'s `--input-file` ENOENT branch (`runner.ts:107-112`) to format ONE known
path value. The new need is different in kind: finding path-shaped substrings anywhere in
arbitrary prose, not formatting one already-known value. architecture.md's own convention:
"every transport error message routes through `error-text.ts`."

**Decision**: add `scrubAbsolutePaths` to `error-text.ts`. For each POSIX-shaped match it
found, it calls the EXISTING `toProjectRelativePath` — the same formatter the
`--input-file` site already calls on its one known value — so the two call sites (structured
single-value formatting vs. free-text scan-and-replace) share ONE underlying formatter, not
two divergent implementations.

**Consequences**:
- One scrub implementation, matching the project's own routing convention; no new file.
- The `--input-file` site and the terminal-catch site provably agree on HOW a path becomes
  project-relative — divergence there would be a real correctness risk this avoids.
- The free-text regex scan is inherently heuristic (documented residual, not new: exotic
  shapes like UNC or URL-encoded paths are out of scope, per the proposal).

**Alternatives Considered**:
- **Put the scrubber in `runner.ts`**: rejected — forks architecture.md's single-owner
  convention for transport error text, for no benefit.
- **A general-purpose text-scanning module (`src/transport/leak-scan.ts`)**: rejected —
  over-built for one call site and one content class; explore already rejected the heavier
  "text scanner as a separate new pattern" approach at exploration depth.

### ADR-02: Windows and UNC/WSL-shaped path matches always substitute `<outside-project>`, never a computed relative form

**Status**: Proposed

**Context**: `toProjectRelativePath` delegates to `node:path`'s `isAbsolute`/`relative`,
which are PLATFORM-DEFAULT (POSIX semantics on this SDK's Bun/POSIX hosts).
`path.isAbsolute("C:\\Users\\...")` is `false` under POSIX semantics, so naively feeding a
Windows-shaped match through the existing formatter would silently misclassify it as a
relative fragment instead of raising the `<outside-project>` fallback — a partial-leak risk
on exactly the class of input REQ-WPS-07.4 exists to close. UNC (`\\server\share\...`) and
WSL-interop (`\\wsl.localhost\...`, `\\wsl$\...`) shapes fail the exact same way under POSIX
`isAbsolute`/`relative` — same misclassification risk, same closure need (REQ-WPS-07.6).

**Decision**: any Windows-drive-letter-shaped OR UNC/WSL backslash-prefixed match is
unconditionally replaced with `OUTSIDE_PROJECT_TOKEN`, never passed through
`toProjectRelativePath` — both shapes are the two alternation branches of the SAME
`WINDOWS_UNC_ABS_PATH` regex (§4.4), so they always run in the same pass, BEFORE the
POSIX pass. A forward-slash Windows form (`C:/Users/...`) or a backslash-prefixed UNC/WSL
form is fully consumed first and never partially re-matched by the POSIX regex.

**Consequences**:
- Never misclassifies a Windows, UNC, or WSL-interop path as project-relative on a POSIX
  host.
- A genuinely in-project Windows-style or UNC/WSL-style path (only possible if this SDK ran
  on a Windows/WSL host with a matching-shaped project root) always renders as
  `<outside-project>` rather than a true relative form — an accepted precision loss,
  consistent with "best-effort, diagnostics-preserving, not a security boundary."

**Alternatives Considered**:
- **Use `path.win32.*` for Windows matches, `path.posix.*` for POSIX ones**: rejected for
  this M — correct in principle but requires resolving which flavor `projectRoot` itself
  is, for a scenario (this SDK running on Windows AND leaking an in-project Windows path)
  that is not the reported problem (Workbench-01 was POSIX) and not in scope; revisit if a
  real Windows-hosted leak is reported.
- **Skip Windows matching entirely**: rejected — REQ-WPS-07.4 explicitly requires it.
- **Skip UNC/WSL matching entirely**: rejected — REQ-WPS-07.6 explicitly requires it; the
  same security-review finding that motivated ADR-02's Windows-drive rule applies
  identically to UNC/WSL backslash-prefixed shapes.

## 4.6 — Test Derivation

| REQ-ID | Scenario (G/W/T ref) | Level | Test (name/path) | Flow ref |
|---|---|---|---|---|
| REQ-RUN-09.1 | Plain Error's message reaches the note | unit | `runner.unit.test.ts` — new fixture `plain-error` (message: exact spec literal, no path), asserts stderr equals `pbuilder-runner: <message>\n` | — |
| REQ-RUN-09.2 | Non-Error throw keeps fixed fallback | unit | `runner.unit.test.ts` — new fixture `throw-non-error` (`throw "x"`), asserts stderr equals `pbuilder-runner: run failed\n`, never `"undefined"` | — |
| REQ-RUN-09.3 | Curated classes byte-identical (×3) | unit | `runner.unit.test.ts` — 3 new fixtures directly constructing+throwing `AuthoringError`/`TransportFault`/`IntentRejectedError` with a known message each (matches the spec's own GWT phrasing); asserts note is unscrubbed, byte-identical to `err.message` | — |
| REQ-RUN-09.4 | Cap discipline on the whole composed note | unit | `runner.unit.test.ts` — new fixture `long-plain-error` (message > 2000 chars after `pbuilder-runner: ` prefix), asserts `stderrText().length === MESSAGE_CEILING_CHARS + 1` (bounded text + trailing `\n`) | — |
| REQ-WPS-07.1 | Bounded + project-relative | unit | **Existing** `error-text.unit.test.ts` describe block — verified present, no change needed | — |
| REQ-WPS-07.2 | Outside-root never falls back to absolute | unit | **Existing** `error-text.unit.test.ts` describe block — verified present, no change needed | — |
| REQ-WPS-07.3 | Echoed identifier truncated | unit | **Existing** `error-text.unit.test.ts` describe block — verified present, no change needed | — |
| REQ-WPS-07.4 | Uncurated message scrubbed (POSIX + Windows) | unit | `error-text.unit.test.ts` — new cases for `scrubAbsolutePaths`: POSIX embedded match, Windows backslash + forward-slash embedded match, ordering proof | — |
| REQ-WPS-07.4 | Same, end-to-end over the real spawned bin | e2e | `exit-matrix.e2e.test.ts` — new describe block, canary-seeded (`canaryToken` from `test/support/canary.ts`), fixture `canary-path-leak` (reads `--input {canary, style}`), asserts stderr never contains the raw canary for `style: "posix"` and `style: "windows"` | — |
| REQ-WPS-07.4 | Existing promise holds for `file://`-embedded absolute paths | unit | `error-text.unit.test.ts` — `scrubAbsolutePaths("... file:///home/user/project/x.json ...")` asserts the `/home/user/project/x.json` segment is absent from the result; the embedded `/`-prefixed path is already matched by the existing `POSIX_ABS_PATH` pass — no new matching logic, this pins the promise rather than adding one | — |
| REQ-WPS-07.5 | Secret-shaped non-path content passes through unscrubbed | unit | `error-text.unit.test.ts` — `scrubAbsolutePaths("...DB_PASSWORD=hunter2...")` unchanged | — |
| REQ-WPS-07.5 | Same, wired through the terminal catch | unit | `runner.unit.test.ts` — new fixture `secret-error` (throws `Error("DB_PASSWORD=hunter2")`), asserts stderr CONTAINS `hunter2` verbatim (pins the documented residual) | — |
| REQ-WPS-07.6 | UNC/WSL path shapes scrubbed (backslash-prefixed) | unit | `error-text.unit.test.ts` — new cases for `scrubAbsolutePaths`: `\\server\share\...`, `\\wsl.localhost\...`, `\\wsl$\...` each → `OUTSIDE_PROJECT_TOKEN`, ordering proof (`WINDOWS_UNC_ABS_PATH`'s backslash-prefix branch runs before `POSIX_ABS_PATH`) | — |
| REQ-WPS-07.6 | Same, end-to-end over the real spawned bin | e2e | `exit-matrix.e2e.test.ts` — same canary-seeded describe block, new fixture `unc-path-leak` (reads `--input {canary, style}`, `style: "unc"` / `style: "wsl"`), asserts stderr never contains the raw UNC/WSL canary | — |

Additionally: `exit-matrix.e2e.test.ts` case (d) gains `expect(run.stderr).toContain("frame-runner crash fixture: author code throws mid-run")` (currently asserts only `exitCode === 4`) — closes the exact gap explore confirmed ("no existing test asserts on the fallback branch's text").

All 9 spec scenarios (RUN-09.1-.4, WPS-07.1-.6) are covered; WPS-07.1-.3 confirmed already
pinned by the existing `error-text.unit.test.ts` (read at design time, not assumed).

## 4.7 — Fitness Functions

None. No new project-wide invariant is introduced — this is one new function in one
already-owned module, called from one already-owned call site. Regression protection is
the REQ-RUN-09.3 byte-identical pin (curated classes) plus the WPS-07.4/.5 negative tests
(uncurated classes), not a structural `src/**` scanner. A dedicated numbered fitness guard
(in the `fit-NN` sequence) would be disproportionate machinery for this M's actual surface
area — revisit only if a second scrub call site is ever proposed (ADR-01's placement
decision is exactly what would need to be defended at that point).

## 4.8 — Migration / Rollout

No migration needed — no persisted state, no schema, no filesystem writes; the change is
confined to in-process stderr text composed at failure time (rollback is a straight
`git revert`, per the signed proposal's Rollback Plan).

**Sequencing premise (human-decided, not reopened here)**: `/build` for this change is
BLOCKED until `runner-tripwire-invariants` lands on `main` or its owner explicitly
re-baselines `dist/runner-manifest.json` — that change pins the manifest hash against the
current `runner.ts` build, and this design's `runner.ts` edit would invalidate a
pre-existing pin. This design and the `sdd-slice` artefact that follows it do not touch
`src/` or `dist/` — planning proceeds; apply does not, until the premise clears.

## 4.9 — Performance Considerations

No significant performance impact expected. `scrubAbsolutePaths` runs two linear regex
passes over one already-bounded-length string (an `Error.message`, realistically well under
`MESSAGE_CEILING_CHARS`), once per failed run — a failure path, not a hot path.

## 4.10 — Architecture Impact

**Architecture impact**: none
**Rationale**: both Architecture Touchpoints rows (§4.2c) are `extend` actions on existing
baseline components with verdict `aligns` — no new component, no new layer, no new
dependency, no boundary modified or removed. Consistent with 0 ADRs triggered by "new
dependency" or "pattern change" (ADR-01/02 are both "new abstraction" / "alternatives with
tradeoffs" triggers, which do not by themselves raise impact above `none` when the
abstraction stays inside an existing, already-`aligns` component).

## 4.11 — Open Questions

None. All four open questions carried forward from `explore.md` were resolved and recorded
in the signed proposal (scrub decision, sequencing decision, non-Error fallback decision,
leak-scan coverage decision) — this design implements those resolutions without reopening
them.
