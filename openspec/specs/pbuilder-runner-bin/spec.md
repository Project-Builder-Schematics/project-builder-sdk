# Pbuilder Runner Bin Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the `pbuilder-runner` argv contract (`--factory`/`--input`/`--input-file`), factory
pointer resolution and validation (pre-import, fail-closed), input handling (size gate, JSON
parse error reporting), the `defineFactory` wrap seam shared with `runFactoryForTest`, the
double-wrap brand-marker rejection, and module-resolution-failure classification.

## Requirements


### REQ-RUN-01: Argv Contract

The bin MUST accept `--factory <url>#<export>` (required), and exactly one of `--input <json>`
XOR `--input-file <path>` (mutually exclusive, one required). Any unrecognized flag MUST fail
closed (validation-failure) rather than being silently ignored.

#### Scenario REQ-RUN-01.1: Both --input and --input-file rejected
- GIVEN argv containing both `--input '{}'` and `--input-file /tmp/x.json`
- WHEN the bin parses argv
- THEN it exits 1 (validation-failure) before any factory import is attempted

#### Scenario REQ-RUN-01.2: Unknown flag fails closed
- GIVEN argv containing `--unsafe-mode`
- WHEN the bin parses argv
- THEN it exits 1 naming the unrecognized flag, never silently continuing

#### Scenario REQ-RUN-01.3: Neither input flag supplied (m2)
- GIVEN argv containing neither `--input` nor `--input-file`
- WHEN the bin parses argv
- THEN it exits 1 (validation-failure), naming that exactly one of `--input`/`--input-file` is required, before any factory import is attempted

### REQ-RUN-02: Factory URL Scheme + Host Allowlist (C1)

The bin MUST validate that the factory pointer's URL scheme is exactly `file:` AND that the
URL's host component is empty — rejecting `file://host/path` forms (a non-empty host, which
some URL parsers resolve as a remote/UNC-style reference) as well as any non-`file:` scheme —
BEFORE dynamic-importing the module (the factory's top-level code runs at import — input
validation after import is not a containment control).
(Previously: scheme-only check, silent on the host component — m3.)

#### Scenario REQ-RUN-02.1: file:// scheme with empty host accepted
- GIVEN `--factory file:///workspace/factory.ts`
- WHEN the bin validates the pointer
- THEN validation passes and dynamic-import proceeds

#### Scenario REQ-RUN-02.2: Non-file scheme rejected before import
- GIVEN `--factory https://evil.example/factory.ts` (or `data:`, `node:`, any non-`file://` scheme)
- WHEN the bin validates the pointer
- THEN it exits 1 WITHOUT ever calling `import()` on the target — no author code from that URL executes

#### Scenario REQ-RUN-02.3: file:// scheme with a non-empty host rejected before import (m3)
- GIVEN `--factory file://host/workspace/factory.ts` (a non-empty host component)
- WHEN the bin validates the pointer
- THEN it is rejected before import, even though its scheme is `file:` — the host component is part of the allowlist check, not just the scheme

### REQ-RUN-03: Factory Fragment/Export Validation (C2)

The bin MUST classify export resolution into exactly three distinct, actionable, load-time
failure forms, each with its own message: (a) absent fragment resolves to the default export —
MUST fail loudly if no default export exists; (b) a present fragment naming a non-existent
export MUST fail with a "missing export" message; (c) a resolved export that is not a function
MUST fail with a "malformed factory export" message.

#### Scenario REQ-RUN-03.1: Missing default export
- GIVEN `--factory file:///x.ts` (no fragment) and `x.ts` has no default export
- WHEN the bin resolves the pointer
- THEN it exits 1 with a message distinct from the other two forms, naming "no default export" (SC-9)

#### Scenario REQ-RUN-03.2: Missing named export
- GIVEN `--factory file:///x.ts#makeThing` and `x.ts` does not export `makeThing`
- WHEN the bin resolves the pointer
- THEN it exits 1 naming the missing export `makeThing` (SC-9)

#### Scenario REQ-RUN-03.3: Malformed (non-function) export
- GIVEN `--factory file:///x.ts#config` and `x.ts`'s `config` export is a plain object, not a function
- WHEN the bin resolves the pointer
- THEN it exits 1 naming the export as non-callable, distinct from the two missing-export forms (SC-9)

### REQ-RUN-04: Input-File Size Cap + Fail-Closed Parse (C3)

When `--input-file <path>` is used, the bin MUST check the file's size against a documented cap
(default 10 MiB / 10 485 760 bytes — an SDK-chosen placeholder pending engine-side
confirmation, same provenance posture as SEC-05/WPS-07) BEFORE reading its contents, and MUST
fail closed (reject, never partially apply) on any JSON parse error, reporting only the parse
failure's line and column (never raw file content, mirrors `formatParseError`,
`bin/pbuilder-codegen.ts:126`). Per A1, `<path>` is always an engine-owned temp path — the bin
performs no path-provenance/containment check on it.
(Previously: "documented cap" with no value, and no constraint on what the parse-error message
may contain — M2, m4.)

#### Scenario REQ-RUN-04.1: Oversized input-file rejected before read
- GIVEN an `--input-file` path whose file size exceeds the documented 10 MiB cap
- WHEN the bin processes the flag
- THEN it exits 1 without reading the file's contents into memory

#### Scenario REQ-RUN-04.2: Malformed JSON fails closed, reporting only line/column
- GIVEN an `--input-file` under the cap whose contents are not valid JSON
- WHEN the bin parses it
- THEN it exits 1, reporting only the parse error's line and column (never the raw file content), no factory import is attempted, and no partial input is passed to the factory

