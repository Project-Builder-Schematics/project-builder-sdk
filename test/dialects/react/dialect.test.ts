/**
 * S-000 — the React dialect walking skeleton. REQ-RXD-02 (`.tsx`-only synchronous extension
 * gate at `find()`) + REQ-RXD-03 (ts-morph `ScriptKind.Tsx` parse/print fidelity, proven by
 * both round-trip and mode-engagement divergence).
 *
 * The op-pack is EMPTY at this slice (`setJsxProp`/`addImport` arrive S-001/S-002) — REQ-RXD-
 * 02.4's "an op runs" scenario is exercised via the universal `.modify()` escape hatch, the
 * only op-shaped verb this slice has.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../../src/core/context.ts";
import { find } from "../../../src/dialects/react/index.ts";
import { parse, print } from "../../../src/dialects/react/ast.ts";
import { parse as tsParse } from "../../../src/dialects/typescript/ast.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

describe("React dialect — REQ-RXD-02 extension gate (.tsx-only, synchronous at find())", () => {
  it("REQ-RXD-02.1: a .ts path is rejected, the message names @pbuilder/sdk/typescript as the fix", () => {
    expect(() => find("Component.ts")).toThrow(/@pbuilder\/sdk\/typescript/);
  });

  it("REQ-RXD-02.2: a .jsx path is rejected, stating v1 non-support and naming the follow-up", () => {
    let caught: unknown;
    try {
      find("Component.jsx");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain(".jsx");
    expect(message.toLowerCase()).toContain("v1");
    expect(message.toLowerCase()).toContain("follow-up");
  });

  it("REQ-RXD-02.3: an unrelated extension (.md) is rejected with the generic .tsx-only message", () => {
    expect(() => find("README.md")).toThrow(/\.tsx is the only extension/);
  });

  it("REQ-RXD-02.4: a .tsx path proceeds past the gate — the handle parses and an op flushes", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const x = <div />;\n" });

    const run = defineFactory<void>(async () => {
      await find("Button.tsx").modify((ast) => {
        ast.addStatements("const y = 1;");
      });
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toContain("const y = 1;");
  });

  it("REQ-RXD-02.5: the find() call itself throws synchronously — no op chained, no run flush", () => {
    expect(() => find("a.ts")).toThrow();
  });

  it("REQ-RXD-02.8: dotfile (.babelrc) and trailing-dot (Button.) basenames reject via the suffix rule", () => {
    let dotfileErr: unknown;
    try {
      find(".babelrc");
    } catch (err) {
      dotfileErr = err;
    }
    let trailingDotErr: unknown;
    try {
      find("Button.");
    } catch (err) {
      trailingDotErr = err;
    }

    expect((dotfileErr as Error).message).toContain(".tsx is the only extension");
    expect((trailingDotErr as Error).message).toContain(".tsx is the only extension");
  });

  it("REQ-RXD-02.9: an extensionless basename rejects, naming the explicit-.tsx requirement", () => {
    let caught: unknown;
    try {
      find("src/Button");
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe(
      "dialect operation failed: find(path) — the React dialect requires an explicit .tsx extension; " +
        "received a path with no extension. Append .tsx to the path."
    );
  });

  it("REQ-RXD-02.10: a dotted DIRECTORY segment does not count as an extension — same reject as .9", () => {
    let caught: unknown;
    try {
      find("src/v1.2/Button");
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe(
      "dialect operation failed: find(path) — the React dialect requires an explicit .tsx extension; " +
        "received a path with no extension. Append .tsx to the path."
    );
  });
});

describe("React dialect — REQ-RXD-03 ts-morph ScriptKind.Tsx parse/print fidelity", () => {
  it("REQ-RXD-03.1: JSX round-trips byte-exact — fragments, self-closing tags, expression containers", () => {
    const source =
      "const el = (\n" +
      "  <>\n" +
      "    <input disabled />\n" +
      "    <span>{count}</span>\n" +
      "  </>\n" +
      ");\n";
    expect(print(parse(source))).toBe(source);
  });

  it("REQ-RXD-03.2: a leading UTF-8 BOM is preserved byte-exact across a no-edit round trip", () => {
    const source = "﻿const el = <div>hi</div>;\n";
    expect(print(parse(source))).toBe(source);
  });

  it("REQ-RXD-03.3: CRLF line endings are preserved byte-exact across a no-edit round trip", () => {
    const source = "const el = (\r\n  <div>\r\n    hi\r\n  </div>\r\n);\r\n";
    expect(print(parse(source))).toBe(source);
  });

  it("REQ-RXD-03.4: the TSX-only trailing-comma generic-arrow form round-trips byte-exact", () => {
    const source = "const id = <T,>(a: T) => a;\n";
    expect(print(parse(source))).toBe(source);
  });

  it("REQ-RXD-03.5: an angle-bracket cast REJECTS under Tsx — the same source parses cleanly under .ts, proving ScriptKind.Tsx is live", () => {
    const source = "const x = <string>y;\n";
    expect(() => parse(source)).toThrow();
    expect(() => tsParse(source)).not.toThrow();
  });
});
