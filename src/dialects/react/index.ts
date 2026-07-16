// S-000: the React dialect module — `@pbuilder/sdk/react` (REQ-RXD-01, walking skeleton).
// Composes the sanctioned kit surface ONLY (`defineDialect`/`defineOpPack`/`withOps` from
// ../../core/define-dialect.ts) — mirrors src/dialects/typescript/index.ts's shape exactly,
// no port-internal machinery imported anywhere in this tree (REQ-DG-04.1, fit-08/fit-10).
// The op-pack is EMPTY at this slice: `setJsxProp` (S-001) and `addImport` (S-002) widen it
// incrementally, the same way the TypeScript dialect's op-pack grew slice by slice.

import { basename } from "node:path";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { dialectError } from "../../core/dialect-error.ts";
import { parse, print } from "./ast.ts";

// Deliberately the empty object TYPE (not `Record<string, never>`, whose `keyof` is `string`
// and would smuggle a bogus index-signature op method onto `Handle` — verified against
// define-dialect.ts's `OpMethods` mapped type). Widened in place by S-001/S-002.
type ReactOps = {};

const opsPack = defineOpPack<SourceFile, ReactOps>({});

const baseDialect = defineDialect({
  extensions: [".tsx"],
  ast: { parse, print },
  ops: {},
});

const reactDialect = withOps(baseDialect, opsPack);

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
 * Trust boundary: a value handed to a structured mutation (e.g. a future `setJsxProp`'s
 * `value` argument) is emitted verbatim into the output and becomes executable code — the SDK
 * performs no validation, escaping, or sanitisation on it; the author is solely responsible
 * for any untrusted input reaching that channel.
 *
 * @example
 * import * as react from "@pbuilder/sdk/react";
 *
 * export const run = async () => {
 *   await react.find("src/Button.tsx").modify((ast) => {
 *     // structured ops arrive in later slices; .modify() is the escape hatch today.
 *   });
 * };
 */
export function find(path: string): Handle<"found", SourceFile, ReactOps> {
  const base = basename(path);

  if (base.endsWith(".tsx")) {
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
