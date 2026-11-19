import { describe, expect, it } from "bun:test";
import { compileFeature } from "../../../src/acceptance/runner/features.ts";
import { isPending, stalePendingRows } from "../../../src/acceptance/runner/pending-features.ts";
import type { StepDefinition } from "../../../src/acceptance/runner/steps.ts";

const implemented = compileFeature("Feature: F\n  Scenario: S\n    Given a defined step\n", "a.feature");
const DEFINED: StepDefinition[] = [{ phrase: "a defined step", run: () => {} }];

describe("stalePendingRows", () => {
  it("accepts a row whose feature still has an undefined step", () => {
    expect(stalePendingRows([{ feature: "a.feature", slice: "R1" }], implemented, [])).toEqual([]);
  });

  it("flags a row whose feature has every step defined", () => {
    expect(stalePendingRows([{ feature: "a.feature", slice: "R1" }], implemented, DEFINED)).toEqual([
      "a.feature: every step is defined, so the row is stale (R1 landed)",
    ]);
  });

  it("flags a row for a feature with no implemented scenario", () => {
    expect(stalePendingRows([{ feature: "gone.feature", slice: "R1" }], implemented, [])).toEqual([
      "gone.feature: no implemented @sdk scenario",
    ]);
  });

  it("flags a feature listed twice", () => {
    const row = { feature: "a.feature", slice: "R1" };
    expect(stalePendingRows([row, row], implemented, [])).toEqual(["a.feature: listed twice"]);
  });
});

const twoScenarios = compileFeature(
  "Feature: F\n  Scenario: Defined\n    Given a defined step\n  Scenario: Undefined\n    Given an undefined step\n",
  "b.feature"
);

describe("a pending row that names one scenario", () => {
  const row = { feature: "b.feature", scenario: "Undefined", slice: "sdk#103" };

  it("covers that scenario only, so the feature's other scenarios run", () => {
    expect(twoScenarios.map((pickle) => isPending([row], pickle))).toEqual([false, true]);
  });

  it("is accepted while its scenario has an undefined step, whatever the other scenarios hold", () => {
    expect(stalePendingRows([row], twoScenarios, DEFINED)).toEqual([]);
  });

  it("is stale once its scenario has every step defined", () => {
    const definedRow = { ...row, scenario: "Defined" };
    expect(stalePendingRows([definedRow], twoScenarios, DEFINED)).toEqual([
      "b.feature: Defined: every step is defined, so the row is stale (sdk#103 landed)",
    ]);
  });

  it("is flagged when the feature has no implemented scenario of that name", () => {
    expect(stalePendingRows([{ ...row, scenario: "Renamed" }], twoScenarios, DEFINED)).toEqual([
      "b.feature: Renamed: no implemented @sdk scenario",
    ]);
  });

  it("is flagged when listed twice", () => {
    expect(stalePendingRows([row, row], twoScenarios, DEFINED)).toEqual(["b.feature: Undefined: listed twice"]);
  });
});
