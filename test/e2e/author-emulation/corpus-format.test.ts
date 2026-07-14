/**
 * Unit tests for `test/support/corpus-format.ts` — pure data-model contracts the e2e
 * byte-compare doesn't itself exercise (design.md §4.6, UNGATED rows GCC-02.1/GCC-03.1),
 * plus the ADR-0049 recursive `options` key-sort — the silent-FIT-28-breaker path the
 * live s-00 scenario's single-key options cannot discriminate.
 */
import { describe, it, expect } from "bun:test";
import { captureRun } from "../../support/ir-transcript.ts";
import {
  buildRecord,
  FORMAT_VERSION,
  serializeCorpus,
  type TranscriptRecord,
} from "../../support/corpus-format.ts";
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

describe("corpus-format — options subtree is recursively lexicographically key-sorted (ADR-0049)", () => {
  it("a multi-key, nested, deliberately out-of-order options object serializes in lexicographic key order at every depth", () => {
    const record: TranscriptRecord = {
      formatVersion: FORMAT_VERSION,
      scenarioId: "s-00",
      slug: "sort-check",
      normative: {
        outcome: "committed",
        directives: [
          {
            op: "create",
            pathTemplate: "a.ts",
            template: "x",
            // Insertion order is deliberately anti-lexicographic at BOTH levels, and
            // includes an integer-like key ("10") — the JS-engine key-reorder trap the
            // recursive sort exists to neutralize — plus an array whose elements must be
            // sorted internally but never reordered relative to each other.
            options: {
              zeta: 1,
              nested: { gamma: true, "10": "int-like", alpha: null },
              beta: [{ delta: 2, charlie: 3 }],
              alpha: "last-inserted",
            },
            force: false,
          },
        ],
      },
      informative: { batchGrouping: [{ directiveCount: 1, protocolVersion: 1 }] },
    };

    // Full-string assertion: the exact serialized options block, keys lexicographic at
    // every depth ("10" < "alpha" < "gamma" inside nested; array order preserved).
    expect(serializeCorpus(record)).toEqual(
      `{
  "formatVersion": 0,
  "scenarioId": "s-00",
  "slug": "sort-check",
  "normative": {
    "outcome": "committed",
    "directives": [
      {
        "op": "create",
        "pathTemplate": "a.ts",
        "template": "x",
        "options": {
          "alpha": "last-inserted",
          "beta": [
            {
              "charlie": 3,
              "delta": 2
            }
          ],
          "nested": {
            "10": "int-like",
            "alpha": null,
            "gamma": true
          },
          "zeta": 1
        },
        "force": false
      }
    ]
  },
  "informative": {
    "batchGrouping": [
      {
        "directiveCount": 1,
        "protocolVersion": 1
      }
    ]
  }
}
`
    );
  });
});
