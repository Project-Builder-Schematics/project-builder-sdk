import { parse as parseCss, type Root } from "postcss";

/**
 * Parses `source` into a PostCSS `Root`, throwing on a CSS syntax error. PostCSS keeps every
 * whitespace, comment, and BOM byte in node `raws`, so `print` returns an unedited source as is.
 */
export function parse(source: string): Root {
  try {
    return parseCss(source);
  } catch {
    throw new Error("invalid CSS");
  }
}

export function print(root: Root): string {
  return root.toString();
}
