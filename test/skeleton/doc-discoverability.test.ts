/**
 * Doc-discoverability pins (authoring-error-contract REQ-AEC-03.2, REQ-AEC-04.3,
 * REQ-AEC-04.4) — all NON-DROPPABLE. The
 * `read-trichotomy-helper` domain's REQ-RT-03 doc-discoverability scenario lives instead
 * in `test/skeleton/classify-content.test.ts` (S-004, droppable) — droppability is
 * enforced by file placement, not by a flag in this file.
 *
 * Static text-scan over already-authored JSDoc (S-000) — same
 * convention as FIT-06/FIT-08/FIT-09/pyramid-codification: readFileSync + regex, no
 * markdown/TS-AST parser dependency. [characterization] — pins shape already intended by
 * S-000's authoring-error.ts / commons/index.ts JSDoc, not a bug fix (RED taxonomy (d)).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsDocBefore, PROJECT_ROOT } from "../support/jsdoc-scan.ts";

const SRC_ROOT = join(PROJECT_ROOT, "src");

const AUTHORING_ERROR_SOURCE = readFileSync(join(SRC_ROOT, "core", "authoring-error.ts"), "utf-8");
const COMMONS_SOURCE = readFileSync(join(SRC_ROOT, "commons", "index.ts"), "utf-8");

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
    replaceContent: /^export function replaceContent\(/,
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
