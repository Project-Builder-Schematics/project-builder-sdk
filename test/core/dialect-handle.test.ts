/**
 * S-001 — the coalescing dialect handle, driven against the toy dialect (test/fixtures/
 * toy-dialect). Covers REQ-MC-01/02/04/05/07 (modify-coalescing spec) and REQ-DG-05
 * (dialect-generics spec — .modify()/parse-failure containment, generic mechanism proof; the
 * real TypeScript dialect restates the SAME contract in S-002/S-003, constraint 3).
 *
 * S-000 (stage-5b-dialect-breadth, `author-write-surface` ADR-0050 rename) additionally
 * covers REQ-DG-06 (runOp containment parity with .modify()) and REQ-DG-07.3 (fail-closed
 * poison flag, same+different handle) against a
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
import { assertNoLeak } from "../support/assert-no-leak.ts";
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
    // REQ-DG-06.6 (NEW, killer scenario): a PLAIN, foreign error whose message happens to
    // start with the frozen `dialectError` prefix byte-for-byte — never minted by this
    // module, never added to the `isContained` WeakSet. Proves the containment discriminant
    // is the brand by IDENTITY, never a `message.startsWith(...)` string test.
    foreignPrefixedThrow: (ast: SynthAst) => void;
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
  foreignPrefixedThrow() {
    throw new Error(
      "dialect operation failed: " + "a message a foreign caller happened to construct with this exact prefix"
    );
  },
});

const synthDialect = withOps(makeSynthDialect(), synthOpsPack);

describe("dialect handle — coalescing (REQ-MC-01)", () => {
  it("REQ-MC-01.1: two distinguishable ops, no read, one modify, byte-exact content", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").push("push-line").modify((ast) => {
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
      handle.modify((ast) => {
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
      handleA.modify((ast) => {
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

describe("dialect handle — .modify() and parse-failure containment (REQ-DG-05)", () => {
  it("REQ-DG-05.1: a throwing .modify callback is contained — frozen prefix + tail, no .cause", async () => {
    const SECRET_MARKER = "PLANTED_NATIVE_INTERNAL_9f3a";
    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      toyDialect.find("a.toy").modify(() => {
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
    expect(err.message).toBe('dialect operation failed: modify() on "a.toy" threw');
    expect(err.cause).toBeUndefined();

    // council fix pass (QA F2): sweep EVERY own property (not just message/.cause) for the
    // planted secret marker — proves the native error object was discarded wholesale at the
    // wrap site (a fresh Error, per module doc), not merely stripped of one named field.
    assertNoLeak(err, SECRET_MARKER);
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

describe("dialect handle — async .modify() containment (council fix pass, security note 1, ADR-0037)", () => {
  it("an async .modify callback that rejects is contained the same as a sync throw, with no unhandledRejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    const { client } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      // Deliberately not awaited by the author — the run-boundary join must still observe
      // the async rejection through the SAME containment as a sync throw.
      toyDialect.find("a.toy").modify(async () => {
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
    expect(err.message).toBe('dialect operation failed: modify() on "a.toy" threw');
    expect(err.cause).toBeUndefined();
    expect(unhandled).toEqual([]);
  });

  // REQ-DG-05.4 (NEW): mirrors REQ-DG-06.2's pattern (unhandledRejection observed + zero
  // batches emitted) for the escape hatch itself, not just a named runOp — an async rejection
  // from `.modify(fn)` must never commit as a false success.
  it("REQ-DG-05.4: an async .modify(fn) rejection is contained, zero unhandledRejection, zero batches", async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").modify(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("boom-async-reject");
      });
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
    expect(err.message).toBe('dialect operation failed: modify() on "a.toy" threw');
    expect(err.cause).toBeUndefined();
    expect(unhandled).toEqual([]);
    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("an async .modify callback that resolves after a delay has its mutation included in the coalesced modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").modify(async (ast) => {
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

describe("dialect handle — runOp containment, parity with .modify() (REQ-DG-06)", () => {
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
    assertNoLeak(err, SECRET_MARKER);
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

  it("REQ-DG-06.6: a foreign error with a coincidentally-prefixed message is wrapped fresh, never rethrown verbatim", async () => {
    const { client } = makeSpyClient({ "a.synth": "seed" });

    const run = defineFactory<void>(async () => {
      await synthDialect.find("a.synth").foreignPrefixedThrow();
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    // The tail is the generic foreign-wrap shape — NOT the foreign error's own message
    // content, proving the discriminant is the `isContained` brand by identity, never a
    // `message.startsWith(...)` string test.
    expect(err.message).toBe('dialect operation failed: foreignPrefixedThrow() on "a.synth" threw');
    expect(err.cause).toBeUndefined();
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
    // Options omitted (the common call form): the path channel must not collide with the
    // optional `options` slot — asserted via the FULL pinned message including `on "<path>"`.
    expect(err.message).toBe(
      'dialect operation failed: addFunction("foo") on "a.ts" — a value or import binding named "foo" already ' +
        "exists; TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, " +
        "or edit it with .modify()."
    );
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

describe("dialect handle — REQ-MC-08 (row-136 reject, amended by ADR-0050 to .replaceContent())", () => {
  // The pre-existing silent last-write-wins was already replaced by REQ-MC-08's reject
  // scenarios (ADR-0039) in an earlier slice. `author-write-surface` (S-000, ADR-0050) only
  // moves the guard's home from `.modify()`/`runModify` to `.replaceContent()`/
  // `runReplaceContent` — the pending AST edit is still never silently discarded.

  it("REQ-MC-08.1: .replaceContent() while an AST op is open on the SAME handle REJECTS, naming the conflict", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "const x = 1;\n" } });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs").replaceContent("raw override content");
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe(
      'dialect operation failed: cannot .replaceContent() "a.ts" while a structured edit is pending — the pending edit would be lost; call .read() to commit it first, then .replaceContent()'
    );
    expect(err.cause).toBeUndefined();
    // The AST edit is never silently discarded — nothing commits at all (fail-closed).
    expect(fake.committedTree().size).toBe(0);
  });

  it("REQ-MC-08.2: .replaceContent() with NO pending AST op is unaffected — succeeds exactly as today", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "const x = 1;\n" } });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").replaceContent("plain overwrite");
    });
    await run(undefined, { client: fake });

    expect(fake.committedTree().get("a.ts")).toBe("plain overwrite");
  });

  it("REQ-MC-08.3: .read() drains the pending AST op first — .replaceContent() after it is the documented escape, both directives commit", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "const x = 1;\n" } });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("readFileSync", "node:fs");
      await handle.read();
      handle.replaceContent("post-read overwrite");
      await handle;
    });
    await run(undefined, { client: fake });

    // The addImport edit committed via its own drain-triggered flush (at the .read()),
    // then the post-read .replaceContent() overwrites on top — both directives landed,
    // neither silently dropped.
    expect(fake.committedTree().get("a.ts")).toBe("post-read overwrite");
  });

  it("REQ-MC-08.4: reverse order (.replaceContent() THEN an AST op) stays defined, unaffected by the reject", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "const x = 1;\n" } });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").replaceContent("const y = 2;\n").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client: fake });

    // The AST op runs AFTER .replaceContent() buffered its own directive — #ensureLive()
    // reads through the flush-before-read seam (the replace already committed by then), so
    // the AST op parses the POST-replace content ("const y = 2;\n") and the addImport edit
    // lands on top of it — the same insertion shape the existing golden fixtures pin.
    expect(fake.committedTree().get("a.ts")).toBe('import { readFileSync } from "node:fs";\n\nconst y = 2;\n');
  });

  // REQ-MC-08.5 (NEW): the ADR-0039 guard is scoped to `.replaceContent()`'s SEMANTICS
  // (wholesale replace clobbering a pending structured edit) — it must never fire for
  // `.modify(fn)`, which coalesces freely with a pending AST op into ONE directive.
  it("REQ-MC-08.5: .modify(fn) is unaffected by the ADR-0039 guard — coalesces with a pending AST op into ONE directive, never rejects", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "const x = 1;\n" });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .addImport("readFileSync", "node:fs")
        .modify((ast) => {
          ast.addStatements("export const z = 3;");
        });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'import { readFileSync } from "node:fs";\n\nconst x = 1;\nexport const z = 3;\n'
    );
  });
});

describe("dialect handle — removeImport mechanism proofs (REQ-TSD-08.4/08.6, S-002)", () => {
  it("REQ-TSD-08.4: removeImport of an absent import is an idempotent no-op — ZERO directives", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "const x = 1;\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").removeImport("a", "m");
      expect(dryRun()).toEqual([]);
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
  });

  it("REQ-TSD-08.6: removeImport of an import added earlier in the SAME chain (RYOW) — one modify, byte-identical to seed", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "const x = 1;\n" });

    const run = defineFactory<void>(async () => {
      // "y", not "x": ts-addimport-collision/S-001 — addImport now rejects a name CLAIMED
      // anywhere in the file (Step 2), and this fixture's own top-level `const x` would
      // collide with "x". The name choice here is incidental to this test's actual subject
      // (RYOW add+remove in one chain); "y" avoids the unrelated collision.
      await ts.find("a.ts").addImport("y", "m").removeImport("y", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("const x = 1;\n");
  });
});

describe("dialect handle — post-flush mutation gate (judgment-day round 1, Issue 1)", () => {
  it("a no-op AFTER a mid-chain read() drains the prior edit registers nothing — exactly one modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { readFileSync } from "node:fs";\n' });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").addImport("writeFileSync", "node:fs");
      await handle.read();
      // A genuine no-op (absent binding): must NOT re-register a byte-identical directive
      // now that the real edit above already flushed via the read().
      handle.removeImport("nope", "nowhere");
      await handle;
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { readFileSync, writeFileSync } from "node:fs";\n');
  });
});

describe("dialect handle — post-flush mutation gate (judgment-day round 2, cross-handle drain)", () => {
  it("a no-op on handle A AFTER a DIFFERENT handle's read() globally flushes A's directive registers nothing — exactly one modify for a.ts", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": 'import { readFileSync } from "node:fs";\n',
      "b.ts": "const y = 1;\n",
    });

    const run = defineFactory<void>(async () => {
      const handleA = ts.find("a.ts").addImport("writeFileSync", "node:fs");
      await handleA;
      // b.ts's read() is a DIFFERENT handle — but session.read() is the GLOBAL
      // flush-before-read (ADR-0015), so it drains handleA's still-pending directive too,
      // even though handleA itself never called .read().
      await ts.find("b.ts").read();
      // A genuine no-op on A (absent binding), measured AFTER the foreign drain: must NOT
      // re-register a byte-identical directive now that the real edit above already
      // flushed via b.ts's read().
      handleA.removeImport("nope", "nowhere");
      await handleA;
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted).filter((m) => m.modify.path === "a.ts");
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { readFileSync, writeFileSync } from "node:fs";\n');
  });
});

describe("dialect handle — REQ-DG-07.1 (row-136 concrete trigger, S-002)", () => {
  // Same fail-closed mechanism REQ-DG-07.3 proves generically (S-000) and REQ-DG-07.2
  // proves via addFunction's collision (S-001) — this exercises it via row-136's
  // concrete trigger (constraint 8). Commit-boundary assertion per the emit-vs-commit
  // discovery (S-001 fix): a second handle's own read globally flushes an earlier clean
  // handle's directive to emit() before the reject is detected — the durable guarantee
  // lives at commit()/discard(), not emit() interception.
  it("a row-136 reject on a LATER handle commits nothing for an EARLIER, otherwise-clean handle", async () => {
    const fake = new ContractFake({ seed: { "a.ts": "seed", "b.ts": "const x = 1;\n" } });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.ts").push("push-line");
      await ts.find("b.ts").addImport("readFileSync", "node:fs").replaceContent("raw override");
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("while a structured edit is pending");
    expect(fake.committedTree().size).toBe(0);
    expect(fake.stagingTree().size).toBe(0);
  });
});

describe("dialect handle — mixed old+new-op coalescing (REQ-MC-01 coverage note, non-normative)", () => {
  // Row-141 kept-half (pending-changes row 141, "kit-internal, test-authoring hygiene"):
  // this fixture demonstrates two ALREADY-PROVEN scenarios — annotated here, not a new
  // assertion. proves REQ-MC-01.2 (two independent handles on different paths batch into
  // two separate modify directives, no cross-contamination) and REQ-TSD-03.1 (a
  // create-then-addImport chain in one run coalesces to exactly one modify at flush) — both
  // scenarios are proven elsewhere already (dialect.test.ts REQ-TSD-03.1, this file's own
  // REQ-MC-01.2); this is traceability for the mixed old+new-op coalescing claim, not a
  // duplicate proof obligation.
  it("addImport + addFunction + removeImport in one chain coalesce to exactly one modify", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { keep } from "m";\nimport { drop } from "n";\n' });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .addImport("readFileSync", "node:fs")
        .addFunction("hi", "(): void {}")
        .removeImport("drop", "n");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'import { keep } from "m";\nimport { readFileSync } from "node:fs";\nfunction hi(): void {}\n'
    );
  });
});

// row-145 (lazy modify directive's memoized getter — dialect-handle.ts's `resolve` closure
// ref, nulled post-resolution so the retained ts-morph Project/live AST becomes GC-eligible):
// EXPLICITLY UNTESTED here. It is a memory-only concern (no observable behavioral change —
// the getter's RETURN VALUE is identical whether or not the closure ref is nulled), so there
// is no black-box assertion that would distinguish "fixed" from "not fixed" without
// manufacturing a fake structural check against the closure's internals. Verified by reading
// the diff at review time instead of by a filler test (per slices.md S-000 task list).
