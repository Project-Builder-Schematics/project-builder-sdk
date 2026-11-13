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

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function readDoc(relPath: string): string {
  return readFileSync(join(PROJECT_ROOT, relPath), "utf-8");
}

// Wire-/port-internal identifiers an author-facing doc must never surface (REQ-AOD-05.1):
// the rejection class name and the two other wire-level type names from src/core/wire.ts,
// plus the wire op word itself (word-boundary, so it never matches inside prose like
// "deleted"). `Directive` is word-bounded too: the author-facing `pendingDirectives()` and
// `PendingDirective` are Authoring vocabulary, only the bare wire type name is banned. Author vocabulary's "path-collision" reason legitimately CONTAINS the
// substring "collision" (the wire-level EmitRejectionCode is the BARE word "collision") —
// banning that bare substring would also ban the correct author term, so it is
// intentionally excluded from this list.
const WIRE_INTERNAL_TERMS: (string | RegExp)[] = ["EmitRejection", /\bDirective\b/, "Batch", /\bdelete\b/];

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
    "docs/pending-directives.md",
    "docs/README.md",
  ];

  for (const relPath of AUTHOR_FACING_DOCS) {
    it(`${relPath}: no wire-level/IR-batch terminology appears`, () => {
      assertNoWireInternalTerms(readDoc(relPath));
    });
  }
});

describe("REQ-AOD-06 — pendingDirectives usage: ./commons function, not a subpath", () => {
  const doc = readDoc("docs/pending-directives.md");

  it("REQ-AOD-06.1: imports pendingDirectives from @pbuilder/sdk/commons", () => {
    expect(doc).toMatch(/import\s*\{\s*pendingDirectives\s*\}\s*from\s*["']@pbuilder\/sdk\/commons["']/);
  });

  it("REQ-AOD-06.2: demonstrates iterating pendingDirectives()'s returned entries", () => {
    expect(doc).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+pendingDirectives\(\)/);
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

// S-005 (REQ-AOD-09.3): static content scan over ROADMAP.md, same "no execution" unit
// layer as the rest of this file.

describe("REQ-AOD-09.3 — ROADMAP states release-readiness, not a release", () => {
  const doc = readDoc("ROADMAP.md");

  it("ROADMAP's Stage 6 note states release-readiness with live publish deferred to a future gate", () => {
    expect(doc).toContain("Stage 6");
    expect(doc).toContain("delivers RELEASE-READINESS, not a release");
    expect(doc).toMatch(/first LIVE publish is a separate/);
  });
});
