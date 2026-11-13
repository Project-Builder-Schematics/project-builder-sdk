import { describe, expect, it } from "bun:test";
import { compileFeature } from "../../../src/acceptance/runner/features.ts";
import { stalePendingRows } from "../../../src/acceptance/runner/pending-features.ts";
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
