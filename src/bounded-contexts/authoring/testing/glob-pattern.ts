// The listing the in-memory engines answer `list` with, matching as the engine's `tree.list` does
// (E-37, engine ADR-0070): `*` is any run of characters in one segment, `?` one character, `**` as
// a whole segment any number of segments, zero included, and `{a,b}` either alternative, nested
// groups included. Every other character is literal, so there is no negation and no class.

import { posix } from "node:path";

/** Every brace-free pattern `{a,b}` groups stand for. A `{` with no closing `}` is literal. */
function alternatives(pattern: string): string[] {
  const open = pattern.indexOf("{");
  if (open === -1) return [pattern];
  const commas: number[] = [];
  let depth = 0;
  for (let i = open; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "{") depth++;
    else if (char === "," && depth === 1) commas.push(i);
    else if (char === "}" && --depth === 0) {
      const bounds = [open, ...commas, i];
      const rest = pattern.slice(i + 1);
      return bounds
        .slice(1)
        .flatMap((end, k) => alternatives(pattern.slice(0, open) + pattern.slice(bounds[k]! + 1, end) + rest));
    }
  }
  return alternatives(pattern.slice(open + 1)).map((tail) => pattern.slice(0, open + 1) + tail);
}

function segmentSource(segment: string): string {
  return [...segment].map((char) => (char === "*" ? "[^/]*" : char === "?" ? "[^/]" : char.replace(/[\\^$.+()[\]{}|]/g, "\\$&"))).join("");
}

function compile(pattern: string): RegExp {
  const segments = pattern.split("/");
  const source = segments
    .map((segment, i) => {
      const last = i === segments.length - 1;
      if (segment === "**") return last ? ".*" : "(?:[^/]+/)*";
      return segmentSource(segment) + (last ? "" : "/");
    })
    .join("");
  return new RegExp(`^${source}$`, "s");
}

function matcher(pattern: string): (path: string) => boolean {
  const compiled = alternatives(pattern).map(compile);
  return (path) => compiled.some((regex) => regex.test(path));
}

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
  const matches = matcher(pattern);
  const ignored = ignore.map(matcher);
  return [...files]
    .filter((path) => matches(path) && !ignored.some((ignores) => ignores(path)))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
