// S-002: ts-morph parse/print pair for the TypeScript dialect (REQ-TSD-02, design §4.4).
// FROZEN ManipulationSettings + an explicit, CONTENT-DERIVED newLineKind (never host-OS) —
// a fresh `Project` per parse so the setting can vary per source, never a module-level
// singleton. No language-service formatter is ever invoked (REQ-TSD-02.3): this module calls
// no `.formatText()`/language-service API anywhere.

import { Project, NewLineKind, QuoteKind, IndentationText, type SourceFile } from "ts-morph";

// In-memory-only path fed to ts-morph's virtual file system — never a real disk path; the
// dialect handle (src/core/dialect-handle.ts) owns the AUTHOR-FACING path, this is purely an
// internal identifier ts-morph's Project API requires.
const VIRTUAL_PATH = "dialect-source.ts";

const BOM = "﻿";

// ts-morph's `SourceFile#getFullText()` does NOT round-trip a leading UTF-8 BOM (verified
// empirically against the pinned ts-morph@28.0.0 — the design's "preserved by ts-morph
// independently" prose assumption does not hold for this version): a BOM survives ts-morph's
// OWN internal text but is stripped from every printed string. REQ-TSD-03.6 requires
// byte-exact BOM preservation across a round-trip, so this module owns that: a private
// per-SourceFile flag (WeakMap, invisible to the frozen `Ast = SourceFile` type) remembers
// whether the ORIGINAL source started with a BOM, and `print` re-prepends it. This is
// implementation-internal to this module only — it does not touch the frozen
// `ast.parse(source): Ast` / `ast.print(ast): string` signatures.
const hadBom = new WeakMap<SourceFile, boolean>();

/**
 * Detects the dominant newline convention IN the source content itself — never the host OS
 * (REQ-TSD-02.2). `crlf` = count of `"\r\n"` pairs; `lf` = count of bare `"\n"` (every `\n`
 * minus the ones already counted inside a `\r\n` pair). CRLF wins strictly on `crlf > lf`;
 * a tie (including the empty/no-newline case, `0 > 0` = false) falls back to LF — the
 * deterministic default for indeterminate content.
 *
 * @example
 * detectNewLineKind("a\r\nb\r\n"); // NewLineKind.CarriageReturnLineFeed
 * detectNewLineKind("a\nb\n");     // NewLineKind.LineFeed
 */
export function detectNewLineKind(source: string): NewLineKind {
  const crlf = countOccurrences(source, "\r\n");
  const totalLf = countOccurrences(source, "\n");
  const bareLf = totalLf - crlf;
  return crlf > bareLf ? NewLineKind.CarriageReturnLineFeed : NewLineKind.LineFeed;
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/**
 * Parses TypeScript source into a live ts-morph `SourceFile` — the dialect's `Ast` (design
 * §4.4). Constructs a FRESH `Project` per call (never a module-level singleton) whose
 * `manipulationSettings.newLineKind` is derived from THIS source's own content
 * (`detectNewLineKind`) — the frozen determinism pin (REQ-TSD-02). Indentation and quote
 * style are likewise frozen constants, never inferred from the source or the host.
 *
 * Failure posture (REQ-TSD-04.1 / REQ-DG-05.2): ts-morph's parser is deliberately
 * FAULT-TOLERANT — it does not natively throw on malformed syntax, it records diagnostics.
 * This function surfaces that as a genuine parse failure by throwing when the freshly-parsed
 * file carries at least one SYNTACTIC diagnostic (a real syntax error) — a file with only
 * semantic/type diagnostics (e.g. a type mismatch) is syntactically valid and does NOT throw.
 * The caller (`src/core/dialect-handle.ts`) wraps any throw from this function with the
 * frozen contained-error prefix; this function's own thrown message is never surfaced
 * directly to the author.
 *
 * Row-139 (stage-5b, executor-latitude, no REQ of its own): classification below reads off
 * `getSyntacticDiagnostics()`'s own diagnostic objects — never an assumption about a caught
 * error's own-enumerable-properties or call-stack shape. Verified already in this shape; no
 * heuristic-based classification exists in this function to sweep out.
 */
export function parse(source: string): SourceFile {
  const startsWithBom = source.startsWith(BOM);
  const body = startsWithBom ? source.slice(BOM.length) : source;
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Double,
      newLineKind: detectNewLineKind(body),
      usePrefixAndSuffixTextForRename: false,
    },
  });
  const sourceFile = project.createSourceFile(VIRTUAL_PATH, body);
  if (startsWithBom) hadBom.set(sourceFile, true);

  const syntacticErrors = project.getProgram().getSyntacticDiagnostics(sourceFile);
  if (syntacticErrors.length > 0) {
    throw new Error("syntactically invalid TypeScript source");
  }
  return sourceFile;
}

/**
 * Prints the live AST back to a string — the ONLY serialization point (ADR-0006's "serialize
 * once at flush", realised by the dialect handle's memoized lazy getter). Re-prepends a BOM
 * if the original parse observed one (see `hadBom` above) — ts-morph's own `getFullText()`
 * does not carry it.
 */
export function print(ast: SourceFile): string {
  const text = ast.getFullText();
  return hadBom.get(ast) === true ? BOM + text : text;
}
