/**
 * Unit tests for `test/support/corpus-format.ts` — pure data-model contracts the e2e
 * byte-compare doesn't itself exercise (design.md §4.6, UNGATED rows GCC-02.1/GCC-03.1).
 */
import { describe, it, expect } from "bun:test";
import { captureRun } from "../../support/ir-transcript.ts";
import { buildRecord, FORMAT_VERSION, type TranscriptRecord } from "../../support/corpus-format.ts";
import { SCENARIOS } from "./scenarios.ts";

const skeleton = SCENARIOS.find((s) => s.id === "s-00")!;

describe("corpus-format — formatVersion is independent of wire protocolVersion (GCC-02)", () => {
  it("formatVersion and protocolVersion are distinct fields with independent values", async () => {
    const capture = await captureRun(skeleton.run, skeleton.input, skeleton.seed);
    const record = buildRecord(capture, { scenarioId: skeleton.id, slug: skeleton.slug });

    // formatVersion (corpus) is a fixed constant; protocolVersion (wire) is captured
    // per-batch. Neither field is derived from the other — they merely happen to both be
    // present so a reader can confirm they vary independently.
    expect(record.formatVersion).toEqual(FORMAT_VERSION);
    expect(record.informative.batchGrouping[0]?.protocolVersion).toEqual(1);
  });
});

describe("corpus-format — chunk-boundary-only difference is not NORMATIVE drift (GCC-03)", () => {
  it("two records with identical normative content but different batch grouping compare equal on the normative subtree alone", () => {
    const base: TranscriptRecord = {
      formatVersion: FORMAT_VERSION,
      scenarioId: "s-00",
      slug: "infra-skeleton",
      normative: {
        outcome: "committed",
        directives: [{ op: "create", pathTemplate: "a.ts", template: "x", options: {}, force: false }],
      },
      informative: { batchGrouping: [{ directiveCount: 1, protocolVersion: 1 }] },
    };
    // Same directive sequence, split into two flushes instead of one — an INFORMATIVE-only
    // change (REQ-GCC-03).
    const rechunked: TranscriptRecord = {
      ...base,
      informative: {
        batchGrouping: [
          { directiveCount: 1, protocolVersion: 1 },
          { directiveCount: 0, protocolVersion: 1 },
        ],
      },
    };

    expect(rechunked.normative).toEqual(base.normative);
    expect(rechunked.informative).not.toEqual(base.informative);
  });
});
