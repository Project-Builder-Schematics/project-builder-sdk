/**
 * e2e — author-emulation scaffold family, walking skeleton (S-000).
 *
 * Drives the SCENARIOS registry (currently `s-00` only — the infra-spine skeleton, GCC-12)
 * through `captureRun`, and compares a FRESH serialization against the committed corpus
 * byte-for-byte — a drift fails the suite, and no code path here writes a new corpus file
 * to make it pass (GCC-05 tautology guard). Matrix rows (m-01..m-21) land in S-003/S-004;
 * report rendering is NOT called here — `s-00` gets no report (design ruling R-B).
 *
 * NEVER `scaffold.e2e.test.ts` — that filename is owned upstream by `schematic-local-files`
 * (ITC-04).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureRun } from "../support/ir-transcript.ts";
import { buildRecord, serializeCorpus, FORMAT_VERSION } from "../support/corpus-format.ts";
import { SCENARIOS } from "./author-emulation/scenarios.ts";

const CORPUS_DIR = new URL("./author-emulation/corpus/", import.meta.url).pathname;

describe("e2e — author-emulation scaffold family (walking skeleton)", () => {
  for (const scenario of SCENARIOS) {
    // Matrix rows wait for S-003/S-004's landed factory surface.
    if (scenario.gated) continue;

    it(`${scenario.id} (${scenario.slug}) matches the committed corpus byte-for-byte`, async () => {
      const capture = await captureRun(scenario.run, scenario.input, scenario.seed);
      const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
      const fresh = serializeCorpus(record);

      const committedPath = join(CORPUS_DIR, `${scenario.id}.${scenario.slug}.transcript.json`);
      const committed = readFileSync(committedPath, "utf-8");

      expect(fresh).toEqual(committed);
      expect(record.normative.outcome).toEqual(scenario.expected);
      expect(record.formatVersion).toEqual(FORMAT_VERSION);
    });
  }
});
