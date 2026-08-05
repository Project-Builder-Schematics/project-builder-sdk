# Delta for pbuilder-runner-bin

**Spec version**: V1
**Status**: signed — 2026-08-01
**Change**: `sdk-plain-error-note`

## ADDED Requirements

### REQ-RUN-09: Terminal Catch Surfaces Any Thrown Value's Message Through the Existing Note Discipline (NEW)

The runner's terminal catch (`runRunnerBody`, `src/transport/runner.ts`) MUST surface
the `.message` of ANY thrown value that is an `Error` instance — not only
`AuthoringError`/`TransportFault`/`IntentRejectedError` — through the existing
`pbuilder-runner: ` sentinel and `note()`/`boundMessage()` cap discipline, scrubbed per
REQ-WPS-07's uncurated-content-class addendum (`wire-protocol-spec`). A thrown value
that is NOT an `Error` instance (no `.message` property) MUST fall back to the fixed
literal `"run failed"` — unchanged from today — never a stringified coercion of the
thrown value. Exit-code classification (`classifyExitCode`) is UNCHANGED by this
requirement: a plain `Error` still classifies as exit 4.

#### Scenario REQ-RUN-09.1: Plain Error's message reaches the note
- GIVEN a schematic factory throws a plain `Error("Could not locate the imports array closing in src/app.module.ts")` during `run(...)`
- WHEN the terminal catch handles it
- THEN the stderr note is `pbuilder-runner: Could not locate the imports array closing in src/app.module.ts` (scrubbed/bounded per REQ-WPS-07) and the process exit code is 4

#### Scenario REQ-RUN-09.2: Non-Error thrown value keeps the fixed fallback literal
- GIVEN a schematic factory throws a non-`Error` value (e.g. `throw "x"` or `throw 42`) during `run(...)`
- WHEN the terminal catch handles it
- THEN the stderr note is `pbuilder-runner: run failed` — unchanged from current behavior, never `"undefined"` or a stringified coercion of the thrown value

#### Scenario REQ-RUN-09.3: Curated classes stay byte-identical (regression pin)
- GIVEN a schematic factory throws an `AuthoringError`, `TransportFault`, or `IntentRejectedError` with a known message
- WHEN the terminal catch handles it
- THEN the composed stderr note is byte-identical to the note produced before this change (`pbuilder-runner: <that message>`) — no change in curated-class behavior

#### Scenario REQ-RUN-09.4: Cap discipline applies to the whole composed note
- GIVEN a plain Error's message, once scrubbed, is long enough that the composed note (`pbuilder-runner: ` prefix + scrubbed message) exceeds `MESSAGE_CEILING_CHARS`
- WHEN `note()` writes it to stderr
- THEN the written text is truncated to the existing 2000-character ceiling via the unchanged `boundMessage()` — no new cap logic is introduced
