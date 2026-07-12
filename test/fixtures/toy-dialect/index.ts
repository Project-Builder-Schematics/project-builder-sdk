// S-001 skeleton proof vehicle (slices.md Executor Context — "The toy dialect"). Proves the
// generic contract (defineDialect/defineOpPack/withOps), the coalescing handle, and the
// run-boundary join against a trivial, dependency-free AST BEFORE ts-morph (a risky external
// dependency) lands in S-002.
//
// THROWAWAY (ratified slices constraint 2): no slice past S-001 may import this fixture from
// production or conformance code — S-004's conformance fixtures target the REAL TypeScript
// dialect only. This file exists solely to de-risk S-002's ts-morph landing.

import { defineDialect, defineOpPack, withOps } from "../../../src/core/define-dialect.ts";

/** Ast = one line per array entry. */
export type ToyAst = string[];

// Deliberate parse-failure hook (REQ-DG-05.2 proof vehicle): content containing this
// sentinel makes `parse` throw, exercising the dialect-handle's parse-containment wrapper
// without needing a real "malformed source" concept for a trivial line-array AST.
export const PARSE_FAIL_SENTINEL = "@@toy-parse-fail@@";

const pushPack = defineOpPack<ToyAst, { push: (ast: ToyAst, line: string) => void }>({
  /** Appends a line to the AST — the toy dialect's one op. */
  push(ast, line) {
    ast.push(line);
  },
});

const baseDialect = defineDialect({
  extensions: [".toy"],
  ast: {
    parse(source: string): ToyAst {
      if (source.includes(PARSE_FAIL_SENTINEL)) {
        throw new Error("toy dialect: deliberate parse failure");
      }
      return source.split("\n");
    },
    print(ast: ToyAst): string {
      return ast.join("\n");
    },
  },
  ops: {},
});

export const toyDialect = withOps(baseDialect, pushPack);
