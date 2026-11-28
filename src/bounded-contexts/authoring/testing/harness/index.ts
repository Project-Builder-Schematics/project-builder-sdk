// ./testing — the third audience, `author-testing` (ADR-0009 amendment, ADR-0033).
// `runFactoryForTest` wraps the normative `ContractFake` with spy-style batch recording; it
// exposes the RESULT of a run, never kit machinery. `RecordingClient` is a local structural
// port (REQ-TES-07) that deliberately never spells out the kit's own port-interface or
// rejection-value type names (FIT-10 scans this file for those literal identifiers) — the
// runner `defineFactory` produces is typed against that same port shape, and the two are
// structurally identical (same four members/signatures), so they are mutually assignable
// under `strictFunctionTypes` without a cast.
import type { Batch, Directive } from "../../domain/valueobjects/wire.ts";
import type { AuthoringError } from "../../domain/valueobjects/authoring-error.ts";
import type { Role } from "../../domain/valueobjects/findings.ts";
import { defineFactory } from "../../application/usecases/run-factory/context.ts";
import { ContractFake } from "../contract-fake.ts";
import { nodePackageFiles } from "../../infrastructure/out/fs/package-files.ts";

interface RecordingClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string | undefined>;
  list(pattern: string, ignore?: readonly string[]): Promise<readonly string[]>;
  commit(result?: unknown): Promise<void>;
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
export interface RunResult<R = unknown> {
  /**
   * The committed tree (`ContractFake.committedTree()`), path → content. Committed writes
   * ONLY — an unmodified seed path is never present here, even if the factory read it.
   * Content is stored verbatim — `{= ... =}` template placeholders are never rendered here;
   * interpolation is the engine's job, not the harness's.
   */
  tree: ReadonlyMap<string, string>;
  /** One `Batch` per `emit()` call, in call order. */
  emitted: Batch[];
  /**
   * How many reads of each path the fake engine served, in first-read order. A read of an absent
   * path counts; a path the factory never read is not present.
   */
  reads: ReadonlyMap<string, number>;
  /**
   * `undefined` on success. On a rejected write, the attributed `AuthoringError` from the
   * emit seam. On a factory throw, the original thrown value, unmodified.
   */
  error: AuthoringError | unknown;
  /**
   * The Result the run committed (A-14): what the factory returned, validated against the
   * `result` its `schema.json` declares. `null` is a Result; `undefined` means the run
   * committed none, because the factory declares none or the run failed.
   */
  result: R | undefined;
}

export type { Batch, Directive };

/**
 * Runs a bare author factory in-memory against a normative fake engine and returns what
 * actually happened — closing the gap where a write-only factory (one that buffers
 * directives but is never observed to commit them) has no author-facing test to catch it.
 *
 * `fn` is the bare `(input) => R | Promise<R>` author function — never a
 * `defineFactory`-wrapped runner. `runFactoryForTest` wraps `fn` internally by delegating to
 * `defineFactory`, the SAME seam a future production runner will call (single-wrap-seam
 * invariant) — it never reimplements the wrap. The harness constructs its own in-memory fake
 * and spy client internally — callers never construct or pass a client.
 *
 * 0.x, semver-exempt: this module's result shape may still change before the SDK's first
 * stable release, independent of the kit's own semver policy.
 *
 * `./testing` is the supported author-facing test harness — distinct from `./conformance`,
 * which exercises dialect-authoring conformance, not factory behaviour.
 *
 * @param fn - the bare authoring function; receives the resolved input.
 * @param input - the resolved input passed through to `fn`.
 * @param options.seed - pre-existing tree content visible to the factory's own reads
 * (`Record<string,string>`) — the SOLE seeding channel; never reflected in `result.tree`
 * unless the factory itself modifies the seeded path.
 * @param options.packageDir - opts the run into schema-derived run-boundary validation
 * against an adjacent `schema.json` (pass `import.meta.dir`, never `import.meta.url`); when
 * absent the run is the untyped, unvalidated tier, byte-identical to a run with no
 * `packageDir` at all.
 * @param options.declaredDialects - the names of the author-defined dialects the schematic's
 * library declares in its Manifest; a handle of any other named dialect fails the run (A-16).
 * @param options.role - the role the schematic declares in its Collection definition entry. With
 * `evaluation`, `fn` returns its Findings and `result.result` holds them as they leave the
 * schematic: each with its `source`, and only those inside the scope `include` and `exclude` name.
 * @param options.name - the qualified name `collection:schematic` of the schematic, which an
 * evaluation's findings carry as their `source`; required with the role `evaluation`.
 *
 * @example
 * import { runFactoryForTest } from "@pbuilder/sdk/testing";
 * import { create, AuthoringError } from "@pbuilder/sdk/commons";
 * import { expect, test } from "bun:test";
 *
 * test("factory writes a greeting file", async () => {
 *   const run = (input: { name: string }) => {
 *     create("src/greeting.ts", {
 *       template: "export const greeting = '{= .name =}';",
 *       options: { name: input.name },
 *     });
 *   };
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
 *   expect(result.tree.get("src/greeting.ts")).toEqual("export const greeting = '{= .name =}';");
 * });
 */
export async function runFactoryForTest<O, R = void>(
  fn: (input: O) => R | Promise<R>,
  input: O,
  options?: {
    seed?: Record<string, string>;
    packageDir?: string | URL;
    declaredDialects?: readonly string[];
    role?: Role;
    name?: string;
  }
): Promise<RunResult<R>> {
  if (options?.role === "evaluation" && options.name === undefined) {
    throw new Error("runFactoryForTest: an evaluation factory needs options.name, the qualified name collection:schematic");
  }
  const fake = new ContractFake({ seed: options?.seed ?? {} });
  const emitted: Batch[] = [];
  const reads = new Map<string, number>();
  let committed: R | undefined;
  const client: RecordingClient = {
    emit(batch) {
      emitted.push(batch);
      return fake.emit(batch);
    },
    read(path) {
      reads.set(path, (reads.get(path) ?? 0) + 1);
      return fake.read(path);
    },
    list(pattern, ignore) {
      return fake.list(pattern, ignore);
    },
    commit(result) {
      committed = result as R | undefined;
      return fake.commit();
    },
    discard() {
      return fake.discard();
    },
  };

  const run = defineFactory<O, R>(
    fn,
    options?.packageDir !== undefined
      ? { packageDir: options.packageDir, packageFiles: nodePackageFiles, declaredDialects: options.declaredDialects }
      : { declaredDialects: options?.declaredDialects }
  );

  let error: AuthoringError | unknown;
  try {
    await run(input, { client, role: options?.role, name: options?.name });
  } catch (caught) {
    error = caught;
  }

  return { tree: fake.committedTree(), emitted, reads, error, result: committed };
}
