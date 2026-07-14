/**
 * S-005 — SECURITY.md + docs/authoring-a-dialect.md guard (REQ-STD-01, REQ-DAS-01/02,
 * REQ-TSD-06.2). The frozen strings below are copied VERBATIM from design.md §4.4b — this
 * file is the enforcement mechanism, not the source of truth; if a string here ever diverges
 * from design.md, design.md wins and this test is wrong, not the other way around.
 *
 * [permanent-fixture] — this guard stays in the suite forever, mirroring
 * test/docs/testing-story-docs.test.ts's precedent for doc/security substring guards.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../support/jsdoc-scan.ts";
import { extractSection } from "../support/markdown-section.ts";

const SECURITY_PATH = join(PROJECT_ROOT, "SECURITY.md");
const DOC_PATH = join(PROJECT_ROOT, "docs/authoring-a-dialect.md");
const PUBLISH_WORKFLOW_PATH = join(PROJECT_ROOT, ".github/workflows/publish.yml");
const SENSITIVE_AREAS_PATH = join(PROJECT_ROOT, "openspec/sensitive-areas.md");
const AUTHORING_ERRORS_DOC_PATH = join(PROJECT_ROOT, "docs/authoring-errors.md");
const DRY_RUN_DOC_PATH = join(PROJECT_ROOT, "docs/dry-run.md");
const AUTHORING_ERROR_SRC_PATH = join(PROJECT_ROOT, "src/core/authoring-error.ts");
const AUTHORING_VERBS_DOC_PATH = join(PROJECT_ROOT, "docs/authoring-verbs.md");

const security = () => readFileSync(SECURITY_PATH, "utf-8");
const doc = () => readFileSync(DOC_PATH, "utf-8");
const sensitiveAreas = () => readFileSync(SENSITIVE_AREAS_PATH, "utf-8");

// Frozen strings — design.md §4.4b, migrated by S-004 (author-write-surface, REQ-STD-01/
// REQ-DAS-01.2) to the shipped `.modify(fn)` name. Copied verbatim; do not paraphrase.
const RAW_TRUST_SENTENCE =
  "The `.modify(ast => …)` escape hatch executes dialect and schematic code with full process " +
  "privilege — it is NOT a sandbox. The serialization seam (only plain strings cross to the " +
  "engine) is the ONLY containment guarantee; it bounds what data leaves a run, not what code " +
  "may do while running. Vet any dialect or op-pack before importing it.";

const CONFORMANCE_NOT_SAFETY_CAVEAT =
  "Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it " +
  "proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's " +
  "`.modify()` code is safe to execute.";

const TWO_REALMS_HAZARD =
  "Two ts-morph realms: if your schematic already depends on ts-morph directly, that is a " +
  "separate realm from the SDK's internal ts-morph used inside `.modify(ast => …)`. A " +
  "`Node`/`SourceFile` from your realm is not interchangeable with the AST the SDK hands your " +
  "`.modify()` callback — even when both realms resolve the identical ts-morph version. Never pass " +
  "ts-morph objects across the boundary; operate only on the `ast` the callback receives.";

const GENERAL_TRUST_SENTENCE =
  "Importing any dialect or op-pack runs its code with full process privilege; there is no " +
  "sandbox or signing in v1; vet before importing.";

const CONTRIBUTOR_HEADING = "### For contributors: building a dialect";

describe("REQ-STD-01 — SECURITY.md trust sentences", () => {
  it("carries the general explicit-trust posture", () => {
    expect(security()).toContain(GENERAL_TRUST_SENTENCE);
  });

  it("carries the .raw()-specific trust sentence verbatim", () => {
    expect(security()).toContain(RAW_TRUST_SENTENCE);
  });

  it('carries the "conformance ≠ safety" caveat verbatim', () => {
    expect(security()).toContain(CONFORMANCE_NOT_SAFETY_CAVEAT);
  });

  it("each new sentence appears exactly once", () => {
    const content = security();
    expect(content.split(RAW_TRUST_SENTENCE).length - 1).toBe(1);
    expect(content.split(CONFORMANCE_NOT_SAFETY_CAVEAT).length - 1).toBe(1);
  });
});

describe("REQ-DAS-01.1 — authoring doc names exactly the shipped API", () => {
  it("names every shipped kit verb and dialect verb", () => {
    const content = doc();
    // S-002 (DAS-01.1 guard-flip): removeImport + addFunction joined the loop.
    // S-003: addVariable/addClass complete the four-op loop in the SAME slice that ships
    // them (REQ-DAS-01: the loop names exactly the shipped API — never an unshipped verb).
    for (const name of [
      "defineDialect",
      "defineOpPack",
      "withOps",
      ".modify",
      "addImport",
      "removeImport",
      "addFunction",
      "addVariable",
      "addClass",
    ]) {
      expect(content).toContain(name);
    }
  });
});

describe("REQ-DAS-01.2 — two-realms hazard section", () => {
  it("is present and guard-asserted verbatim", () => {
    expect(doc()).toContain(TWO_REALMS_HAZARD);
  });

  it("the hazard paragraph appears exactly once", () => {
    expect(doc().split(TWO_REALMS_HAZARD).length - 1).toBe(1);
  });
});

describe("REQ-DAS-01.3 — Async usage section", () => {
  it("is present, naming both the awaited-chain form and the forgotten-await join", () => {
    const section = extractSection(doc(), "## Async usage");
    expect(section).toContain("await");
    expect(section).toContain("forgotten");
  });

  it("fails red if the section is removed (regression proof)", () => {
    const withoutSection = doc().replace(/## Async usage[\s\S]*?(?=\n## |$)/, "");
    expect(() => extractSection(withoutSection, "## Async usage")).toThrow();
  });
});

describe("REQ-DAS-02.1 — contributor section has no author-style demo", () => {
  it("contains no fenced code demo, only kit + type-proof verification anchors", () => {
    const section = extractSection(doc(), CONTRIBUTOR_HEADING);
    expect(section).not.toContain("```");
    expect(section).toContain("testDialect");
    expect(section).toContain("testOpPack");
    expect(section).toContain("expectTypeOf");
  });
});

// author-write-surface S-004.4: `"modify"` is the WIRE-altitude label shared by BOTH
// `.replaceContent()`- and `.modify(fn)`-produced directives (REQ-AEC-13, Decided item 2 —
// the mismatch is deliberate, `AuthoringVerb`/`DryRunVerb` are NEVER renamed). A substance
// check (mirrors REQ-DAS-01.3's own pattern), not a byte-exact pin — design.md states this
// requirement as SUBSTANCE only, no verbatim sentence is prescribed.
//
// Fourth surface, `docs/authoring-verbs.md` (spec.md:40-42, REQ-AEC-13's "Documentation
// surfaces" list): the rationale breadcrumb belongs on the `replaceContent` entry itself, not
// only in JSDoc — a reader of the published docs site never sees JSDoc.
describe("REQ-AEC-13.3 — the shared `\"modify\"` wire label is documented in all 4 surfaces", () => {
  const surfaces = [
    { name: "docs/authoring-errors.md", read: () => readFileSync(AUTHORING_ERRORS_DOC_PATH, "utf-8") },
    { name: "docs/dry-run.md", read: () => readFileSync(DRY_RUN_DOC_PATH, "utf-8") },
    { name: "src/core/authoring-error.ts (AuthoringVerb JSDoc)", read: () => readFileSync(AUTHORING_ERROR_SRC_PATH, "utf-8") },
    { name: "docs/authoring-verbs.md (replaceContent entry)", read: () => readFileSync(AUTHORING_VERBS_DOC_PATH, "utf-8") },
  ];

  for (const surface of surfaces) {
    it(`${surface.name} states the "modify" wire label substantively`, () => {
      const content = surface.read();
      expect(content).toContain('"modify"');
      expect(content).toContain(".replaceContent()");
      expect(content).toContain(".modify(fn)");
      expect(content).toMatch(/\bwire\b/i);
    });
  }
});

describe("REQ-TSD-06.2 — publish workflow retains --provenance", () => {
  it("keeps npm publish --provenance in the CI publish job", () => {
    expect(readFileSync(PUBLISH_WORKFLOW_PATH, "utf-8")).toContain("--provenance");
  });
});

describe("S-002 registry deliverable — sensitive-areas.md promotion (constraint 9)", () => {
  it('the "security (code execution)" row reads `high`, not `medium`', () => {
    const row = sensitiveAreas()
      .split("\n")
      .find((line) => line.startsWith("| security (code execution)"));
    expect(row).toBeDefined();
    expect(row).toContain("| high |");
  });

  it('the stale "All entries are `confidence: low` and **anticipated**" sentence is absent', () => {
    expect(sensitiveAreas()).not.toContain("All entries are `confidence: low` and **anticipated**");
  });
});
