// REQ-ATH-19 (S-001, ADR-C single-wrap-seam invariant): the manual "other path" of the
// wrap-parity proof — invokes `defineFactory` DIRECTLY, never re-wrapping via
// `runFactoryForTest` (a re-wrapping reference would silently reintroduce a double-wrap
// and pass the parity test on a lie). The client below is a hand-built object
// STRUCTURALLY mirroring `src/testing/index.ts:100-116`'s private `RecordingClient`
// interface — that interface is unexported and deliberately never imported here; this
// file only matches its shape (four members, same signatures).
import { defineFactory } from "../../src/core/context.ts";
import type { Batch } from "../../src/core/wire.ts";
import type { AuthoringError } from "../../src/core/authoring-error.ts";
import { ContractFake, type ContractFakeOptions } from "../../src/testing/contract-fake.ts";

export interface ManualRunResult {
  tree: ReadonlyMap<string, string>;
  emitted: Batch[];
  error: AuthoringError | unknown;
}

/**
 * A `ContractFake` variant whose `discard()` always rejects with `discardError` — the
 * double-fault fixture (REQ-ATH-19.2): a factory throws `E1`, this fake's `discard()`
 * subsequently throws `E2`, and the reference path must still yield `error === E1` with
 * `error.cause === E2`, exactly like `runFactoryForTest`'s own catch.
 */
export class FaultyDiscardFake extends ContractFake {
  readonly #discardError: unknown;

  constructor(options: ContractFakeOptions, discardError: unknown) {
    super(options);
    this.#discardError = discardError;
  }

  override async discard(): Promise<void> {
    throw this.#discardError;
  }
}

/**
 * Drives `fn` through `defineFactory` DIRECTLY — never through `runFactoryForTest` —
 * against a hand-built client structurally identical to `RecordingClient`, over either a
 * fresh `ContractFake({ seed })` or a caller-supplied fake instance (for the
 * `FaultyDiscardFake` double-fault fixture). This is the reference path REQ-ATH-19 proves
 * `runFactoryForTest` must match.
 */
export async function runViaManualWrap<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL; fake?: ContractFake }
): Promise<ManualRunResult> {
  const fake = options?.fake ?? new ContractFake({ seed: options?.seed ?? {} });
  const emitted: Batch[] = [];
  const client = {
    emit(batch: Batch): Promise<void> {
      emitted.push(batch);
      return fake.emit(batch);
    },
    read(path: string): Promise<string | undefined> {
      return fake.read(path);
    },
    commit(): Promise<void> {
      return fake.commit();
    },
    discard(): Promise<void> {
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
