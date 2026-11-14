// Internal kit root (ADR-0009 boundary). Not exported to authors.
// Extraction-ready: becomes @pbuilder/sdk-kit when the first external dialect lands.

export type { EngineClient } from "../bounded-contexts/authoring/domain/ports/engine-client.ts";
export type { Batch, Directive, JsonValue } from "../bounded-contexts/authoring/domain/valueobjects/wire.ts";
export { Session } from "../bounded-contexts/authoring/domain/aggregates/session/session.ts";
export { DirectiveFactory } from "../bounded-contexts/authoring/domain/services/directive-factory.ts";
export type { SessionContext } from "../bounded-contexts/authoring/application/usecases/run-factory/context.ts";
export { defineFactory, currentContext } from "../bounded-contexts/authoring/application/usecases/run-factory/context.ts";
export type { ReadOps, WriteOps, WritableHandleRef } from "../bounded-contexts/authoring/domain/entities/base-handle.ts";
export type { FoundHandle, WritableHandle } from "../bounded-contexts/authoring/domain/entities/handle-state.ts";
export { defineDialect, defineOpPack, query, withOps } from "../bounded-contexts/authoring/domain/services/define-dialect.ts";
export type { Dialect, OpPack, Query } from "../bounded-contexts/authoring/domain/services/define-dialect.ts";
