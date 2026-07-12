// S-004 — planted violation for REQ-DC-05 (round-trip slot, REQ-DC-01). [permanent-fixture]
// A dialect whose `print` ALWAYS appends an extra marker, so `print(parse(sample))` never
// byte-exact matches `sample` — proves testDialect's round-trip assertion is live, not a
// no-op. Uses the real `defineDialect` factory (no reason to hand-roll a fake Dialect
// object — only `ast.print` needs to be broken).
import { defineDialect } from "../../../src/core/define-dialect.ts";
import type { DialectFixture } from "../../../src/conformance/index.ts";

type BrokenAst = { text: string };

export const roundTripViolationDialect = defineDialect<BrokenAst, Record<string, never>>({
  extensions: [".broken"],
  ast: {
    parse: (source: string): BrokenAst => ({ text: source }),
    // BROKEN: corrupts the printed output — never round-trips byte-exact.
    print: (ast: BrokenAst): string => `${ast.text}/* mutated by round-trip-violation fixture */`,
  },
  ops: {},
});

export const roundTripViolationFixture: DialectFixture = {
  dialect: roundTripViolationDialect,
  samples: ["const x = 1;\n", "export const y = 2;\n"],
};
