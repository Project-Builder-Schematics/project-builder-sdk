/**
 * S-004 — the conformance kit's CORE assertions run against the REAL TypeScript dialect
 * (ADR-0012 amendment). Replaces the S-001 toy-dialect smoke (constraint 2: the toy fixture
 * is NOT carried into conformance code past S-001).
 *
 * The dialect fixture below is assembled from the SAME real production building blocks
 * `src/dialects/typescript/index.ts` composes internally (`defineDialect`/`defineOpPack`/
 * `withOps` over the real `ast.ts` parse/print pair and the real `ops.ts` addImport op) —
 * `index.ts` itself only exports `find` (REQ-DG-04.1/FIT-08), so conformance re-assembles
 * the same real `Dialect` object rather than importing a mock (ADR-0012, REQ-TSD-07).
 *
 * REQ-DC-01..05 (round-trip, single-op fidelity, coalescing-to-one, seam-serializability,
 * read-boundary split) + REQ-TSD-05.1 (minimum subpath smoke-resolve-and-run).
 */
import { existsSync } from "node:fs";
import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print } from "../../src/dialects/typescript/ast.ts";
import { addImport } from "../../src/dialects/typescript/ops.ts";
import * as ts from "../../src/dialects/typescript/index.ts";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture } from "../../src/conformance/index.ts";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { golden } from "../support/golden.ts";
import { roundTripViolationFixture } from "./planted/round-trip-violation.ts";
import { singleOpViolationFixture } from "./planted/single-op-violation.ts";
import { closureSmuggleFixture } from "./planted/closure-smuggle-violation.ts";
import { liveNodeSmuggleFixture } from "./planted/live-node-smuggle-violation.ts";
import { coalescingViolationFixture } from "./planted/coalescing-violation.ts";
import { readSplitViolationFixture } from "./planted/read-split-violation.ts";
import { identityFixtureViolationFixture } from "./planted/identity-fixture-violation.ts";

type AddImportOps = { addImport: (ast: SourceFile, name: string, from: string) => void };
const addImportPack = defineOpPack<SourceFile, AddImportOps>({ addImport });
const baseDialect = defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} });
const realTypescriptDialect = withOps(baseDialect, addImportPack);

describe("REQ-DC-01 — byte-exact round-trip fidelity (real TypeScript dialect)", () => {
  it("REQ-DC-01.1: print(parse(sample)) is string-identical for every representative sample", async () => {
    const fixture: DialectFixture = {
      dialect: realTypescriptDialect,
      samples: [
        "const x = 1;\n",
        "// a leading comment\nexport const y = 2;\n\n\n// trailing comment with   extra   spaces\n",
        "/**\n * JSDoc comment\n * @param a - the a\n */\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n",
        "  const indented = true;  \n",
      ],
    };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });
});

