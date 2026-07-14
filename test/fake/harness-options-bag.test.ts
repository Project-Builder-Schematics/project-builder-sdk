/**
 * REQ-ATH-01.4, REQ-ATH-17.1, REQ-ATH-17.2 (S-000 completion, verify-in-loop-1 Finding 2 /
 * slices.md ruling R-10): runtime behavioral evidence for `runFactoryForTest`'s options bag
 * (`{seed?, packageDir?}`). `test/types/runfactoryfortest-shape.test.ts` only proves the TYPE
 * accepts the bag — it is `void`-wrapped and never executes. These tests drive the bag through
 * the harness's real public entry (`src/testing/index.ts`) and observe the runtime effect.
 *
 * [characterization]: the delegation code itself (`src/testing/index.ts:119-122`, already
 * landed in S-000) is not touched by this file — these tests pin already-implemented behaviour
 * reached through the harness facade, mirroring the same RED-first waiver `harness-opted-in
 * .test.ts` documents for its own ATH-13 cases.
 *
 * Only the 3 REQ-IDs S-000's own `Covers` line claims are exercised here (ATH-17.3's positive
 * fs-read oracle is S-002/S-006 scope, per slices.md's Covers table).
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, AuthoringError } from "../../src/commons/index.ts";

const FIXTURE_DIR = join(import.meta.dir, "../fixtures/harness-opted-in");

describe("REQ-ATH-01.4 — seed survives the options-bag migration", () => {
  it("[characterization] REQ-ATH-01.4: options.seed reaches ContractFake and is read on the collision path", async () => {
    const run = (_input: void) => {
      create("a.ts", { template: "new", options: {} });
    };

    const result = await runFactoryForTest(run, undefined, { seed: { "a.ts": "x" } });

    expect(result.tree.size).toEqual(0);
    expect(result.error).toBeInstanceOf(AuthoringError);
    const err = result.error as AuthoringError;
    expect(err.reason).toEqual("path-collision");
  });
});

describe("REQ-ATH-17 — packageDir as a runFactoryForTest option", () => {
  it("[characterization] REQ-ATH-17.1: schema-invalid input rejects when packageDir is present", async () => {
    const run = (_input: { port?: number }) => {
      create("server.config.ts", { template: "static content", options: {} });
    };

    const result = await runFactoryForTest(run, {}, { packageDir: FIXTURE_DIR });

    expect(result.tree.size).toEqual(0);
    expect(result.emitted).toEqual([]);
    expect(result.error).toBeInstanceOf(AuthoringError);
    const err = result.error as AuthoringError;
    expect(err.reason).toEqual("invalid-input");
  });

  it("[characterization] REQ-ATH-17.2: the SAME schema-shaped-invalid input runs unchanged when packageDir is absent", async () => {
    const run = (_input: { port?: number }) => {
      create("server.config.ts", { template: "static content", options: {} });
    };

    const result = await runFactoryForTest(run, {});

    expect(result.tree.get("server.config.ts")).toEqual("static content");
    expect(result.error).toBeUndefined();
  });
});
