// Capability-admission property (ADR-0079): replaces `denyScan`'s default-PASS text scan.
// Every node of a closure file's capability surface classifies into exactly one of
// {admitted, violation, unclassifiable-construct}; the default for anything unrecognised is
// violation or unclassifiable, never a silent pass. Two independently-implemented functions
// make totality falsifiable: `enumerateCapabilitySurface` (what is present) and
// `classifySurfaceNode` (what is admitted) — see FIT-CAP-TOTALITY.
//
// Three legs, all syntax-only (no ts-morph type checker, no module resolution): callee
// decidability (REQ-CAP-03), origin admission (REQ-CAP-04), positional decidability for
// denied roots (REQ-CAP-05). The admitted/denied sets are closed tables below, pinned by
// exact membership (REQ-CAP-01.4/.5, REQ-CAP-04.4/.5/.6) — probe-verified against the real
// runner closure (23 files, 423 call/`new` sites) on this branch.
import { Node, SyntaxKind, type Identifier, type SourceFile } from "ts-morph";
import { builtinModules } from "node:module";
import type { ClosurePath, ViolationRule } from "./derive-runner-closure.ts";

/** The ONE register of denied capability primitives (REQ-PRM-01) — exactly 11 members. */
export const DENIED_CAPABILITY_PRIMITIVES: ReadonlySet<string> = new Set([
  "eval",
  "Function",
  "createRequire",
  "Bun.plugin",
  "process.binding",
  "node:vm",
  "node:child_process",
  "node:worker_threads",
  "WebAssembly",
  "module.register",
  "module.registerHooks",
]);

/**
 * Admitted global bindings — fully-qualified single names, never prefixes or wildcards.
 * Probe-verified against the real 23-file closure on this branch (scope-chain walk: every
 * free `Identifier` reference not locally bound, not a declaration/property name, not
 * JSDoc-rooted, not type-position, not `import.meta`'s own name node).
 */
export const ADMITTED_GLOBALS: ReadonlySet<string> = new Set([
  "Array",
  "Buffer",
  "Date",
  "Error",
  "JSON",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Reflect",
  "Set",
  "String",
  "Symbol",
  "SyntaxError",
  "URL",
  "clearTimeout",
  "console",
  "globalThis",
  "process",
  "setTimeout",
  "undefined",
]);

/**
 * Admitted `node:` module surfaces — per module, the admitted named exports. `node:module`
 * is present as a key (its bare specifier is not register-denied) but its admitted-name set
 * is deliberately EMPTY: `createRequire` is a `DENIED_CAPABILITY_PRIMITIVES` member, gated by
 * the anchor exemption proof, never blanket-admitted through this table.
 */
export const ADMITTED_NODE_SURFACES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["node:async_hooks", new Set(["AsyncLocalStorage"])],
  ["node:console", new Set(["Console"])],
  ["node:fs", new Set(["existsSync", "readFileSync", "readdirSync", "realpathSync", "statSync"])],
  ["node:module", new Set()],
  ["node:path", new Set(["dirname", "isAbsolute", "join", "relative"])],
  ["node:url", new Set(["fileURLToPath"])],
]);

/**
 * Admitted static member paths off free roots (`ADMITTED_GLOBALS` or an admitted `node:`
 * import), one level down and beyond — REQ-CAP-04.6. Entries are FULL recorded paths at
 * whatever depth they occur (e.g. `process.stdout.write.bind` is depth 3); admission is
 * exact full-path membership, never prefix-inherited. A member path off an admitted root
 * that is NOT in this table is a violation by default (REQ-CAP-04.7).
 */
export const ADMITTED_MEMBER_PATHS: ReadonlySet<string> = new Set([
  "Array.isArray",
  "Buffer.alloc",
  "Buffer.byteLength",
  "Buffer.concat",
  "Buffer.from",
  "Buffer.isBuffer",
  "JSON.parse",
  "JSON.stringify",
  "Number.MAX_SAFE_INTEGER",
  "Number.isInteger",
  "Object.defineProperty",
  "Object.entries",
  "Object.getPrototypeOf",
  "Object.hasOwn",
  "Object.keys",
  "Object.prototype",
  "Promise.allSettled",
  "Promise.race",
  "Promise.resolve",
  "Reflect.get",
  "Symbol.for",
  "console.warn",
  "process.argv.slice",
  "process.cwd",
  "process.exit",
  "process.stderr",
  "process.stderr.write",
  "process.stdin",
  "process.stdout",
  "process.stdout.write.bind",
]);

