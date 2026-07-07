/**
 * REQ-RT-01/-02/-03 (read-trichotomy-helper, DROPPABLE — CQ-1). `classifyContent` gives
 * authors a named, branchable classification of a `find(path).read()` result instead of
 * manual `=== undefined` / `=== ""` comparisons. Constraint 3 (slices.md): ALL REQ-RT-03
 * assertions live ONLY in this file — no other test file references `classifyContent`.
 *
 * [characterization] — the trichotomy behaviour mirrors the manual comparisons authors
 * already write (see `test/skeleton/read-trichotomy.test.ts`); this pins the extracted
 * helper's contract, not a bug fix.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyContent } from "../../src/commons/classify-content.ts";
import { jsDocBefore, PROJECT_ROOT } from "../support/jsdoc-scan.ts";

describe("classifyContent — trichotomy classification (REQ-RT-01)", () => {
  it("classifies undefined as absent (REQ-RT-01.1)", () => {
    expect(classifyContent(undefined)).toBe("absent");
  });

  it('classifies "" as empty (REQ-RT-01.2)', () => {
    expect(classifyContent("")).toBe("empty");
  });

  it("classifies a non-empty string as present (REQ-RT-01.3)", () => {
    expect(classifyContent("some content")).toBe("present");
  });
});

describe("classifyContent — falsy-trio mutant killers (REQ-RT-02)", () => {
  it('classifies the literal string "0" as present, not absent (REQ-RT-02.1)', () => {
    expect(classifyContent("0")).toBe("present");
  });

  it('classifies the literal string "false" as present, not absent (REQ-RT-02.2)', () => {
    expect(classifyContent("false")).toBe("present");
  });

  it('classifies a whitespace-only string as present, not empty (REQ-RT-02.3)', () => {
    expect(classifyContent("   ")).toBe("present");
  });
});

const CLASSIFY_CONTENT_SOURCE = readFileSync(
  join(PROJECT_ROOT, "src", "commons", "classify-content.ts"),
  "utf-8"
);
const COMMONS_SOURCE = readFileSync(join(PROJECT_ROOT, "src", "commons", "index.ts"), "utf-8");

describe("classifyContent — doc discoverability (REQ-RT-03)", () => {
  it("carries a branching @example over the three ContentState cases fed by a read() result (REQ-RT-03.1)", () => {
    const doc = jsDocBefore(CLASSIFY_CONTENT_SOURCE, /^export function classifyContent\(/);
    expect(doc).toContain("@example");
    expect(doc).toMatch(/switch\s*\(\s*classifyContent\(/);
    expect(doc).toContain(".read()");
    expect(doc).toContain('case "absent"');
    expect(doc).toContain('case "empty"');
    expect(doc).toContain('case "present"');
  });

  it("find()'s JSDoc references classifyContent as the branchable alternative to manual strict comparisons (REQ-RT-03.2)", () => {
    const doc = jsDocBefore(COMMONS_SOURCE, /^export function find\(/);
    expect(doc).toContain("classifyContent");
  });
});
