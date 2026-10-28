import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function addProp(source: string, component: string, name: string, type: string, options?: { optional?: boolean }) {
  const { client, emitted } = makeSpyClient({ "Card.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("Card.tsx").addComponentProp(component, name, type, options);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("Card.tsx") };
}

describe("addComponentProp", () => {
  it("adds to an inline props type and to the destructuring, on one line", async () => {
    const { caught, modifies } = await addProp(
      "function Card({ title }: { title: string }) {\n  return <h1>{title}</h1>;\n}\n",
      "Card",
      "subtitle",
      "string"
    );

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      "function Card({ title, subtitle }: { title: string; subtitle: string }) {\n  return <h1>{title}</h1>;\n}\n"
    );
  });

  it("keeps a single-line literal's trailing separator", async () => {
    const { modifies } = await addProp("const Card = ({ a }: { a: string; }) => <div />;\n", "Card", "b", "number");

    expect(modifies[0]?.modify.content).toBe("const Card = ({ a, b }: { a: string; b: number; }) => <div />;\n");
  });

  it("adds to a same-file interface on its own line, with { optional: true }", async () => {
    const source =
      "interface CardProps {\n  title: string;\n}\n\nexport function Card({ title }: CardProps) {\n  return <h1>{title}</h1>;\n}\n";
    const { modifies } = await addProp(source, "Card", "subtitle", "string", { optional: true });

    expect(modifies[0]?.modify.content).toBe(
      "interface CardProps {\n  title: string;\n  subtitle?: string;\n}\n\n" +
        "export function Card({ title, subtitle }: CardProps) {\n  return <h1>{title}</h1>;\n}\n"
    );
  });

  it("adds to a same-file type alias literal used by a const arrow component", async () => {
    const source = "type CardProps = { title: string };\nexport const Card = ({ title }: CardProps) => <h1>{title}</h1>;\n";
    const { modifies } = await addProp(source, "Card", "onClose", "() => void");

    expect(modifies[0]?.modify.content).toBe(
      "type CardProps = { title: string; onClose: () => void };\n" +
        "export const Card = ({ title, onClose }: CardProps) => <h1>{title}</h1>;\n"
    );
  });

  it("inserts before a rest element in the destructuring", async () => {
    const source = "function Card({ title, ...rest }: { title: string }) {\n  return <h1 {...rest} />;\n}\n";
    const { modifies } = await addProp(source, "Card", "size", '"sm" | "lg"');

    expect(modifies[0]?.modify.content).toBe(
      'function Card({ title, size, ...rest }: { title: string; size: "sm" | "lg" }) {\n  return <h1 {...rest} />;\n}\n'
    );
  });

  it("only extends the type when the props parameter is not destructured", async () => {
    const source = "interface CardProps {\n  title: string;\n}\nfunction Card(props: CardProps) {\n  return <h1 />;\n}\n";
    const { modifies } = await addProp(source, "Card", "subtitle", "string");

    expect(modifies[0]?.modify.content).toBe(
      "interface CardProps {\n  title: string;\n  subtitle: string;\n}\nfunction Card(props: CardProps) {\n  return <h1 />;\n}\n"
    );
  });

  it("a component without parameters gets a destructured inline props type", async () => {
    const { modifies } = await addProp("function Card() {\n  return <div />;\n}\n", "Card", "title", "string");

    expect(modifies[0]?.modify.content).toBe("function Card({ title }: { title: string }) {\n  return <div />;\n}\n");
  });

  it("the same name and type already declared is a no-op", async () => {
    const source = "function Card({ title }: { title: string }) {\n  return <div />;\n}\n";
    const { caught, modifies } = await addProp(source, "Card", "title", "string");

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("the same name with a different type rejects without echoing the type", async () => {
    const source = "function Card({ title }: { title: string }) {\n  return <div />;\n}\n";
    const { caught, modifies, content } = await addProp(source, "Card", "title", "SecretType");

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain("`title`");
    expect(message).toContain("different type");
    expect(message).not.toContain("SecretType");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(source);
  });

  it("an imported props type rejects", async () => {
    const source = 'import type { CardProps } from "./types";\nfunction Card({ title }: CardProps) {\n  return <div />;\n}\n';
    const { caught, modifies } = await addProp(source, "Card", "subtitle", "string");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("props type");
    expect(modifies).toHaveLength(0);
  });

  it("an untyped props parameter rejects", async () => {
    const { caught, modifies } = await addProp("function Card({ title }) {\n  return <div />;\n}\n", "Card", "x", "string");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("props type");
    expect(modifies).toHaveLength(0);
  });

  it("an invalid prop name rejects before any mutation", async () => {
    const { caught, modifies } = await addProp("function Card() {}\n", "Card", "bad-name", "string");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`name`");
    expect(modifies).toHaveLength(0);
  });

  for (const [label, type] of [
    ["unparseable text", "string ="],
    ["a type followed by more code", "string }; evil(); type X = {"],
    ["an empty string", ""],
  ] as const) {
    it(`rejects ${label} as the type without echoing it`, async () => {
      const source = "function Card() {}\n";
      const { caught, modifies } = await addProp(source, "Card", "title", type);

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`type` must be exactly one type");
      if (type !== "") expect(message).not.toContain(type);
      expect(modifies).toHaveLength(0);
    });
  }
});
