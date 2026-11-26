import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";
import { validatedOp } from "../../../../domain/services/identifier-names.ts";
import type { MsbuildDocument } from "./ast.ts";
import { readElements, type XmlElement } from "./xml.ts";

const OP = "addProjectReference";
const ADD_PROJECT = "addProject";
const DEFAULT_UNIT = "  ";

export interface ProjectOptions {
  /** The solution folder that holds the project, such as `/src/`; it is created when missing. */
  folder?: string;
}

function assertPath(op: string, path: unknown): asserts path is string {
  const rule = "a relative path whose file name ends in `proj`";
  if (typeof path !== "string") throw dialectError(`${op} — \`path\` must be ${rule}.`);
  const fileName = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  if (/^([/\\]|[A-Za-z]:)/.test(path) || !fileName.endsWith("proj")) {
    throw dialectError(`${op} — \`path\` ${JSON.stringify(path)} is not ${rule}.`);
  }
}

/** The root element of `doc`, rejecting malformed XML and any root not named `name`. */
function readRoot(doc: MsbuildDocument, op: string, path: string, name: string): XmlElement {
  let root: XmlElement | undefined;
  try {
    root = readElements(doc.text);
  } catch {
    throw dialectError(`${op}(${JSON.stringify(path)}) — the file is not well-formed XML.`);
  }
  if (root?.name !== name) {
    const found = root === undefined ? "the file has no root element" : `the root element is \`${root.name}\``;
    throw dialectError(`${op}(${JSON.stringify(path)}) — ${found}; it needs \`${name}\`.`);
  }
  return root;
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

/** Puts `block`, already indented one unit deeper than `element`, inside an `element` with no children. */
function openEmpty(doc: MsbuildDocument, element: XmlElement, block: string, eol: string): void {
  const text = doc.text;
  const indent = lineIndent(text, element.start) ?? "";
  if (element.selfClosing) {
    let cut = text.lastIndexOf("/", element.end - 1);
    while (/\s/.test(text[cut - 1]!)) cut--;
    splice(doc, cut, element.end, `>${eol}${block}${eol}${indent}</${element.name}>`);
  } else {
    const closeOnOwnLine = text.slice(element.openEnd, element.closeStart).includes("\n");
    splice(doc, element.openEnd, element.openEnd, `${eol}${block}${closeOnOwnLine ? "" : eol + indent}`);
  }
}

export const addProjectReference = validatedOp<MsbuildDocument, [path: string]>(
  ([path]) => assertPath(OP, path),
  (doc, path) => {
    const project = readRoot(doc, OP, path, "Project");

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
    } else {
      openEmpty(doc, project, block, eol);
    }
  }
);

function assertFolder(folder: unknown): void {
  if (typeof folder !== "string" || !folder.startsWith("/") || !folder.endsWith("/")) {
    throw dialectError(
      `${ADD_PROJECT} — \`options.folder\` ${JSON.stringify(folder)} is not a solution folder name; it starts and ends with \`/\`, such as "/src/".`
    );
  }
}

const isProject = (element: XmlElement): boolean => element.name === "Project";

export const addProject = validatedOp<MsbuildDocument, [path: string, options?: ProjectOptions]>(
  ([path, options]) => {
    assertPath(ADD_PROJECT, path);
    if (options === undefined) return;
    if (typeof options !== "object" || options === null || Array.isArray(options) || Object.keys(options).some((key) => key !== "folder")) {
      throw dialectError(`${ADD_PROJECT} — \`options\` must be an object holding only \`folder\`.`);
    }
    if (options.folder !== undefined) assertFolder(options.folder);
  },
  (doc, path, options) => {
    const solution = readRoot(doc, ADD_PROJECT, path, "Solution");
    const folderName = options?.folder;
    const folder = folderName === undefined ? solution : solution.children.find((c) => c.name === "Folder" && c.attributes.get("Name") === folderName);

    const samePath = (element: XmlElement): boolean => {
      const projectPath = element.attributes.get("Path");
      return isProject(element) && projectPath !== undefined && sameReference(projectPath, path);
    };
    if (folder?.children.some(samePath)) return;
    if ([...descendants(solution)].some(samePath)) {
      throw dialectError(`${ADD_PROJECT}(${JSON.stringify(path)}) — the solution already holds this project at another place; move it with .modify().`);
    }

    const text = doc.text;
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const unit = indentUnit(text, solution);
    const entry = `<Project Path="${escapeAttribute(path)}" />`;
    /** `line` indented under `parent`, after its child `after`, or as its only child. */
    const append = (parent: XmlElement, after: XmlElement | undefined, line: (indent: string) => string): void => {
      const indent = (after && lineIndent(text, after.start)) ?? (lineIndent(text, parent.start) ?? "") + unit;
      if (after === undefined) openEmpty(doc, parent, line(indent), eol);
      else splice(doc, after.end, after.end, `${eol}${line(indent)}`);
    };

    if (folder !== undefined) {
      append(folder, folder.children.filter(isProject).at(-1) ?? folder.children.at(-1), (indent) => `${indent}${entry}`);
      return;
    }
    const block = (indent: string): string =>
      `${indent}<Folder Name="${escapeAttribute(folderName!)}">${eol}${indent}${unit}${entry}${eol}${indent}</Folder>`;
    const lastFolder = solution.children.filter((c) => c.name === "Folder").at(-1);
    const first = solution.children[0];
    const firstIndent = first && lineIndent(text, first.start);
    if (lastFolder !== undefined || first === undefined || firstIndent === undefined) {
      append(solution, lastFolder ?? solution.children.at(-1), block);
    } else {
      splice(doc, first.start, first.start, `${block(firstIndent).slice(firstIndent.length)}${eol}${firstIndent}`);
    }
  }
);
