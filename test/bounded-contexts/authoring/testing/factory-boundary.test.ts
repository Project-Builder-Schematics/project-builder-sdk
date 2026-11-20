/**
 * Author mistakes the SDK can see at the factory boundary, before anything reaches the engine:
 * a thrown nullish value fails the run with a real error, and every option value `create`
 * cannot encode rejects as an `AuthoringError` naming the option, never a raw error.
 */
import { describe, it, expect } from "bun:test";
import { runFactoryForTest } from "../../../../src/testing/index.ts";
import { create, AuthoringError } from "../../../../src/commons/index.ts";
import type { JsonValue } from "../../../../src/bounded-contexts/authoring/domain/valueobjects/wire.ts";

describe("a factory that throws a nullish value", () => {
  for (const thrown of [undefined, null]) {
    it(`fails the run with an error that says it threw ${String(thrown)}`, async () => {
      const result = await runFactoryForTest(() => {
        create("a.ts", { template: "a", options: {} });
        throw thrown;
      }, undefined);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe(`the factory threw ${String(thrown)}`);
      expect(result.tree.size).toBe(0);
    });
  }
});

/** The error a `create` with the option `d` set to `value` fails the run with. */
async function optionRejection(value: unknown): Promise<AuthoringError> {
  const result = await runFactoryForTest(() => {
    create("out/a.ts", { template: "a", options: { d: value as JsonValue } });
  }, undefined);
  expect(result.error).toBeInstanceOf(AuthoringError);
  expect(result.emitted).toHaveLength(0);
  const error = result.error as AuthoringError;
  expect(error.verb).toBe("create");
  expect(error.path).toBe("out/a.ts");
  expect(error.reason).toBe("invalid-input");
  expect(error.origin).toBe("authoring-rejected");
  return error;
}

const REJECTED = 'option "d" is not a plain-JSON value the engine can render';

describe("create option rejections are AuthoringErrors naming the option and the call", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  class Profile {}
  for (const [kind, value, detail] of [
    ["BigInt", 1n, "BigInt at d"],
    ["function", () => 1, "function at d"],
    ["symbol", Symbol("s"), "symbol at d"],
    ["circular", circular, "a circular reference at d.self"],
    ["Date", new Date(0), "Date at d"],
    ["Map", new Map(), "Map at d"],
    ["class instance", new Profile(), "a class instance at d"],
  ] as const) {
    it(`a ${kind}`, async () => {
      expect((await optionRejection(value)).message).toBe(
        `${REJECTED} (${detail}). Options must be strings, numbers, booleans, null, arrays, or plain objects.`
      );
    });
  }
});

describe("an object with a toJSON method", () => {
  it("is rejected as such, since options are plain data", async () => {
    expect((await optionRejection({ toJSON: () => "x" })).message).toBe(
      `${REJECTED} (an object with a toJSON method at d). Options must be strings, numbers, booleans, null, arrays, or plain objects.`
    );
  });

  it("is rejected where it is nested", async () => {
    expect((await optionRejection({ a: [{ toJSON: () => 1 }] })).message).toContain("(an object with a toJSON method at d.a[0])");
  });
});

describe("option values that would escape as raw errors", () => {
  it("a getter that throws rejects with the option's message, not the getter's error", async () => {
    const value = {
      get x(): never {
        throw new Error("getter!");
      },
    };
    const message = (await optionRejection(value)).message;
    expect(message).toStartWith(REJECTED);
    expect(message).not.toContain("getter!");
  });

  it("a proxy whose trap throws rejects with the option's message, not the trap's error", async () => {
    const value = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("trap!");
        },
      }
    );
    const message = (await optionRejection(value)).message;
    expect(message).toStartWith(REJECTED);
    expect(message).not.toContain("trap!");
  });

  it("a value nested about 50,000 levels deep rejects instead of overflowing the stack", async () => {
    let value: unknown = 1;
    for (let i = 0; i < 50_000; i++) value = { n: value };
    expect((await optionRejection(value)).message).toStartWith(REJECTED);
  });
});
