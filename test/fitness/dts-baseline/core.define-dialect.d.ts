import type { ReadOps } from "./base-handle.ts";
export { query } from "./dialect-handle.ts";
export type Op<Ast = any> = (ast: Ast, ...args: never[]) => void;
declare const QUERY: unique symbol;
export type Query<Ast = any, A extends unknown[] = any[], R = unknown> = ((ast: Ast, ...args: A) => R) & {
    readonly [QUERY]: true;
};
export type OpPack<Ast = any> = Record<string, Op<Ast>>;
export interface DialectDescriptor<Ast = any, Ops extends OpPack<Ast> = OpPack<Ast>> {
    extensions: string[];
    ast: {
        parse(source: string): Ast;
        print(ast: Ast): string;
    };
    ops: Ops;
}
type Bound<Ast, F> = F extends (ast: Ast, ...rest: infer R) => void ? (...rest: R) => void : never;
type Edited<Ast, Ops extends OpPack<Ast>> = Handle<"writable", Ast, Ops>;
type OpMethods<Ast, Ops extends OpPack<Ast>> = {
    [K in keyof Ops]: Ops[K] extends Query<any, infer A, infer R> ? (...a: A) => Promise<Awaited<R>> : (...a: Parameters<Bound<Ast, Ops[K]>>) => Edited<Ast, Ops>;
};
type DialectWriteOps<Ast, Ops extends OpPack<Ast>> = {
    replaceContent(content: string): Edited<Ast, Ops>;
    rename(newName: string, opts?: {
        force?: boolean;
    }): Edited<Ast, Ops>;
    move(toDir: string, opts?: {
        force?: boolean;
    }): Edited<Ast, Ops>;
    copy(to: string, opts?: {
        force?: boolean;
    }): Edited<Ast, Ops>;
};
export type Handle<State extends "found" | "writable" = "found", Ast = any, Ops extends OpPack<Ast> = OpPack<Ast>> = ReadOps & DialectWriteOps<Ast, Ops> & {
    modify(fn: (ast: Ast) => void): Edited<Ast, Ops>;
} & OpMethods<Ast, Ops> & (State extends "found" ? {
    remove(): void;
} : {}) & PromiseLike<void>;
export interface Dialect<Ast = any, Ops extends OpPack<Ast> = OpPack<Ast>> {
    readonly extensions: readonly string[];
    readonly ast: {
        parse(source: string): Ast;
        print(ast: Ast): string;
    };
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
export declare function defineOpPack<Ast, Ops extends OpPack<Ast>>(ops: Ops): Ops;
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
export declare function defineDialect<Ast, Ops extends OpPack<Ast>>(d: DialectDescriptor<Ast, Ops>): Dialect<Ast, Ops>;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
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
export declare const RESERVED_HANDLE_NAMES: readonly ["then", "read", "raw", "modify", "replaceContent", "rename", "move", "copy", "remove"];
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
export declare function withOps<Ast, B extends OpPack<Ast>, P extends OpPack<Ast>[]>(base: Dialect<Ast, B>, ...packs: P): Dialect<Ast, B & UnionToIntersection<P[number]>>;
/**
 * Derives a dialect whose named ops reject at call time, leaving the file unchanged, with a
 * message naming the op, the dialect's extensions and `reason`. The ops stay on the handle and
 * in its type, so one handle shape can serve every extension of a routed dialect
 * (`byExtension`). Throws at composition on an op name the dialect does not have.
 *
 * @example
 * const jsx = withoutOps(defineDialect({ extensions: [".jsx"], ast: jsxAst, ops: tsx.ops }), ["addTypeImport"], ".jsx files have no type syntax");
 */
export declare function withoutOps<Ast, Ops extends OpPack<Ast>>(dialect: Dialect<Ast, Ops>, names: readonly (keyof Ops & string)[], reason: string): Dialect<Ast, Ops>;
/**
 * Derives a dialect whose named ops run `overrides` instead, with the same signatures. Throws at
 * composition on an op name the dialect does not have; adding new ops is `withOps`'s job.
 *
 * @example
 * const jsx = overrideOps(tsx, { addClassProperty: jsxClassProperty });
 */
export declare function overrideOps<Ast, Ops extends OpPack<Ast>>(dialect: Dialect<Ast, Ops>, overrides: Partial<Ops>): Dialect<Ast, Ops>;
type DialectsByExtension = {
    readonly [extension: string]: Dialect;
};
type HandleOf<D> = D extends Dialect<infer A, infer O> ? Handle<"found", A, O> : never;
type MatchingKey<M, P extends string> = {
    [K in keyof M & string]: P extends `${string}${K}` ? K : never;
}[keyof M & string];
type LongestKey<Ks extends string> = {
    [K in Ks]: [Extract<Exclude<Ks, K>, `${string}${K}`>] extends [never] ? K : never;
}[Ks];
type RoutedHandle<M extends DialectsByExtension, P extends string> = string extends P ? HandleOf<M[keyof M]> : HandleOf<M[LongestKey<MatchingKey<M, P>>]>;
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
export declare function byExtension<M extends DialectsByExtension>(dialects: M): ExtensionRouter<M>;
