/**
 * FIT-05: Only serializable bytes cross the seam.
 * JSON.parse(JSON.stringify(directive)) must deep-equal the original directive.
 * Activates in S-000 — polices the create shape.
 *
 * Red-proof: a directive with a non-serializable value (Function) must fail the roundtrip.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";
import type { Directive } from "../../src/core/wire.ts";
import { defineFactory } from "../../src/core/context.ts";
import * as ts from "../../src/dialects/typescript/index.ts";
import { makeSpyClient } from "../support/spy-client.ts";

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

  // REQ-FIT-05 extension (stage-5-first-dialect): a COALESCED dialect `modify` directive
  // (design's memoized lazy getter, resolved at flush) deep-equals its JSON round-trip — the
  // directive's content is a plain resolved string by construction (DirectiveFactory stays
  // AST-blind, ADR-0006), not only for hand-built directives.
  it("a coalesced dialect modify directive produced by a real TypeScript-dialect chain survives JSON roundtrip", async () => {
    const before = readFileSync(join(new URL("../dialects/typescript/golden/", import.meta.url).pathname, "add-import-before.txt"), "utf-8");
    const { client, emitted } = makeSpyClient({ "a.ts": before });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const directive = emitted.flatMap((b) => b.instructions).find((d) => d.op === "modify") as Directive;
    expect(directive).toBeDefined();
    const roundtripped = JSON.parse(JSON.stringify(directive)) as Directive;
    expect(roundtripped).toEqual(directive);
    expect(typeof (roundtripped as { modify: { content: unknown } }).modify.content).toBe("string");
  });

  // RED-PROOF (isSerializable helper): a directive with a function value fails the serializable check.
  it("[red-proof] a directive with a function value fails the serializable check", () => {
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

  // RED-PROOF (roundtrip toEqual path): a directive that mutates across JSON roundtrip
  // fails the same toEqual assertion the green tests use.
  it("[red-proof] a directive that mutates across JSON roundtrip fails the toEqual check", () => {
    // NaN serializes to null in JSON — JSON.parse(JSON.stringify(NaN)) === null.
    // So a directive with options: { count: NaN } becomes { count: null } after roundtrip,
    // which does NOT deep-equal the original. This exercises the exact toEqual path the
    // green tests assert ("roundtripped equals original").
    const mutatingDirective = {
      op: "create" as const,
      create: {
        pathTemplate: "a.ts",
        template: "",
        options: { count: NaN } as unknown as import("../../src/core/wire.ts").JsonValue,
      },
    } satisfies Directive;

    const roundtripped = JSON.parse(JSON.stringify(mutatingDirective)) as Directive;
    // After roundtrip: count is null (NaN → null), not NaN.
    expect(roundtripped).not.toEqual(mutatingDirective);
  });
});
