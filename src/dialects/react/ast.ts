// S-000: ts-morph parse/print pair for the React dialect (REQ-RXD-03, design §4.4, ADR-01).
// DUPLICATES (does not import) typescript/ast.ts's four fidelity primitives — BOM
// re-prepend, content-derived newline detection, a frozen per-parse ManipulationSettings,
// and the syntactic-diagnostic throw — so `typescript/ast.ts` stays untouched and ts-morph
// stays leaf-isolated to one importer per dialect (fit-38 guards this repo-wide). A fresh
// `Project` per parse, never a module-level singleton, so the newLineKind setting can vary
// per source.

import { Project, NewLineKind, QuoteKind, IndentationText, type SourceFile } from "ts-morph";

// In-memory-only path fed to ts-morph's virtual file system — never a real disk path. The
// `.tsx` extension is what engages `ScriptKind.Tsx` (ts-morph infers script kind from the
// extension, verified empirically against ts-morph@28.0.0 — no explicit scriptKind option
// needed, mirroring typescript/ast.ts's "the extension drives it" shape).
const VIRTUAL_PATH = "dialect-source.tsx";

const BOM = "﻿";

// ts-morph@28's `getFullText()` does not round-trip a leading UTF-8 BOM (same finding as
// typescript/ast.ts, same pinned ts-morph version) — a private per-SourceFile flag remembers
// whether the ORIGINAL source started with a BOM, and `print` re-prepends it. Invisible to
// the frozen `Ast = SourceFile` type; implementation-internal to this module only.
const hadBom = new WeakMap<SourceFile, boolean>();

/**
 * Detects the dominant newline convention IN the source content itself — never the host OS.
 * Identical algorithm to typescript/ast.ts's `detectNewLineKind` (duplicated per ADR-01, not
 * exported here — the React dialect's frozen signatures are `parse`/`print` only).
 */
function detectNewLineKind(source: string): NewLineKind {
  const crlf = countOccurrences(source, "\r\n");
  const totalLf = countOccurrences(source, "\n");
  const bareLf = totalLf - crlf;
  return crlf > bareLf ? NewLineKind.CarriageReturnLineFeed : NewLineKind.LineFeed;
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/**
 * Parses TSX source into a live ts-morph `SourceFile` — the React dialect's `Ast` (design
 * §4.4). Constructs a FRESH `Project` per call (never a module-level singleton) whose
 * `manipulationSettings.newLineKind` is derived from THIS source's own content
 * (`detectNewLineKind`). Indentation and quote style are frozen constants.
 *
 * Failure posture (REQ-RXD-03.5 / REQ-DG-05.2): ts-morph's parser is fault-tolerant — it
 * records diagnostics rather than throwing natively. This function surfaces a genuine parse
 * failure by throwing whenever the freshly-parsed file carries at least one SYNTACTIC
 * diagnostic. `const x = <string>y;` is the canonical proof: a legal angle-bracket cast under
 * `.ts` semantics, but an unclosed JSX element under `ScriptKind.Tsx` (2 syntactic
 * diagnostics, spike-confirmed) — the SAME source parses cleanly through the TypeScript
 * dialect's `parse`, and that divergence is what proves `ScriptKind.Tsx` is actually engaged,
 * not silently defaulted. The caller (`src/core/dialect-handle.ts`) wraps any throw from this
 * function with the frozen contained-error prefix; this function's own thrown message is
 * never surfaced directly to the author.
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
    throw new Error("syntactically invalid TSX source");
  }
  return sourceFile;
}

/**
 * Prints the live AST back to a string — the ONLY serialization point for a React handle's
 * flush. Re-prepends a BOM if the original parse observed one (see `hadBom` above) — ts-morph's
 * own `getFullText()` does not carry it.
 */
export function print(ast: SourceFile): string {
  const text = ast.getFullText();
  return hadBom.get(ast) === true ? BOM + text : text;
}
