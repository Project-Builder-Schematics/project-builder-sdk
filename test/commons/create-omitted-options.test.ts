/**
 * SDK #60: `create()` called without `options` (an untyped JS factory, or Bun running TS without
 * a typecheck) must still produce a representable batch. The wire requires `options`, and an
 * `undefined` value vanishes in JSON, so the omitted bag is sent as `{}`.
 */
import { describe, it, expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { collectOps } from "../support/spy-client.ts";

const scratchDir = scratchDirFactory("create-omitted-options-");

describe("SDK #60 — create() without options", () => {
  it("an inline template with no options bag emits options: {} and the batch is accepted", async () => {
    const run = (): void => {
      // @ts-expect-error -- the type requires options; this is the untyped author path.
      create("hello.txt", { template: "hello" });
    };

    const result = await runFactoryForTest(run, {});

    expect(result.error).toBeUndefined();
    const [directive] = collectOps(result.emitted, "create");
    expect(directive?.create).toEqual({ pathTemplate: "hello.txt", template: "hello", options: {} });
  });

  it("a templateFile with no options bag emits options: {} and the batch is accepted", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "hello.txt.template"), "hello", "utf-8");
    const run = (): void => {
      // @ts-expect-error -- the type requires options; this is the untyped author path.
      create("hello.txt", { templateFile: "hello.txt.template" });
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });

    expect(result.error).toBeUndefined();
    const [directive] = collectOps(result.emitted, "create");
    expect(directive?.create.options).toEqual({});
  });

  it("an explicit options bag is still forwarded unchanged", async () => {
    const run = (): void => {
      create("hello.txt", { template: "hello {= .name =}", options: { name: "world" } });
    };

    const result = await runFactoryForTest(run, {});

    expect(result.error).toBeUndefined();
    const [directive] = collectOps(result.emitted, "create");
    expect(directive?.create.options).toEqual({ name: "world" });
  });
});
