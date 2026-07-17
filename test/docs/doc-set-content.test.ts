/**
 * Doc-set content checks (S-004, REQ-AOD-03/04/05/06, REQ-FPS-06.2): static token-presence
 * scans over the reference-doc set — no execution, no scratch consumer (design's Test
 * Derivation table marks this REQ cluster `unit`). Reads each doc file directly; a target
 * file's absence throws (ENOENT) before the doc set exists — the same "the throw IS the RED
 * evidence" precedent `testing-story-docs.test.ts`'s `extractTestingSection()` already
 * established in this repo for missing markdown content.
 *
 * Vocabulary-count drift note: this change's Executor Context (slices.md item 6, dated
 * 2026-07-12) recorded `AuthoringReason` at eight values and `AuthoringVerb` at six.
 * `schematic-local-files` landed on `main` afterward (visible in this branch's own merge
 * history) and extended them to twelve reasons (four new `source-*` reasons, REQ-AEC-10)
 * and seven verbs (`copyIn` added, ADR-0043). Per slices.md's own standing instruction
 * ("trust the repo, not this doc, if they ever diverge again" — already invoked once for
 * S-002's fit-23 rename), this test asserts the CURRENT vocabulary, not the plan's stale
 * counts. REQ-AOD-03 only requires the six NAMED verbs be present (a floor, not a ceiling),
 * so documenting the true seventh alongside them satisfies the requirement without
 * contradicting it.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRowLine, lastTableCell } from "../support/markdown-section.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function readDoc(relPath: string): string {
  return readFileSync(join(PROJECT_ROOT, relPath), "utf-8");
}

// Wire-/port-internal identifiers an author-facing doc must never surface (REQ-AOD-05.1):
// the rejection class name and the two other wire-level type names from src/core/wire.ts,
// plus the wire op word itself (word-boundary, so it never matches inside prose like
// "deleted"). Author vocabulary's "path-collision" reason legitimately CONTAINS the
// substring "collision" (the wire-level EmitRejectionCode is the BARE word "collision") —
// banning that bare substring would also ban the correct author term, so it is
// intentionally excluded from this list.
const WIRE_INTERNAL_TERMS: (string | RegExp)[] = ["EmitRejection", "Directive", "Batch", /\bdelete\b/];

function assertNoWireInternalTerms(doc: string): void {
  for (const term of WIRE_INTERNAL_TERMS) {
    if (typeof term === "string") {
      expect(doc).not.toContain(term);
    } else {
      expect(doc).not.toMatch(term);
    }
  }
}

describe("REQ-AOD-03 — six-verb reference with read-trichotomy", () => {
  const doc = readDoc("docs/authoring-verbs.md");

  it("REQ-AOD-03.1: all six author verbs are documented", () => {
    // author-write-surface S-004: `modify` retired in favour of `replaceContent` — the
    // commons wholesale-replace verb (ADR-0050); this doc no longer names the old verb.
    for (const verb of ["create", "replaceContent", "remove", "rename", "move", "copy"]) {
      expect(doc).toContain(`\`${verb}\``);
    }
  });

  it("REQ-AOD-03.1: the find().read() read-trichotomy rule is explained", () => {
    expect(doc).toContain("find(");
    expect(doc).toContain(".read()");
    expect(doc).toContain("absent");
    expect(doc).toContain("empty");
    expect(doc).toContain("present");
  });
});

describe("REQ-AOD-04 — dialect usage linked, not duplicated", () => {
  const index = readDoc("docs/README.md");

  it("REQ-AOD-04.1: the doc index links authoring-a-dialect.md rather than re-authoring it", () => {
    expect(index).toContain("authoring-a-dialect.md");
    // Never re-authored here: the dialect house doc's own op-pack vocabulary must not be
    // redefined in the index.
    expect(index).not.toContain("addFunction");
    expect(index).not.toContain("addClass");
  });
});

describe("REQ-AOD-05 — error contract in author vocabulary", () => {
  const doc = readDoc("docs/authoring-errors.md");

  it("REQ-AOD-05.1: AuthoringError's verb/path/reason fields are named", () => {
    expect(doc).toContain("AuthoringError");
    expect(doc).toContain("`verb`");
    expect(doc).toContain("`path`");
    expect(doc).toContain("`reason`");
  });

  it("REQ-AOD-05.1: no wire-level/IR-batch terminology appears", () => {
    assertNoWireInternalTerms(doc);
  });
});

// The wire-internal-terms ban is not specific to authoring-errors.md — it is a property of
// the entire author-facing doc set (REQ-AOD-05.1's vocabulary boundary applies wherever
// author-facing docs describe the SDK, not just the error-contract page).
describe("wire-internal terms banned across the full author-facing doc set", () => {
  const AUTHOR_FACING_DOCS = [
    "docs/quickstart.md",
    "docs/authoring-verbs.md",
    "docs/authoring-errors.md",
    "docs/create-templates.md",
    "docs/dry-run.md",
    "docs/README.md",
  ];

  for (const relPath of AUTHOR_FACING_DOCS) {
    it(`${relPath}: no wire-level/IR-batch terminology appears`, () => {
      assertNoWireInternalTerms(readDoc(relPath));
    });
  }
});

describe("REQ-AOD-06 — dry-run usage: ./commons function, not a subpath", () => {
  const doc = readDoc("docs/dry-run.md");

  it("REQ-AOD-06.1: imports dryRun from @pbuilder/sdk/commons", () => {
    expect(doc).toMatch(/import\s*\{\s*dryRun\s*\}\s*from\s*["']@pbuilder\/sdk\/commons["']/);
  });

  it("REQ-AOD-06.2: demonstrates iterating dryRun()'s returned entries", () => {
    expect(doc).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+dryRun\(\)/);
  });
});

describe("REQ-FPS-06.2 — dist/core document-not-strip rationale", () => {
  const readme = readDoc("README.md");

  it("README states dist/core ships intentionally and stays unreachable via exports", () => {
    expect(readme).toContain("dist/core");
    expect(readme).toMatch(/\.\/testing/);
    expect(readme).toMatch(/exports/);
  });
});

// design-added (bare-factory-migration §4.6): the whole-README zero-`defineFactory` guarantee
// is broader than REQ-TSD-01.5's heading-scoped scan of the "## Testing your factory" section
// alone — the scaffolding-folder example (outside that section) must also be bare (tech-writer
// finding, design.md §4.2 README.md row).
describe("bare-factory-migration — README.md carries zero defineFactory tokens anywhere", () => {
  it("the whole file, not just the testing section, is bare", () => {
    expect(readDoc("README.md")).not.toContain("defineFactory");
  });
});

describe("README front-door", () => {
  const readme = readDoc("README.md");

  it("links the quickstart", () => {
    expect(readme).toContain("docs/quickstart.md");
  });

  it("links the dialect doc as the front door for dialect usage", () => {
    expect(readme).toContain("docs/authoring-a-dialect.md");
  });
});

// S-005 (REQ-AOD-09/10/12): planning-doc reconciliation. Static content scans over the
// planning docs, same "no execution" unit layer as the rest of this file. Row lookups locate
// rows BY CONTENT (a stable fragment of each row's own text), never by line number — per
// slices.md's Executor Context item 9 ("re-locate by content before editing" if an earlier
// slice in this change edited the file first; no earlier slice in this change touches these
// files, but the convention is followed for future-proofing regardless).

describe("REQ-AOD-09 — planning-doc reconciliation (openspec/pending-changes.md)", () => {
  const doc = readDoc("openspec/pending-changes.md");

  const RETIRED_FRAGMENTS = [
    "publish.yml` repo-owner guard",
    "Pin `actions/checkout` + `actions/setup-node`",
    "dist/core/**` ships in tarball",
    "Add a `prebuild` clean",
    "Demo-moment narrative restructure",
    "README front-door dialect entry",
  ];

  it("REQ-AOD-09.1: rows 27/33/34/35/86/143 are struck through and marked retired", () => {
    for (const fragment of RETIRED_FRAGMENTS) {
      const line = findRowLine(doc, fragment);
      expect(line).toContain("~~");
    }
    const retiredMarkerCount = (doc.match(/RETIRED — `stage-6-release-shape`/g) ?? []).length;
    expect(retiredMarkerCount).toBe(6);
  });

  it("REQ-AOD-09.2: row 74 is re-tagged away from Stage 6 to the cross-repo engine-gated bucket", () => {
    const line = findRowLine(doc, "EmitRejection port conformance for the real engine client");
    expect(line).not.toMatch(/\|\s*\*\*6\*\*\s*\|/);
    expect(line).toContain("cross-repo");
  });

  it("REQ-AOD-09.4: rows 56 and 142 are re-tagged to the PC-PROTO-01/public-package bucket", () => {
    for (const fragment of ["`BATCH_CAP_BYTES`", "provenance go-live checklist"]) {
      const line = findRowLine(doc, fragment);
      expect(lastTableCell(line)).toBe("PC-PROTO-01 / public-package plan");
    }
  });

  it("REQ-AOD-09.5: row 175's trigger is re-pointed at the sdk-kit extraction/public-package plan", () => {
    const line = findRowLine(doc, "`RunResult.error`'s typed union");
    expect(lastTableCell(line)).toBe("sdk-kit extraction / public-package plan");
  });

  it("REQ-AOD-09.6: a new entry records the required-reviewers go-live precondition", () => {
    expect(doc).toContain("GitHub Environment required-reviewers gate");
    expect(doc).toMatch(/MANDATORY precondition of removing `--dry-run`/);
    expect(doc).toContain("public-package plan");
  });
});

describe("REQ-AOD-09.3 — ROADMAP states release-readiness, not a release", () => {
  const doc = readDoc("ROADMAP.md");

  it("ROADMAP's Stage 6 note states release-readiness with live publish deferred to a future gate", () => {
    expect(doc).toContain("Stage 6");
    expect(doc).toContain("delivers RELEASE-READINESS, not a release");
    expect(doc).toMatch(/first LIVE publish is a separate/);
  });
});

describe("REQ-AOD-10 — demo narrative calls dryRun() before any read/dialect-open", () => {
  const doc = readDoc("openspec/objectives-plan.md");

  it("REQ-AOD-10.1: the demo-moment paragraph sequences dryRun() before the dialect handle", () => {
    const idx = doc.indexOf("**The demo moment:**");
    expect(idx).toBeGreaterThan(-1);
    const paragraphEnd = doc.indexOf("\n\n", idx);
    const paragraph = doc.slice(idx, paragraphEnd === -1 ? undefined : paragraphEnd);
    const dryRunIdx = paragraph.indexOf("dryRun()");
    const dialectIdx = paragraph.indexOf("dialect handle");
    expect(dryRunIdx).toBeGreaterThan(-1);
    expect(dialectIdx).toBeGreaterThan(-1);
    expect(dryRunIdx).toBeLessThan(dialectIdx);
  });
});

describe("REQ-AOD-12 — sensitive-areas registry reconciliation", () => {
  const doc = readDoc("openspec/sensitive-areas.md");

  it("REQ-AOD-12.1: deployment row moves low->medium confidence with publish.yml in paths", () => {
    const line = findRowLine(doc, "| deployment |");
    expect(line).toContain(".github/workflows/publish.yml");
    expect(line).toMatch(/\|\s*medium\s*\|/);
    expect(line).toMatch(/SHA-pin/);
    expect(line).toMatch(/repo-owner guard/);
  });

  it("REQ-AOD-12.2: supply-chain row notes the dist/core decision and SHA-pin convention", () => {
    const line = findRowLine(doc, "| security (supply-chain) |");
    expect(line).toContain("dist/core/**");
    expect(line).toContain("REQ-FPS-06");
    expect(line).toContain("REQ-PPH-02");
  });

  it("REQ-AOD-12.3: the Review Required section no longer claims deployment is lower-confidence", () => {
    const reviewIdx = doc.indexOf("## Review Required");
    expect(reviewIdx).toBeGreaterThan(-1);
    const reviewSection = doc.slice(reviewIdx);
    expect(reviewSection).not.toMatch(/deployment[^\n]{0,60}lower-confidence/i);
    expect(reviewSection).toContain("security (IPC)");
  });
});
