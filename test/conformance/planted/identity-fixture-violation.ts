// S-005 — planted violation for REQ-DC-08 (real-base-dialect rule extended to testDialect).
// [permanent-fixture]
// A fixture whose `parse`/`print` are BOTH the identity function — a deliberately trivial
// non-real dialect. Without the real-base structural probe, `print(parse(sample)) === sample`
// would pass VACUOUSLY for every sample (identity round-trips everything). The probe rejects
// it before the round-trip assertion ever runs: `parse(sample)` returns the input string
// unchanged, never a distinct AST object.
import { defineDialect } from "../../../src/core/define-dialect.ts";
import type { DialectFixture } from "../../../src/conformance/index.ts";

export const identityFixtureViolationDialect = defineDialect<string, Record<string, never>>({
  extensions: [".identity"],
  ast: {
    // BROKEN: parse/print are both identity — no real AST is ever produced.
    parse: (source: string): string => source,
    print: (ast: string): string => ast,
  },
  ops: {},
});

export const identityFixtureViolationFixture: DialectFixture = {
  dialect: identityFixtureViolationDialect,
  samples: ["const x = 1;\n"],
};
