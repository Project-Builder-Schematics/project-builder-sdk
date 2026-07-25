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
  sha256File,
} from "../../scripts/derive-runner-closure.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import {
  findBomOffenders,
  findCrlfOffenders,
  findPathHygieneViolations,
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
    expect(rendered).toContain("runner-manifest: src/entry.ts");
    expect(rendered).toContain("(emitted: dist/entry.js:1)");
    expect(rendered).toContain('import "file:///etc/passwd";');
  });

  // RP-13.
  it("REQ-RCD-03.2: an unresolvable specifier names the importer, the specifier and the attempted path", () => {
    const rendered = renderedFor(
      plantTree({ "core/entry.js": 'import "./missing.js";\n' }),
      "core/entry.js"
    );
    expect(rendered).toContain("src/core/entry.ts");
    expect(rendered).toContain('import "./missing.js";');
    expect(rendered).toContain("core/missing.js");
  });

  it("REQ-RCD-03.4: a query-suffixed specifier is reported as a classification failure naming the suffix", () => {
    const rendered = renderedFor(
      plantTree({ "entry.js": 'import "./a.js?v=1";\n', "a.js": "export const a = 1;\n" })
    );
    expect(rendered).toContain("could not be classified");
    expect(rendered).toContain('query or fragment in "./a.js?v=1"');
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
      expect(rendered).toContain("closure file could not be read");
      expect(rendered).toContain("(emitted: dist/locked.js)");
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
});
