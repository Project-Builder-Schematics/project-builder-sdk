/**
 * FIT-23 (REQ-FTG-01): corpus byte-determinism — the full non-engine-gated scenario set
 * run TWICE in-process must produce byte-identical corpus content. This is the FAST, WEAK
 * guard (same-process double-run); the STRONG guard is the out-of-band regenerate-and-diff
 * flow (REQ-GCC-05 — fresh process, fresh state). Pre-merge, this runs (and is RED-provable)
 * against the REQ-GCC-12 skeleton record alone.
 *
 * Failure-message taxonomy (design §4.4): guard id + broken invariant + named offender +
 * rule cite.
 *
 * Red-proof: `test/fixtures/red/author-emulation/nondeterministic-factory.ts` embeds a
 * fresh `randomUUID()` per run — proves the double-run comparison actually catches
 * nondeterminism rather than vacuously passing.
 */
import { describe, it, expect } from "bun:test";
import { captureRun } from "../support/ir-transcript.ts";
import { buildRecord, serializeCorpus } from "../support/corpus-format.ts";
import { SCENARIOS } from "../e2e/author-emulation/scenarios.ts";
import { run as nondeterministicRun } from "../fixtures/red/author-emulation/nondeterministic-factory.ts";

async function renderTwice(
  scenario: Pick<(typeof SCENARIOS)[number], "run" | "input" | "seed" | "id" | "slug">
): Promise<[string, string]> {
  const first = serializeCorpus(
    buildRecord(await captureRun(scenario.run, scenario.input, scenario.seed), {
      scenarioId: scenario.id,
      slug: scenario.slug,
    })
  );
  const second = serializeCorpus(
    buildRecord(await captureRun(scenario.run, scenario.input, scenario.seed), {
      scenarioId: scenario.id,
      slug: scenario.slug,
    })
  );
  return [first, second];
}

describe("FIT-23 — corpus byte-determinism (in-process double-run, REQ-FTG-01)", () => {
  it("every non-engine-gated scenario produces byte-identical corpus content across two in-process runs", async () => {
    for (const scenario of SCENARIOS) {
      if (scenario.gated) continue; // Matrix rows (m-01..m-21) land in S-003/S-004.

      const [first, second] = await renderTwice(scenario);
      expect({ scenario: scenario.id, output: second }).toEqual({ scenario: scenario.id, output: first });
    }
  });

  // RED-PROOF: a factory that embeds a fresh value per run fails the double-run
  // comparison — proves FIT-23's check is a real, discriminating guard.
  it("[red-proof] a factory embedding a fresh value per run fails the double-run comparison", async () => {
    const [first, second] = await renderTwice({
      run: nondeterministicRun,
      input: { tag: "red-proof" },
      seed: undefined,
      id: "red-00",
      slug: "nondeterministic",
    });

    expect(second).not.toEqual(first);
  });
});
