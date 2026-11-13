// fit-49's dialect vocabulary (odd/tasks/hexagonal-layout-proposal.md section 3.2). The
// dialect names and file extensions are read from the dialect folders at test time, so adding
// a dialect needs no edit here.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ts } from "ts-morph";
import { collectFiles } from "../import-scan.ts";

// Public barrels stay in the legacy folder after the adapters move (Q2), so both roots are read.
export const DIALECT_ROOTS = ["src/dialects", "src/bounded-contexts/authoring/infrastructure/out/dialects"] as const;

// A dialect that extends another one's ops declares that edge here. An edge is one-way:
// the extended dialect never imports back.
export const ALLOWED_SIBLINGS: Readonly<Record<string, readonly string[]>> = {
  nestjs: ["typescript"],
  angular: ["typescript"],
  react: ["typescript"],
};

export type DialectVocabulary = { names: ReadonlySet<string>; extensions: ReadonlySet<string> };

function declaredExtensions(path: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "extensions" &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) if (ts.isStringLiteral(element)) found.push(element.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true));
  return found;
}

/** Every dialect folder name and every extension a dialect declares in `extensions: [...]`. */
export function dialectVocabulary(root: string): DialectVocabulary {
  const names = new Set<string>();
  const extensions = new Set<string>();
  for (const dialectRoot of DIALECT_ROOTS) {
    const abs = join(root, dialectRoot);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!statSync(join(abs, name)).isDirectory()) continue;
      names.add(name);
      for (const file of collectFiles(join(abs, name), ".ts")) {
        for (const ext of declaredExtensions(file, readFileSync(file, "utf-8"))) extensions.add(ext);
      }
    }
  }
  return { names, extensions };
}

// A module specifier names a module, not a dialect: `import "yaml"` is a dependency edge.
function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) ||
    (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword)
  );
}

/** The string literals in `source` equal to a dialect name or extension, in source order. */
export function dialectLiterals(path: string, source: string, vocabulary: DialectVocabulary): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      (vocabulary.names.has(node.text) || vocabulary.extensions.has(node.text)) &&
      !isModuleSpecifier(node)
    ) {
      found.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true));
  return found;
}
