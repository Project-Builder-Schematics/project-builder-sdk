import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { parse, print } from "../typescript/ast.ts";
import { typescriptOps } from "../typescript/pack.ts";
import type { ArrayElement } from "../typescript/array-element.ts";
import { addComponentImport, addComponentProvider, addRootProvider, type NamedImport } from "./ops.ts";

export * as astLibrary from "ts-morph";
export type { NamedImport };

type InsertOp = (ast: SourceFile, element: ArrayElement, imports?: readonly NamedImport[]) => void;

type AngularOps = {
  addComponentImport: InsertOp;
  addComponentProvider: InsertOp;
  addRootProvider: InsertOp;
};

const angularOps = defineOpPack<SourceFile, AngularOps>({ addComponentImport, addComponentProvider, addRootProvider });

const baseDialect = defineDialect({
  extensions: [".ts"],
  ast: { parse, print },
  ops: {},
});

const angularDialect = withOps(baseDialect, typescriptOps, angularOps);

/**
 * Opens a `.ts` file of an Angular project for editing. The handle carries every
 * `@pbuilder/sdk/typescript` op plus the Angular ops below, chained on one handle and written
 * once.
 *
 * Each op takes `(element, imports?)`: `element` is an identifier, or `{ expression }` for
 * code such as `provideHttpClient(withFetch())`, and `imports` lists the `{ name, from }`
 * named imports that code needs, each added with `addImport`'s rules. An element already
 * listed is a no-op.
 *
 * - `addComponentImport` / `addComponentProvider` append to `imports` / `providers` of the
 *   file's only `@Component`, creating the metadata object or the array when missing.
 * - `addRootProvider` appends to the root `providers` of the file's only variable typed
 *   `ApplicationConfig`, or of the only `bootstrapApplication(...)` config object. *
 * They reject, leaving the file unchanged, when the target is missing, ambiguous, or not a
 * literal. Use `.modify(fn)` for those files.
 *
 * @example
 * import * as angular from "@pbuilder/sdk/angular";
 *
 * // src/app/app.config.ts before:
 * // export const appConfig: ApplicationConfig = { providers: [provideRouter(routes)] };
 * export const run = async () => {
 *   await angular.find("src/app/app.config.ts").addRootProvider({ expression: "provideHttpClient(withFetch())" }, [
 *     { name: "provideHttpClient", from: "@angular/common/http" },
 *     { name: "withFetch", from: "@angular/common/http" },
 *   ]);
 * };
 * // -> import { provideHttpClient, withFetch } from "@angular/common/http";
 * // -> export const appConfig: ApplicationConfig = { providers: [provideRouter(routes), provideHttpClient(withFetch())] };
 */
export function find(path: string): Handle<"found", SourceFile, AngularOps & typeof typescriptOps> {
  return angularDialect.find(path);
}
