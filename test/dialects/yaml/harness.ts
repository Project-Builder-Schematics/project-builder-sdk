import { expect } from "bun:test";
import { defineFactory } from "../../../src/core/context.ts";
import * as yaml from "../../../src/dialects/yaml/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

export type YamlHandle = ReturnType<typeof yaml.find>;

export interface Outcome {
  error: Error | undefined;
  modifies: number;
  content: string | undefined;
  after: string | undefined;
}

/** Runs `chain` on a seeded `.yaml` file through the public `find()` and reports every effect. */
export async function apply(
  source: string,
  chain: (handle: YamlHandle) => PromiseLike<unknown>,
  path = "config.yaml"
): Promise<Outcome> {
  const { client, emitted } = makeSpyClient({ [path]: source });
  const run = defineFactory<void>(async () => {
    await chain(yaml.find(path));
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
  chain: (handle: YamlHandle) => PromiseLike<unknown>,
  expected: string
): Promise<void> {
  const outcome = await apply(source, chain);
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
  chain: (handle: YamlHandle) => PromiseLike<unknown>,
  fragment: string
): Promise<void> {
  const outcome = await apply(source, chain);
  expect(outcome.error).toBeInstanceOf(Error);
  expect(outcome.error!.message.startsWith("dialect operation failed: ")).toBe(true);
  expect(outcome.error!.message).toContain(fragment);
  expect(outcome.modifies).toBe(0);
  expect(outcome.after).toBe(source);
}
