// ADR-0032: hand-rolled JSON position locator — replaces the dead V8-only
// `at position N` engine-message extraction (Bun/JavaScriptCore's JSON.parse never emits
// a byte offset). Pure, zero-dep, engine-independent: a minimal left-to-right JSON syntax
// scanner (not a value builder) that re-scans already-rejected text to pin the first grammar
// deviation. Runs ONLY in schema-parse.ts's catch branch — no hot path.
//
// Fidelity boundary (ADR-0032, deliberately bounded): strings are consumed STRUCTURALLY
// (a backslash escapes the next char, full stop) — no validation of escape internals. That
// means an in-string escape violation (bad `\u` hex, invalid escape char) scans as a
// well-formed string and the scanner can report the document "grammatically complete" even
// though native JSON.parse threw. That divergence is intentional: it is the one case this
// locator returns `undefined`, giving REQ-TFO-04.4's fallback branch a real fixture instead of
// pretending full JSON-grammar fidelity for no user-visible gain.

type ScanResult = { readonly ok: true; readonly next: number } | { readonly ok: false; readonly offset: number };

function ok(next: number): ScanResult {
  return { ok: true, next };
}

function fail(offset: number): ScanResult {
  return { ok: false, offset };
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function skipWhitespace(raw: string, i: number): number {
  let pos = i;
  while (pos < raw.length && isWhitespace(raw[pos] as string)) pos++;
  return pos;
}

// Consumes a string starting at `raw[i] === '"'`. Structural only — see fidelity boundary note.
function scanString(raw: string, i: number): ScanResult {
  let pos = i + 1;
  while (pos < raw.length) {
    const ch = raw[pos];
    if (ch === '"') return ok(pos + 1);
    if (ch === "\\") {
      pos += 2;
      continue;
    }
    pos++;
  }
  return fail(pos);
}

// JSON number grammar: -?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?
function scanNumber(raw: string, i: number): ScanResult {
  let pos = i;
  if (raw[pos] === "-") pos++;
  if (!isDigit(raw[pos])) return fail(pos);
  if (raw[pos] === "0") {
    pos++;
  } else {
    while (isDigit(raw[pos])) pos++;
  }
  if (raw[pos] === ".") {
    pos++;
    if (!isDigit(raw[pos])) return fail(pos);
    while (isDigit(raw[pos])) pos++;
  }
  if (raw[pos] === "e" || raw[pos] === "E") {
    pos++;
    if (raw[pos] === "+" || raw[pos] === "-") pos++;
    if (!isDigit(raw[pos])) return fail(pos);
    while (isDigit(raw[pos])) pos++;
  }
  return ok(pos);
}

function scanObject(raw: string, i: number): ScanResult {
  let pos = skipWhitespace(raw, i + 1);
  if (pos >= raw.length) return fail(pos);
  if (raw[pos] === "}") return ok(pos + 1);

  for (;;) {
    pos = skipWhitespace(raw, pos);
    if (pos >= raw.length) return fail(pos);
    if (raw[pos] !== '"') return fail(pos); // unquoted key / non-string property name
    const key = scanString(raw, pos);
    if (!key.ok) return key;
    pos = skipWhitespace(raw, key.next);
    if (pos >= raw.length) return fail(pos);
    if (raw[pos] !== ":") return fail(pos);
    const value = scanValue(raw, pos + 1);
    if (!value.ok) return value;
    pos = skipWhitespace(raw, value.next);
    if (pos >= raw.length) return fail(pos);
    if (raw[pos] === ",") {
      pos = skipWhitespace(raw, pos + 1);
      if (pos >= raw.length) return fail(pos);
      if (raw[pos] === "}") return fail(pos); // trailing comma
      continue;
    }
    if (raw[pos] === "}") return ok(pos + 1);
    return fail(pos); // expected ',' or '}'
  }
}

function scanArray(raw: string, i: number): ScanResult {
  let pos = skipWhitespace(raw, i + 1);
  if (pos >= raw.length) return fail(pos);
  if (raw[pos] === "]") return ok(pos + 1);

  for (;;) {
    const value = scanValue(raw, pos);
    if (!value.ok) return value;
    pos = skipWhitespace(raw, value.next);
    if (pos >= raw.length) return fail(pos);
    if (raw[pos] === ",") {
      pos = skipWhitespace(raw, pos + 1);
      if (pos >= raw.length) return fail(pos);
      if (raw[pos] === "]") return fail(pos); // trailing comma
      continue;
    }
    if (raw[pos] === "]") return ok(pos + 1);
    return fail(pos); // expected ',' or ']'
  }
}

function scanValue(raw: string, i0: number): ScanResult {
  const i = skipWhitespace(raw, i0);
  if (i >= raw.length) return fail(i); // premature EOF where a value was expected

  const ch = raw[i];
  if (ch === "{") return scanObject(raw, i);
  if (ch === "[") return scanArray(raw, i);
  if (ch === '"') return scanString(raw, i);
  if (ch === "-" || isDigit(ch)) return scanNumber(raw, i);
  if (raw.startsWith("true", i)) return ok(i + 4);
  if (raw.startsWith("false", i)) return ok(i + 5);
  if (raw.startsWith("null", i)) return ok(i + 4);
  return fail(i); // stray/garbage token, malformed keyword
}

function offsetToLineColumn(raw: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastNewlineAt = -1;
  for (let i = 0; i < offset && i < raw.length; i++) {
    if (raw[i] === "\n") {
      line++;
      lastNewlineAt = i;
    }
  }
  return { line, column: offset - lastNewlineAt };
}

/**
 * Re-scans `raw` (text already rejected by `JSON.parse`) to pin the 1-based `{line, column}`
 * of the first JSON-grammar deviation. Returns `undefined` when the scanner completes without
 * finding one — either an in-string escape violation (bounded fidelity, ADR-0032) or a
 * defensive scanner/`JSON.parse` divergence. Pure; no I/O.
 */
export function locateFirstJsonSyntaxError(raw: string): { line: number; column: number } | undefined {
  const result = scanValue(raw, 0);
  if (!result.ok) {
    return offsetToLineColumn(raw, result.offset);
  }

  const trailing = skipWhitespace(raw, result.next);
  if (trailing < raw.length) {
    return offsetToLineColumn(raw, trailing);
  }

  return undefined;
}
