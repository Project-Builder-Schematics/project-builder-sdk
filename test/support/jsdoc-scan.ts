// Shared with doc-discoverability.test.ts and classify-content.test.ts — same convention
// already used by FIT-06/FIT-08/FIT-09: readFileSync + regex, no markdown/TS-AST parser
// dependency.

export const PROJECT_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

/**
 * Returns the JSDoc block (`/** ... *\/`) immediately preceding the first line matching
 * `anchorPattern`, or "" if no JSDoc directly precedes it (a blank line breaks the chain).
 */
export function jsDocBefore(source: string, anchorPattern: RegExp): string {
  const lines = source.split("\n");
  const anchorIdx = lines.findIndex((line) => anchorPattern.test(line));
  if (anchorIdx === -1) {
    throw new Error(`anchor not found: ${anchorPattern}`);
  }

  let end = -1;
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "") continue;
    if (trimmed.endsWith("*/")) end = i;
    break;
  }
  if (end === -1) return "";

  let start = end;
  for (; start >= 0; start--) {
    if (lines[start]!.trim().startsWith("/**")) break;
  }
  return lines.slice(start, end + 1).join("\n");
}
