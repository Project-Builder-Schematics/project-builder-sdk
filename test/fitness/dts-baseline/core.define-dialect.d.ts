import type { ReadOps } from "./base-handle.ts";
export type Op<Ast = any> = (ast: Ast, ...args: never[]) => void;
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
    [K in keyof Ops]: (...a: Parameters<Bound<Ast, Ops[K]>>) => Edited<Ast, Ops>;
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
export {};