### REQ-RUN-05: `defineFactory` Wrap with `packageDir = dirname(factory)`

After successful export resolution (RUN-03), the bin MUST wrap the resolved bare factory export
using the internal `defineFactory`, passing `packageDir = dirname(<factory URL's filesystem
path>)` so schema-derived validation and reserved-name checks (`context.ts`) apply exactly as
they do for `runFactoryForTest`.

#### Scenario REQ-RUN-05.1: Wrapped factory's observable behavior matches packageDir-anchored runFactoryForTest (m6)
- GIVEN `--factory file:///workspace/pkg/factory.ts`
- WHEN the bin wraps the resolved export and the factory is subsequently run
- THEN its observable behavior (schema-derived validation and reserved-name checks anchored to `packageDir`) is identical to invoking the same factory via `runFactoryForTest` with `packageDir: "/workspace/pkg"` — verified by observable consequence, never by inspecting `defineFactory`'s call arguments directly (drops the white-box invocation spy)

### REQ-RUN-06: Double-Wrap Detection

The bin MUST detect when the resolved factory export is already the return value of an internal
`defineFactory` call, rather than a bare author function, and reject at load time with a message
that educates the author to export the bare function — distinct from RUN-03's
missing/malformed-export messages, and never silently invoking `wrapped(wrapped(...))`. The
detection MECHANISM (e.g. a brand marker on the wrapped return value) is a design/implementation
decision (see design ADR) — this requirement is behavior-level only: WHAT is detected and
rejected, not HOW.
(Previously: specified the mechanism as arity-sniffing `(o, deps)` vs. `(o)` — M12 drops the
mechanism from the spec and adds a negative-triangulation scenario so an incidental arity-2
bare factory is never misclassified.)

#### Scenario REQ-RUN-06.1: Already-wrapped export rejected with an educational message
- GIVEN a factory module whose target export is itself the function `defineFactory(bareFn)` returns
- WHEN the bin resolves and inspects the export before wrapping it
- THEN it exits 1 at load time with a message distinguishable from RUN-03's forms, and never executes the double-wrapped call chain

#### Scenario REQ-RUN-06.2: A bare arity-2 factory is NOT misclassified as already-wrapped (M12 negative triangulation)
- GIVEN a bare arity-1 factory `(o) => {}`, AND separately a bare factory written with an unused second parameter `(o, _unused) => {}`
- WHEN the bin resolves and inspects each export
- THEN NEITHER is rejected by the double-wrap check — both are ordinary bare factories and proceed to normal wrapping (proves the detection is not implemented as arity-sniffing, since arity alone would misclassify the second one)

### REQ-RUN-07: Factory Module Import Failure Classification (M4, NEW)

When the bin's dynamic `import()` of the (allowlisted, RUN-02) factory module itself throws,
the bin MUST classify the failure into exactly two forms: a module that could not be RESOLVED
OR LOADED (V4 — `ERR_MODULE_NOT_FOUND`, or a Bun `ResolveMessage`/`BuildMessage`/
`SyntaxError` load failure: a module that never RAN) exits 1 (validation-failure); an
exception thrown by the factory module's own top-level code (author code executing at import
time) exits 4 (crash). In both cases, the stderr text MUST be bounded, no-echo, and
project-relative (WPS-07) — never a raw import stack trace.

#### Scenario REQ-RUN-07.1: Module-not-found exits 1
- GIVEN `--factory file:///workspace/missing.ts` pointing to a nonexistent file
- WHEN the bin imports it
- THEN it exits 1, with bounded, project-relative stderr text stating the module could not be resolved — no raw Node resolution stack

#### Scenario REQ-RUN-07.2: Author top-level throw at import exits 4
- GIVEN a factory module whose top-level code throws a plain `Error` during import (an author-level throw, not a resolution failure)
- WHEN the bin imports it
- THEN it exits 4 (crash), with bounded, project-relative stderr text — never a raw import stack trace, never an absolute path, never a module source excerpt

### REQ-RUN-08: Fd-1 Capture and Console Redirect When the Bin Is the Process Entry (M3, NEW)

When `pbuilder-runner-bin` is itself the process entry point (directly spawned per RUN-01 — not
reached via the bridge), it MUST capture its own reference to the process's fd-1 write handle,
and MUST redirect `console.*` to stderr, BEFORE any factory import — the same guarantee BRB-02/
BRB-03 provide on the bridge path. This is defence-in-depth: whichever path reaches the runner,
the same fd-1/console protection applies before the factory's top-level code can run.

#### Scenario REQ-RUN-08.1: Direct-spawn entry captures fd-1 and redirects console before import
- GIVEN `pbuilder-runner-bin` is spawned directly (no bridge)
- WHEN it starts
- THEN it captures the fd-1 write handle and redirects `console.*` to stderr BEFORE argv parsing proceeds to a factory import — identical guarantee to BRB-02/BRB-03's bridge-path behavior

#### Scenario REQ-RUN-08.2: Author reassignment cannot hijack the wire on the direct-spawn path
- GIVEN the bin has captured fd-1 and redirected console at direct-spawn entry
- WHEN a factory reassigns `process.stdout` or calls `console.log` post-import
- THEN wire frames still reach the captured handle unchanged and console output appears on stderr only — identical outcome to the bridge path (BRB-02.1/BRB-03.1)

---

