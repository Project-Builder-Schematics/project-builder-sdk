// S-000: the React dialect module — `@pbuilder/sdk/react` (REQ-RXD-01, walking skeleton).
// Composes the sanctioned kit surface ONLY (`defineDialect`/`defineOpPack`/`withOps` from
// ../../core/define-dialect.ts) — mirrors src/dialects/typescript/index.ts's shape exactly,
// no port-internal machinery imported anywhere in this tree (REQ-DG-04.1, fit-08/fit-10).
// The parser stays local: typescript/ast.ts parses as `.ts`, which rejects JSX syntax.

import { basename } from "node:path";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { dialectError } from "../../core/dialect-error.ts";
import { typescriptOps } from "../typescript/pack.ts";
import { parse, print } from "./ast.ts";
import { setJsxProp, type JsxTarget } from "./ops.ts";

export * as astLibrary from "ts-morph";
export type { JsxTarget };

type JsxOps = {
  setJsxProp: (ast: SourceFile, target: JsxTarget, propName: string, value?: string) => void;
};

type ReactOps = typeof typescriptOps & JsxOps;

const jsxOps = defineOpPack<SourceFile, JsxOps>({ setJsxProp });

const baseDialect = defineDialect({
  extensions: [".tsx"],
  ast: { parse, print },
  ops: {},
});

const reactDialect = withOps(baseDialect, typescriptOps, jsxOps);

/**
 * Opens a `.tsx` file for React-dialect-aware editing — the dialect's entry verb into a Session
 * that carries every `@pbuilder/sdk/typescript` op plus the JSX ops, chained on one handle
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
export function find(path: string): Handle<"found", SourceFile, ReactOps> {
  const base = basename(path);

  // A non-empty STEM before `.tsx` is required — `base.endsWith(".tsx")` alone is true for
  // `base === ".tsx"` itself (and for a degenerate `..tsx`, whose stem is a lone dot), which
  // would pass a basename with no real name before the extension. That is the SAME "dotfile
  // with no usable name" shape as `.babelrc` (suffix `babelrc`, not `.tsx`) — by the suffix
  // rule REQ-RXD-02 already applies to dotfiles, `.tsx`'s suffix is `tsx`, not `.tsx`.
  const stem = base.substring(0, base.length - ".tsx".length);
  if (base.endsWith(".tsx") && stem.length > 0 && !stem.endsWith(".")) {
    return reactDialect.find(path);
  }
  if (!base.includes(".")) {
    throw dialectError(
      "find(path) — the React dialect requires an explicit .tsx extension; received a path with no extension. Append .tsx to the path."
    );
  }
  if (base.endsWith(".ts")) {
    throw dialectError(
      "find(path) — .ts is not a React file; use @pbuilder/sdk/typescript for TypeScript sources."
    );
  }
  if (base.endsWith(".jsx")) {
    throw dialectError(
      "find(path) — .jsx is not supported in v1; tracked as a follow-up in the React dialect's op catalog."
    );
  }
  throw dialectError("find(path) — .tsx is the only extension the React dialect supports.");
}
