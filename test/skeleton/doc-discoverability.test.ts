/**
 * Doc-discoverability pins (authoring-error-contract REQ-AEC-03.2, REQ-AEC-04.3,
 * REQ-AEC-04.4; error-attribution-skeleton REQ-16.1) — all NON-DROPPABLE. The
 * `read-trichotomy-helper` domain's REQ-RT-03 doc-discoverability scenario lives instead
 * in `test/skeleton/classify-content.test.ts` (S-004, droppable) — droppability is
 * enforced by file placement, not by a flag in this file.
 *
 * Static text-scan over already-authored JSDoc (S-000) and the signed spec — same
 * convention as FIT-06/FIT-08/FIT-09/pyramid-codification: readFileSync + regex, no
 * markdown/TS-AST parser dependency. [characterization] — pins shape already intended by
 * S-000's authoring-error.ts / commons/index.ts JSDoc, not a bug fix (RED taxonomy (d)).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SRC_ROOT = join(PROJECT_ROOT, "src");

const AUTHORING_ERROR_SOURCE = readFileSync(join(SRC_ROOT, "core", "authoring-error.ts"), "utf-8");
const COMMONS_SOURCE = readFileSync(join(SRC_ROOT, "commons", "index.ts"), "utf-8");

/**
 * Returns the JSDoc block (`/** ... *\/`) immediately preceding the first line matching
 * `anchorPattern`, or "" if no JSDoc directly precedes it (a blank line breaks the chain).
 */
function jsDocBefore(source: string, anchorPattern: RegExp): string {
  const lines = source.split("\n");
  const anchorIdx = lines.findIndex((line) => anchorPattern.test(line));
  if (anchorIdx === -1) {
    throw new Error(`anchor not found: ${anchorPattern}`);
  }

  let end = -1;
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "") continue;
    if (trimmed.endsWith("*/")) end = i;
    break;
  }
  if (end === -1) return "";

  let start = end;
  for (; start >= 0; start--) {
    if (lines[start]!.trim().startsWith("/**")) break;
  }
  return lines.slice(start, end + 1).join("\n");
}

describe("REQ-AEC-03.2 — appliedCount JSDoc states diagnostic-not-persistence", () => {
  it("the emitted JSDoc scopes the count to the failing flush and states a rejected run discards everything", () => {
    const doc = jsDocBefore(AUTHORING_ERROR_SOURCE, /readonly appliedCount: number;/);
    expect(doc).toContain("diagnostic for locating progress");
    expect(doc).toContain("NOT a persistence promise");
    expect(doc).toContain("discards everything");
  });
});

describe("REQ-AEC-04.3 — AuthoringError @example shows the consumption pattern", () => {
  it("the class JSDoc's @example contains try/catch, instanceof AuthoringError, and a switch over reason", () => {
    const doc = jsDocBefore(AUTHORING_ERROR_SOURCE, /^export class AuthoringError extends Error \{$/);
    expect(doc).toContain("@example");
    expect(doc).toContain("try {");
    expect(doc).toContain("catch");
    expect(doc).toContain("instanceof AuthoringError");
    expect(doc).toMatch(/switch\s*\(\s*err\.reason\s*\)/);
  });
});

describe("REQ-AEC-04.4 — the five rejecting verbs cross-reference AuthoringError", () => {
  const verbAnchors: Record<string, RegExp> = {
    create: /^export function create<S>\($/,
    modify: /^export function modify\(/,
    rename: /^export function rename\(/,
    move: /^export function move\(/,
    copy: /^export function copy\(/,
  };

  for (const [verb, anchor] of Object.entries(verbAnchors)) {
    it(`${verb}()'s JSDoc names AuthoringError as the rejection surface`, () => {
      const doc = jsDocBefore(COMMONS_SOURCE, anchor);
      expect(doc).toContain("AuthoringError");
    });
  }

  it("remove() is the declared non-site and is NOT required to cross-reference AuthoringError (REQ-16)", () => {
    const doc = jsDocBefore(COMMONS_SOURCE, /^export function remove\(/);
    expect(doc).toContain("Idempotent");
  });
});

/**
 * REQ-16.1 is a documentation-review requirement ("declared non-sites"), not a runtime
 * behavior — its artifact of record is the signed spec, not production source. Resolves
 * across the change lifecycle: the active change folder today, its archived location
 * after `sdd-archive` moves the folder, or the synced main spec as a last resort.
 */
function resolveDeclaredNonSitesSpec(): string {
  const specRelative = join("specs", "error-attribution-skeleton", "spec.md");

  const activePath = join(PROJECT_ROOT, "openspec", "changes", "stage-2-error-attribution", specRelative);
  if (existsSync(activePath)) return readFileSync(activePath, "utf-8");

  const archiveRoot = join(PROJECT_ROOT, "openspec", "changes", "archive");
  if (existsSync(archiveRoot)) {
    const archivedChange = readdirSync(archiveRoot).find((entry) => entry.endsWith("-stage-2-error-attribution"));
    if (archivedChange) {
      const archivedPath = join(archiveRoot, archivedChange, specRelative);
      if (existsSync(archivedPath)) return readFileSync(archivedPath, "utf-8");
    }
  }

  const mainSpecPath = join(PROJECT_ROOT, "openspec", "specs", "error-attribution-skeleton", "spec.md");
  if (existsSync(mainSpecPath)) {
    const mainSpec = readFileSync(mainSpecPath, "utf-8");
    if (mainSpec.includes("REQ-16")) return mainSpec;
  }

  throw new Error(
    "REQ-16 non-sites declaration not found in the active change spec, its archived location, " +
      "or the synced main spec — the doc-discoverability pin has nothing to check."
  );
}

describe("REQ-16.1 — the five declared non-sites are named, not silently absent", () => {
  const specContent = resolveDeclaredNonSitesSpec();

  const nonSites: Array<{ label: string; reasonKeyword: string }> = [
    { label: "Commit-time rejection", reasonKeyword: "never rejects" },
    { label: "remove` (wire `delete`)", reasonKeyword: "Idempotent" },
    { label: "Read transport", reasonKeyword: "never rejects" },
    { label: "Template-render rejection", reasonKeyword: "Stage 6" },
    { label: "double-fault (E1/E2) machinery", reasonKeyword: "OUT OF SCOPE" },
  ];

  for (const { label, reasonKeyword } of nonSites) {
    it(`"${label}" is named with a reason (contains "${reasonKeyword}")`, () => {
      const idx = specContent.indexOf(label);
      expect(idx).toBeGreaterThanOrEqual(0);
      const window = specContent.slice(idx, idx + 400);
      expect(window).toContain(reasonKeyword);
    });
  }

  it("exactly five non-sites are declared (table row count)", () => {
    // Every non-site row lives in the "Non-site | Why" table — count data rows, not the
    // header/separator.
    const tableStart = specContent.indexOf("| Non-site | Why |");
    expect(tableStart).toBeGreaterThanOrEqual(0);
    const tableSection = specContent.slice(tableStart, specContent.indexOf("\n\n", tableStart));
    const dataRows = tableSection
      .split("\n")
      .slice(2) // header + separator
      .filter((line) => line.trim().startsWith("|"));
    expect(dataRows.length).toEqual(5);
  });
});
