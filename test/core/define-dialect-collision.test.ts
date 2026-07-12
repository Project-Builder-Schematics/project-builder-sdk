/**
 * S-004 — `withOps` eager, synchronous, fail-closed collision + reserved-name check
 * (REQ-DG-02.2–02.5, design §4.5 ADR-0010 amendment). Composition throws (or doesn't)
 * BEFORE any run exists — these are compose-time tests, no engine client involved.
 */
import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
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

  it("every base-handle verb is reserved (read/raw/modify/rename/move/copy/remove), not just then", () => {
    for (const verb of ["read", "raw", "modify", "rename", "move", "copy", "remove"]) {
      const reservedPack = defineOpPack<SourceFile, Record<string, (ast: SourceFile) => void>>({
        [verb](_ast) {},
      });
      expect(() => withOps(realBaseDialect(), reservedPack)).toThrow(
        `op-pack composition failed: op "${verb}" collides with a reserved handle verb`
      );
    }
  });
});
