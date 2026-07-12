// S-005 fix (verify-in-loop-4 Finding #2) — planted violation for REQ-DC-08's `ast === null`
// branch specifically. [permanent-fixture]
// A fixture whose `parse` always returns `null` — distinct from identity-fixture-violation.ts's
// `ast === sample` branch: this exercises the null half of the real-base probe's 3-way OR
// independently, closing the triangulation gap verify-in-loop-4 flagged (only the identity
// branch had a dedicated fixture before this).
import { defineDialect } from "../../../src/core/define-dialect.ts";
import type { DialectFixture } from "../../../src/conformance/index.ts";

export const nullParseViolationDialect = defineDialect<null, Record<string, never>>({
  extensions: [".null-parse"],
  ast: {
    // BROKEN: parse always returns null — no AST is ever produced.
    parse: (): null => null,
    print: (): string => "",
  },
  ops: {},
});

export const nullParseViolationFixture: DialectFixture = {
  dialect: nullParseViolationDialect,
  samples: ["const x = 1;\n"],
};
