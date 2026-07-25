// Walks the EMITTED dist/**.js graph — never src/**.ts (a source walk yields 24:
// engine-client.ts is import-type-only and tsc erases it). The source-realm walker is
// test/support/import-scan.ts (FIT-15/FIT-21); they are not interchangeable.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { builtinModules } from "node:module";
import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type ImportDeclaration,
  type SourceFile,
} from "ts-morph";

/**
 * The sanctioned factory-import site's file (CST-03.3), distRoot-relative. The sanction is
 * per-SITE: the FIRST dynamic `import()` here is the author-code boundary, a second one is
 * a violation, and one anywhere else is a violation.
 */
export const SANCTIONED_DYNAMIC_IMPORT_FILE: ClosurePath = "transport/runner.js";

/**
 * The anchored `createRequire` site's file (ADR-04), distRoot-relative. Its import binding
 * and its FIRST use are exempt from the outright Constraint-4 ban; every further reference,
 * here or anywhere else in the closure, is a violation.
 */
export const CREATE_REQUIRE_ANCHOR_FILE: ClosurePath = "transport/single-instance-probe.js";

/** A node of the closure graph. Paths are ALWAYS distRoot-relative, POSIX, no leading "./". */
export type ClosurePath = string;

export interface ClosureEdge {
  readonly from: ClosurePath;
  readonly to: ClosurePath;
  readonly specifier: string;
}

/** The closed rule set. `ViolationRule` is derived from it so the two cannot drift. */
export const VIOLATION_RULES = [
  "constraint-2-dynamic-import",
  "constraint-2-second-site",
  "constraint-3-bare-specifier",
  "constraint-3a-unprefixed-builtin",
  "constraint-4-execution-primitive",
  "unclassifiable-construct",
  "unresolvable-specifier",
  "unreadable-file",
  "symlink-escape",
] as const;

export type ViolationRule = (typeof VIOLATION_RULES)[number];

export interface Violation {
  readonly rule: ViolationRule;
  readonly file: ClosurePath;
  readonly line: number | null;
  readonly found: string;
  readonly detail?: string;
}

export interface ClosureDerivation {
  readonly nodes: readonly ClosurePath[];
  readonly edges: readonly ClosureEdge[];
  readonly builtins: readonly string[];
  readonly violations: readonly Violation[];
  /** Raw bytes read for each node during the walk — lets a caller hash without a second read. */
  readonly fileBytes: ReadonlyMap<ClosurePath, Buffer>;
}

/** The engine's field names, not ours to improve. Key order is fixed by construction. */
export interface RunnerManifest {
  readonly manifestVersion: 1;
  readonly algorithm: "sha256";
  readonly entry: string;
  readonly packageVersion: string;
  readonly files: ReadonlyArray<{ readonly path: string; readonly sha256: string }>;
}

