/**
 * FIT-28 (REQ-FTG-01): corpus byte-determinism — the full non-engine-gated scenario set
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
import { readdirSync } from "node:fs";
import { captureRun } from "../support/ir-transcript.ts";
import { buildRecord, corpusFileNameFor, serializeCorpus } from "../support/corpus-format.ts";
import { SCENARIOS, runOptionsFor } from "../e2e/author-emulation/scenarios.ts";
import { run as nondeterministicRun } from "../fixtures/red/author-emulation/nondeterministic-factory.ts";

const CORPUS_DIR = new URL("../e2e/author-emulation/corpus/", import.meta.url).pathname;

async function renderTwice(
  scenario: Pick<(typeof SCENARIOS)[number], "run" | "input" | "seed" | "packageDir" | "id" | "slug">
): Promise<[string, string]> {
  const options = runOptionsFor(scenario);
  const first = serializeCorpus(
    buildRecord(await captureRun(scenario.run, scenario.input, options), {
      scenarioId: scenario.id,
      slug: scenario.slug,
    })
  );
  const second = serializeCorpus(
    buildRecord(await captureRun(scenario.run, scenario.input, options), {
      scenarioId: scenario.id,
      slug: scenario.slug,
    })
  );
  return [first, second];
}

describe("FIT-28 — corpus byte-determinism (in-process double-run, REQ-FTG-01)", () => {
  it("every non-engine-gated scenario produces byte-identical corpus content across two in-process runs", async () => {
    for (const scenario of SCENARIOS) {
      if (scenario.gated) continue; // Matrix rows (m-01..m-20) land in S-003/S-004.

      const [first, second] = await renderTwice(scenario);
      expect({ scenario: scenario.id, output: second }).toEqual({ scenario: scenario.id, output: first });
    }
  });

  // RED-PROOF: a factory that embeds a fresh value per run fails the double-run
  // comparison — proves FIT-28's check is a real, discriminating guard.
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

// One-shot stray/duplicate directory check (S-004, corpus regen procedure step (d)).
// FIT-28's double-run comparison above is an IN-PROCESS check — it never reads the corpus
// directory, so a renumber's stale OLD-filename transcripts (e.g. a leftover
// `m-17.no-existence-oracle-nonexisting.transcript.json` after M-17 was renumbered/retitled)
// would never surface there. Modeled on fit-40's directory-scan posture
// (`checkOrphanDirectories`): the directory listing must equal EXACTLY the id/slug set
// `scenarios.ts` declares, no more, no fewer.
describe("FIT-28b — corpus directory matches scenarios.ts exactly, no stray or duplicate transcript files", () => {
  it("every transcript file on disk is declared in scenarios.ts, and every declared id has exactly one file", () => {
    const expectedFiles = SCENARIOS.filter((s) => !s.gated).map((s) => corpusFileNameFor(s.id, s.slug));
    const expectedSet = new Set(expectedFiles);
    const actualFiles = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".transcript.json"));

    const violations: string[] = [];

    for (const f of actualFiles) {
      if (!expectedSet.has(f)) {
        violations.push(
          `FIT-28b: stray transcript file "${f}" matches no scenarios.ts id/slug — a stale filename left behind by a renumber (regen-corpus.ts step (b) manual deletion)`
        );
      }
    }

    for (const f of expectedFiles) {
      if (!actualFiles.includes(f)) {
        violations.push(`FIT-28b: expected transcript file "${f}" (declared in scenarios.ts) is missing from the corpus directory — run scripts/regen-corpus.ts`);
      }
    }

    const idCounts = new Map<string, number>();
    for (const f of actualFiles) {
      const id = f.split(".")[0]!;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of idCounts) {
      if (count > 1) {
        violations.push(`FIT-28b: scenario id "${id}" has ${count} transcript files on disk — a duplicate/orphaned filename`);
      }
    }

    expect(violations).toEqual([]);
  });
});
