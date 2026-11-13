// P-API (odd/tasks/hexagonal-layout-proposal.md section 5): the published API of every
// `exports` subpath as the type checker sees it, written so a file move inside `src/` leaves
// it byte-identical. Every type the SDK defines that the API reaches, exported or not, is
// listed once with its members, so a changed member type anywhere in the surface shows up.
// SDK-internal `import("…")` paths name the file that declares the type, by basename, which a
// pure move preserves; the checker's own choice can flip to a re-exporting barrel when relative
// paths change. Package specifiers such as `import("postcss")` are part of the API and stay.

import { posix } from "node:path";
import { Project, ts } from "ts-morph";

const FORMAT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

const basename = (path: string): string => path.split("/").pop()!.replace(/\.(d\.)?[cm]?[jt]s$/, "");

// The checker names a well-known symbol member `__@iterator@963`; the number is a symbol id
// that shifts whenever another file is loaded.
function scrubPaths(text: string, declaringFile: (spec: string, name: string) => string | undefined): string {
  return text.replace(/__@([A-Za-z]+)@\d+/g, "[Symbol.$1]").replace(/import\("([^"]+)"\)(\.[A-Za-z_$][\w$]*)?/g, (whole, spec: string, member: string | undefined) => {
    if (!spec.startsWith("/") && !spec.startsWith(".")) return whole;
    return `import("…/${(member && declaringFile(spec, member.slice(1))) ?? basename(spec)}")${member ?? ""}`;
  });
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

// A primitive or literal (or a union of them) has only its lib wrapper's methods as members.
const PRIMITIVE = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;
const isPrimitive = (type: ts.Type): boolean => (type.isUnion() ? type.types.every(isPrimitive) : (type.flags & PRIMITIVE) !== 0);

function members(checker: ts.TypeChecker, type: ts.Type, at: ts.Node): string[] {
  if (isPrimitive(type)) return [];
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
      found.set(`${named.name}@${basename(named.declarations![0]!.getSourceFile().fileName)}`, named);
    }
    if (type.isUnionOrIntersection()) queue.push(...type.types);
    queue.push(...(type.aliasTypeArguments ?? []), ...checker.getTypeArguments(type as ts.TypeReference).filter(Boolean));

    const owner = declaringFile(type);
    if (owner === undefined || isExternal(owner)) continue;
    descendedFiles.add(owner.fileName);
    // A named alias can vanish from the resolved type (`Scope | undefined`, a conditional type
    // that resolves), so the type references written in the declaration are followed too.
    for (const declaration of (type.aliasSymbol ?? type.getSymbol())?.declarations ?? []) {
      const visit = (node: ts.Node): void => {
        if (ts.isBlock(node)) return;
        if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
          let symbol = checker.getSymbolAtLocation(ts.isTypeReferenceNode(node) ? node.typeName : node.expression);
          if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          if (symbol !== undefined && symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum)) {
            queue.push(checker.getDeclaredTypeOfSymbol(symbol));
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(declaration);
    }
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
  // Each line is printed at the declaration it describes, never at the entry file: what is in
  // scope there (and so whether a name prints bare, qualified or expanded) is part of the file
  // a pure move carries along unchanged.
  const lines: Array<{ text: string; at: ts.Node }> = [];
  const push = (at: ts.Node, ...texts: string[]): void => void lines.push(...texts.map((text) => ({ text, at })));
  const roots: ts.Type[] = [];
  let walkAt: ts.Node | undefined;
  for (const [subpath, file] of entries) {
    const sf = project.getSourceFileOrThrow(file).compilerNode;
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    const exported = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
    for (const symbol of [...exported].sort((a, b) => a.name.localeCompare(b.name))) {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const at = target.declarations?.[0] ?? sf;
      const typeOnly = (target.flags & ts.SymbolFlags.Type) !== 0 && (target.flags & ts.SymbolFlags.Value) === 0;
      const type = typeOnly ? checker.getDeclaredTypeOfSymbol(target) : checker.getTypeOfSymbolAtLocation(target, at);
      roots.push(type);
      walkAt ??= sf;
      push(at, `${subpath} ${symbol.name} ${kindOf(target)}: ${checker.typeToString(type, at, FORMAT | ts.TypeFormatFlags.InTypeAlias)}`);
      if (target.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
        push(at, ...members(checker, type, at));
      }
      if (target.flags & ts.SymbolFlags.Class) push(at, ...members(checker, checker.getTypeOfSymbolAtLocation(target, at), at).map((l) => ` static${l}`));
    }
  }
  if (walkAt === undefined) return { text: "\n", descendedFiles: new Set() };
  const { found, descendedFiles } = reachableTypes(checker, roots, walkAt);
  for (const name of [...found.keys()].sort()) {
    const symbol = found.get(name)!;
    const at = symbol.declarations![0]!;
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    push(at, `reachable ${name} ${kindOf(symbol)}: ${checker.typeToString(declared, at, FORMAT | ts.TypeFormatFlags.InTypeAlias)}`);
    push(at, ...members(checker, declared, at));
  }
  // Follows `name` through the module the checker printed to the file that declares it.
  const declaringFile = (at: ts.Node, spec: string, name: string): string | undefined => {
    const abs = posix.resolve(posix.dirname(at.getSourceFile().fileName), spec);
    const file = [abs, `${abs}.ts`, `${abs}/index.ts`, abs.replace(/\.js$/, ".ts")].map((p) => project.getSourceFile(p)).find(Boolean);
    const moduleSymbol = file && checker.getSymbolAtLocation(file.compilerNode);
    const exported = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((e) => e.name === name);
    if (exported === undefined) return undefined;
    const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = target.declarations?.[0];
    return declaration && basename(declaration.getSourceFile().fileName);
  };
  const text = lines.map(({ text, at }) => scrubPaths(text, (spec, name) => declaringFile(at, spec, name)));
  return { text: `${text.join("\n")}\n`, descendedFiles };
}

/** A project over the repo's tsconfig holding only the given entry files and what they import. */
export function entryProject(tsConfigFilePath: string, files: readonly string[]): Project {
  const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true });
  for (const file of files) project.addSourceFileAtPath(file);
  project.resolveSourceFileDependencies();
  return project;
}
