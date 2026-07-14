/**
 * S-001 — `addFunction` structured op (REQ-TSD-09.1–09.8, design §4.4/§4.5 ADR-0039).
 * Every content assertion is byte-exact against a committed golden (constraint 7).
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";
import { defineFactory } from "../../../src/core/context.ts";

describe("addFunction — REQ-TSD-09", () => {
  it("REQ-TSD-09.1: non-exported function added to an empty file", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("hi", "(): void {}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-function-non-exported.txt"));
  });

  it("REQ-TSD-09.2: exported function added (separate export arm)", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("hi", "(): void {}", { export: true });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-function-exported.txt"));
  });

  it("REQ-TSD-09.3: cross-kind collision (existing const) rejects with the pinned message naming the collision", async () => {
    const { client } = makeSpyClient({ "a.ts": "const foo = 1;\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("foo", "(): void {}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    // Options omitted (the common call form, per the spec's own scenarios): the path
    // channel must not collide with the optional `options` slot — asserted here via the
    // FULL pinned message including the `on "<path>"` clause, not just a loose substring.
    expect(err.message).toBe(
      'dialect operation failed: addFunction("foo") on "a.ts" — a value or import binding named "foo" already ' +
        "exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, " +
        "or edit it with .modify()."
    );
    expect(err.cause).toBeUndefined();
  });

  it("REQ-TSD-09.4: comment-only-file seed — comment preserved byte-exact, function inserted after", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-function-comment-only-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("hi", "(): void {}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-function-comment-only-after.txt"));
  });

  it("REQ-TSD-09.5: CRLF newline preservation — inserted declaration matches the file's CRLF convention", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-function-crlf-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("hi", "(): void {}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-function-crlf-after.txt"));
    expect(modifies[0]?.modify.content).toContain("\r\n");
  });

  it("REQ-TSD-09.6: run-twice byte-identical — same chain run twice against a fresh Project each time", async () => {
    async function runOnce(): Promise<string> {
      const { client, emitted } = makeSpyClient({ "a.ts": "" });
      const run = defineFactory<void>(async () => {
        await ts.find("a.ts").addFunction("hi", "(): void {}");
      });
      await run(undefined, { client });
      return collectModifies(emitted)[0]?.modify.content ?? "";
    }

    const first = await runOnce();
    const second = await runOnce();
    expect(first).toBe(second);
    expect(first).toBe(golden("add-function-non-exported.txt"));
  });

  it("REQ-TSD-09.7: import-binding collision rejects — an import binding is in the collision namespace", async () => {
    const { client } = makeSpyClient({ "a.ts": 'import { foo } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("foo", "(): void {}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toContain('addFunction("foo")');
    expect(err.message).toContain('a value or import binding named "foo" already exists');
    expect(err.cause).toBeUndefined();
  });

  it("final-verify fix (F-2): an existing CLASS declaration collides too — the getClass conjunct in assertNoCollision", async () => {
    const { client } = makeSpyClient({ "a.ts": "class Foo {}\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("Foo", "(): void {}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe(
      'dialect operation failed: addFunction("Foo") on "a.ts" — a value or import binding named "Foo" already ' +
        "exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, " +
        "or edit it with .modify()."
    );
    expect(err.cause).toBeUndefined();
  });

  it("REQ-TSD-09.8: a type-alias declaration under the same name does NOT collide", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-function-type-alias-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("foo", "(): void {}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-function-type-alias-after.txt"));
  });

  // Judgment-day round 1, Issue 3: an existing enum/namespace shares TypeScript's VALUE
  // namespace with function/const/class — assertNoCollision missed both conjuncts, letting
  // addFunction/addVariable emit invalid TS (TS2451, duplicate identifier). Extends the
  // collision namespace per ADR-0039's own rationale ("TypeScript forbids two value
  // declarations sharing a name"); the pinned message template is unchanged.
  it("an existing ENUM declaration collides too — the getEnum conjunct in assertNoCollision", async () => {
    const { client } = makeSpyClient({ "a.ts": "enum Foo { A }\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addFunction("Foo", "(): void {}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe(
      'dialect operation failed: addFunction("Foo") on "a.ts" — a value or import binding named "Foo" already ' +
        "exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, " +
        "or edit it with .modify()."
    );
    expect(err.cause).toBeUndefined();
  });

  it("an existing NAMESPACE declaration collides too — the getModule conjunct in assertNoCollision", async () => {
    const { client } = makeSpyClient({ "a.ts": "namespace Foo {}\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addVariable("Foo", "1");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe(
      'dialect operation failed: addVariable("Foo") on "a.ts" — a value or import binding named "Foo" already ' +
        "exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, " +
        "or edit it with .modify()."
    );
    expect(err.cause).toBeUndefined();
  });
});
