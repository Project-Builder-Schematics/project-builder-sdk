// Shared cross-boundary rejection-capture boilerplate: run something that is expected to
// reject and return whatever it threw (or undefined on success), instead of every call
// site hand-rolling its own try/catch.

import { defineFactory } from "../../src/core/context.ts";
import type { ContractFake } from "./contract-fake.ts";
import type { Batch } from "../../src/core/wire.ts";

/**
 * Runs `fn` inside a fresh factory against `fake` and returns whatever it threw.
 * `options.packageDir` opts the factory into the package-anchored flow (scaffold/copyIn/
 * templateFile call sites), exactly as `defineFactory(fn, { packageDir })` would.
 */
export async function rejectedRun(
  fake: ContractFake,
  fn: () => void | Promise<void>,
  options?: { packageDir?: string }
): Promise<unknown> {
  const run = defineFactory<void>(fn, options);
  try {
    await run(undefined, { client: fake });
    return undefined;
  } catch (err) {
    return err;
  }
}

/** Emits `batch` against `fake` directly (no factory/session) and returns whatever it threw. */
export async function rejectedEmit(fake: ContractFake, batch: Batch): Promise<unknown> {
  try {
    await fake.emit(batch);
    return undefined;
  } catch (err) {
    return err;
  }
}
