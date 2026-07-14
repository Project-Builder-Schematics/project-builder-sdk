/**
 * FIT-29 (NEW, ADR-A): sanctioned-`defineFactory`-caller guard. `defineFactory` graduates
 * to core-internal vocabulary — this guard confines PRODUCTION imports of the
 * `defineFactory` BINDING (resolving into `src/core/context.ts` or its barrel
 * `src/core/index.ts`) to `src/core/**`, `src/testing/**`, `src/conformance/**`. Scan
 * surface: `src/**` + `bin/**` — `test/**` is categorically OUTSIDE this scan's domain (the
 * ~85 deep-import sentinel files and the wrap-parity harness import `defineFactory`
 * directly by design, with no annotation convention required).
 *
 * Mirrors FIT-15/FIT-21's resolved-path idiom (`specifiersResolvingInto`), narrowed to
 * import/export lines that actually BIND the name `defineFactory` — a file importing OTHER
 * names from context.ts (e.g. `currentContext`, `requirePackageAnchors`, both legitimately
 * imported outside the allowlist by src/commons/ and src/scaffold/) is not a violation; a
 * plain specifier-resolution scan over the whole file would false-positive on those.
 *
 * Red-proof: a planted `defineFactory` import from `src/commons/**` (inline fixture string,
 * per FIT-15's established no-fixture-file pattern — never a new file under src/commons/).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { specifiersResolvingInto, collectTsFiles } from "../support/import-scan.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = join(PROJECT_ROOT, "src");
const BIN_DIR = join(PROJECT_ROOT, "bin");
const CONTEXT_FILE = join(SRC_DIR, "core/context.ts");
const CORE_INDEX_FILE = join(SRC_DIR, "core/index.ts");

const ALLOWLISTED_ROOTS = [join(SRC_DIR, "core"), join(SRC_DIR, "testing"), join(SRC_DIR, "conformance")];

function isAllowlisted(absPath: string): boolean {
  return ALLOWLISTED_ROOTS.some((root) => absPath === root || absPath.startsWith(`${root}/`));
}

// Narrows `source` down to only the import/export lines that BIND the name `defineFactory`
// (matched on the ORIGINAL exported name, so `defineFactory as foo` still counts — it is
// still importing the defineFactory binding, just under a local alias).
const NAMED_IMPORT_RE = /^(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;

function definesFactoryImportLines(source: string): string {
  const lines: string[] = [];
  for (const match of source.matchAll(NAMED_IMPORT_RE)) {
    const names = match[1]!
      .split(",")
      .map((n) => n.trim().split(/\s+as\s+/)[0]!.trim())
      .filter(Boolean);
    if (names.includes("defineFactory")) {
      lines.push(match[0]);
    }
  }
  return lines.join("\n");
}

function unsanctionedDefineFactoryImports(file: string): string[] {
  const source = readFileSync(file, "utf-8");
  const fromDir = dirname(file);
  const narrowed = definesFactoryImportLines(source);
  if (narrowed === "") return [];
  return [
    ...specifiersResolvingInto(narrowed, fromDir, CONTEXT_FILE),
    ...specifiersResolvingInto(narrowed, fromDir, CORE_INDEX_FILE),
  ];
}

describe("FIT-29 — defineFactory importable only from sanctioned production callers", () => {
  const scanFiles = [...collectTsFiles(SRC_DIR), ...collectTsFiles(BIN_DIR)];
  const unsanctionedFiles = scanFiles.filter((f) => !isAllowlisted(f));

  it("the walk reaches real files, including allowlisted and non-allowlisted roots (sanity)", () => {
    expect(scanFiles).toContain(join(SRC_DIR, "testing/index.ts"));
    expect(scanFiles).toContain(join(SRC_DIR, "commons/index.ts"));
    expect(unsanctionedFiles).not.toContain(join(SRC_DIR, "testing/index.ts"));
  });

  for (const file of unsanctionedFiles) {
    it(`${file.replace(PROJECT_ROOT, "")} does not import defineFactory from an unsanctioned caller`, () => {
      expect(unsanctionedDefineFactoryImports(file)).toEqual([]);
    });
  }

  // Positive control: the scanner DOES detect the real production defineFactory import
  // shape (src/testing/index.ts's own internal `import { defineFactory } from
  // "../core/context.ts"`, used to delegate — bare-factory-migration S-006 removed the
  // public `export { defineFactory } from "../core/context.ts"` re-export this file used to
  // ALSO carry, so only the one internal import line resolves here now) — proving
  // allowlisting, not scanner blindness, is what keeps sanctioned callers green.
  it("positive control: the scanner detects src/testing/index.ts's own internal defineFactory import (allowlisting, not blindness, keeps it green)", () => {
    const offenders = unsanctionedDefineFactoryImports(join(SRC_DIR, "testing/index.ts"));
    expect(offenders).toEqual(["../core/context.ts"]);
  });

  it("positive control: the scanner detects src/conformance/index.ts's own defineFactory import too", () => {
    const offenders = unsanctionedDefineFactoryImports(join(SRC_DIR, "conformance/index.ts"));
    expect(offenders).toEqual(["../core/context.ts"]);
  });

  // RED-PROOF: a planted defineFactory import from src/commons/** is flagged.
  it("[red-proof] a planted defineFactory import from src/commons/** is flagged", () => {
    const fakeSource = `import { defineFactory } from "../core/context.ts";`;
    const fakeDir = join(SRC_DIR, "commons");
    expect(specifiersResolvingInto(definesFactoryImportLines(fakeSource), fakeDir, CONTEXT_FILE)).toEqual([
      "../core/context.ts",
    ]);
  });

  // RED-PROOF: a planted defineFactory import resolving through the core BARREL
  // (src/core/index.ts) from an unsanctioned caller is also flagged, not just the direct
  // context.ts route.
  it("[red-proof] a planted defineFactory import via the core barrel (src/core/index.ts) is flagged", () => {
    const fakeSource = `import { defineFactory } from "../core/index.ts";`;
    const fakeDir = join(SRC_DIR, "commons");
    expect(specifiersResolvingInto(definesFactoryImportLines(fakeSource), fakeDir, CORE_INDEX_FILE)).toEqual([
      "../core/index.ts",
    ]);
  });

  // RED-PROOF (no false positive): an import of a DIFFERENT name from context.ts (e.g.
  // `currentContext`, `requirePackageAnchors` — real, legitimate imports outside the
  // allowlist, used by src/commons/index.ts and src/scaffold/{index,expander}.ts) is NOT
  // flagged — this is exactly what a plain specifiersResolvingInto scan (without the
  // defineFactory-name narrowing) would false-positive on.
  it("[red-proof] an import of a different name from context.ts is NOT flagged", () => {
    const fakeSource = `import { currentContext, requirePackageAnchors } from "../core/context.ts";`;
    expect(definesFactoryImportLines(fakeSource)).toEqual("");
  });

  // RED-PROOF: a bare package specifier (never relative) is never flagged, even if it
  // textually contains "defineFactory".
  it("[red-proof] a bare specifier is NOT flagged (no false positive)", () => {
    const fakeSource = `import { defineFactory } from "some-package/define-factory.js";`;
    expect(specifiersResolvingInto(definesFactoryImportLines(fakeSource), SRC_DIR, CONTEXT_FILE)).toEqual([]);
  });
});
