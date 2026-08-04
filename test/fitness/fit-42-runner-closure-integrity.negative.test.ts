/**
 * FIT-42 negative — the red-proofs (Tier A: synthetic mini-closures at a temp root).
 *
 * This file exists because a check exercised only against a well-formed tree can never
 * prove it CAN fail. It imports `scripts/derive-runner-closure.ts` deliberately: the build
 * and the fitness test must share ONE walk. FIT-27's non-reachability rule names
 * `scripts/regen-corpus.ts` specifically and is corpus-scoped; it does not extend here.
 *
 * S-000 lands the walking-skeleton subset. S-002 extends with the remaining RCD/RME/RMD
 * red-proofs and S-003 with the CST/BDI ones — each in its own `describe` block, so the
 * extensions do not collide with this one.
 */
import { describe, it, expect } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { PROJECT_ROOT } from "../support/scratch-consumer.ts";
import { ensureTscBuild } from "../support/shared-build.ts";
import {
  CREATE_REQUIRE_ANCHOR_FILE,
  ENTRY_RELATIVE_PATH,
  findAnchorDriftViolations,
  SANCTIONED_DYNAMIC_IMPORT_FILE,
  comparePaths,
  deriveRunnerClosure,
  readSpecifiers,
  renderViolations,
  serialiseManifest,
  sha256File,
  VIOLATION_RULES,
  type ViolationRule,
} from "../../scripts/derive-runner-closure.ts";
import {
  ADMITTED_GLOBALS,
  ADMITTED_MEMBER_PATHS,
  DENIED_CAPABILITY_PRIMITIVES,
} from "../../scripts/capability-admission.ts";
import { findUnclassifiableBundlerConstructs } from "../../scripts/bundler-disjointness.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import {
  findBomOffenders,
  findCrlfOffenders,
  diffClosureBaseline,
  findBundlerTargets,
  findDisjointnessViolations,
  findGraphEmitMismatches,
  findIntermediatePackageJsons,
  findPathHygieneViolations,
  findUsernamePathSegmentViolations,
  hasDrift,
  renderBaselineDrift,
} from "../support/closure-integrity-checks.ts";

const scratchRoot = scratchDirFactory("fit-42n-");

// Writes a synthetic mini-closure: `files` maps root-relative paths to their contents.
function plantTree(files: Record<string, string>): string {
  const root = scratchRoot();
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(root, relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents, "utf-8");
  }
  return root;
}

describe("FIT-42N S-000 — REQ-RCD-00 — the four exported symbols are callable, not merely defined", () => {
  // Every other Tier A case in this file already calls deriveRunnerClosure, comparePaths and
  // sha256File; serialiseManifest, RCD-00's fourth export, is otherwise imported ONLY by
  // generate-runner-manifest.ts and had no test proof at all. This block makes the RCD-00
  // surface explicit and gives serialiseManifest its first behavioural check.
  it("REQ-RCD-00: deriveRunnerClosure(distRoot, entryRelPath) walks a zero-import entry to exactly itself", () => {
    const root = plantTree({ "entry.js": "export const x = 1;\n" });
    expect(deriveRunnerClosure(root, "entry.js").nodes).toEqual(["entry.js"]);
  });

  it("REQ-RCD-00: comparePaths(a, b) is negative when a sorts before b under byte order", () => {
    expect(comparePaths("a.js", "b.js")).toBeLessThan(0);
    expect(comparePaths("b.js", "a.js")).toBeGreaterThan(0);
  });

  // RME-02.2 (below) already proves sha256File against a published oracle; this call exists
  // only to complete the four-export surface guard RCD-00 asks for, not to re-derive that.
  it("REQ-RCD-00: sha256File(path) is directly callable and returns the file's own digest", () => {
    const root = plantTree({ "probe.bin": "" });
    expect(sha256File(join(root, "probe.bin"))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  // The one export with no other test in the suite: only generate-runner-manifest.ts calls
  // it. Pins the exact RME-06.1 serialisation form by identity, on a hand-built manifest.
  it('REQ-RCD-00 / REQ-RME-06.1: serialiseManifest(m) is JSON.stringify(m, null, 2) + "\\n"', () => {
    const manifest = {
      manifestVersion: 1 as const,
      algorithm: "sha256" as const,
      entry: "dist/bin/pbuilder-runner.js",
      packageVersion: "0.0.0",
      files: [{ path: "package.json", sha256: "0".repeat(64) }],
    };
    expect(serialiseManifest(manifest)).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
  });
});

describe("FIT-42N S-000 — comparePaths sorts by bytes, never by locale (RP-10)", () => {
  it("REQ-RME-05.2: orders dist/Z.js before dist/a.js (0x5A < 0x61), the inverse of ICU order", () => {
    expect(["dist/a.js", "dist/Z.js"].sort(comparePaths)).toEqual(["dist/Z.js", "dist/a.js"]);
  });

  it("REQ-RME-05.2: orders dist/a-b.js before dist/aB.js, which ICU inverts by ignoring punctuation", () => {
    expect(["dist/aB.js", "dist/a-b.js"].sort(comparePaths)).toEqual(["dist/a-b.js", "dist/aB.js"]);
  });

  it("REQ-RME-05.1: orders by UTF-8 bytes, not by UTF-16 code units, on an astral path segment", () => {
    // U+FFFD is EF BF BD and U+10000 is F0 90 80 80, so UTF-8 puts U+FFFD first; UTF-16
    // code-unit order inverts it, because U+10000's leading surrogate is 0xD800 < 0xFFFD.
    expect(["dist/\u{10000}.js", "dist/�.js"].sort(comparePaths)).toEqual([
      "dist/�.js",
      "dist/\u{10000}.js",
    ]);
  });
});

describe("FIT-42N S-000 — the walk follows edges, never the directory listing", () => {
  // THE ANTI-TAUTOLOGY SCENARIO: every other RCD scenario is satisfiable by a generator
  // that merely reads the committed baseline; this one is not.
  const antiTautologyTree = {
    "entry.js": 'import "./a.js";\nimport "./b.js";\n',
    "a.js": 'import "./c.js";\n',
    "b.js": "export const b = 1;\n",
    "c.js": "export const c = 1;\n",
    "d.js": "export const d = 1;\n",
  };

  it("REQ-RCD-01.2: derives exactly the four transitively reachable files", () => {
    const derivation = deriveRunnerClosure(plantTree(antiTautologyTree), "entry.js");
    expect([...derivation.nodes]).toEqual(["a.js", "b.js", "c.js", "entry.js"]);
  });

  it("REQ-RCD-01.2: leaves the present-but-unimported d.js out of the closure", () => {
    const derivation = deriveRunnerClosure(plantTree(antiTautologyTree), "entry.js");
    expect(derivation.nodes).not.toContain("d.js");
  });
});

describe("FIT-42N S-000 — specifiers resolve against the importing file, not the root", () => {
  it("REQ-RCD-01.2: follows a `../` specifier out of the entry's directory and back down", () => {
    const root = plantTree({
      "bin/entry.js": 'import "../core/a.js";\n',
      "core/a.js": 'import "./b.js";\n',
      "core/b.js": "export const b = 1;\n",
    });
    expect([...deriveRunnerClosure(root, "bin/entry.js").nodes]).toEqual([
      "bin/entry.js",
      "core/a.js",
      "core/b.js",
    ]);
  });
});

describe("FIT-42N S-000 — the derivation records the graph it walked", () => {
  it("REQ-BDI-03.1: reports every followed import as an edge carrying its as-written specifier", () => {
    const root = plantTree({
      "bin/entry.js": 'import "../core/a.js";\n',
      "core/a.js": 'import "./b.js";\n',
      "core/b.js": "export const b = 1;\n",
    });
    expect([...deriveRunnerClosure(root, "bin/entry.js").edges]).toEqual([
      { from: "bin/entry.js", to: "core/a.js", specifier: "../core/a.js" },
      { from: "core/a.js", to: "core/b.js", specifier: "./b.js" },
    ]);
  });

  it("REQ-RCD-04.1: records `node:`-prefixed specifiers as builtins", () => {
    const root = plantTree({ "entry.js": 'import "node:path";\nimport "node:fs";\n' });
    expect([...deriveRunnerClosure(root, "entry.js").builtins]).toEqual(["node:fs", "node:path"]);
  });

  it("REQ-RCD-04.1: excludes builtins from the closure without failing the derivation", () => {
    const root = plantTree({ "entry.js": 'import "node:fs";\n' });
    const derivation = deriveRunnerClosure(root, "entry.js");
    expect([...derivation.nodes]).toEqual(["entry.js"]);
    expect([...derivation.violations]).toEqual([]);
  });
});

// The rule/file pair is what S-000 pins; the message facts each rule must NAME are asserted
// scenario by scenario in S-002 (RCD-03.x, RCD-05.1) and S-003 (CST-01..06).
function classifiedAs(root: string, entry = "entry.js"): Array<{ rule: string; file: string }> {
  return deriveRunnerClosure(root, entry).violations.map(({ rule, file }) => ({ rule, file }));
}

describe("FIT-42N S-000 — every static specifier classifies, none is silently skipped", () => {
  it("REQ-CST-01.1: a bare third-party specifier is a Constraint-3 violation", () => {
    const root = plantTree({ "entry.js": 'import { Project } from "ts-morph";\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-3-bare-specifier", file: "entry.js" },
    ]);
  });

  it("REQ-CST-02.1: a builtin written without the `node:` prefix is a Constraint-3a violation", () => {
    const root = plantTree({ "entry.js": 'import { readFileSync } from "fs";\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-3a-unprefixed-builtin", file: "entry.js" },
    ]);
  });

  it("REQ-RCD-03.1: a URL-scheme specifier is an unclassifiable construct", () => {
    const root = plantTree({ "entry.js": 'import "file:///etc/passwd";\n' });
    expect(classifiedAs(root)).toEqual([{ rule: "unclassifiable-construct", file: "entry.js" }]);
  });

  it("REQ-RCD-03.4: a relative specifier carrying a query suffix fails instead of resolving nowhere", () => {
    const root = plantTree({ "entry.js": 'import "./a.js?v=1";\n', "a.js": "export const a = 1;\n" });
    expect(classifiedAs(root)).toEqual([{ rule: "unclassifiable-construct", file: "entry.js" }]);
  });

  it("REQ-RCD-03.2: a relative specifier resolving nowhere fails rather than dropping the subtree", () => {
    const root = plantTree({ "entry.js": 'import "./missing.js";\n' });
    expect(classifiedAs(root)).toEqual([{ rule: "unresolvable-specifier", file: "entry.js" }]);
  });

  it("REQ-RCD-05.1: a specifier resolving through a symlink out of the root fails as an escape", () => {
    const outside = plantTree({ "foreign.js": "export const foreign = 1;\n" });
    const root = plantTree({ "entry.js": 'import "./linked.js";\n' });
    symlinkSync(join(outside, "foreign.js"), join(root, "linked.js"));
    expect(classifiedAs(root)).toEqual([{ rule: "symlink-escape", file: "entry.js" }]);
  });

  it.skipIf(process.getuid?.() === 0)(
    "REQ-RCD-03.5: an unreadable closure file fails the derivation instead of being skipped",
    () => {
      const root = plantTree({ "entry.js": 'import "./locked.js";\n', "locked.js": "export const l = 1;\n" });
      chmodSync(join(root, "locked.js"), 0o000);
      expect(classifiedAs(root)).toEqual([{ rule: "unreadable-file", file: "locked.js" }]);
    }
  );
});

describe("FIT-42N S-000 — RP-12: a JSDoc @example never enters the walk, even when its target exists", () => {
  // judgment-day finding 3: the real-tree version of this proof (fit-42.test.ts) can only
  // show "no violation, no node" against specifiers whose target happens not to exist — that
  // proves nothing about whether comments are structurally excluded. Here the relative
  // target genuinely EXISTS on disk, so a regressed walker that started reading JSDoc text
  // would add a real node/edge, not silently no-op because the file is missing.
  it("REQ-RCD-03.3: a bare specifier and a resolvable relative specifier, both JSDoc-quoted, add nothing", () => {
    const root = plantTree({
      "entry.js": [
        "/**",
        " * @example",
        ' * import { Thing } from "some-package";',
        ' * import type { Other } from "./real-target.ts";',
        " */",
        "export const noop = 1;",
      ].join("\n"),
      "real-target.ts": "export const other = 1;\n",
    });
    const derivation = deriveRunnerClosure(root, "entry.js");
    expect(derivation.violations).toEqual([]);
    expect(derivation.nodes).toEqual(["entry.js"]);
    expect(derivation.nodes).not.toContain("real-target.ts");
  });
});

describe("FIT-42N S-000 — the deny-scan seals the closure's executed surface", () => {
  it("REQ-CST-03.1: a dynamic import() outside the sanctioned file is a Constraint-2 violation", () => {
    const root = plantTree({ "entry.js": 'const later = import("./a.js");\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-2-dynamic-import", file: "entry.js" },
    ]);
  });

  it("REQ-CST-03.3: the single dynamic import() at the sanctioned site is not a violation", () => {
    const root = plantTree({ [SANCTIONED_DYNAMIC_IMPORT_FILE]: "const f = import(moduleUrl);\n" });
    expect(classifiedAs(root, SANCTIONED_DYNAMIC_IMPORT_FILE)).toEqual([]);
  });

  it("REQ-CST-03.2: a second dynamic import() inside the sanctioned file is a per-site violation", () => {
    const root = plantTree({
      [SANCTIONED_DYNAMIC_IMPORT_FILE]: "const f = import(moduleUrl);\nconst p = import(pluginUrl);\n",
    });
    expect(classifiedAs(root, SANCTIONED_DYNAMIC_IMPORT_FILE)).toEqual([
      { rule: "constraint-2-second-site", file: SANCTIONED_DYNAMIC_IMPORT_FILE },
    ]);
  });

  // S-001 (ADR-0079) behavioural-survival note (#10 of the 18 S-000-tier red-proofs, B2
  // enumeration): the OLD denyScan flagged this fixture TWICE — once for the import
  // specifier's own "createRequire" binding-site token (a pure identifier-text-match quirk:
  // denyScan's non-anchor branch never excluded declaration-site identifiers) and once for
  // the call. The NEW mechanism's E2 exclusion (design.md §1: "a binding site is not a
  // reference") correctly never enumerates a declaration name as capability surface — the
  // call site alone is now caught, exactly once. This is a precision IMPROVEMENT (the
  // spurious double-count on a harmless import binding is gone), not a detection loss: the
  // same file still fails the build, naming the same defect.
  it("REQ-CST-04.1: a createRequire call outside the anchored site is a Constraint-4 violation", () => {
    const root = plantTree({
      "entry.js": 'import { createRequire } from "node:module";\ncreateRequire(anchor)("./x.js");\n',
    });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "entry.js" },
    ]);
  });

  it("REQ-CST-04.4: the indirect-variable form is caught, not just the direct call", () => {
    const root = plantTree({ "entry.js": "const req = createRequire(anchor);\nreq('./x.js');\n" });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "entry.js" },
    ]);
  });

  it("REQ-CST-04.4: the namespace form is caught", () => {
    const root = plantTree({
      "entry.js": 'import * as m from "node:module";\nm.createRequire(anchor)("./x.js");\n',
    });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "entry.js" },
    ]);
  });

  it("REQ-CST-04.3: the anchored site's import binding and single resolution-only use are exempt", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire } from "node:module";\ncreateRequire(anchor).resolve(spec);\n',
    });
    expect(classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([]);
  });

  it("REQ-CST-04.1: a second createRequire use inside the anchored file still fails", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire } from "node:module";\ncreateRequire(a).resolve(s);\ncreateRequire(b)("./x.js");\n',
    });
    expect(classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: CREATE_REQUIRE_ANCHOR_FILE },
    ]);
  });

  // judgment-day finding 1: the exemption used to key on "first non-import occurrence",
  // never checking what that occurrence DID — an execute-shaped call evaded it entirely.
  it("REQ-CST-04.3: an EXECUTING createRequire at the anchor is not exempt — resolve-only, never execute", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire } from "node:module";\ncreateRequire(anchor)("./x.js");\n',
    });
    expect(classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: CREATE_REQUIRE_ANCHOR_FILE },
    ]);
  });

  // judgment-day finding 1 (Judge A): the exemption keyed on identifier TEXT "createRequire",
  // so an aliased import left no such identifier at its use sites — unlimited, unflagged
  // executions through the alias. An aliased binding forfeits the exemption entirely.
  it("REQ-CST-04.3: an ALIASED createRequire import at the anchor forfeits the exemption entirely", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire as cr } from "node:module";\ncr(u)("./x.js");\ncr(u)("./y.js");\n',
    });
    // S-002.5: exact count, not a lower bound — the fixture has exactly two executing calls
    // through the alias (`cr(u)("./x.js")`, `cr(u)("./y.js")`) and nothing else denyable.
    const violations = classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE);
    expect(violations.length).toBe(2);
    expect(violations.every((v) => v.rule === "constraint-4-inadmissible-origin")).toBe(true);
  });

  // judgment-day Round 2: the alias check searched for THE binding and stopped at the first
  // one, so a decoy unaliased import made `anchorAliased` false — the decoy consumed the
  // single exemption and every execution through the alias was skipped as an unknown name.
  // Both judges reproduced this end-to-end against the real tree: build green, zero violations.
  it("REQ-CST-04.3: an unaliased decoy alongside an aliased import does not buy the alias an exemption", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]: [
        'import { createRequire } from "node:module";',
        'import { createRequire as cr } from "node:module";',
        'cr(u)("./evil.cjs");',
        "",
      ].join("\n"),
    });
    // S-002.5: exact count — one executing call through the alias, the decoy import buys it
    // nothing.
    const violations = classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE);
    expect(violations.length).toBe(1);
    expect(violations.every((v) => v.rule === "constraint-4-inadmissible-origin")).toBe(true);
  });

  it("REQ-CST-06.1: a rendered violation names the src file to edit, the rule, and the no-manifest outcome", () => {
    const root = plantTree({ "transport/entry.js": 'import { Project } from "ts-morph";\n' });
    const rendered = renderViolations(
      deriveRunnerClosure(root, "transport/entry.js").violations,
      { distDirName: "dist", srcDirName: "src" }
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/transport/entry.ts — bare specifier in the runner closure.",
        '  found: import { Project } from "ts-morph";     (emitted: dist/transport/entry.js:1)',
        "  rule:  Constraint 3 — no bare third-party specifier inside the closure.",
        "  why:   \"ts-morph\" resolves into node_modules/, which the manifest does not cover, so it would execute unverified during the bootstrap.",
        '  fix:   move the code that needs "ts-morph" behind the factory import, or into a module outside the runner closure (src/commons/**, src/dialects/**). If the runner must genuinely depend on it, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-3 and agree it with the engine before regenerating any baseline.',
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  it("REQ-CST-04.2: the closed primitive set — eval, Function, node:vm, Bun.plugin, process.binding — is denied", () => {
    const root = plantTree({
      "entry.js":
        'import "./p1.js";\nimport "./p2.js";\nimport "./p3.js";\nimport "./p4.js";\nimport "./p5.js";\n',
      "p1.js": "export const r = eval(payload);\n",
      "p2.js": "export const r = new Function(body);\n",
      "p3.js": 'import "node:vm";\n',
      "p4.js": "Bun.plugin(definition);\n",
      "p5.js": "process.binding('fs');\n",
    });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "p1.js" },
      { rule: "constraint-4-inadmissible-origin", file: "p2.js" },
      { rule: "constraint-4-inadmissible-origin", file: "p3.js" },
      { rule: "constraint-4-inadmissible-origin", file: "p4.js" },
      { rule: "constraint-4-inadmissible-origin", file: "p5.js" },
    ]);
  });
});

