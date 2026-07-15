# Bootstrap Runner Bridge Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the in-process bridge handoff contract between an engine-side bootstrap and the
runner: the `enterBridge` entry point, bridge-contract version matching, argv composition, and
the guarantee that bridge-composed runs pass through the SAME runner gates a direct-spawned run
does.

## Requirements


### REQ-BRB-01: Versioned Bridge Entry Contract

The bridge MUST expose a stable, versioned in-process entry point that the engine's embedded
bootstrap dynamic-imports to hand off control (the "second versioned contract", owner ruling
#2157 point 3) — an in-process JS-level contract, independent of the wire's `ready.
protocolVersion` (WPS-02). A version mismatch between what the bootstrap expects and what the
installed SDK's bridge provides MUST fail loudly, naming both versions. Parameters arriving via
the bridge (factory pointer, `--input`/`--input-file`-equivalent) MUST traverse the SAME
RUN-01..RUN-04 validation gates as argv-supplied parameters — those gates live at the
composition root shared by both entry paths, never duplicated or bypassed inside the bridge's
own parameter handling.
(Previously: silent on whether bridge-delivered parameters traverse the argv gates — M5.)

#### Scenario REQ-BRB-01.1: Matching bridge versions hand off cleanly
- GIVEN the bootstrap expects bridge contract version N and the installed SDK's bridge is version N
- WHEN the bootstrap dynamic-imports the bridge entry point
- THEN control passes to `pbuilder-runner-bin`'s composition root with the argv-equivalent parameters (factory pointer, input/input-file)

#### Scenario REQ-BRB-01.2: Mismatched bridge version fails loudly
- GIVEN the bootstrap expects bridge contract version N and the installed SDK's bridge reports version M ≠ N
- WHEN the bootstrap invokes the entry point
- THEN the bridge rejects before any factory-related code runs, naming both N and M, exiting 1 (validation-failure, EXC-01)

#### Scenario REQ-BRB-01.3: Bridge-delivered parameters traverse the same gates as argv (M5)
- GIVEN the bridge hands off a factory pointer with a non-`file://` scheme (a RUN-02 violation)
- WHEN `pbuilder-runner-bin`'s composition root receives the bridge-delivered parameters
- THEN it is rejected by the SAME gate (RUN-02) that would reject it from argv — the bridge path does not bypass or re-implement a separate, weaker check

### REQ-BRB-02: Fd-1 Capture Before Import (C5)

The bridge MUST capture its own reference to the process's fd-1 write handle before any
factory-related import (armed at bridge entry — V4; previously "at its own module load", which
would mutate global process state as a side effect of merely importing the module) — before it
imports `pbuilder-runner-bin` or the factory — as belt-and-suspenders alongside the engine's
own dup (A2). All frame writes for the lifetime of the process MUST route only through that
captured handle; a later reassignment of `process.stdout` by author code MUST NOT be able to
redirect wire writes.

#### Scenario REQ-BRB-02.1: Author reassignment of process.stdout cannot hijack the wire
- GIVEN the bridge has captured the fd-1 handle at bridge entry (V4), before any factory-related import
- WHEN a factory (post-import) reassigns or monkey-patches `process.stdout`
- THEN `StdioEngineClient`'s outbound frames still reach the captured handle unchanged — the reassignment has no effect on wire traffic

### REQ-BRB-03: Console Redirect Before Import (C6)

The bridge MUST redirect `console.*` to stderr before importing `pbuilder-runner-bin`/the
factory, as belt-and-suspenders alongside the engine's own dup (A2).

#### Scenario REQ-BRB-03.1: console.log never reaches the wire
- GIVEN the bridge has redirected `console.*` to stderr before import
- WHEN a factory calls `console.log("debug")` during its run
- THEN the text appears on stderr and no frame is written to stdout as a result of that call

---

