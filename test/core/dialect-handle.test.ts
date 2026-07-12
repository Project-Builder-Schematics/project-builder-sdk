/**
 * S-001 — the coalescing dialect handle, driven against the toy dialect (test/fixtures/
 * toy-dialect). Covers REQ-MC-01/02/04/05/07 (modify-coalescing spec) and REQ-DG-05
 * (dialect-generics spec — .raw()/parse-failure containment, generic mechanism proof; the
 * real TypeScript dialect restates the SAME contract in S-002/S-003, constraint 3).
 *
 * S-000 (stage-5b-dialect-breadth) additionally covers REQ-DG-06 (runOp containment parity
 * with .raw()) and REQ-DG-07.3 (fail-closed poison flag, same+different handle) against a
 * dedicated synthetic op-pack (constraint 7 — no op-level collision reject exists yet at
 * this point in the build), plus the mutation-gated #ensureOpen mechanism and a no-reparse
 * proof.
 *
 * Every coalescing assertion is content-verified, never count-only (slices constraint 7).
 * Every find()-only chain pre-seeds its target (flush-seed-rule, REQ-MC-04, Stage 3 §4.6b).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { dialectError } from "../../src/core/dialect-error.ts";
import { dryRun } from "../../src/commons/index.ts";
import * as ts from "../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../support/spy-client.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { toyDialect, PARSE_FAIL_SENTINEL, type ToyAst } from "../fixtures/toy-dialect/index.ts";
import { asyncRejectingOp } from "../fixtures/red/dialect-generics/async-op-rejects.ts";

// S-000 — a dedicated synthetic dialect (generic ADR-0037 mechanism proof, constraint 7):
// REQ-DG-06/07's containment/fail-closed contract is proven here against a synthetic
// test-fixture op-pack, since no op-level collision reject exists yet at this point in the
// build (that lands per-op in S-001/S-002/S-003). AST = one line per array entry, mirroring
// the S-001 toy dialect's own shape.
type SynthAst = string[];

function makeSynthDialect() {
  return defineDialect({
    extensions: [".synth"],
    ast: {
      parse(source: string): SynthAst {
        return source.split("\n");
      },
      print(ast: SynthAst): string {
        return ast.join("\n");
      },
    },
    ops: {},
  });
}

// Reset at the top of any test that asserts on it (bun runs a file's tests sequentially).
const countedPushCalls = { count: 0 };

const synthOpsPack = defineOpPack<
  SynthAst,
  {
    syncThrow: (ast: SynthAst) => void;
    leakyThrow: (ast: SynthAst, secret: string) => void;
    asyncReject: (ast: SynthAst) => Promise<void>;
    asyncResolve: (ast: SynthAst, line: string) => Promise<void>;
    syncPush: (ast: SynthAst, line: string) => void;
    deliberateReject: (ast: SynthAst) => void;
    countedPush: (ast: SynthAst, line: string) => void;
  }
>({
  syncThrow() {
    throw new Error("planted native sync boom");
  },
  leakyThrow(_ast, secret) {
    const native = new Error(`boom ${secret}`);
    (native as unknown as Record<string, unknown>).internalNode = { marker: secret };
    throw native;
  },
  asyncReject: asyncRejectingOp,
  async asyncResolve(ast, line) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    ast.push(line);
  },
  syncPush(ast, line) {
    ast.push(line);
  },
  deliberateReject() {
    throw dialectError("synthetic collision");
  },
  countedPush(ast, line) {
    countedPushCalls.count += 1;
    ast.push(line);
  },
});

const synthDialect = withOps(makeSynthDialect(), synthOpsPack);

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
      // Awaiting the handle waits for both pushes to apply. S-000's mutation-gated
      // #ensureOpen (ADR-0037 amendment clause 2) probes print() ONCE — on the FIRST push,
      // to decide whether the directive should open at all — never again for the second
      // push (the directive is already open and still pending, so #ensureOpen short-
      // circuits on the identity check before any further print). dryRun() itself never
      // triggers the LAZY content getter — only settle() (the run-end drain) or a flush
      // does — so it adds no further print call beyond the one the mutation gate already
      // paid on push #1.
      await handle;

      const plan = dryRun();
      expect(plan).toEqual([{ verb: "modify", path: "a.toy" }]);
      expect(printCalls).toBe(1);
    });
    await run(undefined, { client });

    // +1 for the lazy getter's own memoized resolve at flush — the mutation-gate probe and
    // the flush-time serialization are two DISTINCT print calls (a bounded relaxation of
    // "serialize once at flush", ADR-0037 amendment Consequences); the getter itself still
    // resolves exactly once, never re-printing across repeat `.content` reads.
    expect(printCalls).toBe(2);
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

describe("dialect handle — runOp containment, parity with .raw() (REQ-DG-06)", () => {
  it("REQ-DG-06.1: a sync throw from a named op is contained — pinned prefix, tail naming the op", async () => {
    const { client } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").syncThrow();
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: syncThrow() on "a.synth" threw');
    expect(err.cause).toBeUndefined();
  });

  it("REQ-DG-06.* SENTINEL leak: a runOp sync throw's caught secrets never surface, in .message or any own-property", async () => {
    const SECRET_MARKER = "PLANTED_RUNOP_SECRET_a41c";
    const { client } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").leakyThrow(SECRET_MARKER);
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: leakyThrow() on "a.synth" threw');
    for (const prop of Object.getOwnPropertyNames(err)) {
      const value = (err as unknown as Record<string, unknown>)[prop];
      expect(String(value)).not.toContain(SECRET_MARKER);
    }
  });

  it("REQ-DG-06.2: an async op rejection is contained, zero unhandledRejection, zero batches", async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    const { client, emitted } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").asyncReject();
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: asyncReject() on "a.synth" threw');
    expect(err.cause).toBeUndefined();
    expect(unhandled).toEqual([]);
    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("REQ-DG-06.3: an async op resolution lands in the single coalesced modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").asyncResolve("resolved-line");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("seed\nresolved-line");
  });

  it("REQ-DG-06.4: an async op blocks subsequent chained ops until settled — order-of-effect observable", async () => {
    const { client, emitted } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").asyncResolve("async-line").syncPush("sync-line");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("seed\nasync-line\nsync-line");
  });

  it("REQ-DG-06.5: a deliberately-thrown dialectError passes through byte-exact, never double-wrapped", async () => {
    const { client } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").deliberateReject();
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("dialect operation failed: synthetic collision");
  });
});

describe("dialect handle — fail-closed run semantics (REQ-DG-07.3, poison flag)", () => {
  it("REQ-DG-07.3a: a further op chained on the SAME handle after a rejection surfaces the original, unchanged", async () => {
    const { client, emitted } = makeSpyClient({ "a.synth": "seed" });
    countedPushCalls.count = 0;

    const run = defineFactory<void>(async () => {
      const handle = synthDialect.find("a.synth").syncThrow();
      handle.countedPush("never-applied");
      await handle;
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: syncThrow() on "a.synth" threw');
    expect(countedPushCalls.count).toBe(0);
    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("REQ-DG-07.3b: a further op chained on a DIFFERENT handle after a rejection is never attempted as a fresh operation", async () => {
    const { client, emitted } = makeSpyClient({ "a.synth": "seed-a", "b.synth": "seed-b" });
    countedPushCalls.count = 0;

    const run = defineFactory<void>(async () => {
      const handleA = synthDialect.find("a.synth").syncThrow();
      // Let A's rejection land first — REQ-DG-07.3's GIVEN presupposes a rejected run
      // already exists, a precondition ordering, not a same-tick race (REQ-MC-02.3 precedent).
      await handleA.then(
        () => {},
        () => {}
      );
      await synthDialect.find("b.synth").countedPush("never-applied");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: syncThrow() on "a.synth" threw');
    // The op's own effect is never OBSERVED — proven here as never EXECUTED (stronger than
    // "never committed", which zero-batches alone would already guarantee): the poison flag
    // makes the cross-handle case literally "not attempted", per REQ-DG-07.3's own wording.
    expect(countedPushCalls.count).toBe(0);
    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("REQ-DG-07.3c: a post-death .read() on a different handle re-throws the stored original, not stale content", async () => {
    const { client } = makeSpyClient({ "a.synth": "seed-a", "b.synth": "seed-b" });

    const run = defineFactory<void>(async () => {
      const handleA = synthDialect.find("a.synth").syncThrow();
      await handleA.then(
        () => {},
        () => {}
      );
      await synthDialect.find("b.synth").read();
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: syncThrow() on "a.synth" threw');
  });
});

describe("dialect handle — REQ-DG-07.2 (concrete collision trigger, S-001)", () => {
  // Same fail-closed mechanism REQ-DG-07.3 proves generically against a synthetic op
  // (S-000, constraint 7) — this test exercises it via the CONCRETE trigger (constraint 8):
  // a real addFunction collision reject against the shipped TypeScript dialect.
  it("an addFunction collision reject fails the run closed, zero batches (single handle)", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "const foo = 1;\n" });

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
    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("REQ-DG-07.2: an EARLIER handle that would otherwise flush cleanly commits NOTHING when a LATER handle's addFunction collides", async () => {
    // ADR-01's two-phase emit/commit/discard protocol: b.ts's #ensureLive() read
    // GLOBALLY flushes a.ts's already-buffered directive to emit() BEFORE the collision
    // is even detected (session.read() always flushes first, ADR-0015) — so `emitted`
    // alone cannot distinguish "committed" from "staged-then-discarded". The durable
    // guarantee REQ-DG-07.2 pins is at the COMMIT boundary (ADR-01: "no partial commit"):
    // asserted here via the fake's own committedTree()/stagingTree(), matching this
    // codebase's established pattern (e.g. test/skeleton/write-only-factory.test.ts's
    // "all-or-nothing" case) rather than the emit-interception spy.
    const fake = new ContractFake({ seed: { "a.ts": "seed", "b.ts": "const foo = 1;\n" } });

    const run = defineFactory<void>(async () => {
      // a.ts's edit would flush cleanly on its own — proving THIS handle's otherwise-clean
      // edits are rolled back too, not just the colliding handle's.
      await toyDialect.find("a.ts").push("push-line");
      await ts.find("b.ts").addFunction("foo", "(): void {}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('addFunction("foo")');
    expect(fake.committedTree().size).toBe(0);
    expect(fake.stagingTree().size).toBe(0);
  });
});

describe("dialect handle — mutation-gated #ensureOpen (row-141, REQ-TSD-08.4 mechanism)", () => {
  it("a true no-op (idempotent addImport on an already-present binding) never registers a directive — zero directives emitted", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": 'import { readFileSync } from "node:fs";\n\nconst x = 1;\n',
    });

    const run = defineFactory<void>(async () => {
      // addImport is idempotent (REQ-TSD-03.10) — the binding already exists, so this
      // mutates nothing; the mutation gate must never register an open directive for it.
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
      expect(dryRun()).toEqual([]);
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("an op that DOES change print content still registers exactly one directive", async () => {
    const { client, emitted } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").syncPush("new-line");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("seed\nnew-line");
  });
});

describe("dialect handle — no-reparse across a mixed-op chain", () => {
  it("parse is called exactly once per handle, regardless of how many ops chain onto it", async () => {
    let parseCalls = 0;
    const countingDialect = defineDialect({
      extensions: [".counted"],
      ast: {
        parse(source: string): SynthAst {
          parseCalls += 1;
          return source.split("\n");
        },
        print(ast: SynthAst): string {
          return ast.join("\n");
        },
      },
      ops: {},
    });
    const countingOps = withOps(
      countingDialect,
      defineOpPack<SynthAst, { push: (ast: SynthAst, line: string) => void }>({
        push(ast, line) {
          ast.push(line);
        },
      })
    );
    const { client } = makeSpyClient({ "a.counted": "seed" });

    const run = defineFactory<void>(async () => {
      await countingOps.find("a.counted").push("line1").push("line2").push("line3");
    });
    await run(undefined, { client });

    expect(parseCalls).toBe(1);
  });
});

// row-145 (lazy modify directive's memoized getter — dialect-handle.ts's `resolve` closure
// ref, nulled post-resolution so the retained ts-morph Project/live AST becomes GC-eligible):
// EXPLICITLY UNTESTED here. It is a memory-only concern (no observable behavioral change —
// the getter's RETURN VALUE is identical whether or not the closure ref is nulled), so there
// is no black-box assertion that would distinguish "fixed" from "not fixed" without
// manufacturing a fake structural check against the closure's internals. Verified by reading
// the diff at review time instead of by a filler test (per slices.md S-000 task list).
