# Proposal: SDK Plain-Error Note

**Change**: `sdk-plain-error-note`
**Triage**: M (sensitivity override — disclosure control)
**Mode**: Merged (proposal + spec, one signature)

## Intent

A schematic factory's descriptive `throw new Error(...)` is currently discarded by the
runner's terminal catch: only `AuthoringError`/`TransportFault`/`IntentRejectedError`
messages survive; any other throw is replaced with the literal `"run failed"`
(`src/transport/runner.ts:340-343`). Workbench-01 measured this directly — a 30-second
CRLF fix cost 6-8 minutes of blind diagnosis because the actionable message never left
the process. This change widens the terminal catch so a plain `Error`'s message reaches
the operator through the existing sentinel, while keeping the disclosure-safety
guarantees (REQ-WPS-07) intact for the newly-admitted, uncurated content class.

## Scope

### In Scope
- Widen `runner.ts`'s terminal-catch ternary so any `Error` instance's `.message` — not
  only the three curated classes — reaches the note through the existing
  `note()`/`boundMessage()` cap discipline.
- Deterministic, non-leaking fallback for non-`Error` thrown values (no `.message`).
- Best-effort absolute-path scrub (POSIX and Windows shapes) applied to the uncurated
  message before `boundMessage()`, mirroring `toProjectRelativePath`'s fallback rule.
- REQ-WPS-07 addendum documenting the widened content class and its residual risk.
- Regression pin for the three curated classes and for cap discipline.
- Tests closing the confirmed gap: no existing test scans this path for leaked absolute
  paths.

