/**
 * S-001 conformance smoke — TYPE-PIN + expect-throw CHARACTERIZATION only (ADR-0012
 * amendment, rev 4 Q2 + rev 5 Q1). `src/conformance/index.ts` stays STUBBED (throws) until
 * S-004; this file proves `testDialect`/`testOpPack` are CALLABLE against the toy fixture's
 * SHAPES — it never asserts DC-01..05 content, that is S-004's job against the REAL
 * TypeScript dialect (constraint 2: no slice past S-001 imports the toy fixture into
 * conformance code past this file, and this file itself is REPLACED at S-004, not extended).
 */
import { describe, it, expect } from "bun:test";
import { expectTypeOf } from "expect-type";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture, type OpExercise } from "../../src/conformance/index.ts";
import { toyDialect, type ToyAst } from "../fixtures/toy-dialect/index.ts";

describe("conformance — toy dialect smoke (S-001, type-pin + characterization)", () => {
  it("the toy dialect type-checks against the frozen DialectFixture shape", () => {
    const fixture: DialectFixture = {
      dialect: toyDialect,
      samples: ["seed line one", "seed line one\nseed line two"],
    };
    expectTypeOf(fixture).toMatchTypeOf<DialectFixture>();
  });

  it("the toy op-pack type-checks against OpPackFixture, including the REQUIRED exercises field (rev 5)", () => {
    const exercise: OpExercise = {
      seed: "seed line",
      chain: [{ op: "push", args: ["pushed line"] }],
      expect: "seed line\npushed line",
    };
    const fixture: OpPackFixture = {
      opPack: toyDialect.ops,
      baseDialect: toyDialect,
      exercises: [exercise],
    };
    expectTypeOf(fixture).toMatchTypeOf<OpPackFixture>();
  });

  // [characterization] the still-stubbed testDialect throws its documented error — the
  // suite stays green because this is EXPECTED stub behaviour, not a real assertion of
  // conformance content (that arrives at S-004 against the real dialect).
  it("testDialect(toyFixture) throws the documented 'not yet available' stub error", () => {
    const fixture: DialectFixture = { dialect: toyDialect, samples: ["seed line"] };
    expect(() => testDialect(fixture)).toThrow(
      "testDialect: full conformance implementation is not yet available — no dialect exists yet"
    );
  });

  it("testOpPack(toyFixture) throws the documented 'not yet available' stub error", () => {
    const fixture: OpPackFixture = {
      opPack: toyDialect.ops,
      baseDialect: toyDialect,
      exercises: [{ seed: "seed line", chain: [{ op: "push", args: ["x"] }], expect: "seed line\nx" }],
    };
    expect(() => testOpPack(fixture)).toThrow(
      "testOpPack: full conformance implementation is not yet available — no dialect exists yet"
    );
  });

  it("the toy dialect's own push op is callable and mutates the Ast in place (fixture sanity, not a DC-0x assertion)", () => {
    const ast: ToyAst = ["seed"];
    (toyDialect.ops.push as (a: ToyAst, line: string) => void)(ast, "pushed");
    expect(ast).toEqual(["seed", "pushed"]);
  });
});
