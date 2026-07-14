// Shared markdown-section extractor for the doc-guard suites (security-authoring-guard,
// testing-story-docs, doc-set-content). Same string/regex-only convention as jsdoc-scan.ts —
// no markdown parser dependency.

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

/**
 * Returns the single line of `doc` containing `fragment` — row lookups locate rows BY
 * CONTENT (a stable fragment of the row's own text), never by line number. Throws if
 * `fragment` is absent — the throw IS the RED evidence for a removed/renamed row.
 */
export function findRowLine(doc: string, fragment: string): string {
  const idx = doc.indexOf(fragment);
  if (idx === -1) {
    throw new Error(`missing a row containing "${fragment}"`);
  }
  const lineStart = doc.lastIndexOf("\n", idx) + 1;
  const lineEnd = doc.indexOf("\n", idx);
  return doc.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
}

/**
 * Returns the LAST `|`-delimited cell of a markdown table `line`, stripped of the
 * convention's `**bold**` wrapper — re-tag checks target that cell specifically, so a row's
 * description prose can still name unrelated content without failing the check.
 */
export function lastTableCell(line: string): string {
  const cells = line.split("|");
  const raw = (cells[cells.length - 2] ?? "").trim();
  return raw.replace(/^\*\*/, "").replace(/\*\*$/, "");
}
