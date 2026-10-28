// S-000: the React dialect module — `@pbuilder/sdk/react` (REQ-RXD-01, walking skeleton).
// Composes the sanctioned kit surface ONLY (`defineDialect`/`defineOpPack`/`withOps` from
// ../../core/define-dialect.ts) — mirrors src/dialects/typescript/index.ts's shape exactly,
// no port-internal machinery imported anywhere in this tree (REQ-DG-04.1, fit-08/fit-10).
// The parser stays local: typescript/ast.ts parses as `.ts`, which rejects JSX syntax.

import { basename } from "node:path";
import type { SourceFile } from "ts-morph";
import { byExtension, defineDialect, defineOpPack, overrideOps, withOps, withoutOps, type Handle } from "../../core/define-dialect.ts";
import { dialectError } from "../../core/dialect-error.ts";
import { addClassProperty } from "../typescript/class-property.ts";
import { typescriptOps } from "../typescript/pack.ts";
import { parse, parseJsx, print } from "./ast.ts";
import {
  addComponentProp,
  addHookCall,
  addJsxChild,
  removeJsxProp,
  renameJsxElement,
  setJsxProp,
  wrapJsxElement,
  type JsxTarget,
} from "./ops.ts";

export * as astLibrary from "ts-morph";
export type { JsxTarget };

type JsxOps = {
  setJsxProp: (ast: SourceFile, target: JsxTarget, propName: string, value?: string) => void;
  removeJsxProp: (ast: SourceFile, target: JsxTarget, propName: string) => void;
  addJsxChild: (ast: SourceFile, target: JsxTarget, jsx: string) => void;
  wrapJsxElement: (ast: SourceFile, target: JsxTarget, wrapper: string) => void;
  addHookCall: (ast: SourceFile, component: string, statement: string) => void;
  addComponentProp: (ast: SourceFile, component: string, name: string, type: string, options?: { optional?: boolean }) => void;
  renameJsxElement: (ast: SourceFile, target: JsxTarget, tag: string) => void;
};

type ReactOps = typeof typescriptOps & JsxOps;

const jsxOps = defineOpPack<SourceFile, JsxOps>({ setJsxProp, removeJsxProp, addJsxChild, wrapJsxElement, addHookCall, addComponentProp, renameJsxElement });

const tsxDialect = withOps(defineDialect({ extensions: [".tsx"], ast: { parse, print }, ops: {} }), typescriptOps, jsxOps);

const jsxDialect = overrideOps(
  withoutOps(
    defineDialect({ extensions: [".jsx"], ast: { parse: parseJsx, print }, ops: tsxDialect.ops }),
    ["addTypeImport", "addComponentProp"],
    "they write TypeScript type syntax, which a .jsx file cannot hold"
  ),
  {
    addClassProperty: (ast, className, name, initializer, options) => {
      if (options?.scope !== undefined || options?.readonly !== undefined) {
        throw dialectError(
          "addClassProperty's `scope` and `readonly` are TypeScript modifiers, which a .jsx file cannot hold — " +
            "omit them, or use .modify() to make this edit directly."
        );
      }
      addClassProperty(ast, className, name, initializer);
    },
  }
);

const reactDialect = byExtension({ ".tsx": tsxDialect, ".jsx": jsxDialect });

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
export function find(path: string): Handle<"found", SourceFile, ReactOps> {
  const base = basename(path);
  // A non-empty stem that does not end in a dot: `.tsx` and `a..tsx` name no file of that type.
  const routed = reactDialect.extensions.some(
    (extension) => base.endsWith(extension) && base.length > extension.length && !base.endsWith(`.${extension}`)
  );
  if (routed) {
    return reactDialect.find(path);
  }
  if (!base.includes(".")) {
    throw dialectError(
      "find(path) — the React dialect requires an explicit .tsx or .jsx extension; received a path with no extension. Append .tsx or .jsx to the path."
    );
  }
  if (base.endsWith(".ts")) {
    throw dialectError(
      "find(path) — .ts is not a React file; use @pbuilder/sdk/typescript for TypeScript sources."
    );
  }
  throw dialectError("find(path) — .tsx and .jsx are the only extensions the React dialect supports.");
}
