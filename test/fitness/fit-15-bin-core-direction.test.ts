/**
 * FIT-15: bin -> core dependency direction only (REQ-FPS-03). The codegen bin MAY import
 * shared schema logic from `src/core`, but no module under `src/`'s runtime path may import
 * the bin or any codegen-only code — mirrors FIT-07's src-scan idiom.
 *
 * Resolves every relative import specifier under `src/**` against the importing file's own
 * directory and flags any that resolve INTO the repo-root `bin/` directory — a textual
 * substring check (`"bin/"`) would false-positive on legitimate identifiers/paths
 * containing that substring, so this resolves paths for real.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = join(PROJECT_ROOT, "src");
const BIN_DIR = join(PROJECT_ROOT, "bin");

function getSourceFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(relPath);
    }
  }
  return files;
}

const IMPORT_SPECIFIER_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

function relativeSpecifiersResolvingInto(source: string, fromDir: string, targetDir: string): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".")) continue; // bare/package specifiers can never reach bin/
    const resolved = resolve(fromDir, specifier);
    if (resolved === targetDir || resolved.startsWith(`${targetDir}/`)) {
      offenders.push(specifier);
    }
  }
  return offenders;
}

function importsFromBin(relPath: string): string[] {
  const source = readFileSync(join(SRC_DIR, relPath), "utf-8");
  const importDir = dirname(join(SRC_DIR, relPath));
  return relativeSpecifiersResolvingInto(source, importDir, BIN_DIR);
}

describe("FIT-15 — bin -> core direction only (no src/ runtime module imports bin/)", () => {
  const files = getSourceFiles(SRC_DIR);

  it("the recursive walk reaches real files (sanity)", () => {
    expect(files).toContain("core/context.ts");
    expect(files).toContain("core/schema/schema-model.ts");
  });

  for (const relPath of files) {
    it(`src/${relPath} does not import anything from bin/`, () => {
      expect(importsFromBin(relPath)).toEqual([]);
    });
  }

  // RED-PROOF: a synthetic relative import resolving into bin/ is flagged.
  it("[red-proof] a relative import resolving into bin/ is detected", () => {
    const fakeSource = `import { generateSchema } from "../../bin/pbuilder-codegen.ts";`;
    const fakeDir = join(SRC_DIR, "core");
    expect(relativeSpecifiersResolvingInto(fakeSource, fakeDir, BIN_DIR)).toEqual([
      "../../bin/pbuilder-codegen.ts",
    ]);
  });

  // RED-PROOF: a bare package specifier (never relative) is never flagged, even if it
  // textually contains "bin/".
  it("[red-proof] a bare specifier containing the substring 'bin/' is NOT flagged (no false positive)", () => {
    const fakeSource = `import { x } from "some-package/bin/thing.js";`;
    const fakeDir = join(SRC_DIR, "core");
    expect(relativeSpecifiersResolvingInto(fakeSource, fakeDir, BIN_DIR)).toEqual([]);
  });

  // RED-PROOF: a relative import that stays within src/ is NOT flagged.
  it("[red-proof] a relative import staying within src/ is NOT flagged", () => {
    const fakeSource = `import { Schema } from "./schema/schema-model.ts";`;
    const fakeDir = join(SRC_DIR, "core");
    expect(relativeSpecifiersResolvingInto(fakeSource, fakeDir, BIN_DIR)).toEqual([]);
  });
});
