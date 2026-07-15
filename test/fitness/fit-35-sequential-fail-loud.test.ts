/**
 * fit-35 (design § 4.7, sequential-model fail-loud — S-003): REQ-SEC-02's reentrancy guard,
 * proven with REAL, concurrently-invoked `runner.ts::runRunner` calls (production code, not
 * a mock) — a second run-entry invocation while the first is genuinely in flight rejects
 * `OverlappingRunError` synchronously, with zero wire I/O from the rejected attempt, and the
 * FIRST run completes normally once its own greeting arrives. Complements the unit-level
 * proof in `test/transport/runner.unit.test.ts` (design § 4.6 routes REQ-SEC-02.1 there) —
 * this is the cross-cutting architectural invariant that a THIRD, unrelated run-entry
 * vehicle (this file, never before importing runner.ts) still observes the SAME guard.
 *
 * (fit-35, not fit-29: `fit-29-sanctioned-definefactory-caller.test.ts` pre-exists as an
 * unrelated check — design § 4.7 numbering note, resolved at plan-verify iteration 2.)
 */
import { describe, it, expect } from "bun:test";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { OverlappingRunError } from "../../src/transport/stdio-engine-client.ts";
import { makeInProcessHost } from "../support/in-process-host.ts";

const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;

describe("fit-35 — sequential single-in-flight run, fail-loud on overlap (SEC-02)", () => {
  it("a second run-entry invocation genuinely concurrent with the first rejects OverlappingRunError; the first run is unaffected and completes", async () => {
    const first = makeInProcessHost({ seed: { "seed.txt": "fit-35" } });
    const firstPromise = runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], first.io);

    let secondWireTouched = false;
    const secondIo: RunnerIo = {
      input: (async function* () {})(),
      writeFrame: () => {
        secondWireTouched = true;
      },
      writeStderr: () => {
        secondWireTouched = true;
      },
    };

    await expect(runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], secondIo)).rejects.toBeInstanceOf(
      OverlappingRunError
    );
    expect(secondWireTouched).toBe(false);

    first.sendReady();
    const exitCode = await firstPromise;
    expect(exitCode).toEqual(0);
    expect(first.fake.committedTree().get("out.txt")).toEqual("read:fit-35");
  });

  it("a THIRD concurrent attempt while the first is still in flight is ALSO rejected — overlap rejection is not a one-shot latch", async () => {
    const first = makeInProcessHost({ seed: { "seed.txt": "fit-35-third" } });
    const firstPromise = runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], first.io);

    const unreached = (): RunnerIo => ({
      input: (async function* () {})(),
      writeFrame: () => {
        throw new Error("unreached: writeFrame must never be called by a rejected overlapping attempt");
      },
      writeStderr: () => {
        throw new Error("unreached: writeStderr must never be called by a rejected overlapping attempt");
      },
    });

    await expect(runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], unreached())).rejects.toBeInstanceOf(
      OverlappingRunError
    );
    await expect(runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], unreached())).rejects.toBeInstanceOf(
      OverlappingRunError
    );

    first.sendReady();
    expect(await firstPromise).toEqual(0);
  });
});
