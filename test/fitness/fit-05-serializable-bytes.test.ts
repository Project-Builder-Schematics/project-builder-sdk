/**
 * FIT-05: Only serializable bytes cross the seam.
 * JSON.parse(JSON.stringify(directive)) must deep-equal the original directive.
 * Activates in S-000 — polices the create shape.
 *
 * Red-proof: a directive with a non-serializable value (Function) must fail the roundtrip.
 */
import { describe, it, expect } from "bun:test";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";
import type { Directive } from "../../src/core/wire.ts";

/**
 * Checks that a directive contains only JSON-serializable values.
 * Strategy: use a replacer to detect dropped or undefined-valued entries.
 * JSON.stringify with a replacer that returns the value lets us detect drops:
 * if a value is a function, the replacer receives it but JSON.stringify drops that key.
 * We compare key counts pre and post roundtrip to detect silent drops.
 */
function isSerializable(directive: Directive): boolean {
  try {
    const droppedKeys: string[] = [];
    const str = JSON.stringify(directive, (key, value) => {
      if (typeof value === "function" || typeof value === "undefined" || typeof value === "bigint") {
        droppedKeys.push(key);
      }
      return value as unknown;
    });
    if (str === undefined) return false;
    if (droppedKeys.length > 0) return false;
    const roundtripped = JSON.parse(str) as unknown;
    return JSON.stringify(roundtripped) === str;
  } catch {
    return false;
  }
}

describe("FIT-05 — only serializable bytes cross the seam", () => {
  it("create directive survives JSON roundtrip unchanged", () => {
    const factory = new DirectiveFactory();
    const directive = factory.create({
      pathTemplate: "src/{= name =}.ts",
      template: "export const x = 1;",
      options: { name: "foo", count: 3, flag: true, nested: { a: null } },
    });

    const roundtripped = JSON.parse(JSON.stringify(directive)) as Directive;
    expect(roundtripped).toEqual(directive);
  });

  it("create directive with force survives JSON roundtrip", () => {
    const factory = new DirectiveFactory();
    const directive = factory.create({
      pathTemplate: "a.ts",
      template: "",
      options: {},
      force: true,
    });

    const roundtripped = JSON.parse(JSON.stringify(directive)) as Directive;
    expect(roundtripped).toEqual(directive);
  });

  // RED-PROOF: a directive carrying a non-serializable value fails the check.
  it("[red-proof] a directive with a function value fails the serializable check", () => {
    // Deliberately inject a non-serializable value into an options-shaped object
    const badDirective = {
      op: "create" as const,
      create: {
        pathTemplate: "bad.ts",
        template: "",
        options: { fn: () => {} } as unknown as import("../../src/core/wire.ts").JsonValue,
      },
    } satisfies Directive;

    expect(isSerializable(badDirective)).toEqual(false);
  });
});
