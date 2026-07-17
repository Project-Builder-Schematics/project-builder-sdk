/**
 * S-004 — REQ-RXD-09 doc guard: `docs/authoring-a-dialect.md` must gain a second worked
 * example for `@pbuilder/sdk/react` (the coalesced `addImport` + `setJsxProp` journey), the
 * `value` trust boundary, the spread-precedence warning, the named-only `addImport`
 * limitation, the explicit-`.tsx`-extension requirement, and the two-dialect reframe (the doc
 * must no longer describe `@pbuilder/sdk/typescript` as the only shipped dialect).
 *
 * Pinned anchor sentinels (mirrors the REQ-DAS-01.2 two-realms guard pattern,
 * `test/docs/security-authoring-guard.test.ts`): the `value`-trust and spread-precedence
 * sections each share a verbatim heading + sentence with this guard, so doc and guard cannot
 * drift independently — removing either section fails RED.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";
import { extractSection } from "../../support/markdown-section.ts";

const DOC_PATH = join(PROJECT_ROOT, "docs/authoring-a-dialect.md");
const README_PATH = join(PROJECT_ROOT, "README.md");
const REACT_INDEX_PATH = join(PROJECT_ROOT, "src/dialects/react/index.ts");

const doc = () => readFileSync(DOC_PATH, "utf-8");

const REACT_SECTION_HEADING = "### `@pbuilder/sdk/react` — a second dialect";

const VALUE_TRUST_HEADING = "#### The `value` trust boundary";
const VALUE_TRUST_SENTENCE =
  "The SDK performs no validation, escaping, or sanitisation on `value` — it becomes " +
  "executable code in the generated file.";

const SPREAD_PRECEDENCE_HEADING = "#### Spread-precedence warning";
const SPREAD_PRECEDENCE_SENTENCE =
  "An inserted explicit prop lands AFTER a trailing `{...spread}` and therefore WINS at " +
  "React runtime (later-position precedence).";

const COLLISION_REJECT_HEADING = "#### The `addImport` collision-reject limitation";
const COLLISION_REJECT_SENTENCE =
  "`addImport` REJECTS when `name` is already bound elsewhere in the file under a different " +
  "binding — whether from a different module, or the same module under an alias or a " +
  "type-only specifier — and resolving the naming conflict is your responsibility, since " +
  "`addImport` takes no alias argument to route around it.";

const EXPLICIT_EXTENSION_REQUIREMENT =
  "`find(path)` requires an explicit `.tsx` extension — extensionless paths are rejected, " +
  "never normalized.";
const EXPLICIT_EXTENSION_WHY =
  "a future `.jsx` dialect addition would otherwise leave an assumed extension ambiguous " +
  "between `Button.tsx` and `Button.jsx`";

describe("REQ-RXD-09.4 — stale single-dialect framing reconciled", () => {
  it('no sentence describes "./typescript" as the only/first shipped dialect', () => {
    expect(doc()).not.toMatch(/first real dialect/i);
  });

  it("the intro paragraph names @pbuilder/sdk/react alongside @pbuilder/sdk/typescript", () => {
    const content = doc();
    const start = content.indexOf("This document covers");
    expect(start).toBeGreaterThan(-1);
    const introParagraph = content.slice(start, content.indexOf("\n\n", start));
    expect(introParagraph).toContain("@pbuilder/sdk/typescript");
    expect(introParagraph).toContain("@pbuilder/sdk/react");
  });
});

describe("REQ-RXD-09.1 — react section names the shipped ops, v1 minimality, catalog follow-up, and .modify(fn)", () => {
  it("names setJsxProp and addImport, states v1 minimality, the op-catalog follow-up, and .modify(fn)", () => {
    const section = extractSection(doc(), REACT_SECTION_HEADING, /^## /);
    expect(section).toContain("setJsxProp");
    expect(section).toContain("addImport");
    expect(section.toLowerCase()).toContain("v1");
    expect(section.toLowerCase()).toContain("op-catalog");
    expect(section).toContain(".modify(fn)");
  });

  it("states the named-only addImport limitation, naming default/mixed imports as catalog scope", () => {
    const section = extractSection(doc(), REACT_SECTION_HEADING, /^## /);
    expect(section.toLowerCase()).toContain("named-binding-only");
    expect(section).toContain("import React from \"react\"");
  });
});

describe("REQ-RXD-09.2 — react worked example is the coalesced journey with // -> output", () => {
  it("chains addImport + setJsxProp on ONE handle and shows the byte output via // -> comments", () => {
    const section = extractSection(doc(), REACT_SECTION_HEADING, /^## /);
    expect(section).toContain(".addImport(");
    expect(section).toContain(".setJsxProp(");
    expect(section).toContain("// ->");
  });

  it("fails red if the worked-example section is removed (regression proof)", () => {
    const withoutSection = doc().replace(
      new RegExp(`${REACT_SECTION_HEADING.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[\\s\\S]*?(?=\\n## |$)`),
      ""
    );
    expect(() => extractSection(withoutSection, REACT_SECTION_HEADING, /^## /)).toThrow();
  });
});

describe("REQ-RXD-09.3 — value-trust and spread-precedence sections present, guard-asserted", () => {
  it("carries the value-trust sentinel sentence verbatim", () => {
    expect(doc()).toContain(VALUE_TRUST_SENTENCE);
  });

  it("carries the spread-precedence sentinel sentence verbatim", () => {
    expect(doc()).toContain(SPREAD_PRECEDENCE_SENTENCE);
  });

  it("each sentinel sentence appears exactly once", () => {
    const content = doc();
    expect(content.split(VALUE_TRUST_SENTENCE).length - 1).toBe(1);
    expect(content.split(SPREAD_PRECEDENCE_SENTENCE).length - 1).toBe(1);
  });

  it("fails red if the value-trust section is removed (regression proof)", () => {
    const withoutSection = doc().replace(
      /#### The `value` trust boundary[\s\S]*?(?=\n#### |\n### |\n## |$)/,
      ""
    );
    expect(() => extractSection(withoutSection, VALUE_TRUST_HEADING)).toThrow();
    expect(withoutSection).not.toContain(VALUE_TRUST_SENTENCE);
  });

  it("fails red if the spread-precedence section is removed (regression proof)", () => {
    const withoutSection = doc().replace(
      /#### Spread-precedence warning[\s\S]*?(?=\n#### |\n### |\n## |$)/,
      ""
    );
    expect(() => extractSection(withoutSection, SPREAD_PRECEDENCE_HEADING)).toThrow();
    expect(withoutSection).not.toContain(SPREAD_PRECEDENCE_SENTENCE);
  });
});

describe("REQ-RXD-09.6 — addImport collision-reject limitation documented, guard-asserted (V7, judgment-day)", () => {
  it("carries the collision-reject sentinel sentence verbatim", () => {
    expect(doc()).toContain(COLLISION_REJECT_SENTENCE);
  });

  it("the sentinel sentence appears exactly once", () => {
    const content = doc();
    expect(content.split(COLLISION_REJECT_SENTENCE).length - 1).toBe(1);
  });

  it("fails red if the collision-reject section is removed (regression proof)", () => {
    const withoutSection = doc().replace(
      /#### The `addImport` collision-reject limitation[\s\S]*?(?=\n#### |\n### |\n## |$)/,
      ""
    );
    expect(() => extractSection(withoutSection, COLLISION_REJECT_HEADING)).toThrow();
    expect(withoutSection).not.toContain(COLLISION_REJECT_SENTENCE);
  });
});

describe("REQ-RXD-09.5 — explicit-.tsx-extension requirement documented (find JSDoc + worked example)", () => {
  it("find()'s own JSDoc states the explicit-extension requirement and the .jsx forward-compat reason", () => {
    const source = readFileSync(REACT_INDEX_PATH, "utf-8");
    expect(source).toContain("no normalization, always an explicit `.tsx`");
    expect(source).toContain("extensionless path is rejected");
    expect(source.toLowerCase()).toContain(".jsx");
    expect(source.toLowerCase()).toContain("follow-up");
  });

  it("the doc's react worked-example section states the same requirement and the why, guard-pinned", () => {
    const section = extractSection(doc(), REACT_SECTION_HEADING, /^## /);
    expect(section).toContain(EXPLICIT_EXTENSION_REQUIREMENT);
    expect(section).toContain(EXPLICIT_EXTENSION_WHY);
  });

  it("fails red if the explicit-extension sentence is removed (regression proof)", () => {
    const withoutSentence = doc().replace(EXPLICIT_EXTENSION_REQUIREMENT, "");
    expect(withoutSentence).not.toContain(EXPLICIT_EXTENSION_REQUIREMENT);
  });
});

// F-01 (verify-final, MAJOR): find()'s @example is the ONLY worked example on the shipped
// public .d.ts surface (`setJsxProp`/`addImport`'s own JSDoc does not reach the .d.ts — the
// `OpMethods` mapped type strips it). It previously read "structured ops arrive in later
// slices; .modify() is the escape hatch today" — S-000 skeleton wording that survived both
// ops shipping in S-001/S-002. Neither fit-04 (exempts @example edits, by design) nor this
// file's own README/doc-index checks (which only grep .md files) caught it — this guard closes
// that seam by reading the .ts source directly, mirroring REQ-RXD-09.5's own pattern above.
describe("F-01 guard — find()'s @example demonstrates the shipped ops, not stale skeleton wording", () => {
  it("names both shipped ops in the @example block", () => {
    const source = readFileSync(REACT_INDEX_PATH, "utf-8");
    expect(source).toContain(".addImport(");
    expect(source).toContain(".setJsxProp(");
  });

  it("no longer claims structured ops arrive later or that .modify() is the only escape hatch today", () => {
    const source = readFileSync(REACT_INDEX_PATH, "utf-8");
    expect(source).not.toContain("arrive in later slices");
    expect(source).not.toContain("is the escape hatch today");
    // SDD-internal vocabulary must not leak into a consumer-facing doc comment.
    expect(source.toLowerCase()).not.toContain("slice");
  });
});

const CONTRIBUTOR_SECTION_HEADING = "### For contributors: building a dialect";
const VALIDATED_OP_HEADING = "#### Validating name/identifier arguments: the `validatedOp` pattern";
const VALIDATED_OP_SENTENCE =
  "ts-morph writes structured-API arguments like `JsxAttributeStructure.name` and import " +
  "specifiers as RAW TEXT with no escaping of its own";

describe("REQ-RXD-15 — contributor docs teach the validatedOp pattern (ARCH-1)", () => {
  it("names validatedOp, describes the validate-before-mutate chokepoint, states the vulnerability class, and points at the reference implementation", () => {
    const section = extractSection(doc(), CONTRIBUTOR_SECTION_HEADING, /^## /);
    expect(section).toContain("validatedOp");
    expect(section.toLowerCase()).toContain("chokepoint");
    expect(section).toContain(VALIDATED_OP_SENTENCE);
    expect(section).toContain("src/core/jsx-name-validator.ts");
  });

  it("carries the validatedOp sentinel sentence verbatim, exactly once", () => {
    const content = doc();
    expect(content).toContain(VALIDATED_OP_SENTENCE);
    expect(content.split(VALIDATED_OP_SENTENCE).length - 1).toBe(1);
  });

  it("fails red if the validatedOp section is removed (regression proof)", () => {
    const withoutSection = doc().replace(
      /#### Validating name\/identifier arguments: the `validatedOp` pattern[\s\S]*?(?=\n#### |\n### |\n## |$)/,
      ""
    );
    expect(() => extractSection(withoutSection, VALIDATED_OP_HEADING)).toThrow();
    expect(withoutSection).not.toContain(VALIDATED_OP_SENTENCE);
  });
});

describe("README.md line-12 example gains @pbuilder/sdk/react", () => {
  it("the doc-index paragraph names both @pbuilder/sdk/typescript and @pbuilder/sdk/react", () => {
    const readme = readFileSync(README_PATH, "utf-8");
    const start = readme.indexOf("[authoring a dialect]");
    expect(start).toBeGreaterThan(-1);
    const paragraph = readme.slice(start, readme.indexOf("\n\n", start));
    expect(paragraph).toContain("@pbuilder/sdk/typescript");
    expect(paragraph).toContain("@pbuilder/sdk/react");
  });
});
