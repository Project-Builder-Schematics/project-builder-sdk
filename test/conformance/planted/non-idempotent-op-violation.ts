// Planted violation for A-11 (idempotency): a real `defineDialect` dialect over lines of text
// whose op changes the file again when applied to its own result. Unmarked, the kit must reject
// it; declared `repeatable`, the kit must accept it. Everything else about the dialect conforms,
// so the idempotency check is the only one that can tell the fixtures apart. The two effects are
// the two A-11 names: an op that adds again on every application, and one that acts on a
// position and reaches another element.
import {
  defineDialect,
  defineOpPack,
  repeatable,
  type Op,
} from "../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

interface Lines {
  text: string;
}

type LinesOp = (ast: Lines, arg: string) => void;

function fixtureWith(
  op: Op<Lines>,
  args: readonly [string, string],
  seed: string,
  expectOne: string,
  expectTwo: string
): OpPackFixture {
  const opPack = defineOpPack<Lines, { edit: LinesOp }>({ edit: op as LinesOp });
  const baseDialect = defineDialect({
    extensions: [".lines"],
    ast: { parse: (text: string): Lines => ({ text }), print: (ast: Lines) => ast.text },
    ops: opPack,
  });
  return {
    opPack,
    baseDialect,
    exercises: [
      { seed, chain: [{ op: "edit", args: [args[0]] }], expect: expectOne },
      {
        seed,
        chain: [
          { op: "edit", args: [args[0]] },
          { op: "edit", args: [args[1]] },
        ],
        expect: expectTwo,
      },
    ],
  };
}

// Adds again on every application.
function appendLine(ast: Lines, line: string): void {
  ast.text += line;
}

// Acts on a position: drops the first line that starts with `prefix`, so applied again it
// reaches the next one.
function dropFirstLineStarting(ast: Lines, prefix: string): void {
  const lines = ast.text.split("\n");
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index >= 0) lines.splice(index, 1);
  ast.text = lines.join("\n");
}

const appendCase = [["a\n", "b\n"], "start\n", "start\na\n", "start\na\nb\n"] as const;
const dropCase = [["x", "y"], "x1\nx2\nx3\ny1\ny2\n", "x2\nx3\ny1\ny2\n", "x2\nx3\ny2\n"] as const;

export const nonIdempotentOpViolationFixture = fixtureWith(appendLine, ...appendCase);
export const positionalOpViolationFixture = fixtureWith(dropFirstLineStarting, ...dropCase);

// Fresh functions, because `repeatable` marks the op itself.
export const repeatableAddingOpFixture = fixtureWith(
  repeatable((ast: Lines, line: string) => appendLine(ast, line)),
  ...appendCase
);
export const repeatablePositionalOpFixture = fixtureWith(
  repeatable((ast: Lines, prefix: string) => dropFirstLineStarting(ast, prefix)),
  ...dropCase
);
