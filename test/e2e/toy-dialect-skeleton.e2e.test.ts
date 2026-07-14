/**
 * S-001 walking-skeleton e2e smoke — the toy dialect (test/fixtures/toy-dialect) driven
 * outside-in against the raw `ContractFake`, mirroring `test/e2e/author-to-tree.e2e.test.ts`'s
 * golden-committed-tree style. Proves the S-001 Acceptance block end to end:
 *
 *   - a chain with no read coalesces to exactly one modify (byte-exact)
 *   - a mid-chain read splits into exactly two modifies, cumulative, no edit lost
 *   - an unawaited handle still commits at run end (the run-boundary join)
 *   - a throwing `.modify()` callback rejects the run with the frozen-prefix Error, no
 *     unhandledRejection, `.cause` absent
 *
 * THROWAWAY (ratified slices constraint 2): this file drives the toy dialect only — it is
 * never a reference for how the REAL TypeScript dialect's e2e tests should look (that is
 * `test/e2e/dialect-modify.e2e.test.ts`, S-002).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { toyDialect, type ToyAst } from "../fixtures/toy-dialect/index.ts";

describe("e2e — toy dialect skeleton (S-001 walking skeleton)", () => {
  it("a chain with no read coalesces to one modify, unawaited by the author, still committed at run end", async () => {
    const fake = new ContractFake({ seed: { "a.toy": "seed" } });

    const run = defineFactory<void>(() => {
      // Deliberately NOT awaited — the run-boundary join must still commit this.
      toyDialect.find("a.toy").push("named-op").modify((ast) => {
        (ast as ToyAst).push("raw-op");
      });
    });
    await run(undefined, { client: fake });

    const golden = new Map([["a.toy", "seed\nnamed-op\nraw-op"]]);
    expect(fake.committedTree()).toEqual(golden);
  });

  it("a mid-chain read splits into two modifies, cumulative, no edit lost — golden end-state", async () => {
    const fake = new ContractFake({ seed: { "a.toy": "seed" } });

    const run = defineFactory<void>(async () => {
      const handle = toyDialect.find("a.toy").push("first");
      const midChainContent = await handle.read();
      expect(midChainContent).toBe("seed\nfirst"); // read-your-own-writes (REQ-MC-02.2)

      handle.modify((ast) => {
        (ast as ToyAst).push("second");
      });
      await handle;
    });
    await run(undefined, { client: fake });

    const golden = new Map([["a.toy", "seed\nfirst\nsecond"]]);
    expect(fake.committedTree()).toEqual(golden);
  });

  it("a throwing .modify() callback rejects the run contained — frozen prefix, no .cause, nothing committed", async () => {
    const fake = new ContractFake({ seed: { "a.toy": "seed" } });

    const run = defineFactory<void>(async () => {
      await toyDialect.find("a.toy").modify(() => {
        throw new Error("boom");
      });
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: modify() on "a.toy" threw');
    expect(err.cause).toBeUndefined();
    // All-or-nothing (ADR-01): the run rejected, so nothing was committed.
    expect(fake.committedTree()).toEqual(new Map());
  });
});
