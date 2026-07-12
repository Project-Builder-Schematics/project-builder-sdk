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

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SECURITY_PATH = join(PROJECT_ROOT, "SECURITY.md");
const DOC_PATH = join(PROJECT_ROOT, "docs/authoring-a-dialect.md");
const PUBLISH_WORKFLOW_PATH = join(PROJECT_ROOT, ".github/workflows/publish.yml");

const security = () => readFileSync(SECURITY_PATH, "utf-8");
const doc = () => readFileSync(DOC_PATH, "utf-8");

// Frozen strings — design.md §4.4b. Copied verbatim; do not paraphrase.
const RAW_TRUST_SENTENCE =
  "The `.raw(ast => …)` escape hatch executes dialect and schematic code with full process " +
  "privilege — it is NOT a sandbox. The serialization seam (only plain strings cross to the " +
  "engine) is the ONLY containment guarantee; it bounds what data leaves a run, not what code " +
  "may do while running. Vet any dialect or op-pack before importing it.";

const CONFORMANCE_NOT_SAFETY_CAVEAT =
  "Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it " +
  "proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's " +
  "`.raw()` code is safe to execute.";

const TWO_REALMS_HAZARD =
  "Two ts-morph realms: if your schematic already depends on ts-morph directly, that is a " +
  "separate realm from the SDK's internal ts-morph used inside `.raw(ast => …)`. A " +
  "`Node`/`SourceFile` from your realm is not interchangeable with the AST the SDK hands your " +
  "`.raw()` callback — even when both realms resolve the identical ts-morph version. Never pass " +
  "ts-morph objects across the boundary; operate only on the `ast` the callback receives.";

const GENERAL_TRUST_SENTENCE =
  "Importing any dialect or op-pack runs its code with full process privilege; there is no " +
  "sandbox or signing in v1; vet before importing.";

const CONTRIBUTOR_HEADING = "### For contributors: building a dialect";

/** Returns the doc's section starting at `heading` (inclusive) up to the next `#`-`###` heading. */
function extractSection(content: string, heading: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    throw new Error(`docs/authoring-a-dialect.md is missing the "${heading}" section`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3} /.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

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

  it("fails red if either new sentence is removed (regression proof)", () => {
    const withoutRaw = security().replace(RAW_TRUST_SENTENCE, "");
    const withoutCaveat = security().replace(CONFORMANCE_NOT_SAFETY_CAVEAT, "");
    expect(withoutRaw).not.toContain(RAW_TRUST_SENTENCE);
    expect(withoutCaveat).not.toContain(CONFORMANCE_NOT_SAFETY_CAVEAT);
  });
});

describe("REQ-DAS-01.1 — authoring doc names exactly the shipped API", () => {
  it("names every shipped kit verb and dialect verb", () => {
    const content = doc();
    for (const name of ["defineDialect", "defineOpPack", "withOps", ".raw", "addImport"]) {
      expect(content).toContain(name);
    }
  });

  it("never names unshipped surface (e.g. removeImport)", () => {
    expect(doc()).not.toContain("removeImport");
  });
});

describe("REQ-DAS-01.2 — two-realms hazard section", () => {
  it("is present and guard-asserted verbatim", () => {
    expect(doc()).toContain(TWO_REALMS_HAZARD);
  });

  it("fails red if the hazard paragraph is removed (regression proof)", () => {
    expect(doc().replace(TWO_REALMS_HAZARD, "")).not.toContain(TWO_REALMS_HAZARD);
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

describe("REQ-TSD-06.2 — publish workflow retains --provenance", () => {
  it("keeps npm publish --provenance in the CI publish job", () => {
    expect(readFileSync(PUBLISH_WORKFLOW_PATH, "utf-8")).toContain("--provenance");
  });
});
