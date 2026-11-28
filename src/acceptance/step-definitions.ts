import { AUTHOR_DIALECT_STEPS } from "./authoring/author-dialect-steps.ts";
import { CODEGEN_STEPS } from "./authoring/codegen-steps.ts";
import { COMPOSITION_STEPS } from "./authoring/composition-steps.ts";
import { DIALECT_OP_STEPS } from "./authoring/dialect-ops.ts";
import { FILES_DIRECTORY_STEPS } from "./authoring/files-directory-steps.ts";
import { CONFORMANCE_STEPS } from "./authoring/conformance-steps.ts";
import { GLOB_STEPS } from "./authoring/glob-steps.ts";
import { HANDLE_STEPS } from "./authoring/handle-steps.ts";
import { SESSION_STEPS } from "./authoring/session-steps.ts";
import { ROOT_RESULT_STEPS } from "./execution/root-result-steps.ts";
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
  ...COMPOSITION_STEPS,
  ...GLOB_STEPS,
  ...ROOT_RESULT_STEPS,
  ...CODEGEN_STEPS,
];
