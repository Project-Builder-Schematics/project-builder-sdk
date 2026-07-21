/**
 * S-000 (`ts-addimport-collision`) — the ported V8 happy-path algorithm (design §4.3/§4.4,
 * spec REQ-TSD-01 Steps 1/3/4 only; Step 2 collision is DEFERRED to S-001). Every content
 * assertion is byte-exact against a committed golden (constraint 7).
 *
 * Covers REQ-TSD-01.5 (merge), .10/.11/.12/.13/.31 (idempotency — default/namespace/named),
 * .19 (fresh create).
 *
 * S-001 — the file-wide collision reject (Step 2, design §4.4). Every REJECT row asserts the
 * dual observable REQ-TSD-01 defines battery-wide: synchronous throw + the target file
 * BYTE-UNCHANGED on re-read after the catch. Every row also asserts the collision-specific
 * "already exists" distinguishing substring (QA M4) — the shared "dialect operation failed: "
 * prefix alone discriminates nothing.
 *
 * S-002 — REQ-TSD-13's injection-safety validation gate. Same dual-observable reject shape as
 * S-001's collision rejects (throw + zero directives/byte-unchanged), but PATH-LESS (design
 * §4.4, two deliberate reject shapes) — `expectCollisionReject` below is reused as-is for both,
 * since the mechanics it asserts are shape-identical; only the message-content assertions in
 * each `it()` differ per reject kind.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";
import { defineFactory } from "../../../src/core/context.ts";

async function expectCollisionReject(
  seed: string,
  callArgs: [name: string, from: string]
): Promise<{ err: Error; content: string | undefined }> {
  const { client } = makeSpyClient({ "a.ts": seed });

  const run = defineFactory<void>(async () => {
    await ts.find("a.ts").addImport(...callArgs);
  });

  let caught: unknown;
  try {
    await run(undefined, { client });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  const err = caught as Error;
  expect(err.cause).toBeUndefined();
  const content = await client.read("a.ts");
  expect(content).toBe(seed);
  return { err, content };
}

describe("addImport — REQ-TSD-01 Steps 1/3/4 (S-000, ts-addimport-collision)", () => {
  it("REQ-TSD-01.5: merges into an existing non-type-only named clause", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("merge-add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("merge-add-import-after.txt"));
  });

  it("REQ-TSD-01.10: default import, SAME local name — idempotent no-op, byte-identical", async () => {
    const seed = 'import Def from "m";\n';
    const { client, emitted } = makeSpyClient({ "a.ts": seed });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Def", "m");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("a.ts")).toBe(seed);
  });

  it("REQ-TSD-01.11: default import, DIFFERENT name — separate named decl inserted, default untouched", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import Def from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Other", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import Def from "m";\nimport { Other } from "m";\n');
  });

  it("REQ-TSD-01.12: namespace import, DIFFERENT name — separate named decl inserted, no throw, namespace untouched", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import * as ns from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import * as ns from "m";\nimport { X } from "m";\n');
  });

  it("REQ-TSD-01.13: namespace import, SAME local name — idempotent no-op, byte-identical", async () => {
    const seed = 'import * as ns from "m";\n';
    const { client, emitted } = makeSpyClient({ "a.ts": seed });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("ns", "m");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("a.ts")).toBe(seed);
  });

  it("REQ-TSD-01.19: no prior declaration for the module — fresh separate import inserted", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-import-after.txt"));
  });

  it("REQ-TSD-01.31: unaliased named specifier, SAME local name — idempotent no-op, byte-identical", async () => {
    const seed = 'import { X } from "m";\n';
    const { client, emitted } = makeSpyClient({ "a.ts": seed });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "m");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("a.ts")).toBe(seed);
  });
});

describe("addImport — REQ-TSD-01 Step 2 collision reject (S-001, ts-addimport-collision)", () => {
  it("REQ-TSD-01.6: type-only DECLARATION collision — rejects before any AST mutation", async () => {
    const { err } = await expectCollisionReject('import type { X } from "m";\n', ["X", "m"]);
    expect(err.message).toContain('addImport("X")');
    expect(err.message).toContain('a value or import binding named "X" already exists');
  });

  it("REQ-TSD-01.8: inline `{ type X }` specifier-level type-only collision — rejects the same way as .6", async () => {
    const { err } = await expectCollisionReject('import { type X } from "m";\n', ["X", "m"]);
    expect(err.message).toContain('addImport("X")');
    expect(err.message).toContain('a value or import binding named "X" already exists');
  });

  it("REQ-TSD-01.14: aliased-to-a-different-name collision — a second unaliased specifier would duplicate the local name", async () => {
    const { err } = await expectCollisionReject('import { Foo as x } from "m";\n', ["x", "m"]);
    expect(err.message).toContain('addImport("x")');
    expect(err.message).toContain('a value or import binding named "x" already exists');
  });

  it("REQ-TSD-01.16: cross-module collision — the claimed scan is file-wide, not scoped to the SAME module", async () => {
    const { err } = await expectCollisionReject('import { readFileSync } from "node:fs";\n', [
      "readFileSync",
      "./local",
    ]);
    expect(err.message).toContain('addImport("readFileSync")');
    expect(err.message).toContain('a value or import binding named "readFileSync" already exists');
  });

  it("REQ-TSD-01.17: every value-namespace declaration kind claims its name — 8-kind battery, each isolated", async () => {
    const kinds: Array<{ label: string; seed: string }> = [
      { label: "function", seed: "function Icon() {}\n" },
      { label: "const", seed: "const Icon = 1;\n" },
      { label: "let", seed: "let Icon = 1;\n" },
      { label: "var", seed: "var Icon = 1;\n" },
      { label: "class", seed: "class Icon {}\n" },
      { label: "enum", seed: "enum Icon { A }\n" },
      { label: "namespace", seed: "namespace Icon {}\n" },
      { label: "export default function (8th kind, QA L1)", seed: "export default function Icon() {}\n" },
    ];

    for (const { label, seed } of kinds) {
      const { err } = await expectCollisionReject(seed, ["Icon", "./icons"]);
      expect(err.message).toContain('addImport("Icon")');
      expect(err.message).toContain('a value or import binding named "Icon" already exists');
      // Label surfaces which kind failed if this loop's assertion above ever fails.
      expect(label).toBeTruthy();
    }
  });

  it("REQ-TSD-01.26: type-only DEFAULT specifier collision — reaches the default-specifier code path, not only named", async () => {
    const { err } = await expectCollisionReject('import type Def from "m";\n', ["Def", "m"]);
    expect(err.message).toContain('addImport("Def")');
    expect(err.message).toContain('a value or import binding named "Def" already exists');
  });

  it("REQ-TSD-01.27: type-only NAMESPACE specifier collision — the namespace-specifier mirror of .26", async () => {
    const { err } = await expectCollisionReject('import type * as NS from "m";\n', ["NS", "m"]);
    expect(err.message).toContain('addImport("NS")');
    expect(err.message).toContain('a value or import binding named "NS" already exists');
  });

  it("REQ-TSD-01.28: aliased-underlying merge — GREEN pair for .14, claimed-scan keys on LOCAL NAME not exported name", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { Foo as x } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Foo", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { Foo as x, Foo } from "m";\n');
  });

  it("REQ-TSD-01.32: collision tail echoes a realistic 29-char name IN FULL, never truncated", async () => {
    const { err } = await expectCollisionReject('const NotificationPreferencesPanel = 1;\n', [
      "NotificationPreferencesPanel",
      "./somewhere",
    ]);
    expect(err.message).toContain("NotificationPreferencesPanel");
  });
});

describe("addImport — REQ-TSD-01 input-shape variants (S-003, ts-addimport-collision)", () => {
  it("REQ-TSD-01.7: type-only declaration, DIFFERENT name — succeeds, the type-only decl is untouched", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import type { X } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Y", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import type { X } from "m";\nimport { Y } from "m";\n');
  });

  it("REQ-TSD-01.9: type-only ALIASED specifier — X was never claimed (only XT was), separate import inserted", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import type { X as XT } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import type { X as XT } from "m";\nimport { X } from "m";\n');
  });

  it("REQ-TSD-01.15: self-alias `{ X as X }` — idempotent no-op (owner-ratified V8 deviation)", async () => {
    const seed = 'import { X as X } from "m";\n';
    const { client, emitted } = makeSpyClient({ "a.ts": seed });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "m");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("a.ts")).toBe(seed);
  });

  it("REQ-TSD-01.18: top-level `type` alias — not in the value namespace, separate import inserted", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "type Icon = string;\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Icon", "./icons");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { Icon } from "./icons";\n\ntype Icon = string;\n');
  });

  it("REQ-TSD-01.18: top-level `interface` — not in the value namespace, separate import inserted", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "interface Icon {\n  x: number;\n}\n" });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Icon", "./icons");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'import { Icon } from "./icons";\n\ninterface Icon {\n  x: number;\n}\n'
    );
  });

  it("REQ-TSD-01.20: side-effect import preserved byte-unchanged, separate named decl added (Class B)", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import "polyfill";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "polyfill");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import "polyfill";\nimport { X } from "polyfill";\n');
  });

  it("REQ-TSD-01.21: directive prologue — import lands AFTER it, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("directive-add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("directive-add-import-after.txt"));
  });

  it("REQ-TSD-01.21 (triangulation): TWO leading directives — both preserved, import lands after both", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": '"use strict";\n"use client";\nconst x = 1;\n',
    });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      '"use strict";\n"use client";\n\nimport { readFileSync } from "node:fs";\n\nconst x = 1;\n'
    );
  });

  it("REQ-TSD-01.22: multiple declarations for the same module — merges into the FIRST (source order)", async () => {
    const { client, emitted } = makeSpyClient({
      "a.ts": 'import { a } from "m";\nimport { b } from "m";\n',
    });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("c", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { a, c } from "m";\nimport { b } from "m";\n');
  });

  it("REQ-TSD-01.23: empty named-import clause `{}` is a valid merge target", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import {} from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { X } from "m";\n');
  });

  it("REQ-TSD-01.29: mixed default+named declaration — merge adds to the named clause, default untouched", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import Def, { B } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("C", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import Def, { B, C } from "m";\n');
  });

  it("REQ-TSD-01.30: mixed default+named declaration — matching the default name is a no-op", async () => {
    const seed = 'import Def, { B } from "m";\n';
    const { client, emitted } = makeSpyClient({ "a.ts": seed });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("Def", "m");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("a.ts")).toBe(seed);
  });
});

describe("addImport — REQ-TSD-13 injection-safety validation gate (S-002, ts-addimport-collision)", () => {
  it("REQ-TSD-13.1: confirmed injection breakout name rejects, zero imports, zero echo of the hostile payload", async () => {
    const hostileName = 'x } from "evil"; import { y';
    const { err } = await expectCollisionReject("const x = 1;\n", [hostileName, "react"]);
    expect(err.message).toContain("`name`");
    expect(err.message).toContain("valid JavaScript identifier");
    expect(err.message).not.toContain("evil");
    expect(err.message).not.toContain("x }");
    expect(err.message).not.toContain("import { y");
  });

  it("REQ-TSD-13.2: the 48-entry reserved-word/strict-mode-restricted set rejects pre-mutation, ≤16-char echo", async () => {
    const reservedWords = [
      "default", "import", "class", "null", "this", "function", "let", "yield", "await", "eval", "arguments",
    ];
    for (const word of reservedWords) {
      const { err } = await expectCollisionReject("const x = 1;\n", [word, "m"]);
      expect(err.message).toContain(`"${word}"`);
      expect(err.message).toContain("reserved word");
    }
  });

  it("REQ-TSD-13.2: the SEPARATE 3-entry JSX_NAME_DENYLIST rejects pre-mutation via its own check, ≤16-char echo", async () => {
    const denylisted = ["__proto__", "constructor", "prototype"];
    for (const word of denylisted) {
      const { err } = await expectCollisionReject("const x = 1;\n", [word, "m"]);
      expect(err.message).toContain(`"${word}"`);
      expect(err.message).toContain("reserved name");
    }
  });

  it("REQ-TSD-13.2: names merely CONTAINING a reserved/denylisted word as a substring are accepted, never rejected", async () => {
    const lookalikes = ["classroom", "imported", "defaultValue", "evaluate", "argumentsList"];
    for (const name of lookalikes) {
      const { client, emitted } = makeSpyClient({ "a.ts": "const x = 1;\n" });

      const run = defineFactory<void>(async () => {
        await ts.find("a.ts").addImport(name, "m");
      });
      await run(undefined, { client });

      expect(collectModifies(emitted)).toHaveLength(1);
    }
  });

  it("REQ-TSD-13.3: grammar-invalid names reject pre-mutation, zero echo of the rejected value", async () => {
    const invalidNames = ["", "   ", "123abc", "Foo bar", "Foo=1}"];
    for (const name of invalidNames) {
      const { err } = await expectCollisionReject("const x = 1;\n", [name, "m"]);
      expect(err.message).toContain("valid JavaScript identifier");
      if (name.trim() !== "") {
        expect(err.message).not.toContain(name);
      }
    }
  });

  it('REQ-TSD-13.4: a hostile `from` attempting to terminate its own string literal stays ONE escaped import, no "evil" import', async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": "const x = 1;\n" });
    const hostileFrom = 'a"; import {y} from "evil';

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("X", hostileFrom);
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]?.modify.content;
    expect(content).toBe('import { X } from "a\\"; import {y} from \\"evil";\n\nconst x = 1;\n');
    expect(content?.match(/^import /gm)).toHaveLength(1);
    expect(content).not.toContain('from "evil"');
  });

  it("REQ-TSD-13.6: a name BOTH denylisted AND value-namespace-claimed rejects via validation, never collision", async () => {
    const { err } = await expectCollisionReject("const __proto__ = 1;\n", ["__proto__", "m"]);
    expect(err.message).toContain("reserved name");
    expect(err.message).not.toContain("already exists");
  });
});

describe("addImport — REQ-TSD-13.x-neg: a validation reject NEVER carries the collision path clause (S-002)", () => {
  it('a grammar-failure validation reject never contains `on "{path}"`', async () => {
    const { err } = await expectCollisionReject("const x = 1;\n", ["123abc", "m"]);
    expect(err.message).not.toContain('on "a.ts"');
  });

  it('a reserved-word validation reject never contains `on "{path}"`', async () => {
    const { err } = await expectCollisionReject("const x = 1;\n", ["default", "m"]);
    expect(err.message).not.toContain('on "a.ts"');
  });

  it('a denylist validation reject never contains `on "{path}"`', async () => {
    const { err } = await expectCollisionReject("const x = 1;\n", ["__proto__", "m"]);
    expect(err.message).not.toContain('on "a.ts"');
  });
});

describe("addImport JSDoc — REQ-TSD-13.5 trust-boundary guard (S-002, ts-addimport-collision)", () => {
  const OPS_SOURCE = readFileSync(
    new URL("../../../src/dialects/typescript/ops.ts", import.meta.url).pathname,
    "utf-8"
  );

  it("affirmatively names addFunction/addVariable/addClass as still-raw, unvalidated ops — never a passive disclaimer", () => {
    const trustBoundaryBlock = OPS_SOURCE.match(/\/\*\*[\s\S]*?Trust boundary[\s\S]*?\*\//)?.[0];
    expect(trustBoundaryBlock).toBeDefined();

    expect(trustBoundaryBlock).toContain("addFunction");
    expect(trustBoundaryBlock).toContain("addVariable");
    expect(trustBoundaryBlock).toContain("addClass");
    expect(trustBoundaryBlock).toContain("RAW-SPLICED");
    expect(trustBoundaryBlock).not.toContain("not covered here");
  });
});
