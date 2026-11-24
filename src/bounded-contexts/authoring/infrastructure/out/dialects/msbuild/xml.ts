import { SaxesParser } from "saxes";

/**
 * One element with its source offsets: `start` is its `<`, `openEnd` is just past its open
 * tag's `>`, `closeStart` is the `<` of its close tag, and `end` is just past the element.
 * A self-closing element has `openEnd === closeStart === end`.
 */
export interface XmlElement {
  name: string;
  attributes: ReadonlyMap<string, string>;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  selfClosing: boolean;
  children: XmlElement[];
}

/**
 * Reads the element tree of `text`, or `undefined` for an empty text, throwing on anything
 * that is not well-formed XML 1.0.
 */
export function readElements(text: string): XmlElement | undefined {
  if (text === "") return undefined;
  const parser = new SaxesParser({ position: true });
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let failed = false;
  parser.on("error", () => {
    failed = true;
  });
  // `position` sits just past the tag's `>`; a raw `<` cannot occur inside a tag, so the last
  // one before it is the tag's start.
  parser.on("opentag", (node) => {
    const openEnd = parser.position;
    const element: XmlElement = {
      name: node.name,
      attributes: new Map(Object.entries(node.attributes as Record<string, string>)),
      start: text.lastIndexOf("<", openEnd - 1),
      openEnd,
      closeStart: openEnd,
      end: openEnd,
      selfClosing: node.isSelfClosing,
      children: [],
    };
    (stack.at(-1)?.children ?? []).push(element);
    root ??= element;
    stack.push(element);
  });
  parser.on("closetag", () => {
    const element = stack.pop()!;
    if (element.selfClosing) return;
    element.end = parser.position;
    element.closeStart = text.lastIndexOf("<", element.end - 1);
  });
  try {
    parser.write(text).close();
  } catch {
    failed = true;
  }
  if (failed || root === undefined) throw new Error("invalid XML");
  return root;
}