/** Closed union — a new member forces a compile error at the classifier's exhaustive switch. */
export type SurfaceNodeKind =
  | "callee" // expression of a CallExpression / NewExpression
  | "value-reference" // free Identifier in value position
  | "member-path" // non-computed PropertyAccessExpression rooted at a free Identifier
  | "meta-property" // import.meta
  | "module-specifier"; // static node:-prefixed import/export specifier

/** Pinned by exact membership (REQ-CAP-01.4) — never a count threshold. */
export const SURFACE_NODE_KINDS: ReadonlySet<SurfaceNodeKind> = new Set([
  "callee",
  "value-reference",
  "member-path",
  "meta-property",
  "module-specifier",
]);

/** The four surface exclusions (design.md §1) — claims a node cannot yield a capability. */
export type SurfaceExclusion =
  | "jsdoc-rooted" // E1: JSDoc is a comment, erased at runtime
  | "declaration-name" // E2: a binding site is not a reference
  | "property-name" // E3: non-computed property name — the enclosing access is the surface node
  | "type-position"; // E4: erased by emit

/** Pinned by exact membership (REQ-CAP-01.5) — never a count threshold. */
export const SURFACE_EXCLUSIONS: ReadonlySet<SurfaceExclusion> = new Set([
  "jsdoc-rooted",
  "declaration-name",
  "property-name",
  "type-position",
]);

export interface SurfaceNode {
  readonly kind: SurfaceNodeKind;
  readonly node: Node;
  /** Fully-qualified path for member-path/callee (dotted), the name otherwise. */
  readonly text: string;
  readonly line: number;
}

export type Disposition =
  | {
      readonly kind: "admitted";
      readonly via: "local" | "closure-import" | "admitted-global" | "admitted-builtin-surface" | "exempt-anchor";
    }
  | { readonly kind: "violation"; readonly rule: ViolationRule; readonly detail: string }
  | { readonly kind: "unclassifiable"; readonly detail: string };

/** D-3: origin is per-POSITION — `tainted` is admitted as a value, denied as a callee. */
export type BindingOrigin =
  | { readonly kind: "local" }
  | { readonly kind: "closure-import"; readonly specifier: string; readonly importedName: string }
  | { readonly kind: "admitted-global" }
  | {
      readonly kind: "tainted";
      readonly reason: "computed-initializer" | "denied-initializer" | "undecidable-initializer" | "reassigned";
    };

/** REQ-XPO-01: a proof ON THE FILE, forfeit on any other arrangement. */
export interface ExemptionProof {
  readonly primitive: "createRequire";
  readonly binding: string;
  readonly form: "named-import" | "namespace";
  readonly anchorIsClosureNode: boolean;
}

/** Per-file facts resolved once: scope chain, import bindings, reassignments, exemption proof. */
export interface FileContext {
  readonly file: ClosurePath;
  readonly bindings: ReadonlyMap<string, BindingOrigin>;
  readonly reassignedImports: readonly string[];
  readonly reassignedModuleLocals: readonly string[];
  readonly exemption: ExemptionProof | undefined;
  /** REQ-CAP-02 precondition violations — computed alongside the bindings pass. */
  readonly reassignmentViolations: readonly { readonly node: Node; readonly name: string }[];
}

// ---------------------------------------------------------------------------------------
// enumerateCapabilitySurface — WHAT IS PRESENT, independent of the classifier.
// ---------------------------------------------------------------------------------------

function isDeclarationName(id: Identifier): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isBindingElement(parent) && parent.getNameNode() === id) return true;
  if (Node.isParameterDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isFunctionDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isClassDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isImportSpecifier(parent)) return true;
  if (Node.isImportClause(parent)) return true;
  if (Node.isNamespaceImport(parent)) return true;
  if (Node.isCatchClause(parent)) return true;
  return false;
}

