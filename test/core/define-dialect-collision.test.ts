/**
 * S-004 — `withOps` eager, synchronous, fail-closed collision + reserved-name check
 * (REQ-DG-02.2–02.5, design §4.5 ADR-0010 amendment). Composition throws (or doesn't)
 * BEFORE any run exists — these are compose-time tests, no engine client involved.
 */
import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, RESERVED_HANDLE_NAMES } from "../../src/core/define-dialect.ts";
import { isContained } from "../../src/core/dialect-error.ts";
import { parse, print } from "../../src/dialects/typescript/ast.ts";
import { packA as collidingPackA, packB as collidingPackB } from "../fixtures/red/dialect-generics/colliding-op-packs.ts";

function realBaseDialect() {
  return defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} });
}

describe("withOps — REQ-DG-02.2: disjoint real packs compose cleanly (GREEN)", () => {
  it("two REAL, disjoint op-packs compose with no collision diagnostic", () => {
    const annotatePack = defineOpPack<SourceFile, { annotate: (ast: SourceFile, note: string) => void }>({
      annotate(_ast, _note) {},
    });
    const stampPack = defineOpPack<SourceFile, { stamp: (ast: SourceFile) => void }>({
      stamp(_ast) {},
    });

    expect(() => withOps(realBaseDialect(), annotatePack, stampPack)).not.toThrow();
    const composed = withOps(realBaseDialect(), annotatePack, stampPack);
    expect(Object.keys(composed.ops).sort()).toEqual(["annotate", "stamp"]);
  });
});

describe("defineOpPack — REQ-DG-02.3: usable standalone before any withOps composition", () => {
  it("returns the named record of ops over the declared AST type, unmodified", () => {
    const standalonePack = defineOpPack<SourceFile, { annotate: (ast: SourceFile, note: string) => void }>({
      annotate(_ast, _note) {},
    });
    expect(Object.keys(standalonePack)).toEqual(["annotate"]);
    expect(typeof standalonePack.annotate).toBe("function");
  });
});

describe("withOps — REQ-DG-02.4: colliding real packs throw synchronously (RED)", () => {
  it("two op-packs declaring the same op name throw, naming the colliding op", () => {
    expect(() => withOps(realBaseDialect(), collidingPackA, collidingPackB)).toThrow(
      'op-pack composition failed: duplicate op "annotate" declared by more than one pack.'
    );
  });

  // Final-verify fix closure (F-3, standing SUGGESTION): compose-time throws are NOT
  // `dialectError()`-branded — pins this structurally (`isContained`), converting what was
  // already a structural guarantee (withOps never calls dialectError) into a regression
  // guard, rather than relying on convention alone.
  it("final-verify fix (F-3): the duplicate-op throw is not isContained (compose-time, not a run-time dialect op error)", () => {
    let caught: unknown;
    try {
      withOps(realBaseDialect(), collidingPackA, collidingPackB);
    } catch (err) {
      caught = err;
    }
    expect(isContained(caught)).toBe(false);
  });

  it("a pack colliding with base.ops also throws", () => {
    const baseWithAnnotate = defineDialect({
      extensions: [".ts"],
      ast: { parse, print },
      ops: defineOpPack<SourceFile, { annotate: (ast: SourceFile, note: string) => void }>({
        annotate(_ast, _note) {},
      }),
    });
    expect(() => withOps(baseWithAnnotate, collidingPackA)).toThrow(
      'op-pack composition failed: duplicate op "annotate" declared by more than one pack.'
    );
  });
});

describe("withOps — REQ-DG-02.5: op named `then` collides with the base handle vocabulary", () => {
  it("throws synchronously, naming `then` as a reserved-vocabulary collision", () => {
    const thenPack = defineOpPack<SourceFile, { then: (ast: SourceFile) => void }>({
      then(_ast) {},
    });
    expect(() => withOps(realBaseDialect(), thenPack)).toThrow(
      'op-pack composition failed: op "then" collides with a reserved handle verb'
    );
  });

  // Final-verify fix closure (F-3, standing SUGGESTION): same closure as the duplicate-op
  // case above, for the reserved-verb throw.
  it("final-verify fix (F-3): the reserved-verb throw is not isContained (compose-time, not a run-time dialect op error)", () => {
    const thenPack = defineOpPack<SourceFile, { then: (ast: SourceFile) => void }>({
      then(_ast) {},
    });
    let caught: unknown;
    try {
      withOps(realBaseDialect(), thenPack);
    } catch (err) {
      caught = err;
    }
    expect(isContained(caught)).toBe(false);
  });

  it("REQ-DG-02.6: every reserved handle verb collides, `raw` alone naming the live escape hatch", () => {
    for (const verb of RESERVED_HANDLE_NAMES) {
      const reservedPack = defineOpPack<SourceFile, Record<string, (ast: SourceFile) => void>>({
        [verb](_ast) {},
      });
      const expectedMessage =
        verb === "raw"
          ? 'op-pack composition failed: op "raw" collides with a reserved handle verb — the live AST-fn escape hatch is .modify(fn)'
          : `op-pack composition failed: op "${verb}" collides with a reserved handle verb`;
      expect(() => withOps(realBaseDialect(), reservedPack)).toThrow(expectedMessage);
    }
  });

  it("REQ-DG-02.7: RESERVED_HANDLE_NAMES is the exact shipped 9-member ordered array", () => {
    expect(RESERVED_HANDLE_NAMES).toEqual([
      "then",
      "read",
      "raw",
      "modify",
      "replaceContent",
      "rename",
      "move",
      "copy",
      "remove",
    ]);
  });

  it("REQ-DG-02.8: an op-pack declaring `modify` collides with the reserved handle verb, generic message (no hint)", () => {
    const modifyPack = defineOpPack<SourceFile, { modify: (ast: SourceFile) => void }>({
      modify(_ast) {},
    });
    expect(() => withOps(realBaseDialect(), modifyPack)).toThrow(
      'op-pack composition failed: op "modify" collides with a reserved handle verb'
    );
  });
});