/** REQ-RME-06.1: JSON.stringify(m, null, 2) + "\n"; key order fixed by construction. */
export function serialiseManifest(manifest: RunnerManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** REQ-RME-02: sha256 over the file's raw BYTES (never a utf-8 round trip). Lowercase hex. */
export function sha256File(absolutePath: string): string {
  return sha256Bytes(readFileSync(absolutePath));
}

/** Same digest as {@link sha256File}, over bytes already in memory — no second disk read. */
export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** REQ-RCD-00. `entryRelPath` is distRoot-relative (e.g. "bin/pbuilder-runner.js"). */
export function deriveRunnerClosure(distRoot: string, entryRelPath: string): ClosureDerivation {
  const root = realpathSync(distRoot);
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const nodes = new Set<ClosurePath>();
  const edges: ClosureEdge[] = [];
  const builtins = new Set<string>();
  const violations: Violation[] = [];
  const fileBytes = new Map<ClosurePath, Buffer>();
  const queue: ClosurePath[] = [entryRelPath];

  while (queue.length > 0) {
    const current = queue.shift() as ClosurePath;
    if (nodes.has(current)) continue;
    nodes.add(current);

    const absolute = join(root, current);
    let bytes: Buffer;
    try {
      bytes = readFileSync(absolute);
    } catch {
      violations.push({ rule: "unreadable-file", file: current, line: null, found: current });
      continue;
    }
    fileBytes.set(current, bytes);
    const sourceFile = project.createSourceFile(absolute, bytes.toString("utf-8"), {
      overwrite: true,
    });
    violations.push(...denyScan(sourceFile, current));

    for (const site of staticSpecifierSites(sourceFile)) {
      const classification = classifySpecifier(site.value, current, root);
      if (classification.kind === "builtin") {
        builtins.add(site.value);
      } else if (classification.kind === "edge") {
        edges.push({ from: current, to: classification.to, specifier: site.value });
        queue.push(classification.to);
      } else {
        violations.push({
          rule: classification.rule,
          file: current,
          line: site.line,
          found: site.found,
          detail: classification.detail,
        });
      }
    }
  }

  return {
    nodes: [...nodes].sort(comparePaths),
    edges: edges.sort(compareEdges),
    builtins: [...builtins].sort(comparePaths),
    violations,
    fileBytes,
  };
}

// An identifier scan is what makes ADR-04's outright ban DECIDABLE: it catches the import,
// the direct call, the indirect-variable form and the namespace form alike, and JSDoc
// occurrences are structurally absent from the descendant walk.
const DENIED_IDENTIFIERS = new Set(["createRequire", "eval", "Function"]);
const DENIED_MEMBER_EXPRESSIONS = new Set(["Bun.plugin", "process.binding"]);

function denyScan(sourceFile: SourceFile, file: ClosurePath): Violation[] {
  const found: Violation[] = [];

  const dynamicImports = dynamicImportCalls(sourceFile);
  const atSanctionedSite = file === SANCTIONED_DYNAMIC_IMPORT_FILE;
  dynamicImports.forEach((call, index) => {
    if (atSanctionedSite && index === 0) return;
    found.push({
      rule: atSanctionedSite ? "constraint-2-second-site" : "constraint-2-dynamic-import",
      file,
      line: call.getStartLineNumber(),
      found: oneLine(call.getText()),
      detail: `sanctioned site: ${SANCTIONED_DYNAMIC_IMPORT_FILE}`,
    });
  });

  let anchoredUses = 0;
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const name = identifier.getText();
    if (!DENIED_IDENTIFIERS.has(name)) continue;
    if (name === "createRequire" && file === CREATE_REQUIRE_ANCHOR_FILE) {
      if (identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) !== undefined) continue;
      if (anchoredUses++ === 0) continue;
    }
    found.push(primitiveViolation(identifier, file, name));
  }

  for (const access of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const text = access.getText();
    if (DENIED_MEMBER_EXPRESSIONS.has(text)) found.push(primitiveViolation(access, file, text));
  }

  return found;
}

function primitiveViolation(node: Node, file: ClosurePath, primitive: string): Violation {
  return {
    rule: "constraint-4-execution-primitive",
    file,
    line: node.getStartLineNumber(),
    found: oneLine((node.getFirstAncestor(Node.isStatement) ?? node).getText()),
    detail: primitive,
  };
}

interface SpecifierSite {
  readonly value: string;
  readonly line: number;
  readonly found: string;
}

type Classification =
  | { readonly kind: "builtin" }
  | { readonly kind: "edge"; readonly to: ClosurePath }
  | { readonly kind: "violation"; readonly rule: ViolationRule; readonly detail: string };

