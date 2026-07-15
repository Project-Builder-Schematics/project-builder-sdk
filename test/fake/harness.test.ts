// REQ-WPS-09 (S-003): run bootstrap is argv/bridge-only — there is no host-issued
// `runFactory` wire request; the post-`ready` wire carries ONLY reverse-callback traffic.
// S-004 extends this file with the FEH-01..05 corpus-driven conformance suite (design § 4.2
// routes both to the SAME file — S-003 creates it with just this leg).
//
// [characterization]: both tests below exercise a mechanism S-001 already built (WPS-03's
// discard-unknown-frame-types loop) against a NEW attack shape (an unsolicited host-issued
// REQUEST frame) — per this project's established convention (see S-001's apply-progress
// Discoveries), a pre-existing mechanism satisfying a new REQ's scenario is labeled
// characterization, not treated as a strict-TDD RED violation.

import { describe, it, expect } from "bun:test";
import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { dispatchToFake } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { pushableByteSource } from "../support/pushable-byte-source.ts";

const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;

describe("REQ-WPS-09 — run bootstrap is argv/bridge-only, no host-issued request method", () => {
  it("[characterization] Scenario REQ-WPS-09.2: a host-issued request frame arriving mid-run is discarded — never dispatches a run, the run still completes", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "wps-09" } });
    const inbox = pushableByteSource();
    const requests: Array<{ method: string }> = [];
    const hostFrameTypes: string[] = [];
    let sabotageInjected = false;
    inbox.push(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        const frame = value as { id: string; method: string; params: unknown };
        requests.push({ method: frame.method });
        // Sabotage: BEFORE answering the runner's own request, the host slips in an
        // unsolicited host-issued REQUEST frame — WPS-09.2's exact attack shape ("no
        // runFactory wire request exists"). Injected once, on the FIRST reverse callback,
        // so it lands genuinely MID-RUN, never at the greeting.
        if (!sabotageInjected) {
          sabotageInjected = true;
          inbox.push(encodeFrame({ type: "request", id: "host-1", method: "runFactory", params: {} }));
        }
        void dispatchToFake(fake, frame).then((response) => {
          hostFrameTypes.push(response.type);
          inbox.push(encodeFrame(response));
        });
      },
      writeStderr(): void {},
    };

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(0);
    // The runner's OWN reverse-callback sequence is exactly the skeleton's — nothing extra
    // was dispatched in response to the injected host request (never a second run either).
    expect(requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(fake.committedTree().get("out.txt")).toEqual("read:wps-09");
    expect(sabotageInjected).toBe(true); // sanity: the attack was actually attempted
  });

  it("[characterization] Scenario REQ-WPS-09.1: over a complete run, the only host->runner frames a conformant host sends are responses", async () => {
    const fake = new ContractFake({ seed: {} });
    const inbox = pushableByteSource();
    const hostFrameTypes: string[] = [];
    inbox.push(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        const frame = value as { id: string; method: string; params: unknown };
        void dispatchToFake(fake, frame).then((response) => {
          hostFrameTypes.push(response.type);
          inbox.push(encodeFrame(response));
        });
      },
      writeStderr(): void {},
    };

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(0);
    // dispatchToFake (test/fake/fake-engine-harness.ts) only ever constructs
    // `{type:"response", ...}` frames — there is no code path anywhere in this harness that
    // emits a host-issued `{type:"request", ...}` frame during a normal run, matching
    // WPS-09.1's claim structurally over a REAL executed run, not just by absence of a
    // counter-example.
    expect(hostFrameTypes.length).toBeGreaterThan(0);
    expect(new Set(hostFrameTypes)).toEqual(new Set(["response"]));
  });
});
