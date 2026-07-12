/**
 * S-002 — REQ-MC-03/REQ-DG-04: dialect code never names any kit-internal port symbol
 * directly. A static scan over `src/dialects/typescript/**` (RECURSIVE — depth is not
 * assumed) for any of the banned symbols (`Session`, `DirectiveFactory`, `EngineClient`,
 * `EmitRejection`) referenced by import or use — dialect code has no legitimate reason to
 * name any of them, since every read/write routes through `core/dialect-handle.ts`'s own
 * delegation (kit-internal, outside this scanned tree).
 *
 * council fix pass (QA F1+F3): widened from an EngineClient-only, top-level-only scan.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIALECT_ROOT = new URL("../../../src/dialects/typescript/", import.meta.url).pathname;
const RED_FIXTURE = new URL(
  "../../fixtures/red/dialect-typescript/direct-engine-read.ts",
  import.meta.url
).pathname;
const NESTED_RED_FIXTURE_ROOT = new URL(
  "../../fixtures/red/dialect-typescript/nested/",
  import.meta.url
).pathname;

const BANNED_SYMBOLS = ["Session", "DirectiveFactory", "EngineClient", "EmitRejection"] as const;

// Recursive — depth is never assumed (mirrors FIT-01's `collectTs`). A top-level-only listing
// would miss a violation nested under a subdirectory of the scanned root.
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

// Strips `//` line comments and `/* */` block comments (incl. JSDoc) before scanning — a
// prose mention of a banned symbol in a doc comment (e.g. explaining what is NOT imported, or
// naming the delegation target — see src/dialects/typescript/index.ts's own `Session.read`
// JSDoc mention) must not itself trip the scan (mirrors FIT-01's comment-stripping fix, apply-
// progress batch 1).
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function findBannedSymbolReferences(source: string): string[] {
  const stripped = stripComments(source);
  const violations: string[] = [];
  for (const symbol of BANNED_SYMBOLS) {
    if (new RegExp(`\\b${symbol}\\b`).test(stripped)) {
      violations.push(`${symbol} referenced`);
    }
  }
  return violations;
}

describe("real dialect — REQ-MC-03/REQ-DG-04: no direct port-symbol reference in dialect code", () => {
  it("REQ-MC-03.1: src/dialects/typescript/** has zero banned port-symbol references outside core's own delegation", () => {
    const files = listSourceFiles(DIALECT_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf-8");
      return findBannedSymbolReferences(source).map((v) => `${file}: ${v}`);
    });
    expect(violations).toEqual([]);
  });

  // RED-PROOF (REQ-MC-03.2): a planted fixture calling EngineClient.read directly, quarantined
  // under test/fixtures/red/ — never part of the green suite — turns the scan RED.
  it("[red-proof] REQ-MC-03.2: a planted direct-EngineClient.read fixture fails the scan", () => {
    const source = readFileSync(RED_FIXTURE, "utf-8");
    const violations = findBannedSymbolReferences(source);
    expect(violations).toContain("EngineClient referenced");
  });

  // RED-PROOF (REQ-DG-04.1, per symbol): a dialect package has no legitimate reason to name
  // `Session` — string-source fixture fed directly to the scan function (FIT-01 pattern).
  it("[red-proof] a fixture importing Session fails the scan", () => {
    const fixtureSource = `
import { Session } from "../../core/session.ts";

export function bypass(session: Session, path: string) {
  return session.read(path);
}
`;
    const violations = findBannedSymbolReferences(fixtureSource);
    expect(violations).toContain("Session referenced");
  });

  // RED-PROOF (REQ-DG-04.1, per symbol): a dialect package has no legitimate reason to name
  // `DirectiveFactory`.
  it("[red-proof] a fixture importing DirectiveFactory fails the scan", () => {
    const fixtureSource = `
import { DirectiveFactory } from "../../core/directive-factory.ts";

export function makeDirectly(factory: DirectiveFactory) {
  return factory.modify({ path: "a.ts", content: "x" });
}
`;
    const violations = findBannedSymbolReferences(fixtureSource);
    expect(violations).toContain("DirectiveFactory referenced");
  });

  // RED-PROOF (REQ-DG-04.1, per symbol): a dialect package has no legitimate reason to name
  // `EmitRejection`.
  it("[red-proof] a fixture importing EmitRejection fails the scan", () => {
    const fixtureSource = `
import { EmitRejection } from "../../core/emit-rejection.ts";

export function inspect(err: unknown): err is EmitRejection {
  return err instanceof EmitRejection;
}
`;
    const violations = findBannedSymbolReferences(fixtureSource);
    expect(violations).toContain("EmitRejection referenced");
  });

  // RED-PROOF (a prose mention in a doc comment is not a violation): mirrors
  // src/dialects/typescript/index.ts's own JSDoc, which names `Session.read` in prose to
  // explain what the dialect delegates to — this must NOT trip the scan.
  it("[red-proof] a doc-comment mention of a banned symbol is not flagged", () => {
    const fixtureSource = `
/**
 * Reads route through \`Session.read\` only (REQ-MC-03); edits coalesce into a single
 * \`modify\` at flush.
 */
export function noop() {}
`;
    expect(findBannedSymbolReferences(fixtureSource)).toEqual([]);
  });

  // RED-PROOF (recursion, REQ-MC-03.1/REQ-DG-04.1): a fixture planted TWO directory levels
  // deep, quarantined under test/fixtures/red/. A top-level-only file listing never reaches
  // it — the scan's file discovery must walk subdirectories, not just the scanned root.
  it("[red-proof] a fixture nested two directory levels deep is still caught by the scan", () => {
    const files = listSourceFiles(NESTED_RED_FIXTURE_ROOT);
    const violations = files.flatMap((file) => findBannedSymbolReferences(readFileSync(file, "utf-8")));
    expect(violations.length).toBeGreaterThan(0);
  });
});
