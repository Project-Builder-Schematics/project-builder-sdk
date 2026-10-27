import { expect } from "bun:test";
import { defineFactory } from "../../../src/core/context.ts";
import * as json from "../../../src/dialects/json/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

type JsonHandle = ReturnType<typeof json.find>;

/** Seeds `path`, runs `chain` on one handle, and returns the emitted modifies plus any rejection. */
export async function runJson(seed: string, chain: (handle: JsonHandle) => PromiseLike<void>, path = "file.json") {
  const { client, emitted } = makeSpyClient({ [path]: seed });
  const run = defineFactory<void>(async () => {
    await chain(json.find(path));
  });
  let error: Error | undefined;
  try {
    await run(undefined, { client });
  } catch (caught) {
    error = caught as Error;
  }
  const modifies = collectModifies(emitted);
  return { error, modifies, content: modifies.at(-1)?.modify.content };
}

/** The chain's final content; fails when the chain rejected or emitted nothing. */
export async function edited(seed: string, chain: (handle: JsonHandle) => PromiseLike<void>): Promise<string> {
  const { error, modifies } = await runJson(seed, chain);
  expect(error).toBeUndefined();
  expect(modifies).toHaveLength(1);
  return modifies[0]!.modify.content;
}

/** Asserts the chain left the file byte-unchanged: no rejection and zero directives. */
export async function expectUnchanged(seed: string, chain: (handle: JsonHandle) => PromiseLike<void>): Promise<void> {
  const { error, modifies } = await runJson(seed, chain);
  expect(error).toBeUndefined();
  expect(modifies).toHaveLength(0);
}

/** Asserts the chain rejected with the contained prefix, every `fragments` entry, and zero directives. */
export async function expectRejected(
  seed: string,
  chain: (handle: JsonHandle) => PromiseLike<void>,
  ...fragments: string[]
): Promise<string> {
  const { error, modifies } = await runJson(seed, chain);
  expect(error).toBeInstanceOf(Error);
  expect(error!.message.startsWith("dialect operation failed: ")).toBe(true);
  for (const fragment of fragments) expect(error!.message).toContain(fragment);
  expect(modifies).toHaveLength(0);
  return error!.message;
}
