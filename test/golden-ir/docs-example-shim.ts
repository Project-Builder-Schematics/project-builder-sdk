// Stands in for both `bun:test` and `@pbuilder/sdk/testing` when a docs example runs inside
// P-IR: `test()` bodies are queued instead of registered, and every runFactoryForTest call is
// recorded so its batches can be compared with the golden.
import { expect } from "bun:test";
import { runFactoryForTest as realRunFactoryForTest, type RunResult } from "../../src/testing/index.ts";

export { expect };

export const recordedRuns: RunResult[] = [];
export const queuedTests: Array<() => unknown> = [];

export function test(_name: string, body: () => unknown): void {
  queuedTests.push(body);
}

export async function runFactoryForTest(...args: Parameters<typeof realRunFactoryForTest>): Promise<RunResult> {
  const result = await realRunFactoryForTest(...args);
  recordedRuns.push(result);
  return result;
}
