/**
 * FIT-22 (design §Fitness Functions, `schematic-local-files`, final-verify remediation):
 * `src/scaffold/` leaf-rule — design-promised at S-002 ("imports core only via
 * `currentContext()`, no reverse dep") but never shipped as a fitness function; this
 * closes that gap. Mirrors FIT-15's resolved-path idiom (never a textual substring check)
 * and FIT-02/FIT-21's leaf-rule shape, two directions:
 *
 *  1. No reverse dependency: no file under `src/core/**` or `src/dry-run/**` may import
 *     `src/scaffold/` — the dependency edge is one-way, scaffold -> core, never back.
 *  2. Allow-list: every file under `src/scaffold/**` may import only (a) another file
 *     within `src/scaffold/**` itself (intra-leaf, e.g. `expander.ts` -> `./walk.ts`),
 *     (b) a file under `src/core/**`, or (c) a `node:` builtin — never `../commons`,
 *     `../dry-run`, `../dialects`, `../testing`, `../conformance`, or a bare external
 *     package.
 *
 * Red-proof: fixtures simulating a reverse import and an out-of-allow-list scaffold
 * import are both caught by the scanner.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { specifiersResolvingInto } from "../support/import-scan.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = join(PROJECT_ROOT, "src");
const SCAFFOLD_DIR = join(SRC_DIR, "scaffold");
const CORE_DIR = join(SRC_DIR, "core");

function collectTs(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTs(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

/** Every import specifier (relative or bare) in `source`, in source order. */
function allImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g)) {
    specifiers.push(match[1]!);
  }
  return specifiers;
}

/**
 * Returns every import specifier in a `src/scaffold/**` file that violates the allow-list:
 * neither a `node:` builtin, nor a relative import resolving within `src/scaffold/**`
 * itself, nor a relative import resolving into `src/core/**`.
 */
function outOfAllowListImports(source: string, fromDir: string): string[] {
  const offenders: string[] = [];
  for (const specifier of allImportSpecifiers(source)) {
    if (specifier.startsWith("node:")) continue;
    if (!specifier.startsWith(".")) {
      offenders.push(specifier); // bare package specifier — never allowed here
      continue;
    }
    const resolved = resolve(fromDir, specifier);
    const withinScaffold = resolved === SCAFFOLD_DIR || resolved.startsWith(`${SCAFFOLD_DIR}/`);
    const withinCore = resolved === CORE_DIR || resolved.startsWith(`${CORE_DIR}/`);
    if (!withinScaffold && !withinCore) {
      offenders.push(specifier);
    }
  }
  return offenders;
}

describe("FIT-22 — src/scaffold/ leaf-rule (no reverse dep; scaffold imports only core + node:)", () => {
  describe("direction 1 — no file under src/core/** or src/dry-run/** imports src/scaffold/", () => {
    const coreFiles = collectTs(CORE_DIR);
    const dryRunDir = join(SRC_DIR, "dry-run");
    const dryRunFiles = collectTs(dryRunDir);

    it("the recursive walk reaches real files (sanity)", () => {
      expect(coreFiles.length).toBeGreaterThan(0);
      expect(dryRunFiles.length).toBeGreaterThan(0);
    });

    for (const filePath of [...coreFiles, ...dryRunFiles]) {
      it(`${filePath.replace(SRC_DIR, "src")} does not import src/scaffold/`, () => {
        const source = readFileSync(filePath, "utf-8");
        const offenders = specifiersResolvingInto(source, dirname(filePath), SCAFFOLD_DIR);
        expect(offenders).toEqual([]);
      });
    }

    it("[red-proof] a simulated src/core/context.ts-shaped module importing scaffold is detected", () => {
      const fakeSource = `import { runScaffold } from "../scaffold/index.ts";`;
      const offenders = specifiersResolvingInto(fakeSource, CORE_DIR, SCAFFOLD_DIR);
      expect(offenders).toEqual(["../scaffold/index.ts"]);
    });

    it("[red-proof] an unrelated core-internal import is NOT flagged", () => {
      const fakeSource = `import { Session } from "./session.ts";`;
      const offenders = specifiersResolvingInto(fakeSource, CORE_DIR, SCAFFOLD_DIR);
      expect(offenders).toEqual([]);
    });
  });

  describe("direction 2 — src/scaffold/** imports only src/scaffold/** (intra-leaf), src/core/**, or node: builtins", () => {
    const scaffoldFiles = collectTs(SCAFFOLD_DIR);

    it("the recursive walk reaches real files (sanity)", () => {
      expect(scaffoldFiles.length).toBeGreaterThan(0);
    });

    for (const filePath of scaffoldFiles) {
      it(`${filePath.replace(SRC_DIR, "src")} imports only node:/src/scaffold/**/src/core/**`, () => {
        const source = readFileSync(filePath, "utf-8");
        const offenders = outOfAllowListImports(source, dirname(filePath));
        expect(offenders).toEqual([]);
      });
    }

    it("[red-proof] a simulated scaffold file importing ../commons is detected", () => {
      const fakeSource = `import { create } from "../commons/index.ts";`;
      const offenders = outOfAllowListImports(fakeSource, SCAFFOLD_DIR);
      expect(offenders).toEqual(["../commons/index.ts"]);
    });

    it("[red-proof] a simulated scaffold file importing a bare external package is detected", () => {
      const fakeSource = `import { z } from "zod";`;
      const offenders = outOfAllowListImports(fakeSource, SCAFFOLD_DIR);
      expect(offenders).toEqual(["zod"]);
    });

    it("[red-proof] an intra-scaffold import and a core import are both allowed (no false positive)", () => {
      const fakeSource = `
import { currentContext } from "../core/context.ts";
import { walkFolder } from "./walk.ts";
import { readFileSync } from "node:fs";
`;
      const offenders = outOfAllowListImports(fakeSource, SCAFFOLD_DIR);
      expect(offenders).toEqual([]);
    });
  });
});
