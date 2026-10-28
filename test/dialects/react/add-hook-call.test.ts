import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function addHook(source: string, component: string, statement: string) {
  const { client, emitted } = makeSpyClient({ "Form.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("Form.tsx").addHookCall(component, statement);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("Form.tsx") };
}

const FORM =
  "export function Form() {\n" +
  "  const [name, setName] = useState(\"\");\n" +
  "  const submit = () => save(name);\n" +
  "  return <form onSubmit={submit} />;\n" +
  "}\n";

describe("addHookCall", () => {
  it("inserts after the component's leading hook calls, at the body's indentation", async () => {
    const { caught, modifies } = await addHook(FORM, "Form", "const t = useTranslation();");

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      "export function Form() {\n" +
        "  const [name, setName] = useState(\"\");\n" +
        "  const t = useTranslation();\n" +
        "  const submit = () => save(name);\n" +
        "  return <form onSubmit={submit} />;\n" +
        "}\n"
    );
  });

  it("inserts first when the body has no hook calls", async () => {
    const source = "function Card() {\n  return <div />;\n}\n";
    const { modifies } = await addHook(source, "Card", "useEffect(() => track(), []);");

    expect(modifies[0]?.modify.content).toBe("function Card() {\n  useEffect(() => track(), []);\n  return <div />;\n}\n");
  });

  it("finds a const arrow component", async () => {
    const source = "export const Card = () => {\n  return <div />;\n};\n";
    const { modifies } = await addHook(source, "Card", "const ref = useRef(null);");

    expect(modifies[0]?.modify.content).toBe("export const Card = () => {\n  const ref = useRef(null);\n  return <div />;\n};\n");
  });

  it("finds a default-exported function component", async () => {
    const source = "export default function Page() {\n  return <main />;\n}\n";
    const { modifies } = await addHook(source, "Page", "const router = useRouter();");

    expect(modifies[0]?.modify.content).toBe(
      "export default function Page() {\n  const router = useRouter();\n  return <main />;\n}\n"
    );
  });

  it("an identical statement already in the body is a no-op", async () => {
    const { caught, modifies } = await addHook(FORM, "Form", 'const [name, setName] = useState("");');

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("an expression-bodied arrow component rejects, leaving the file unchanged", async () => {
    const source = "const Card = () => <div />;\n";
    const { caught, modifies, content } = await addHook(source, "Card", "const ref = useRef(null);");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("expression body");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(source);
  });

  it("a missing component rejects naming it", async () => {
    const { caught, modifies } = await addHook(FORM, "Missing", "const t = useTranslation();");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("no component named `Missing`");
    expect(modifies).toHaveLength(0);
  });

  it("a wrapped component is not found", async () => {
    const source = "const Card = memo(() => {\n  return <div />;\n});\n";
    const { caught } = await addHook(source, "Card", "const ref = useRef(null);");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("no component named `Card`");
  });

  it("an invalid component name rejects before any mutation", async () => {
    const { caught, modifies } = await addHook(FORM, "not-valid", "const t = useTranslation();");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`component`");
    expect(modifies).toHaveLength(0);
  });

  for (const [label, statement] of [
    ["two statements", "const a = useA(); const b = useB();"],
    ["unparseable code", "const = ;"],
    ["an empty string", ""],
  ] as const) {
    it(`rejects ${label} as the statement without echoing it`, async () => {
      const { caught, modifies, content } = await addHook(FORM, "Form", statement);

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`statement` must be exactly one statement");
      if (statement !== "") expect(message).not.toContain(statement);
      expect(modifies).toHaveLength(0);
      expect(content).toBe(FORM);
    });
  }
});
