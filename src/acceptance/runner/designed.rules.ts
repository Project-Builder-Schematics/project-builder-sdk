/**
 * The report-only pass over `@sdk @status:designed`: it runs what it can and reports how each
 * scenario ends, but never fails. Run with `bun run rules:designed`.
 */
import { afterAll, test } from "bun:test";
import { STEP_DEFINITIONS } from "../step-definitions.ts";
import { loadPickles, requireArchitecture } from "./features.ts";
import { firstUndefinedStep, runScenario } from "./scenario.ts";
import { DESIGNED, select } from "./selection.ts";

if (requireArchitecture()) {
  const designed = select(loadPickles(), DESIGNED);
  const outcomes = { passed: 0, failed: 0, undefined: 0 };

  designed.forEach((pickle, index) => {
    test(`${pickle.feature} #${index}: ${pickle.name}`, async () => {
      if (firstUndefinedStep(pickle, STEP_DEFINITIONS) !== undefined) {
        outcomes.undefined++;
        return;
      }
      try {
        await runScenario(pickle, STEP_DEFINITIONS);
        outcomes.passed++;
      } catch (error) {
        outcomes.failed++;
        console.log(`rules:designed: ${pickle.feature}: ${pickle.name} fails: ${(error as Error).message}`);
      }
    });
  });

  afterAll(() => {
    console.log(
      `rules:designed: ${designed.length} selected, ${outcomes.passed} pass, ${outcomes.failed} fail, ${outcomes.undefined} with undefined steps`
    );
  });
}
