// Internal kit root (ADR-0009 boundary). Not exported to authors.
// Extraction-ready: becomes @pbuilder/sdk-kit when the first external dialect lands.

export type { EngineClient } from "./engine-client.ts";
export type { Batch, Directive, JsonValue } from "./wire.ts";
export { Session } from "./session.ts";
export { DirectiveFactory } from "./directive-factory.ts";
export type { RunContext } from "./context.ts";
export { defineFactory, currentContext } from "./context.ts";
export { ContractFake } from "./contract-fake.ts";
export type { ReadOps, WriteOps, WritableHandleRef } from "./base-handle.ts";
export type { FoundHandle, WritableHandle } from "./handle-state.ts";
export { defineDialect, defineOpPack, withOps } from "./define-dialect.ts";
export type { Dialect, OpPack } from "./define-dialect.ts";
