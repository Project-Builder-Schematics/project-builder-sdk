import { expect } from "bun:test";
import { readdirSync } from "node:fs";

/**
 * Shared by every fixture corpus that must stay readdir-enumerated in both directions
 * (deny-scan/, bundler-scripts/, fail-closed/): a corpus file added without being declared,
 * or declared without being on disk, fails loudly either way.
 */
export function expectCorpusMatchesDeclared(dir: string, declared: readonly string[]): void {
  expect(readdirSync(dir).sort()).toEqual([...declared].sort());
}
