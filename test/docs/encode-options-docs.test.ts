/**
 * REQ-TOE-09 (S-003, typed-options-feeder): `docs/create-templates.md` teaches native
 * arrays/objects with zero `JSON.stringify` mentions, and the testing-observability note
 * (that `@pbuilder/sdk/testing` recorded batches show composite options in their encoded
 * wire form, REQ-TOE-07) survives the stringify-removal edit.
 *
 * TW-F4 constraint (slices.md Executor Context): the note must dodge
 * `doc-set-content.test.ts`'s case-sensitive `WIRE_INTERNAL_TERMS` ban and additionally
 * must never sentence-start with `Batches`/`Directive` — asserted here via an
 * author-vocabulary phrase match, never a wire-term.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const DOC_PATH = join(PROJECT_ROOT, "docs/create-templates.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf-8");
}

describe("REQ-TOE-09.1 — zero options-related JSON.stringify mentions; native §1 example; no appendix", () => {
  const doc = readDoc();

  it("contains zero JSON.stringify mentions anywhere", () => {
    expect(doc).not.toContain("JSON.stringify");
  });

  it("section 1's example passes a native array option value, not a stringified one", () => {
    const section1 = doc.slice(doc.indexOf("## 1. The `create` surface"), doc.indexOf("## 2."));
    expect(section1).toContain("methods: [{ name: \"load\" }, { name: \"save\" }]");
  });

  it("the 'passing arrays and objects in v1' appendix section no longer exists", () => {
    expect(doc).not.toMatch(/## Appendix: passing arrays and objects in v1/);
    expect(doc).not.toContain("the appendix");
  });
});

describe("REQ-TOE-09.2 — the testing-observability note survives the stringify purge", () => {
  const doc = readDoc();

  it("documents that recorded batches show composite options in their encoded wire form (author-vocabulary phrase match)", () => {
    expect(doc).toMatch(/recorded batches/i);
    expect(doc).toMatch(/encoded\s+wire\s+form/);
  });

  it("TW-F4: no sentence in the doc starts with the capitalized wire-internal nouns 'Batches' or 'Directive'", () => {
    const sentenceStarts = doc.match(/(?:^|[.!?]\s+)([A-Z][a-zA-Z]*)/g) ?? [];
    for (const match of sentenceStarts) {
      const word = match.replace(/^(?:[.!?]\s+)?/, "");
      expect(word).not.toEqual("Batches");
      expect(word).not.toEqual("Directive");
    }
  });

  it("TW-F4: no capitalized wire-internal noun (Batch/Directive) appears anywhere, matching doc-set-content.test.ts's WIRE_INTERNAL_TERMS ban", () => {
    expect(doc).not.toContain("Directive");
    expect(doc).not.toContain("Batch");
    expect(doc).not.toMatch(/\bdelete\b/);
  });
});
