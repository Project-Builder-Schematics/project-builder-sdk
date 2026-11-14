// The files that moved out of src/core into the target layout, src-relative. A guard whose rule
// names src/core keeps that rule over these files too, by exact path: nothing else under
// src/bounded-contexts/ or src/platform/ counts as core.
export const REPLACED_CORE_FILES: readonly string[] = [
  "bounded-contexts/authoring/domain/services/define-dialect.ts",
  "bounded-contexts/authoring/domain/services/jsx-name-validator.ts",
  "bounded-contexts/authoring/domain/services/reject-tail.ts",
  "bounded-contexts/authoring/domain/services/run-context.ts",
  "bounded-contexts/authoring/domain/entities/dialect-handle.ts",
  "bounded-contexts/authoring/domain/entities/base-handle.ts",
  "bounded-contexts/authoring/domain/entities/handle-state.ts",
  "bounded-contexts/authoring/domain/valueobjects/dialect-error.ts",
  "bounded-contexts/authoring/domain/valueobjects/json-value.ts",
  "platform/deep-equal.ts",
  "bounded-contexts/authoring/domain/aggregates/session/session.ts",
  "bounded-contexts/authoring/domain/services/directive-factory.ts",
  "bounded-contexts/authoring/domain/services/schema/input-rejection.ts",
  "bounded-contexts/authoring/domain/services/schema/schema-parse.ts",
  "bounded-contexts/authoring/domain/services/schema/schema-validate.ts",
  "bounded-contexts/authoring/domain/services/schema/schema-sufficiency.ts",
  "bounded-contexts/authoring/domain/services/schema/schema-locate.ts",
  "bounded-contexts/authoring/domain/services/schema/schema-digest.ts",
  "bounded-contexts/authoring/domain/valueobjects/schema-model.ts",
  "bounded-contexts/authoring/domain/valueobjects/authoring-error.ts",
  "bounded-contexts/authoring/domain/valueobjects/wire.ts",
  "bounded-contexts/authoring/domain/ports/engine-client.ts",
  "bounded-contexts/authoring/infrastructure/out/fs/schema-discovery.ts",
  "platform/fs-errors.ts",
];
