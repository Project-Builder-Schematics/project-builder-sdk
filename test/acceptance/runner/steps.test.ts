import { describe, expect, it } from "bun:test";
import { phraseToExpression } from "../../../src/acceptance/runner/catalog.ts";
import { compileFeature } from "../../../src/acceptance/runner/features.ts";
import { firstUndefinedStep, runScenario } from "../../../src/acceptance/runner/scenario.ts";
import { matchStep, type StepDefinition } from "../../../src/acceptance/runner/steps.ts";

describe("phraseToExpression", () => {
  it("turns each quoted parameter into {string}", () => {
    expect(phraseToExpression('the file "{path}" has content "{text}"')).toBe("the file {string} has content {string}");
  });

  it("keeps quoted text that is not a parameter, and escapes Cucumber syntax", () => {
    expect(phraseToExpression('a path that starts with "../" (relative)')).toBe('a path that starts with "..\\/" \\(relative\\)');
  });
});

const written: string[] = [];
const DEFINITIONS: StepDefinition[] = [
  { phrase: 'the file "{path}" has content "{text}"', run: (_world, args) => void written.push(args.join("=")) },
  { phrase: 'the Dialect handle "{handle}" offers .modify()', run: () => {} },
  { phrase: 'the file "{path}" has the content:', run: (_world, args) => void written.push(args.join("|")) },
];

describe("matchStep", () => {
  it("matches a step against its catalog phrase and returns the parameters", () => {
    const match = matchStep(DEFINITIONS, 'the file "a.ts" has content "x"');
    expect(match.kind).toBe("defined");
    expect(match.kind === "defined" && match.args).toEqual(["a.ts", "x"]);
  });

  it("matches parentheses in a phrase as text", () => {
    expect(matchStep(DEFINITIONS, 'the Dialect handle "h" offers .modify()').kind).toBe("defined");
  });

  it("reports a step no definition matches as undefined", () => {
    expect(matchStep(DEFINITIONS, "an invented step").kind).toBe("undefined");
  });

  it("reports a step two definitions match as ambiguous", () => {
    const twice = [...DEFINITIONS, DEFINITIONS[0]!];
    expect(matchStep(twice, 'the file "a.ts" has content "x"').kind).toBe("ambiguous");
  });
});

describe("runScenario", () => {
  const [pickle] = compileFeature(
    'Feature: F\n  Scenario: S\n    Then the file "a.ts" has content "x"\n    And the file "b.ts" has the content:\n      """\n      body\n      """\n',
    "f.feature"
  );

  it("runs every step in order, passing the docstring after the parameters", async () => {
    written.length = 0;
    await runScenario(pickle!, DEFINITIONS);
    expect(written).toEqual(["a.ts=x", "b.ts|body"]);
  });

  it("throws on the first undefined step and names it", async () => {
    expect(firstUndefinedStep(pickle!, DEFINITIONS.slice(0, 1))).toBe('the file "b.ts" has the content:');
    await expect(runScenario(pickle!, DEFINITIONS.slice(0, 1))).rejects.toThrow('undefined step: the file "b.ts" has the content:');
  });
});
