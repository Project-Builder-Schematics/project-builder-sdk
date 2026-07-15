# North Star — stdio-engine-client (Foresight Checkpoint)

**Checkpoint**: foresight (post-design, forward-looking)
**Change**: `stdio-engine-client` | **Triage**: L | **Spec**: V2 signed (40 REQs)
**Verdict**: `aligned` — with an open human gate on the escalated conscience questions below.
**Steward**: purpose steward (SDD conscience), 2026-07-15

---

## 1. This is what we're going to do (intent, in outcome terms)

Give both repos ONE normative text to build the engine↔SDK wire against, and prove the SDK's
half actually speaks that wire — so the divergence three central decisions already resolved on
paper (NDJSON→length-prefix; single-initiator→host-initiated + 4 allowlisted reverse callbacks;
`session.init`→versioned `ready`) cannot quietly re-materialize as shipped code when the engine
wires its S5 step.

Concretely, the design commits to: rev-3 of `docs/engine-sdk-wire-design.md` (superseded
decisions moved under explicit historical headings) plus a NEW normative `docs/engine-sdk-wire-spec.md`;
the first real `EngineClient` (`StdioEngineClient`) + the `pbuilder-runner` composition root +
the versioned in-process bootstrap↔runner bridge; and a spawned-process fake-engine conformance
harness that self-verifies the SDK half over real stdio with no Go toolchain.

## 2. Here's how it fits

A new `src/transport/` leaf beside `src/core` (ADR-01), keeping core choreography pure. The
`EngineClient` port, `Session`, `wire.ts`, `EmitRejection`, and the ONE `ContractFake` are reused
unchanged in shape (D2) — reverse callbacks are a new *realization* of the existing 4-method port,
not a pattern replacement (hence `architecture_impact: modifying`, not breaking). The runner root
sits in `src/transport/` (not `bin/`) so the argv-spawn and bridge entry paths share ONE
validation chokepoint. The engine owns boot + `ready` + the security envelope + the pre-import
fd-1 dup; the SDK owns everything post-`ready` (Shape C, settled #1; ADR-02).

## 3. Here's the outcome we're chasing (traced to the problem statement)

The problem statement names three pains and one clock:

| Stated pain | Deliverable that resolves it | Materializes where |
|---|---|---|
| Engine about to build S5 against a stale record | rev-3 design doc + normative wire-spec doc (WPS-11, `docs/engine-sdk-wire-spec.md`) | in-repo (output) — engine must CONSUME it (cross-repo, see gate) |
| No normative artifact both repos build & conformance-test against | normative versioned wire spec + fake-engine harness (FEH-01..06) | in-repo — fully materializes |
| Divergence re-materializing as SHIPPED CODE | versioned `ready` fail-at-greeting (WPS-02) + closed method set (WPS-05) + doc-pinned cap constant (WPS-06/FEH-06) | in-repo runtime guard — see below |
| "SDK half is proven conformant" | spawned-process harness, zero-uncovered REQ coverage map (FEH-05), no Go | in-repo — fully materializes |

**The outcome we hold the reckoning against**: both repos build against ONE normative text AND
the SDK half is proven conformant to it — *and a stale-engine build fails LOUDLY at the greeting
handshake rather than silently corrupting shipped behavior.*

## 4. The filed question (does this RESOLVE the pain, or just produce correct outputs?)

**AI analysis — it resolves the pain, honestly.** The key insight that saves this from being an
"outputs without outcome" change is the **versioned `ready` fail-at-greeting handshake (WPS-02)**.
The problem's sharpest fear is *silent* re-materialization ("the divergence re-materializes as
shipped code"). WPS-02 converts a stale-engine build into a LOUD failure at first contact (exit 1,
both versions named, zero callbacks dispatched) — it cannot silently ship. That is the genuine
resolution, not a paper one. The conformance harness proving the SDK side, the closed reverse-
callback allowlist, and the doc-pinned frame-cap constant reinforce it. No promise from the
proposal shrank; the spec/design EXPANDED (35→40 REQs) to fully honor the two coupled contracts
(wire + bootstrap↔runner bridge) that triage flagged as an under-scoping risk — that risk did
NOT materialize.

