import { Node, type ImportDeclaration, type SourceFile } from "ts-morph";

const BLANK_LINE = /\n[ \t]*\r?\n/;

// Case-insensitive with an ordinal tie-break, never `localeCompare`: the order must not
// depend on the host locale.
function compareText(a: string, b: string): number {
  const foldedA = a.toLowerCase();
  const foldedB = b.toLowerCase();
  if (foldedA !== foldedB) return foldedA < foldedB ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith(".");
}

// Package specifiers (including `node:` builtins and path aliases) sort ahead of relative ones.
function compareModules(a: string, b: string): number {
  return Number(isRelative(a)) - Number(isRelative(b)) || compareText(a, b);
}

function byModule(a: ImportDeclaration, b: ImportDeclaration): number {
  return compareModules(a.getModuleSpecifierValue(), b.getModuleSpecifierValue());
}

// How closely two specifiers are related: 0 across the package/relative divide, otherwise
// 1 plus the number of leading path segments they share.
function kinship(a: string, b: string): number {
  if (isRelative(a) !== isRelative(b)) return 0;
  const left = a.split("/");
  const right = b.split("/");
  let shared = 0;
  while (shared < Math.min(left.length, right.length) && left[shared] === right[shared]) shared++;
  return 1 + shared;
}

/** Index at which `name` keeps `decl`'s named specifiers in order. */
export function sortedSpecifierIndex(decl: ImportDeclaration, name: string): number {
  const specifiers = decl.getNamedImports();
  const index = specifiers.findIndex((specifier) => compareText(specifier.getName(), name) > 0);
  return index === -1 ? specifiers.length : index;
}

/**
 * Where a new declaration of `from` goes: among the existing declarations most related to it
 * (its folder siblings), before the first that sorts after it, or after the last. `index` is a
 * `getStatementsWithComments()` index; inserting before a declaration also goes above the
 * comments directly over it, so an `eslint-disable-next-line` keeps covering the import it was
 * written for. `joinsComment` is true when that comment had no blank line above it, which
 * `closeGapAfter` must restore. Undefined when the file has no import declarations.
 */
export function sortedPlacement(ast: SourceFile, from: string): { index: number; joinsComment: boolean } | undefined {
  const declarations = ast.getImportDeclarations();
  if (declarations.length === 0) return undefined;
  const closest = Math.max(...declarations.map((decl) => kinship(decl.getModuleSpecifierValue(), from)));
  const siblings = declarations.filter((decl) => kinship(decl.getModuleSpecifierValue(), from) === closest);
  const next = siblings.find((decl) => compareModules(decl.getModuleSpecifierValue(), from) > 0);
  const statements = ast.getStatementsWithComments();
  if (next === undefined) return { index: statements.indexOf(siblings[siblings.length - 1]!) + 1, joinsComment: false };
  let index = statements.indexOf(next);
  while (index > 0 && Node.isCommentStatement(statements[index - 1]) && !BLANK_LINE.test(gapBefore(statements, index))) {
    index--;
  }
  const joinsComment = Node.isCommentStatement(statements[index]) && (index === 0 || !BLANK_LINE.test(gapBefore(statements, index)));
  return { index, joinsComment };
}

// ts-morph always leaves a blank line between a declaration it inserts and a comment right
// below it; that blank line would split one group of imports in two.
export function closeGapAfter(decl: ImportDeclaration): void {
  const end = decl.getEnd();
  const blank = /^[ \t]*\r?\n([ \t]*\r?\n)/.exec(decl.getSourceFile().getFullText().slice(end));
  if (blank !== null) decl.getSourceFile().removeText(end + blank[0].length - blank[1]!.length, end + blank[0].length);
}

function gapBefore(statements: Node[], index: number): string {
  return statements[index]!.getSourceFile().getFullText().slice(statements[index - 1]!.getEnd(), statements[index]!.getStart());
}

// A comment on the same line, or directly above with no blank line, belongs to the declaration.
function hasAttachedComment(decl: ImportDeclaration): boolean {
  const text = decl.getSourceFile().getFullText();
  return (
    decl.getTrailingCommentRanges().length > 0 ||
    decl.getLeadingCommentRanges().some((range) => !BLANK_LINE.test(text.slice(range.getEnd(), decl.getStart())))
  );
}

// Runs of declarations that may be reordered among themselves: consecutive, with no blank
// line between them. A side-effect import (its evaluation order is behaviour) and a
// declaration with an attached comment never move, and every other statement or comment ends
// the run, so nothing crosses them.
function reorderableRuns(ast: SourceFile): ImportDeclaration[][] {
  const runs: ImportDeclaration[][] = [];
  const statements = ast.getStatementsWithComments();
  statements.forEach((statement, index) => {
    if (!Node.isImportDeclaration(statement)) return;
    if (statement.getImportClause() === undefined || hasAttachedComment(statement)) return;
    const run = runs[runs.length - 1];
    const continuesRun =
      run !== undefined && statements[index - 1] === run[run.length - 1] && !BLANK_LINE.test(gapBefore(statements, index));
    if (continuesRun) run.push(statement);
    else runs.push([statement]);
  });
  return runs;
}

// `decl`'s text with its named specifiers in order, each swapped into an existing specifier's
// slot so the braces keep their layout. Braces holding a comment are left as they are: the
// comment would end up beside a different name.
function withSortedSpecifiers(decl: ImportDeclaration): string {
  const text = decl.getText();
  const bindings = decl.getImportClause()?.getNamedBindings();
  if (bindings === undefined || !Node.isNamedImports(bindings) || /\/[/*]/.test(bindings.getText())) return text;
  const specifiers = bindings.getElements();
  const sorted = [...specifiers].sort((a, b) => compareText(a.getName(), b.getName()));
  const offset = decl.getStart();
  let result = text;
  for (let i = specifiers.length - 1; i >= 0; i--) {
    const slot = specifiers[i]!;
    result = result.slice(0, slot.getStart() - offset) + sorted[i]!.getText() + result.slice(slot.getEnd() - offset);
  }
  return result;
}

/**
 * Sorts the file's import declarations by module specifier (packages first, then relative
 * paths, case-insensitively) and the named specifiers inside each declaration's braces.
 *
 * It only reorders; it never combines, removes, or reformats a declaration. Declarations move
 * only within a run of consecutive imports: a blank line, a comment, a side-effect import
 * (`import "./polyfills";`, whose position is behaviour), or a declaration with a comment
 * attached to it ends the run, and nothing moves across it. Calling it on a sorted file
 * changes nothing.
 *
 * @example
 * // import { useState, type FC } from "react";
 * // import { b } from "./b";
 * // import { a } from "./a";
 * // import { Users, BookOpen } from "lucide-react";
 * ts.find(path).sortImports();
 * // import { BookOpen, Users } from "lucide-react";
 * // import { type FC, useState } from "react";
 * // import { a } from "./a";
 * // import { b } from "./b";
 */
export function sortImports(ast: SourceFile): void {
  const placement = new Map<ImportDeclaration, ImportDeclaration>();
  for (const run of reorderableRuns(ast)) {
    const sorted = [...run].sort(byModule);
    run.forEach((decl, i) => placement.set(decl, sorted[i]!));
  }
  const edits = ast.getImportDeclarations().map((decl) => ({
    start: decl.getStart(),
    end: decl.getEnd(),
    text: withSortedSpecifiers(placement.get(decl) ?? decl),
  }));
  const original = ast.getFullText();
  // Applied last to first so every earlier edit's offsets stay valid.
  const result = edits.reduceRight((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), original);
  if (result !== original) ast.replaceWithText(result);
}
