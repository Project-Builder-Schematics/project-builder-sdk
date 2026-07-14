/**
 * e2e — typed factory (REQ-FPS-04.1, REQ-TFO-01.1, REQ-RBV-01.1 site proof).
 * Drives the reference schematic (test/fixtures/typed-factory/) through the SAME
 * ContractFake seam the existing pyramid e2e uses — no engine (Executor Context driving
 * contract). Reject variant asserts the message (byte-unchanged) AND, since S-006, the
 * `instanceof AuthoringError`/origin/reason facets.
 */
import { describe, it, expect } from "bun:test";
import { run, PACKAGE_DIR } from "../fixtures/typed-factory/factory.ts";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import type { Input } from "../fixtures/typed-factory/schema.generated.ts";

// REQ-FPS-04.1 (bare-factory-migration): the fixture's own export is bare — this e2e test
// performs the ONE `defineFactory<Input>` wrap itself, exactly the runner/harness-internal
// usage the migration relocates `defineFactory` to.
const wrappedRun = defineFactory<Input>(run, { packageDir: PACKAGE_DIR });

describe("e2e — typed factory (schema-derived Input, run-boundary rejection)", () => {
  it("runs to completion and commits when the resolved input satisfies the schema", async () => {
    const fake = new ContractFake({ seed: {} });

    await wrappedRun({ port: 8080 }, { client: fake });

    expect(fake.committedTree()).toEqual(
      new Map([["server.config.ts", "export const port = {{port}};"]])
    );
  });

  it("rejects a resolved input missing the required 'port' key BEFORE the factory body runs (RBV-01.1 site proof)", async () => {
    const fake = new ContractFake({ seed: {} });

    let caught: unknown;
    try {
      await wrappedRun({} as Input, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as Error).message).toEqual("invalid input: port must be number");
    expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    // Site proof: nothing staged, nothing committed — the rejection happened before `fn`.
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.stagingTree().size).toEqual(0);
  });
});