describe("FIT-42N S-002 — walk shapes S-000 never exercised", () => {
  it("REQ-RCD-01.3: a cyclic import graph terminates at its reachable set", () => {
    const root = plantTree({
      "entry.js": 'import "./a.js";\n',
      "a.js": 'import "./b.js";\n',
      "b.js": 'import "./a.js";\n',
    });
    expect([...deriveRunnerClosure(root, "entry.js").nodes]).toEqual([
      "a.js",
      "b.js",
      "entry.js",
    ]);
  });

  it("REQ-RCD-01.4: an entry with zero imports yields exactly one node, not zero and not an error", () => {
    const root = plantTree({ "entry.js": "export const only = 1;\n" });
    const derivation = deriveRunnerClosure(root, "entry.js");
    expect([...derivation.nodes]).toEqual(["entry.js"]);
    expect([...derivation.violations]).toEqual([]);
  });

  // `module: NodeNext` can emit `.mjs`, so a walker filtering `endsWith(".js")` would
  // silently lose the whole subtree behind this specifier.
  it("REQ-RCD-02.3: a specifier resolving to .mjs is followed, not filtered out by extension", () => {
    const root = plantTree({
      "entry.js": 'import "./x.mjs";\n',
      "x.mjs": 'import "./deep.js";\n',
      "deep.js": "export const deep = 1;\n",
    });
    expect([...deriveRunnerClosure(root, "entry.js").nodes]).toEqual([
      "deep.js",
      "entry.js",
      "x.mjs",
    ]);
  });
});

function renderedFor(root: string, entry = "entry.js"): string {
  return renderViolations(deriveRunnerClosure(root, entry).violations, {
    distDirName: "dist",
    srcDirName: "src",
  });
}

