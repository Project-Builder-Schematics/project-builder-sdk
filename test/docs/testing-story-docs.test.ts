/**
 * TSD-01 (README testing section) + TSD-03 (qualifying-line revert) + TSD-04 (ADR-0009
 * amendment content) — copy-runnable and TOKEN-LEVEL text proofs (design rev 4 §4.6, GAP-5
 * pinned token sets). Asserts token PRESENCE, never whole-sentence prose matches, so prose
 * stays author-free.
 *
 * TSD-02 (`runFactoryForTest` JSDoc coverage) lives in fit-06-example-jsdoc.test.ts — the
 * FIT-06 scan is the mechanism, not this file. TSD-03 (qualifying-line revert) is sequenced
 * strictly after `stage-4-typed-options` archives — S-005 punted it (that gate wasn't true
 * yet at S-005's build); S-006's gate confirms the archive, so it lands here now.
 */
import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const README_PATH = join(PROJECT_ROOT, "README.md");
const ADR_0033_PATH = join(PROJECT_ROOT, "openspec/decisions/0033-third-audience-author-testing.md");
const ADR_0009_PATH = join(PROJECT_ROOT, "openspec/decisions/0009-two-audiences-contributor-kit.md");

// Outside test/ so bun's test-file glob (evaluated once at suite start) never picks these up
// mid-run — same precedent as test/e2e/installed-consumer.e2e.test.ts's `.tmp-testing-e2e/`.
const SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-readme-copy-runnable");

const TESTING_SECTION_HEADING = "## Testing your factory";

/**
 * Returns the README's `## Testing your factory` section (heading line through, but not
 * including, the next `## ` heading). Throws if the section is absent — the throw IS the RED
 * evidence before the section exists.
 */
function extractTestingSection(): string {
  const source = readFileSync(README_PATH, "utf-8");
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim() === TESTING_SECTION_HEADING);
  if (start === -1) {
    throw new Error(`README.md is missing the "${TESTING_SECTION_HEADING}" section`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Extracts every ```ts fenced code block's inner content from a markdown section. */
function extractTsCodeBlocks(section: string): string[] {
  const blocks: string[] = [];
  const pattern = /```ts\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section)) !== null) {
    const body = match[1];
    if (body !== undefined) blocks.push(body);
  }
  return blocks;
}

// Copy-runnable proof allows swapping ONLY the import specifier (the installed package name
// has no meaning inside this repo's own test run) — no other line may be touched.
function withRelativeImports(block: string): string {
  return block
    .replace(/(['"])@pbuilder\/sdk\/testing\1/g, `$1${join(PROJECT_ROOT, "src/testing/index.ts")}$1`)
    .replace(/(['"])@pbuilder\/sdk\/commons\1/g, `$1${join(PROJECT_ROOT, "src/commons/index.ts")}$1`);
}

describe("REQ-TSD-01 — README testing section", () => {
  it("REQ-TSD-01.1: every code example is copy-runnable with only the import path swapped", () => {
    const section = extractTestingSection();
    const blocks = extractTsCodeBlocks(section);
    expect(blocks.length).toBeGreaterThan(0);

    mkdirSync(SCRATCH_DIR, { recursive: true });
    try {
      blocks.forEach((block, i) => {
        const scratchFile = join(SCRATCH_DIR, `example-${i}.test.ts`);
        writeFileSync(scratchFile, withRelativeImports(block));
        const result = spawnSync("bun", ["test", scratchFile], { cwd: PROJECT_ROOT, encoding: "utf-8" });
        if (result.status !== 0) {
          throw new Error(
            `README testing-section example #${i + 1} did not pass verbatim (only the import ` +
              `path was swapped):\n${result.stdout}\n${result.stderr}`
          );
        }
      });
    } finally {
      rmSync(SCRATCH_DIR, { recursive: true, force: true });
    }
  });

  it("REQ-TSD-01.2: states the 0.x semver-exempt exemption", () => {
    const section = extractTestingSection();
    expect(section).toContain("0.x");
    expect(section).toContain("semver-exempt");
  });

  it("REQ-TSD-01.3: states the ./testing vs ./conformance boundary", () => {
    const section = extractTestingSection();
    expect(section).toContain("./conformance");
  });

  it("REQ-TSD-01.4: demonstrates a seeded read (runFactoryForTest and seed co-occur)", () => {
    const codeText = extractTsCodeBlocks(extractTestingSection()).join("\n");
    expect(codeText).toContain("runFactoryForTest");
    expect(codeText).toContain("seed");
  });
});

describe("REQ-TSD-03 — README qualifying-line revert (sequence-gated)", () => {
  // stage-4-typed-options's REQ-FPS-05.4 wrote this line; its own scenario text says it is
  // "REVERTED when stage-4b-testing-harness lands". This slice's gate (orchestrator-confirmed)
  // verified `stage-4-typed-options` has ARCHIVED, so REQ-TSD-03.1's branch applies — the
  // line must be gone. definefactory-jsdoc.test.ts carries the permanent regression guard
  // for the same literal (stage-4-owned file, stage-4b-updated assertion); this is TSD-03's
  // own home per the design's File Changes purpose text.
  const README_QUALIFYING_LINE =
    '> **Note**: shipping incrementally — the external-author API (installable `defineFactory` + testing harness) lands with stage-4b.';

  it("REQ-TSD-03.1: the qualifying line is removed from README.md and no other content is disturbed", () => {
    const readme = readFileSync(README_PATH, "utf-8");
    expect(readme).not.toContain(README_QUALIFYING_LINE);
    expect(readme).toContain(TESTING_SECTION_HEADING);
  });
});

describe("REQ-TSD-04 — ADR-0009 amendment content (ADR-0033)", () => {
  it("REQ-TSD-04.1: ADR-0033 names the third audience, its entry, and the 0.x exemption", () => {
    const adr0033 = readFileSync(ADR_0033_PATH, "utf-8");
    expect(adr0033).toContain("author-testing");
    expect(adr0033).toContain("./testing");
    expect(adr0033).toContain("0.x");
  });

  it("REQ-TSD-04.1: ADR-0009's original AUTHOR/CONTRIBUTOR text is preserved, not rewritten", () => {
    const adr0009 = readFileSync(ADR_0009_PATH, "utf-8");
    expect(adr0009).toContain("AUTHOR = `@pbuilder/sdk/commons`");
    expect(adr0009).toContain("CONTRIBUTOR = the **kit**");
    expect(adr0009).toContain("0033");
  });
});
