import type { Root } from "postcss";
import { defineDialect, defineOpPack, query, withOps, type GlobOptions, type Handle, type Query } from "../../../../domain/services/define-dialect.ts";
import { parse, print } from "./ast.ts";
import { getDeclaration, removeDeclaration, setDeclaration, type CssTarget, type DeclarationOptions } from "./ops.ts";

export * as astLibrary from "postcss";
export { getDeclaration };
export type { CssTarget, DeclarationOptions };

type CssOps = {
  setDeclaration: (ast: Root, target: CssTarget, property: string, value: string, options?: DeclarationOptions) => void;
  removeDeclaration: (ast: Root, target: CssTarget, property: string) => void;
  getDeclaration: Query<Root, [target: CssTarget, property: string], ReturnType<typeof getDeclaration>>;
};

const opsPack = defineOpPack<Root, CssOps>({ setDeclaration, removeDeclaration, getDeclaration: query(getDeclaration) });

const cssDialect = withOps(defineDialect({ extensions: [".css"], ast: { parse, print }, ops: {} }), opsPack);

/**
 * Opens a `.css` file to set and remove declarations. A target names one top-level block —
 * `{ selector: ":root" }`, `{ atRule: "theme" }`, or `{ atRule: "media", params, selector }` —
 * and every op edits only the declaration it addresses: comments, `@import`s, other rules,
 * indentation, line endings, and a BOM survive. Any other extension throws synchronously with
 * the `dialect operation failed: ` prefix. `.modify(fn)` hands `fn` the live PostCSS `Root`;
 * use `astLibrary` (`postcss`) for anything the ops do not cover.
 *
 * @example
 * import * as css from "@pbuilder/sdk/css";
 *
 * // tokens.css before: @import "tailwindcss";\n\n@theme {\n  --color-primary: #0b254d;\n}\n
 * export const run = async () => {
 *   await css
 *     .find("tokens.css")
 *     .setDeclaration({ atRule: "theme" }, "--color-primary", "#1974f9")
 *     .setDeclaration({ selector: "html[data-theme='nylon']" }, "--color-primary", "#0b254d");
 * };
 * // -> @import "tailwindcss";
 * // ->
 * // -> @theme {
 * // ->   --color-primary: #1974f9;
 * // -> }
 * // ->
 * // -> html[data-theme='nylon'] {
 * // ->   --color-primary: #0b254d;
 * // -> }
 */
export function find(path: string): Handle<"found", Root, CssOps> {
  return cssDialect.find(path);
}

/**
 * Opens every file `pattern` matches that this dialect edits, ordered by path; a file of any
 * other extension is left out without an error (A-132). Resolves `[]` when none matches. The
 * pattern syntax and `ignore` are commons `glob`'s, and it sees the run as `find` does.
 *
 * @example
 * import * as css from "@pbuilder/sdk/css";
 *
 * export const run = async () => {
 *   for (const file of await css.glob("src/**\/*.css")) await file.read();
 * };
 */
export function glob(pattern: string, options?: GlobOptions): Promise<Handle<"found", Root, CssOps>[]> {
  return cssDialect.glob(pattern, options);
}
