// S-002: the `addImport` structured op (REQ-TSD-01, frozen call signature
// `addImport(name: string, from: string)`, design §4.4). Merges into an existing
// same-module named-import clause when present (REQ-TSD-01.2/03.10), otherwise inserts a
// fresh `import { name } from "from";` declaration.

import type { SourceFile } from "ts-morph";

/**
 * Adds `import { name } from "from";` to the file, or merges `name` into an EXISTING
 * named-import clause from the SAME module if one already exists. Idempotent: calling this
 * twice with the same `name`+`from` produces a single import line, never a duplicate
 * (REQ-TSD-03.10).
 */
export function addImport(ast: SourceFile, name: string, from: string): void {
  const existing = ast.getImportDeclaration((decl) => decl.getModuleSpecifierValue() === from);
  if (existing !== undefined) {
    const alreadyPresent = existing.getNamedImports().some((namedImport) => namedImport.getName() === name);
    if (!alreadyPresent) {
      existing.addNamedImport(name);
    }
    return;
  }
  ast.addImportDeclaration({ moduleSpecifier: from, namedImports: [name] });
}
