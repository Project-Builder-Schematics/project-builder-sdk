// S-003: defineDialect / defineOpPack / withOps — types + thin signatures only (KIT-04 / ADR-0010).
// Real generics (AST type param, op-pack intersection, handle factory) arrive at T-M2.
// These stubs establish the public type surface and compile-time contracts.

// An op is a function over an AST value and optional args.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Op = (...args: any[]) => void;

// An op-pack is a named record of ops over a shared AST type (ADR-0010).
export type OpPack = Record<string, Op>;

// A dialect bundles file-extension matchers, an AST parse/print pair, and an op-pack.
// The shape is intentionally minimal — full generics arrive at T-M2.
export interface Dialect {
  extensions: string[];
  ops: OpPack;
}

// defineOpPack: declare a named collection of ops for an AST type.
// T-M2 will add the AST type parameter; here the signature is thin and unparameterised.
export function defineOpPack(ops: OpPack): OpPack {
  return ops;
}

// defineDialect: assemble a Dialect from extensions + ops.
// T-M2 will add the AST parse/print pair and full generic handle factory.
export function defineDialect(descriptor: { extensions: string[]; ops: OpPack }): Dialect {
  return descriptor;
}

// withOps: compose additional op-packs onto a base dialect.
// Returns a new Dialect whose ops are the union of the base and all provided packs.
// T-M2 will refine the return type to `Handle<State, Ast, BaseOps & ExtraOps>`.
export function withOps(base: Dialect, ...packs: OpPack[]): Dialect {
  const merged: OpPack = { ...base.ops };
  for (const pack of packs) {
    Object.assign(merged, pack);
  }
  return { extensions: base.extensions, ops: merged };
}
