import type { SourceFile } from "ts-morph";
import { type Handle } from "../../core/define-dialect.ts";
type ReactOps = {
    setJsxProp: (ast: SourceFile, elementName: string, propName: string, value?: string) => void;
    addImport: (ast: SourceFile, name: string, from: string) => void;
};
/**
 * Opens a `.tsx` file for React-dialect-aware editing — the dialect's entry verb into a run
 * (REQ-DG-01.2). `path` MUST end in `.tsx`: the gate below runs SYNCHRONOUSLY, before any op
 * is chained and before any run flush, so a rejected path throws on the bare `find()` call
 * itself. `.ts` files are TypeScript, not this dialect — use `@pbuilder/sdk/typescript`.
 * `.jsx` is not supported in v1: the extension must stay explicit so a future `.jsx` dialect
 * addition never has to disambiguate an assumed `.tsx` default (tracked as a React op-catalog
 * follow-up). Every other extension, dotfile basename, trailing-dot basename, and
 * extensionless path is rejected the same way — no normalization, always an explicit `.tsx`.
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
export {};
