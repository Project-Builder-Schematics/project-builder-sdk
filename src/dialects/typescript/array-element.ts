import type { Node, SourceFile } from "ts-morph";

// Appends `item` after the last entry of an array or object literal, keeping its layout: one
// line stays one line, a multi-line list gets a new line at the last entry's indentation, and
// a trailing comma stays trailing.
export function appendEntry(ast: SourceFile, list: Node, entries: Node[], item: string, empty: string): void {
  const last = entries.at(-1);
  if (last === undefined) {
    list.replaceWithText(empty);
    return;
  }
  const text = ast.getFullText();
  const closeAt = list.getEnd() - 1;
  const commaAt = text.indexOf(",", last.getEnd());
  const trailingComma = commaAt !== -1 && commaAt < closeAt;
  if (!text.slice(list.getStart(), closeAt).includes("\n")) {
    if (trailingComma) ast.insertText(commaAt + 1, ` ${item},`);
    else ast.insertText(last.getEnd(), `, ${item}`);
    return;
  }
  const indent = /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", last.getStart()) + 1))![0];
  if (trailingComma) ast.insertText(commaAt + 1, `\n${indent}${item},`);
  else ast.insertText(last.getEnd(), `,\n${indent}${item}`);
}
