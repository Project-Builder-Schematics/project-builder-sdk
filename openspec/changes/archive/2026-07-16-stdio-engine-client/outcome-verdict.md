# Outcome Verdict — stdio-engine-client (Reckoning Checkpoint)

**Checkpoint**: reckoning (pre-archive, backward-looking)
**Change**: `stdio-engine-client` | **Triage**: L (sensitive-area override: security/IPC)
**Verdict**: `delivered` — AI-assertable analysis complete; gate held OPEN on the three
conscience questions below until the owner answers ON RECORD (no record of the foresight
CQ-1/2/3 answers exists anywhere — engram searched, change artefacts grepped).
**Steward**: purpose steward (SDD conscience), 2026-07-16
**Judged at**: worktree `feat/stdio-engine-client` @ `8043137`; suite re-run by this steward:
**1639 pass / 0 fail** (172 files).

---

## 1. Our objective was THIS

> "The two repos held divergent wire designs [...] A 3-judge blind adjudication plus four owner
> rulings (2026-07-15) unified the design — but no NORMATIVE artifact exists that both repos can
> build against and conformance-test; the only shared record is stale on its three central
> decisions. **If each repo builds against its stale record, the divergence just resolved on
> paper re-materializes as shipped code.**" — triage.md problem statement

North Star outcome (foresight memo, verbatim): *"both repos build against ONE normative text AND
the SDK half is proven conformant to it — and a stale-engine build fails LOUDLY at the greeting
handshake rather than silently corrupting shipped behavior."*

## 2. Did we deliver it? Here is WHERE — pain by pain

| Stated pain | WHERE the result resolves it | Evidence quality |
|---|---|---|
| Engine about to build S5 against a stale record | `docs/engine-sdk-wire-spec.md` (NEW, normative, wire-spec version 1, header names the engine build target: "engine build target: PC-PROTO-01") + `docs/engine-sdk-wire-design.md` rev 3 with all superseded decisions confined under `## Superseded (historical)` (fit-31 scan, red-proofed) | DELIVERED. "Reconciled against BUILT code" is real: verify-final ran a dedicated doc↔spec↔code reconciliation (zero contradictions), and this steward independently spot-checked `exit-codes.ts` and `wire-protocol.ts` against the doc's exit taxonomy / greeting / method-set / error-shape sections — exact match, incl. `WIRE_PROTOCOL_VERSION = 1` ↔ the doc's version stamp |
| No normative artifact both repos can build AND conformance-test against | Wire-spec § Cross-Repo Build Target defines engine conformance as passing the SAME wire vectors the fake-engine harness encodes (`test/fake/harness.test.ts` + `*.e2e.test.ts`) — spawned process, real stdio, restricted PATH self-validating no-Go probe (FEH-04) | DELIVERED — the doc is not just readable, it is *testable-against* from the engine side |
| Divergence re-materializing as SHIPPED code (the sharpest fear: *silently*) | WPS-02 versioned `ready`, exact-int match, fail-at-greeting — PROVEN by a spawned-process e2e leg (`test/fake/exit-matrix.e2e.test.ts:247` "WPS-02 protocolVersion mismatch: exit 1, zero reverse callbacks dispatched"), exactly what the North Star's reckoning contract item 1 demanded (proven, not asserted). Reinforced by the closed 4-method set (WPS-05) and fit-33/fit-34 doc-pin drift tests | DELIVERED — with the known VALUE-parity residual (RCQ-3 below) |
| "SDK half proven conformant" | FEH-05 coverage map armed: `EXPECTED_REQ_COUNT = 41` tripwire, `PENDING_S005_COVERAGE_EXEMPTIONS` = empty set, zero uncovered REQs, red-proofed; 41/41 REQs / 108/108 scenarios traced (verify final); suite 1639/0 re-confirmed by this steward | DELIVERED — and STRONGER than promised: post-verify judgment-day (blind, 2 rounds) found 13 confirmed defects (7 CRITICAL, incl. flush-degrade exit-2, console.table wire bypass, IntentRejected exit-4) — ALL fixed with RED evidence, R2 re-judge APPROVED, spec V4 owner-signed. The "proven" claim survived a genuine adversary |

**Outputs-without-outcome scan**: none found. Every shipped artifact (docs, runner, client,
bridge, harness, fitness fit-30..35, ledger rows) traces to a named pain. The one honest
caveat — the SDK code is INERT until the engine builds its half — was declared at design
(§4.8), carried through foresight as CQ-1/CQ-2, and is precisely what RCQ-1 escalates. It is a
known tether, not a hidden non-outcome.

## 3. Reckoning contract (foresight memo) — item-by-item

1. **Fail-at-greeting proven, not asserted** — ✅ spawned e2e version-mismatch leg (above), plus
   greeting-time transport-fault trio (exit 3) and BRB-01 bridge-mismatch leg (exit 1, factory
   never imported, CRASH_POINTER canary).
2. **Docs exist, version-stamped, matching BUILT code** — ✅ wire-spec v1 names PC-PROTO-01;
   the soft observation I filed at foresight (method/error/exit-code sections could drift on
   authorship discipline) was answered by verify-final's dedicated reconciliation pass AND this
   steward's independent spot-check. Zero contradictions.
3. **FEH-05 zero uncovered, tripwire armed** — ✅ 41/41, empty exemption set, count tripwire at 41.
4. **Human answers to CQ-1/2/3 on record** — ❌ **NOT SATISFIED. No record exists** (engram
   searched: nothing; change artefacts grepped: the CQs appear only in north-star.md itself).
   The build proceeding implies the owner tacitly answered CQ-2, but tacit is not on record.
   → escalated below as RCQ-1..3; the gate holds until answered.