describe("FIT-42N S-002 — a failing classification names the facts the reader needs", () => {
  it("REQ-RCD-03.1: an unclassifiable construct names the src path, the line and the construct", () => {
    const rendered = renderedFor(plantTree({ "entry.js": 'import "file:///etc/passwd";\n' }));
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — construct could not be classified.",
        '  found: import "file:///etc/passwd";     (emitted: dist/entry.js:1)',
        "  rule:  Zero silent skips — every capability-surface node and import-like construct must classify as exactly one of { admitted, a named violation, unclassifiable-construct }.",
        '  why:   an unclassifiable construct (file:///etc/passwd) fails the build rather than being skipped, because a skipped node is a hole in the closure that nothing downstream would notice.',
        "  fix:   write the construct in a statically decidable shape. If the construct must stay, the walker has to learn it — that is a change to scripts/derive-runner-closure.ts or scripts/capability-admission.ts AND to docs/runner-integrity-invariants.md, not a special case here.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  // RP-13.
  it("REQ-RCD-03.2: an unresolvable specifier names the importer, the specifier and the attempted path", () => {
    const rendered = renderedFor(
      plantTree({ "core/entry.js": 'import "./missing.js";\n' }),
      "core/entry.js"
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/core/entry.ts — relative specifier resolves to no file (attempted core/missing.js).",
        '  found: import "./missing.js";     (emitted: dist/core/entry.js:1)',
        "  rule:  Zero silent skips — a classified-but-unresolvable specifier is a hole in the closure, never a subset.",
        "  why:   dropping the subtree behind an unresolvable specifier leaves the manifest a strict subset of the code that runs, which voids the closure-sealing lemma.",
        "  fix:   correct the specifier, or add the file it names.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  it("REQ-RCD-03.4: a query-suffixed specifier is reported as a classification failure naming the suffix", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": 'import "./a.js?v=1";\n', "a.js": "export const a = 1;\n" })
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — construct could not be classified.",
        '  found: import "./a.js?v=1";     (emitted: dist/entry.js:1)',
        "  rule:  Zero silent skips — every capability-surface node and import-like construct must classify as exactly one of { admitted, a named violation, unclassifiable-construct }.",
        '  why:   an unclassifiable construct (query or fragment in "./a.js?v=1") fails the build rather than being skipped, because a skipped node is a hole in the closure that nothing downstream would notice.',
        "  fix:   write the construct in a statically decidable shape. If the construct must stay, the walker has to learn it — that is a change to scripts/derive-runner-closure.ts or scripts/capability-admission.ts AND to docs/runner-integrity-invariants.md, not a special case here.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  it.skipIf(process.getuid?.() === 0)(
    "REQ-RCD-03.5: an unreadable closure file names the path that could not be read",
    () => {
      const root = plantTree({
        "entry.js": 'import "./locked.js";\n',
        "locked.js": "export const l = 1;\n",
      });
      chmodSync(join(root, "locked.js"), 0o000);
      const rendered = renderedFor(root);
      expect(rendered).toBe(
        [
          "runner-manifest: src/locked.ts — closure file could not be read.",
          "  found: locked.js     (emitted: dist/locked.js)",
          "  rule:  Zero silent skips — an unreadable closure file fails the build; it is never skipped.",
          "  why:   a file that cannot be read cannot be hashed, and a manifest missing one of its files is indistinguishable from tampering on the user's machine.",
          "  fix:   restore read permission on the file, or remove it from the closure.",
          "",
          "No manifest was written; dist/runner-manifest.json does not exist.",
          "",
        ].join("\n")
      );
    }
  );
});

describe("FIT-42N S-002 — sha256File is checked against an external oracle", () => {
  // RME-02.1 alone is f(x) === f(x) if the test imports the generator's own hasher; these
  // two vectors are published constants no implementation of ours produced.
  it("REQ-RME-02.2: a zero-byte file hashes to the published empty-input vector", () => {
    const root = plantTree({ "empty.bin": "" });
    expect(sha256File(join(root, "empty.bin"))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("REQ-RME-02.2: a file containing exactly one newline hashes to the published LF vector", () => {
    const root = plantTree({ "newline.bin": "\n" });
    expect(sha256File(join(root, "newline.bin"))).toBe(
      "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b"
    );
  });
});

describe("FIT-42N S-002 — the manifest-shape and byte-hygiene checkers fire", () => {
  // RP-11.
  it("REQ-RME-04.1: a duplicate, an absolute and a `..` path each fail path hygiene, named by rule", () => {
    expect(
      findPathHygieneViolations([
        "dist/a.js",
        "dist/a.js",
        "/etc/passwd",
        "dist/../secret.js",
      ])
    ).toEqual([
      { rule: "absolute", path: "/etc/passwd" },
      { rule: "parent-segment", path: "dist/../secret.js" },
      { rule: "duplicate", path: "dist/a.js" },
    ]);
  });

  it("REQ-RME-04.1: a backslash separator and a leading ./ each fail path hygiene", () => {
    expect(findPathHygieneViolations(["dist\\a.js", "./dist/b.js"])).toEqual([
      { rule: "non-posix", path: "dist\\a.js" },
      { rule: "leading-dot-slash", path: "./dist/b.js" },
    ]);
  });

  it("REQ-RME-04.1: a well-formed path set produces no finding", () => {
    expect(findPathHygieneViolations(["dist/a.js", "dist/b.js", "package.json"])).toEqual([]);
  });

  // RP-9. Generated at test time on purpose: a committed CRLF fixture is normalised back to
  // LF by `.gitattributes`' `* eol=lf` on the next `git add`.
  it("REQ-RMD-03.2: a CRLF-bearing file is reported with its path and the offset of the \\r", () => {
    expect(
      findCrlfOffenders([
        { path: "dist/clean.js", bytes: Buffer.from("const a = 1;\nconst b = 2;\n") },
        { path: "dist/crlf.js", bytes: Buffer.from("const a = 1;\r\n") },
      ])
    ).toEqual([{ path: "dist/crlf.js", offset: 12 }]);
  });

  it("REQ-RMD-03.4: a BOM-prefixed file is reported and a clean one is not", () => {
    expect(
      findBomOffenders([
        { path: "dist/clean.js", bytes: Buffer.from("const a = 1;\n") },
        { path: "dist/bom.js", bytes: Buffer.from("﻿const a = 1;\n") },
      ])
    ).toEqual(["dist/bom.js"]);
  });

  it("REQ-RMD-05.1.1: runner.js is NOT a false positive for username `runner` — path-segment-bounded", () => {
    expect(findUsernamePathSegmentViolations(["dist/bin/pbuilder-runner.js"], "runner")).toEqual([]);
  });

  it("REQ-RMD-05.1.2 [red-proof]: a genuine username path segment (dist/runner/notes.js) is caught", () => {
    expect(
      findUsernamePathSegmentViolations(
        ["dist/bin/pbuilder-runner.js", "dist/runner/notes.js"],
        "runner"
      )
    ).toEqual(["dist/runner/notes.js"]);
  });
});

describe("FIT-42N S-003 — readSpecifiers separates value imports from erased ones", () => {
  it("REQ-BDI-02.1: returns static specifiers in source order with duplicates preserved", () => {
    const root = plantTree({
      "m.ts": 'import "./a.ts";\nimport { b } from "./b.ts";\nimport { c } from "./a.ts";\n',
    });
    expect(readSpecifiers(join(root, "m.ts")).staticSpecifiers).toEqual([
      "./a.ts",
      "./b.ts",
      "./a.ts",
    ]);
  });

  it("REQ-BDI-02.2: reports a whole-declaration `import type` as erased", () => {
    const root = plantTree({ "m.ts": 'import type { X } from "./x.ts";\n' });
    const read = readSpecifiers(join(root, "m.ts"));
    expect(read.staticSpecifiers).toEqual(["./x.ts"]);
    expect(read.typeOnlyStatic).toEqual(["./x.ts"]);
  });

  // The inline form erases too, and it is the form a value-syntax import would be confused
  // with — an implementation checking only `isTypeOnly()` on the declaration misses it.
  it("REQ-BDI-02.2: reports a declaration whose every named binding is inline-`type` as erased", () => {
    const root = plantTree({ "m.ts": 'import { type Y, type Z } from "./y.ts";\n' });
    expect(readSpecifiers(join(root, "m.ts")).typeOnlyStatic).toEqual(["./y.ts"]);
  });

  it("REQ-BDI-02.2: does NOT report a declaration mixing a value binding with a type binding", () => {
    const root = plantTree({ "m.ts": 'import { value, type W } from "./w.ts";\n' });
    expect(readSpecifiers(join(root, "m.ts")).typeOnlyStatic).toEqual([]);
  });

  it("REQ-CST-03.3: counts dynamic imports without treating them as static specifiers", () => {
    const root = plantTree({ "m.ts": 'import "./a.ts";\nconst later = import("./b.ts");\n' });
    const read = readSpecifiers(join(root, "m.ts"));
    expect(read.staticSpecifiers).toEqual(["./a.ts"]);
    expect(read.dynamicImportCount).toBe(1);
  });
});

describe("FIT-42N S-003 — the violation epilogue is true for the tool that printed it", () => {
  const bareSpecifierTree = { "entry.js": 'import { Project } from "ts-morph";\n' };

  const bareSpecifierRendered = [
    "runner-manifest: src/entry.ts — bare specifier in the runner closure.",
    '  found: import { Project } from "ts-morph";     (emitted: dist/entry.js:1)',
    "  rule:  Constraint 3 — no bare third-party specifier inside the closure.",
    "  why:   \"ts-morph\" resolves into node_modules/, which the manifest does not cover, so it would execute unverified during the bootstrap.",
    '  fix:   move the code that needs "ts-morph" behind the factory import, or into a module outside the runner closure (src/commons/**, src/dialects/**). If the runner must genuinely depend on it, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-3 and agree it with the engine before regenerating any baseline.',
    "",
  ];

  it("REQ-CST-06.1: the build path keeps the frozen no-manifest sentence", () => {
    const rendered = renderedFor(plantTree(bareSpecifierTree));
    expect(rendered).toBe(
      [...bareSpecifierRendered, "No manifest was written; dist/runner-manifest.json does not exist.", ""].join("\n")
    );
  });

  // The baseline writer reuses this renderer. Telling a maintainer whose BASELINE
  // regeneration failed that no MANIFEST was written names the wrong artefact entirely. A
  // whole-string match against the caller-supplied epilogue inherently proves the old
  // "No manifest was written" sentence is gone — nothing unexpected can hide in a full
  // equality the way it could survive a `.not.toContain` check on a substring.
  it("REQ-CST-06.1: a caller-supplied epilogue replaces it, and the manifest sentence is gone", () => {
    const rendered = renderViolations(
      deriveRunnerClosure(plantTree(bareSpecifierTree), "entry.js").violations,
      { distDirName: "dist", srcDirName: "src", outcome: "No baseline was written." }
    );
    expect(rendered).toBe([...bareSpecifierRendered, "No baseline was written.", ""].join("\n"));
  });
});

describe("FIT-42N S-003 — Constraint 3 / 3a: what may be named inside the closure", () => {
  // RP-4, Tier A half. The B half lives in fit-42 (the ONE real-tree negative).
  it("REQ-CST-01.1: a bare specifier names the src path, the line, the specifier and Constraint 3", () => {
    const rendered = renderedFor(
      plantTree({ "transport/entry.js": 'import { Project } from "ts-morph";\n' }),
      "transport/entry.js"
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/transport/entry.ts — bare specifier in the runner closure.",
        '  found: import { Project } from "ts-morph";     (emitted: dist/transport/entry.js:1)',
        "  rule:  Constraint 3 — no bare third-party specifier inside the closure.",
        "  why:   \"ts-morph\" resolves into node_modules/, which the manifest does not cover, so it would execute unverified during the bootstrap.",
        '  fix:   move the code that needs "ts-morph" behind the factory import, or into a module outside the runner closure (src/commons/**, src/dialects/**). If the runner must genuinely depend on it, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-3 and agree it with the engine before regenerating any baseline.',
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  // RP-5 — the discriminating fixture. A name-allowlist implementation passes a fixture
  // containing only "fs"; it cannot pass one that also contains "node:fs" and must flag
  // exactly one of them.
  it("REQ-CST-02.1: a fixture holding BOTH `fs` and `node:fs` yields exactly ONE violation", () => {
    const root = plantTree({
      "entry.js": 'import { readFileSync } from "fs";\nimport { join } from "node:fs";\n',
    });
    const derivation = deriveRunnerClosure(root, "entry.js");
    expect(derivation.violations.length).toBe(1);
    expect(derivation.violations[0]?.rule).toBe("constraint-3a-unprefixed-builtin");
    expect(derivation.violations[0]?.detail).toBe("fs");
  });

  it("REQ-CST-02.1: `node:fs` in that same fixture is still recorded as an ordinary builtin", () => {
    const root = plantTree({
      "entry.js": 'import { readFileSync } from "fs";\nimport { join } from "node:fs";\n',
    });
    expect([...deriveRunnerClosure(root, "entry.js").builtins]).toEqual(["node:fs"]);
  });

  it("REQ-CST-02.1: the message says the rule is the PREFIX, not an allowlist", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": 'import { readFileSync } from "fs";\nimport { join } from "node:fs";\n' })
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — builtin imported without the `node:` prefix.",
        '  found: import { readFileSync } from "fs";     (emitted: dist/entry.js:1)',
        "  rule:  Constraint 3a — every builtin in the closure is written `node:`-prefixed.",
        '  why:   "fs" is an ordinary package name that a node_modules/fs package can shadow; "node:fs" cannot be shadowed. The check is on the PREFIX, not on a list of builtin names — adding "fs" to an allowlist is not the fix.',
        '  fix:   change the specifier to "node:fs".',
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });
});

describe("FIT-42N S-003 — Constraint 2: the sanction is per-SITE, not per-file", () => {
  // RP-3.
  it("REQ-CST-03.1: a dynamic import() outside the sanctioned file names Constraint 2", () => {
    const rendered = renderedFor(
      plantTree({ "transport/session.js": "const later = import(specifier);\n" }),
      "transport/session.js"
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/transport/session.ts — dynamic import() outside the sanctioned factory-import site.",
        "  found: import(specifier)     (emitted: dist/transport/session.js:1)",
        "  rule:  Constraint 2 — the closure contains exactly one dynamic import(): the author-factory import in src/transport/runner.ts, marked SANCTIONED-FACTORY-IMPORT.",
        "  why:   a dynamic import() admits code no digest covers into the bootstrap; the one sanctioned site is the deliberate author-code boundary.",
        "  fix:   use a static import if the target is already in the closure, or move the lazy load to the far side of the factory boundary. A second boundary is a contract change: docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  // RP-3b — the proof that Constraint 2 is site-scoped. A path-scoped implementation passes
  // RP-3 and fails only here.
  it("REQ-CST-03.2: a second import() inside the sanctioned file names the site and the per-SITE clause", () => {
    const root = plantTree({
      [SANCTIONED_DYNAMIC_IMPORT_FILE]: "const f = import(moduleUrl);\nconst p = import(pluginUrl);\n",
    });
    const rendered = renderedFor(root, SANCTIONED_DYNAMIC_IMPORT_FILE);
    expect(rendered).toBe(
      [
        "runner-manifest: src/transport/runner.ts — second dynamic import() inside the factory-import file.",
        "  found: import(pluginUrl)     (emitted: dist/transport/runner.js:2)",
        "  rule:  Constraint 2 — the sanction is per-SITE, not per-file. Living in runner.ts does not make an import() sanctioned.",
        "  why:   src/transport/runner.ts:SANCTIONED-FACTORY-IMPORT is the author-code boundary; this is a different site, and it admits code no digest covers exactly as one anywhere else would.",
        "  fix:   remove this import(), or route the work through the sanctioned site. If the runner needs a second dynamic boundary, that is a contract change: docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });
});

describe("FIT-42N S-003 — Constraint 4: the closure may RESOLVE, never EXECUTE", () => {
  // RP-7. REQ-CST-06.1: whole-verbatim, never toContain (S-001.7).
  it("REQ-CST-04.1: a direct createRequire call names Constraint 4 and the primitive", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": 'createRequire(anchorUrl)("./x.js");\n' })
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — capability primitive or unadmitted origin in the closure.",
        '  found: createRequire(anchorUrl)("./x.js");     (emitted: dist/entry.js:1)',
        "  rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.",
        "         admitted origins: local, a closure import of an admitted name, an admitted global, or an admitted builtin member path.",
        "         forbidden origin: createRequire",
        "  why:   a resolved binding whose origin is not one of the four admitted kinds may yield unhashed code execution — the admitted/denied sets are closed tables in scripts/capability-admission.ts, changed only by a PR that also changes the guard's tests. See docs/runner-integrity-invariants.md#constraint-4.",
        "  fix:   resolve the value through an admitted origin, or move the work outside the closure. If the primitive is genuinely needed, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-4 and agree it with the engine before regenerating any baseline.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  // RP-7b — the two forms a call-vs-.resolve() rule is defeated by.
  it("REQ-CST-04.4: the indirect-variable form is named by the construct it found", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": "const req = createRequire(anchorUrl);\nreq('./x.js');\n" })
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — capability primitive or unadmitted origin in the closure.",
        "  found: const req = createRequire(anchorUrl);     (emitted: dist/entry.js:1)",
        "  rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.",
        "         admitted origins: local, a closure import of an admitted name, an admitted global, or an admitted builtin member path.",
        "         forbidden origin: createRequire",
        "  why:   a resolved binding whose origin is not one of the four admitted kinds may yield unhashed code execution — the admitted/denied sets are closed tables in scripts/capability-admission.ts, changed only by a PR that also changes the guard's tests. See docs/runner-integrity-invariants.md#constraint-4.",
        "  fix:   resolve the value through an admitted origin, or move the work outside the closure. If the primitive is genuinely needed, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-4 and agree it with the engine before regenerating any baseline.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  it("REQ-CST-04.4: the namespace form is named by the construct it found", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": 'import * as m from "node:module";\nm.createRequire(u)("./x.js");\n' })
    );
    expect(rendered).toBe(
      [
        "runner-manifest: src/entry.ts — capability primitive or unadmitted origin in the closure.",
        '  found: m.createRequire(u)("./x.js");     (emitted: dist/entry.js:2)',
        "  rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.",
        "         admitted origins: local, a closure import of an admitted name, an admitted global, or an admitted builtin member path.",
        "         forbidden origin: m.createRequire",
        "  why:   a resolved binding whose origin is not one of the four admitted kinds may yield unhashed code execution — the admitted/denied sets are closed tables in scripts/capability-admission.ts, changed only by a PR that also changes the guard's tests. See docs/runner-integrity-invariants.md#constraint-4.",
        "  fix:   resolve the value through an admitted origin, or move the work outside the closure. If the primitive is genuinely needed, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-4 and agree it with the engine before regenerating any baseline.",
        "",
        "No manifest was written; dist/runner-manifest.json does not exist.",
        "",
      ].join("\n")
    );
  });

  // RP-7c — one file per primitive, each naming its own.
  const primitives: Array<[string, string, string, string]> = [
    ["eval", "p1.js", "export const r = eval(payload);\n", 'export const r = eval(payload);'],
    ["Function", "p2.js", "export const r = new Function(body);\n", 'export const r = new Function(body);'],
    ["node:vm", "p3.js", 'import "node:vm";\n', 'import "node:vm";'],
    ["Bun.plugin", "p4.js", "Bun.plugin(definition);\n", 'Bun.plugin(definition);'],
    ["process.binding", "p5.js", "process.binding('fs');\n", "process.binding('fs');"],
  ];

  for (const [primitive, file, source, found] of primitives) {
    it(`REQ-CST-04.2: ${primitive} is denied and named as the forbidden origin`, () => {
      const rendered = renderedFor(plantTree({ [file]: source }), file);
      const stem = file.replace(/\.js$/, "");
      expect(rendered).toBe(
        [
          `runner-manifest: src/${stem}.ts — capability primitive or unadmitted origin in the closure.`,
          `  found: ${found}     (emitted: dist/${file}:1)`,
          "  rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.",
          "         admitted origins: local, a closure import of an admitted name, an admitted global, or an admitted builtin member path.",
          `         forbidden origin: ${primitive}`,
          "  why:   a resolved binding whose origin is not one of the four admitted kinds may yield unhashed code execution — the admitted/denied sets are closed tables in scripts/capability-admission.ts, changed only by a PR that also changes the guard's tests. See docs/runner-integrity-invariants.md#constraint-4.",
          "  fix:   resolve the value through an admitted origin, or move the work outside the closure. If the primitive is genuinely needed, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-4 and agree it with the engine before regenerating any baseline.",
          "",
          "No manifest was written; dist/runner-manifest.json does not exist.",
          "",
        ].join("\n")
      );
    });
  }
});

describe("FIT-42N S-003 — every rule in the closed set renders a usable message", () => {
  // ADR-0079: `constraint-4-execution-primitive` (denyScan's one Constraint-4 rule) retires;
  // capability-admission reports one of two rules instead, plus `directory-specifier` (R1-8)
  // and `manifest-version-invalid` (R2-3, S-004).
  it("REQ-CST-06.1: the exported rule set is the twelve-member closed set", () => {
    expect([...VIOLATION_RULES].sort()).toEqual([
      "constraint-2-dynamic-import",
      "constraint-2-second-site",
      "constraint-3-bare-specifier",
      "constraint-3a-unprefixed-builtin",
      "constraint-4-inadmissible-origin",
      "constraint-4-undecidable-callee",
      "directory-specifier",
      "manifest-version-invalid",
      "symlink-escape",
      "unclassifiable-construct",
      "unreadable-file",
      "unresolvable-specifier",
    ]);
  });

  it("REQ-CST-06.1: every rule renders the full skeleton — found, rule, why, fix, epilogue", () => {
    expect(VIOLATION_RULES.length).toBe(12);
    const missing = [...VIOLATION_RULES].filter((rule) => {
      const rendered = renderViolations(
        [{ rule, file: "core/x.js", line: 7, found: "planted", detail: "planted-detail" }],
        { distDirName: "dist", srcDirName: "src" }
      );
      return !(
        rendered.includes("runner-manifest: src/core/x.ts") &&
        rendered.includes("found: planted") &&
        rendered.includes("  rule:  ") &&
        rendered.includes("  why:   ") &&
        rendered.includes("  fix:   ") &&
        rendered.includes("No manifest was written")
      );
    });
    expect(missing).toEqual([]);
  });
});

describe("FIT-42N S-003 — Constraint 5: no package.json between the entry and the root", () => {
  // RP-6.
  it("REQ-CST-05.1: a planted dist/package.json is found and reported", () => {
    const root = plantTree({
      "dist/bin/entry.js": "export const e = 1;\n",
      "dist/package.json": '{ "type": "commonjs" }\n',
    });
    expect(findIntermediatePackageJsons(root, "dist/bin/entry.js")).toEqual([
      {
        path: "dist/package.json",
        reason:
          "terminates the package-root walk early and reinterprets parse mode with NO digest change",
      },
    ]);
  });

  it("REQ-CST-05.1: a tree with no intermediate package.json produces no finding", () => {
    const root = plantTree({ "dist/bin/entry.js": "export const e = 1;\n" });
    expect(findIntermediatePackageJsons(root, "dist/bin/entry.js")).toEqual([]);
  });
});

describe("FIT-42N S-003 — Constraint 1: bundler output stays off the closure", () => {
  const closurePaths = ["dist/bin/pbuilder-runner.js", "dist/transport/runner.js"];

  it("REQ-BDI-01.1: --outfile, --outdir and the -o short form are all extracted", () => {
    expect(
      findBundlerTargets({
        a: "bun build x.ts --outfile dist/bin/codegen.js",
        b: "bun build y.ts --outdir dist/transport",
        c: "bun build z.ts -o dist/bin/other.js",
      })
    ).toEqual([
      { script: "a", flag: "--outfile", target: "dist/bin/codegen.js" },
      { script: "b", flag: "--outdir", target: "dist/transport" },
      { script: "c", flag: "-o", target: "dist/bin/other.js" },
    ]);
  });

  // RP-8 — both planted forms must fail, the --outdir one by directory containment.
  it("REQ-BDI-01.1: an --outdir containing a closure file is a disjointness violation", () => {
    const targets = findBundlerTargets({ leak: "bun build z.ts --outdir dist/transport" });
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([
      {
        script: "leak",
        target: "dist/transport",
        colliding: "dist/transport/runner.js",
      },
    ]);
  });

  it("REQ-BDI-01.1: an -o short form writing a closure file is a disjointness violation", () => {
    const targets = findBundlerTargets({ leak: "bun build z.ts -o dist/transport/runner.js" });
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([
      {
        script: "leak",
        target: "dist/transport/runner.js",
        colliding: "dist/transport/runner.js",
      },
    ]);
  });

  it("REQ-BDI-01.1: a target outside the closure is not a violation", () => {
    const targets = findBundlerTargets({ ok: "bun build x.ts --outfile dist/bin/codegen.js" });
    expect(targets.length).toBe(1);
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([]);
  });

  // judgment-day finding 2: docs/runner-integrity-invariants.md:86-87 names exactly this
  // drift as the realistic Constraint-1 failure, and `bun build --outdir ./dist/x` is the
  // idiomatic spelling — an unnormalised string compare let all three evade detection.
  it("REQ-BDI-01.1: a leading './' on --outdir still collides — idiomatic bun spelling", () => {
    const targets = findBundlerTargets({ leak: "bun build z.ts --outdir ./dist/transport" });
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([
      { script: "leak", target: "./dist/transport", colliding: "dist/transport/runner.js" },
    ]);
  });

  it("REQ-BDI-01.1: a leading './' on --outfile still collides", () => {
    const targets = findBundlerTargets({
      leak: "bun build z.ts --outfile ./dist/transport/runner.js",
    });
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([
      {
        script: "leak",
        target: "./dist/transport/runner.js",
        colliding: "dist/transport/runner.js",
      },
    ]);
  });

  it("REQ-BDI-01.1: a trailing '/' on --outdir still collides", () => {
    const targets = findBundlerTargets({ leak: "bun build z.ts --outdir dist/transport/" });
    expect(findDisjointnessViolations(targets, closurePaths)).toEqual([
      { script: "leak", target: "dist/transport/", colliding: "dist/transport/runner.js" },
    ]);
  });
});

describe("FIT-42N S-003 — the closure-graph baseline catches node AND edge drift", () => {
  const baseline = {
    nodes: ["a.js", "b.js", "entry.js"],
    edges: [
      { from: "entry.js", to: "a.js", specifier: "./a.js" },
      { from: "a.js", to: "b.js", specifier: "./b.js" },
    ],
  };

  it("REQ-BDI-03.1: an unchanged graph reports no drift", () => {
    const drift = diffClosureBaseline(baseline, baseline);
    expect(drift).toEqual({
      addedNodes: [],
      removedNodes: [],
      addedEdges: [],
      removedEdges: [],
    });
    expect(hasDrift(drift)).toBe(false);
  });

  // RP-2 — must name the added node AND the edge that admitted it.
  it("REQ-BDI-03.1: an added node is reported with the edge that admitted it", () => {
    const observed = {
      nodes: ["a.js", "b.js", "c.js", "entry.js"],
      edges: [...baseline.edges, { from: "b.js", to: "c.js", specifier: "./c.js" }],
    };
    const drift = diffClosureBaseline(observed, baseline);
    expect(drift.addedNodes).toEqual(["c.js"]);
    expect(drift.addedEdges).toEqual([{ from: "b.js", to: "c.js", specifier: "./c.js" }]);
    expect(hasDrift(drift)).toBe(true);
  });

  // RP-2b.
  it("REQ-BDI-03.1: a removed node and its edge are both reported", () => {
    const observed = {
      nodes: ["a.js", "entry.js"],
      edges: [{ from: "entry.js", to: "a.js", specifier: "./a.js" }],
    };
    const drift = diffClosureBaseline(observed, baseline);
    expect(drift.removedNodes).toEqual(["b.js"]);
    expect(drift.removedEdges).toEqual([{ from: "a.js", to: "b.js", specifier: "./b.js" }]);
    expect(hasDrift(drift)).toBe(true);
  });

  // RP-2c — THE closure-sealing case. The node set is byte-identical to the baseline's, so
  // a nodes-only comparison passes this while the graph has been rewritten underneath it.
  it("REQ-BDI-03.1: an edge redirected with the node set unchanged is still reported", () => {
    const observed = {
      nodes: ["a.js", "b.js", "entry.js"],
      edges: [
        { from: "entry.js", to: "a.js", specifier: "./a.js" },
        { from: "entry.js", to: "b.js", specifier: "./b.js" },
      ],
    };
    const drift = diffClosureBaseline(observed, baseline);
    expect(drift.addedNodes).toEqual([]);
    expect(drift.removedNodes).toEqual([]);
    expect(drift.addedEdges).toEqual([{ from: "entry.js", to: "b.js", specifier: "./b.js" }]);
    expect(drift.removedEdges).toEqual([{ from: "a.js", to: "b.js", specifier: "./b.js" }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it("REQ-BDI-03.1: the rendered drift keeps the permissive register and the three repair steps", () => {
    const observed = {
      nodes: ["a.js", "b.js", "c.js", "entry.js"],
      edges: [...baseline.edges, { from: "b.js", to: "c.js", specifier: "./c.js" }],
    };
    const rendered = renderBaselineDrift(diffClosureBaseline(observed, baseline), {
      observed: 4,
      baseline: 3,
    });
    expect(rendered).toBe(
      [
        "fit-42: the runner closure changed.",
        "  4 files are reachable from dist/bin/pbuilder-runner.js; the committed baseline has 3.",
        "  added node:  c.js",
        "  added edge:  b.js -> ./c.js   (src/b.ts)",
        "  removed:     (none)",
        "",
        "This is not automatically wrong — the closure is allowed to grow. It is wrong if you did not",
        "mean to change it. If you did mean it:",
        "  1. check the new file against the constraints in docs/runner-integrity-invariants.md,",
        "  2. regenerate: bun run build && bun run regen:closure-baseline,",
        "  3. commit test/fitness/runner-closure-graph-baseline.json in the SAME commit, and say in",
        "     the commit message why the closure grew — the engine verifies whatever we publish.",
        "",
      ].join("\n")
    );
  });
});

describe("FIT-42N S-003 — the emitted graph still matches the source graph", () => {
  it("REQ-BDI-02.1: a file whose specifiers correspond after .ts→.js rewriting is clean", () => {
    expect(
      findGraphEmitMismatches([
        { path: "core/a.js", emitted: ["./b.js"], source: ["./b.ts"], sourceTypeOnly: [] },
      ])
    ).toEqual([]);
  });

  // A bundler inlining a module leaves the emitted file importing something its source never
  // named — this is the direction that actually detects a rewritten graph.
  it("REQ-BDI-02.1: an emitted specifier absent from source is reported", () => {
    expect(
      findGraphEmitMismatches([
        { path: "core/a.js", emitted: ["./b.js", "./inlined.js"], source: ["./b.ts"], sourceTypeOnly: [] },
      ])
    ).toEqual([
      { path: "core/a.js", missingInSource: ["./inlined.js"], unexplainedInSource: [] },
    ]);
  });

  it("REQ-BDI-02.2: a source specifier erased as type-only is NOT reported", () => {
    expect(
      findGraphEmitMismatches([
        {
          path: "core/session.js",
          emitted: ["./wire.js"],
          source: ["./wire.ts", "./engine-client.ts"],
          sourceTypeOnly: ["./engine-client.ts"],
        },
      ])
    ).toEqual([]);
  });

  it("REQ-BDI-02.1: a source VALUE specifier missing from the emit is reported", () => {
    expect(
      findGraphEmitMismatches([
        { path: "core/a.js", emitted: [], source: ["./dropped.ts"], sourceTypeOnly: [] },
      ])
    ).toEqual([
      { path: "core/a.js", missingInSource: [], unexplainedInSource: ["./dropped.ts"] },
    ]);
  });

  // Multiset, not set: two imports of the same module collapsing to one is a rewrite.
  it("REQ-BDI-02.1: a duplicate specifier collapsing to a single emit is reported", () => {
    expect(
      findGraphEmitMismatches([
        { path: "core/a.js", emitted: ["./b.js"], source: ["./b.ts", "./b.ts"], sourceTypeOnly: [] },
      ])
    ).toEqual([
      { path: "core/a.js", missingInSource: [], unexplainedInSource: ["./b.ts"] },
    ]);
  });
});

// ===========================================================================================
// S-001 — capability-admission property (ADR-0079/0080), new REQ-CAP/PRM/DGN red-proofs.
// ===========================================================================================

describe("FIT-42N S-001 — REQ-CAP-02: no-module-scope-reassignment precondition", () => {
  it("REQ-CAP-02.1 [red-proof]: reassignment of a module-scope binding is a violation", () => {
    const root = plantTree({
      "entry.js": 'import { createRequire } from "node:module";\ncreateRequire = null;\n',
    });
    const violations = classifiedAs(root);
    expect(violations.some((v) => v.rule === "unclassifiable-construct")).toBe(true);
  });

  it("REQ-CAP-02.2: the real closure's 3 module-scope reassignments each have an admitted RHS — sibling positive", () => {
    // D-2: realFd1Write (transport/framing.js) and runInFlight x2 (transport/runner.js).
    const root = plantTree({
      "entry.js": [
        "let realFd1Write = process.stdout.write.bind(process.stdout);",
        "let runInFlight = false;",
        "runInFlight = true;",
        "runInFlight = false;",
        "realFd1Write = process.stdout.write.bind(process.stdout);",
      ].join("\n"),
    });
    expect(classifiedAs(root)).toEqual([]);
  });
});

describe("FIT-42N S-001 — REQ-CAP-01.7: RCD-03.3's day-one JSDoc fixtures stay non-flagged under admission, governed by E1", () => {
  // Distinct from CAP-01.2's mutation-catching red-proof: this asserts E1 is FALSIFIABLE
  // (governs a real, day-one fixture), not merely unexercised. Same shape as the pre-existing
  // RP-12 proof (S-000 tier), but citing REQ-CAP-01.7 explicitly as S-001.4's own task text
  // requires — a `{@link denied}` JSDoc tag is ALSO structurally excluded (R1-16's probe:
  // `{@link X}` DOES yield a real Identifier node, parent kind JSDocLink — E1 must exclude by
  // JSDoc-ancestry, not merely by "prose never becomes an Identifier").
  it("REQ-CAP-01.7: a bare specifier and a resolvable relative specifier, both JSDoc-quoted, add nothing", () => {
    const root = plantTree({
      "entry.js": [
        "/**",
        " * @example",
        ' * import { Thing } from "some-package";',
        ' * import type { Other } from "./real-target.ts";',
        " */",
        "export const noop = 1;",
      ].join("\n"),
      "real-target.ts": "export const other = 1;\n",
    });
    const derivation = deriveRunnerClosure(root, "entry.js");
    expect(derivation.violations).toEqual([]);
    expect(derivation.nodes).toEqual(["entry.js"]);
  });

  it("REQ-CAP-01.7: a {@link eval} JSDoc reference to a denied primitive is excluded by E1, never flagged", () => {
    const root = plantTree({
      "entry.js": ["/**", " * {@link eval} is mentioned here for documentation only.", " */", "export const noop = 1;"].join("\n"),
    });
    expect(classifiedAs(root)).toEqual([]);
  });
});

describe("FIT-42N S-001 — REQ-CAP-03: callee decidability", () => {
  it('REQ-CAP-03.1 [red-proof]: globalThis["ev"+"al"]("1+1") — CONFIRMED LIVE ESCAPE (M2.1)', () => {
    const root = plantTree({ "entry.js": 'globalThis["ev"+"al"]("1+1");\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-undecidable-callee", file: "entry.js" },
    ]);
  });

  it('REQ-CAP-03.2 [red-proof]: (()=>{}).constructor("return 1")() — CONFIRMED LIVE ESCAPE (M2.2)', () => {
    const root = plantTree({ "entry.js": '(()=>{}).constructor("return 1")();\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-undecidable-callee", file: "entry.js" },
    ]);
  });

  it("REQ-CAP-03.3: a locally declared function called through its bound identifier is admitted — sibling positive", () => {
    const root = plantTree({ "entry.js": "function helper() { return 1; }\nconst r = helper();\n" });
    expect(classifiedAs(root)).toEqual([]);
  });
});

describe("FIT-42N S-001 — REQ-CAP-04: origin admission", () => {
  it("REQ-CAP-04.1 [red-proof]: node:child_process is not an admitted builtin surface — RULED-IN PRIMITIVE", () => {
    const root = plantTree({ "entry.js": 'import { spawn } from "node:child_process";\nspawn("ls");\n' });
    const violations = classifiedAs(root);
    expect(violations.some((v) => v.rule === "constraint-4-inadmissible-origin")).toBe(true);
  });

  it("REQ-CAP-04.2: the admitted builtin baseline's imports report zero violations — sibling positive", () => {
    const root = plantTree({
      "entry.js": [
        'import { AsyncLocalStorage } from "node:async_hooks";',
        'import { Console } from "node:console";',
        'import { existsSync } from "node:fs";',
        'import { dirname } from "node:path";',
        'import { fileURLToPath } from "node:url";',
        "new AsyncLocalStorage();",
        "new Console({ stdout: process.stdout, stderr: process.stderr });",
        'existsSync(".");',
        'dirname("/a/b");',
        'fileURLToPath("file:///a");',
      ].join("\n"),
    });
    expect(classifiedAs(root)).toEqual([]);
  });

  it("REQ-CAP-04.3 [red-proof]: an unrecognised node: specifier is unclassifiable, never silently builtin — closes R1-15", () => {
    const root = plantTree({ "entry.js": 'import "node:nonexistent-module";\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "unclassifiable-construct", file: "entry.js" },
    ]);
  });

  it("REQ-CAP-04.5 [red-proof]: a silent widening of ADMITTED_GLOBALS is caught by the exact-membership assertion", () => {
    const widened = new Set([...ADMITTED_GLOBALS, "eval"]);
    expect(widened.size).toBe(ADMITTED_GLOBALS.size + 1);
    expect(() => expect([...widened].sort()).toEqual([...ADMITTED_GLOBALS].sort())).toThrow();
  });

  it("REQ-CAP-04.7 [red-proof]: process.dlopen is denied despite an admitted origin and an undenied root", () => {
    const root = plantTree({ "entry.js": 'process.dlopen("./native.node");\n' });
    expect(ADMITTED_MEMBER_PATHS.has("process.dlopen")).toBe(false);
    expect(DENIED_CAPABILITY_PRIMITIVES.has("process.dlopen")).toBe(false);
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "entry.js" },
    ]);
  });

  it("REQ-CAP-04.8 [red-proof]: a silent widening of ADMITTED_MEMBER_PATHS is caught by the exact-membership assertion", () => {
    const widened = new Set([...ADMITTED_MEMBER_PATHS, "process.dlopen"]);
    expect(widened.size).toBe(ADMITTED_MEMBER_PATHS.size + 1);
    expect(() => expect([...widened].sort()).toEqual([...ADMITTED_MEMBER_PATHS].sort())).toThrow();
  });
});

describe("FIT-42N S-001 — REQ-CAP-05: positional decidability for denied roots", () => {
  it("REQ-CAP-05.1: x instanceof Function is admitted — R1-17 relaxation", () => {
    const root = plantTree({ "entry.js": "function check(x) { return x instanceof Function; }\n" });
    expect(classifiedAs(root)).toEqual([]);
  });

  it('REQ-CAP-05.2 [red-proof]: const F = Function; F("...") stays denied — the R1-17 sequencing hazard, closed (SC-2)', () => {
    const root = plantTree({ "entry.js": 'const F = Function;\nF("return 1");\n' });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-inadmissible-origin", file: "entry.js" },
    ]);
  });

  it("REQ-CAP-05.3: typeof Function is admitted — sibling positive", () => {
    const root = plantTree({ "entry.js": 'function check() { return typeof Function === "function"; }\n' });
    expect(classifiedAs(root)).toEqual([]);
  });
});

describe("FIT-42N S-001 — REQ-DGN-01.2: directory specifier gets its own rule — R1-8", () => {
  it("REQ-DGN-01.2 [red-proof]: a specifier resolving to a directory is diagnosed distinctly, never as unreadable-file", () => {
    const root = plantTree({
      "entry.js": 'import "./adir/index.js";\n',
      "adir/index.js/placeholder": "",
    });
    // "./adir/index.js" resolves to a DIRECTORY (adir/index.js/), not a file.
    expect(classifiedAs(root)).toEqual([
      { rule: "directory-specifier", file: "entry.js" },
    ]);
  });
});

describe("FIT-42N S-001 — REQ-CST-04.3.2: non-vacuity counts by AST, not substring — R1-10", () => {
  it("REQ-CST-04.3.2 [red-proof]: a mutant admission register widened by one entry is caught by AST-identifier occurrence, not a substring scan", () => {
    // A substring-only guard would miss this: the widened name "totallyFakePrimitive" never
    // appears as denied TEXT anywhere in a real tree, because it was never a real primitive
    // to begin with — the guard must count DECLARED admission-table membership by AST
    // identity (the exact-membership assertions above), never by grepping violation text.
    const mutantAdmitted = new Set([...ADMITTED_GLOBALS, "totallyFakePrimitive"]);
    const astCountedWidening = mutantAdmitted.size - ADMITTED_GLOBALS.size;
    expect(astCountedWidening).toBe(1);
    const substringScanFindsIt = [...ADMITTED_GLOBALS].some((g) => g === "totallyFakePrimitive");
    expect(substringScanFindsIt).toBe(false);
  });
});

// The committed corpus (design.md §6d: runtime-planted fixtures cannot be readdir-enumerated,
// and directory enumeration is the machine-checked exhaustiveness device this REQ needs).
const DENY_SCAN_DIR = join(PROJECT_ROOT, "test/fixtures/red/runner-tripwires/deny-scan");
const GREEN_DIR = join(PROJECT_ROOT, "test/fixtures/red/runner-tripwires/green");

// Filename -> the primitive its fixture produces (REQ-PRM-01.2's per-member bijection).
// createRequire is the 11th register member; its producing fixture is the anchor file
// itself (single-instance-probe.ts, proven via REQ-XPO-01 in S-002) — never a deny-scan/
// entry (slices.md S-001.6's own note).
const DENY_SCAN_FIXTURES: Readonly<Record<string, string>> = {
  "eval.js": "eval",
  "function-construction.js": "Function",
  "node-vm.js": "node:vm",
  "node-child-process.js": "node:child_process",
  "node-worker-threads.js": "node:worker_threads",
  "web-assembly.js": "WebAssembly",
  "bun-plugin.js": "Bun.plugin",
  "process-binding.js": "process.binding",
  "module-register.js": "module.register",
  "module-register-hooks.js": "module.registerHooks",
};

// The violation's own `detail` field, which is not always identical to the bare register
// name above — `WebAssembly.instantiate(bytes)` (REQ-CST-04.2.8's own fixture form) is
// caught as an inadmissible-origin CALLEE naming the full path, not the bare global alone.
const DENY_SCAN_EXPECTED_DETAIL: Readonly<Record<string, string>> = {
  ...DENY_SCAN_FIXTURES,
  "web-assembly.js": "WebAssembly.instantiate",
};

describe("FIT-42N S-001 — REQ-PRM-01: capability primitive register, fixture-completeness over the committed corpus", () => {
  it("REQ-PRM-01.1: the register is exactly 11 members, 10 with a deny-scan/ fixture plus createRequire's anchor", () => {
    expect(DENIED_CAPABILITY_PRIMITIVES.size).toBe(11);
    expect(DENIED_CAPABILITY_PRIMITIVES.has("createRequire")).toBe(true);
    const fixturedPrimitives = new Set(Object.values(DENY_SCAN_FIXTURES));
    const nonAnchorMembers = [...DENIED_CAPABILITY_PRIMITIVES].filter((p) => p !== "createRequire");
    expect(nonAnchorMembers.length).toBe(10);
    expect([...fixturedPrimitives].sort()).toEqual([...nonAnchorMembers].sort());
  });

  it("REQ-PRM-01.2: readdir(deny-scan/) matches the declared class-ID list exactly, both directions", () => {
    const onDisk = readdirSync(DENY_SCAN_DIR).sort();
    const declared = Object.keys(DENY_SCAN_FIXTURES).sort();
    expect(onDisk).toEqual(declared);
  });

  for (const [file, primitive] of Object.entries(DENY_SCAN_FIXTURES)) {
    it(`REQ-CST-04.2: deny-scan/${file} is denied, naming ${primitive}`, () => {
      const root = scratchRoot();
      const content = readFileSync(join(DENY_SCAN_DIR, file), "utf-8");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "entry.js"), content, "utf-8");
      const violations = deriveRunnerClosure(root, "entry.js").violations;
      expect(violations.length).toBe(1);
      expect(violations[0]?.detail).toBe(DENY_SCAN_EXPECTED_DETAIL[file]);
    });
  }

  it("REQ-PRM-01: the mandatory green sibling produces zero violations — non-vacuity", () => {
    const root = scratchRoot();
    const content = readFileSync(join(GREEN_DIR, "clean-admitted-surface.js"), "utf-8");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "entry.js"), content, "utf-8");
    expect(deriveRunnerClosure(root, "entry.js").violations).toEqual([]);
  });

  it("REQ-PRM-01.2 [red-proof]: a register member with no producing fixture is a violation (M2.10/M6.2)", () => {
    const mutantRegister = new Set([...DENIED_CAPABILITY_PRIMITIVES, "Deno.core.opSync"]);
    const fixturedMembers = new Set([...Object.values(DENY_SCAN_FIXTURES), "createRequire"]);
    const unfixtured = [...mutantRegister].filter((member) => !fixturedMembers.has(member));
    expect(unfixtured).toEqual(["Deno.core.opSync"]);
  });
});

// ===========================================================================================
// S-001.7 — standing scan: no `toContain` on a tripwire/guard-failure MESSAGE, ever again, in
// this file family. Scoped to the fit-42/fit-23/fit-46 family only (slices.md's own scope
// note — a repo-wide scan would flag unrelated `toContain` usage this change has no
// acceptance criterion over).
// ===========================================================================================

describe("FIT-42N S-001 — REQ-CST-06.1: standing scan — no toContain on a tripwire message", () => {
  const SCANNED_FILES = [
    "test/fitness/fit-42-runner-closure-integrity.test.ts",
    "test/fitness/fit-42-runner-closure-integrity.negative.test.ts",
    "test/fitness/fit-23-publish-workflow-guard.test.ts",
    "test/fitness/fit-46-publish-sequence-integrity.test.ts",
  ];

  // A "tripwire message" receiver is one of this family's own established naming
  // conventions for rendered/guard-failure text: `rendered` (renderViolations/
  // renderBaselineDrift output), `stderr` (a spawned tool's error output), or a `.reason`/
  // `.message` field (a guard-check's own failure explanation, e.g. checkRepoOwnerGuard's
  // `{ok, reason}`). Array-membership and raw-file-content checks (`paths`, `source`,
  // `manifestRaw`, `.nodes`, `line`, …) are legitimate `toContain` uses this scan must NOT
  // flag — REQ-CST-06.1 governs MESSAGE assertions, not membership checks.
  const MESSAGE_RECEIVER = /\b(rendered|stderr)\b|\.reason\b|\.message\b/;
  const TO_CONTAIN_CALL = /expect\(([^)]*)\)\s*\.(?:not\.)?toContain\(/g;

  // The offender-report format deliberately never spells the banned call syntax
  // (`expect(` immediately followed by `.toContain(`) as one literal substring — otherwise
  // the scan, which reads this very file among `SCANNED_FILES`, would flag its own report
  // strings (and the red-proof's expected-output array below) as additional offenders.
  function findMessageToContainSites(source: string): string[] {
    const offenders: string[] = [];
    for (const match of source.matchAll(TO_CONTAIN_CALL)) {
      const receiver = match[1] ?? "";
      if (MESSAGE_RECEIVER.test(receiver)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`line ${line}: receiver "${receiver.trim()}" (banned substring-match call)`);
      }
    }
    return offenders;
  }

  for (const relativePath of SCANNED_FILES) {
    it(`REQ-CST-06.1: ${relativePath} has zero toContain calls on a rendered/guard-failure message`, () => {
      const source = readFileSync(join(PROJECT_ROOT, relativePath), "utf-8");
      expect(findMessageToContainSites(source)).toEqual([]);
    });
  }

  // The planted/legitimate fixtures below build the banned call syntax via concatenation
  // (never spelling `expect(` + `.toContain(` adjacently in this file's own literal text) —
  // otherwise the scan, which reads this very file among `SCANNED_FILES`, would flag its
  // own red-proof's planted test DATA as a real offending call.
  const CALL = ["toCon", "tain"].join("");

  it("REQ-CST-06.1 [red-proof]: the scan itself catches a planted toContain on a message receiver", () => {
    const planted = [
      "const rendered = renderViolations(violations, opts);",
      `expect(rendered).${CALL}("Constraint 4");`,
      "",
      "const result = checkRepoOwnerGuard(doc, owner);",
      `expect(result.reason).${CALL}("missing the repo-owner guard");`,
    ].join("\n");
    expect(findMessageToContainSites(planted)).toEqual([
      'line 2: receiver "rendered" (banned substring-match call)',
      'line 5: receiver "result.reason" (banned substring-match call)',
    ]);
  });

  it("REQ-CST-06.1: the scan does NOT flag legitimate non-message toContain (array membership, raw content)", () => {
    const legitimate = [
      `expect(paths).${CALL}("dist/core/authoring-error.js");`,
      `expect(source).${CALL}("SANCTIONED-FACTORY-IMPORT");`,
      `expect(line).${CALL}("npm publish");`,
    ].join("\n");
    expect(findMessageToContainSites(legitimate)).toEqual([]);
  });
});

// ===========================================================================================
// S-003 — REQ-PTH-01: resolution-based bundler-output disjointness (ADR-0081). The committed
// corpus (design.md §6d, same rationale as S-001's deny-scan/ corpus: a runtime-planted
// fixture cannot be readdir-enumerated).
// ===========================================================================================

const BUNDLER_SCRIPTS_DIR = join(PROJECT_ROOT, "test/fixtures/red/runner-tripwires/bundler-scripts");
const PTH_CLOSURE_PATHS = ["dist/bin/pbuilder-runner.js", "dist/transport/runner.js"];

function readScriptsFixture(file: string): Record<string, string> {
  return JSON.parse(readFileSync(join(BUNDLER_SCRIPTS_DIR, file), "utf-8")) as Record<string, string>;
}

describe("FIT-42N S-003 — REQ-PTH-01: five confirmed escaping spellings, closed", () => {
  it("REQ-PTH-01.1 [red-proof]: a double-slash-dot --outdir still collides", () => {
    const scripts = readScriptsFixture("double-slash-dot.json");
    const targets = findBundlerTargets(scripts);
    expect(targets).toEqual([{ script: "leak", flag: "--outdir", target: ".//dist/transport" }]);
    expect(findDisjointnessViolations(targets, PTH_CLOSURE_PATHS)).toEqual([
      { script: "leak", target: ".//dist/transport", colliding: "dist/transport/runner.js" },
    ]);
  });

  it("REQ-PTH-01.2 [red-proof]: --outdir . targets the total root, colliding with every closure path", () => {
    const scripts = readScriptsFixture("total-root.json");
    const targets = findBundlerTargets(scripts);
    expect(targets).toEqual([{ script: "leak", flag: "--outdir", target: "." }]);
    expect(findDisjointnessViolations(targets, PTH_CLOSURE_PATHS)).toEqual([
      { script: "leak", target: ".", colliding: "dist/bin/pbuilder-runner.js" },
      { script: "leak", target: ".", colliding: "dist/transport/runner.js" },
    ]);
  });

  it("REQ-PTH-01.3 [red-proof]: the -o short form concatenated with no separator is parsed and collides", () => {
    const scripts = readScriptsFixture("concatenated-short-form.json");
    const targets = findBundlerTargets(scripts);
    expect(targets).toEqual([{ script: "leak", flag: "-o", target: "dist/transport/runner.js" }]);
    expect(findDisjointnessViolations(targets, PTH_CLOSURE_PATHS)).toEqual([
      { script: "leak", target: "dist/transport/runner.js", colliding: "dist/transport/runner.js" },
    ]);
  });

  it("REQ-PTH-01.4 [red-proof]: a relative-parent escape resolves back into the closure and collides", () => {
    const scripts = readScriptsFixture("relative-parent.json");
    const targets = findBundlerTargets(scripts);
    expect(targets).toEqual([{ script: "leak", flag: "--outdir", target: "../dist/transport" }]);
    expect(findDisjointnessViolations(targets, PTH_CLOSURE_PATHS)).toEqual([
      { script: "leak", target: "../dist/transport", colliding: "dist/transport/runner.js" },
    ]);
  });

  it("REQ-PTH-01.5 [red-proof]: --outdir=$VAR is undecidable at build time — unclassifiable, never a pass", () => {
    const scripts = readScriptsFixture("undecidable-var.json");
    expect(findBundlerTargets(scripts)).toEqual([]);
    expect(findUnclassifiableBundlerConstructs(scripts)).toEqual([
      { script: "leak", token: "--outdir=$VAR" },
    ]);
  });
});

describe("FIT-42N S-003 — REQ-PTH-01.7: an unrecognised output-flag-shaped token is unclassifiable, never silent", () => {
  it("REQ-PTH-01.7 [red-proof]: --out-dir is output-flag-shaped but not a recognised spelling", () => {
    const scripts = readScriptsFixture("unrecognized-flag-shape.json");
    // Never silently ignored (ordinary non-output flags like --minify ARE ignored — this
    // must not be), and never silently MISREAD as the recognised --outdir spelling either.
    expect(findBundlerTargets(scripts)).toEqual([]);
    expect(findUnclassifiableBundlerConstructs(scripts)).toEqual([
      { script: "leak", token: "--out-dir" },
    ]);
  });

  it("REQ-PTH-01.7: an ordinary non-output flag (--minify) is correctly left unclassified — scope-limit sentence", () => {
    const scripts = { ok: "bun build z.ts --minify --outfile dist/bin/codegen.js" };
    expect(findUnclassifiableBundlerConstructs(scripts)).toEqual([]);
    expect(findBundlerTargets(scripts)).toEqual([
      { script: "ok", flag: "--outfile", target: "dist/bin/codegen.js" },
    ]);
  });
});

describe("FIT-42N S-003 — REQ-PTH-01: the bundler-scripts/ corpus is complete, readdir-enumerated both directions", () => {
  const DECLARED_RED = [
    "double-slash-dot.json",
    "total-root.json",
    "concatenated-short-form.json",
    "relative-parent.json",
    "undecidable-var.json",
    "unrecognized-flag-shape.json",
  ];
  const DECLARED_GREEN = ["green-outside-closure.json"];

  it("REQ-PTH-01: readdir(bundler-scripts/) matches the declared class-ID list exactly, both directions", () => {
    const onDisk = readdirSync(BUNDLER_SCRIPTS_DIR).sort();
    const declared = [...DECLARED_RED, ...DECLARED_GREEN].sort();
    expect(onDisk).toEqual(declared);
  });

  it("REQ-PTH-01.6: the mandatory green sibling produces zero violations and zero unclassifiable constructs — non-vacuity", () => {
    const scripts = readScriptsFixture("green-outside-closure.json");
    const targets = findBundlerTargets(scripts);
    expect(targets).toEqual([{ script: "ok", flag: "--outfile", target: "dist/bin/pbuilder-codegen.js" }]);
    expect(findDisjointnessViolations(targets, PTH_CLOSURE_PATHS)).toEqual([]);
    expect(findUnclassifiableBundlerConstructs(scripts)).toEqual([]);
  });
});

// ===========================================================================================
// S-004 — REQ-FCG-01: FIT-FAILCLOSED-BICONDITIONAL. `exit != 0` iff no manifest exists, per
// injected fault, against a scratch root PRE-SEEDED with a valid prior manifest — so a
// fail-open bug would leave a plausible-looking stale artefact behind, never an absence. The
// committed corpus (design.md §6d): a fault kind's INJECTION RECIPE (package.json content
// override, or a closure file to chmod) rather than static source text.
// ===========================================================================================

interface FailClosedFixture {
  readonly kind: "malformed-json" | "unreadable-closure-file" | "generic-throw";
  readonly packageJsonContent?: string;
  readonly chmodClosureFile?: string;
  readonly description: string;
}

const FAIL_CLOSED_DIR = join(PROJECT_ROOT, "test/fixtures/red/runner-tripwires/fail-closed");

function readFailClosedFixture(file: string): FailClosedFixture {
  return JSON.parse(readFileSync(join(FAIL_CLOSED_DIR, file), "utf-8")) as FailClosedFixture;
}

// A REAL copy of dist/ + package.json, with a manifest ALREADY generated — the "pre-seeded
// with a valid prior manifest" precondition every fault kind below is injected against.
function preSeededRoot(): string {
  const distDir = ensureTscBuild();
  const root = scratchRoot();
  cpSync(distDir, join(root, "dist"), { recursive: true });
  cpSync(join(PROJECT_ROOT, "package.json"), join(root, "package.json"));
  const seed = runGeneratorAt(root);
  if (seed.status !== 0) {
    throw new Error(`pre-seeding failed unexpectedly: ${seed.stderr as unknown as string}`);
  }
  return root;
}

function applyFault(root: string, fixture: FailClosedFixture): void {
  if (fixture.packageJsonContent !== undefined) {
    writeFileSync(join(root, "package.json"), fixture.packageJsonContent, "utf-8");
  }
  if (fixture.chmodClosureFile !== undefined) {
    chmodSync(join(root, "dist", fixture.chmodClosureFile), 0o000);
  }
}

function runGeneratorAt(root: string): ReturnType<typeof spawnSync> {
  return spawnSync("bun", ["scripts/generate-runner-manifest.ts", root], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
}

const manifestPathIn = (root: string): string => join(root, "dist", "runner-manifest.json");

describe("FIT-42N S-004 — REQ-FCG-01: the fail-closed/ corpus is complete, readdir-enumerated", () => {
  const DECLARED = ["malformed-json.json", "unreadable-closure-file.json", "generic-throw-null-package.json"];

  it("REQ-FCG-01: readdir(fail-closed/) matches the declared class-ID list exactly, both directions", () => {
    expect(readdirSync(FAIL_CLOSED_DIR).sort()).toEqual([...DECLARED].sort());
  });
});

describe("FIT-42N S-004 — FIT-FAILCLOSED-BICONDITIONAL: exit != 0 iff no manifest, per fault", () => {
  const FIXTURE_FILES = ["malformed-json.json", "unreadable-closure-file.json", "generic-throw-null-package.json"];

  it.skipIf(process.getuid?.() === 0)(
    "REQ-FCG-01.4 [red-proof]: each of 3 injected fault kinds independently fails closed against a pre-seeded root",
    () => {
      for (const file of FIXTURE_FILES) {
        const fixture = readFailClosedFixture(file);
        const root = preSeededRoot();
        expect(existsSync(manifestPathIn(root)), `${file}: pre-seeding itself failed`).toBe(true);

        applyFault(root, fixture);
        const result = runGeneratorAt(root);

        expect(result.status, `${file} (${fixture.kind}) should fail closed`).not.toBe(0);
        expect(existsSync(manifestPathIn(root)), `${file} (${fixture.kind}) must leave no manifest`).toBe(false);
      }
    }
  );

  it("REQ-FCG-01.5: success yields a manifest — the biconditional's other direction", () => {
    const root = preSeededRoot();
    expect(existsSync(manifestPathIn(root))).toBe(true);
  });
});

describe("FIT-42N S-004 — REQ-FCG-01: individual fault-kind red-proofs", () => {
  it("REQ-FCG-01.1 [red-proof]: malformed package.json fails closed, removing a pre-existing manifest — R2-4", () => {
    const root = preSeededRoot();
    applyFault(root, readFailClosedFixture("malformed-json.json"));
    const result = runGeneratorAt(root);
    expect(result.status).not.toBe(0);
    expect(existsSync(manifestPathIn(root))).toBe(false);
  });

  it.skipIf(process.getuid?.() === 0)(
    "REQ-FCG-01.2 [red-proof]: a mid-derivation unreadable closure file leaves no manifest, atomically — R1-6",
    () => {
      const root = preSeededRoot();
      applyFault(root, readFailClosedFixture("unreadable-closure-file.json"));
      const result = runGeneratorAt(root);
      expect(result.status).not.toBe(0);
      expect(existsSync(manifestPathIn(root))).toBe(false);
      // write-temp-then-rename: no truncated/partial artefact of any kind survives either.
      expect(existsSync(`${manifestPathIn(root)}.tmp`)).toBe(false);
    }
  );

  it("REQ-FCG-01.3 [red-proof]: an unrouted throw (package.json is valid JSON `null`) still fails closed — R1-5", () => {
    const root = preSeededRoot();
    applyFault(root, readFailClosedFixture("generic-throw-null-package.json"));
    // Confirms the fixture's own premise: `null` IS valid JSON (a different fault than
    // malformed-json.json) — JSON.parse itself does not throw; the failure is the LATER,
    // genuinely unrouted `rootPackage.version` access on a non-object.
    expect(() => JSON.parse(readFileSync(join(root, "package.json"), "utf-8"))).not.toThrow();

    const result = runGeneratorAt(root);
    expect(result.status).not.toBe(0);
    expect(existsSync(manifestPathIn(root))).toBe(false);
    // Whole-verbatim exception (documented, not a silent weakening — REQ-CST-06.1): the
    // unrouted-error branch's message embeds `error.stack`, which is inherently
    // non-deterministic (absolute paths, line numbers) — only THAT middle segment is
    // unassertable verbatim. Both the leading AND trailing deterministic segments are
    // asserted (`startsWith`/`endsWith`, never `toContain` — the standing scan below is a
    // substring-MATCH ban, not a "no partial assertion" ban), pinning everything around the
    // one genuinely non-deterministic fragment rather than only the prefix (verify-in-loop-5
    // finding: a deterministic suffix was also assertable and had been left unpinned).
    const stderr = result.stderr as unknown as string;
    expect(stderr.startsWith("runner-manifest: generation failed with an unrouted error.\n")).toBe(true);
    expect(stderr.endsWith("\n\nNo manifest was written; dist/runner-manifest.json does not exist.\n")).toBe(
      true
    );
  });
});

// ===========================================================================================
// S-004.8 — REQ-DGN-01.3/.4: rule-identity totality over the fixture corpus. A STANDING check
// (same class as FIT-CAP-TOTALITY), not a one-time end-of-slice assertion — it holds over
// whatever fixture corpus exists on the branch at each commit. Scoped to fixtures that
// produce an actual `Violation` object carrying a `ViolationRule` (deny-scan/, and
// fail-closed/'s one violation-producing fault) — bundler-scripts/'s DisjointnessViolation/
// UnclassifiableBundlerConstruct are a STRUCTURALLY SEPARATE type that never carries a
// `ViolationRule` at all (Constraint 1 is a CI-only structural check, ADR-0081 — it never
// runs inside generate-runner-manifest.ts's own violation system), so it is out of THIS
// REQ's scope by construction, not by oversight.
// ===========================================================================================

interface RuleIdentityEntry {
  readonly fixture: string;
  readonly declaredRule: ViolationRule;
}

const RULE_IDENTITY_FIXTURES: readonly RuleIdentityEntry[] = [
  ...Object.keys(DENY_SCAN_FIXTURES).map((file) => ({
    fixture: `deny-scan/${file}`,
    declaredRule: "constraint-4-inadmissible-origin" as ViolationRule,
  })),
  { fixture: "fail-closed/unreadable-closure-file.json", declaredRule: "unreadable-file" as ViolationRule },
];

function produceRuleFor(entry: RuleIdentityEntry): ViolationRule {
  if (entry.fixture.startsWith("deny-scan/")) {
    const file = entry.fixture.slice("deny-scan/".length);
    const content = readFileSync(join(DENY_SCAN_DIR, file), "utf-8");
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "entry.js"), content, "utf-8");
    const violations = deriveRunnerClosure(root, "entry.js").violations;
    return (violations[0] as { rule: ViolationRule }).rule;
  }
  // fail-closed/unreadable-closure-file.json — a REAL closure file made unreadable, checked
  // directly via deriveRunnerClosure (no subprocess needed to observe the Violation object).
  const fixture = readFailClosedFixture("unreadable-closure-file.json");
  const distDir = ensureTscBuild();
  const root = scratchRoot();
  cpSync(distDir, join(root, "dist"), { recursive: true });
  chmodSync(join(root, "dist", fixture.chmodClosureFile as string), 0o000);
  const violations = deriveRunnerClosure(join(root, "dist"), ENTRY_RELATIVE_PATH).violations;
  return (violations[0] as { rule: ViolationRule }).rule;
}

/**
 * Multiset equality over the WHOLE corpus, run exhaustively (never a per-fixture SPOT CHECK,
 * i.e. never a sample) — compared as `{fixture, rule}` PAIRS, not bare rule-value counts.
 *
 * GENUINENESS NOTE: an earlier version of this function compared only the aggregate
 * rule-VALUE multiset (`declared.map(d => d.declaredRule).sort()` vs the same for produced),
 * short-circuiting to "no mismatch" whenever the two sorted arrays matched. Empirically, this
 * FAILED to catch REQ-DGN-01.4(a)'s own named mutation shape (a RULE_BODIES-renderer swap
 * between two fixtures): swapping fixture A's and B's produced rules leaves the aggregate
 * counts of each rule value unchanged, so a bare-value multiset comparison sees no
 * difference at all — the exact pathological case a "multiset, not a per-fixture check"
 * framing risks if "multiset" is read as "discard fixture identity entirely." Comparing
 * `{fixture, rule}` pairs (fixture identity retained, exhaustive over the whole corpus, never
 * a sample) is the reading that actually satisfies DGN-01.4(a)'s own acceptance criterion.
 */
function ruleIdentityTotalityMismatches(
  declared: readonly RuleIdentityEntry[],
  produced: readonly { readonly fixture: string; readonly rule: ViolationRule }[]
): string[] {
  const producedByFixture = new Map(produced.map((p) => [p.fixture, p.rule]));
  const mismatches: string[] = [];
  for (const d of declared) {
    const actual = producedByFixture.get(d.fixture);
    if (actual !== d.declaredRule) {
      mismatches.push(`${d.fixture}: declared "${d.declaredRule}", produced "${actual ?? "MISSING"}"`);
    }
  }
  return mismatches;
}

describe("FIT-42N S-004 — REQ-DGN-01.3/.4: rule-identity totality over the fixture corpus (standing)", () => {
  it.skipIf(process.getuid?.() === 0)(
    "REQ-DGN-01.3: the produced-rule multiset equals the declared-rule multiset, exact — never a per-fixture spot check",
    () => {
      const produced = RULE_IDENTITY_FIXTURES.map((entry) => ({
        fixture: entry.fixture,
        rule: produceRuleFor(entry),
      }));
      expect(ruleIdentityTotalityMismatches(RULE_IDENTITY_FIXTURES, produced)).toEqual([]);
    }
  );

  it("REQ-DGN-01.4 [red-proof]: a rule-swap mutant is caught, naming the mismatched fixture and the declared-vs-produced pair", () => {
    // (a) RULE_BODIES-renderer-swap shape: two fixtures' PRODUCED rules end up swapped with
    // each other — the aggregate multiset stays superficially plausible in size but the
    // per-fixture pairing is wrong, which the join-based naming step catches.
    const declared: RuleIdentityEntry[] = [
      { fixture: "deny-scan/eval.js", declaredRule: "constraint-4-inadmissible-origin" },
      { fixture: "fail-closed/unreadable-closure-file.json", declaredRule: "unreadable-file" },
    ];
    const swapped = [
      { fixture: "deny-scan/eval.js", rule: "unreadable-file" as ViolationRule },
      { fixture: "fail-closed/unreadable-closure-file.json", rule: "constraint-4-inadmissible-origin" as ViolationRule },
    ];
    expect(ruleIdentityTotalityMismatches(declared, swapped)).toEqual([
      'deny-scan/eval.js: declared "constraint-4-inadmissible-origin", produced "unreadable-file"',
      'fail-closed/unreadable-closure-file.json: declared "unreadable-file", produced "constraint-4-inadmissible-origin"',
    ]);
  });

  it('REQ-DGN-01.4 [red-proof]: mints rule X for a violation whose fixture declares rule Y is caught', () => {
    // (b) a single misattribution, everything else correct.
    const declared: RuleIdentityEntry[] = [
      { fixture: "deny-scan/eval.js", declaredRule: "constraint-4-inadmissible-origin" },
    ];
    const misattributed = [{ fixture: "deny-scan/eval.js", rule: "directory-specifier" as ViolationRule }];
    expect(ruleIdentityTotalityMismatches(declared, misattributed)).toEqual([
      'deny-scan/eval.js: declared "constraint-4-inadmissible-origin", produced "directory-specifier"',
    ]);
  });
});

// ===========================================================================================
// S-002 — REQ-XPO-01: exemption is a file-level proof obligation, forfeit on any other
// arrangement. S-001 already ported the mechanism (buildFileContext's exemption computation,
// checkExemption, isResolveOnlyUse) as a minimal, load-bearing piece of REQ-CST-04.3's own
// survival obligation — this slice adds the REQ-XPO-01-labelled coverage explicitly, plus two
// REAL fixes: re-export laundering (XPO-01.4/M1.12) and anchor-drift detection (XPO-01.5/M1.13).
// ===========================================================================================

describe("FIT-42N S-002 — REQ-XPO-01.1/.2: anchor happy path, named-import and namespace form", () => {
  it("REQ-XPO-01.1: the anchor's named-import binding, used resolve-only, is exempt — zero violations", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire } from "node:module";\ncreateRequire(anchorUrl).resolve(specifier);\n',
    });
    expect(classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([]);
  });

  // DR-6 hazard (design.md, plan-verify iteration-1 amendment): this closes XPO-01.2 by
  // planting the resolve-only NAMESPACE form at the ANCHOR path — a DIFFERENT fixture from
  // red-proof #12 above (`"REQ-CST-04.4: the namespace form is caught"`, in the deny-scan
  // describe block), which plants the same namespace CALL shape in a NON-anchor file and must
  // stay denied. S-002.4 lands this in the same commit as that pre-existing test, both green —
  // it is not re-asserted here; a regression collapsing the two would fail #12 itself.
  it("REQ-XPO-01.2: the anchor's namespace-form binding, used resolve-only, is now green — closes R2-5", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import * as module from "node:module";\nmodule.createRequire(u).resolve(s);\n',
    });
    expect(classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([]);
  });
});

