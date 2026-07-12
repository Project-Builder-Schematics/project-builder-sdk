// S-004 — REQ-DC-04.2 (mandatory, DISTINCT failure mode from closure-smuggle).
// [permanent-fixture]
//
// A dialect whose `print` returns the LIVE ts-morph `SourceFile` itself (a REAL AST node
// with circular parent/child compiler-node pointers — verified empirically:
// `JSON.stringify` throws `TypeError: JSON.stringify cannot serialize cyclic structures.`
// on a real parsed SourceFile) instead of a printed string. This is the SECOND, DISTINCT
// smuggling failure mode REQ-DC-04.2 mandates: `JSON.stringify` THROWS here, vs.
// closure-smuggle-violation.ts's SILENT key-drop — both must be caught, not just one.
import { parse } from "../../../src/dialects/typescript/ast.ts";
import { defineDialect, defineOpPack } from "../../../src/core/define-dialect.ts";
import type { SourceFile } from "ts-morph";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

type BrokenOps = { touch: (ast: SourceFile, ...args: never[]) => void };

export const liveNodeSmuggleOps = defineOpPack<SourceFile, BrokenOps>({
  touch: (ast: SourceFile): void => {
    ast.addStatements("// touched");
  },
});

export const liveNodeSmuggleDialect = defineDialect<SourceFile, BrokenOps>({
  extensions: [".ts"],
  ast: {
    parse: (source: string): SourceFile => parse(source),
    // BROKEN: returns the LIVE ts-morph SourceFile itself (circular compiler-node parent
    // pointers) instead of calling `.getFullText()` — never actually prints.
    print: (ast: SourceFile): string => ast as unknown as string,
  },
  ops: liveNodeSmuggleOps,
});

export const liveNodeSmuggleFixture: OpPackFixture = {
  opPack: liveNodeSmuggleOps,
  baseDialect: liveNodeSmuggleDialect,
  exercises: [
    {
      seed: "const x = 1;\n",
      chain: [{ op: "touch", args: [] }],
      expect: "const x = 1;\n// touched\n",
    },
    // Multi-op exercise — satisfies testOpPack's structural precondition; the broken
    // `print` smuggles the live node regardless of chain length.
    {
      seed: "const x = 1;\n",
      chain: [
        { op: "touch", args: [] },
        { op: "touch", args: [] },
      ],
      expect: "const x = 1;\n// touched\n// touched\n",
    },
  ],
};