### Out of Scope
- Exit-code reclassification (deferred: `sdk-failure-attribution`).
- Filesystem writes / log files (deferred: `error-observability-log-sink`).
- Stack traces in the note (OQ-3 resolved: message only).
- Wire frame protocol / SEAM-01 shape changes.
- A structurally distinct sentinel for curated vs. uncurated messages (rejected at
  explore — would break SEAM-01's already-pinned single-sentinel interface).
- General secret redaction beyond absolute-path shapes (owned downstream by the parent
  program's CLI-side leak-scan extension, SC-3).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `pbuilder-runner-bin`: adds a requirement for the terminal catch's note content when
  the thrown value is an uncurated `Error` or a non-`Error` value (REQ-RUN-09, ADDED).
- `wire-protocol-spec`: REQ-WPS-07 gains a documented-exception addendum for the
  newly-admitted uncurated content class (MODIFIED).

## Approach

Collapse the terminal catch's 3-branch `instanceof` ternary so it checks `err instanceof
Error` instead of the three curated subclasses: any `Error`'s `.message` flows through;
a non-`Error` throw keeps today's literal `"run failed"` fallback (no `String(err)`
coercion, which could leak an object's hostile `.toString()` or silently produce
`"undefined"`). Zero new sentinel shape, zero new cap logic — `note()`/`boundMessage()`
are called exactly as they are today; SEAM-01's one-line `pbuilder-runner:
<boundMessage(...)>\n` interface is unchanged.

Before composing the note, the uncurated message is passed through a new best-effort
scrubber in `error-text.ts` that finds absolute-path-shaped substrings (POSIX `/...` and
Windows `C:\...`/`C:/...`) and replaces each with its project-relative form or the
`<outside-project>` placeholder — mirroring `formatRelativeCandidate`'s fallback rule,
but operating on free-text rather than one known path value (that's genuinely new
matching logic; everything else reuses the existing pipeline verbatim). The scrubber is
explicitly diagnostics-preserving best-effort, not a security boundary: non-path-shaped
secret content an author's own code interpolates into a message (e.g. an env-var value)
is not detected and passes through bounded but unscrubbed — this residual is documented
in the REQ-WPS-07 addendum and pinned by a negative test, not silently accepted.

This is the only approach exploration found compatible with SEAM-01's pinned interface
and the parent contract's own mitigation layering (CLI-side leak-scan lives downstream,
per `docs/error-observability-contract.md` Seam 1) — see `explore.md` for the two
rejected alternatives (a text scanner as a separate new pattern; a distinct sentinel per
content class).

**Stated premise (sequencing, human-decided, not reopened here)**: `/build` for this
change is BLOCKED until `runner-tripwire-invariants` lands on `main` (it pins
`dist/runner-manifest.json` against the current `runner.ts` build; any `runner.ts` edit
before it lands invalidates that pin — triage-confirmed real collision). Planning
proceeds; apply does not, until that change lands or its owner explicitly re-baselines
the manifest hash. Likewise, the agent-visible egress for this widened content class
only fully opens once the parent program's CLI-side leak-scan extension (Seam 1, SC-3)
lands — this SDK change is safe to ship stderr-only ahead of that, but the end-to-end
disclosure mitigation is satisfied by the program's serialized rollout, not by this
change alone.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/transport/runner.ts` | Modified | widen the terminal-catch ternary (lines 340-343) |
| `src/transport/error-text.ts` | Modified | add the best-effort absolute-path scrubber |
| `src/transport/exit-codes.ts` | Read-only | confirmed exit-4 fallback stays untouched |
| `src/bin/pbuilder-runner.ts` | Read-only | confirmed distinct, out-of-scope swallow point |
| `test/transport/runner.unit.test.ts` | Modified | ternary + fallback + cap coverage |
| `test/fake/exit-matrix.e2e.test.ts` | Modified | case (d) gets a stderr-content assertion |
| `test/security/canary-no-echo.test.ts` (or new file) | Modified/New | closes the confirmed leak-scan coverage gap |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Byte-neutrality collision with `runner-tripwire-invariants`'s pinned manifest | Medium | `/build` blocked until it lands or its owner re-baselines (stated premise above; human-owned) |
| Residual disclosure: non-path-shaped secrets in author-thrown messages pass through unscrubbed | Low-Medium | Documented in the REQ-WPS-07 addendum as accepted residual; pinned by a negative test; defense-in-depth via downstream CLI leak-scan (parent program SC-3); explicitly NOT closed at this layer |
| Scrub false-negative on exotic path shapes (UNC, URL-encoded) beyond POSIX/Windows drive-letter forms | Low | Out of scope by explicit documentation, not silently missed; today's code leaks zero plain-Error content, so this change is what introduces the residual — the addendum records that honestly |
| Regression on curated-class message routing | Low | Byte-identical regression test (REQ-RUN-09.3) |

## Rollback Plan

Revert: the two commits touching `src/transport/runner.ts` (ternary widen) and
`src/transport/error-text.ts` (scrubber) via `git revert`, plus their test commits. No
migration, no persisted state, no filesystem writes are introduced — the change is
confined to in-process stderr text composed at failure time. Nothing needs to stay
forward-compatible; a clean revert restores the literal `"run failed"` fallback exactly.
No user-entered data exists in this change's window to lose. Validate the rollback by
re-running `test/fake/exit-matrix.e2e.test.ts` case (d): the crash-fixture stderr note
returns to `pbuilder-runner: run failed`, and the WPS-07 addendum scenarios revert to
not-applicable (no uncurated content ever reaches the note).

## Dependencies

- `runner-tripwire-invariants` (L, plan-complete, owner-ready to `/build`) — sequencing
  dependency; must land first, or its owner must explicitly re-baseline
  `dist/runner-manifest.json` after this change merges. Human/orchestrator decision,
  already made: do not interleave.
- Parent program `error-observability-contract` Seam 1, SC-3 (CLI-side leak-scan
  extension) — downstream dependency for the full disclosure-mitigation story; not a
  blocking gate for this repo's own `/build`.

## Success Criteria

- [ ] `bun test` green for all REQ-RUN-09 and REQ-WPS-07 (addendum) scenarios, written
      test-first per Strict TDD
- [ ] `test/fake/exit-matrix.e2e.test.ts` case (d) asserts the stderr note contains the
      thrown error's message, not the literal `"run failed"`
- [ ] A new test asserts a POSIX absolute path is ABSENT from the composed note after a
      filesystem-`Error`-throwing schematic; a second asserts the same for a Windows-shaped
      path
- [ ] A new test asserts secret-shaped, non-path content passes through bounded and
      unmodified — pinning the documented residual (REQ-WPS-07.5)
- [ ] Curated-class regression test (`AuthoringError`/`TransportFault`/
      `IntentRejectedError`) passes with a byte-identical note to current behavior
- [ ] Exit code for a plain `Error` stays 4 — asserted, not reclassified
- [ ] `tsc --noEmit` green; no `src/`/`dist/` change lands against `main` until the
      sequencing premise (Dependencies, above) is satisfied

## Caveats from Exploration

Exploration returned `ready_for_proposal: partial` with four open questions. Each is
addressed here, not silently inherited:

- **OQ (product) — WPS-07 documented-exception vs. active scrub**: resolved by decision:
  scrub (best-effort, absolute-path shapes only) + documented residual. Captured as the
  REQ-WPS-07 addendum (Modified Capabilities) and Risks row above.
- **OQ (product) — sequencing with `runner-tripwire-invariants`**: resolved by decision:
  `/build` for this change stays blocked until that change lands or its manifest is
  re-baselined; recorded as a stated premise (Approach) and a Dependency.
- **OQ (technical) — non-`Error` fallback shape**: resolved by decision: keep the
  current literal `"run failed"` for non-`Error` throws — no `String(err)` coercion.
  Captured as REQ-RUN-09.2.
- **OQ (technical) — add the missing leak-scan/canary coverage on this path**: resolved
  by decision: yes, added as part of this change's own scope (Success Criteria, Affected
  Areas), independent of the scrub-vs-cap-only question since that question closed in
  favor of scrub.

## Requirements

**Spec version**: V2
**Status**: signed — 2026-08-01 (V2: +REQ-WPS-07.6 UNC/WSL closure, re-signed via recorded user decision)
**Change**: `sdk-plain-error-note`

### Domain: pbuilder-runner-bin (ADDED)

#### REQ-RUN-09: Terminal Catch Surfaces Any Thrown Value's Message Through the Existing Note Discipline (NEW)

The runner's terminal catch (`runRunnerBody`, `src/transport/runner.ts`) MUST surface
the `.message` of ANY thrown value that is an `Error` instance — not only
`AuthoringError`/`TransportFault`/`IntentRejectedError` — through the existing
`pbuilder-runner: ` sentinel and `note()`/`boundMessage()` cap discipline, scrubbed per
REQ-WPS-07's uncurated-content-class addendum. A thrown value that is NOT an `Error`
instance (no `.message` property) MUST fall back to the fixed literal `"run failed"` —
unchanged from today — never a stringified coercion of the thrown value. Exit-code
classification (`classifyExitCode`) is UNCHANGED by this requirement: a plain `Error`
still classifies as exit 4.

##### Scenario REQ-RUN-09.1: Plain Error's message reaches the note
- GIVEN a schematic factory throws a plain `Error("Could not locate the imports array closing in src/app.module.ts")` during `run(...)`
- WHEN the terminal catch handles it
- THEN the stderr note is `pbuilder-runner: Could not locate the imports array closing in src/app.module.ts` (scrubbed/bounded per REQ-WPS-07) and the process exit code is 4

##### Scenario REQ-RUN-09.2: Non-Error thrown value keeps the fixed fallback literal
- GIVEN a schematic factory throws a non-`Error` value (e.g. `throw "x"` or `throw 42`) during `run(...)`
- WHEN the terminal catch handles it
- THEN the stderr note is `pbuilder-runner: run failed` — unchanged from current behavior, never `"undefined"` or a stringified coercion of the thrown value

##### Scenario REQ-RUN-09.3: Curated classes stay byte-identical (regression pin)
- GIVEN a schematic factory throws an `AuthoringError`, `TransportFault`, or `IntentRejectedError` with a known message
- WHEN the terminal catch handles it
- THEN the composed stderr note is byte-identical to the note produced before this change (`pbuilder-runner: <that message>`) — no change in curated-class behavior

##### Scenario REQ-RUN-09.4: Cap discipline applies to the whole composed note
- GIVEN a plain Error's message, once scrubbed, is long enough that the composed note (`pbuilder-runner: ` prefix + scrubbed message) exceeds `MESSAGE_CEILING_CHARS`
- WHEN `note()` writes it to stderr
- THEN the written text is truncated to the existing 2000-character ceiling via the unchanged `boundMessage()` — no new cap logic is introduced

### Domain: wire-protocol-spec (MODIFIED)

#### REQ-WPS-07: Bounded, No-Echo, Project-Relative Error Text

Any error text that crosses the wire or is written to stderr MUST be bounded to a
documented length ceiling (default 2000 characters — an SDK-chosen placeholder pending
engine-side confirmation, same provenance posture as SEC-05's timeout bound and WPS-06's
`BATCH_CAP_BYTES`), MUST NOT echo raw host/engine internals verbatim (C9) —
operationally: no stack frames, no absolute filesystem paths, no module source excerpts,
and never raw peer frame bytes — and MUST express every path as project-relative, never
absolute. The length ceiling applies to the WHOLE message INCLUDING any echoed
identifier (an echoed token, e.g. an unrecognized flag name, is truncated to a documented
per-token max of 200 characters before composition — names surface, values never,
matching `bin/pbuilder-codegen.ts:134`'s precedent). When the subject path lies outside
the project root (as identified by `relativeDir`, `src/core/context.ts:113`), the
project-relative form MUST be expressed as a `../`-relative path, or — when no relative
form can be constructed (e.g. a different filesystem root) — the documented placeholder
token `<outside-project>` MUST be substituted; the runner MUST NEVER fall back to
printing the absolute path.

**Uncurated content class addendum (this change)**: the runner's terminal-catch fallback
branch (`src/transport/runner.ts`, previously the literal `"run failed"` for any
non-curated throw — see REQ-RUN-09) now ALSO surfaces a plain `Error`'s `.message`
through this same discipline. Because that content is host/library-authored rather than
SDK-author-curated, it MAY embed absolute filesystem paths (e.g. a Node built-in `fs`
throw). The runner MUST apply a best-effort scrub of absolute-path-shaped substrings
embedded anywhere in that free-text message — POSIX (`/...`), Windows drive-letter
(`C:\...`/`C:/...`), and UNC/WSL-interop backslash-prefixed (`\\server\share\...`,
`\\wsl.localhost\...`, `\\wsl$\...`) shapes — to their project-relative form or the
`<outside-project>` placeholder before composing the note, mirroring
`toProjectRelativePath`'s fallback rule (UNC/WSL shapes route unconditionally to
`<outside-project>`, the same fail-safe direction as the Windows-drive-letter case —
ADR-02). This scrub is diagnostics-preserving best-effort, NOT itself a security boundary:
non-path-shaped secret content that an author's own code interpolates into a thrown
message (e.g. an env-var value) is NOT detected or redacted by this scrub and MAY reach
stderr bounded but otherwise verbatim — this is a DOCUMENTED residual risk, mitigated in
depth by the downstream CLI-side leak-scan extension (parent contract
`docs/error-observability-contract.md` Seam 1, `Test_ERR41_1`), not closed at this
layer. Non-`Error` thrown values (no `.message`) are unaffected — see REQ-RUN-09.2.
(Previously: no numeric ceiling, no echoed-token rule, and no rule for paths outside the
project root — M2, B4. This change adds the uncurated-content-class scrub-and-accept-
residual addendum for the runner's terminal-catch fallback branch.)

##### Scenario REQ-WPS-07.1: Error text is bounded and project-relative
- GIVEN an import/run/parse failure produces an error message
- WHEN it is written to stderr or embedded in a wire error frame
- THEN the message is under the documented 2000-character ceiling and contains no absolute filesystem path

##### Scenario REQ-WPS-07.2: Realpath outside the project root never falls back to absolute (B4)
- GIVEN an error message's subject path resolves outside the project root (per `relativeDir`)
- WHEN the error text is composed
- THEN the path is expressed as a `../`-relative path, or — if no relative form exists — the placeholder token `<outside-project>` — never the absolute path

##### Scenario REQ-WPS-07.3: Echoed identifier truncated within the ceiling
- GIVEN an error message echoes a host-controlled identifier (e.g. an unrecognized argv flag, or a malformed export name) longer than 200 characters
- WHEN the message is composed
- THEN the echoed token is truncated to the documented 200-character per-token max, and the total message still stays under the 2000-character ceiling

##### Scenario REQ-WPS-07.4: Uncurated plain-Error message scrubbed of absolute paths (POSIX and Windows shapes)
- GIVEN a plain `Error` thrown from schematic execution carries a `.message` embedding an absolute filesystem path — POSIX form (e.g. `ENOENT: no such file, open '/home/user/project/missing.json'`) or Windows form (e.g. `C:\Users\dev\project\missing.json`)
- WHEN the terminal catch composes the stderr note
- THEN the composed note does NOT contain the absolute-path substring in either form — it is scrubbed to project-relative form or the `<outside-project>` placeholder

##### Scenario REQ-WPS-07.5: Secret-shaped non-path content passes through bounded, unscrubbed (documented residual)
- GIVEN a plain `Error`'s `.message` embeds secret-shaped content that is not path-shaped (e.g. an author's code interpolates `DB_PASSWORD=hunter2` into a thrown message)
- WHEN the terminal catch composes the stderr note
- THEN the secret-shaped content passes through into the note UNMODIFIED, bounded only by the existing 2000-character ceiling — this pins the current documented contract, so a future change to it is deliberate, not an accidental regression

##### Scenario REQ-WPS-07.6: UNC and WSL-interop path shapes scrubbed (backslash-prefixed)
- GIVEN a plain `Error` thrown from schematic execution carries a `.message` embedding a UNC or WSL-interop path shape — e.g. `\\server\share\project\config.json`, `\\wsl.localhost\Ubuntu\home\user\project\file.ts`, or `\\wsl$\Ubuntu\home\user\project\file.ts`
- WHEN the terminal catch composes the stderr note
- THEN the composed note does NOT contain the UNC/WSL-shaped substring — it is scrubbed to the `<outside-project>` placeholder, via the same unconditional route as ADR-02's Windows-drive-letter rationale