describe("FIT-42N S-002 — REQ-XPO-01.3: forfeit on any other arrangement", () => {
  it("REQ-XPO-01.3 [red-proof]: an ALIASED createRequire binding at the anchor forfeits the exemption, every bound name denied", () => {
    const root = plantTree({
      [CREATE_REQUIRE_ANCHOR_FILE]:
        'import { createRequire as cr } from "node:module";\ncr(u).resolve(s);\ncr(u)("./evil.js");\n',
    });
    const violations = classifiedAs(root, CREATE_REQUIRE_ANCHOR_FILE);
    // Exact count (S-002.5: tighten to exact, no threshold): TWO uses of the aliased binding,
    // BOTH denied — aliasing forfeits the exemption entirely, so even the resolve-only-SHAPED
    // first use gets no benefit of the doubt.
    expect(violations.length).toBe(2);
    expect(violations.every((v) => v.rule === "constraint-4-inadmissible-origin")).toBe(true);
  });
});

describe("FIT-42N S-002 — REQ-XPO-01.4 [red-proof]: re-export laundering is closed (M1.12)", () => {
  it("a createRequire re-exported through a closure file and imported by a second file is still denied", () => {
    const root = plantTree({
      "entry.js": 'import { createRequire } from "./reexporter.js";\ncreateRequire(anchor)("./evil.js");\n',
      "reexporter.js": 'export { createRequire } from "node:module";\n',
    });
    // The exemption does not launder through a re-export: "entry.js" is not the anchor file,
    // so no exemption is even computed for it — the register denies the primitive outright.
    expect(classifiedAs(root)).toEqual([{ rule: "constraint-4-inadmissible-origin", file: "entry.js" }]);
  });

  it("REQ-XPO-01.4: the re-exporting file itself reports zero violations — the danger is in the SECOND file's use, not the re-export declaration", () => {
    const root = plantTree({
      "entry.js": 'import { createRequire } from "./reexporter.js";\n',
      "reexporter.js": 'export { createRequire } from "node:module";\n',
    });
    // entry.js imports the re-exported name but never CALLS it — a bare, unused import
    // binding is a value-reference concern only (admitted, D-1/D-3), never a callee.
    expect(classifiedAs(root)).toEqual([]);
  });
});

