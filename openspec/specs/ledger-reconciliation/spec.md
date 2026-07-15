# Ledger Reconciliation Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-15 — V3 introduced this domain, gap #2; V4 micro-amendment)
**Change**: `stdio-engine-client`

## Purpose

Defines the requirement that `openspec/pending-changes.md` stays reconciled against this
change's cross-repo and platform-tether debt at archive time — named rows for the engine
`PC-PROTO-01` build target and the Windows/macOS CI gap, and a full supersession note on the
row this change closes — mechanically enforced by a ledger-presence scan (`fit-31`).

## Requirements


### REQ-LED-01: Pending-Changes Ledger Reconciled to This Change's Dispositions (V3, NEW)

The change MUST reconcile `openspec/pending-changes.md` against the disposition table carried in
`sdd/stdio-engine-client/slices` (task S-005.4): closing the `StdioEngineClient` row (L359) with
a supersession note naming the decisions this spec supersedes (NDJSON framing, the `session.init`
handshake, and the row's undefined bootstrap mechanism), and creating two new rows — a deferred
Windows/macOS-pins row and a cross-repo tether row naming the engine's build target (the rev-3
`docs/engine-sdk-wire-design.md` and the `docs/engine-sdk-wire-spec.md` version this change
ships, WPS-11.2). This requirement is a documentation/process artifact, not a wire behavior: it
is verified by `sdd-verify --mode=final` evidence and a fit-31-style ledger-presence scan
(`slices.md` task S-005.3), NEVER by the fake-engine-conformance-harness's wire-scenario corpus
(FEH-01..05). FEH-05's coverage map still parses and counts REQ-LED-01 (its rule regex-scans
this file's `### REQ-XX-NN` headers, and this header matches), so its expected-count constant
updates from 40 to 41 — but LED-01's exercising evidence is the ledger scan, not a harness
scenario; a future FEH-05 implementation MUST account for this non-harness-verified REQ-ID
rather than misreport it "uncovered."

#### Scenario REQ-LED-01.1: Tether and Windows/macOS-pins rows exist, naming the build target
- GIVEN the change has landed (`slices.md` S-005 complete)
- WHEN `openspec/pending-changes.md` is scanned
- THEN it contains a cross-repo tether row naming "engine PC-PROTO-01 MUST build against rev-3 + wire-spec v{N}" (the `docs/engine-sdk-wire-design.md` rev and the `docs/engine-sdk-wire-spec.md` version stamped per WPS-11.2), AND a Windows/macOS-pins deferred row — both assertable by a mechanical scan, not by reading intent

#### Scenario REQ-LED-01.2: Closed StdioEngineClient row carries a supersession note
- GIVEN the pre-change `StdioEngineClient` row (L359) named NDJSON framing, a `session.init` handshake, and no bootstrap/bridge mechanism
- WHEN the row is closed by this change
- THEN it carries a supersession note explicitly naming all three superseded decisions (NDJSON → length-prefix framing WPS-01, `session.init` → versioned `ready` WPS-02, and the row's undefined bootstrap → the argv/bridge mechanism WPS-09/BRB-01) — so a future reader is never misled into thinking the row's original design shipped

---