5. **Ledger updated** — ✅ superseded 2026-07-14 row CLOSED naming all three superseded decisions
   (REQ-LED-01.2); cross-repo tether + Windows/macOS-pins rows registered (`pending-changes.md`
   §"From stdio-engine-client"); PC-PROTO-01 frame-cap debt row keeps its "not engine-confirmed"
   flag with an honest advance-note.

## 4. The consuming journeys (simulated)

**Engine team, building from `docs/engine-sdk-wire-spec.md` ALONE**: buildable. Every
wire-visible decision carries exact values (frame grammar + fault posture, greeting shape +
exact-match rule, 4 method schemas with params/result tables, -32001 data shape with the
"unknown" degrade contract, pointer grammar, 5-code exit taxonomy incl. `.cause`-blindness,
bridge contract incl. the absolute-path-import requirement and the honestly-documented
sequential-rerun dangling-read residual, cap constants incl. the 82-byte budget arithmetic).
Known doc gaps are LEDGERED, not silent (JD followups: greeting timeout unspecified,
pre-greeting EOF code, tree.read result shape nuances) — an engine implementer hits questions,
not landmines.

**Author whose factory runs over the wire**: the bare factory written for `runFactoryForTest`
runs UNCHANGED over the wire (RUN-05 parity through the same `defineFactory` seam, proven by
runner.integration valid + schema-rejected parity legs); failures come back attributed (bounded
stderr, project-relative paths, exit codes separating author error 1/2 from transport 3 from
crash 4). Unusable only in the sense that no engine half exists yet — RCQ-1.

## 5. Did we drift? (promise ↔ delivery)

No adverse drift. Deltas, all accounted:
- Spec 40 (foresight) → 41 REQs (V3 adds LED-01) → V4 micro-amendments (zero IDs changed,
  owner-signed amendment ledger in the spec header).
- **Verify-final predates the JD fix commits** (`867c342`, `ae01822`; 1605→1639 tests). Coverage
  of the delta rests on the R2 blind re-judge + the full green suite — the state mirror already
  obligates the archive report to record this as a post-verify delta. Legitimate, but archive
  must not lose it.
- Stale pending row (`pending-changes.md:413`, Session.flush degrade) describes pre-JD-fix
  behavior — refresh already queued in state `resume_next` for archive.

---

## Conscience questions (HUMAN-ONLY — the gate does not pass until answered ON RECORD)

Foresight's CQ-1/2/3 were never answered on record. They return in reckoning form:

- **RCQ-1 (usable? — the cross-repo tether).** The SDK half is proven self-conformant and a
  stale engine fails loudly at the greeting — but the engine has consumed nothing yet and every
  runtime artifact here is inert until engine PC-PROTO-01 builds against wire-spec v1. **Do you
  accept "normative doc + self-conformant SDK + loud fail-at-greeting" as DELIVERY of "both
  repos build against ONE normative text" — with the engine's consumption tracked at
  PC-PROTO-01 — or does this change's outcome not count as delivered until the engine's matching
  half lands?**

- **RCQ-2 (worth it? — sequencing, now retrospective).** Foresight asked whether building the
  full SDK half ahead of the engine's concrete S5 shape was right, or whether the doc should
  ship first. You never answered on record; the build proceeded. The record now argues FOR it:
  judgment-day found 13 real defects against BUILT code — defects a doc-first path would have
  baked into the engine's assumptions ("reconciled against BUILT code" did real work).
  **Affirm the sequencing call retroactively — or name what you'd have done differently — so the
  decision exists somewhere other than by implication.**

- **RCQ-3 (significant residual? — the frame-cap value).** Unchanged from foresight: cap
  VALUE parity (`BATCH_CAP_BYTES == MaxMessageBytes == 4194304`) is mechanically pinned on the
  SDK side only (fit-34 vs the doc literal). A wire-compatible engine build with the same
  protocolVersion but a DIFFERENT MaxMessageBytes passes the handshake and desyncs at runtime —
  caught by neither side until PC-PROTO-01 names the value engine-side (ledgered, flag kept).
  **Is that runtime-desync residual acceptable for this change's "proven conformant" claim?**

**Process note for the orchestrator**: capture the owner's three answers into
`sdd/stdio-engine-client/outcome-verdict` (append/update) — do NOT let this gate close on
silence a second time.

## Verdict

**`delivered`** — every AI-assertable leg of the North Star's reckoning contract holds
(fail-at-greeting proven; docs normative, versioned, and matching built code; coverage tripwire
armed at 41 with zero exemptions; ledger reconciled; no outputs-without-outcome; no adverse
promise↔delivery drift; delivery exceeded the promise under blind adversarial review). The
verdict CRYSTALLIZES only when the owner answers RCQ-1..3 on record; silence is not consent.

## Owner Rulings (reckoning conscience questions — on record, 2026-07-16)

- **RCQ-1 (usable?)**: YES — "normative doc + self-conformant SDK + loud fail-at-greeting" IS delivery
  of "both repos build against one normative text"; engine consumption tracked at PC-PROTO-01.
- **RCQ-2 (sequencing)**: build-first AFFIRMED retroactively — judgment-day's 13 confirmed findings
  against BUILT code are the evidence a doc-first path would have baked into engine assumptions.
- **RCQ-3 (residual)**: frame-cap value parity pinned SDK-side only is ACCEPTABLE WITH TETHER —
  the PC-PROTO-01 ledger row carries the engine-side MaxMessageBytes ratification duty.

Gate status: **CLOSED — DELIVERED, owner-ratified.**
