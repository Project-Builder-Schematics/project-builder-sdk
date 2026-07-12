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
import { addImport } from "./ops.ts";

type AddImportOps = { addImport: (ast: SourceFile, name: string, from: string) => void };

const addImportPack = defineOpPack<SourceFile, AddImportOps>({ addImport });

const baseDialect = defineDialect({
  extensions: [".ts"],
  ast: { parse, print },
  ops: {},
});

const typescriptDialect = withOps(baseDialect, addImportPack);

/**
 * Opens a TypeScript file for dialect-aware editing — the dialect's entry verb into a run
 * (REQ-DG-01.2). Returns an awaitable, chainable `Handle` exposing the universal `.raw()`
 * escape hatch plus the full op-pack (`removeImport`, `addFunction`, `addVariable`, `addClass`,
 * plus `addImport`). Reads route through `Session.read` only (REQ-MC-03); edits coalesce into a
 * single `modify` at flush (REQ-MC-01/02).
 *
 * @example
 * import * as ts from "@pbuilder/sdk/typescript";
 * import { defineFactory } from "@pbuilder/sdk/testing";
 *
 * export const run = defineFactory(async () => {
 *   await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
 * });
 */
export function find(path: string): Handle<"found", SourceFile, AddImportOps> {
  return typescriptDialect.find(path);
}