function isPropertyNamePosition(id: Identifier): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return true;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return true;
  if (Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === id) return true;
  if (Node.isPropertySignature(parent) && parent.getNameNode() === id) return true;
  if (Node.isMethodDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isMethodSignature(parent) && parent.getNameNode() === id) return true;
  if (Node.isGetAccessorDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isSetAccessorDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === id) return true;
  return false;
}

function isJsDocRooted(id: Identifier): boolean {
  return (
    id.getFirstAncestorByKind(SyntaxKind.JSDoc) !== undefined ||
    id.getFirstAncestorByKind(SyntaxKind.JSDocTag) !== undefined
  );
}

function isTypePosition(id: Identifier): boolean {
  return id.getFirstAncestorByKind(SyntaxKind.TypeReference) !== undefined;
}

function isDynamicImportCall(node: Node): boolean {
  return Node.isCallExpression(node) && node.getExpression().getKind() === SyntaxKind.ImportKeyword;
}

/** Walks a maximal non-computed PropertyAccessExpression chain down to its root expression. */
function maximalAccessRoot(access: Node): Node {
  let cur = access;
  while (Node.isPropertyAccessExpression(cur)) cur = cur.getExpression();
  return cur;
}

function chainText(root: Node, leaf: Node): string {
  const segments: string[] = [];
  let cur: Node = leaf;
  while (Node.isPropertyAccessExpression(cur) && cur !== root) {
    segments.unshift(cur.getName());
    cur = cur.getExpression();
  }
  return [root.getText(), ...segments].join(".");
}

/** WHAT IS PRESENT. Independent of the classifier — this is what makes totality falsifiable. */
export function enumerateCapabilitySurface(sourceFile: SourceFile): readonly SurfaceNode[] {
  const nodes: SurfaceNode[] = [];
  const calleeExpressions = new Set<Node>();
  // Tracks every node already folded into a larger surface node (a chain's root identifier,
  // or a chain SEGMENT's property name) so the general identifier pass below never
  // double-enumerates a piece of an already-consumed chain — e.g. `m` in a callee chain
  // `m.createRequire(...)` must not ALSO surface as its own standalone value-reference.
  const consumedAsChainSegment = new Set<Node>();

  // 1. module-specifier — node:-prefixed import/export specifiers that name a REAL builtin
  //    only. Relative and bare specifiers are exhaustively classified elsewhere
  //    (classifySpecifier); this leg exists for the register/admission concern only. A
  //    node:-prefixed specifier that is NOT a real builtin is already `unclassifiable-
  //    construct` via classifySpecifier's own R1-15 validation — enumerating it here too
  //    would double-report the identical defect under the identical rule.
  const isRealNodeBuiltin = (specifier: string): boolean => builtinModules.includes(specifier.slice("node:".length));
  for (const declaration of sourceFile.getImportDeclarations()) {
    const value = declaration.getModuleSpecifierValue();
    if (value.startsWith("node:") && isRealNodeBuiltin(value)) {
      nodes.push({ kind: "module-specifier", node: declaration, text: value, line: declaration.getStartLineNumber() });
    }
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    const value = declaration.getModuleSpecifierValue();
    if (value !== undefined && value.startsWith("node:") && isRealNodeBuiltin(value)) {
      nodes.push({ kind: "module-specifier", node: declaration, text: value, line: declaration.getStartLineNumber() });
    }
  }

  // 2. meta-property — import.meta.
  for (const meta of sourceFile.getDescendantsOfKind(SyntaxKind.MetaProperty)) {
    nodes.push({ kind: "meta-property", node: meta, text: meta.getText(), line: meta.getStartLineNumber() });
  }

  // 3. callee — the expression of every call/`new`, excluding dynamic import(). Enumerated
  //    BEFORE the general identifier/member-path pass so that pass can skip nodes already
  //    consumed here (a maximal chain used as a callee is ONE surface node, not two).
  for (const call of [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression),
  ]) {
    if (isDynamicImportCall(call)) continue;
    const callee = call.getExpression();
    calleeExpressions.add(callee);
    // If the callee is (or contains, as its base) a PropertyAccessExpression chain rooted at
    // an Identifier, mark every link consumed — `m.createRequire` as a callee means `m`
    // itself is never ALSO a standalone value-reference surface node.
    let chainCursor: Node = callee;
    while (Node.isPropertyAccessExpression(chainCursor)) {
      consumedAsChainSegment.add(chainCursor);
      chainCursor = chainCursor.getExpression();
    }
    if (Node.isIdentifier(chainCursor)) consumedAsChainSegment.add(chainCursor);
    nodes.push({ kind: "callee", node: callee, text: oneLine(callee.getText()), line: callee.getStartLineNumber() });
  }

  // 4. member-path / value-reference — every remaining free-identifier-rooted reference.
  for (const access of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const parent = access.getParent();
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === access) {
      continue; // not maximal — the outer access is the surface node
    }
    if (calleeExpressions.has(access)) continue; // already a callee surface node

    const root = maximalAccessRoot(access);
    if (!Node.isIdentifier(root)) continue; // computed/complex base — not a member-path shape
    consumedAsChainSegment.add(root);
    nodes.push({
      kind: "member-path",
      node: access,
      text: chainText(root, access),
      line: access.getStartLineNumber(),
    });
  }

  for (const id of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (isDeclarationName(id)) continue;
    if (isPropertyNamePosition(id)) continue;
    if (id.getParent()?.getKind() === SyntaxKind.MetaProperty) continue; // "meta" of import.meta
    if (isJsDocRooted(id)) continue; // E1
    if (isTypePosition(id)) continue; // E4
    if (consumedAsChainSegment.has(id)) continue; // root of an already-enumerated member-path
    // a non-root segment of a property-access chain (E3) — its parent IS a PropertyAccessExpression
    // whose name node is this id, already excluded by isPropertyNamePosition above.
    if (calleeExpressions.has(id)) continue; // already a callee surface node

    nodes.push({ kind: "value-reference", node: id, text: id.getText(), line: id.getStartLineNumber() });
  }

  return nodes;
}

