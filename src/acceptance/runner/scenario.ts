import type { PickleStep } from "@cucumber/messages";
import type { RulePickle } from "./features.ts";
import { matchStep, type StepDefinition, type World } from "./steps.ts";

function stepArgument(step: PickleStep): unknown[] {
  const argument = step.argument;
  if (argument?.docString) return [argument.docString.content];
  if (argument?.dataTable) return [argument.dataTable.rows.map((row) => row.cells.map((cell) => cell.value))];
  return [];
}

/** The scenario's first step with no step definition, or `undefined` when every step has one. */
export function firstUndefinedStep(pickle: RulePickle, definitions: readonly StepDefinition[]): string | undefined {
  return pickle.steps.find((step) => matchStep(definitions, step.text).kind === "undefined")?.text;
}

/** Runs every step in order with a fresh World. An undefined or ambiguous step throws. */
export async function runScenario(pickle: RulePickle, definitions: readonly StepDefinition[]): Promise<void> {
  const world: World = {};
  for (const step of pickle.steps) {
    const match = matchStep(definitions, step.text);
    if (match.kind === "undefined") throw new Error(`undefined step: ${step.text}`);
    if (match.kind === "ambiguous") throw new Error(`ambiguous step: ${step.text} (${match.phrases.join(" | ")})`);
    await match.definition.run(world, [...match.args, ...stepArgument(step)], step);
  }
}