// Total by construction: every static specifier lands in exactly one branch. A `return`
// that merely skipped would be the silent-subset hole REQ-RCD-03.2 exists to forbid.
function classifySpecifier(specifier: string, from: ClosurePath, root: string): Classification {
  if (specifier === "node:vm") {
    return { kind: "violation", rule: "constraint-4-execution-primitive", detail: specifier };
  }
  if (specifier.startsWith("node:")) return { kind: "builtin" };

  if (isRelative(specifier)) {
    if (/[?#]/.test(specifier)) {
      return {
        kind: "violation",
        rule: "unclassifiable-construct",
        detail: `query or fragment in "${specifier}"`,
      };
    }
    const to = resolveRelative(from, specifier);
    const absolute = join(root, to);
    if (!existsSync(absolute)) {
      return { kind: "violation", rule: "unresolvable-specifier", detail: `attempted ${to}` };
    }
    if (!isInside(root, realpathSync(absolute))) {
      return {
        kind: "violation",
        rule: "symlink-escape",
        detail: `"${specifier}" resolves outside ${root}`,
      };
    }
    return { kind: "edge", to };
  }

  if (specifier.startsWith("/") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)) {
    return { kind: "violation", rule: "unclassifiable-construct", detail: specifier };
  }

  // Builtin-name membership phrases the message; it never permits the specifier.
  return builtinModules.includes(specifier)
    ? { kind: "violation", rule: "constraint-3a-unprefixed-builtin", detail: specifier }
    : { kind: "violation", rule: "constraint-3-bare-specifier", detail: specifier };
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function compareEdges(a: ClosureEdge, b: ClosureEdge): number {
  return (
    comparePaths(a.from, b.from) ||
    comparePaths(a.to, b.to) ||
    comparePaths(a.specifier, b.specifier)
  );
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function resolveRelative(from: ClosurePath, specifier: string): ClosurePath {
  return posix.normalize(posix.join(posix.dirname(from), specifier));
}

// JSDoc-quoted imports are structurally absent from these two accessors — the whole point
// of parsing instead of scanning (ADR-01): `removeComments` is unset, so `@example` blocks
// quoting a bare or relative specifier survive into dist/ and a regex would fire on them.
function staticSpecifierSites(sourceFile: SourceFile): SpecifierSite[] {
  const sites: SpecifierSite[] = [];
  for (const declaration of sourceFile.getImportDeclarations()) {
    sites.push(siteOf(declaration, declaration.getModuleSpecifierValue()));
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    const value = declaration.getModuleSpecifierValue();
    if (value !== undefined) sites.push(siteOf(declaration, value));
  }
  return sites;
}

// A raw SyntaxKind NUMBER returns nothing here — the imported enum is required (ADR-01).
function dynamicImportCalls(sourceFile: SourceFile): CallExpression[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function siteOf(node: Node, value: string): SpecifierSite {
  return { value, line: node.getStartLineNumber(), found: oneLine(node.getText()) };
}

function oneLine(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 197)}...` : collapsed;
}

interface RuleBody {
  readonly summary: string;
  readonly rule: string;
  readonly why: string;
  readonly fix: string;
}

// Bodies copied from review-tech-writer §5, adopted under design.md §9 — which wins on
// divergence, and does diverge in two pinned ways: the header carries the src path while
// the LINE is attributed to the realm it was observed in (§3.6), and Constraint 4's
// `found:` reads as a reference rather than specifically a call (ruling R3).
const RULE_BODIES: Record<ViolationRule, (detail: string) => RuleBody> = {
  "constraint-3-bare-specifier": (detail) => ({
    summary: "bare specifier in the runner closure",
    rule: "Constraint 3 — no bare third-party specifier inside the closure.",
    why: `"${detail}" resolves into node_modules/, which the manifest does not cover, so it would execute unverified during the bootstrap.`,
    fix: `move the code that needs "${detail}" behind the factory import, or into a module outside the runner closure (src/commons/**, src/dialects/**). If the runner must genuinely depend on it, the closure contract has changed — read docs/runner-integrity-invariants.md#constraint-3 and agree it with the engine before regenerating any baseline.`,
  }),
  "constraint-3a-unprefixed-builtin": (detail) => ({
    summary: "builtin imported without the `node:` prefix",
    rule: "Constraint 3a — every builtin in the closure is written `node:`-prefixed.",
    why: `"${detail}" is an ordinary package name that a node_modules/${detail} package can shadow; "node:${detail}" cannot be shadowed. The check is on the PREFIX, not on a list of builtin names — adding "${detail}" to an allowlist is not the fix.`,
    fix: `change the specifier to "node:${detail}".`,
  }),
  "constraint-2-dynamic-import": () => ({
    summary: "dynamic import() outside the sanctioned factory-import site",
    rule: "Constraint 2 — the closure contains exactly one dynamic import(): the author-factory import in src/transport/runner.ts, marked SANCTIONED-FACTORY-IMPORT.",
    why: "a dynamic import() admits code no digest covers into the bootstrap; the one sanctioned site is the deliberate author-code boundary.",
    fix: "use a static import if the target is already in the closure, or move the lazy load to the far side of the factory boundary. A second boundary is a contract change: docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.",
  }),
  "constraint-2-second-site": () => ({
    summary: "second dynamic import() inside the factory-import file",
    rule: "Constraint 2 — the sanction is per-SITE, not per-file. Living in runner.ts does not make an import() sanctioned.",
    why: "src/transport/runner.ts:SANCTIONED-FACTORY-IMPORT is the author-code boundary; this is a different site, and it admits code no digest covers exactly as one anywhere else would.",
    fix: "remove this import(), or route the work through the sanctioned site. If the runner needs a second dynamic boundary, that is a contract change: docs/runner-integrity-invariants.md#constraint-2, agreed with the engine first.",
  }),
  "constraint-4-execution-primitive": (detail) => ({
    summary: "unhashed-code-execution primitive in the closure",
    rule: `Constraint 4 — the closure may RESOLVE, never EXECUTE.\n         permitted: createRequire(...).resolve(...) at the anchored site\n         forbidden: every other createRequire reference, eval, new Function, node:vm, Bun.plugin, process.binding\n         forbidden primitive: ${detail}`,
    why: "a createRequire reference outside the anchored site executes a CommonJS module with no import edge anywhere — it is invisible to the closure walk and covered by no digest. This precondition is not in the engine's original contract; we added it. See docs/runner-integrity-invariants.md#constraint-4.",
    fix: "call .resolve(specifier) and load the result through a static import, or move the work outside the closure.",
  }),
  "unclassifiable-construct": (detail) => ({
    summary: "import construct could not be classified",
    rule: "Zero silent skips — every import-like construct must classify as exactly one of { relative specifier, node:-prefixed builtin, the sanctioned factory-import site }.",
    why: `an unclassifiable construct (${detail}) fails the build rather than being skipped, because a skipped edge is a hole in the closure that nothing downstream would notice.`,
    fix: "write the specifier as a string literal. If the construct must stay, the walker has to learn it — that is a change to scripts/derive-runner-closure.ts AND to docs/runner-integrity-invariants.md, not a special case here.",
  }),
  "unresolvable-specifier": (detail) => ({
    summary: `relative specifier resolves to no file (${detail})`,
    rule: "Zero silent skips — a classified-but-unresolvable specifier is a hole in the closure, never a subset.",
    why: "dropping the subtree behind an unresolvable specifier leaves the manifest a strict subset of the code that runs, which voids the closure-sealing lemma.",
    fix: "correct the specifier, or add the file it names.",
  }),
  "unreadable-file": () => ({
    summary: "closure file could not be read",
    rule: "Zero silent skips — an unreadable closure file fails the build; it is never skipped.",
    why: "a file that cannot be read cannot be hashed, and a manifest missing one of its files is indistinguishable from tampering on the user's machine.",
    fix: "restore read permission on the file, or remove it from the closure.",
  }),
  "symlink-escape": (detail) => ({
    summary: "closure specifier resolves outside the package root",
    rule: "Constraint 3 — the closure may not reach outside the package root, through a symlink or otherwise.",
    why: `hashing foreign bytes under an in-package path (${detail}) records a digest for code the package does not own; a bun link install makes this non-academic.`,
    fix: "replace the link with a real file inside the package, or move the target into the package root.",
  }),
};

/** Renders violations into the frozen design §9 form. distRoot-relative in, src-relative out. */
export function renderViolations(
  violations: readonly Violation[],
  opts: {
    readonly distDirName: string;
    readonly srcDirName: string;
    readonly maxShown?: number;
    // Frozen (design §9) for the BUILD path only. The baseline writer reuses this renderer
    // and must state what IT failed to write — naming the manifest there is simply untrue.
    readonly outcome?: string;
  }
): string {
  const maxShown = opts.maxShown ?? 10;
  const shown = violations.slice(0, maxShown);
  const blocks = shown.map((violation) => {
    const body = RULE_BODIES[violation.rule](violation.detail ?? violation.found);
    const emitted = `${opts.distDirName}/${violation.file}`;
    const at = violation.line === null ? emitted : `${emitted}:${violation.line}`;
    return [
      `runner-manifest: ${srcPathFor(violation.file, opts.srcDirName)} — ${body.summary}.`,
      `  found: ${violation.found}     (emitted: ${at})`,
      `  rule:  ${body.rule}`,
      `  why:   ${body.why}`,
      `  fix:   ${body.fix}`,
    ].join("\n");
  });
  if (violations.length > shown.length) {
    blocks.push(`… and ${violations.length - shown.length} more`);
  }
  blocks.push(
    opts.outcome ??
      `No manifest was written; ${opts.distDirName}/runner-manifest.json does not exist.`
  );
  return `${blocks.join("\n\n")}\n`;
}

// A pure string transform, so it works in Tier A and Tier B roots that carry no src/ tree
// at all. BDI-02 proves the dist -> src map is injective, which is what makes it sound.
function srcPathFor(file: ClosurePath, srcDirName: string): string {
  return `${srcDirName}/${file.replace(/\.(js|mjs|cjs)$/, ".ts")}`;
}

/** Shared realm-agnostic extraction — the ONLY specifier reader in this change (BDI-02 needs src). */
export function readSpecifiers(absolutePath: string): {
  readonly staticSpecifiers: readonly string[];
  readonly typeOnlyStatic: readonly string[];
  readonly dynamicImportCount: number;
} {
  const project = new Project({
    compilerOptions: { allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile(
    absolutePath,
    readFileSync(absolutePath, "utf-8"),
    { overwrite: true }
  );

  const declarations: Array<{ pos: number; value: string; erased: boolean }> = [];
  for (const declaration of sourceFile.getImportDeclarations()) {
    declarations.push({
      pos: declaration.getPos(),
      value: declaration.getModuleSpecifierValue(),
      erased: isErasedImport(declaration),
    });
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    const value = declaration.getModuleSpecifierValue();
    if (value === undefined) continue;
    declarations.push({ pos: declaration.getPos(), value, erased: declaration.isTypeOnly() });
  }
  declarations.sort((a, b) => a.pos - b.pos);

  return {
    staticSpecifiers: declarations.map((d) => d.value),
    typeOnlyStatic: declarations.filter((d) => d.erased).map((d) => d.value),
    dynamicImportCount: dynamicImportCalls(sourceFile).length,
  };
}

// tsc erases a declaration whose bindings are ALL type-only; a side-effect import (no
// bindings at all) is never erased, and one value binding keeps the whole declaration.
function isErasedImport(declaration: ImportDeclaration): boolean {
  if (declaration.isTypeOnly()) return true;
  if (declaration.getDefaultImport() !== undefined) return false;
  if (declaration.getNamespaceImport() !== undefined) return false;
  const named = declaration.getNamedImports();
  return named.length > 0 && named.every((binding) => binding.isTypeOnly());
}

/** REQ-RME-05: byte-wise, via Buffer.compare. NEVER localeCompare. */
export function comparePaths(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf-8"), Buffer.from(b, "utf-8"));
}
