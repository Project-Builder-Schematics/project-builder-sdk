/**
 * S-002 — the real TypeScript dialect (ts-morph). REQ-TSD-01 (subpath/vocabulary base
 * cases) + REQ-TSD-02 (determinism pins) — the byte-pair, self-consistency, explicit
 * newLineKind, and language-service-formatter-never-invoked assertions.
 *
 * S-003 — REQ-TSD-03 edge scenarios (create/move/copy interaction, two-distinguishable-
 * edits, not-found, empty file, CRLF/BOM, the 4 MiB serialized-side boundary, duplicate
 * addImport) + REQ-TSD-04 (`.raw()`/parse-failure containment against a REAL ts-morph
 * error).
 *
 * Every content assertion is byte-exact against a committed golden (constraint 7) — never a
 * count-only or "reflects" assertion.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SourceFile, NewLineKind } from "ts-morph";
import { defineFactory } from "../../../src/core/context.ts";
import { create } from "../../../src/commons/index.ts";
import { AuthoringError } from "../../../src/core/authoring-error.ts";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { detectNewLineKind, parse, print } from "../../../src/dialects/typescript/ast.ts";
import { addImport } from "../../../src/dialects/typescript/ops.ts";
import type { Directive } from "../../../src/core/wire.ts";
import { BATCH_CAP_BYTES } from "../../../src/core/wire.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";

describe("TypeScript dialect — REQ-TSD-01 subpath + thin op-pack shape", () => {
  // REQ-TSD-01.1's V4 scenario ("ops is EXACTLY addImport") is superseded by spec V5
  // (stage-5b-dialect-breadth): the op-pack now widens incrementally across S-001..S-003.
  // REQ-TSD-01.1's V5 scenario (exact sorted 5-op set) is owned by S-003's
  // `ops-exact-set.test.ts` per design's Test Derivation table — this stale case is removed
  // rather than updated every slice, since its replacement is already scheduled.

  it("REQ-TSD-01.2: addImport concrete before/after byte pair, matches the committed golden", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.path).toBe("a.ts");
    expect(modifies[0]?.modify.content).toBe(golden("add-import-after.txt"));
  });
});

describe("TypeScript dialect — REQ-TSD-02 ts-morph determinism pins", () => {
  it("REQ-TSD-02.1: the same chain run twice against a fresh Project is byte-identical AND matches the golden", async () => {
    const before = golden("add-import-before.txt");
    const after = golden("add-import-after.txt");

    async function runOnce(): Promise<string> {
      const { client, emitted } = makeSpyClient({ "a.ts": before });
      const run = defineFactory<void>(async () => {
        await ts.find("a.ts").addImport("readFileSync", "node:fs");
      });
      await run(undefined, { client });
      return collectModifies(emitted)[0]?.modify.content ?? "";
    }

    const first = await runOnce();
    const second = await runOnce();
    expect(first).toBe(second);
    expect(first).toBe(after);
  });

  it("REQ-TSD-02.2: detectNewLineKind — LF, CRLF-dominant, tie, and empty samples", () => {
    expect(detectNewLineKind("const a = 1;\nconst b = 2;\n")).toBe(NewLineKind.LineFeed);
    expect(detectNewLineKind("const a = 1;\r\nconst b = 2;\r\n")).toBe(NewLineKind.CarriageReturnLineFeed);
    // Tie: one CRLF pair (contributes one \r\n AND one \n) plus one bare \n elsewhere ->
    // crlf=1, totalLf=2, bareLf=1 -> crlf(1) > bareLf(1) is false -> LF.
    expect(detectNewLineKind("a\r\nb\nc")).toBe(NewLineKind.LineFeed);
    expect(detectNewLineKind("")).toBe(NewLineKind.LineFeed);
  });

  it("REQ-TSD-02.2: no host-OS newline source (os.EOL/process.platform) anywhere in the dialect tree", () => {
    const files = ["ast.ts", "ops.ts", "index.ts"].map((f) =>
      readFileSync(join(new URL("../../../src/dialects/typescript/", import.meta.url).pathname, f), "utf-8")
    );
    for (const source of files) {
      expect(source).not.toContain("os.EOL");
      expect(source).not.toContain("process.platform");
    }
  });

  it("REQ-TSD-02.3: the ts-morph language-service formatter is never invoked across a full chain", async () => {
    const formatSpy = spyOn(SourceFile.prototype, "formatText");
    try {
      const { client } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });
      const run = defineFactory<void>(async () => {
        await ts
          .find("a.ts")
          .addImport("readFileSync", "node:fs")
          .raw((ast) => {
            ast.addStatements("const y = 2;");
          });
      });
      await run(undefined, { client });
      expect(formatSpy).not.toHaveBeenCalled();
    } finally {
      formatSpy.mockRestore();
    }
  });
});

function collectDirectives(emitted: Array<{ instructions: Directive[] }>): Directive[] {
  return emitted.flatMap((b) => b.instructions);
}

describe("TypeScript dialect — REQ-TSD-03 edge scenarios (S-003)", () => {
  it("REQ-TSD-03.1: modify-after-create — create THEN dialect find().addImport() in the same run", async () => {
    const { client, emitted } = makeSpyClient({});

    const run = defineFactory<void>(async () => {
      create("new.ts", { template: golden("add-import-before.txt"), options: {} });
      await ts.find("new.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const directives = collectDirectives(emitted);
    expect(directives).toHaveLength(2);
    expect(directives[0]).toEqual({
      op: "create",
      create: { pathTemplate: "new.ts", template: golden("add-import-before.txt"), options: {} },
    });
    expect(directives[1]).toEqual({
      op: "modify",
      modify: { path: "new.ts", content: golden("add-import-after.txt") },
    });
  });

  it("REQ-TSD-03.2: modify-then-move — the coalesced modify targets the ORIGINAL path, the trailing move carries {path, toDir}", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs").move("lib");
    });
    await run(undefined, { client });

    const directives = collectDirectives(emitted);
    expect(directives).toEqual([
      { op: "modify", modify: { path: "a.ts", content: golden("add-import-after.txt") } },
      { op: "move", move: { path: "a.ts", toDir: "lib" } },
    ]);
  });

  it("REQ-TSD-03.9: modify-then-copy — mirrors .2, the coalesced modify targets the ORIGINAL path, the trailing copy carries {from, to}", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs").copy("lib/copied.ts");
    });
    await run(undefined, { client });

    const directives = collectDirectives(emitted);
    expect(directives).toEqual([
      { op: "modify", modify: { path: "a.ts", content: golden("add-import-after.txt") } },
      { op: "copy", copy: { from: "a.ts", to: "lib/copied.ts" } },
    ]);
  });

  it("REQ-TSD-03.3: two distinguishable edits (named op + .raw, disjoint footprints), no read between them, ONE modify reflecting both", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts
        .find("a.ts")
        .addImport("existsSync", "node:fs")
        .raw((ast) => {
          ast.addStatements("export const w = 4;");
        });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'import { existsSync } from "node:fs";\n\nconst x = 1;\nexport const w = 4;\n'
    );
  });

  it("REQ-TSD-03.4: modify-on-nonexistent — rejects with the pinned, quoted not-found message", async () => {
    const { client } = makeSpyClient({});

    const run = defineFactory<void>(async () => {
      await ts.find("missing.ts").addImport("readFileSync", "node:fs");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      'dialect operation failed: "missing.ts" does not exist — create it first in this run'
    );
    expect((caught as Error).cause).toBeUndefined();
  });

  it("REQ-TSD-03.5: empty file — addImport round-trips byte-exact plus the import, no spurious whitespace", async () => {
    const { client, emitted } = makeSpyClient({ "empty.ts": "" });

    const run = defineFactory<void>(async () => {
      await ts.find("empty.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("empty-add-import-after.txt"));
  });

  it("REQ-TSD-03.6: CRLF + UTF-8 BOM — round-tripped with no edit is byte-exact, BOM and CRLF both preserved", () => {
    const seeded = golden("crlf-bom-round-trip.txt");
    const roundTripped = print(parse(seeded));
    expect(roundTripped).toBe(seeded);
  });

  it("REQ-TSD-03.8: CRLF + addImport — the inserted import line uses the SAME CRLF newLineKind as the rest of the file", async () => {
    const { client, emitted } = makeSpyClient({ "crlf.ts": golden("crlf-add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("crlf.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("crlf-add-import-after.txt"));
    expect(modifies[0]?.modify.content).toContain("\r\n");
  });

  it("REQ-TSD-03.10: duplicate addImport(x, m) twice on one handle is idempotent — a single import line, no duplicates", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(golden("add-import-after.txt"));
    const importLines = modifies[0]!.modify.content.split("\n").filter((l) => l.startsWith("import "));
    expect(importLines).toHaveLength(1);
  });

  // REQ-TSD-03.7: multibyte-UTF-8 fixture sized so RAW bytes < BATCH_CAP_BYTES <= SERIALIZED
  // (JSON-stringified) bytes — a block comment's `"` characters need no TS-level escaping
  // (ts-morph round-trips them verbatim in a comment) but cost 2 JSON-serialized bytes each
  // (`\"`) once printed content becomes a modify directive's `content` field. Deterministic
  // arithmetic (Stage-1 lesson, mirrors test/fake/batch-cap-fixtures.ts's `"`-padding
  // technique), no search/iteration — proves the cap check trips on the SERIALIZED side,
  // never on raw content size, and that the run rejects cleanly (never silently truncates).
  it("REQ-TSD-03.7: 4 MiB boundary — accepted under the cap, or rejected AT the cap, never silently truncated", async () => {
    const CAP_PATH = "cap-boundary.ts";

    function printedAfterAddImport(commentBody: string): string {
      const ast = parse(`/*${commentBody}*/\nconst x = 1;\n`);
      addImport(ast, "readFileSync", "node:fs");
      return print(ast);
    }
    function serializedModifyBytes(content: string): number {
      const batch = {
        protocolVersion: 1,
        force: false,
        instructions: [{ op: "modify", modify: { path: CAP_PATH, content } }],
      };
      return Buffer.byteLength(JSON.stringify(batch), "utf8");
    }

    // Probe with an empty comment body to measure the fixed envelope + import overhead,
    // then pad with '"' (1 raw byte -> 2 serialized bytes) to land EXACTLY one byte over
    // BATCH_CAP_BYTES in serialized form.
    const probeSerialized = serializedModifyBytes(printedAfterAddImport(""));
    const targetSerialized = BATCH_CAP_BYTES + 1;
    const deficit = targetSerialized - probeSerialized;
    const quoteCount = Math.floor(deficit / 2);
    const remainder = deficit - quoteCount * 2;
    const commentBody = '"'.repeat(quoteCount) + "a".repeat(remainder);
    const seed = `/*${commentBody}*/\nconst x = 1;\n`;

    const printed = printedAfterAddImport(commentBody);
    const raw = Buffer.byteLength(printed, "utf8");
    const serialized = serializedModifyBytes(printed);
    // Fixture property (mutant-killer, mirrors batch-cap-fixtures.ts): raw print bytes stay
    // under the cap while the serialized envelope sails over it — the multibyte/escaping
    // expansion crosses the cap only after serialization, never before.
    expect(raw).toBeLessThan(BATCH_CAP_BYTES);
    expect(serialized).toBeGreaterThan(BATCH_CAP_BYTES);

    const { client } = makeSpyClient({ [CAP_PATH]: seed });
    const run = defineFactory<void>(async () => {
      await ts.find(CAP_PATH).addImport("readFileSync", "node:fs");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    // Rejected cleanly at the cap — never silently truncated (no partial/corrupted commit).
    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toBe("changes-too-large");
  });
});

describe("TypeScript dialect — REQ-TSD-04 .raw() and unparseable-content containment (S-003)", () => {
  it("REQ-TSD-04.1: a real ts-morph parse failure on malformed TypeScript is contained per REQ-DG-05's contract", async () => {
    // Genuinely syntactically invalid TypeScript (unclosed function params, missing
    // expression) — ts-morph's parser is fault-tolerant and records diagnostics rather than
    // throwing natively; ast.parse (src/dialects/typescript/ast.ts) surfaces this as a real
    // throw via a post-parse syntactic-diagnostics check (apply-progress batch 2, item #3).
    const malformed = "const x = ;\nfunction ( { }\n";
    const { client } = makeSpyClient({ "bad.ts": malformed });

    const run = defineFactory<void>(async () => {
      await ts.find("bad.ts").addImport("readFileSync", "node:fs");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: could not parse "bad.ts" as TypeScript');
    // The strongest proof of the no-leak guarantee: `.cause` is absent even though the
    // underlying error here is a REAL ts-morph error, not a mock (constraint 3).
    expect((caught as Error).cause).toBeUndefined();
  });
});
