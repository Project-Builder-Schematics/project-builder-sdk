/**
 * S-005 — `docs/runner-integrity-invariants.md` + `SECURITY.md` + the probe header guard
 * (REQ-IID-01..08, REQ-BDI-01.2). The frozen strings below are copied VERBATIM from
 * design.md §9 — this file is the enforcement mechanism, not the source of truth; if a
 * string here ever diverges from design.md, design.md wins and this test is wrong.
 * (`review-tech-writer.md`'s own preamble subordinates itself to design.md, which is what
 * settles the two places a drafted paragraph and §9 disagree.)
 *
 * IID-01.1 is the load-bearing one: the five Constraints are parsed STRUCTURALLY and each
 * `enforced-by:` must resolve to a fitness file that exists on disk, or to the literal
 * `engine-owned`. A prose-only assertion passes against a page that says the right words
 * while the code does something else; this one cannot.
 *
 * [permanent-fixture] — mirrors test/docs/security-authoring-guard.test.ts.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveRunnerClosure, ENTRY_RELATIVE_PATH } from "../../scripts/derive-runner-closure.ts";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DOC_PATH = join(PROJECT_ROOT, "docs/runner-integrity-invariants.md");
const DOCS_INDEX_PATH = join(PROJECT_ROOT, "docs/README.md");
const SECURITY_PATH = join(PROJECT_ROOT, "SECURITY.md");
const PROBE_PATH = join(PROJECT_ROOT, "src/transport/single-instance-probe.ts");
const FITNESS_DIR = join(PROJECT_ROOT, "test/fitness");

const doc = (): string => readFileSync(DOC_PATH, "utf-8");

// Frozen text is frozen in WORDS, not in line-wrap position: markdown renders a wrapped
// paragraph identically to an unwrapped one, so both sides are flattened before comparing.
// Every character except the wrap points is still asserted exactly.
const flat = (text: string): string => text.replace(/\s+/g, " ").trim();

// Same idea for a source header: the frozen sentence is the prose, `//` is the syntax
// carrying it, so the comment markers come off before the words are compared.
const flatComment = (text: string): string =>
  flat(text.replace(/^[ \t]*\/\/ ?/gm, ""));

// --- Frozen strings — design.md §9. Copied verbatim; do not paraphrase. -------------------

const SCOPE_PULL_QUOTE =
  "the manifest covers the runner's pre-factory bootstrap — 23 closure files plus " +
  "`package.json` — and nothing that loads after it.";

const EXCLUDED_TREES = [
  "dist/commons/**",
  "dist/dialects/**",
  "dist/conformance/**",
  "dist/testing/**",
  "node_modules/**",
];

const SCOPE_MEANS_ONE_THING =
  "A manifest that verifies therefore means one specific thing: **the bytes that bootstrap " +
  "the run are the bytes we published**.";

const NOT_CEREMONY =
  "It is not ceremony. It earns its place three ways, none of which is the story above.";

const TRIPWIRES_INDEPENDENT =
  "They are enforced by `fit-42`; they do not depend on the manifest existing.";

const INSTALL_SCRIPT_ADVERSARY =
  "The most common real-world npm attack is not that one: it is a compromised transitive " +
  "dependency or a `postinstall` script mutating an already-installed tree.";

const LIMIT_CONSTRAINT_1 =
  "Constraint 1 is enforced in CI, not by the build: a bundler that rewrote the module graph " +
  "would still produce a derivable closure, so the generator has nothing to fail on. `fit-42` " +
  "compares against the committed closure-graph baseline instead. Bundler invocations outside " +
  "`package.json#scripts` — workflow steps, `Bun.build({ outdir })`, calls from `scripts/*.ts` " +
  "— are out of scope for the disjointness check.";

const LINK_DEGRADES =
  "On a `bun link` install the manifest is fully self-asserted — the same build produced both " +
  "the bytes and the digests — so verification degrades to a build-consistency check: a " +
  "wrong-artefact detector and nothing more.";

const ENTRY_24_REASON =
  '`package.json` is entry #24 because its `"type": "module"` field governs the parse mode of ' +
  'all 23 closure files: flipping it to `"commonjs"` reinterprets every hashed byte without ' +
  "editing one. It is **not** included because of `packageRootFor()` — hashing content cannot " +
  "constrain a topology walk.";

const C2_RESIDUAL =
  "A planted `dist/package.json` terminates `packageRootFor()`'s upward walk early and " +
  "reinterprets parse mode with **zero digest change**: a manifest is an inclusion list and " +
  "cannot express absence. The engine closed this on their side with a rule that no " +
  "`package.json` may exist strictly between the runner entry and the package root; `fit-42` " +
  "stops the SDK being the source of the file.";

const PORTABILITY_ANSWER =
  "One manifest per published package, no per-platform map. The build is plain `tsc`, 1:1 " +
  "file-per-source, with no platform conditionals, no env branching and no conditional subpath " +
  "resolution inside the closure.";

const SECURITY_SUBSECTION_HEADING = "## Runner integrity manifest";

const SECURITY_SUBSECTION =
  "Published releases carry `dist/runner-manifest.json`, which lets the engine check that the " +
  "runner's pre-factory bootstrap — 23 files plus `package.json` — is the code we published. " +
  "It is not a sandbox, not a signature, and not a check on the dialect, op-pack, or " +
  "`node_modules` code that loads afterwards; those remain governed by the trust model above. " +
  "See [docs/runner-integrity-invariants.md](./docs/runner-integrity-invariants.md).";

const PROBE_HEADER_SENTENCE =
  "Constraint 4 (docs/runner-integrity-invariants.md) makes this ENFORCED, not conventional: " +
  "any `createRequire` reference outside this anchored site fails the build (fit-42).";

// The engine's ORIGINAL, unresolved wording for Constraint 2. Ambiguity D resolved it to a
// per-SITE rule and RP-3b proves the build enforces that; the page must not ship the looser
// form our own tripwire is stricter than.
const ENGINE_UNRESOLVED_CONSTRAINT_2 = "infrastructure path";

// --- Structural parse of the Constraints list ---------------------------------------------

interface ConstraintEntry {
  readonly number: number;
  readonly name: string;
  readonly heading: string;
  readonly enforcedBy: string | undefined;
}

const CONSTRAINT_HEADING = /^###\s+Constraint\s+(\d+)\s*(?:\([^)]*\))?\s+—\s+(.+)$/;

function parseConstraints(markdown: string): ConstraintEntry[] {
  const lines = markdown.split("\n");
  const entries: ConstraintEntry[] = [];
  for (const [index, line] of lines.entries()) {
    const match = CONSTRAINT_HEADING.exec(line);
    if (match === null) continue;
    const body = lines.slice(index + 1).join("\n").split(/^###\s/m)[0] ?? "";
    const enforced = /^\s*-\s*enforced-by:\s*(\S+)\s*$/m.exec(body);
    entries.push({
      number: Number(match[1]),
      name: match[2] as string,
      heading: line,
      enforcedBy: enforced?.[1],
    });
  }
  return entries;
}

// `fit-42` resolves iff a test/fitness/fit-42-*.test.ts is on disk. Resolved structurally,
// never by prose match — a page naming a fitness file that does not exist is the exact
// "prose passes, code doesn't" escape this check closes.
function enforcementResolves(value: string): boolean {
  if (value === "engine-owned") return true;
  return readdirSync(FITNESS_DIR).some(
    (file) => file.startsWith(`${value}-`) && file.endsWith(".test.ts")
  );
}

describe("REQ-IID-01 — five Constraints, each structurally enforced", () => {
  it("IID-01.1: the page lists exactly five Constraints", () => {
    const constraints = parseConstraints(doc());
    expect(constraints.map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("IID-01.1: every Constraint carries an enforced-by field", () => {
    const constraints = parseConstraints(doc());
    expect(constraints.length).toBe(5);
    expect(constraints.filter((entry) => entry.enforcedBy === undefined)).toEqual([]);
  });

  it("IID-01.1: every enforced-by resolves to a file on disk or the literal engine-owned", () => {
    const constraints = parseConstraints(doc());
    expect(constraints.length).toBe(5);
    const unresolved = constraints
      .filter((entry) => !enforcementResolves(entry.enforcedBy as string))
      .map((entry) => `${entry.heading} -> ${entry.enforcedBy}`);
    expect(unresolved).toEqual([]);
  });

  // Non-vacuity: the resolver must be capable of rejecting, or the check above is theatre.
  it("IID-01.1: the resolver rejects a fitness id with no file on disk", () => {
    expect(enforcementResolves("fit-99")).toBe(false);
    expect(enforcementResolves("fit-42")).toBe(true);
  });

  it("IID-01.2: Constraint 2 is stated in its resolved site-scoped form", () => {
    const constraint2 = parseConstraints(doc()).find((entry) => entry.number === 2);
    expect(constraint2?.name).toContain("SITE");
  });

  it("IID-01.2: the engine's unresolved `infrastructure path` wording is absent", () => {
    expect(doc()).not.toContain(ENGINE_UNRESOLVED_CONSTRAINT_2);
  });

  it("IID-01.3: Constraints 4 and 5 are marked SDK-added and engine-owned on first use", () => {
    const constraints = parseConstraints(doc());
    expect(constraints.find((entry) => entry.number === 4)?.heading).toContain("SDK-added");
    expect(constraints.find((entry) => entry.number === 5)?.heading).toContain("engine-owned");
  });

  // Cross-repo numbering can diverge silently, so a reader must never meet a number before
  // its name: the FIRST mention of each Constraint is required to be its named heading.
  it("IID-01.3: no Constraint is cited by bare number before its named heading", () => {
    const markdown = doc();
    const premature: string[] = [];
    for (const number of [1, 2, 3, 4, 5]) {
      const firstMention = markdown.indexOf(`Constraint ${number}`);
      const namedHeading = new RegExp(
        `^###\\s+Constraint\\s+${number}\\s*(?:\\([^)]*\\))?\\s+—`,
        "m"
      ).exec(markdown);
      expect(namedHeading).not.toBeNull();
      const heading = namedHeading as RegExpExecArray;
      const headingCitation = heading.index + heading[0].indexOf("Constraint");
      if (firstMention !== headingCitation) premature.push(`Constraint ${number}`);
    }
    expect(premature).toEqual([]);
  });
});

describe("REQ-IID-02 — honest scope", () => {
  it("IID-02.1: all five excluded trees are named", () => {
    const markdown = doc();
    expect(EXCLUDED_TREES.length).toBe(5);
    expect(EXCLUDED_TREES.filter((tree) => !markdown.includes(tree))).toEqual([]);
  });

  it("IID-02.1: the `means one specific thing` sentence is present verbatim", () => {
    expect(flat(doc())).toContain(flat(SCOPE_MEANS_ONE_THING));
  });

  it("IID-02.2: the supplied pull-quote appears exactly once", () => {
    expect(flat(doc()).split(flat(SCOPE_PULL_QUOTE)).length - 1).toBe(1);
  });
});

describe("REQ-IID-03 — the justification states the real value", () => {
  it("carries the `not ceremony … three ways` sentence verbatim", () => {
    expect(flat(doc())).toContain(flat(NOT_CEREMONY));
  });

  it("labels value #1 wrong-artefact detection, never bare `tamper detection`", () => {
    expect(flat(doc())).toContain("Wrong-artefact detection");
  });

  it("states the tripwires do not depend on the manifest existing", () => {
    expect(flat(doc())).toContain(flat(TRIPWIRES_INDEPENDENT));
  });

  it("names the install-script adversary the engine's model excludes", () => {
    expect(flat(doc())).toContain(flat(INSTALL_SCRIPT_ADVERSARY));
  });
});

describe("REQ-IID-04..07 — portability, entry #24, bun link, and the known gaps", () => {
  it("IID-04: records one manifest per published package with its evidence", () => {
    expect(flat(doc())).toContain(flat(PORTABILITY_ANSWER));
  });

  it("IID-05: justifies entry #24 by `type: module`, and rules out packageRootFor()", () => {
    expect(flat(doc())).toContain(flat(ENTRY_24_REASON));
  });

  it("IID-06: states that a bun link install degrades to a build-consistency check", () => {
    expect(flat(doc())).toContain(flat(LINK_DEGRADES));
  });

  it("IID-07: records the C2 residual and that the engine closed it on their side", () => {
    expect(flat(doc())).toContain(flat(C2_RESIDUAL));
  });

  it("BDI-01.2: states Constraint 1's CI-only limit and the out-of-scope bundler surfaces", () => {
    expect(flat(doc())).toContain(flat(LIMIT_CONSTRAINT_1));
  });
});

describe("REQ-IID-08 + docs index + SECURITY.md", () => {
  it("IID-08: the probe header carries the frozen pointer sentence, before any import", () => {
    const probe = readFileSync(PROBE_PATH, "utf-8");
    const headerEnd = probe.indexOf("\nimport ");
    expect(headerEnd).toBeGreaterThan(0);
    expect(flatComment(probe.slice(0, headerEnd))).toContain(flat(PROBE_HEADER_SENTENCE));
  });

  it("the docs index links the page under Contributor notes", () => {
    const index = readFileSync(DOCS_INDEX_PATH, "utf-8");
    const contributorNotes = index.slice(index.indexOf("## Contributor notes"));
    expect(index).toContain("## Contributor notes");
    expect(contributorNotes).toContain("./runner-integrity-invariants.md");
  });

  it("SECURITY.md carries the three-sentence subsection verbatim, under its own heading", () => {
    const security = readFileSync(SECURITY_PATH, "utf-8");
    expect(security).toContain(SECURITY_SUBSECTION_HEADING);
    expect(flat(security)).toContain(flat(SECURITY_SUBSECTION));
  });
});

// ===========================================================================================
// S-005 — REQ-DLV-01: the doc's own closure/file-count claims are checked against
// `deriveRunnerClosure`'s LIVE output, never a hardcoded literal committed in this test (R1-11).
// The templates below carry the surrounding PROSE frozen (mirroring every other frozen-string
// check above); only the NUMBER inside each is supplied by the live derivation at test-run time
// — "23"/"24" never appear as literals anywhere in this describe block.
// ===========================================================================================

interface CountClaimTemplate {
  readonly label: string;
  readonly render: (n: number) => string;
}

// Every claim below is either the TOTAL manifest entry count (23 closure files + package.json)
// or the CLOSURE file count on its own — both derived from the same live closureFileCount.
const TOTAL_ENTRY_CLAIMS: CountClaimTemplate[] = [
  { label: "`lists N files:` opening claim", render: (n) => `lists ${n} files: the` },
  { label: "`Hashing our own N files` justification aside", render: (n) => `Hashing our own ${n} files does` },
  {
    label: "`verifying N digests` closure-sealing-lemma framing",
    render: (n) => `verifying ${n} digests is equivalent`,
  },
  { label: "`entry #N because` heading justification", render: (n) => `entry #${n} because` },
];

const CLOSURE_FILE_CLAIMS: CountClaimTemplate[] = [
  { label: "`the N emitted .js files` opening claim", render: (n) => `the ${n} emitted \`.js\` files` },
  { label: "`N closure files plus package.json` pull-quote", render: (n) => `${n} closure files plus` },
  { label: "`all N closure files:` entry-#24 justification", render: (n) => `all ${n} closure files:` },
];

interface CountMismatch {
  readonly label: string;
  readonly liveValue: number;
}

// Structural, not prose: every claim renders against the LIVE value and is checked for
// presence — a doc that drifts from the real closure size (or a mutant with one count
// changed) fails to contain the correctly-rendered phrase and is reported by label plus the
// live value it should have matched, per REQ-DLV-01.2's own acceptance wording.
function findStaleCountClaims(markdown: string, closureFileCount: number): CountMismatch[] {
  const flatMarkdown = flat(markdown);
  const totalEntryCount = closureFileCount + 1;
  const mismatches: CountMismatch[] = [];
  for (const claim of TOTAL_ENTRY_CLAIMS) {
    if (!flatMarkdown.includes(claim.render(totalEntryCount))) {
      mismatches.push({ label: claim.label, liveValue: totalEntryCount });
    }
  }
  for (const claim of CLOSURE_FILE_CLAIMS) {
    if (!flatMarkdown.includes(claim.render(closureFileCount))) {
      mismatches.push({ label: claim.label, liveValue: closureFileCount });
    }
  }
  return mismatches;
}

describe("REQ-DLV-01 — documentation counts derived from the live derivation, never frozen", () => {
  let closureFileCount: number;

  beforeAll(() => {
    const distDir = ensureTscBuild();
    closureFileCount = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH).nodes.length;
  });

  // Non-vacuity: the checks below only mean something if the live closure has a real,
  // non-zero size to compare against.
  it("DLV-01.1: the live derivation yields a non-zero closure file count", () => {
    expect(closureFileCount).toBeGreaterThan(0);
  });

  it("DLV-01.1: every count claim in the doc matches the live derivation, exactly", () => {
    expect(findStaleCountClaims(doc(), closureFileCount)).toEqual([]);
  });

  it("DLV-01.2 [red-proof]: a mutant total-entry count is caught, naming the claim and the live value", () => {
    const mutant = doc().replace("entry #24 because", "entry #25 because");
    expect(findStaleCountClaims(mutant, closureFileCount)).toEqual([
      { label: "`entry #N because` heading justification", liveValue: closureFileCount + 1 },
    ]);
  });

  // Sibling red-proof: the check above only exercises the TOTAL-entry leg; a mutant on the
  // CLOSURE-file leg is caught independently, proving both templates arrays are live, not one.
  it("DLV-01.2 [red-proof]: a mutant closure-file count is caught, naming the claim and the live value", () => {
    const mutant = doc().replace("23 closure files plus", "22 closure files plus");
    expect(findStaleCountClaims(mutant, closureFileCount)).toEqual([
      { label: "`N closure files plus package.json` pull-quote", liveValue: closureFileCount },
    ]);
  });
});
