// Maintainer-run regeneration (GCC-05 tautology guard, FIT-27 enforced): the ONLY writer
// of test/e2e/author-emulation/corpus/. Lives OUTSIDE the test-imported graph — never
// imported by any test file, not on `bun test`'s discovery glob (this file's name does
// not end in `.test.ts`). Regenerating the corpus is a deliberate, reviewed, out-of-band
// action — never something a test itself can trigger.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { captureRun } from "../test/support/ir-transcript.ts";
import { buildRecord, corpusFileNameFor, serializeCorpus } from "../test/support/corpus-format.ts";
import { SCENARIOS, runOptionsFor } from "../test/e2e/author-emulation/scenarios.ts";

const CORPUS_DIR = new URL("../test/e2e/author-emulation/corpus/", import.meta.url).pathname;

async function main(): Promise<void> {
  for (const scenario of SCENARIOS) {
    // Matrix rows (m-01..m-21) regenerate once S-003/S-004 land their factory surface.
    if (scenario.gated) continue;

    const capture = await captureRun(scenario.run, scenario.input, runOptionsFor(scenario));
    const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
    const text = serializeCorpus(record);

    const path = join(CORPUS_DIR, corpusFileNameFor(scenario.id, scenario.slug));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
    console.log(`wrote ${path}`);
  }
}

await main();
