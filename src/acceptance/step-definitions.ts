import { DIALECT_OP_STEPS } from "./authoring/dialect-ops.ts";
import type { StepDefinition } from "./runner/steps.ts";
import { FACTORY_RUN_STEPS } from "./shared/factory-run.ts";

/** Every step definition of the SDK's acceptance suite, gathered from the context folders. */
export const STEP_DEFINITIONS: readonly StepDefinition[] = [...FACTORY_RUN_STEPS, ...DIALECT_OP_STEPS];
