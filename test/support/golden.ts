// Shared loader for the committed byte-exact golden fixtures (slices constraint 7 — every
// content assertion compares against a committed golden, never a count-only check). The
// default dir is the TypeScript dialect's golden set, shared across the dialect, e2e,
// conformance, and fitness suites.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_GOLDEN_DIR = new URL("../dialects/typescript/golden/", import.meta.url).pathname;

export function golden(name: string, dir: string = DEFAULT_GOLDEN_DIR): string {
  return readFileSync(join(dir, name), "utf-8");
}
