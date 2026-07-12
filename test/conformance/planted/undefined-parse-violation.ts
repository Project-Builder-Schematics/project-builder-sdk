// S-005 fix (verify-in-loop-4 Finding #2) — planted violation for REQ-DC-08's
// `ast === undefined` branch specifically. [permanent-fixture]
// A fixture whose `parse` always returns `undefined` — distinct from
// identity-fixture-violation.ts's `ast === sample` branch and null-parse-violation.ts's
// `ast === null` branch: this exercises the THIRD, remaining half of the real-base probe's
// 3-way OR independently (verify-in-loop-4 Finding #2, triangulation gap).
import { defineDialect } from "../../../src/core/define-dialect.ts";
import type { DialectFixture } from "../../../src/conformance/index.ts";

export const undefinedParseViolationDialect = defineDialect<undefined, Record<string, never>>({
  extensions: [".undefined-parse"],
  ast: {
    // BROKEN: parse always returns undefined — no AST is ever produced.
    parse: (): undefined => undefined,
    print: (): string => "",
  },
  ops: {},
});

export const undefinedParseViolationFixture: DialectFixture = {
  dialect: undefinedParseViolationDialect,
  samples: ["const x = 1;\n"],
};
