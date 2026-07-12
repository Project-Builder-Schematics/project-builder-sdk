// S-005 — REQ-DC-06.2 compile-pin: `DialectFixture` has no field capable of disabling the six
// mandatory adversarial samples (REQ-DC-06) — a compile-level guarantee, not merely a runtime
// default. [permanent-fixture]
//
// Dead-call convention (test/types/define-dialect.test.ts): tsc still evaluates and enforces
// the @ts-expect-error directive even though the arrow never runs. If `DialectFixture` ever
// grows an opt-out field, the excess-property check below stops firing, `@ts-expect-error`
// becomes an unused directive, and `tsc --noEmit` fails — RED for the right reason.
import { describe, test } from "bun:test";
import type { Dialect } from "../../../src/core/define-dialect.ts";
import type { DialectFixture } from "../../../src/conformance/index.ts";

describe("REQ-DC-06.2 — DialectFixture has no opt-out field for mandatory adversarial samples", () => {
  test("attempting to disable mandatory-sample injection is a compile error", () => {
    const _negativeProof = () => {
      const _fixture: DialectFixture = {
        dialect: {} as Dialect,
        samples: [],
        // @ts-expect-error — DialectFixture has no field capable of disabling the six
        // mandatory adversarial samples; a contributor cannot opt out of injection.
        disableMandatorySamples: true,
      };
      void _fixture;
    };
    void _negativeProof;
  });
});
