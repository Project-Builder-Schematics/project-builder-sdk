/**
 * S-003 — `addVariable`/`addClass` structured ops (REQ-TSD-10.1–10.4, REQ-TSD-11.1–11.4,
 * design §4.4/§4.5 ADR-0039). Every content assertion is byte-exact against a committed
 * golden (constraint 7).
 *
 * [cut-lever isolate] — cutting REQ-TSD-10/11 (owner-authorised, slices.md S-003 Cuttable)
 * deletes this file WHOLE, plus its golden rows, in one atomic commit. Nothing outside this
 * file depends on its contents.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";
import { defineFactory } from "../../../src/core/context.ts";

describe("addVariable — REQ-TSD-10", () => {
  it("REQ-TSD-10.1: non-exported const added (default kind)", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addVariable("PI", "3.14159");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-variable-non-exported.txt"));
  });

  it("REQ-TSD-10.2: exported variable, explicit kind", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addVariable("counter", "0", { export: true, kind: "let" });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-variable-exported-let.txt"));
  });

  it("REQ-TSD-10.3: same-name collision rejects (own scenario)", async () => {
    const { client } = makeSpyClient({ "a.ts": "function bar() {}\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addVariable("bar", "1");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toContain('addVariable("bar")');
    expect(err.message).toContain('a value or import binding named "bar" already exists');
    expect(err.cause).toBeUndefined();
  });

  it("REQ-TSD-10.4: empty-file seed, explicit non-default kind — no spurious whitespace", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addVariable("total", "0", { kind: "var" });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-variable-var-kind.txt"));
  });
});

describe("addClass — REQ-TSD-11", () => {
  it("REQ-TSD-11.1: non-exported class added", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addClass("Point", "  x = 0;\n  y = 0;");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-class-non-exported.txt"));
  });

  it("REQ-TSD-11.2: exported class added", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addClass("Point", "  x = 0;", { export: true });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-class-exported.txt"));
  });

  it("REQ-TSD-11.3: same-name collision rejects (own scenario)", async () => {
    const { client } = makeSpyClient({ "a.ts": "const Baz = 1;\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addClass("Baz", "");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toContain('addClass("Baz")');
    expect(err.message).toContain('a value or import binding named "Baz" already exists');
    expect(err.cause).toBeUndefined();
  });

  it("REQ-TSD-11.4: empty-file seed — no spurious whitespace", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addClass("Empty", "  value = null;");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-class-empty-file-seed.txt"));
  });
});