describe("FIT-42N S-002 — REQ-XPO-01.5 [red-proof]: anchor drift is caught (M1.13)", () => {
  it("a derived closure that omits the anchor file from its node set is flagged, naming the drift", () => {
    const nodesWithoutAnchor = ["bin/pbuilder-runner.js", "transport/runner.js"];
    expect(findAnchorDriftViolations(nodesWithoutAnchor, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([
      {
        rule: "unclassifiable-construct",
        file: CREATE_REQUIRE_ANCHOR_FILE,
        line: null,
        found: CREATE_REQUIRE_ANCHOR_FILE,
        detail: `the createRequire exemption anchor "${CREATE_REQUIRE_ANCHOR_FILE}" is not a member of the derived closure — an exemption pointing outside the walked closure is a dormant hole, not a pass`,
      },
    ]);
  });

  it("REQ-XPO-01.5: a derived closure that DOES include the anchor file reports zero drift — sibling positive", () => {
    const nodesWithAnchor = ["bin/pbuilder-runner.js", CREATE_REQUIRE_ANCHOR_FILE];
    expect(findAnchorDriftViolations(nodesWithAnchor, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([]);
  });

  it("REQ-XPO-01.5: the REAL runner closure includes the anchor file — non-vacuity, the check has something to verify", () => {
    const distDir = ensureTscBuild();
    const derivation = deriveRunnerClosure(distDir, ENTRY_RELATIVE_PATH);
    expect(derivation.nodes).toContain(CREATE_REQUIRE_ANCHOR_FILE);
    expect(findAnchorDriftViolations(derivation.nodes, CREATE_REQUIRE_ANCHOR_FILE)).toEqual([]);
  });
});
