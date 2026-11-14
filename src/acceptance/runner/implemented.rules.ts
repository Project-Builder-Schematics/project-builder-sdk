/**
 * The strict pass over `@sdk @status:implemented`: an undefined, ambiguous or failing step fails
 * the run. Scenarios of a pending feature are skipped and counted. Run with `bun run rules:implemented`.
 */
import { expect, test } from "bun:test";
import { STEP_DEFINITIONS } from "../step-definitions.ts";
import { loadPickles, requireArchitecture } from "./features.ts";
import { IMPLEMENTED_FLOOR, PENDING_CEILING, PENDING_FEATURES, stalePendingRows } from "./pending-features.ts";
import { runScenario } from "./scenario.ts";
import { IMPLEMENTED, select } from "./selection.ts";

if (requireArchitecture()) {
  const implemented = select(loadPickles(), IMPLEMENTED);
  const pending = new Set(PENDING_FEATURES.map((row) => row.feature));
  const skipped = implemented.filter((pickle) => pending.has(pickle.feature)).length;
  console.log(
    `rules:implemented: ${implemented.length} selected, ${implemented.length - skipped} run, ${skipped} pending in ${pending.size} features`
  );

  test(`the pass selects at least ${IMPLEMENTED_FLOOR} scenarios`, () => {
    expect(implemented.length).toBeGreaterThanOrEqual(IMPLEMENTED_FLOOR);
  });

  test("every pending-features row is still true", () => {
    expect(stalePendingRows(PENDING_FEATURES, implemented, STEP_DEFINITIONS)).toEqual([]);
  });

  test(`the pending-features list has at most ${PENDING_CEILING} rows`, () => {
    expect(PENDING_FEATURES.length).toBeLessThanOrEqual(PENDING_CEILING);
  });

  implemented.forEach((pickle, index) => {
    const name = `${pickle.feature} #${index}: ${pickle.name}`;
    if (pending.has(pickle.feature)) test.skip(name, () => {});
    else test(name, () => runScenario(pickle, STEP_DEFINITIONS));
  });
}
