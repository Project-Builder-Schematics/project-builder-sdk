// Type-level exhaustiveness pin (ADR-0021 mechanism, binding constraint 4 — lands with
// the type shape, not after). `switch(reason)` / `switch(origin)` with a `never` default
// arm MUST compile today over the CURRENT closed unions. Adding a 7th AuthoringReason
// (or a 3rd AuthoringOrigin) breaks THIS FILE at compile time — the type-level half of
// "growing these unions is a MAJOR change" (ADR-0020/0021), independent of the runtime
// `originFor()` switch inside authoring-error.ts. Strategy mirrors handle-types.test.ts's
// never-invoked-arrow precedent: tsc evaluates the body under `bunx tsc --noEmit`;
// runtime never calls it.
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { AuthoringReason, AuthoringOrigin } from "../../src/core/authoring-error.ts";

describe("AuthoringReason / AuthoringOrigin — exhaustive switch never-arm pin (ADR-0021)", () => {
  test("switch(reason) over all six AuthoringReason values reaches an arm; a 7th value fails this compile", () => {
    const _proof = (reason: AuthoringReason): string => {
      switch (reason) {
        case "path-collision":
        case "path-not-found":
        case "unrepresentable-content":
        case "changes-too-large":
        case "outside-run":
        case "unknown":
          return reason;
        default: {
          const _exhaustive: never = reason;
          return _exhaustive;
        }
      }
    };
    void _proof;
  });

  test("switch(origin) over both AuthoringOrigin values reaches an arm; a 3rd value fails this compile", () => {
    const _proof = (origin: AuthoringOrigin): string => {
      switch (origin) {
        case "write-rejected":
        case "authoring-rejected":
          return origin;
        default: {
          const _exhaustive: never = origin;
          return _exhaustive;
        }
      }
    };
    void _proof;
  });

  test("AuthoringReason is exactly the six closed values (type-level pin)", () => {
    expectTypeOf<AuthoringReason>().toEqualTypeOf<
      | "path-collision"
      | "path-not-found"
      | "unrepresentable-content"
      | "changes-too-large"
      | "outside-run"
      | "unknown"
    >();
  });

  test("AuthoringOrigin is exactly the two closed values (type-level pin)", () => {
    expectTypeOf<AuthoringOrigin>().toEqualTypeOf<"write-rejected" | "authoring-rejected">();
  });
});
