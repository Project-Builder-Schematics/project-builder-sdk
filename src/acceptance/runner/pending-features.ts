import type { RulePickle } from "./features.ts";
import { firstUndefinedStep } from "./scenario.ts";
import type { StepDefinition } from "./steps.ts";

export interface PendingFeature {
  /** Feature path relative to the architecture root. */
  readonly feature: string;
  /** One scenario of the feature, by name; without it the row covers the whole feature. */
  readonly scenario?: string;
  /** The slice whose step definitions remove this row. */
  readonly slice: string;
}

const DIALECTS_FEATURE = "bounded-contexts/authoring/rules/dialects.feature";
// A conformance scenario needs a `Dialect` object, which no public entry offers until sdk#103.
const CONFORMANCE = "sdk#103";

/**
 * Features, or single scenarios, with `@sdk @status:implemented` scenarios whose steps are not
 * defined yet. The strict pass skips their scenarios and reports how many. Shrink-only: a row
 * leaves when its slice lands, and a row whose scenarios have no undefined step left fails as stale.
 */
export const PENDING_FEATURES: readonly PendingFeature[] = [
  {
    feature: "bounded-contexts/authoring/rules/content-as-truth.feature",
    scenario: "A single handle chains its ops into one content write and reads the file once",
    slice: "pending: read counter (issue TBD)",
  },
  { feature: DIALECTS_FEATURE, scenario: "A conforming Dialect passes the conformance fixture", slice: CONFORMANCE },
  { feature: DIALECTS_FEATURE, scenario: "A Dialect whose print changes an unedited file is rejected", slice: CONFORMANCE },
  {
    feature: DIALECTS_FEATURE,
    scenario: "A Dialect whose ops send several content writes for one chain is rejected",
    slice: CONFORMANCE,
  },
  { feature: DIALECTS_FEATURE, scenario: "A Dialect that accepts an undeclared extension is rejected", slice: CONFORMANCE },
  { feature: "bounded-contexts/authoring/rules/typescript-dialect.feature", slice: "R3" },
  { feature: "bounded-contexts/authoring/rules/react-dialect.feature", slice: "R3" },
  { feature: "bounded-contexts/authoring/rules/css-dialect.feature", slice: "R4" },
  { feature: "bounded-contexts/authoring/rules/angular-dialect.feature", slice: "R4" },
  // Its steps need the dialect kit, which is not a public entry until sdk#103.
  { feature: "bounded-contexts/authoring/rules/dialect-composition.feature", slice: "sdk#103" },
];

/** The list may only shrink: lower this when a row leaves, never raise it. */
export const PENDING_CEILING = 10;

/** Whether a row covers the scenario: its whole feature, or that one scenario of it. */
export function isPending(rows: readonly PendingFeature[], pickle: RulePickle): boolean {
  return rows.some((row) => covers(row, pickle));
}

function covers(row: PendingFeature, pickle: RulePickle): boolean {
  return row.feature === pickle.feature && (row.scenario === undefined || row.scenario === pickle.name);
}

const rowName = (row: PendingFeature): string => (row.scenario === undefined ? row.feature : `${row.feature}: ${row.scenario}`);

/**
 * The strict pass must select at least this many scenarios (pending ones included), so a pin
 * bump or a retag that drops scenarios fails instead of passing on fewer. Measured at v0.17.0.
 */
export const IMPLEMENTED_FLOOR = 346;

/** Rows that are no longer true: an unknown feature or scenario, a duplicate, or one with every step defined. */
export function stalePendingRows(
  rows: readonly PendingFeature[],
  implemented: readonly RulePickle[],
  definitions: readonly StepDefinition[]
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = rowName(row);
    if (seen.has(name)) problems.push(`${name}: listed twice`);
    seen.add(name);
    const pickles = implemented.filter((pickle) => covers(row, pickle));
    if (pickles.length === 0) problems.push(`${name}: no implemented @sdk scenario`);
    else if (pickles.every((pickle) => firstUndefinedStep(pickle, definitions) === undefined)) {
      problems.push(`${name}: every step is defined, so the row is stale (${row.slice} landed)`);
    }
  }
  return problems;
}
