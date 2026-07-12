/**
 * S-000 — src/core/dialect-error.ts (kit-internal, no public symbol, out of every barrel).
 * REQ-DG-06.5's discriminator (design §4.1/ADR-0037 F1): a WeakSet brand, never a
 * message-prefix match. This file proves the factory + predicate in isolation before
 * dialect-handle.ts's #invokeContained consumes them.
 */
import { describe, it, expect } from "bun:test";
import { dialectError, isContained } from "../../src/core/dialect-error.ts";

describe("dialect-error — dialectError() + isContained() (WeakSet brand)", () => {
  it("dialectError(tail) builds a message with the frozen prefix and the given tail", () => {
    const err = dialectError('could not parse "a.ts" as TypeScript');
    expect(err.message).toBe('dialect operation failed: could not parse "a.ts" as TypeScript');
  });

  it("dialectError's result carries no .cause", () => {
    const err = dialectError("some tail");
    expect(err.cause).toBeUndefined();
  });

  it("isContained() is true for an error minted by dialectError()", () => {
    const err = dialectError("some tail");
    expect(isContained(err)).toBe(true);
  });

  it("isContained() is false for a plain foreign Error, even with a coincidentally matching prefix", () => {
    const foreign = new Error("dialect operation failed: pretending to be contained");
    expect(isContained(foreign)).toBe(false);
  });

  it("isContained() is false for a non-Error thrown value", () => {
    expect(isContained("just a string")).toBe(false);
    expect(isContained(undefined)).toBe(false);
    expect(isContained({ message: "dialect operation failed: fake" })).toBe(false);
  });

  it("two separate dialectError() calls are distinct, independently-branded instances", () => {
    const a = dialectError("tail-a");
    const b = dialectError("tail-b");
    expect(isContained(a)).toBe(true);
    expect(isContained(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});
