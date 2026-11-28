// A-120 / A-121 / A-122: what the role `evaluation` imposes on a factory, as data both codegen and
// the run boundary read, so the emitted types and the checked shape cannot drift apart.

import type { ResultSchema } from "./schema-model.ts";

/** The role a schematic declares in its Collection definition entry (CA-14). */
export type Role = "generator" | "setup" | "teardown" | "evaluation";

/** The inputs the role `evaluation` imposes; an author input with either name is rejected (A-122). */
export const SCOPE_INPUTS: readonly string[] = ["include", "exclude"];

const STRING: ResultSchema = { types: ["string"] };
const NUMBER: ResultSchema = { types: ["number"] };
const POSITION: ResultSchema = {
  types: ["object"],
  properties: [
    { key: "line", schema: NUMBER },
    { key: "column", schema: NUMBER },
  ],
  required: ["line", "column"],
};

function findingsWith(extra: NonNullable<ResultSchema["properties"]>): ResultSchema {
  const finding: ResultSchema = {
    types: ["object"],
    properties: [
      { key: "rule", schema: STRING },
      { key: "message", schema: STRING },
      { key: "severity", schema: { types: ["string"], choices: ["error", "warning"] } },
      { key: "path", schema: STRING },
      {
        key: "range",
        schema: {
          types: ["object"],
          properties: [
            { key: "start", schema: POSITION },
            { key: "end", schema: POSITION },
          ],
          required: ["start"],
        },
      },
      {
        key: "fix",
        schema: {
          types: ["object"],
          properties: [
            { key: "schematic", schema: STRING },
            { key: "inputs", schema: { types: ["object"] } },
          ],
          required: ["schematic"],
        },
      },
      ...extra,
    ],
    required: ["rule", "message", "severity"],
  };
  return { types: ["object"], properties: [{ key: "items", schema: { types: ["array"], items: finding } }], required: ["items"] };
}

/** The Findings an evaluation factory returns: what codegen emits as its Result type. */
export const FINDINGS: ResultSchema = findingsWith([]);

/**
 * FINDINGS with the `source` the SDK sets. The run boundary checks a returned value against it,
 * so an author-set `source` passes the shape check and is then rejected by name.
 */
export const SOURCED_FINDINGS: ResultSchema = findingsWith([{ key: "source", schema: STRING }]);