function oneLine(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 197)}...` : collapsed;
}

// ---------------------------------------------------------------------------------------
// buildFileContext — per-file scope/origin resolution (REQ-CAP-02, REQ-XPO-01's S-001 leg).
// ---------------------------------------------------------------------------------------

/** Every local name the file binds `createRequire` to, node:module import only. */
function createRequireBindingsIn(sourceFile: SourceFile): Array<{ readonly name: string; readonly form: "named-import" | "namespace" }> {
  const bindings: Array<{ readonly name: string; readonly form: "named-import" | "namespace" }> = [];
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "node:module") continue;
    for (const specifier of declaration.getNamedImports()) {
      if (specifier.getName() === "createRequire") {
        bindings.push({
          name: specifier.getAliasNode()?.getText() ?? specifier.getName(),
          form: "named-import",
        });
      }
    }
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined) {
      bindings.push({ name: namespaceImport.getText(), form: "namespace" });
    }
  }
  return bindings;
}

/**
 * Resolution, never execution (ADR-04/REQ-XPO-01). True only for `X(...).resolve(...)` in
 * named-import form, or `NS.createRequire(...).resolve(...)` in namespace form.
 */
function isResolveOnlyUse(node: Node, form: "named-import" | "namespace"): boolean {
  let callee: Node = node;
  if (form === "namespace") {
    const access = node.getParent();
    if (!Node.isPropertyAccessExpression(access) || access.getName() !== "createRequire") return false;
    callee = access;
  }
  const call = callee.getParent();
  if (!Node.isCallExpression(call) || call.getExpression() !== callee) return false;
  const access = call.getParent();
  if (!Node.isPropertyAccessExpression(access) || access.getExpression() !== call) return false;
  if (access.getName() !== "resolve") return false;
  const outerCall = access.getParent();
  return Node.isCallExpression(outerCall) && outerCall.getExpression() === access;
}

type TaintReason = Extract<BindingOrigin, { readonly kind: "tainted" }>["reason"];

/**
 * Classifies a VariableDeclaration initializer for D-3's taint rules. undefined = untainted.
 * Uses the SAME chain resolver as callee/member-path admission (`resolveChain`) so a
 * safe-terminal-rooted initializer (`this.#handles`, `getRunAls()`, a literal) is never
 * mistaken for an undecidable one — only a genuinely computed or unresolvable initializer
 * taints its binding.
 */
