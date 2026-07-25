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
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CREATE_REQUIRE_ANCHOR_FILE,
  SANCTIONED_DYNAMIC_IMPORT_FILE,
  comparePaths,
  deriveRunnerClosure,
  renderViolations,
} from "../../scripts/derive-runner-closure.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

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

  it("REQ-CST-04.1: a createRequire call outside the anchored site is a Constraint-4 violation", () => {
    const root = plantTree({
      "entry.js": 'import { createRequire } from "node:module";\ncreateRequire(anchor)("./x.js");\n',
    });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-execution-primitive", file: "entry.js" },
      { rule: "constraint-4-execution-primitive", file: "entry.js" },
    ]);
  });

  it("REQ-CST-04.4: the indirect-variable form is caught, not just the direct call", () => {
    const root = plantTree({ "entry.js": "const req = createRequire(anchor);\nreq('./x.js');\n" });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-execution-primitive", file: "entry.js" },
    ]);
  });

  it("REQ-CST-04.4: the namespace form is caught", () => {
    const root = plantTree({
      "entry.js": 'import * as m from "node:module";\nm.createRequire(anchor)("./x.js");\n',
    });
    expect(classifiedAs(root)).toEqual([
      { rule: "constraint-4-execution-primitive", file: "entry.js" },
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
      { rule: "constraint-4-execution-primitive", file: CREATE_REQUIRE_ANCHOR_FILE },
    ]);
  });

  it("REQ-CST-06.1: a rendered violation names the src file to edit, the rule, and the no-manifest outcome", () => {
    const root = plantTree({ "transport/entry.js": 'import { Project } from "ts-morph";\n' });
    const rendered = renderViolations(
      deriveRunnerClosure(root, "transport/entry.js").violations,
      { distDirName: "dist", srcDirName: "src" }
    );
    expect(rendered).toContain("runner-manifest: src/transport/entry.ts");
    expect(rendered).toContain("(emitted: dist/transport/entry.js:1)");
    expect(rendered).toContain("Constraint 3 — no bare third-party specifier inside the closure.");
    expect(rendered).toContain("No manifest was written; dist/runner-manifest.json does not exist.");
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
      { rule: "constraint-4-execution-primitive", file: "p1.js" },
      { rule: "constraint-4-execution-primitive", file: "p2.js" },
      { rule: "constraint-4-execution-primitive", file: "p3.js" },
      { rule: "constraint-4-execution-primitive", file: "p4.js" },
      { rule: "constraint-4-execution-primitive", file: "p5.js" },
    ]);
  });
});
