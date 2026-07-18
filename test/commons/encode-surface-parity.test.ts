/**
 * REQ-TOE-01.8 (S-001), REQ-TOE-04 (S-002), REQ-TOE-06 (S-003) — encode consistency across
 * every author-facing `create`-emitting surface (`commons.create()` inline/`templateFile`,
 * `scaffold` by-value expansion). This file grows per slice; S-001 seeded it with the
 * absent-options tolerance scenario, S-002 added the scheduling-time rejection scenario.
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

// REQ-TOE-06: the SAME encode step applies identically across every author-facing
// `create`-emitting surface — proven here as a [characterization]: S-000 wired
// `encodeOptions` into the ONE `DirectiveFactory.create()` call site, and every surface
// below (`commons.create()` inline, `create({templateFile})`, `scaffold` by-value
// expansion) already funnels through that single call site (design §4.1) — so this test
// proves the cross-surface invariant holds, it does not drive new production code.
const ANCHOR_METHODS = '[{"name":"load"}]';
const SHARED_METHODS = [{ name: "load" }];

describe("REQ-TOE-06.1 — inline vs scaffold by-value, both byte-identical to the absolute anchor [characterization]", () => {
  it("commons.create() inline and scaffold by-value both encode to the SAME anchor string — cross-equality alone would be insufficient", async () => {
    const inlineResult = await runFactoryForTest(() => {
      create("inline.ts", { template: "content", options: { methods: SHARED_METHODS } });
    }, undefined);
    const [inlineDirective] = collectOps(inlineResult.emitted, "create");

    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "index.ts"), "export const a = 1;", "utf-8");
    const scaffoldResult = await runFactoryForTest(
      () => {
        scaffold({ from: "files", to: "out", options: { methods: SHARED_METHODS } });
      },
      undefined,
      { packageDir: dir }
    );
    const [scaffoldDirective] = collectOps(scaffoldResult.emitted, "create");

    // The absolute anchor first — a shared encode-mutation bug making both surfaces wrong
    // identically would still pass a mere cross-equality check, so both are pinned to it.
    expect(inlineDirective?.create.options).toEqual({ methods: ANCHOR_METHODS });
    expect(scaffoldDirective?.create.options).toEqual({ methods: ANCHOR_METHODS });
    expect(inlineDirective?.create.options).toEqual(scaffoldDirective?.create.options);
  });
});

describe("REQ-TOE-06.2 — create({templateFile}) matches the inline surface and the REQ-TOE-06.1 anchor [characterization]", () => {
  it("templateFile-driven create() encodes to the SAME anchor as the inline-template surface", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "tpl.ts.template"), "content", "utf-8");

    const templateFileResult = await runFactoryForTest(
      () => {
        create("out.ts", { templateFile: "tpl.ts.template", options: { methods: SHARED_METHODS } });
      },
      undefined,
      { packageDir: dir }
    );
    const [templateFileDirective] = collectOps(templateFileResult.emitted, "create");

    const inlineResult = await runFactoryForTest(() => {
      create("inline.ts", { template: "content", options: { methods: SHARED_METHODS } });
    }, undefined);
    const [inlineDirective] = collectOps(inlineResult.emitted, "create");

    expect(templateFileDirective?.create.options).toEqual({ methods: ANCHOR_METHODS });
    expect(templateFileDirective?.create.options).toEqual(inlineDirective?.create.options);
  });
});
