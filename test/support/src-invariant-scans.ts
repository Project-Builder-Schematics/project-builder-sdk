// Pure scanners shared by fit-43/fit-44/fit-45 (ADR-0077, `fitness-guards` REQ-FTG-06/07/08).
// Every function here takes an INJECTABLE file list (`ScanFile[]`) — negatives run against
// fixture trees under `test/fixtures/red/src-invariant-scans/**`, never a live mutation of
// `src/**`. The one exception is `realSrcFileSnapshot` below, which owns reading the real
// `src/**` tree ONCE (memoized) — the pure scanners themselves never walk it directly.
//
// Shape-keyed clone detectors throughout (mirrors design §8's own disclosed limit for
// FIT-NEW-C): these raise the cost of an accidental regrowth, they do not make it
// structurally impossible. A second implementation written in an unrecognized shape would
// evade detection — stated here rather than implied.

import { readFileSync } from "node:fs";
import { collectFiles, extractCallArgs, findMatchingClose, WRITE_CALL_RE } from "./import-scan.ts";

export interface ScanFile {
  path: string;
  content: string;
}

/** Reads every path into a `ScanFile[]` — the one I/O step callers own before scanning. */
export function readScanFiles(paths: readonly string[]): ScanFile[] {
  return paths.map((path) => ({ path, content: readFileSync(path, "utf-8") }));
}

const SRC_DIR = new URL("../../src", import.meta.url).pathname;

let cachedSrcSnapshot: ScanFile[] | undefined;

/**
 * Lazily-memoized snapshot of the real `src/**` tree, computed once per process on first
 * call — never eagerly at module load, so importing this module stays side-effect-free.
 * Shared by fit-43/44/45's 7 call sites, each of which previously defined its own
 * `realSrcFiles()` re-walking and re-reading the whole tree on every invocation.
 */
export function realSrcFileSnapshot(): ScanFile[] {
  if (cachedSrcSnapshot === undefined) {
    cachedSrcSnapshot = readScanFiles(collectFiles(SRC_DIR, ".ts"));
  }
  return cachedSrcSnapshot;
}

export interface ExtractedFunction {
  name: string;
  /** Offset of the function's own NAME token (used to exclude a declaration site from a
   * call-site scan over the SAME identifier). */
  nameOffset: number;
  /** Offset of the declaration's leading keyword (`export`/`async`/`function`). */
  start: number;
  /** Offset one past the body's closing `}`. */
  end: number;
  body: string;
}

const FUNCTION_DECL_RE = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;

/**
 * Extracts every named `function` declaration in `source` — a Prettier-formatted-TS
 * heuristic: the body's opening brace is identified as the first `{` (after the
 * declaration header) that is immediately followed by a newline, which distinguishes it
 * from an inline object-TYPE brace in the parameter list or return-type annotation (e.g.
 * `function f(p: { a: string }): { b: string } {` — both inner braces stay on one line;
 * only the real body-opening brace sits alone at end-of-line). Arrow-function consts are
 * NOT extracted — every target symbol this scan family cares about
 * (`isLexicallyEscaping`, `validateSourceLexical`, `readTemplateFile`, `runScaffold`,
 * `runCopyIn`, `packageRootFor`, …) is a `function` declaration in this codebase.
 */
