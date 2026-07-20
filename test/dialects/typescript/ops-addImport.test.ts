/**
 * S-000 (`ts-addimport-collision`) — the ported V8 happy-path algorithm (design §4.3/§4.4,
 * spec REQ-TSD-01 Steps 1/3/4 only; Step 2 collision is DEFERRED to S-001). Every content
 * assertion is byte-exact against a committed golden (constraint 7).
 *
 * Covers REQ-TSD-01.5 (merge), .10/.11/.12/.13/.31 (idempotency — default/namespace/named),
 * .19 (fresh create).
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";
import { defineFactory } from "../../../src/core/context.ts";

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
  });
});