function taintReasonOf(initializer: Node | undefined): TaintReason | undefined {
  if (initializer === undefined) return undefined;
  if (Node.isElementAccessExpression(initializer)) return "computed-initializer";
  if (Node.isIdentifier(initializer) && DENIED_CAPABILITY_PRIMITIVES.has(initializer.getText())) {
    return "denied-initializer";
  }
  if (Node.isPropertyAccessExpression(initializer) || Node.isCallExpression(initializer) || Node.isNewExpression(initializer)) {
    const resolution = resolveChain(initializer);
    if (resolution === undefined) return "undecidable-initializer";
    if (resolution.kind === "identifier-rooted") {
      const path = [resolution.chain.rootName, ...resolution.chain.path].join(".");
      if (DENIED_CAPABILITY_PRIMITIVES.has(path)) return "denied-initializer";
    }
  }
  return undefined;
}

/** Per-file facts resolved once — scope chain, import bindings, reassignments, exemption. */
export function buildFileContext(sourceFile: SourceFile, opts: { readonly file: ClosurePath; readonly isAnchorFile: boolean }): FileContext {
  const bindings = new Map<string, BindingOrigin>();
  const reassignedImports: string[] = [];
  const reassignedModuleLocals: string[] = [];
  const reassignmentViolations: Array<{ readonly node: Node; readonly name: string }> = [];

  // Imports.
  for (const declaration of sourceFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    for (const named of declaration.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      bindings.set(local, { kind: "closure-import", specifier, importedName: named.getName() });
    }
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport !== undefined) {
      bindings.set(defaultImport.getText(), { kind: "closure-import", specifier, importedName: "default" });
    }
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined) {
      bindings.set(namespaceImport.getText(), { kind: "closure-import", specifier, importedName: "*" });
    }
  }

  // Module-scope (and function/class/block-scope) declarations: var/let/const, functions,
  // classes, parameters, destructuring — bound "local", tainted if the initializer warrants.
  for (const decl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = decl.getNameNode();
    if (!Node.isIdentifier(nameNode)) continue; // destructuring handled by its BindingElements below
    const reason = taintReasonOf(decl.getInitializer());
    bindings.set(nameNode.getText(), reason === undefined ? { kind: "local" } : { kind: "tainted", reason });
  }
  for (const el of sourceFile.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    const nameNode = el.getNameNode();
    if (Node.isIdentifier(nameNode) && !bindings.has(nameNode.getText())) {
      bindings.set(nameNode.getText(), { kind: "local" });
    }
  }
  for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    const name = fn.getName();
    if (name !== undefined) bindings.set(name, { kind: "local" });
  }
  for (const cls of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
    const name = cls.getName();
    if (name !== undefined) bindings.set(name, { kind: "local" });
  }
  for (const param of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
    const nameNode = param.getNameNode();
    if (Node.isIdentifier(nameNode)) bindings.set(nameNode.getText(), { kind: "local" });
  }
  for (const clause of sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause)) {
    const decl = clause.getVariableDeclaration();
    const nameNode = decl?.getNameNode();
    if (nameNode !== undefined && Node.isIdentifier(nameNode)) bindings.set(nameNode.getText(), { kind: "local" });
  }

  // Admitted globals — only for names not already bound locally/via import.
  for (const name of ADMITTED_GLOBALS) {
    if (!bindings.has(name)) bindings.set(name, { kind: "admitted-global" });
  }

  // REQ-CAP-02: no-module-scope-reassignment precondition. (a) reassigning an import binding
  // is always a violation. (b) reassigning a module-scope let/var requires the RHS to itself
  // classify as admitted — approximated here as "not tainted"; a tainted RHS is caught by its
  // own initializer-taint rule at the use site regardless.
  const importNames = new Set(sourceFile.getImportDeclarations().flatMap((d) => {
    const names = d.getNamedImports().map((n) => n.getAliasNode()?.getText() ?? n.getName());
    const def = d.getDefaultImport();
    if (def !== undefined) names.push(def.getText());
    const ns = d.getNamespaceImport();
    if (ns !== undefined) names.push(ns.getText());
    return names;
  }));
  for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getOperatorToken().getText() !== "=") continue;
    const lhs = bin.getLeft();
    if (!Node.isIdentifier(lhs)) continue;
    const name = lhs.getText();
    if (importNames.has(name)) {
      reassignedImports.push(name);
      reassignmentViolations.push({ node: lhs, name });
      continue;
    }
    const origin = bindings.get(name);
    if (origin?.kind === "local" || origin?.kind === "tainted") {
      reassignedModuleLocals.push(name);
      // Only a violation if this reassignment is itself at MODULE scope, not a nested
      // function/block scope local reassignment (ordinary control flow) — approximated via
      // the enclosing function/arrow-function ancestor check.
      const enclosingFn =
        lhs.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a) || Node.isConstructorDeclaration(a) || Node.isGetAccessorDeclaration(a) || Node.isSetAccessorDeclaration(a));
      const declaredAtModuleScope = sourceFile
        .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
        .some((d) => Node.isIdentifier(d.getNameNode()) && d.getNameNode().getText() === name && d.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a)) === undefined);
      if (enclosingFn === undefined && declaredAtModuleScope) {
        const rhsTaint = taintReasonOf(bin.getRight());
        if (rhsTaint === undefined) {
          // RHS classifies as admitted independently — precondition still sound, no violation,
          // but the reassignment must be recorded (D-2: real closure carries exactly 3).
        } else {
          reassignmentViolations.push({ node: lhs, name });
        }
      }
    }
  }

  // Exemption proof (createRequire anchor) — S-001's minimal port of the existing anchor
  // exemption; XPO-01's full "forfeit on any other arrangement" formalisation is S-002's job.
  let exemption: ExemptionProof | undefined;
  if (opts.isAnchorFile) {
    const anchorBindings = createRequireBindingsIn(sourceFile);
    if (anchorBindings.length === 1) {
      const only = anchorBindings[0] as { readonly name: string; readonly form: "named-import" | "namespace" };
      exemption = { primitive: "createRequire", binding: only.name, form: only.form, anchorIsClosureNode: true };
    }
  }

  return { file: opts.file, bindings, reassignedImports, reassignedModuleLocals, exemption, reassignmentViolations };
}

