/**
 * S-002 — `removeImport` structured op (REQ-TSD-08.1/08.2/08.3/08.5, design §4.4).
 * Every content assertion is byte-exact against a committed golden (constraint 7).
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { dryRun } from "../../../src/commons/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";
import { defineFactory } from "../../../src/core/context.ts";

describe("removeImport — REQ-TSD-08", () => {
  it("REQ-TSD-08.1: sibling-binding survives byte-exact", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { a, b } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").removeImport("a", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import { b } from "m";\n');
  });

  it("REQ-TSD-08.2: last binding deletes the whole import statement — no dangling import", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { a } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").removeImport("a", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).not.toContain("import");
    expect(modifies[0]?.modify.content).toBe("");
  });

  it("REQ-TSD-08.3: aliased specifier matched by module-exported name, not the local alias", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import { readFileSync as rf } from "node:fs";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").removeImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("");
  });

  it("REQ-TSD-08.5: dryRun() previews the planned modify for a destructive op before commit", async () => {
    const { client } = makeSpyClient({ "a.ts": golden("add-import-after.txt") });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts").removeImport("readFileSync", "node:fs");
      await handle;
      expect(dryRun()).toEqual([{ verb: "modify", path: "a.ts" }]);
    });
    await run(undefined, { client });
  });

  // Out-of-spec-scope defensive coverage (verify-in-loop-2.md CRITICAL finding #1): removeImport's
  // whole-statement-deletion guard also checks getDefaultImport()/getNamespaceImport() before
  // deleting the declaration on the last named binding. REQ-TSD-08 itself only covers named-binding
  // imports; this guard exists purely to avoid corrupting a default/namespace import that happens to
  // share the declaration. Only the default-import conjunct is reachable: TypeScript's import-clause
  // grammar never allows a NamespaceImport to coexist with NamedImports on the same declaration (only
  // `import * as ns from "m"` XOR `import { a } from "m"`, either optionally paired with a default) —
  // ts-morph cannot parse a fixture where getNamedImports().length > 0 and getNamespaceImport() is
  // defined, so that conjunct is unreachable-but-harmless dead code, not an untested live branch.
  it("default import survives when its sibling named binding is the last one removed", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": 'import def, { a } from "m";\n' });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").removeImport("a", "m");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe('import def from "m";\n');
  });
});
