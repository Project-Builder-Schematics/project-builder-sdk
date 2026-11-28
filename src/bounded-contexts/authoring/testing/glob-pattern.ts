// The listing the in-memory engines answer `list` with, matching as the engine's `tree.list` does.

import { posix } from "node:path";
import { alternatives, globMatcher } from "../domain/services/glob-match.ts";

/**
 * The paths among `files` that `pattern` matches and no `ignore` pattern does, sorted bytewise.
 * Every alternative of `pattern` must stay inside the workspace, as the engine's gate requires.
 */
export function listMatching(files: Iterable<string>, pattern: string, ignore: readonly string[] = []): string[] {
  for (const alternative of alternatives(pattern)) {
    const normalized = posix.normalize(alternative);
    if (posix.isAbsolute(alternative) || normalized === ".." || normalized.startsWith("../")) {
      throw new Error("path escapes workspace");
    }
  }
  const matches = globMatcher(pattern);
  const ignored = ignore.map(globMatcher);
  return [...files]
    .filter((path) => matches(path) && !ignored.some((ignores) => ignores(path)))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
