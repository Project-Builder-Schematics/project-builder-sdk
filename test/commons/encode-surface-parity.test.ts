/**
 * REQ-TOE-01.8 (S-001), REQ-TOE-04 (S-002), REQ-TOE-06 (S-003) — encode consistency across
 * every author-facing `create`-emitting surface (`commons.create()` inline/`templateFile`,
 * `scaffold` by-value expansion). This file grows per slice; S-001 seeds it with the
 * absent-options tolerance scenario only.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { scaffold, create, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { collectOps } from "../support/spy-client.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { rejectedRun } from "../support/rejection-capture.ts";
import type { JsonValue } from "../../src/core/wire.ts";

const scratchDir = scratchDirFactory("encode-surface-parity-");

describe("REQ-TOE-01.8 — options entirely absent does not crash", () => {
  it("a scaffold() call with no options argument at all schedules successfully — the encode step tolerates the absent value (defaults to {}, REQ-TOE-01.7)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "index.ts"), "export const a = 1;", "utf-8");

    const run = (): void => {
      scaffold({ from: "files", to: "out" }); // no `options` key at all
    };

    const result = await runFactoryForTest(run, undefined, { packageDir: dir });

    expect(result.error).toBeUndefined();
    const [createDirective] = collectOps(result.emitted, "create");
    expect(createDirective?.create.options).toEqual({});
  });
});

describe("REQ-TOE-04 (integration) — rejection surfaces at create() scheduling, before any directive enters the batch", () => {
  it("a create() call with a non-plain-JSON option value throws the plain Error naming the key — never an AuthoringError, and no directive is ever staged", async () => {
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("src/bad.ts", { template: "content", options: { when: new Date() } as unknown as JsonValue });
    });

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(AuthoringError);
    expect((caught as Error).message).toEqual(
      'option "when" is not a plain-JSON value the engine can render (Date at when). ' +
        "Options must be strings, numbers, booleans, null, arrays, or plain objects."
    );
    // Scheduling-time reject (before flush): nothing ever entered the batch.
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.stagingTree().size).toEqual(0);
  });
});
