// Type-level exhaustiveness pin (REQ-RT-01.4, read-trichotomy-helper, DROPPABLE — CQ-1).
// `switch (state)` over `ContentState` with a `never` default arm MUST compile today over
// the CURRENT closed union — a 4th ContentState value breaks THIS FILE at compile time,
// giving authors exhaustive-switch parity with `reason`/`origin` (REQ-AEC-04.3). Strategy
// mirrors test/types/authoring-reason.test.ts's never-invoked-arrow precedent: tsc
// evaluates the body under `bunx tsc --noEmit`; runtime never calls it.
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { ContentState } from "../../src/commons/classify-content.ts";

describe("ContentState — exhaustive switch never-arm pin (REQ-RT-01.4)", () => {
  test("switch(state) over all three ContentState values reaches an arm; a 4th value fails this compile", () => {
    const _proof = (state: ContentState): string => {
      switch (state) {
        case "absent":
        case "empty":
        case "present":
          return state;
        default: {
          const _exhaustive: never = state;
          return _exhaustive;
        }
      }
    };
    void _proof;
  });

  test("ContentState is exactly the three closed values (type-level pin)", () => {
    expectTypeOf<ContentState>().toEqualTypeOf<"absent" | "empty" | "present">();
  });
});
