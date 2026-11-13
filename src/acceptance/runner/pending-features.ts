import type { RulePickle } from "./features.ts";
import { firstUndefinedStep } from "./scenario.ts";
import type { StepDefinition } from "./steps.ts";

export interface PendingFeature {
  /** Feature path relative to the architecture root. */
  readonly feature: string;
  /** The slice whose step definitions remove this row. */
  readonly slice: string;
}

/**
 * Features with `@sdk @status:implemented` scenarios whose steps are not defined yet. The strict
 * pass skips their scenarios and reports how many. Shrink-only: a row leaves when its slice
 * lands, and a row whose feature has no undefined step left fails as stale.
 */
export const PENDING_FEATURES: readonly PendingFeature[] = [
  { feature: "bounded-contexts/authoring/rules/json-dialect.feature", slice: "R1" },
  { feature: "bounded-contexts/authoring/rules/yaml-dialect.feature", slice: "R1" },
  { feature: "bounded-contexts/authoring/rules/chaining-rules.feature", slice: "R2" },
  { feature: "bounded-contexts/authoring/rules/content-as-truth.feature", slice: "R2" },
  { feature: "bounded-contexts/authoring/rules/dialects.feature", slice: "R2" },
  { feature: "bounded-contexts/authoring/rules/session.feature", slice: "R2" },
  { feature: "bounded-contexts/authoring/rules/stale-nodes.feature", slice: "R2" },
  { feature: "bounded-contexts/authoring/rules/typescript-dialect.feature", slice: "R3" },
  { feature: "bounded-contexts/authoring/rules/react-dialect.feature", slice: "R3" },
  { feature: "bounded-contexts/authoring/rules/css-dialect.feature", slice: "R4" },
  { feature: "bounded-contexts/authoring/rules/angular-dialect.feature", slice: "R4" },
  { feature: "bounded-contexts/authoring/rules/nestjs-dialect.feature", slice: "R4" },
  // Its steps need the dialect kit, which is not a public entry until sdk#103.
  { feature: "bounded-contexts/authoring/rules/dialect-composition.feature", slice: "sdk#103" },
];

/** The list may only shrink: lower this when a row leaves, never raise it. */
export const PENDING_CEILING = 13;

/**
 * The strict pass must select at least this many scenarios (pending ones included), so a pin
 * bump or a retag that drops scenarios fails instead of passing on fewer. Measured at v0.17.0.
 */
export const IMPLEMENTED_FLOOR = 346;

/** Rows that are no longer true: an unknown feature, a duplicate, or a feature with every step defined. */
export function stalePendingRows(
  rows: readonly PendingFeature[],
  implemented: readonly RulePickle[],
  definitions: readonly StepDefinition[]
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.feature)) problems.push(`${row.feature}: listed twice`);
    seen.add(row.feature);
    const pickles = implemented.filter((pickle) => pickle.feature === row.feature);
    if (pickles.length === 0) problems.push(`${row.feature}: no implemented @sdk scenario`);
    else if (pickles.every((pickle) => firstUndefinedStep(pickle, definitions) === undefined)) {
      problems.push(`${row.feature}: every step is defined, so the row is stale (${row.slice} landed)`);
    }
  }
  return problems;
}
