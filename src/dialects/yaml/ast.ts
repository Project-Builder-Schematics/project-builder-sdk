// `yaml` parse/print pair for the YAML dialect. The library re-serializes a whole document from
// its node tree, which normalizes spacing, folds, and number spelling, so fidelity is kept per
// document: a document whose serialization still equals the one taken right after parse is
// printed from its original source slice; only touched documents are re-serialized.

import { Document, isAlias, isNode, parseAllDocuments, visit, type DocumentOptions, type ParseOptions, type SchemaOptions, type ToStringOptions } from "yaml";

/** The YAML dialect's AST: every document of a file, in order. */
export interface YamlStream {
  documents: Document[];
}

export const DOCUMENT_OPTIONS: ParseOptions & DocumentOptions & SchemaOptions = { merge: true };

const BOM = "﻿";

interface StreamState {
  bom: boolean;
  eol: "\n" | "\r\n";
  preamble: string;
  finalNewline: boolean;
  options: ToStringOptions;
}

interface DocumentState {
  slice: string;
  fresh: string;
  marker: boolean;
  options: ToStringOptions;
}

const streamStates = new WeakMap<YamlStream, StreamState>();
const documentStates = new WeakMap<Document, DocumentState>();

function detectEol(source: string): "\n" | "\r\n" {
  const crlf = source.split("\r\n").length - 1;
  const lf = source.split("\n").length - 1 - crlf;
  return crlf > lf ? "\r\n" : "\n";
}

const leadingSpaces = (line: string): number => line.length - line.trimStart().length;

function inferOptions(source: string): ToStringOptions {
  const lines = source.split(/\r?\n/).filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"));
  const indents = lines.map(leadingSpaces).filter((width) => width > 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 2;
  let indentSeq = true;
  for (let i = 0; i + 1 < lines.length; i++) {
    const parent = lines[i]!;
    const child = lines[i + 1]!;
    if (/:\s*(#.*)?$/.test(parent) && child.trimStart().startsWith("- ")) {
      indentSeq = leadingSpaces(child) > leadingSpaces(parent);
      break;
    }
  }
  const flow = /[[{](\s?)[^\s\]}]/.exec(source);
  return { indent, indentSeq, flowCollectionPadding: flow === null || flow[1] !== "", lineWidth: 0 };
}

// The library accepts an alias to an undefined anchor at parse time and only fails later.
function assertAliasesDefined(document: Document): void {
  const anchors = new Set<string>();
  visit(document, (_, node) => {
    if (isAlias(node)) {
      if (!anchors.has(node.source)) throw new Error(`invalid YAML: alias *${node.source} has no preceding anchor`);
    } else if (isNode(node) && node.anchor) {
      anchors.add(node.anchor);
    }
  });
}

/** A document created by an op, sharing the parse options so merge keys resolve alike. */
export function newDocument(value?: unknown): Document {
  if (value === undefined) {
    const document = new Document(null, DOCUMENT_OPTIONS);
    document.contents = null;
    return document;
  }
  return new Document(value, { ...DOCUMENT_OPTIONS, aliasDuplicateObjects: false });
}

/**
 * Parses YAML source into a `YamlStream`. Throws on the first syntax error of any document; the
 * dialect handle contains it.
 */
export function parse(source: string): YamlStream {
  const bom = source.startsWith(BOM);
  const body = bom ? source.slice(BOM.length) : source;
  const parsed = parseAllDocuments(body, DOCUMENT_OPTIONS);
  const documents = [...parsed];
  for (const document of documents) {
    if (document.errors.length > 0) throw new Error(`invalid YAML: ${document.errors[0]!.message}`);
    assertAliasesDefined(document);
  }
  const stream: YamlStream = { documents };
  streamStates.set(stream, {
    bom,
    eol: detectEol(body),
    preamble: documents.length === 0 ? body : "",
    finalNewline: body === "" || body.endsWith("\n"),
    options: inferOptions(body),
  });
  let start = 0;
  documents.forEach((document, index) => {
    const end = index === documents.length - 1 ? body.length : document.range[2];
    const slice = body.slice(start, end);
    const options = inferOptions(slice);
    documentStates.set(document, {
      slice,
      fresh: document.toString(options),
      marker: document.directives.docStart === true,
      options,
    });
    start = end;
  });
  return stream;
}

function printDocument(document: Document, position: number, stream: StreamState): string {
  const state = documentStates.get(document);
  if (state !== undefined && document.toString(state.options) === state.fresh) {
    return position > 0 && !state.marker ? `---${stream.eol}${state.slice}` : state.slice;
  }
  const options = state?.options ?? stream.options;
  const text = document.toString(position > 0 ? { ...options, directives: true } : options);
  return stream.eol === "\n" ? text : text.replace(/\n/g, stream.eol);
}

/** Prints the stream: untouched documents byte-identical, touched ones re-serialized. */
export function print(ast: YamlStream): string {
  const stream = streamStates.get(ast) ?? { bom: false, eol: "\n", preamble: "", finalNewline: true, options: inferOptions("") };
  let out = stream.preamble;
  ast.documents.forEach((document, position) => {
    if (out !== "" && !out.endsWith("\n")) out += stream.eol;
    out += printDocument(document, position, stream);
  });
  if (!stream.finalNewline && out.endsWith(stream.eol)) out = out.slice(0, -stream.eol.length);
  return stream.bom ? BOM + out : out;
}