// ---------------------------------------------------------------------------------------
// classifySurfaceNode — WHAT IS ADMITTED. Total over SurfaceNodeKind.
// ---------------------------------------------------------------------------------------

interface ResolvedChain {
  readonly rootName: string;
  readonly path: readonly string[];
}

type ChainResolution = { readonly kind: "identifier-rooted"; readonly chain: ResolvedChain } | { readonly kind: "safe-terminal" };

/**
 * Walks a callee/member-path expression to its root. A chain is decidable when EVERY link is
 * one of: a non-computed property access, a parenthesized/non-null wrapper, or a terminal
 * that is either an Identifier (needs origin admission) or structurally incapable of naming
 * an externally-sourced capability — `this`/`super`, a call/`new` RESULT (the call's OWN
 * callee is independently enumerated and admitted/denied on its own), a literal, or a `??`
 * fallback. `this.#pending.push(...)`, `getRunAls().getStore()`, `/re/.test(...)` and
 * `createRequire(anchor).resolve(...)` (the exemption's own outer call) are real-closure
 * examples of "safe-terminal" chains — probe-verified 0/423 undecidable callees on this
 * branch depends on all four being admitted, not just the identifier-rooted case.
 *
 * ANY computed (`[...]`) access anywhere in the chain, or a callee that is ITSELF a bare
 * call/`new` result invoked with no further property name (`x()()`), is undecidable — this
 * is the shape M2.1 (`globalThis["ev"+"al"]`) and M2.2's outer call
 * (`(()=>{}).constructor(...)()`) share, and the only shape REQ-CAP-03 exists to deny.
 */
