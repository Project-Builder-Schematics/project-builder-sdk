// Glob matching as the engine's `tree.list` matches (E-37, engine ADR-0070): `*` is any run of
// characters in one segment, `?` one character, `**` as a whole segment any number of segments,
// zero included, and `{a,b}` either alternative, nested groups included. Every other character is
// literal, so there is no negation and no class.

/** Every brace-free pattern `{a,b}` groups stand for. A `{` with no closing `}` is literal. */
export function alternatives(pattern: string): string[] {
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

// Matched without RegExp, which the runner closure does not admit (Constraint 4).
// `*` is any run of characters in one segment and `?` one character, by backtracking on the last `*`.
function segmentMatches(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && pattern[p] === "*") {
      star = p++;
      mark = t;
    } else if (p < pattern.length && (pattern[p] === "?" || pattern[p] === text[t])) {
      p++;
      t++;
    } else if (star !== -1) {
      p = star + 1;
      t = ++mark;
    } else {
      return false;
    }
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}

// A `**` segment matches any number of segments, zero included; as the last segment it matches
// the rest of the path, so it needs at least one more segment there.
function segmentsMatch(pattern: readonly string[], path: readonly string[], i: number, j: number): boolean {
  if (i === pattern.length) return j === path.length;
  const segment = pattern[i]!;
  if (segment !== "**") return j < path.length && segmentMatches(segment, path[j]!) && segmentsMatch(pattern, path, i + 1, j + 1);
  if (i === pattern.length - 1) return j < path.length;
  for (let k = j; k <= path.length; k++) {
    if (k > j && path[k - 1] === "") return false;
    if (segmentsMatch(pattern, path, i + 1, k)) return true;
  }
  return false;
}

/** Whether a workspace-relative path matches `pattern`. */
export function globMatcher(pattern: string): (path: string) => boolean {
  const compiled = alternatives(pattern).map((alternative) => alternative.split("/"));
  return (path) => {
    const segments = path.split("/");
    return compiled.some((alternative) => segmentsMatch(alternative, segments, 0, 0));
  };
}
