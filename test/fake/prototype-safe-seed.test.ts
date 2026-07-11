/**
 * REQ-PSS-01 (QA finding, final-verify council): `ContractFake`'s seed lookup must not leak
 * the plain-object prototype chain. Storing the seed as `{ ...seed }` (plain-prototype) and
 * checking membership with `path in this.#seed` / bracket access means paths that happen to
 * name an inherited `Object.prototype` member ("__proto__", "constructor", "toString", ...)
 * are treated as PRESENT even when the caller never seeded them — `"__proto__" in {}` is
 * `true` in plain JS. A factory that legitimately writes to a path sharing one of those names
 * would spuriously collide against a seed entry that was never there.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";
import { batchOf, createOp } from "./directive-builders.ts";

describe("REQ-PSS-01 — seed lookup is prototype-chain safe", () => {
  it("REQ-PSS-01.1: create(\"__proto__\") with NO seed at all succeeds — no spurious collision", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batchOf(createOp("__proto__", "content")));

    expect(await fake.read("__proto__")).toEqual("content");
  });

  it("REQ-PSS-01.2: unseeded reads of other Object.prototype member names resolve undefined, not the inherited member", async () => {
    const fake = new ContractFake({ seed: {} });

    expect(await fake.read("constructor")).toBeUndefined();
    expect(await fake.read("toString")).toBeUndefined();
    expect(await fake.read("hasOwnProperty")).toBeUndefined();
    expect(await fake.read("valueOf")).toBeUndefined();
  });

  it("REQ-PSS-01.3: a literal \"constructor\" key, explicitly seeded, still reads back its seeded value", async () => {
    const fake = new ContractFake({ seed: { constructor: "seeded-value" } });

    const result = await fake.read("constructor");

    expect(result).toEqual("seeded-value");
  });

  it("REQ-PSS-01.4: Object.prototype is not polluted by construction or a \"__proto__\"-named write", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batchOf(createOp("__proto__", "x")));

    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});