function resolveChain(expr: Node): ChainResolution | undefined {
  const path: string[] = [];
  let cur: Node = expr;
  for (;;) {
    if (Node.isIdentifier(cur)) return { kind: "identifier-rooted", chain: { rootName: cur.getText(), path } };
    if (Node.isPropertyAccessExpression(cur)) {
      path.unshift(cur.getName());
      cur = cur.getExpression();
      continue;
    }
    if (Node.isParenthesizedExpression(cur) || Node.isNonNullExpression(cur)) {
      cur = cur.getExpression();
      continue;
    }
    if (
      cur.getKind() === SyntaxKind.ThisKeyword ||
      cur.getKind() === SyntaxKind.SuperKeyword ||
      Node.isCallExpression(cur) ||
      Node.isNewExpression(cur) ||
      Node.isRegularExpressionLiteral(cur) ||
      Node.isStringLiteral(cur) ||
      Node.isNoSubstitutionTemplateLiteral(cur) ||
      Node.isArrayLiteralExpression(cur) ||
      Node.isObjectLiteralExpression(cur) ||
      (Node.isBinaryExpression(cur) && cur.getOperatorToken().getText() === "??")
    ) {
      return { kind: "safe-terminal" };
    }
    return undefined; // computed access, or any other shape that cannot name its origin
  }
}

let anchorExemptionConsumed = false;

function resetExemptionConsumptionForTest(): void {
  anchorExemptionConsumed = false;
}

function checkExemption(node: Node, chain: ResolvedChain, ctx: FileContext): boolean {
  if (ctx.exemption === undefined || chain.rootName !== ctx.exemption.binding) return false;
  if (anchorExemptionConsumed) return false;
  const rootIdentifier = findRootIdentifier(node);
  if (rootIdentifier === undefined) return false;
  // The import declaration's own binding identifier is never a "use" — never exempt/deny it here.
  if (rootIdentifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) !== undefined) return false;
  if (isResolveOnlyUse(rootIdentifier, ctx.exemption.form)) {
    anchorExemptionConsumed = true;
    return true;
  }
  return false;
}

function findRootIdentifier(node: Node): Node | undefined {
  let cur = node;
  while (Node.isPropertyAccessExpression(cur)) cur = cur.getExpression();
  return Node.isIdentifier(cur) ? cur : undefined;
}

/** Origin admission + member-path admission, shared by callee/member-path/value-reference legs. */
function classifyOrigin(
  chain: ResolvedChain,
  ctx: FileContext,
  opts: { readonly isCalleePosition: boolean; readonly node: Node }
): Disposition {
  if (checkExemption(opts.node, chain, ctx)) {
    return { kind: "admitted", via: "exempt-anchor" };
  }

  const origin = ctx.bindings.get(chain.rootName);
  const fullPathOfChain = [chain.rootName, ...chain.path].join(".");

  if (origin === undefined) {
    // Genuinely free, not in ADMITTED_GLOBALS, not local, not imported — e.g. `eval`,
    // `Function`, `WebAssembly` referenced bare, or a member-path-shaped register primitive
    // (`Bun.plugin`, `process.binding`'s cousins whose ROOT isn't itself admitted, `module.
    // register`) reached off a free, unadmitted root.
    if (!opts.isCalleePosition) return { kind: "admitted", via: "local" }; // D-1/D-3: value position is safe
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }

  if (origin.kind === "tainted") {
    // D-3: tainted is admitted as a value, denied as a callee.
    if (!opts.isCalleePosition) return { kind: "admitted", via: "local" };
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: chain.rootName };
  }

  if (origin.kind === "local") {
    return { kind: "admitted", via: "local" };
  }

  if (origin.kind === "admitted-global") {
    if (chain.path.length === 0) return { kind: "admitted", via: "admitted-global" };
    if (ADMITTED_MEMBER_PATHS.has(fullPathOfChain)) return { kind: "admitted", via: "admitted-builtin-surface" };
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }

  // origin.kind === "closure-import". A RELATIVE specifier names another file already inside
  // the walked closure (already hashed, already walked by this very function) — inherently
  // admitted, regardless of which name was imported. Only a `node:` specifier needs the
  // per-name ADMITTED_NODE_SURFACES check (an EXTERNAL origin, not itself closure-verified).
  if (!origin.specifier.startsWith("node:")) {
    return { kind: "admitted", via: "closure-import" };
  }
  const admittedNames = ADMITTED_NODE_SURFACES.get(origin.specifier);
  if (admittedNames?.has(origin.importedName)) {
    if (chain.path.length === 0) return { kind: "admitted", via: "admitted-builtin-surface" };
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }
  return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
}

