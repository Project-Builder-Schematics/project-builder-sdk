/**
 * boundary-pass-through REQ-01–04: `emit()` performs a JSON round-trip fidelity check —
 * a structural mismatch (silent-drop family: function/undefined/Symbol values) or a
 * stringify throw (BigInt/circular) both surface as an `emit` rejection, never an
 * uncaught crash and never a silent pass (ADR-0018 — the fake is the engine stand-in
 * and the sole judge of shape). Paths cross the seam verbatim (no normalization) and
 * intra-batch conflicts apply in author array order — both pre-existing fake behaviors,
 * pinned here so the round-trip/cap logic added to `emit` cannot regress them.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { create } from "../../src/commons/index.ts";
import { ContractFake } from "../support/contract-fake.ts";
import type { Batch, Directive, JsonValue } from "../../src/core/wire.ts";

function batch(...instructions: Directive[]): Batch {
  return { protocolVersion: 1, force: false, instructions };
}

function createOp(pathTemplate: string, template: string, options: JsonValue): Directive {
  return { op: "create", create: { pathTemplate, template, options } };
}

function deleteOp(path: string): Directive {
  return { op: "delete", delete: { path } };
}

// Smuggles a non-JsonValue past the type system — REQ-02's scenarios are values an author
// could only reach via `any`, matching the spec's "typed past JsonValue via any" framing.
function unsafeOptions(value: unknown): JsonValue {
  return value as JsonValue;
}

describe("boundary REQ-01.1 — structurally identical batch round-trips clean", () => {
  it("applies normally when options/content are plain JSON-compatible values", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batch(createOp("src/plain.ts", "content", { a: 1, b: "two", c: [true, null] })));

    expect(await fake.read("src/plain.ts")).toEqual("content");
  });
});

describe("boundary REQ-02.1 — function-valued option rejects (the killer case)", () => {
  it("rejects a create directive whose options holds a function value, never silently dropping it", async () => {
    const fake = new ContractFake({ seed: {} });
    const options = unsafeOptions({ handler: () => "unreachable" });

    await expect(fake.emit(batch(createOp("src/fn.ts", "content", options)))).rejects.toThrow(
      /round-trip fidelity/
    );
    expect(await fake.read("src/fn.ts")).toBeUndefined();
  });
});

describe("boundary REQ-02.2 — undefined-valued and Symbol-valued options reject (silent-drop family)", () => {
  it("rejects when an option value is undefined", async () => {
    const fake = new ContractFake({ seed: {} });
    const options = unsafeOptions({ missing: undefined });

    await expect(fake.emit(batch(createOp("src/undef.ts", "content", options)))).rejects.toThrow(
      /round-trip fidelity/
    );
    expect(await fake.read("src/undef.ts")).toBeUndefined();
  });

  it("rejects when an option value is a Symbol", async () => {
    const fake = new ContractFake({ seed: {} });
    const options = unsafeOptions({ tag: Symbol("s") });

    await expect(fake.emit(batch(createOp("src/sym.ts", "content", options)))).rejects.toThrow(
      /round-trip fidelity/
    );
    expect(await fake.read("src/sym.ts")).toBeUndefined();
  });
});

describe("boundary REQ-02.3 — BigInt and circular references reject (stringify-throw family)", () => {
  it("rejects as an emit rejection (not an uncaught crash) when an option value is a BigInt", async () => {
    const fake = new ContractFake({ seed: {} });
    const options = unsafeOptions({ big: 10n });

    await expect(fake.emit(batch(createOp("src/bigint.ts", "content", options)))).rejects.toThrow(
      /failed JSON serialization/
    );
    expect(await fake.read("src/bigint.ts")).toBeUndefined();
  });

  it("rejects as an emit rejection (not an uncaught crash) when options contains a circular reference", async () => {
    const fake = new ContractFake({ seed: {} });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      fake.emit(batch(createOp("src/circular.ts", "content", unsafeOptions(circular))))
    ).rejects.toThrow(/failed JSON serialization/);
    expect(await fake.read("src/circular.ts")).toBeUndefined();
  });
});

describe("boundary REQ-03.1 — an odd path crosses the seam unmodified [characterization]", () => {
  it("the emitted directive carries the exact literal path, unresolved, and a read of that literal key returns the content", async () => {
    const fake = new ContractFake({ seed: {} });
    const emitSpy = spyOn(fake, "emit");

    const run = defineFactory<void>(() => {
      create("../escaped.ts", { template: "content", options: {} });
    });

    await run(undefined, { client: fake });

    expect(emitSpy).toHaveBeenCalledTimes(1);
    const emittedBatch = emitSpy.mock.calls[0]![0] as Batch;
    const directive = emittedBatch.instructions[0]!;
    if (directive.op !== "create") throw new Error("fixture invariant broken: expected a create directive");
    expect(directive.create.pathTemplate).toEqual("../escaped.ts");
    // ADR-01: read() binds to staging, which commit() clears — after a completed run the
    // literal key's content lives in the committed tree, not via read().
    expect(fake.committedTree().get("../escaped.ts")).toEqual("content");
  });
});

describe("boundary REQ-04.1 — [create X, delete X] leaves X absent [characterization]", () => {
  it("a subsequent read returns undefined", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batch(createOp("X", "content", {}), deleteOp("X")));

    expect(await fake.read("X")).toBeUndefined();
  });
});

describe("boundary REQ-04.2 — [delete X, create X] leaves X present [characterization]", () => {
  it("a subsequent read returns the created content", async () => {
    const fake = new ContractFake({ seed: {} });

    await fake.emit(batch(deleteOp("X"), createOp("X", "content", {})));

    expect(await fake.read("X")).toEqual("content");
  });
});
