// S-001: defineDialect / defineOpPack / withOps — real generics (KIT-04 / ADR-0010 /
// ADR-0037). Replaces the T-M2 thin stub: an AST type parameter, value-level op-pack
// intersection compile-enforced, and an awaitable coalescing Handle<State, Ast, Ops>.
//
// Bare (no type-argument) usage of `Dialect`/`OpPack`/`Handle` resolves via default type
// parameters to `<any, OpPack<any>>` — this is what lets src/conformance/index.ts's
// fixtures stay generic-erased ("some dialect, don't care about the concrete Ast") without
// re-parameterising the conformance kit itself (design §4.3's literal code block uses bare
// `Dialect`/`OpPack`). `any`, not `unknown`: `Op<Ast>`'s `ast` parameter is CONTRAVARIANT —
// a concrete `Dialect<ToyAst, ...>` is not structurally assignable to `Dialect<unknown, ...>`
// (target's param `unknown` must be assignable to source's param `ToyAst`, which it is not),
// but `any` short-circuits variance checking in both directions, which is exactly the
// "don't care about the concrete Ast" erasure this bare form needs.

import type { ReadOps } from "./base-handle.ts";
import { createDialectHandle } from "./dialect-handle.ts";

// An op mutates the live AST in place; `never[]` at the descriptor level lets each op
// declare its OWN trailing arg tuple (bound away from `ast` by `OpMethods` below).
export type Op<Ast = any> = (ast: Ast, ...args: never[]) => void;

// An op-pack is a named record of ops over one shared AST type (ADR-0010).
export type OpPack<Ast = any> = Record<string, Op<Ast>>;

// The dialect descriptor shape is FROZEN at exactly these three top-level fields
// (REQ-DG-01.1) — a 5th field is a compile error because DialectDescriptor has no index
// signature: an excess property in an object-literal argument is rejected by TS structurally.
export interface DialectDescriptor<Ast = any, Ops extends OpPack<Ast> = OpPack<Ast>> {
  extensions: string[];
  ast: { parse(source: string): Ast; print(ast: Ast): string };
  ops: Ops;
}

// Strips the leading `ast: Ast` parameter from an Op's signature, exposing only the
// author-facing trailing args.
type Bound<Ast, F> = F extends (ast: Ast, ...rest: infer R) => void ? (...rest: R) => void : never;

// Every editing/relocating method flips State "found" -> "writable" (ADR-0004: a write
// makes `remove` incoherent) and returns the SAME thenable dialect handle.
type Edited<Ast, Ops extends OpPack<Ast>> = Handle<"writable", Ast, Ops>;

type OpMethods<Ast, Ops extends OpPack<Ast>> = {
  [K in keyof Ops]: (...a: Parameters<Bound<Ast, Ops[K]>>) => Edited<Ast, Ops>;
};

// The inherited commons `WriteOps` return `WritableHandleRef` (sync-shaped, non-thenable,
// no dialect ops). The dialect handle RE-DECLARES the same verb names + param types with a
// dialect return so `Handle` stays structurally a `WriteOps`-shaped surface while authored
// chains keep the thenable dialect return (ADR-0037 clause 1b).
type DialectWriteOps<Ast, Ops extends OpPack<Ast>> = {
  modify(content: string): Edited<Ast, Ops>;
  rename(newName: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  move(toDir: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  copy(to: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
};

// The open, awaitable dialect handle (ADR-0010, ADR-0037). Awaitable via `PromiseLike<void>`
// — `.then` delegates to the internal `#tail` promise queue (dialect-handle.ts).
export type Handle<
  State extends "found" | "writable" = "found",
  Ast = any,
  Ops extends OpPack<Ast> = OpPack<Ast>,
> = ReadOps &
  DialectWriteOps<Ast, Ops> & { raw(fn: (ast: Ast) => void): Edited<Ast, Ops> } & OpMethods<Ast, Ops> &
  // The false branch is an intentional no-op ({}): intersecting with it adds no constraint.
  (State extends "found" ? { remove(): void } : {}) &
  PromiseLike<void>;

export interface Dialect<Ast = any, Ops extends OpPack<Ast> = OpPack<Ast>> {
  readonly extensions: readonly string[];
  readonly ast: { parse(source: string): Ast; print(ast: Ast): string };
  readonly ops: Ops;
  find(path: string): Handle<"found", Ast, Ops>;
}

/**
 * Declares a named collection of ops over one AST type — usable standalone (REQ-DG-02.3),
 * e.g. shareable across two dialects targeting the same AST type, before any `withOps`
 * composition occurs.
 *
 * @example
 * const addImportPack = defineOpPack<SourceFile, { addImport(ast: SourceFile, name: string, from: string): void }>({
 *   addImport(ast, name, from) { ast.addImportDeclaration({ namedImports: [name], moduleSpecifier: from }); },
 * });
 */
export function defineOpPack<Ast, Ops extends OpPack<Ast>>(ops: Ops): Ops {
  return ops;
}

/**
 * Assembles a `Dialect` from its frozen descriptor (extensions, an AST parse/print pair,
 * and an op-pack). `find` is the dialect's ONLY entry verb into a run (REQ-DG-01.2) — it
 * returns an open, coalescing `Handle`.
 *
 * @example
 * const myDialect = defineDialect({
 *   extensions: [".ts"],
 *   ast: { parse: (s) => project.addSourceFileAtPath(s), print: (ast) => ast.getFullText() },
 *   ops: {},
 * });
 */
export function defineDialect<Ast, Ops extends OpPack<Ast>>(d: DialectDescriptor<Ast, Ops>): Dialect<Ast, Ops> {
  return {
    extensions: d.extensions,
    ast: d.ast,
    ops: d.ops,
    find(path: string): Handle<"found", Ast, Ops> {
      return createDialectHandle(d.ast, d.ops, path);
    },
  };
}

// Standard union-to-intersection trick, used to fold `withOps`'s variadic pack list into
// one intersected op map.
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/**
 * Composes additional op-packs onto a base dialect. The resulting handle type is the
 * INTERSECTION of the base's ops and every attached pack's ops (ADR-0010) — an op from an
 * unattached pack, or a typo, is a compile error (REQ-DG-02.1). Op-name collisions across
 * packs are OUT OF SCOPE (committed-next `stage-5b-dialect-breadth`); this change composes
 * exactly one starter pack, so no collision is exercised (REQ-DG-02.2).
 *
 * @example
 * const tsDialect = withOps(baseTsDialect, addImportPack);
 */
export function withOps<Ast, B extends OpPack<Ast>, P extends OpPack<Ast>[]>(
  base: Dialect<Ast, B>,
  ...packs: P
): Dialect<Ast, B & UnionToIntersection<P[number]>> {
  const merged = Object.assign({}, base.ops, ...packs) as B & UnionToIntersection<P[number]>;
  return {
    extensions: base.extensions,
    ast: base.ast,
    ops: merged,
    find(path: string): Handle<"found", Ast, B & UnionToIntersection<P[number]>> {
      return createDialectHandle(base.ast, merged, path);
    },
  };
}
