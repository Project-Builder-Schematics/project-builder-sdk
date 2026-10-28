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

import { basename } from "node:path";
import type { ReadOps } from "./base-handle.ts";
import { createDialectHandle } from "./dialect-handle.ts";
import { dialectError } from "./dialect-error.ts";

export { query } from "./dialect-handle.ts";

// An op mutates the live AST in place; `never[]` at the descriptor level lets each op
// declare its OWN trailing arg tuple (bound away from `ast` by `OpMethods` below).
export type Op<Ast = any> = (ast: Ast, ...args: never[]) => void;

declare const QUERY: unique symbol;

// An op-pack entry branded by `query()`: its handle method resolves to the result instead of
// chaining. A query is still an `Op` (a non-void return is assignable to `void`), so packs,
// `withOps`, and its collision checks treat it like any other op.
export type Query<Ast = any, A extends unknown[] = any[], R = unknown> = ((ast: Ast, ...args: A) => R) & {
  readonly [QUERY]: true;
};

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
  [K in keyof Ops]: Ops[K] extends Query<any, infer A, infer R>
    ? (...a: A) => Promise<Awaited<R>>
    : (...a: Parameters<Bound<Ast, Ops[K]>>) => Edited<Ast, Ops>;
};

// The inherited commons `WriteOps` return `WritableHandleRef` (sync-shaped, non-thenable,
// no dialect ops). The dialect handle RE-DECLARES the same verb names + param types with a
// dialect return so `Handle` stays structurally a `WriteOps`-shaped surface while authored
// chains keep the thenable dialect return (ADR-0037 clause 1b).
type DialectWriteOps<Ast, Ops extends OpPack<Ast>> = {
  replaceContent(content: string): Edited<Ast, Ops>;
  rename(newName: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  move(toDir: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
  copy(to: string, opts?: { force?: boolean }): Edited<Ast, Ops>;
};

// The open, awaitable dialect handle (ADR-0010, ADR-0037, ADR-0050). Awaitable via
// `PromiseLike<void>` — `.then` delegates to the internal `#tail` promise queue
// (dialect-handle.ts).
export type Handle<
  State extends "found" | "writable" = "found",
  Ast = any,
  Ops extends OpPack<Ast> = OpPack<Ast>,
> = ReadOps &
  DialectWriteOps<Ast, Ops> & { modify(fn: (ast: Ast) => void): Edited<Ast, Ops> } & OpMethods<Ast, Ops> &
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

// A basename that is only the extension (`.ts`) or whose stem ends in a dot (`a..ts`) names no
// file of that type, the same as a dotfile such as `.babelrc`.
function hasDeclaredExtension(path: string, extensions: readonly string[]): boolean {
  const base = basename(path);
  return extensions.some((extension) => {
    const stem = base.slice(0, base.length - extension.length);
    return base.endsWith(extension) && stem.length > 0 && !stem.endsWith(".");
  });
}

/**
 * Assembles a `Dialect` from its frozen descriptor (extensions, an AST parse/print pair,
 * and an op-pack). `find` is the dialect's ONLY entry verb into a Session (REQ-DG-01.2) — it
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
      if (!hasDeclaredExtension(path, d.extensions)) {
        throw dialectError(
          `find(${JSON.stringify(path)}) — the file's extension is not one this dialect declares (${d.extensions.join(", ")}).`
        );
      }
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
 * The base handle's own vocabulary (REQ-DG-02, ADR-0010 amendment) — an op-pack op sharing
 * any of these names would silently shadow a base verb; `then` in particular would break the
 * handle's `PromiseLike` join. `raw` stays reserved even though the verb itself is retired
 * (ADR-0050) — a muscle-memory guardrail against authors reaching for the old name. Exported,
 * ordered array (REQ-DG-02.7 pins this exact order via `toEqual`); `assertNoCompositionCollision`
 * below consumes it through the derived, non-exported `RESERVED_SET`.
 *
 * @internal Exported for test/conformance observability only (so collision/exact-set tests can
 * import it instead of hand-typing a second literal) — NOT a supported public API member, not
 * semver-covered beyond the FIT-04 baseline pin it already sits inside (ORCHESTRATOR RULING R2).
 */
export const RESERVED_HANDLE_NAMES = [
  "then",
  "read",
  "raw",
  "modify",
  "replaceContent",
  "rename",
  "move",
  "copy",
  "remove",
] as const;

const RESERVED_SET: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

// Compile-time, one-directional exhaustiveness tie: every verb on the base handle surface
// (the concrete intersection members of `Handle`, NOT the string-indexed `OpMethods` arm)
// must appear in `RESERVED_HANDLE_NAMES` — extras like the retired `raw` are allowed.
// Adding a new base verb without reserving it fails here, at the declaration site.
// "modify" and "remove" are hand-listed because they are inline intersection members on
// `Handle` (see define-dialect's `Handle` type), not derived from an interface `keyof` —
// any future inline addition to that intersection must be added here too, or this
// exhaustiveness guard silently stops covering it.
type BaseHandleSurfaceKey =
  | keyof ReadOps
  | keyof DialectWriteOps<any, OpPack>
  | "modify"
  | "remove"
  | keyof PromiseLike<void>;
const _reservedCoversSurface: [
  Exclude<BaseHandleSurfaceKey, (typeof RESERVED_HANDLE_NAMES)[number]>,
] extends [never]
  ? true
  : never = true;
void _reservedCoversSurface;

/**
 * Eager, synchronous, fail-closed check run at `withOps` composition time (REQ-DG-02,
 * ADR-0010 amendment): throws on a cross-pack op-name duplicate (including a collision
 * against `base.ops`) or on an op name in `RESERVED_HANDLE_NAMES`. Both throws are PLAIN
 * `Error`s, NOT minted via `dialectError()` — they are not run-op contained rejects and must
 * never be recognised by `isContained` as passthrough (design §4.5's own rationale).
 */
function assertNoCompositionCollision(baseOpNames: readonly string[], packs: readonly OpPack[]): void {
  const claimed = new Set(baseOpNames);
  for (const pack of packs) {
    for (const name of Object.keys(pack)) {
      if (RESERVED_SET.has(name)) {
        const hint = name === "raw" ? " — the live AST-fn escape hatch is .modify(fn)" : "";
        throw new Error(`op-pack composition failed: op "${name}" collides with a reserved handle verb${hint}`);
      }
      if (claimed.has(name)) {
        throw new Error(`op-pack composition failed: duplicate op "${name}" declared by more than one pack.`);
      }
      claimed.add(name);
    }
  }
}

/**
 * Composes additional op-packs onto a base dialect. The resulting handle type is the
 * INTERSECTION of the base's ops and every attached pack's ops (ADR-0010) — an op from an
 * unattached pack, or a typo, is a compile error (REQ-DG-02.1). At composition time, an
 * eager RUNTIME check (REQ-DG-02.2–02.5, ADR-0010 amendment) throws synchronously on a
 * cross-pack op-name duplicate (or a collision against `base.ops`) or a reserved-vocabulary
 * collision — composition never silently resolves to whichever pack happened to be spread
 * last.
 *
 * @example
 * const tsDialect = withOps(baseTsDialect, addImportPack);
 */
export function withOps<Ast, B extends OpPack<Ast>, P extends OpPack<Ast>[]>(
  base: Dialect<Ast, B>,
  ...packs: P
): Dialect<Ast, B & UnionToIntersection<P[number]>> {
  assertNoCompositionCollision(Object.keys(base.ops), packs);
  const merged = Object.assign({}, base.ops, ...packs) as B & UnionToIntersection<P[number]>;
  return defineDialect({ extensions: [...base.extensions], ast: base.ast, ops: merged });
}

function assertKnownOps(ops: OpPack, names: readonly string[], composer: string): void {
  for (const name of names) {
    if (!Object.hasOwn(ops, name)) throw new Error(`${composer} failed: the dialect has no op "${name}".`);
  }
}

/**
 * Derives a dialect whose named ops reject at call time, leaving the file unchanged, with a
 * message naming the op, the dialect's extensions and `reason`. The ops stay on the handle and
 * in its type, so one handle shape can serve every extension of a routed dialect
 * (`byExtension`). Throws at composition on an op name the dialect does not have.
 *
 * @example
 * const jsx = withoutOps(defineDialect({ extensions: [".jsx"], ast: jsxAst, ops: tsx.ops }), ["addTypeImport"], ".jsx files have no type syntax");
 */
export function withoutOps<Ast, Ops extends OpPack<Ast>>(
  dialect: Dialect<Ast, Ops>,
  names: readonly (keyof Ops & string)[],
  reason: string
): Dialect<Ast, Ops> {
  assertKnownOps(dialect.ops, names, "withoutOps");
  const files = dialect.extensions.join(", ");
  const blocked = Object.fromEntries(
    names.map((name) => [
      name,
      () => {
        throw dialectError(`${name} is not available for ${files} files — ${reason}. Use .modify() to make this edit directly.`);
      },
    ])
  );
  return defineDialect({ extensions: [...dialect.extensions], ast: dialect.ast, ops: { ...dialect.ops, ...blocked } as Ops });
}

/**
 * Derives a dialect whose named ops run `overrides` instead, with the same signatures. Throws at
 * composition on an op name the dialect does not have; adding new ops is `withOps`'s job.
 *
 * @example
 * const jsx = overrideOps(tsx, { addClassProperty: jsxClassProperty });
 */
export function overrideOps<Ast, Ops extends OpPack<Ast>>(dialect: Dialect<Ast, Ops>, overrides: Partial<Ops>): Dialect<Ast, Ops> {
  assertKnownOps(dialect.ops, Object.keys(overrides), "overrideOps");
  return defineDialect({ extensions: [...dialect.extensions], ast: dialect.ast, ops: { ...dialect.ops, ...overrides } as Ops });
}

// Keyed by file extension (`.tsx`), one dialect each.
type DialectsByExtension = { readonly [extension: string]: Dialect };

type HandleOf<D> = D extends Dialect<infer A, infer O> ? Handle<"found", A, O> : never;

type MatchingKey<M, P extends string> = { [K in keyof M & string]: P extends `${string}${K}` ? K : never }[keyof M & string];

// Drops a key when a longer matching key ends with it, mirroring `find`'s longest-first routing.
type LongestKey<Ks extends string> = {
  [K in Ks]: [Extract<Exclude<Ks, K>, `${string}${K}`>] extends [never] ? K : never;
}[Ks];

// A literal path gets its routed extension's handle; a non-literal `string` gets the union of
// every routed handle.
type RoutedHandle<M extends DialectsByExtension, P extends string> = string extends P
  ? HandleOf<M[keyof M]>
  : HandleOf<M[LongestKey<MatchingKey<M, P>>]>;

export interface ExtensionRouter<M extends DialectsByExtension> {
  readonly extensions: readonly (keyof M & string)[];
  find<P extends string>(path: P): RoutedHandle<M, P>;
}

/**
 * Routes `find` by file extension to one dialect per extension, each with its own AST and ops —
 * a `.ts` dialect and an `.html` dialect may parse to different AST types. The longest matching
 * extension wins (`.component.html` over `.html`); a path matching none rejects synchronously,
 * naming every routed extension. Throws at composition on a key its dialect does not declare.
 *
 * @example
 * export const react = byExtension({ ".tsx": tsxDialect, ".jsx": jsxDialect });
 * react.find("src/App.jsx").setJsxProp("div", "hidden");
 */
export function byExtension<M extends DialectsByExtension>(dialects: M): ExtensionRouter<M> {
  const extensions = Object.keys(dialects) as (keyof M & string)[];
  for (const extension of extensions) {
    const declared = dialects[extension]!.extensions;
    if (!declared.includes(extension)) {
      throw new Error(`dialect routing failed: "${extension}" is not an extension its dialect declares (${declared.join(", ")}).`);
    }
  }
  const longestFirst = [...extensions].sort((a, b) => b.length - a.length);
  return {
    extensions,
    find<P extends string>(path: P): RoutedHandle<M, P> {
      const extension = longestFirst.find((candidate) => hasDeclaredExtension(path, [candidate]));
      if (extension === undefined) {
        throw dialectError(
          `find(${JSON.stringify(path)}) — the file's extension is not one this dialect declares (${extensions.join(", ")}).`
        );
      }
      return dialects[extension]!.find(path) as RoutedHandle<M, P>;
    },
  };
}
