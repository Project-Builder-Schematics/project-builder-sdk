import { AUTHOR_DIALECT_STEPS } from "./authoring/author-dialect-steps.ts";
import { DIALECT_OP_STEPS } from "./authoring/dialect-ops.ts";
import { FILES_DIRECTORY_STEPS } from "./authoring/files-directory-steps.ts";
import { CONFORMANCE_STEPS } from "./authoring/conformance-steps.ts";
import { HANDLE_STEPS } from "./authoring/handle-steps.ts";
import { SESSION_STEPS } from "./authoring/session-steps.ts";
import type { StepDefinition } from "./runner/steps.ts";
import { FACTORY_RUN_STEPS } from "./shared/factory-run.ts";

/** Every step definition of the SDK's acceptance suite, gathered from the context folders. */
export const STEP_DEFINITIONS: readonly StepDefinition[] = [
  ...FACTORY_RUN_STEPS,
  ...DIALECT_OP_STEPS,
  ...HANDLE_STEPS,
  ...SESSION_STEPS,
  ...FILES_DIRECTORY_STEPS,
  ...CONFORMANCE_STEPS,
  ...AUTHOR_DIALECT_STEPS,
];
