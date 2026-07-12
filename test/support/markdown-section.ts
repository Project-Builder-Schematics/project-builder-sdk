// Shared markdown-section extractor for the doc-guard suites (security-authoring-guard,
// testing-story-docs). Same string/regex-only convention as jsdoc-scan.ts — no markdown
// parser dependency.

/**
 * Returns the section of `content` starting at the line whose trimmed text equals `heading`
 * (inclusive) up to, but not including, the next line matching `nextHeadingPattern`. Throws
 * if the heading is absent — the throw IS the RED evidence for a removed section.
 */
export function extractSection(
  content: string,
  heading: string,
  nextHeadingPattern: RegExp = /^#{1,3} /
): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    throw new Error(`missing the "${heading}" section`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (nextHeadingPattern.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
