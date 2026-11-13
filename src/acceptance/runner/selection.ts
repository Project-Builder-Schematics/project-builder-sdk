import { parse } from "@cucumber/tag-expressions";
import type { RulePickle } from "./features.ts";

/** The strict pass: every selected scenario must run green. */
export const IMPLEMENTED = "@sdk and @status:implemented";
/** The report-only pass: scenarios the SDK does not implement yet. */
export const DESIGNED = "@sdk and @status:designed";

export function select(pickles: readonly RulePickle[], expression: string): RulePickle[] {
  const node = parse(expression);
  return pickles.filter((pickle) => node.evaluate([...pickle.tags]));
}
