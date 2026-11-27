/**
 * A-14 / E-40 regression probes from the independent verifier of the root Result: declared
 * Results are committed as copies, undeclared ones fail, non-JSON shapes fail without echoing
 * the value, and the 1 MiB ceiling counts UTF-8 bytes of the JSON encoding.
 */
import { describe, it, expect } from "bun:test";
import { create, AuthoringError } from "../../src/commons/index.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { seedSchema } from "../support/canary.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
const dirOf = scratchDirFactory("result-probe-");
const pkg = (result?: unknown) => { const d = dirOf(); seedSchema(d, result === undefined ? { properties: {} } : { properties: {}, result }); return d; };
const ret = (v: unknown) => () => { create("r.txt", { template: "root", options: {} }); return v as any; };
const fails = (run: any, text?: string) => {
  expect(run.error).toBeInstanceOf(AuthoringError);
  expect(run.error.reason).toBe("invalid-result");
  expect(run.error.origin).toBe("authoring-rejected");
  expect(String(run.error.message)).not.toContain("SECRET");
  if (text) expect(String(run.error.message)).toContain(text);
  expect(run.tree.size).toBe(0);
  expect(run.result).toBeUndefined();
};
describe("A-14 / E-40 — Result boundary probes", () => {
  it("declared string/null/object sent and returned", async () => {
    let r = await runFactoryForTest(ret("hello"), {}, { packageDir: pkg({ type: "string" }) });
    expect(r.error).toBeUndefined(); expect(r.result).toBe("hello"); expect(r.tree.get("r.txt")).toBe("root");
    r = await runFactoryForTest(ret(null), {}, { packageDir: pkg({ type: "null" }) });
    expect(r.error).toBeUndefined(); expect(r.result).toBeNull();
    const obj = { a: 1, b: [1, "x", null], c: { d: true } };
    r = await runFactoryForTest(ret(obj), {}, { packageDir: pkg({ type: "object" }) });
    expect(r.error).toBeUndefined(); expect(r.result).toEqual(obj); expect(r.result).not.toBe(obj);
    r = await runFactoryForTest(ret({ a: 1 }), {}, { packageDir: pkg({ type: "object", properties: { a: { type: "number" }, b: { type: "string" } }, required: ["a"] }) });
    expect(r.error).toBeUndefined(); expect(r.result).toEqual({ a: 1 });
  });
  it("undeclared, nothing returned: ok, result undefined", async () => {
    let r = await runFactoryForTest(ret(undefined), {}, { packageDir: pkg() });
    expect(r.error).toBeUndefined(); expect(r.result).toBeUndefined(); expect(r.tree.get("r.txt")).toBe("root");
    r = await runFactoryForTest(ret(undefined), {});
    expect(r.error).toBeUndefined(); expect(r.result).toBeUndefined();
  });
  it("value returned with no declaration fails, nothing written", async () => {
    for (const v of ["SECRET", 0, false, null, {}]) {
      fails(await runFactoryForTest(ret(v), {}, { packageDir: pkg() }), "declares no Result");
      fails(await runFactoryForTest(ret(v), {}), "declares no Result");
    }
  });
  it("invalid shapes fail without echo", async () => {
    class K { x = "SECRET"; }
    const cyc: any = { s: "SECRET" }; cyc.self = cyc;
    const getter = { get g() { throw new Error("SECRET"); } };
    const cases: Array<[unknown, unknown]> = [
      [() => "SECRET", { type: "object" }], [{ f: () => "SECRET" }, { type: "object" }], [new Date(), { type: "object" }],
      [new Map([["SECRET", 1]]), { type: "object" }], [cyc, { type: "object" }], [undefined, { type: "string" }],
      [{ a: undefined, s: "SECRET" }, { type: "object" }], [[undefined], { type: "array" }], [NaN, { type: "number" }],
      [Infinity, { type: "number" }], [{ n: -Infinity }, { type: "object" }], [10n, { type: "number" }], [{ toJSON: () => "SECRET" }, { type: "object" }],
      [getter, { type: "object" }], [new K(), { type: "object" }], [Symbol("SECRET"), { type: "string" }], [[1, , 3], { type: "array" }],
      ["SECRET", { type: "number" }], [{ s: "SECRET", extra: 1 }, { type: "object", properties: { s: { type: "string" } } }],
      [{}, { type: "object", properties: { s: { type: "string" } }, required: ["s"] }],
    ];
    for (const [v, d] of cases) fails(await runFactoryForTest(ret(v), {}, { packageDir: pkg(d) }));
  });
  it("1 MiB ceiling exact passes, +1 fails, bytes not chars", async () => {
    const d = { type: "string" };
    let r = await runFactoryForTest(ret("a".repeat(1048574)), {}, { packageDir: pkg(d) }); expect(r.error).toBeUndefined(); expect((r.result as string).length).toBe(1048574);
    fails(await runFactoryForTest(ret("a".repeat(1048575)), {}, { packageDir: pkg(d) }), "1048577");
    r = await runFactoryForTest(ret("é".repeat(524287)), {}, { packageDir: pkg(d) }); expect(r.error).toBeUndefined();
    fails(await runFactoryForTest(ret("é".repeat(524287) + "a"), {}, { packageDir: pkg(d) }));
    fails(await runFactoryForTest(ret('"'.repeat(524288)), {}, { packageDir: pkg(d) }));
  });
  it("invalid declaration fails like an unreadable schema", async () => {
    const r = await runFactoryForTest(ret("x"), {}, { packageDir: pkg({ type: "integer" }) });
    expect(r.error).toBeDefined(); expect(r.tree.size).toBe(0);
  });
});
