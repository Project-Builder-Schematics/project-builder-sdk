import { describe, expect, it } from "bun:test";
import { compileFeature } from "../../../src/acceptance/runner/features.ts";
import { DESIGNED, IMPLEMENTED, select } from "../../../src/acceptance/runner/selection.ts";

const FEATURE = `@feature-tag
Feature: Tag inheritance

  @rule-tag
  Rule: A-1 A rule

    @sdk @status:implemented
    Scenario: A plain scenario
      Given a step

    @sdk @status:designed
    Scenario Outline: An outline
      Given a step with "<value>"

      @first-examples
      Examples:
        | value |
        | a     |
        | b     |

      @second-examples
      Examples:
        | value |
        | c     |
`;

describe("compileFeature", () => {
  const pickles = compileFeature(FEATURE, "fixture.feature");

  it("compiles one pickle per Scenario and one per Examples row", () => {
    expect(pickles.map((pickle) => pickle.steps[0]!.text)).toEqual([
      "a step",
      'a step with "a"',
      'a step with "b"',
      'a step with "c"',
    ]);
  });

  it("gives each pickle the Feature, Rule, Scenario and Examples tags", () => {
    expect(pickles.map((pickle) => pickle.tags)).toEqual([
      ["@feature-tag", "@rule-tag", "@sdk", "@status:implemented"],
      ["@feature-tag", "@rule-tag", "@sdk", "@status:designed", "@first-examples"],
      ["@feature-tag", "@rule-tag", "@sdk", "@status:designed", "@first-examples"],
      ["@feature-tag", "@rule-tag", "@sdk", "@status:designed", "@second-examples"],
    ]);
  });

  it("records the feature path on every pickle", () => {
    expect(new Set(pickles.map((pickle) => pickle.feature))).toEqual(new Set(["fixture.feature"]));
  });

  it("splits the scenarios between the strict and the report-only pass", () => {
    expect(select(pickles, IMPLEMENTED).length).toBe(1);
    expect(select(pickles, DESIGNED).length).toBe(3);
  });

  it("selects nothing that is not tagged @sdk", () => {
    const other = compileFeature("Feature: F\n\n  @engine @status:implemented\n  Scenario: S\n    Given a step\n", "f.feature");
    expect(select(other, IMPLEMENTED)).toEqual([]);
  });

  it("throws on a feature Gherkin cannot parse, naming the file", () => {
    const unevenTable = "Feature: F\n  Scenario Outline: S\n    Given <x>\n    Examples:\n      | x |\n      | 1 | 2 |\n";
    expect(() => compileFeature(unevenTable, "broken.feature")).toThrow("broken.feature: (6:7): inconsistent cell count");
  });
});
