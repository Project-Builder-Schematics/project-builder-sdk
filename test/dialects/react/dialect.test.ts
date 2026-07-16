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
import * as react from "../../../src/dialects/react/index.ts";
import { find } from "../../../src/dialects/react/index.ts";
import { parse, print } from "../../../src/dialects/react/ast.ts";
import { parse as tsParse } from "../../../src/dialects/typescript/ast.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";

const REACT_GOLDEN_DIR = new URL("./golden/", import.meta.url).pathname;

function reactGolden(name: string): string {
  return golden(name, REACT_GOLDEN_DIR);
}

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

describe("React dialect — REQ-RXD-10 setJsxProp placement, whitespace, and closing-form preservation (S-001)", () => {
  it("REQ-RXD-10.1: the new attribute lands immediately after the last existing attribute, single-space separator, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({
      "Button.tsx": 'const el = <Button type="submit" className={cls} />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "disabled", "{isBusy}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-after-className.txt"));
  });

  it("REQ-RXD-10.2: an inserted prop lands AFTER a trailing spread — explicit prop wins at React runtime, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button {...rest} />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "onClick", "{safe}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-after-spread.txt"));
  });

  it("REQ-RXD-10.3: an update keeps the attribute FIRST — position preserved, only the initializer changes, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({
      "Button.tsx": 'const el = <Button onClick={old} type="submit" />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "onClick", "{fresh}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-update-position-preserved.txt"));
  });

  it("REQ-RXD-10.4: a self-closing element stays self-closing after an insert", async () => {
    const { client, emitted } = makeSpyClient({ "Input.tsx": "const el = <Input />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "required");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe("const el = <Input required />;\n");
  });

  it("REQ-RXD-10.5: a paired element stays paired after an insert, children byte-identical", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button>Save</Button>;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "disabled");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe("const el = <Button disabled>Save</Button>;\n");
  });

  it("REQ-RXD-10.6: an element with attributes spanning multiple lines gets the insert on the LAST attribute's line, byte-exact golden — existing line structure undisturbed", async () => {
    const before = reactGolden("setprop-multiline-before.txt");
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "disabled", "{isBusy}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-multiline-after.txt"));
  });
});
