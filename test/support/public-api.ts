// P-API (odd/tasks/hexagonal-layout-proposal.md section 5): the published API of every
// `exports` subpath as the type checker sees it, written so a file move inside `src/` leaves
// it byte-identical. Every type the SDK defines that the API reaches, exported or not, is
// listed once with its members, so a changed member type anywhere in the surface shows up.
// SDK-internal `import("…")` paths keep only their basename, which a pure move preserves;
// package specifiers such as `import("postcss")` are part of the API and stay as written.

import { Project, ts } from "ts-morph";

const FORMAT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

function scrubPaths(text: string): string {
  return text.replace(/import\("([^"]+)"\)/g, (whole, spec: string) =>
    spec.startsWith("/") || spec.startsWith(".") ? `import("…/${spec.split("/").pop()!.replace(/\.(d\.)?[cm]?[jt]s$/, "")}")` : whole
  );
}

function kindOf(symbol: ts.Symbol): string {
  const f = symbol.flags;
  if (f & ts.SymbolFlags.Class) return "class";
  if (f & ts.SymbolFlags.Interface) return "interface";
  if (f & ts.SymbolFlags.TypeAlias) return "type";
  if (f & ts.SymbolFlags.Enum) return "enum";
  if (f & ts.SymbolFlags.Function) return "function";
  if (f & ts.SymbolFlags.Variable) return "const";
  if (f & ts.SymbolFlags.Module) return "namespace";
  return `flags:${f}`;
}

function members(checker: ts.TypeChecker, type: ts.Type, at: ts.Node): string[] {
  const out: string[] = [];
  for (const sig of type.getCallSignatures()) out.push(`  call ${checker.signatureToString(sig, at, FORMAT)}`);
  for (const sig of type.getConstructSignatures()) out.push(`  new ${checker.signatureToString(sig, at, FORMAT)}`);
  for (const prop of checker.getPropertiesOfType(type)) {
    const optional = prop.flags & ts.SymbolFlags.Optional ? "?" : "";
    out.push(`  .${prop.name}${optional}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(prop, at), at, FORMAT)}`);
  }
  return out;
}

function declaringFile(type: ts.Type): ts.SourceFile | undefined {
  return (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0]?.getSourceFile();
}

// A type declared outside the SDK: in a dependency or in TypeScript's own lib files.
function isExternal(file: ts.SourceFile): boolean {
  return file.fileName.includes("/node_modules/") || file.hasNoDefaultLib;
}

function sdkTypeSymbol(type: ts.Type): ts.Symbol | undefined {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  const file = declaringFile(type);
  if (symbol === undefined || file === undefined || isExternal(file)) return undefined;
  return symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum) ? symbol : undefined;
}

type Reached = { found: Map<string, ts.Symbol>; descendedFiles: Set<string> };

// Collects every SDK-defined named type the roots reach. It descends into the members and
// signatures of SDK-declared types only; an external type (e.g. postcss's Root, ts-morph's
// Project) contributes just its type arguments, so the walk stays inside the SDK's own code.
function reachableTypes(checker: ts.TypeChecker, roots: readonly ts.Type[], at: ts.Node): Reached {
  const found = new Map<string, ts.Symbol>();
  const descendedFiles = new Set<string>();
  const seen = new Set<ts.Type>();
  const queue = [...roots];
  while (queue.length > 0) {
    const type = queue.pop()!;
    if (seen.has(type)) continue;
    seen.add(type);
    const named = sdkTypeSymbol(type);
    if (named !== undefined) {
      // Keyed by name and declaring file's basename: two SDK types may share a name.
      const file = named.declarations![0]!.getSourceFile().fileName.split("/").pop()!.replace(/\.ts$/, "");
      found.set(`${named.name}@${file}`, named);
    }
    if (type.isUnionOrIntersection()) queue.push(...type.types);
    queue.push(...(type.aliasTypeArguments ?? []), ...checker.getTypeArguments(type as ts.TypeReference).filter(Boolean));

    const owner = declaringFile(type);
    if (owner === undefined || isExternal(owner)) continue;
    descendedFiles.add(owner.fileName);
    for (const sig of [...type.getCallSignatures(), ...type.getConstructSignatures()]) {
      queue.push(checker.getReturnTypeOfSignature(sig), ...sig.getParameters().map((p) => checker.getTypeOfSymbolAtLocation(p, at)));
    }
    if (type.flags & ts.TypeFlags.Object) {
      for (const prop of checker.getPropertiesOfType(type)) queue.push(checker.getTypeOfSymbolAtLocation(prop, at));
    }
  }
  return { found, descendedFiles };
}

/**
 * One line per export (sorted), member lines for type-like exports, then every SDK type the
 * API reaches. `descendedFiles` lists the files whose types the walk expanded, so a test can
 * bound it to the SDK's own sources.
 */
export function describeEntries(
  project: Project,
  entries: ReadonlyArray<readonly [subpath: string, file: string]>
): { text: string; descendedFiles: ReadonlySet<string> } {
  const checker = project.getTypeChecker().compilerObject;
  const lines: string[] = [];
  const roots: ts.Type[] = [];
  let at: ts.Node | undefined;
  for (const [subpath, file] of entries) {
    const sf = project.getSourceFileOrThrow(file).compilerNode;
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    const exported = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
    for (const symbol of [...exported].sort((a, b) => a.name.localeCompare(b.name))) {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const typeOnly = (target.flags & ts.SymbolFlags.Type) !== 0 && (target.flags & ts.SymbolFlags.Value) === 0;
      const type = typeOnly ? checker.getDeclaredTypeOfSymbol(target) : checker.getTypeOfSymbolAtLocation(target, sf);
      roots.push(type);
      at ??= sf;
      lines.push(`${subpath} ${symbol.name} ${kindOf(target)}: ${checker.typeToString(type, sf, FORMAT | ts.TypeFormatFlags.InTypeAlias)}`);
      if (target.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
        lines.push(...members(checker, type, sf));
      }
      if (target.flags & ts.SymbolFlags.Class) lines.push(...members(checker, checker.getTypeOfSymbolAtLocation(target, sf), sf).map((l) => ` static${l}`));
    }
  }
  if (at === undefined) return { text: "\n", descendedFiles: new Set() };
  const { found, descendedFiles } = reachableTypes(checker, roots, at);
  for (const name of [...found.keys()].sort()) {
    const symbol = found.get(name)!;
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    lines.push(`reachable ${name} ${kindOf(symbol)}: ${checker.typeToString(declared, at, FORMAT | ts.TypeFormatFlags.InTypeAlias)}`);
    lines.push(...members(checker, declared, at));
  }
  return { text: `${lines.map(scrubPaths).join("\n")}\n`, descendedFiles };
}

/** A project over the repo's tsconfig holding only the given entry files and what they import. */
export function entryProject(tsConfigFilePath: string, files: readonly string[]): Project {
  const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true });
  for (const file of files) project.addSourceFileAtPath(file);
  project.resolveSourceFileDependencies();
  return project;
}
