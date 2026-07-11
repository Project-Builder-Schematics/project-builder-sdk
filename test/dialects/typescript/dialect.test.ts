/**
 * S-002 — the real TypeScript dialect (ts-morph). REQ-TSD-01 (subpath/vocabulary base
 * cases) + REQ-TSD-02 (determinism pins) — the byte-pair, self-consistency, explicit
 * newLineKind, and language-service-formatter-never-invoked assertions. TSD-03/04 edge
 * scenarios (empty/CRLF/BOM/4MiB/malformed source) are S-003 scope.
 *
 * Every content assertion is byte-exact against a committed golden (constraint 7) — never a
 * count-only or "reflects" assertion.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SourceFile, NewLineKind } from "ts-morph";
import { defineFactory } from "../../../src/core/context.ts";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { detectNewLineKind } from "../../../src/dialects/typescript/ast.ts";
import { makeSpyClient } from "../../support/spy-client.ts";

const GOLDEN_DIR = new URL("./golden/", import.meta.url).pathname;
function golden(name: string): string {
  return readFileSync(join(GOLDEN_DIR, name), "utf-8");
}

// Base handle surface every dialect handle carries regardless of its op-pack (ReadOps +
// WriteOps re-declared + raw + PromiseLike + the "found"-only remove) — subtracting this set
// from a handle's own enumerable keys isolates exactly its OP-PACK-derived members.
const BASE_HANDLE_KEYS = new Set(["read", "raw", "modify", "rename", "move", "copy", "remove", "then"]);

describe("TypeScript dialect — REQ-TSD-01 subpath + thin op-pack shape", () => {
  it("REQ-TSD-01.1: the dialect's ops is EXACTLY addImport — any op beyond .raw/addImport/at-most-one-more is absent", async () => {
    const { client } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts");
      const opKeys = Object.keys(handle).filter((k) => !BASE_HANDLE_KEYS.has(k));
      expect(opKeys).toEqual(["addImport"]);
      await handle.addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });
  });

  it("REQ-TSD-01.2: addImport concrete before/after byte pair, matches the committed golden", async () => {
    const { client, emitted } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").addImport("readFileSync", "node:fs");
    });
    await run(undefined, { client });

    const modifies = emitted
      .flatMap((b) => b.instructions)
      .filter((d): d is { op: "modify"; modify: { path: string; content: string } } => d.op === "modify");
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
      const modifies = emitted
        .flatMap((b) => b.instructions)
        .filter((d): d is { op: "modify"; modify: { path: string; content: string } } => d.op === "modify");
      return modifies[0]?.modify.content ?? "";
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
