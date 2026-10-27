import type { SourceFile } from "ts-morph";
import { type Handle } from "../../core/define-dialect.ts";
import type { ArrayElement, ArrayLocator } from "./array-element.ts";
import type { ClassPropertyOptions } from "./class-property.ts";
export * as astLibrary from "ts-morph";
type TypeScriptOps = {
    addImport: (ast: SourceFile, name: string, from: string) => void;
    addDefaultImport: (ast: SourceFile, name: string, from: string) => void;
    addNamespaceImport: (ast: SourceFile, name: string, from: string) => void;
    addTypeImport: (ast: SourceFile, name: string, from: string) => void;
    addSideEffectImport: (ast: SourceFile, from: string) => void;
    addReExport: (ast: SourceFile, name: string, from: string) => void;
    addExportAll: (ast: SourceFile, from: string, options?: {
        as?: string;
    }) => void;
    addFunction: (ast: SourceFile, name: string, source: string, options?: {
        export?: boolean;
    }) => void;
    addVariable: (ast: SourceFile, name: string, initializer: string, options?: {
        export?: boolean;
        kind?: "const" | "let" | "var";
    }) => void;
    addClass: (ast: SourceFile, name: string, source: string, options?: {
        export?: boolean;
    }) => void;
    removeImport: (ast: SourceFile, name: string, from: string) => void;
    removeExport: (ast: SourceFile, name: string, from: string) => void;
    removeExportAll: (ast: SourceFile, from: string, options?: {
        as?: string;
    }) => void;
    addArrayElement: (ast: SourceFile, locator: ArrayLocator, element: ArrayElement) => void;
    addClassProperty: (ast: SourceFile, className: string, name: string, initializer: string, options?: ClassPropertyOptions) => void;
};
/**
 * Opens a TypeScript file for dialect-aware editing — the dialect's entry verb into a Session
 * (REQ-DG-01.2). Returns an awaitable, chainable `Handle` exposing the universal `.modify()`
 * escape hatch plus the dialect's named ops (`addImport`, `addDefaultImport`,
 * `addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`,
 * `addFunction`, `addVariable`, `addClass`, `removeImport`, `removeExport`, `removeExportAll`,
 * `addArrayElement`, `addClassProperty`). Reads route through `Session.read` only (REQ-MC-03); edits
 * coalesce into a single `modify` at flush (REQ-MC-01/02).
 *
 * @example
 * import * as ts from "@pbuilder/sdk/typescript";
 *
 * export const run = async () => {
 *   await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
 * };
 */
export declare function find(path: string): Handle<"found", SourceFile, TypeScriptOps>;
