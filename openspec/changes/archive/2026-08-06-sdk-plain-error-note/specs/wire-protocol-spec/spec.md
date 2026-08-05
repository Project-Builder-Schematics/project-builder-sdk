# Delta for wire-protocol-spec

**Spec version**: V2
**Status**: signed — 2026-08-01 (V2: +REQ-WPS-07.6 UNC/WSL closure, re-signed via recorded user decision)
**Change**: `sdk-plain-error-note`

## MODIFIED Requirements

### REQ-WPS-07: Bounded, No-Echo, Project-Relative Error Text

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
non-curated throw — see REQ-RUN-09, `pbuilder-runner-bin`) now ALSO surfaces a plain
`Error`'s `.message` through this same discipline. Because that content is
host/library-authored rather than SDK-author-curated, it MAY embed absolute filesystem
paths (e.g. a Node built-in `fs` throw). The runner MUST apply a best-effort scrub of
absolute-path-shaped substrings embedded anywhere in that free-text message — POSIX
(`/...`), Windows drive-letter (`C:\...`/`C:/...`), and UNC/WSL-interop backslash-prefixed
(`\\server\share\...`, `\\wsl.localhost\...`, `\\wsl$\...`) shapes — to their
project-relative form or the `<outside-project>` placeholder before composing the note,
mirroring `toProjectRelativePath`'s fallback rule (UNC/WSL shapes route unconditionally to
`<outside-project>`, the same fail-safe direction as the Windows-drive-letter case — ADR-02).
This scrub is diagnostics-preserving
best-effort, NOT itself a security boundary: non-path-shaped secret content that an
author's own code interpolates into a thrown message (e.g. an env-var value) is NOT
detected or redacted by this scrub and MAY reach stderr bounded but otherwise verbatim —
this is a DOCUMENTED residual risk, mitigated in depth by the downstream CLI-side
leak-scan extension (parent contract `docs/error-observability-contract.md` Seam 1,
`Test_ERR41_1`), not closed at this layer. Non-`Error` thrown values (no `.message`) are
unaffected — see REQ-RUN-09.2.
(Previously: no numeric ceiling, no echoed-token rule, and no rule for paths outside the
project root — M2, B4. This change adds the uncurated-content-class scrub-and-accept-
residual addendum for the runner's terminal-catch fallback branch.)

#### Scenario REQ-WPS-07.1: Error text is bounded and project-relative
- GIVEN an import/run/parse failure produces an error message
- WHEN it is written to stderr or embedded in a wire error frame
- THEN the message is under the documented 2000-character ceiling and contains no absolute filesystem path

#### Scenario REQ-WPS-07.2: Realpath outside the project root never falls back to absolute (B4)
- GIVEN an error message's subject path resolves outside the project root (per `relativeDir`)
- WHEN the error text is composed
- THEN the path is expressed as a `../`-relative path, or — if no relative form exists — the placeholder token `<outside-project>` — never the absolute path

#### Scenario REQ-WPS-07.3: Echoed identifier truncated within the ceiling
- GIVEN an error message echoes a host-controlled identifier (e.g. an unrecognized argv flag, or a malformed export name) longer than 200 characters
- WHEN the message is composed
- THEN the echoed token is truncated to the documented 200-character per-token max, and the total message still stays under the 2000-character ceiling

#### Scenario REQ-WPS-07.4: Uncurated plain-Error message scrubbed of absolute paths (POSIX and Windows shapes)
- GIVEN a plain `Error` thrown from schematic execution carries a `.message` embedding an absolute filesystem path — POSIX form (e.g. `ENOENT: no such file, open '/home/user/project/missing.json'`) or Windows form (e.g. `C:\Users\dev\project\missing.json`)
- WHEN the terminal catch composes the stderr note
- THEN the composed note does NOT contain the absolute-path substring in either form — it is scrubbed to project-relative form or the `<outside-project>` placeholder

#### Scenario REQ-WPS-07.5: Secret-shaped non-path content passes through bounded, unscrubbed (documented residual)
- GIVEN a plain `Error`'s `.message` embeds secret-shaped content that is not path-shaped (e.g. an author's code interpolates `DB_PASSWORD=hunter2` into a thrown message)
- WHEN the terminal catch composes the stderr note
- THEN the secret-shaped content passes through into the note UNMODIFIED, bounded only by the existing 2000-character ceiling — this pins the current documented contract, so a future change to it is deliberate, not an accidental regression

#### Scenario REQ-WPS-07.6: UNC and WSL-interop path shapes scrubbed (backslash-prefixed)
- GIVEN a plain `Error` thrown from schematic execution carries a `.message` embedding a UNC or WSL-interop path shape — e.g. `\\server\share\project\config.json`, `\\wsl.localhost\Ubuntu\home\user\project\file.ts`, or `\\wsl$\Ubuntu\home\user\project\file.ts`
- WHEN the terminal catch composes the stderr note
- THEN the composed note does NOT contain the UNC/WSL-shaped substring — it is scrubbed to the `<outside-project>` placeholder, via the same unconditional route as ADR-02's Windows-drive-letter rationale
