// A-11 (architecture `authoring/rules/dialects.feature`): every op that sets a state is
// idempotent. An op whose effect depends on how many times it is applied (it adds again, or it
// acts on a position) is declared repeatable and not checked for idempotency.
import { describe, expect, it } from "bun:test";
import { testOpPack } from "../../src/conformance/index.ts";
import {
  isRepeatable,
  repeatable,
} from "../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import * as jsonOps from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/json/ops.ts";
import * as yamlDocuments from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/yaml/documents.ts";
import * as yamlStructural from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/yaml/structural.ts";
import {
  nonIdempotentOpViolationFixture,
  positionalOpViolationFixture,
  repeatableAddingOpFixture,
  repeatablePositionalOpFixture,
  throwingOnReapplyFixture,
} from "./planted/non-idempotent-op-violation.ts";

describe("A-11 — the conformance kit checks ops for idempotency", () => {
  it("[permanent-fixture] rejects an op that adds again on every application, when it is not declared repeatable", async () => {
    await expect(testOpPack(nonIdempotentOpViolationFixture)).rejects.toThrow(
      /A-11 idempotency — applying the chain \[edit\] again to its own result changed the file/
    );
  });

  it("[permanent-fixture] rejects an op that acts on a position and reaches another element, when it is not declared repeatable", async () => {
    await expect(testOpPack(positionalOpViolationFixture)).rejects.toThrow(/A-11 idempotency/);
  });

  it("an op that throws when applied to its own result is rejected with an A-11 message", async () => {
    await expect(testOpPack(throwingOnReapplyFixture)).rejects.toThrow(
      /A-11 idempotency — re-applying the chain \[edit\] to its own result threw: dialect operation failed: edit\(\) on "op-exercise\.lines" threw/
    );
  });

  it("accepts an op that adds again on every application when the dialect declares it repeatable", async () => {
    await expect(testOpPack(repeatableAddingOpFixture)).resolves.toBeUndefined();
  });

  it("accepts an op that acts on a position when the dialect declares it repeatable", async () => {
    await expect(testOpPack(repeatablePositionalOpFixture)).resolves.toBeUndefined();
  });
});

describe("repeatable()", () => {
  it("marks the op itself and returns it", () => {
    const push = (ast: string[], line: string): void => {
      ast.push(line);
    };
    expect(isRepeatable(push)).toBe(false);
    expect(repeatable(push)).toBe(push);
    expect(isRepeatable(push)).toBe(true);
  });
});

describe("A-11 — the SDK dialects declare exactly their repeatable ops", () => {
  const repeatableJson = ["insertItem", "appendItem", "removeItem", "moveItem"];
  const repeatableYaml = [...repeatableJson, "addDocument", "removeDocument"];
  const yamlOps: Record<string, unknown> = { ...yamlStructural, ...yamlDocuments };

  it("JSON: insertItem, appendItem, removeItem and moveItem", () => {
    const marked = Object.entries(jsonOps)
      .filter(([, value]) => isRepeatable(value))
      .map(([name]) => name);
    expect(marked.sort()).toEqual([...repeatableJson].sort());
  });

  it("YAML: the same four, plus addDocument and removeDocument", () => {
    const marked = Object.entries(yamlOps)
      .filter(([, value]) => isRepeatable(value))
      .map(([name]) => name);
    expect(marked.sort()).toEqual([...repeatableYaml].sort());
  });
});