export function extractFunctions(source: string): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];
  for (const match of source.matchAll(FUNCTION_DECL_RE)) {
    const name = match[1]!;
    const start = match.index!;
    const nameOffset = start + match[0].lastIndexOf(name);
    const openBraceOffset = source.slice(start).search(/\{[ \t]*\r?\n/);
    if (openBraceOffset === -1) continue;
    const bodyOpen = start + openBraceOffset;
    const bodyEnd = findMatchingClose(source, bodyOpen, "{", "}");
    if (bodyEnd === -1) continue;
    functions.push({ name, nameOffset, start, end: bodyEnd + 1, body: source.slice(bodyOpen, bodyEnd + 1) });
  }
  return functions;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-06 clause (a): the literal string appears in ZERO files.
// ---------------------------------------------------------------------------------------

/** Files whose raw content (code OR comment — a literal-substring check, not a
 * string-literal-syntax check) contains `literal`. */
export function findLiteralOccurrences(files: readonly ScanFile[], literal: string): string[] {
  return files.filter((f) => f.content.includes(literal)).map((f) => f.path);
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-06 clause (b): no ancestor-walk idiom (a loop calling `dirname` upward searching
// for a marker file), symbol-scoped allowlist (`file#function`).
// ---------------------------------------------------------------------------------------

const LOOP_HEADER_RE = /\b(?:for|while)\s*\(/g;

/** Every block-bodied loop's own body text within `fnBody` (paren-then-brace depth
 * matching, via the shared `findMatchingClose` idiom). */
function loopBodies(fnBody: string): string[] {
  const bodies: string[] = [];
  for (const match of fnBody.matchAll(LOOP_HEADER_RE)) {
    const headerOpen = match.index! + match[0].length - 1; // positioned at the loop header's '('
    const parenClose = findMatchingClose(fnBody, headerOpen, "(", ")");
    if (parenClose === -1) continue;
    let j = parenClose + 1;
    while (j < fnBody.length && /\s/.test(fnBody[j]!)) j++;
    if (fnBody[j] !== "{") continue; // non-block loop body — not this idiom's shape
    const bodyEnd = findMatchingClose(fnBody, j, "{", "}");
    if (bodyEnd === -1) continue;
    bodies.push(fnBody.slice(j, bodyEnd + 1));
  }
  return bodies;
}

export interface AncestorWalkOffense {
  file: string;
  symbol: string;
}

/**
 * Flags every function whose body contains a loop with a `dirname(` call inside it — the
 * ancestor-walk-upward-for-a-marker shape (REQ-FTG-06.b). `allowlist` entries are
 * `"path#functionName"` — SYMBOL-scoped (REQ-FTG-06.2): a second, non-allowlisted function
 * in the SAME file is still flagged.
 */
export function findAncestorWalkIdiom(
  files: readonly ScanFile[],
  allowlist: ReadonlySet<string>
): AncestorWalkOffense[] {
  const offenses: AncestorWalkOffense[] = [];
  for (const file of files) {
    for (const fn of extractFunctions(file.content)) {
      if (allowlist.has(`${file.path}#${fn.name}`)) continue;
      if (loopBodies(fn.body).some((body) => /\bdirname\(/.test(body))) {
        offenses.push({ file: file.path, symbol: fn.name });
      }
    }
  }
  return offenses;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-06 clause (f): zero `realpathSync`/`realpath` references (code or comment),
// symbol-scoped allowlist.
// ---------------------------------------------------------------------------------------

export interface RealpathReference {
  file: string;
  line: number;
}

function allowedOffsetRanges(file: ScanFile, allowlist: ReadonlySet<string>): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const fn of extractFunctions(file.content)) {
    if (allowlist.has(`${file.path}#${fn.name}`)) ranges.push([fn.start, fn.end]);
  }
  return ranges;
}

function withinRanges(offset: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

/**
 * `"realpath"` is a literal substring of `"realpathSync"` too, so a single substring scan
 * catches both banned literals REQ-FTG-06(f) names. Line-level, symbol-scoped allowlist —
 * an occurrence OUTSIDE an allowlisted function's own body range still counts, even in an
 * otherwise-allowlisted file.
 */
export function findRealpathReferences(files: readonly ScanFile[], allowlist: ReadonlySet<string>): RealpathReference[] {
  const offenses: RealpathReference[] = [];
  for (const file of files) {
    const ranges = allowedOffsetRanges(file, allowlist);
    const lines = file.content.split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes("realpath") && !withinRanges(offset, ranges)) {
        offenses.push({ file: file.path, line: i + 1 });
      }
      offset += line.length + 1;
    }
  }
  return offenses;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-06 clause (e) / REQ-FTG-06.4: the `openspec/specs/` sweep LOGIC — a fixture-pair
// scenario in-change; the REAL tree run is archive-sync only (never invoked by this file).
// ---------------------------------------------------------------------------------------

const RETIRED_TERMS = ["package-root-containment", "REQ-PRC-", "source-outside-package"];
const VERSION_HISTORY_MARKER_RE = /\(Previously:|V\d+\s*→\s*V\d+/;

export interface OrphanedCitation {
  file: string;
  line: number;
  term: string;
}

/**
 * A retired-vocabulary hit is credited to the version-history allowlist ONLY when the SAME
 * line carries a `(Previously: ...)` or `V{n} → V{n+1}` marker — never file-wide credit.
 */
export function findOrphanedRetiredCitations(files: readonly ScanFile[]): OrphanedCitation[] {
  const hits: OrphanedCitation[] = [];
  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (VERSION_HISTORY_MARKER_RE.test(line)) continue;
      for (const term of RETIRED_TERMS) {
        if (line.includes(term)) hits.push({ file: file.path, line: i + 1, term });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-06 clause (d): `test/**` marker-fabrication allowlist (a write call whose path
// argument ends in `collection.json`) — symbol-scoped (`file#function` or `file` for a
// module-level call), initially EMPTY.
// ---------------------------------------------------------------------------------------

const COLLECTION_JSON_LITERAL_RE = /["'`][^"'`]*collection\.json["'`]/;

export interface MarkerFabricationOffense {
  file: string;
  function: string | undefined;
}

/**
 * Flags a write call whose argument list targets a path ending in `collection.json` — the
 * marker-fabrication shape (mirrors `fit-27`'s `writesToCorpusDir` call-site-scoped idiom).
 * `allowlist` is `"file#function"` (or bare `"file"` for a module-level call) — INITIALLY
 * EMPTY is the expected state once all fabrication is removed (S-003.3).
 */
export function findMarkerFabricationWrites(
  files: readonly ScanFile[],
  allowlist: ReadonlySet<string>
): MarkerFabricationOffense[] {
  const offenses: MarkerFabricationOffense[] = [];
  for (const file of files) {
    const functions = extractFunctions(file.content);
    for (const match of file.content.matchAll(WRITE_CALL_RE)) {
      const args = extractCallArgs(file.content, match.index!);
      if (!COLLECTION_JSON_LITERAL_RE.test(args)) continue;
      const enclosing = functions.find((fn) => match.index! >= fn.start && match.index! < fn.end);
      const key = enclosing ? `${file.path}#${enclosing.name}` : file.path;
      if (allowlist.has(key)) continue;
      offenses.push({ file: file.path, function: enclosing?.name });
    }
  }
  return offenses;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-07: reachability over BOTH minting mechanisms (`CODE_TO_REASON` + direct
// construction sites) — excludes the `AuthoringReason` union declaration (`| "value"`
// syntax) and `originFor`'s switch (`case "value":` syntax) BY CONSTRUCTION, since neither
// pattern below matches those two syntactic shapes.
// ---------------------------------------------------------------------------------------

const CODE_TO_REASON_RE = /CODE_TO_REASON\s*:\s*Record<[^=]*>\s*=\s*\{([\s\S]*?)\};/;

/** REQ-FTG-07.2's own concrete assertion target: `CODE_TO_REASON`'s value set. */
export function parseCodeToReasonValues(files: readonly ScanFile[]): string[] {
  for (const file of files) {
    const match = CODE_TO_REASON_RE.exec(file.content);
    if (match) return [...match[1]!.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]!);
  }
  return [];
}

const DEFAULT_MINT_HELPER_NAMES = ["sourceRejection", "rejection"] as const;

/**
 * Every `AuthoringReason` value reachable through the union of: `CODE_TO_REASON`'s value
 * set, a literal `reason: "value"` property, or a literal string first-argument to a
 * reason-minting helper (`sourceRejection(...)`, `rejection(...)`).
 */
export function scanMintedReasons(
  files: readonly ScanFile[],
  mintHelperNames: readonly string[] = DEFAULT_MINT_HELPER_NAMES
): Set<string> {
  const reasons = new Set<string>();
  for (const value of parseCodeToReasonValues(files)) reasons.add(value);
  for (const file of files) {
    for (const match of file.content.matchAll(/\breason:\s*"([a-zA-Z-]+)"/g)) {
      reasons.add(match[1]!);
    }
    for (const helperName of mintHelperNames) {
      const helperRe = new RegExp(`\\b${helperName}\\(\\s*"([a-zA-Z-]+)"`, "g");
      for (const match of file.content.matchAll(helperRe)) {
        reasons.add(match[1]!);
      }
    }
  }
  return reasons;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-08 clause (a): exactly ONE lexical-escape predicate implementation.
// ---------------------------------------------------------------------------------------

export interface LexicalPredicateHit {
  file: string;
  function: string;
}

const HAS_SPLIT_RE = /\.split\(/;
const HAS_DOTDOT_MEMBERSHIP_RE = /\.includes\(\s*"\.\."\s*\)/;
const HAS_ABSOLUTE_STARTSWITH_RE = /startsWith\(\s*"\/"\s*\)/;
const HAS_DRIVE_LETTER_RE = /\[A-Za-z\]:/;

/**
 * A function body matches the `../`/absolute lexical-rejection idiom when it contains
 * BOTH a separator split with a `".."` segment-membership test AND an absolute-path test
 * (leading `/` or a drive-letter regex) — `ir-path-well-formedness` REQ-IPF-01's predicate
 * shape, `src/scaffold/path-guards.ts#isLexicallyEscaping`'s own real body.
 */
export function findLexicalEscapePredicates(files: readonly ScanFile[]): LexicalPredicateHit[] {
  const hits: LexicalPredicateHit[] = [];
  for (const file of files) {
    for (const fn of extractFunctions(file.content)) {
      const hasSegmentAwareDotDot = HAS_SPLIT_RE.test(fn.body) && HAS_DOTDOT_MEMBERSHIP_RE.test(fn.body);
      const hasAbsoluteTest = HAS_ABSOLUTE_STARTSWITH_RE.test(fn.body) || HAS_DRIVE_LETTER_RE.test(fn.body);
      if (hasSegmentAwareDotDot && hasAbsoluteTest) hits.push({ file: file.path, function: fn.name });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------------------
// REQ-FTG-08 clause (b): exactly three call sites of a named function.
// ---------------------------------------------------------------------------------------

export interface CallSite {
  file: string;
  function: string | undefined;
}

/** Every call to `calleeName(...)` in `files`, EXCLUDING the function's own declaration
 * site (identified by `extractFunctions`' `nameOffset`) — never a substring false-positive
 * against the `function calleeName(` header itself. */
export function findCallSites(files: readonly ScanFile[], calleeName: string): CallSite[] {
  const sites: CallSite[] = [];
  const callRe = new RegExp(`\\b${calleeName}\\(`, "g");
  for (const file of files) {
    const functions = extractFunctions(file.content);
    const declarationOffsets = new Set(functions.filter((fn) => fn.name === calleeName).map((fn) => fn.nameOffset));
    for (const match of file.content.matchAll(callRe)) {
      const offset = match.index!;
      if (declarationOffsets.has(offset)) continue;
      const enclosing = functions.find((fn) => offset >= fn.start && offset < fn.end);
      sites.push({ file: file.path, function: enclosing?.name });
    }
  }
  return sites;
}