/** WHAT IS ADMITTED. Total over SurfaceNodeKind; the `default` arm yields `unclassifiable`. */
export function classifySurfaceNode(node: SurfaceNode, ctx: FileContext): Disposition {
  switch (node.kind) {
    case "module-specifier": {
      const moduleName = node.text;
      if (DENIED_CAPABILITY_PRIMITIVES.has(moduleName)) {
        return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: moduleName };
      }
      if (ADMITTED_NODE_SURFACES.has(moduleName)) {
        return { kind: "admitted", via: "admitted-builtin-surface" };
      }
      return { kind: "unclassifiable", detail: moduleName };
    }
    case "meta-property": {
      return { kind: "admitted", via: "local" };
    }
    case "callee": {
      // NOTE: a bare call/`new` RESULT invoked directly (`x()()`) is NOT specially flagged
      // here — resolveChain treats a call-result base as a safe terminal one level in
      // (matching real-closure shapes like `getRunAls().getStore()`), and the call being
      // invoked is independently enumerated as its OWN callee surface node, so any defect in
      // IT is caught there without double-counting. M2.2 (`(()=>{}).constructor("return
      // 1")()`) is caught this way: the INNER call's callee (`.constructor` off an arrow
      // function) has no recognised safe-terminal shape (ArrowFunction/FunctionExpression are
      // deliberately absent from resolveChain's terminal list) and is undecidable on its own
      // merits — the outer call never needs its own rule.
      const resolution = resolveChain(node.node);
      if (resolution === undefined) {
        return { kind: "violation", rule: "constraint-4-undecidable-callee", detail: node.text };
      }
      if (resolution.kind === "safe-terminal") {
        return { kind: "admitted", via: "local" };
      }
      // REQ-CAP-05: positional decidability never applies to a callee position (only
      // instanceof/typeof operands are non-capability-yielding) — origin admission decides.
      return classifyOrigin(resolution.chain, ctx, { isCalleePosition: true, node: node.node });
    }
    case "member-path": {
      // enumerateCapabilitySurface only ever produces member-path nodes rooted at a plain
      // Identifier (design.md's own SurfaceNode definition) — resolveChain always returns
      // "identifier-rooted" here; the other branches exist for exhaustiveness, not because
      // they are reachable from this kind today.
      const resolution = resolveChain(node.node);
      if (resolution === undefined) {
        return { kind: "unclassifiable", detail: node.text };
      }
      if (resolution.kind === "safe-terminal") {
        return { kind: "admitted", via: "local" };
      }
      return classifyOrigin(resolution.chain, ctx, { isCalleePosition: false, node: node.node });
    }
    case "value-reference": {
      // REQ-CAP-05: positional decidability for denied roots — instanceof/typeof operand is
      // never a capability yield, regardless of origin.
      const parent = node.node.getParent();
      if (parent !== undefined) {
        if (Node.isTypeOfExpression(parent)) return { kind: "admitted", via: "local" };
        if (Node.isBinaryExpression(parent) && parent.getOperatorToken().getText() === "instanceof" && parent.getRight() === node.node) {
          return { kind: "admitted", via: "local" };
        }
      }
      const chain: ResolvedChain = { rootName: node.text, path: [] };
      return classifyOrigin(chain, ctx, { isCalleePosition: false, node: node.node });
    }
    default: {
      const exhaustive: never = node.kind;
      return { kind: "unclassifiable", detail: String(exhaustive) };
    }
  }
}

/** Resets the per-walk anchor-exemption single-use latch. Call once per file processed. */
export function resetAnchorExemptionLatch(): void {
  resetExemptionConsumptionForTest();
}
