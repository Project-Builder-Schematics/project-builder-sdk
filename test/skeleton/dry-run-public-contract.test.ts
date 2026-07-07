/**
 * REQ-DRE-02.1/.2, REQ-DRE-03.1, REQ-DRE-04.1–.3+(d) — public-contract gate for `dryRun`.
 *
 * `.d.ts` scan against the committed dts-baseline (`test/fitness/dts-baseline/commons.index.d.ts`):
 *   - REQ-DRE-03.1 (export presence) — [must-fail-first]: genuinely RED against the
 *     pre-regen baseline (no `dryRun` export exists yet); GREEN once the export lands
 *     and the baseline regens in this same slice (design §4.8 constraint 2).
 *   - REQ-DRE-02.1/.2 (no wire-type leak; zero-arg `DryRunEntry[]` signature) —
 *     [characterization]: their target shape doesn't exist to assert against until the
 *     same regen.
 *
 * JSDoc scan of `src/commons/index.ts` (REQ-DRE-04.1–.3 + outside-run doc pin (d)) —
 * [characterization]: the token set IS the contract (design §4.4).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_FILE = join(PROJECT_ROOT, "test/fitness/dts-baseline/commons.index.d.ts");
const COMMONS_SOURCE_FILE = join(PROJECT_ROOT, "src/commons/index.ts");

// Extracts the JSDoc comment block immediately preceding `export function dryRun(`.
function extractDryRunJsDoc(source: string): string {
  const lines = source.split("\n");
  const fnLineIndex = lines.findIndex((l) => /^export function dryRun\(/.test(l.trim()));
  if (fnLineIndex === -1) return "";

  let start = fnLineIndex;
  for (let i = fnLineIndex - 1; i >= 0; i--) {
    start = i;
    if (lines[i]!.trim().startsWith("/**")) break;
  }
  return lines.slice(start, fnLineIndex).join("\n");
}

describe("dry-run public contract — .d.ts baseline scan", () => {
  it("REQ-DRE-03.1 — dryRun is a named export of the commons .d.ts baseline", () => {
    const dts = readFileSync(BASELINE_FILE, "utf-8");
    expect(dts).toMatch(/export declare function dryRun\(/);
  });

  it("REQ-DRE-02.1 — no reference to Directive or pendingSnapshot in the commons .d.ts baseline", () => {
    const dts = readFileSync(BASELINE_FILE, "utf-8");
    expect(dts).not.toMatch(/\bDirective\b/);
    expect(dts).not.toMatch(/\bpendingSnapshot\b/);
  });

  it("REQ-DRE-02.2 — dryRun's emitted signature is zero-parameter returning DryRunEntry[] only", () => {
    const dts = readFileSync(BASELINE_FILE, "utf-8");
    expect(dts).toMatch(/export declare function dryRun\(\):\s*DryRunEntry\[\];/);
  });
});

describe("dry-run public contract — JSDoc discoverability scan (REQ-DRE-04)", () => {
  it("REQ-DRE-04.1 — @example block shows in-run usage reading verb and path", () => {
    const source = readFileSync(COMMONS_SOURCE_FILE, "utf-8");
    const jsdoc = extractDryRunJsDoc(source);
    const exampleMatch = jsdoc.match(/@example([\s\S]*?)(?:@throws|\*\/)/);
    expect(exampleMatch).not.toBeNull();
    const exampleBlock = exampleMatch?.[1] ?? "";
    expect(exampleBlock).toContain("dryRun()");
    expect(exampleBlock).toContain("defineFactory");
    expect(exampleBlock).toContain("entry.verb");
    expect(exampleBlock).toContain("entry.path");
  });

  it("REQ-DRE-04.2 — prose states the temporal contract (pending AND read())", () => {
    const source = readFileSync(COMMONS_SOURCE_FILE, "utf-8");
    const jsdoc = extractDryRunJsDoc(source);
    expect(jsdoc).toContain("pending");
    expect(jsdoc).toContain("read()");
  });

  it("REQ-DRE-04.3 — prose states the shape guarantee (verb AND path AND the negation)", () => {
    const source = readFileSync(COMMONS_SOURCE_FILE, "utf-8");
    const jsdoc = extractDryRunJsDoc(source);
    expect(jsdoc).toContain("verb");
    expect(jsdoc).toContain("path");
    expect(jsdoc).toContain("no content or byte preview");
  });

  it("REQ-DRE-04(d) — @throws tag present with the outside-run substring", () => {
    const source = readFileSync(COMMONS_SOURCE_FILE, "utf-8");
    const jsdoc = extractDryRunJsDoc(source);
    expect(jsdoc).toContain("@throws");
    expect(jsdoc).toContain("can only be used while a schematic is running");
  });
});
