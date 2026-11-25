import { expect } from "bun:test";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import * as csharp from "../../../../../../../src/dialects/csharp/index.ts";
import { makeSpyClient, collectModifies } from "../../../../../../support/spy-client.ts";

export type CsharpHandle = ReturnType<typeof csharp.find>;

/** The `find` of the dialect under test: `csharp.find` or `aspnet.find`. */
export type Find = (path: string) => PromiseLike<unknown>;

export interface Outcome {
  error: Error | undefined;
  modifies: number;
  content: string | undefined;
  after: string | undefined;
}

/** Runs `chain` on a seeded `.cs` file through the public `find()` and reports every effect. */
export async function apply(
  source: string,
  chain: (handle: CsharpHandle) => PromiseLike<unknown>,
  path = "a.cs",
  find: Find = csharp.find
): Promise<Outcome> {
  const { client, emitted } = makeSpyClient({ [path]: source });
  const run = defineFactory<void>(async () => {
    await chain(find(path) as CsharpHandle);
  });
  let error: Error | undefined;
  try {
    await run(undefined, { client });
  } catch (caught) {
    error = caught as Error;
  }
  const modifies = collectModifies(emitted);
  return { error, modifies: modifies.length, content: modifies[0]?.modify.content, after: await client.read(path) };
}

/** Asserts the chain succeeds and the file becomes `expected`; an unchanged file must emit nothing. */
export async function expectFile(
  source: string,
  chain: (handle: CsharpHandle) => PromiseLike<unknown>,
  expected: string,
  find: Find = csharp.find
): Promise<void> {
  const outcome = await apply(source, chain, "a.cs", find);
  expect(outcome.error).toBeUndefined();
  if (expected === source) {
    expect(outcome.modifies).toBe(0);
  } else {
    expect(outcome.modifies).toBe(1);
    expect(outcome.content).toBe(expected);
  }
}

/** Asserts the chain rejects with the contained prefix, naming `fragment`, and emits nothing. */
export async function expectReject(
  source: string,
  chain: (handle: CsharpHandle) => PromiseLike<unknown>,
  fragment: string,
  find: Find = csharp.find
): Promise<void> {
  const outcome = await apply(source, chain, "a.cs", find);
  expect(outcome.error).toBeInstanceOf(Error);
  expect(outcome.error!.message.startsWith("dialect operation failed: ")).toBe(true);
  expect(outcome.error!.message).toContain(fragment);
  expect(outcome.modifies).toBe(0);
  expect(outcome.after).toBe(source);
}
