/**
 * FIT-NEW-C (`fitness-guards` REQ-FTG-08, ADR-0077 §G): the ruling-5 lexical rejection idiom
 * must exist as exactly ONE implementation, called at exactly THREE sites. Both clauses are
 * shape-keyed clone detectors (design §8's own disclosed limit) — they raise the cost of an
 * accidental second predicate or a fourth/missing call site; they do not make either
 * impossible. Negatives run against a fixture tree, never a live mutation of `src/**`.
 */
import { describe, it, expect } from "bun:test";
import { collectFiles } from "../support/import-scan.ts";
import { readScanFiles, findLexicalEscapePredicates, findCallSites } from "../support/src-invariant-scans.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = `${PROJECT_ROOT}src`;
const RED_ROOT = `${PROJECT_ROOT}test/fixtures/red/src-invariant-scans`;
const PATH_GUARDS_PATH = `${SRC_DIR}/scaffold/path-guards.ts`;

function realSrcFiles() {
  return readScanFiles(collectFiles(SRC_DIR, ".ts"));
}

describe("FIT-NEW-C (fit-45) — exactly one lexical predicate implementation", () => {
  describe("clause (a) — exactly one (file, function) pair implements the idiom", () => {
    it("the real src/** tree has exactly one implementation: path-guards.ts#isLexicallyEscaping", () => {
      const hits = findLexicalEscapePredicates(realSrcFiles());
      expect(hits).toEqual([{ file: PATH_GUARDS_PATH, function: "isLexicallyEscaping" }]);
    });

    it("[red-proof] REQ-FTG-08.1 — a fixture with the real predicate PLUS a second parallel implementation is flagged, naming BOTH", () => {
      const path = `${RED_ROOT}/second-lexical-predicate.ts`;
      const hits = findLexicalEscapePredicates(readScanFiles([path]));
      expect(hits).toEqual([
        { file: path, function: "isLexicallyEscaping" },
        { file: path, function: "isLexicallyEscapingForDestination" },
      ]);
    });
  });

  describe("clause (b) — exactly three call sites of validateSourceLexical", () => {
    it("the real src/** tree calls validateSourceLexical from exactly the three named sites", () => {
      const sites = findCallSites(realSrcFiles(), "validateSourceLexical");
      const normalized = sites
        .map((s) => ({ file: s.file.replace(SRC_DIR, "src"), function: s.function }))
        .sort((a, b) => a.file.localeCompare(b.file) || (a.function ?? "").localeCompare(b.function ?? ""));

      expect(normalized).toEqual([
        { file: "src/scaffold/expander.ts", function: "runScaffold" },
        { file: "src/scaffold/index.ts", function: "readTemplateFile" },
        { file: "src/scaffold/index.ts", function: "runCopyIn" },
      ]);
      expect(sites.length).toBe(3);
    });

    it("[red-proof] a fourth call site fails the exact-three assertion", () => {
      // Direct proof of the mechanism, not the real tree: a synthetic fixture with FOUR
      // call sites to a same-shaped helper.
      const syntheticSites = findCallSites(
        [
          {
            path: "synthetic.ts",
            content: [
              "function guardA(p: string): void {",
              "  validateSourceLexical(p);",
              "}",
              "function guardB(p: string): void {",
              "  validateSourceLexical(p);",
              "}",
              "function guardC(p: string): void {",
              "  validateSourceLexical(p);",
              "}",
              "function guardD(p: string): void {",
              "  validateSourceLexical(p);",
              "}",
            ].join("\n"),
          },
        ],
        "validateSourceLexical"
      );
      expect(syntheticSites.length).toBe(4);
      expect(syntheticSites.length).not.toBe(3);
    });
  });
});
