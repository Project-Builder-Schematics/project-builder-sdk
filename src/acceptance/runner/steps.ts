import type { PickleStep } from "@cucumber/messages";
import { compilePhrase } from "./catalog.ts";

/** State one scenario's steps share; a fresh one per scenario. */
export type World = Record<string, unknown>;

export interface StepDefinition {
  /** The catalog phrase, copied exactly from `steps/CATALOG.md`. */
  readonly phrase: string;
  /** Receives the phrase's parameters in order, then the step's docstring or data table, if any. */
  readonly run: (world: World, args: readonly unknown[], step: PickleStep) => void | Promise<void>;
}

export type StepMatch =
  | { readonly kind: "defined"; readonly definition: StepDefinition; readonly args: readonly unknown[] }
  | { readonly kind: "undefined" }
  | { readonly kind: "ambiguous"; readonly phrases: readonly string[] };

export function matchStep(definitions: readonly StepDefinition[], text: string): StepMatch {
  const matches = definitions.flatMap((definition) => {
    const args = compilePhrase(definition.phrase).match(text);
    return args ? [{ definition, args: args.map((arg) => arg.getValue(null)) }] : [];
  });
  if (matches.length === 0) return { kind: "undefined" };
  if (matches.length > 1) return { kind: "ambiguous", phrases: matches.map((m) => m.definition.phrase) };
  return { kind: "defined", ...matches[0]! };
}
