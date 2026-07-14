// ./testing — the third audience, `author-testing` (ADR-0009 amendment, ADR-0033).
// `runFactoryForTest` wraps the normative `ContractFake` with spy-style batch recording; it
// exposes the RESULT of a run, never kit machinery. `RecordingClient` is a local structural
// port (REQ-TES-07) that deliberately never spells out the kit's own port-interface or
// rejection-value type names (FIT-10 scans this file for those literal identifiers) — the
// runner `defineFactory` produces is typed against that same port shape, and the two are
// structurally identical (same four members/signatures), so they are mutually assignable
// under `strictFunctionTypes` without a cast.
import type { Batch, Directive } from "../core/wire.ts";
import type { AuthoringError } from "../core/authoring-error.ts";
import { defineFactory } from "../core/context.ts";
import { ContractFake } from "./contract-fake.ts";

interface RecordingClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string | undefined>;
  commit(): Promise<void>;
  discard(): Promise<void>;
}

/**
 * The outcome of running a factory via `runFactoryForTest`.
 *
 * @example
 * const result: RunResult = await runFactoryForTest(run, input);
 * if (result.error === undefined) {
 *   console.log(result.tree.get("src/greeting.ts"));
 * }
 */
export interface RunResult {
  /**
   * The committed tree (`ContractFake.committedTree()`), path → content. Committed writes
   * ONLY — an unmodified seed path is never present here, even if the factory read it.
   * Content is stored verbatim — `{{...}}` template placeholders are never rendered here;
   * interpolation is the engine's job, not the harness's.
   */
  tree: ReadonlyMap<string, string>;
  /** One `Batch` per `emit()` call, in call order. */
  emitted: Batch[];
  /**
   * `undefined` on success. On a rejected write, the attributed `AuthoringError` from the
   * emit seam. On a factory throw, the original thrown value, unmodified.
   */
  error: AuthoringError | unknown;
}

export type { Batch, Directive };
export { defineFactory } from "../core/context.ts";

/**
 * Runs an author factory in-memory against a normative fake engine and returns what
 * actually happened — closing the gap where a write-only factory (one that buffers
 * directives but is never observed to commit them) has no author-facing test to catch it.
 *
 * `factory` is the RUNNER `defineFactory` produces, never the raw function passed to it.
 * The harness constructs its own in-memory fake and spy client internally — callers never
 * construct or pass a client.
 *
 * 0.x, semver-exempt: this module's result shape may still change before the SDK's first
 * stable release, independent of the kit's own semver policy.
 *
 * `./testing` is the supported author-facing test harness — distinct from `./conformance`,
 * which exercises dialect-authoring conformance, not factory behaviour.
 *
 * @param factory - the runner returned by `defineFactory`.
 * @param input - the resolved input passed through to `factory`.
 * @param options.seed - pre-existing tree content visible to the factory's own reads
 * (`Record<string,string>`) — the SOLE seeding channel; never reflected in `result.tree`
 * unless the factory itself modifies the seeded path.
 *
 * @example
 * import { defineFactory, runFactoryForTest } from "@pbuilder/sdk/testing";
 * import { create, AuthoringError } from "@pbuilder/sdk/commons";
 * import { expect, test } from "bun:test";
 *
 * test("factory writes a greeting file", async () => {
 *   const run = defineFactory<{ name: string }>((input) => {
 *     create("src/greeting.ts", {
 *       template: "export const greeting = '{{name}}';",
 *       options: { name: input.name },
 *     });
 *   });
 *
 *   const result = await runFactoryForTest(run, { name: "hello" });
 *
 *   if (result.error !== undefined) {
 *     if (result.error instanceof AuthoringError) {
 *       throw new Error(`unexpected rejection: ${result.error.reason}`);
 *     }
 *     throw result.error;
 *   }
 *
 *   expect(result.tree.get("src/greeting.ts")).toEqual("export const greeting = '{{name}}';");
 * });
 */
export async function runFactoryForTest<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL }
): Promise<RunResult> {
  const fake = new ContractFake({ seed: options?.seed ?? {} });
  const emitted: Batch[] = [];
  const client: RecordingClient = {
    emit(batch) {
      emitted.push(batch);
      return fake.emit(batch);
    },
    read(path) {
      return fake.read(path);
    },
    commit() {
      return fake.commit();
    },
    discard() {
      return fake.discard();
    },
  };

  const run = defineFactory<O>(
    fn,
    options?.packageDir !== undefined ? { packageDir: options.packageDir } : undefined
  );

  let error: AuthoringError | unknown;
  try {
    await run(input, { client });
  } catch (caught) {
    error = caught;
  }

  return { tree: fake.committedTree(), emitted, error };
}