describe("REQ-DC-02/03 — single-op fidelity + coalescing-to-one (real TypeScript dialect)", () => {
  it("addImport single-op exercise (DC-02) + addImport+.raw multi-op exercise (DC-03/read-split) both pass", async () => {
    const fixture: OpPackFixture = {
      opPack: addImportPack,
      baseDialect: realTypescriptDialect,
      exercises: [
        {
          // DC-02: single-op — addImport's intended effect, unchanged elsewhere.
          seed: golden("add-import-before.txt"),
          chain: [{ op: "addImport", args: ["readFileSync", "node:fs"] }],
          expect: golden("add-import-after.txt"),
        },
        {
          // DC-03 (+ DC-05.2's live read-split counterpart, exercised internally by
          // testOpPack for every chain.length >= 2 exercise): addImport + .raw, two
          // distinguishable ops, byte-exact coalesced content.
          seed: golden("add-import-before.txt"),
          chain: [
            { op: "addImport", args: ["join", "node:path"] },
            {
              raw: (ast: unknown): void => {
                (ast as SourceFile).addStatements("export const z = 3;");
              },
            },
          ],
          expect: golden("coalesced-two-edits.txt"),
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});

describe("REQ-TSD-05.1 — minimum subpath smoke: resolves and runs against a ContractFake", () => {
  it("a minimal schematic importing the dialect resolves and its addImport reaches the fake's tree", async () => {
    const fake = new ContractFake({ seed: { "a.ts": golden("add-import-before.txt") } });
    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client: fake });
    expect(fake.committedTree()).toEqual(new Map([["a.ts", golden("add-import-after.txt")]]));
  });
});

describe("REQ-DC-05 — planted-violation suite: every core assertion fails RED against its violation", () => {
  it("[permanent-fixture] REQ-DC-05.1 (round-trip slot): a print-corrupting dialect fails REQ-DC-01", async () => {
    await expect(testDialect(roundTripViolationFixture)).rejects.toThrow(/REQ-DC-01/);
  });

  it("[permanent-fixture] REQ-DC-05.1 (single-op-fidelity slot): an op that mutates the wrong region fails REQ-DC-02", async () => {
    await expect(testOpPack(singleOpViolationFixture)).rejects.toThrow(/REQ-DC-02/);
  });

  it("[permanent-fixture] REQ-DC-05.1 (coalescing slot): a never-coalescing op-pack fails REQ-DC-03", async () => {
    await expect(testOpPack(coalescingViolationFixture)).rejects.toThrow(/REQ-DC-02\/03/);
  });

  it("[permanent-fixture] REQ-DC-04.1 + REQ-DC-05.1 (serializability slot, mandated instance): a closure-smuggling op fails REQ-DC-04", async () => {
    await expect(testOpPack(closureSmuggleFixture)).rejects.toThrow(/REQ-DC-04/);
  });

  it("[permanent-fixture] REQ-DC-04.2 (distinct failure mode — JSON.stringify THROWS, not a silent drop): a live-ts-morph-Node-smuggling op fails REQ-DC-04", async () => {
    await expect(testOpPack(liveNodeSmuggleFixture)).rejects.toThrow(/JSON\.stringify/);
  });

  it("[permanent-fixture] REQ-DC-05.2: a dialect that coalesces across a mid-chain read (never splits) fails RED", async () => {
    await expect(testOpPack(readSplitViolationFixture)).rejects.toThrow(/REQ-DC-05\.2/);
  });
});

describe("REQ-DC-06 — mandatory adversarial samples (contributor cannot opt out)", () => {
  it("REQ-DC-06.1: all six mandatory samples run even when the fixture's own samples array is empty", async () => {
    let parseCalls = 0;
    // Spy on the REAL dialect's parse — every call proves a sample was actually round-trip
    // checked. `fixture.samples` is deliberately empty, so any call beyond zero can only come
    // from the kit's own injected mandatory set (REQ-DC-06.1's own spy/count note).
    const spiedDialect: typeof realTypescriptDialect = {
      ...realTypescriptDialect,
      ast: {
        parse: (source: string) => {
          parseCalls++;
          return realTypescriptDialect.ast.parse(source);
        },
        print: realTypescriptDialect.ast.print,
      },
    };
    const fixture: DialectFixture = { dialect: spiedDialect, samples: [] };

    await expect(testDialect(fixture)).resolves.toBeUndefined();
    expect(parseCalls).toBe(6);
  });
});

describe("REQ-DC-07 — leaf rule: no cross-dialect / AST-library import (documented limit)", () => {
  // DOCUMENTED-LIMIT (design ADR-0012 amendment clause 3, north-star CQ-B affirmation): the
  // conformance kit ships NO import-graph scanner of its own, and none is authored here — this
  // is a documentation-pointer assertion, not a duplicate check. The load-bearing proof for the
  // SDK's own shipped TypeScript dialect is FIT-01's PRE-EXISTING transitive import-graph walk
  // (test/fitness/fit-01-commons-no-ast.test.ts), unmodified by this slice. Third-party dialect
  // authors self-run their OWN static check — see docs/authoring-a-dialect.md.
  it("REQ-DC-07.1: FIT-01's transitive import-graph walk is the shipped dialect's leaf-isolation proof", () => {
    const fit01Path = new URL("../fitness/fit-01-commons-no-ast.test.ts", import.meta.url).pathname;
    expect(existsSync(fit01Path)).toBe(true);
  });
});

describe("REQ-DC-08 — real-base-dialect rule extended to testDialect", () => {
  it("[permanent-fixture] REQ-DC-08.1: an identity parse/print fixture fails BEFORE the round-trip assertion could vacuously pass", async () => {
    await expect(testDialect(identityFixtureViolationFixture)).rejects.toThrow(/REQ-DC-08/);
  });
});
