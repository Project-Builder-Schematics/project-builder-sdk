import type { SourceFile } from "ts-morph";
import { type Handle } from "../../core/define-dialect.ts";
type AddImportOps = {
    addImport: (ast: SourceFile, name: string, from: string) => void;
    addFunction: (ast: SourceFile, name: string, source: string, options?: {
        export?: boolean;
    }) => void;
    removeImport: (ast: SourceFile, name: string, from: string) => void;
};
/**
 * Opens a TypeScript file for dialect-aware editing — the dialect's entry verb into a run
 * (REQ-DG-01.2). Returns an awaitable, chainable `Handle` exposing the universal `.raw()`
 * escape hatch plus the dialect's structured ops (`addImport`, `addFunction`,
 * `removeImport`). Reads route through `Session.read` only (REQ-MC-03); edits coalesce
 * into a single `modify` at flush (REQ-MC-01/02).
 *
 * @example
 * import * as ts from "@pbuilder/sdk/typescript";
 * import { defineFactory } from "@pbuilder/sdk/testing";
 *
 * export const run = defineFactory(async () => {
 *   await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
 * });
 */
export declare function find(path: string): Handle<"found", SourceFile, AddImportOps>;
export {};
//# sourceMappingURL=index.d.ts.map