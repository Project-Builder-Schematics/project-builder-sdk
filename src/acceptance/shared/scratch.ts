import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root: string | undefined;

/** A new directory under one scratch root outside the worktree; `removeScratch` removes them all. */
export function scratchDirectory(prefix: string): string {
  root ??= mkdtempSync(join(tmpdir(), "pbuilder-acceptance-"));
  return mkdtempSync(join(root, prefix));
}

/** Called once a pass ends: `bun test` does not run process exit handlers. */
export function removeScratch(): void {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
  root = undefined;
}
