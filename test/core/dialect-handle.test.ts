/**
 * S-001 — the coalescing dialect handle, driven against the toy dialect (test/fixtures/
 * toy-dialect). Covers REQ-MC-01/02/04/05/07 (modify-coalescing spec) and REQ-DG-05
 * (dialect-generics spec — .raw()/parse-failure containment, generic mechanism proof; the
 * real TypeScript dialect restates the SAME contract in S-002/S-003, constraint 3).
 *
 * Every coalescing assertion is content-verified, never count-only (slices constraint 7).
 * Every find()-only chain pre-seeds its target (flush-seed-rule, REQ-MC-04, Stage 3 §4.6b).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { dryRun } from "../../src/commons/index.ts";
import { makeSpyClient, collectModifies } from "../support/spy-client.ts";
import { toyDialect, PARSE_FAIL_SENTINEL, type ToyAst } from "../fixtures/toy-dialect/index.ts";

describe("dialect handle — coalescing (REQ-MC-01)", () => {
  it("REQ-MC-01.1: two distinguishable ops, no read, one modify, byte-exact content", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").push("push-line").raw((ast) => {
        (ast as ToyAst).push("raw-line");
      });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.path).toBe("a.toy");
    expect(modifies[0]?.modify.content).toBe("seed\npush-line\nraw-line");
  });

  it("REQ-MC-01.2: two independent handles on different paths coalesce independently", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed-a", "b.toy": "seed-b" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").push("a-line");
      await toyDialect.find("b.toy").push("b-line");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    const a = modifies.find((m) => m.modify.path === "a.toy");
    const b = modifies.find((m) => m.modify.path === "b.toy");
    expect(a?.modify.content).toBe("seed-a\na-line");
    expect(b?.modify.content).toBe("seed-b\nb-line");
  });
});

describe("dialect handle — split by read (REQ-MC-02)", () => {
  it("REQ-MC-02.1: split-by-read — edits, read, more edits -> exactly two modifies, byte-exact content", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      const handle = toyDialect.find("a.toy").push("push-line");
      await handle.read();
      handle.raw((ast) => {
        (ast as ToyAst).push("raw-line");
      });
      await handle;
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    expect(modifies[0]?.modify.path).toBe("a.toy");
    expect(modifies[0]?.modify.content).toBe("seed\npush-line");
    expect(modifies[1]?.modify.path).toBe("a.toy");
    expect(modifies[1]?.modify.content).toBe("seed\npush-line\nraw-line");
  });

  it("REQ-MC-02.2: mid-chain read observes the handle's own writes (not the seeded content)", async () => {
    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      const handle = toyDialect.find("a.toy").push("push-line");
      const readBack = await handle.read();
      expect(readBack).toBe("seed\npush-line");
    });
    await run(undefined, { client });
  });

  it("REQ-MC-02.3: a cross-path read mid-chain splits an open handle (global flush trigger)", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed-a", "b.toy": "seed-b" });

    const run = defineFactory<void>(async () => {
      const handleA = toyDialect.find("a.toy").push("push-line");
      // Awaiting handleA first ensures its edit is genuinely applied (staged, uncommitted)
      // BEFORE b.toy's read fires — REQ-MC-02.3's GIVEN is "left with an uncommitted
      // edit, THEN a read", a precondition ordering, not a same-tick race.
      await handleA;
      await toyDialect.find("b.toy").read(); // unrelated path, but flush is GLOBAL (ADR-0015)
      handleA.raw((ast) => {
        (ast as ToyAst).push("raw-line");
      });
      await handleA;
    });
    await run(undefined, { client });

    const modifiesA = collectModifies(emitted).filter((m) => m.modify.path === "a.toy");
    expect(modifiesA).toHaveLength(2);
    expect(modifiesA[0]?.modify.content).toBe("seed-a\npush-line");
    expect(modifiesA[1]?.modify.content).toBe("seed-a\npush-line\nraw-line");
  });
});

describe("dialect handle — flush-seed-rule (REQ-MC-04)", () => {
  // [characterization] REQ-MC-04.1: an unseeded find()-only AST chain fails. Per REQ-MC-04's
  // OWN reconciliation note, the dialect handle's first-op existence check (this handle's
  // own not-found containment, REQ-DG-05/REQ-TSD-03.4's layer) fires BEFORE the ADR-0017
  // engine-side run-end backstop ever gets a chance to — the operative test-authoring
  // guidance (always seed a find()-only target) holds regardless of which layer fires first.
  it("rejects with the frozen not-found error when the target was never seeded", async () => {
    const { client } = makeSpyClient({}); // deliberately unseeded

    const run = defineFactory<void>(async () => {
      await toyDialect.find("missing.toy").push("line");
    });

    await expect(run(undefined, { client })).rejects.toThrow(
      'dialect operation failed: "missing.toy" does not exist — create it first in this run'
    );
  });
});

describe("dialect handle — dryRun over a coalesced chain (REQ-MC-05)", () => {
  it("REQ-MC-05.1: shows exactly one planned modify, without triggering AST re-serialization", async () => {
    const { client } = makeSpyClient({ "a.toy": "seed" });

    let printCalls = 0;
    const spiedDialect = defineDialect({
      extensions: [".toy"],
      ast: {
        parse(source: string): ToyAst {
          return source.split("\n");
        },
        print(ast: ToyAst): string {
          printCalls += 1;
          return ast.join("\n");
        },
      },
      ops: {},
    });
    const spiedOps = withOps(spiedDialect, defineOpPack<ToyAst, { push: (ast: ToyAst, line: string) => void }>({
      push(ast, line) {
        ast.push(line);
      },
    }));

    const run = defineFactory<void>(async () => {
      const handle = spiedOps.find("a.toy").push("line1").push("line2");
      // Awaiting the handle (not `.read()`) waits for both pushes to apply and the
      // directive to open, WITHOUT triggering the lazy content getter — only settle()
      // (the run-end drain) or a flush ever forces that.
      await handle;

      const plan = dryRun();
      expect(plan).toEqual([{ verb: "modify", path: "a.toy" }]);
      expect(printCalls).toBe(0);
    });
    await run(undefined, { client });

    expect(printCalls).toBe(1);
  });
});

describe("dialect handle — same-path scoping (REQ-MC-07)", () => {
  it("REQ-MC-07.1: sequential awaited same-path handles produce cumulative split modifies", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").push("first");
      await toyDialect.find("a.toy").push("second");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    expect(modifies[0]?.modify.content).toBe("seed\nfirst");
    expect(modifies[1]?.modify.content).toBe("seed\nfirst\nsecond");
  });
});

describe("dialect handle — .raw() and parse-failure containment (REQ-DG-05)", () => {
  it("REQ-DG-05.1: a throwing .raw callback is contained — frozen prefix + tail, no .cause", async () => {
    const SECRET_MARKER = "PLANTED_NATIVE_INTERNAL_9f3a";
    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      toyDialect.find("a.toy").raw(() => {
        const native = new Error(`boom ${SECRET_MARKER}`);
        (native as unknown as Record<string, unknown>).internalNode = { marker: SECRET_MARKER };
        throw native;
      });
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: raw() on "a.toy" threw');
    expect(err.cause).toBeUndefined();

    // council fix pass (QA F2): sweep EVERY own property (not just message/.cause) for the
    // planted secret marker — proves the native error object was discarded wholesale at the
    // wrap site (a fresh Error, per module doc), not merely stripped of one named field.
    for (const prop of Object.getOwnPropertyNames(err)) {
      const value = (err as unknown as Record<string, unknown>)[prop];
      expect(String(value)).not.toContain(SECRET_MARKER);
    }
  });

  it("REQ-DG-05.2: an unparseable target is contained the same way as REQ-DG-05.1", async () => {
    const { client } = makeSpyClient({ "a.toy": PARSE_FAIL_SENTINEL });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").push("line");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: could not parse "a.toy" as TypeScript');
    expect(err.cause).toBeUndefined();
  });
});

describe("dialect handle — async .raw() containment (council fix pass, security note 1, ADR-0037)", () => {
  it("an async .raw callback that rejects is contained the same as a sync throw, with no unhandledRejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      // Deliberately not awaited by the author — the run-boundary join must still observe
      // the async rejection through the SAME containment as a sync throw.
      toyDialect.find("a.toy").raw(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("boom-async");
      });
      await new Promise((resolve) => setTimeout(resolve, 15));
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }

    // Give any stray unhandledRejection a chance to surface before asserting.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: raw() on "a.toy" threw');
    expect(err.cause).toBeUndefined();
    expect(unhandled).toEqual([]);
  });

  it("an async .raw callback that resolves after a delay has its mutation included in the coalesced modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").raw(async (ast) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        (ast as ToyAst).push("async-line");
      });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("seed\nasync-line");
  });
});
