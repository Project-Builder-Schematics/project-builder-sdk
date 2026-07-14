// S-004 — REQ-DC-04.1 (mandatory) — also THE serializability slot in REQ-DC-05's
// planted-violation suite (REQ-DC-05's own text: "REQ-DC-04.1's closure-smuggling fixture IS
// the mandated serializability violation instance — it MUST NOT be omitted"). [permanent-fixture]
//
// A `.modify()`-equivalent op that attaches a CLOSURE onto what would become directive content.
// `JSON.stringify` SILENTLY DROPS a function-valued property rather than throwing — the
// deep-equal structural compare (never plain `===`/`JSON.stringify`-only) is what catches
// this failure mode, distinct from the live-node-smuggle fixture's THROW (REQ-DC-04.2).
import { defineDialect, defineOpPack } from "../../../src/core/define-dialect.ts";
import type { OpPackFixture } from "../../../src/conformance/index.ts";

type BrokenAst = { text: string };
type BrokenOps = { smuggleClosure: (ast: BrokenAst, ...args: never[]) => void };

const smuggledClosure = (): string => "i am a closure, not serializable data";

export const closureSmuggleOps = defineOpPack<BrokenAst, BrokenOps>({
  smuggleClosure: (ast: BrokenAst): void => {
    ast.text = `${ast.text}\n// smuggled`;
  },
});

export const closureSmuggleDialect = defineDialect<BrokenAst, BrokenOps>({
  extensions: [".broken"],
  ast: {
    parse: (source: string): BrokenAst => ({ text: source }),
    // BROKEN: `print` is typed `(ast) => string` but returns an object carrying a closure
    // instead — JS has no runtime type enforcement, so this is exactly how a malicious/buggy
    // dialect could defy its own declared contract at runtime.
    print: (ast: BrokenAst): string =>
      ({ text: ast.text, smuggled: smuggledClosure } as unknown as string),
  },
  ops: closureSmuggleOps,
});

export const closureSmuggleFixture: OpPackFixture = {
  opPack: closureSmuggleOps,
  baseDialect: closureSmuggleDialect,
  exercises: [
    {
      seed: "const x = 1;\n",
      chain: [{ op: "smuggleClosure", args: [] }],
      expect: "const x = 1;\n// smuggled\n",
    },
    // Multi-op exercise — satisfies testOpPack's structural precondition (REQ-DC-03 needs
    // >=1 multi-op exercise); the broken `print` still smuggles the closure regardless of
    // chain length, so this exercise fails the SAME way.
    {
      seed: "const x = 1;\n",
      chain: [
        { op: "smuggleClosure", args: [] },
        { op: "smuggleClosure", args: [] },
      ],
      expect: "const x = 1;\n// smuggled\n// smuggled\n",
    },
  ],
};
