import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";
import { validatedOp } from "../../../../domain/services/identifier-names.ts";
import type { MsbuildDocument } from "./ast.ts";
import { readElements, type XmlElement } from "./xml.ts";

const OP = "addProjectReference";
const DEFAULT_UNIT = "  ";

function assertPath(path: unknown): asserts path is string {
  const rule = "a relative path whose file name ends in `proj`";
  if (typeof path !== "string") throw dialectError(`${OP} — \`path\` must be ${rule}.`);
  const fileName = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  if (/^([/\\]|[A-Za-z]:)/.test(path) || !fileName.endsWith("proj")) {
    throw dialectError(`${OP} — \`path\` ${JSON.stringify(path)} is not ${rule}.`);
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const sameReference = (a: string, b: string): boolean => a.replace(/\\/g, "/") === b.replace(/\\/g, "/");

/** The whitespace before `offset` on its line, or `undefined` when other text precedes it there. */
function lineIndent(text: string, offset: number): string | undefined {
  const prefix = text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset);
  return /^[ \t]*$/.test(prefix) ? prefix : undefined;
}

/** The first indentation step the file shows between an element and its parent, else two spaces. */
function indentUnit(text: string, root: XmlElement): string {
  const parents = [root];
  for (const parent of parents) {
    const outer = lineIndent(text, parent.start);
    for (const child of parent.children) {
      const inner = lineIndent(text, child.start);
      if (outer !== undefined && inner !== undefined && inner.length > outer.length && inner.startsWith(outer)) {
        return inner.slice(outer.length);
      }
      parents.push(child);
    }
  }
  return DEFAULT_UNIT;
}

function* descendants(element: XmlElement): Generator<XmlElement> {
  for (const child of element.children) {
    yield child;
    yield* descendants(child);
  }
}

function splice(doc: MsbuildDocument, from: number, to: number, insert: string): void {
  doc.text = doc.text.slice(0, from) + insert + doc.text.slice(to);
}

export const addProjectReference = validatedOp<MsbuildDocument, [path: string]>(
  ([path]) => assertPath(path),
  (doc, path) => {
    let project: XmlElement | undefined;
    try {
      project = readElements(doc.text);
    } catch {
      throw dialectError(`${OP}(${JSON.stringify(path)}) — the file is not well-formed XML.`);
    }
    if (project?.name !== "Project") {
      const root = project === undefined ? "the file has no root element" : `the root element is \`${project.name}\``;
      throw dialectError(`${OP}(${JSON.stringify(path)}) — ${root}; it needs \`Project\`.`);
    }

    for (const element of descendants(project)) {
      const include = element.attributes.get("Include");
      if (element.name === "ProjectReference" && include !== undefined && sameReference(include, path)) return;
    }

    const text = doc.text;
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const unit = indentUnit(text, project);
    const reference = `<ProjectReference Include="${escapeAttribute(path)}" />`;

    const group = project.children.find(
      (child) => child.name === "ItemGroup" && !child.attributes.has("Condition") && child.children.some((c) => c.name === "ProjectReference")
    );
    if (group !== undefined) {
      const last = group.children.filter((c) => c.name === "ProjectReference").at(-1)!;
      const indent = lineIndent(text, last.start) ?? (lineIndent(text, group.start) ?? "") + unit;
      splice(doc, last.end, last.end, `${eol}${indent}${reference}`);
      return;
    }

    const projectIndent = lineIndent(text, project.start) ?? "";
    const last = project.children.at(-1);
    const indent = (last && lineIndent(text, last.start)) ?? projectIndent + unit;
    const block = `${indent}<ItemGroup>${eol}${indent}${unit}${reference}${eol}${indent}</ItemGroup>`;
    if (last !== undefined) {
      splice(doc, last.end, last.end, `${eol}${eol}${block}`);
    } else if (project.selfClosing) {
      let cut = text.lastIndexOf("/", project.end - 1);
      while (/\s/.test(text[cut - 1]!)) cut--;
      splice(doc, cut, project.end, `>${eol}${block}${eol}${projectIndent}</Project>`);
    } else {
      const closeOnOwnLine = text.slice(project.openEnd, project.closeStart).includes("\n");
      splice(doc, project.openEnd, project.openEnd, `${eol}${block}${closeOnOwnLine ? "" : eol + projectIndent}`);
    }
  }
);
