# Runner Exit Code Taxonomy Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the closed exit-code taxonomy the `pbuilder-runner` process uses to classify how a run
ended: success, author/engine-rejected write (`AuthoringError`), transport fault, or an
unclassified crash — and the `.cause`-blindness guarantee that keeps the classifier narrow and
predictable.

## Requirements


### REQ-EXC-01: Exit Code Taxonomy

The runner MUST exit with exactly one of the codes below, classified by the terminal error's
shape (mutually exclusive by construction — no precedence rule needed, since
`AuthoringError.origin` is a closed derived enum and transport-fault errors are a distinct
`StdioEngineClient` error class).

| Code | Category | Classified when |
|---|---|---|
| 0 | success | the run committed and the process exits cleanly |
| 1 | validation-failure | argv/factory-pointer/schema gating rejects before or during the run (`AuthoringError.origin === "authoring-rejected"`, or a pre-run RUN-01/02/03/04/07/08 gate fails), OR the greeting wire-version mismatch or structurally-invalid greeting (WPS-02.2/.3), OR the bridge contract version mismatch (BRB-01.2), OR the single-instance realpath probe failure (SEC-07.2) |
| 2 | emit-rejection | the host refused a write, an advisory commit/discard intent, or a `tree.read` intent (V4 — a `tree.read` error envelope is classified `IntentRejectedError`, SEC-06) (`AuthoringError.origin === "write-rejected"`, includes the `"unknown"` degrade, WPS-08/SEC-04) |
| 3 | transport-fault | a wire-level failure (malformed/desync/oversize/timeout/unexpected EOF, including a pending call rejected by SEC-08.3/SEC-10.5) distinct from any classified `AuthoringError` |
| 4 | crash | an unclassified exception reaches the runner's top-level catch (not an `AuthoringError`, not a transport-fault), including an author-code throw during factory import (RUN-07.2) |

Codes 3 and 4 are this spec's extension of owner ruling #2163's three-way taxonomy
(validation-failure / emit-rejection / crash): AC-A2 requires transport-fault, EmitRejection,
and author-crash to be THREE distinguishable signals, and a shared exit code for two different
failure classes would defeat that at the process boundary. This is an addition, not a reopening
— the ruling's three named categories all still map to a code.
(Previously: the code-1 column did not name the greeting/bridge/probe handshake failures
explicitly — B6.)

#### Scenario REQ-EXC-01.1: Clean run exits 0
- GIVEN a factory that emits a valid batch and returns normally
- WHEN the run completes against a wire-conformant host that commits
- THEN the runner exits 0 (SC-1)

#### Scenario REQ-EXC-01.2: Four failure classes map to four distinct codes
- GIVEN four separate runs: (a) `--input` and `--input-file` both passed, (b) a factory write collides, (c) the host sends a frame with a corrupted length prefix mid-run, (d) the factory throws a plain `TypeError`
- WHEN each run terminates
- THEN the exit codes are 1, 2, 3, 4 respectively — never the same code for two of them

#### Scenario REQ-EXC-01.3: Three handshake-time failures all classify as code 1, distinguishable only by message (B6)
- GIVEN three separate handshake-time failures: (a) a WPS-02 `protocolVersion` mismatch, (b) a BRB-01 bridge contract version mismatch, (c) a SEC-07 realpath probe split
- WHEN each terminates
- THEN all three exit 1 (validation-failure) — indistinguishable by exit code from each other or from a plain post-boot RUN-01..04 argv gate failure, distinguishable only by their error text

### REQ-EXC-02: Double-Fault Never Overrides the Original Error's Classification

When `discard()` itself fails while handling an original error (E1), the double-fault (E2) MUST
be attached as E1's `.cause` and MUST NOT change E1's exit-code classification (mirrors
`context.ts`'s existing double-fault preservation).

#### Scenario REQ-EXC-02.1: Factory crash + failed discard still exits by E1's class
- GIVEN a factory throws mid-run (E1, a `TypeError`) AND the host's `ir.discard` acknowledgment itself fails (E2)
- WHEN the runner terminates
- THEN it exits with code 4 (crash, E1's class), E2 is attached as `E1.cause`, and no partial apply is ever confirmed (SC-3)

---

