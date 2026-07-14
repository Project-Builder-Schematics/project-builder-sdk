// S-002: the TypeScript dialect module — `@pbuilder/sdk/typescript` (REQ-TSD-01, frozen
// subpath, ADR-0014 amendment). Composes the sanctioned kit surface ONLY
// (`defineDialect`/`defineOpPack`/`withOps` from `../../core/define-dialect.ts`) — no
// port-internal machinery is imported anywhere in this tree (REQ-DG-04.1, see
// test/fitness/fit-08-no-kit-bleed.test.ts and fit-10-engine-client-port-guard.test.ts).
// Namespace import surface (ADR-0003): `import * as ts from "@pbuilder/sdk/typescript"`,
// then `ts.find(path)`.

import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { parse, print } from "./ast.ts";
import { addImport, addFunction, addVariable, addClass, removeImport } from "./ops.ts";

// S-003: the finalized shipped op-set (REQ-TSD-01 V5) — addImport (S-002)/addFunction
// (S-001)/removeImport (S-002) plus addVariable/addClass (this slice), completing the
// exact five-op allow-list `ops-exact-set.test.ts` gates.
type TypeScriptOps = {
  addImport: (ast: SourceFile, name: string, from: string) => void;
  addFunction: (ast: SourceFile, name: string, source: string, options?: { export?: boolean }) => void;
  addVariable: (
    ast: SourceFile,
    name: string,
    initializer: string,
    options?: { export?: boolean; kind?: "const" | "let" | "var" }
  ) => void;
  addClass: (ast: SourceFile, name: string, source: string, options?: { export?: boolean }) => void;
  removeImport: (ast: SourceFile, name: string, from: string) => void;
};

const opsPack = defineOpPack<SourceFile, TypeScriptOps>({
  addImport,
  addFunction,
  addVariable,
  addClass,
  removeImport,
});

const baseDialect = defineDialect({
  extensions: [".ts"],
  ast: { parse, print },
  ops: {},
});

const typescriptDialect = withOps(baseDialect, opsPack);

/**
 * Opens a TypeScript file for dialect-aware editing — the dialect's entry verb into a run
 * (REQ-DG-01.2). Returns an awaitable, chainable `Handle` exposing the universal `.raw()`
 * escape hatch plus the dialect's structured ops (`addImport`, `addFunction`, `addVariable`,
 * `addClass`, `removeImport`). Reads route through `Session.read` only (REQ-MC-03); edits
 * coalesce into a single `modify` at flush (REQ-MC-01/02).
 *
 * @example
 * import * as ts from "@pbuilder/sdk/typescript";
 *
 * export const run = async () => {
 *   await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
 * };
 */
export function find(path: string): Handle<"found", SourceFile, TypeScriptOps> {
  return typescriptDialect.find(path);
}
