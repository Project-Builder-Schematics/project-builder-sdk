/**
 * REQ-DC-06: the kit's mandatory adversarial samples are format-neutral, so a dialect whose
 * parser rejects TypeScript syntax still passes them. The toy dialect below accepts only
 * strict JSON (plus the empty file), the narrowest format the SDK ships a dialect for.
 */
import { describe, it, expect } from "bun:test";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { testOpPack } from "../../src/conformance/index.ts";

type StrictJson = { text: string };

function parse(source: string): StrictJson {
  const body = source.replace(/^\uFEFF/, "");
  if (body.trim() !== "") JSON.parse(body);
  return { text: source };
}

const strictJsonDialect = defineDialect<StrictJson, {}>({
  extensions: [".json"],
  ast: { parse, print: (ast) => ast.text },
  ops: {},
});

const ops = defineOpPack<StrictJson, { setFlag: (ast: StrictJson) => void }>({
  setFlag: (ast) => {
    ast.text = ast.text.replace("false", "true");
  },
});

describe("REQ-DC-06 — mandatory samples are format-neutral", () => {
  it("a dialect that rejects TypeScript syntax passes the mandatory set", async () => {
    expect(() => parse("// just a comment, no statements\n")).toThrow();

    await expect(
      testOpPack({
        opPack: ops,
        baseDialect: withOps(strictJsonDialect, ops),
        exercises: [
          {
            seed: '{ "flag": false }\n',
            chain: [
              { op: "setFlag", args: [] },
              { modify: (ast: unknown) => void ((ast as StrictJson).text = '{ "flag": true, "x": 1 }\n') },
            ],
            expect: '{ "flag": true, "x": 1 }\n',
          },
        ],
      })
    ).resolves.toBeUndefined();
  });
});