**Is there a shorter path to the SAME outcome?** Possibly for the URGENT half only — the "why
now" clock is specifically the engine building S5 against a stale doc, and the single deliverable
that unblocks THAT is the rev-3 doc + normative wire-spec. The full StdioEngineClient/bridge/
harness build serves the *other* stated outcome ("last unbuilt seam" + "proven conformant") and
is what makes the doc trustworthy-against-BUILT-code rather than aspirational. So building it now
is defensible — but the sequencing is a human call (conscience question 2).

---

## Conscience questions (HUMAN-ONLY — the gate does not pass until answered)

These are questions of *usability, significance, and timing* that I must not fake a verdict on.
My AI analysis found no assertable design-misalignment (`aligned`), but these hold the outcome:

- **CQ-1 (usable? — the cross-repo tether).** This repo produces the normative rev-3 doc and
  proves the SDK half, but CANNOT force the engine to consume rev 3, and there is NO cross-repo CI
  assertion in scope (the engine runs its own SDD cycle: PR-1 protocolVersion + shared constant,
  PR-3 sidecar, PR-5 mapping). The designed mitigation is honest — a stale-engine build fails
  loudly at the `ready` greeting (WPS-02). **Is "self-conformant SDK + loud fail-at-greeting" a
  sufficient realization of "both repos build against ONE normative text", or does the outcome not
  count as delivered until the engine's matching PR-1 lands?**

- **CQ-2 (worth it now? — sequencing / inert code).** The design is explicit that the SDK
  deliverables are INERT until the engine builds its half ("no runtime consumer yet", 4.8). **Is
  building the FULL SDK half now — ahead of the engine's concrete S5 shape — the right call, or
  does it risk the SDK code aging against an engine design that shifts during the engine's own SDD
  cycle? Should the normative-doc deliverable ship first (unblocking the engine's urgent clock)
  with the code following once the engine shape is concrete?** (Counter-argument on record: the
  "reconciled against BUILT code, not spec-on-faith" discipline REQUIRES building the SDK half.)

- **CQ-3 (significant? — the frame-cap residual).** `BATCH_CAP_BYTES == MaxMessageBytes` is pinned
  only on the SDK side, against a doc literal (WPS-06/FEH-06/fit-34). A wire-compatible engine build
  with a DIFFERENT `MaxMessageBytes` value passes the handshake (same protocolVersion) and desyncs
  at runtime — caught by neither the handshake nor the SDK-side drift test; ledgered as PC-PROTO-01
  cross-repo debt. **Is accepting that runtime-desync residual (until engine PR-1 names the shared
  value) acceptable for this change's "proven conformant" claim?**

## Suspicions (labelled — NOT verdicts)

- **Soft observation, not a gap:** the promise "wire-spec doc reconciled against BUILT code" is
  mechanically enforced only for (a) the cap-constant value and (b) the superseded-term doc-scan
  (WPS-11/fit-31). Method-shape / error-shape / exit-code reconciliation between the doc and the
  built code relies on authorship discipline plus transitive coverage (harness tests built code
  against the spec; doc is meant to mirror the spec). AC-E2 ("doc↔spec zero contradiction") is
  asserted but has no mechanical doc↔spec contradiction check beyond the term scan. The reckoning
  checkpoint should HOLD this: verify the rev-3 doc's method/error/exit-code sections match the
  built code, not just that the two mechanical guards are green.

## Reckoning contract (what the pre-archive gate must hold this against)

1. Point to WHERE a stale-engine build fails loudly (WPS-02 fail-at-greeting) — proven by the
   conformance harness's version-mismatch leg, not just asserted.
2. The rev-3 doc + normative wire-spec exist, carry the version stamp naming the engine build
   target (WPS-11.2), and their method/error/exit-code sections match the BUILT code (the soft
   observation above).
3. FEH-05 coverage map: zero uncovered REQ-IDs, count-drift tripwire armed.
4. Human answers to CQ-1/CQ-2/CQ-3 on record (owner-ratified or overridden with rationale).
5. Ledger updated: StdioEngineClient row promoted; deferred Windows/macOS-pins + public-package-bin
   rows added; PC-PROTO-01 cross-repo frame-cap debt still tracked.
