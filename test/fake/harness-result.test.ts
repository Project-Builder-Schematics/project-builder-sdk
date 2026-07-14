/**
 * REQ-ATH-01..10 (S-001): `runFactoryForTest`'s result contract — the founding-bug proof
 * (a write-only factory that buffers directives but is never observed to commit them) plus
 * the full commit/reject/throw/seed surface. Drives the facade through its real public
 * entry (`src/testing/index.ts`), never the raw kit internals directly — this suite proves
 * the re-export chain works, not just the underlying mechanics (those already have their
 * own coverage in test/fake/commit-discard.test.ts etc.).
 *
 * ATH-01.3 (ContractFake not exported by name) is FIT-08's red-proof — S-003 scope, not here.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory, runFactoryForTest } from "../../src/testing/index.ts";
import { create, find, replaceContent, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import type { Batch, JsonValue } from "../../src/core/wire.ts";

describe("REQ-ATH-01 — runFactoryForTest result shape", () => {
  it("REQ-ATH-01.1: happy-path shape — tree, single emitted batch, no error", async () => {
    const run = defineFactory<void>(() => {
      create("greeting.ts", { template: "hello", options: {} });
    });

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.get("greeting.ts")).toEqual("hello");
    expect(result.emitted.length).toEqual(1);
    expect(result.emitted[0]?.instructions[0]).toEqual({
      op: "create",
      create: { pathTemplate: "greeting.ts", template: "hello", options: {} },
    });
    expect(result.error).toBeUndefined();
  });

  it("REQ-ATH-01.2: result exposes no field beyond the three", async () => {
    const run = defineFactory<void>(() => {});

    const result = await runFactoryForTest(run, undefined);

    expect(Object.keys(result).sort()).toEqual(["emitted", "error", "tree"]);
  });
});

describe("REQ-ATH-02 — write-only factory commits at run end", () => {
  it("REQ-ATH-02.1: a factory that only buffers a create (never reads) still commits", async () => {
    const run = defineFactory<void>(() => {
      create("write-only.ts", { template: "founding-bug-proof", options: {} });
    });

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.get("write-only.ts")).toEqual("founding-bug-proof");
    expect(result.error).toBeUndefined();
  });
});

describe("REQ-ATH-03 — all-or-nothing rejection surfaces as empty tree + attributed error", () => {
  it("REQ-ATH-03.1: collision rejects fail-closed", async () => {
    const run = defineFactory<void>(() => {
      create("a.ts", { template: "new", options: {} });
    });

    const result = await runFactoryForTest(run, undefined, { "a.ts": "old" });

    expect(result.tree.size).toEqual(0);
    expect(result.error).toBeInstanceOf(AuthoringError);
    const err = result.error as AuthoringError;
    expect(err.verb).toEqual("create");
    expect(err.path).toEqual("a.ts");
    expect(err.reason).toEqual("path-collision");
  });

  it("REQ-ATH-03.2: multi-directive batch commits neither entry", async () => {
    const run = defineFactory<void>(() => {
      create("a.ts", { template: "new-a", options: {} });
      create("b.ts", { template: "new-b", options: {} });
    });

    const result = await runFactoryForTest(run, undefined, { "b.ts": "old-b" });

    expect(result.tree.has("a.ts")).toBe(false);
    expect(result.tree.has("b.ts")).toBe(false);
  });
});

describe("REQ-ATH-04 — seeded read visibility", () => {
  it("REQ-ATH-04.1: seed is readable; a replaceContent of seeded content lands in tree, the seed itself never does", async () => {
    let observed: string | undefined;
    const run = defineFactory<void>(async () => {
      observed = await find("a.ts").read();
      replaceContent("a.ts", "hello-modified");
    });

    const result = await runFactoryForTest(run, undefined, { "a.ts": "hello" });

    expect(observed).toEqual("hello");
    expect(result.tree.get("a.ts")).toEqual("hello-modified");
  });

  it("REQ-ATH-04.2: seeded empty string and absent-path read semantics", async () => {
    let emptyRead: string | undefined;
    let missingRead: string | undefined;
    const run = defineFactory<void>(async () => {
      emptyRead = await find("empty.ts").read();
      missingRead = await find("missing.ts").read();
    });

    await runFactoryForTest(run, undefined, { "empty.ts": "" });

    expect(emptyRead).toEqual("");
    expect(missingRead).toBeUndefined();
  });
});

describe("REQ-ATH-05 — empty factory yields empty tree, no error", () => {
  it("REQ-ATH-05.1: no-op factory, no seed", async () => {
    const run = defineFactory<void>(() => {});

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.size).toEqual(0);
    expect(result.error).toBeUndefined();
  });
});

describe("REQ-ATH-06 — factory throw discards staged writes, cause preserved", () => {
  it("REQ-ATH-06.1: factory throw propagates the exact original error instance", async () => {
    const thrown = new Error("boom");
    const run = defineFactory<void>(() => {
      create("buffered.ts", { template: "x", options: {} });
      throw thrown;
    });

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.has("buffered.ts")).toBe(false);
    expect(result.error).toBe(thrown);
  });
});

describe("REQ-ATH-07 — fresh fake per call, no cross-call state", () => {
  it("REQ-ATH-07.1: two sequential calls do not share state", async () => {
    const run1 = defineFactory<void>(() => {
      create("first.ts", { template: "one", options: {} });
    });
    const run2 = defineFactory<void>(() => {
      create("second.ts", { template: "two", options: {} });
    });

    const result1 = await runFactoryForTest(run1, undefined);
    const result2 = await runFactoryForTest(run2, undefined);

    expect([...result1.tree.keys()]).toEqual(["first.ts"]);
    expect([...result2.tree.keys()]).toEqual(["second.ts"]);
  });

  it("REQ-ATH-07.2: concurrent calls stay isolated", async () => {
    const runA = defineFactory<void>(async () => {
      const current = await find("shared.ts").read();
      replaceContent("shared.ts", `${current}-A`);
    });
    const runB = defineFactory<void>(async () => {
      const current = await find("shared.ts").read();
      replaceContent("shared.ts", `${current}-B`);
    });

    const pending1 = runFactoryForTest(runA, undefined, { "shared.ts": "seedA" });
    const pending2 = runFactoryForTest(runB, undefined, { "shared.ts": "seedB" });
    const [result1, result2] = await Promise.all([pending1, pending2]);

    expect(result1.tree.get("shared.ts")).toEqual("seedA-A");
    expect(result2.tree.get("shared.ts")).toEqual("seedB-B");
  });
});

describe("REQ-ATH-08 — outside-run verb calls are not laundered", () => {
  it("REQ-ATH-08.1: a verb invoked by test code via an escaped callback still throws outside-run", async () => {
    let captured: (() => void) | undefined;
    const run = defineFactory<{ capture: (fn: () => void) => void }>((input) => {
      input.capture(() => {
        create("escaped.ts", { template: "x", options: {} });
      });
    });

    await runFactoryForTest(run, {
      capture: (fn) => {
        captured = fn;
      },
    });

    expect(captured).toBeDefined();
    let thrown: unknown;
    try {
      captured!();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthoringError);
    expect((thrown as AuthoringError).reason).toEqual("outside-run");
  });
});

describe("REQ-ATH-09 — emission-validity boundaries", () => {
  it("REQ-ATH-09.1: a non-JSON-safe option value rejects with unrepresentable-content", async () => {
    const run = defineFactory<void>(() => {
      create("bad.ts", { template: "x", options: { fn: () => {} } as unknown as JsonValue });
    });

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.size).toEqual(0);
    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("unrepresentable-content");
  });

  // Cost note (QA-M4, spec Suite Cost Acknowledgement): these fixtures deliberately
  // approach the ~4 MiB BATCH_CAP_BYTES boundary. Byte-precise, mirroring
  // test/fake/batch-cap-fixtures.ts's technique but adapted to the `create` verb's wire
  // shape (extra `options` field) since the spec literal pins `create`, not `modify`.
  describe("REQ-ATH-09.2: batch-cap boundary (single `create`)", () => {
    const CAP_FIXTURE_PATH = "cap-fixture-create.ts";

    function createEnvelope(template: string): Batch {
      return {
        protocolVersion: 1,
        force: false,
        instructions: [{ op: "create", create: { pathTemplate: CAP_FIXTURE_PATH, template, options: {} } }],
      };
    }

    function serializedBytes(batch: Batch): number {
      return Buffer.byteLength(JSON.stringify(batch), "utf8");
    }

    function createTemplateOfSerializedBytes(target: number): string {
      const probe = serializedBytes(createEnvelope(""));
      const deficit = target - probe;
      if (deficit < 0) {
        throw new Error(
          `createTemplateOfSerializedBytes: target ${target} is smaller than the empty-template batch (${probe} bytes)`
        );
      }
      return "a".repeat(deficit);
    }

    it("a single create exceeding BATCH_CAP_BYTES rejects with changes-too-large", async () => {
      const overTemplate = createTemplateOfSerializedBytes(BATCH_CAP_BYTES + 1);
      const run = defineFactory<void>(() => {
        create(CAP_FIXTURE_PATH, { template: overTemplate, options: {} });
      });

      const result = await runFactoryForTest(run, undefined);

      expect(result.error).toBeInstanceOf(AuthoringError);
      expect((result.error as AuthoringError).reason).toEqual("changes-too-large");
      expect(result.tree.size).toEqual(0);
    });

    it("a batch one byte under the cap commits without error", async () => {
      const underTemplate = createTemplateOfSerializedBytes(BATCH_CAP_BYTES - 1);
      const run = defineFactory<void>(() => {
        create(CAP_FIXTURE_PATH, { template: underTemplate, options: {} });
      });

      const result = await runFactoryForTest(run, undefined);

      expect(result.error).toBeUndefined();
      expect(result.tree.get(CAP_FIXTURE_PATH)).toEqual(underTemplate);
    });
  });
});

describe("REQ-ATH-10 — unrendered-template non-promise", () => {
  it("REQ-ATH-10.1: template placeholders survive unrendered", async () => {
    const run = defineFactory<void>(() => {
      create("f.ts", { template: "export const {{name}} = 1;", options: { name: "x" } });
    });

    const result = await runFactoryForTest(run, undefined);

    expect(result.tree.get("f.ts")).toEqual("export const {{name}} = 1;");
  });
});
