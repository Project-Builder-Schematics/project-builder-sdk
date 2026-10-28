// Internal kit root (ADR-0009 boundary). Not exported to authors.
// Extraction-ready: becomes @pbuilder/sdk-kit when the first external dialect lands.

export type { EngineClient } from "./engine-client.ts";
export type { Batch, Directive, JsonValue } from "./wire.ts";
export { Session } from "./session.ts";
export { DirectiveFactory } from "./directive-factory.ts";
export type { SessionContext } from "./context.ts";
export { defineFactory, currentContext } from "./context.ts";
export type { ReadOps, WriteOps, WritableHandleRef } from "./base-handle.ts";
export type { FoundHandle, WritableHandle } from "./handle-state.ts";
export { defineDialect, defineOpPack, query, withOps } from "./define-dialect.ts";
export type { Dialect, OpPack, Query } from "./define-dialect.ts";
