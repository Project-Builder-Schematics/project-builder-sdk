import type { SourceFile } from "ts-morph";
import { type Handle } from "../../core/define-dialect.ts";
import { typescriptOps } from "../typescript/pack.ts";
import { type JsxTarget } from "./ops.ts";
export * as astLibrary from "ts-morph";
export type { JsxTarget };
type JsxOps = {
    setJsxProp: (ast: SourceFile, target: JsxTarget, propName: string, value?: string) => void;
    removeJsxProp: (ast: SourceFile, target: JsxTarget, propName: string) => void;
    addJsxChild: (ast: SourceFile, target: JsxTarget, jsx: string) => void;
    wrapJsxElement: (ast: SourceFile, target: JsxTarget, wrapper: string) => void;
    addHookCall: (ast: SourceFile, component: string, statement: string) => void;
    addComponentProp: (ast: SourceFile, component: string, name: string, type: string, options?: {
        optional?: boolean;
    }) => void;
    renameJsxElement: (ast: SourceFile, target: JsxTarget, tag: string) => void;
};
type ReactOps = typeof typescriptOps & JsxOps;
/**
 * Opens a `.tsx` or `.jsx` file for React-dialect-aware editing — the dialect's entry verb into
 * a Session that carries every `@pbuilder/sdk/typescript` op plus the JSX ops, chained on one
 * handle (REQ-DG-01.2). Both extensions get the same handle: on `.jsx`, which parses as plain
 * JavaScript with JSX, `addTypeImport`, `addComponentProp` and `addClassProperty`'s `scope`/
 * `readonly` reject at call time because they write TypeScript syntax, leaving the file
 * unchanged. The gate below runs SYNCHRONOUSLY, before any op is chained and before any run
 * flush, so a rejected path throws on the bare `find()` call itself. `.ts` files are TypeScript,
 * not this dialect — use `@pbuilder/sdk/typescript`. Every other extension, dotfile basename,
 * trailing-dot basename, and extensionless path is rejected the same way —
 * no normalization, always an explicit `.tsx` or `.jsx`, so neither extension is ever assumed.
 * Every gate rejection throws via `dialectError`, so its message carries the standard
 * `dialect operation failed: ` prefix.
 *
 * Trust boundary: a value handed to a structured mutation (e.g. `setJsxProp`'s `value`
 * argument) is emitted verbatim into the output and becomes executable code — the SDK
 * performs no validation, escaping, or sanitisation on it; the author is solely responsible
 * for any untrusted input reaching that channel.
 *
 * @example
 * import * as react from "@pbuilder/sdk/react";
 *
 * // src/Button.tsx before: const el = <Button />;
 * export const run = async () => {
 *   await react
 *     .find("src/Button.tsx")
 *     .addImport("handleClick", "./handlers")
 *     .setJsxProp("Button", "onClick", "{handleClick}");
 * };
 * // -> import { handleClick } from "./handlers";
 * // ->
 * // -> const el = <Button onClick={handleClick} />;
 */
export declare function find(path: string): Handle<"found", SourceFile, ReactOps>;
