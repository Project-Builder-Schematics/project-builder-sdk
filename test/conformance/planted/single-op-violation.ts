// S-004 — planted violation for REQ-DC-05 (single-op-fidelity slot, REQ-DC-02).
// [permanent-fixture]
// An op that ignores its intended effect and mutates a DIFFERENT region of the AST instead
// — an over-broad mutation REQ-DC-02's "unchanged-elsewhere" half exists to catch. The
// exercise's `expect` describes the INTENDED (never-actually-produced) effect, so the
// byte-exact comparison fails — proves the assertion is live, not a no-op.
import { defineDialect, defineOpPack } from "../../../src/core/define-dialect.ts";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

type BrokenAst = { text: string };
type BrokenOps = { corrupt: (ast: BrokenAst, ...args: never[]) => void };

export const singleOpViolationOps = defineOpPack<BrokenAst, BrokenOps>({
  // BROKEN: never applies the intended edit; appends unrelated garbage instead.
  corrupt: (ast: BrokenAst): void => {
    ast.text = `${ast.text}\n// UNEXPECTED MUTATION — not the intended effect`;
  },
});

export const singleOpViolationDialect = defineDialect<BrokenAst, BrokenOps>({
  extensions: [".broken"],
  ast: {
    parse: (source: string): BrokenAst => ({ text: source }),
    print: (ast: BrokenAst): string => ast.text,
  },
  ops: singleOpViolationOps,
});

export const singleOpViolationFixture: OpPackFixture = {
  opPack: singleOpViolationOps,
  baseDialect: singleOpViolationDialect,
  exercises: [
    {
      seed: "const x = 1;\n",
      chain: [{ op: "corrupt", args: [] }],
      // Describes the op's INTENDED (never-produced) effect — the actual output diverges.
      expect: "const x = 1;\n// intended edit that corrupt() never actually makes\n",
    },
    // A second, multi-op exercise — satisfies testOpPack's own structural precondition
    // (>=1 exercise with chain.length>=2) so the single-op exercise above fails for the
    // RIGHT reason (REQ-DC-02 content mismatch), never for a fixture-shape guard instead.
    {
      seed: "const x = 1;\n",
      chain: [
        { op: "corrupt", args: [] },
        { op: "corrupt", args: [] },
      ],
      expect: "const x = 1;\n// intended edit that corrupt() never actually makes\n",
    },
  ],
};
