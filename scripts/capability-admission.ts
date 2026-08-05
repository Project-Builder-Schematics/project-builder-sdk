// Capability-admission property (ADR-0079): replaces `denyScan`'s default-PASS text scan.
// Every node the surface ENUMERATOR reaches classifies into exactly one of {admitted,
// violation, unclassifiable-construct}, and the ORIGIN half of that decision is genuinely
// default-deny: a root binding that is not local, not a closure import and not an
// `ADMITTED_GLOBALS` member is a violation in every position. Two independently-implemented
// functions make that totality falsifiable: `enumerateCapabilitySurface` (what is present)
// and `classifySurfaceNode` (what is admitted) — see FIT-CAP-TOTALITY.
//
// What this is NOT: a sound adversary control. Two halves are not default-deny, by
// construction rather than by oversight.
//   - The PATH off a root the tables cannot decide (a local, a parameter, a closure import, a
//     safe terminal) is checked against `CAPABILITY_BEARING_SEGMENTS`, a DENY predicate over an
//     unbounded name space — anything it does not name passes.
//   - Enumeration totality is relative to the enumerator's own five `SurfaceNodeKind`s: a
//     construct it does not reach is not "unclassifiable", it is invisible. Tagged templates
//     were exactly that for two review rounds.
// Three independent rounds each closed the spellings they were shown and the next round found
// more; deciding an alias/reflection graph against an AST allowlist is a dataflow-analysis
// problem this mechanism does not solve. Its real job is DRIFT control — catching honest
// mistakes and agent edits that widen the closure's executed surface — not resisting an author
// who is trying. Demonstrated residual bypasses and the deferred differential oracle:
// docs/runner-integrity-invariants.md#known-gaps.
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
  /**
   * Bindings that ARE a member chain rather than an opaque local — `const p = process` and
   * `const { binding } = process` both record `process.binding`'s reach. One hop, resolved at
   * classification time, so `p.binding(…)` is decided as `process.binding(…)` is.
   */
  readonly aliases: ReadonlyMap<string, { readonly rootName: string; readonly path: readonly string[] }>;
  /** Names bound to a `Symbol(…)`/`Symbol.for(…)` result — the only decidable computed keys. */
  readonly symbolKeyed: ReadonlySet<string>;
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
  // `export { x } from "mod"` names a member of ANOTHER module — not a reference to anything in
  // this file's scope, and admitted per-name by the module-specifier leg instead. A LOCAL
  // `export { x }` is a genuine reference and stays enumerated.
  if (Node.isExportSpecifier(parent) && parent.getExportDeclaration().getModuleSpecifier() !== undefined) return true;
  if (Node.isNamespaceImport(parent)) return true;
  if (Node.isCatchClause(parent)) return true;
  return false;
}

function isPropertyNamePosition(id: Identifier): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return true;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return true;
  // A SHORTHAND property is deliberately absent: `{ process }` has no enclosing access to be the
  // surface node instead, so E3's justification does not hold for it — the name IS the reference.
  if (Node.isPropertySignature(parent) && parent.getNameNode() === id) return true;
  if (Node.isMethodDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isMethodSignature(parent) && parent.getNameNode() === id) return true;
  if (Node.isGetAccessorDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isSetAccessorDeclaration(parent) && parent.getNameNode() === id) return true;
  if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === id) return true;
  // A class field's own name (`origin;`, `appliedCount;`) is a member declaration exactly like
  // MethodDeclaration/GetAccessor above — a binding site, never a reference. 13 such nodes exist
  // in the real closure; without this they surface as free identifiers bound to nothing, which
  // is why "an unresolvable free root is a violation" could not be enforced before.
  if (Node.isPropertyDeclaration(parent) && parent.getNameNode() === id) return true;
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

/**
 * The callee node of every invocation form: a call's/`new`'s expression, and a TAGGED TEMPLATE's
 * tag. ``C`return process.version` `` invokes `C` exactly as `C("…")` does, and leaving the tag
 * off this list left the whole form outside the surface — no leg ever ran on it.
 */
function invocationCallees(sourceFile: SourceFile): Node[] {
  const callees: Node[] = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isDynamicImportCall(call)) continue;
    callees.push(call.getExpression());
  }
  for (const created of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    callees.push(created.getExpression());
  }
  for (const tagged of sourceFile.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression)) {
    callees.push(tagged.getTag());
  }
  return callees;
}

/**
 * The base expression of a member-chain link — `a` in both `a.b` and `a[b]`. `undefined` when
 * the node is not a link. Both spellings are member accesses; only the non-computed one is
 * decidable, which is a classification concern, not an enumeration one.
 */
function chainLinkBase(node: Node): Node | undefined {
  if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) return node.getExpression();
  return undefined;
}

/** Walks a maximal member chain (computed links included) down to its root expression. */
function maximalAccessRoot(access: Node): Node {
  let cur = access;
  for (;;) {
    const base = chainLinkBase(cur);
    if (base === undefined) return cur;
    cur = base;
  }
}

/** The dotted path for a fully non-computed chain; the raw source text once a link is computed. */
function chainText(root: Node, leaf: Node): string {
  const segments: string[] = [];
  let cur: Node = leaf;
  while (cur !== root) {
    if (!Node.isPropertyAccessExpression(cur)) return oneLine(leaf.getText());
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

  // 3. callee — the callee of every invocation, excluding dynamic import(). Enumerated
  //    BEFORE the general identifier/member-path pass so that pass can skip nodes already
  //    consumed here (a maximal chain used as a callee is ONE surface node, not two).
  for (const callee of invocationCallees(sourceFile)) {
    calleeExpressions.add(callee);
    // If the callee is (or contains, as its base) a PropertyAccessExpression chain rooted at
    // an Identifier, mark every link consumed — `m.createRequire` as a callee means `m`
    // itself is never ALSO a standalone value-reference surface node.
    let chainCursor: Node = callee;
    for (let base = chainLinkBase(chainCursor); base !== undefined; base = chainLinkBase(chainCursor)) {
      consumedAsChainSegment.add(chainCursor);
      chainCursor = base;
    }
    if (Node.isIdentifier(chainCursor)) consumedAsChainSegment.add(chainCursor);
    nodes.push({ kind: "callee", node: callee, text: oneLine(callee.getText()), line: callee.getStartLineNumber() });
  }

  // 4. member-path / value-reference — every remaining identifier-rooted member chain. COMPUTED
  //    links (`a[k]`) are enumerated here too: a computed access is still a member access, and
  //    leaving the whole `x[k]` family unenumerated is what made `unclassifiable-construct`
  //    structurally unreachable in value position (REQ-CAP-01.3).
  for (const access of [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression),
  ]) {
    const parent = access.getParent();
    if (parent !== undefined && chainLinkBase(parent) === access) {
      continue; // not maximal — the outer access is the surface node
    }
    if (calleeExpressions.has(access)) continue; // already a callee surface node

    // A chain rooted at something OTHER than an identifier is enumerated too. Skipping it is
    // what let `export const C = "".constructor.constructor` produce an escape with no finding
    // at all: the escape has to be decided at its PRODUCING occurrence, because no cross-module
    // dataflow follows the import edge to whichever file eventually calls it.
    const root = maximalAccessRoot(access);
    if (Node.isIdentifier(root)) consumedAsChainSegment.add(root);
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
  if (
    Node.isPropertyAccessExpression(initializer) ||
    Node.isCallExpression(initializer) ||
    Node.isNewExpression(initializer) ||
    Node.isTaggedTemplateExpression(initializer)
  ) {
    const resolution = resolveChain(initializer);
    if (resolution === undefined) return "undecidable-initializer";
    if (resolution.kind === "computed") return "computed-initializer";
    if (resolution.kind === "safe-terminal") {
      // A call RESULT held in a binding is an ordinary return value (`process.stdout.write.bind(…)`)
      // — the inner callee was admitted on its own merits. Only a capability-bearing path taints.
      return capabilityBearingSegment(resolution.path) === undefined ? undefined : "denied-initializer";
    }
    // A register primitive reached as the chain's ROOT taints too, not only as its full path:
    // `Function.prototype.constructor` names `Function`.
    if (deniedPrimitiveIn(resolution.chain) !== undefined) return "denied-initializer";
    const fullPath = [resolution.chain.rootName, ...resolution.chain.path].join(".");
    if (capabilityBearingSegment(resolution.chain.path, fullPath) !== undefined) return "denied-initializer";
  }
  return undefined;
}

/** The member chain a binding IS, when its initializer names one. `undefined` = opaque local. */
function aliasChainOf(initializer: Node | undefined): { readonly rootName: string; readonly path: readonly string[] } | undefined {
  if (initializer === undefined) return undefined;
  if (!Node.isIdentifier(initializer) && !Node.isPropertyAccessExpression(initializer)) return undefined;
  const resolution = resolveChain(initializer);
  return resolution?.kind === "identifier-rooted" ? resolution.chain : undefined;
}

/** Per-file facts resolved once — scope chain, import bindings, reassignments, exemption. */
export function buildFileContext(sourceFile: SourceFile, opts: { readonly file: ClosurePath; readonly isAnchorFile: boolean }): FileContext {
  const bindings = new Map<string, BindingOrigin>();
  const aliases = new Map<string, { readonly rootName: string; readonly path: readonly string[] }>();
  const symbolKeyed = new Set<string>();
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
    const initializer = decl.getInitializer();
    if (!Node.isIdentifier(nameNode)) continue; // destructuring handled by its BindingElements below
    const reason = taintReasonOf(initializer);
    bindings.set(nameNode.getText(), reason === undefined ? { kind: "local" } : { kind: "tainted", reason });
    const alias = aliasChainOf(initializer);
    if (alias !== undefined) aliases.set(nameNode.getText(), alias);
    if (initializer !== undefined && isSymbolProducingCall(initializer)) symbolKeyed.add(nameNode.getText());
  }
  // A destructured binding is a MEMBER of whatever was destructured — `const { binding } =
  // process` reaches `process.binding`. Binding it as an opaque `local` with no initializer
  // analysis at all was the destructuring half of the same laundering family.
  for (const el of sourceFile.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    const nameNode = el.getNameNode();
    if (!Node.isIdentifier(nameNode)) continue;
    const declaration = el.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    const source = declaration?.getInitializer();
    const memberName = el.getPropertyNameNode()?.getText() ?? nameNode.getText();
    const sourceChain = Node.isObjectBindingPattern(el.getParent()) ? aliasChainOf(source) : undefined;
    if (sourceChain !== undefined) {
      aliases.set(nameNode.getText(), { rootName: sourceChain.rootName, path: [...sourceChain.path, memberName] });
    }
    if (bindings.has(nameNode.getText())) continue;
    const reason = sourceChain === undefined ? taintReasonOf(source) : undefined;
    bindings.set(nameNode.getText(), reason === undefined ? { kind: "local" } : { kind: "tainted", reason });
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

  // Exemption proof (createRequire anchor, REQ-XPO-01) — a proof ON THE FILE, forfeit on any
  // other arrangement (XPO-01.3). "Any other arrangement" specifically means: the named-import
  // form bound under any name OTHER than the literal "createRequire" — an ALIASED import. The
  // namespace form has no canonical name to alias against (XPO-01.2 requires it green as-is),
  // so only the named-import branch can forfeit. Forfeiting means simply never granting the
  // exemption at all: with `exemption` left `undefined`, EVERY use of the binding — including
  // an otherwise-resolve-only-shaped one — falls through to the ordinary origin classification
  // below, which denies `createRequire` unconditionally as a `node:module` closure-import (its
  // per-name admission set is deliberately empty). That is what "denies every bound name" means
  // in practice: no separate forfeiture branch is needed, only the refusal to except it here.
  let exemption: ExemptionProof | undefined;
  if (opts.isAnchorFile) {
    const anchorBindings = createRequireBindingsIn(sourceFile);
    if (anchorBindings.length === 1) {
      const only = anchorBindings[0] as { readonly name: string; readonly form: "named-import" | "namespace" };
      const isAliased = only.form === "named-import" && only.name !== "createRequire";
      if (!isAliased) {
        exemption = { primitive: "createRequire", binding: only.name, form: only.form, anchorIsClosureNode: true };
      }
    }
  }

  return { file: opts.file, bindings, aliases, symbolKeyed, reassignedImports, reassignedModuleLocals, exemption, reassignmentViolations };
}

// ---------------------------------------------------------------------------------------
// classifySurfaceNode — WHAT IS ADMITTED. Total over SurfaceNodeKind.
// ---------------------------------------------------------------------------------------

interface ResolvedChain {
  readonly rootName: string;
  readonly path: readonly string[];
}

type ChainResolution =
  | { readonly kind: "identifier-rooted"; readonly chain: ResolvedChain }
  | { readonly kind: "safe-terminal"; readonly terminal: "value" | "call-result"; readonly path: readonly string[] }
  | { readonly kind: "computed"; readonly access: Node };

/**
 * Property names that can only be reached by walking INTO a capability. Two groups:
 *   - every dot segment of every non-`node:` register member (`eval`, `Function`, `Bun`,
 *     `plugin`, `process`, `binding`, `WebAssembly`, `module`, `register`, `registerHooks`,
 *     `createRequire`), derived from the register so the two cannot drift;
 *   - the prototype-graph escapes, which walk OUT of any value and into its constructor graph
 *     and are therefore not derivable from the register at all.
 *
 * `ADMITTED_MEMBER_PATHS` decides the path off an admitted GLOBAL and nothing else, so a chain
 * rooted at a local, a parameter, a closure import or a safe terminal used to get no path check
 * at all — the root's own admission decided the whole chain. This is what the path is checked
 * against instead.
 *
 * It is a DENY predicate over an unbounded name space, so it closes demonstrated spellings and
 * makes no closure claim: a carrier property named anything not listed here still launders its
 * base. See docs/runner-integrity-invariants.md#known-gaps.
 */
const CAPABILITY_BEARING_SEGMENTS: ReadonlySet<string> = new Set([
  ...[...DENIED_CAPABILITY_PRIMITIVES]
    .filter((primitive) => !primitive.startsWith("node:"))
    .flatMap((primitive) => primitive.split(".")),
  "constructor",
  "__proto__",
  "prototype",
]);

/**
 * The first capability-bearing segment of a chain's path, or `undefined`. An exact
 * `ADMITTED_MEMBER_PATHS` entry wins — `Object.prototype` is admitted at full-path identity
 * even though `prototype` is a bearing segment — so `fullPath` is passed wherever one exists
 * (an identifier-rooted chain) and omitted where none can (a safe terminal).
 */
function capabilityBearingSegment(path: readonly string[], fullPath?: string): string | undefined {
  if (fullPath !== undefined && ADMITTED_MEMBER_PATHS.has(fullPath)) return undefined;
  return path.find((segment) => CAPABILITY_BEARING_SEGMENTS.has(segment));
}

/**
 * Admitted member paths that PERFORM a computed member access, mapping the accessor to the
 * argument positions of its base and key. `Reflect.get(o, k)` IS `o[k]`; admitting the accessor
 * without classifying the access it performs is how `Reflect.get(globalThis, "eval")` read as
 * an ordinary admitted call. A new reflective entry in `ADMITTED_MEMBER_PATHS` needs a row here.
 */
const REFLECTIVE_ACCESSORS: ReadonlyMap<string, { readonly base: number; readonly key: number }> = new Map([
  ["Reflect.get", { base: 0, key: 1 }],
]);

/** `a ?? b` resolves through `a` only when `b` cannot itself name a capability. */
function isPlainFallback(node: Node): boolean {
  return (
    Node.isObjectLiteralExpression(node) ||
    Node.isArrayLiteralExpression(node) ||
    Node.isStringLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node) ||
    Node.isNumericLiteral(node) ||
    node.getKind() === SyntaxKind.NullKeyword ||
    node.getKind() === SyntaxKind.TrueKeyword ||
    node.getKind() === SyntaxKind.FalseKeyword
  );
}

/**
 * Walks a callee/member-path expression to its root. A chain is decidable when EVERY link is
 * one of: a non-computed property access, a parenthesized/non-null wrapper, a `??` whose
 * fallback is a literal, or a terminal that is either an Identifier (needs origin admission)
 * or a base that cannot NAME its own origin — `this`/`super`, a literal, or a call/`new`
 * RESULT. Such a base is not thereby harmless: `function g(){ return globalThis }` makes `g()`
 * a call result carrying the entire global surface, which is why the PATH off a safe terminal
 * is checked separately (`classifySafeTerminal`) instead of being admitted with its base.
 * `this.#pending.push(...)`, `getRunAls().getStore()`,
 * `/re/.test(...)`, `(property.choices ?? []).join(...)` and `createRequire(anchor).resolve(...)`
 * (the exemption's own outer call) are the real-closure "safe-terminal" shapes — probe-verified
 * 0/423 undecidable callees on this branch depends on them being admitted.
 *
 * A safe terminal is NOT an admission: it says "the base cannot name its origin", and the
 * caller still has to decide what the PATH off that base is allowed to be. `??` resolves
 * through its left operand instead of terminating, so `(globalThis ?? {}).eval` cannot use the
 * fallback to hide a global root.
 *
 * A computed link makes the chain undecidable as a callee (M2.1 `globalThis["ev"+"al"]`) and
 * `unclassifiable` as a value off a global root — it is returned as its own kind rather than
 * as `undefined` so the two cases can be reported under their own true rules.
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
    if (Node.isElementAccessExpression(cur)) return { kind: "computed", access: cur };
    if (Node.isBinaryExpression(cur) && cur.getOperatorToken().getText() === "??") {
      if (!isPlainFallback(cur.getRight())) return undefined; // two roots for one chain
      cur = cur.getLeft();
      continue;
    }
    // A tagged template IS an invocation, so its value is a call result exactly as `f(…)`'s is.
    if (Node.isCallExpression(cur) || Node.isNewExpression(cur) || Node.isTaggedTemplateExpression(cur)) {
      return { kind: "safe-terminal", terminal: "call-result", path };
    }
    if (
      cur.getKind() === SyntaxKind.ThisKeyword ||
      cur.getKind() === SyntaxKind.SuperKeyword ||
      // `import.meta` is its own admitted surface node; a path off it (`import.meta.url`) has no
      // identifier root, so it resolves here rather than falling through to `undefined`.
      cur.getKind() === SyntaxKind.MetaProperty ||
      Node.isRegularExpressionLiteral(cur) ||
      Node.isStringLiteral(cur) ||
      Node.isNoSubstitutionTemplateLiteral(cur) ||
      Node.isArrayLiteralExpression(cur) ||
      Node.isObjectLiteralExpression(cur)
    ) {
      return { kind: "safe-terminal", terminal: "value", path };
    }
    return undefined; // any other shape that cannot name its origin
  }
}

/**
 * REQ-CAP-05, at the DENIED ROOT'S OWN OCCURRENCE: a chain that names a register primitive —
 * as its root (`Function.prototype.constructor`) or as its full path (`process.binding`) — is a
 * violation in EVERY position bar `instanceof`-RHS / `typeof`-operand, which the value-reference
 * leg admits before origin classification is ever reached. Enforcing this at the occurrence
 * rather than at whichever alias is eventually CALLED is what closes the whole aliasing family
 * with no dataflow at all.
 */
function deniedPrimitiveIn(chain: ResolvedChain): string | undefined {
  if (DENIED_CAPABILITY_PRIMITIVES.has(chain.rootName)) return chain.rootName;
  const fullPath = [chain.rootName, ...chain.path].join(".");
  return DENIED_CAPABILITY_PRIMITIVES.has(fullPath) ? fullPath : undefined;
}

/** One hop of alias substitution: a binding that IS a chain is classified as that chain. */
function substituteAlias(chain: ResolvedChain, ctx: FileContext): ResolvedChain {
  const alias = ctx.aliases.get(chain.rootName);
  if (alias === undefined) return chain;
  return { rootName: alias.rootName, path: [...alias.path, ...chain.path] };
}

/**
 * A computed member access is decidable only when its ROOT cannot name an arbitrary capability.
 * Off a local value it is ordinary indexing (36 real-closure sites). Off a global namespace
 * object it can name ANY global including a denied one, so it is `unclassifiable-construct`
 * (REQ-CAP-01.3) — unless the key resolves to a Symbol, which cannot name a string-keyed
 * language capability (the real closure's `globalThis[Symbol.for(…)]` registry slot).
 */
function classifyComputedAccess(access: Node, text: string, ctx: FileContext): Disposition {
  const root = maximalAccessRoot(access);
  if (!Node.isIdentifier(root)) return { kind: "unclassifiable", detail: text };
  const chain = substituteAlias({ rootName: root.getText(), path: [] }, ctx);
  const rootIsGlobal =
    DENIED_CAPABILITY_PRIMITIVES.has(chain.rootName) || ctx.bindings.get(chain.rootName)?.kind === "admitted-global";
  if (!rootIsGlobal) return { kind: "admitted", via: "local" };
  const key = Node.isElementAccessExpression(access) ? access.getArgumentExpression() : undefined;
  if (key !== undefined && isSymbolKey(key, ctx)) return { kind: "admitted", via: "local" };
  return { kind: "unclassifiable", detail: text };
}

function isSymbolProducingCall(node: Node): boolean {
  if (!Node.isCallExpression(node)) return false;
  const resolution = resolveChain(node.getExpression());
  if (resolution?.kind !== "identifier-rooted") return false;
  return [resolution.chain.rootName, ...resolution.chain.path].join(".") === "Symbol.for" || resolution.chain.rootName === "Symbol";
}

function isSymbolKey(key: Node, ctx: FileContext): boolean {
  if (isSymbolProducingCall(key)) return true;
  return Node.isIdentifier(key) && ctx.symbolKeyed.has(key.getText());
}

let anchorExemptionConsumed = false;

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
  rawChain: ResolvedChain,
  ctx: FileContext,
  opts: { readonly isCalleePosition: boolean; readonly node: Node }
): Disposition {
  if (checkExemption(opts.node, rawChain, ctx)) {
    return { kind: "admitted", via: "exempt-anchor" };
  }

  // A binding that IS a chain is classified as that chain: `const p = process; p.binding(…)` and
  // `const { binding } = process` are `process.binding` however they are spelled, and a copied
  // taint (`const G = F`) resolves to the origin of what it copied.
  const chain = substituteAlias(rawChain, ctx);
  const origin = ctx.bindings.get(chain.rootName);
  const fullPathOfChain = [chain.rootName, ...chain.path].join(".");

  const deniedPrimitive = deniedPrimitiveIn(chain);
  if (deniedPrimitive !== undefined) {
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: deniedPrimitive };
  }

  // The PATH is decided independently of the root's own admission. Without this, `h.constructor`,
  // `w.p.binding` and `Holder.g.eval` were all `admitted via local` on the strength of a local
  // root: a carrier property is how an admitted origin hands over a capability it may not name.
  if (capabilityBearingSegment(chain.path, fullPathOfChain) !== undefined) {
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }

  if (origin === undefined) {
    // Genuinely free: not in ADMITTED_GLOBALS, not local, not imported — so NOT one of
    // REQ-CAP-04's four admitted origin kinds, in any position. Admitting it as `local` in
    // value position was the laundering path for every `Function.prototype.*` shape.
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
  // admitted, EXCEPT when the imported NAME is itself a denied register primitive
  // (REQ-XPO-01.4/M1.12: re-export laundering). `export { createRequire } from "node:module"`
  // followed by `import { createRequire } from "./reexporter.js"` must not turn a `node:`
  // origin into a blanket-admitted relative one just because it passed through a closure
  // file first — the exemption is a proof ON THE ANCHOR FILE specifically (REQ-XPO-01's own
  // text), never a predicate that follows a name through however many re-exports launder it.
  // A `node:` specifier separately needs the per-name ADMITTED_NODE_SURFACES check below (an
  // EXTERNAL origin, not itself closure-verified).
  if (!origin.specifier.startsWith("node:") && !DENIED_CAPABILITY_PRIMITIVES.has(origin.importedName)) {
    return { kind: "admitted", via: "closure-import" };
  }
  if (!origin.specifier.startsWith("node:")) {
    // Laundered register primitive: the exemption check already ran, unconditionally, at the
    // top of this function — `ctx.exemption` (if granted at all) is scoped to files where
    // `isAnchorFile` was true when `buildFileContext` ran, never to an arbitrary downstream
    // importer of a re-export, so reaching here means it correctly did not apply.
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }
  const admittedNames = ADMITTED_NODE_SURFACES.get(origin.specifier);
  if (admittedNames?.has(origin.importedName)) {
    if (chain.path.length === 0) return { kind: "admitted", via: "admitted-builtin-surface" };
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
  }
  return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: fullPathOfChain };
}

/**
 * A safe terminal says only "this base cannot name its origin" — the PATH off it still has to be
 * decided, and with no identifier root there is no table to decide it against. Two things are
 * therefore inadmissible: a capability-bearing path segment, and a call RESULT invoked with no
 * property name at all (`f()()`), which is how the result of an admitted call — `Reflect.get(
 * globalThis, "eval")` — got executed while every individual node classified as admitted.
 *
 * Every OTHER path off a safe terminal is admitted, which is a default-PASS on an unbounded name
 * space: a function returning a capability object launders whatever this predicate does not name.
 * `g().eval` is closed; the class is not. docs/runner-integrity-invariants.md#known-gaps.
 */
function classifySafeTerminal(
  resolution: Extract<ChainResolution, { readonly kind: "safe-terminal" }>,
  node: SurfaceNode,
  isCalleePosition: boolean
): Disposition {
  const escape = capabilityBearingSegment(resolution.path);
  if (escape !== undefined) {
    return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: node.text };
  }
  if (resolution.terminal === "call-result" && resolution.path.length === 0) {
    return isCalleePosition
      ? { kind: "violation", rule: "constraint-4-undecidable-callee", detail: node.text }
      : { kind: "unclassifiable", detail: node.text };
  }
  return { kind: "admitted", via: "local" };
}

/**
 * `Reflect.get(o, k)` IS `o[k]`, so it is classified as the computed access it performs rather
 * than as the admitted member path that spells it (REQ-CAP-04.6 admits `Reflect.get` itself).
 */
function classifyReflectiveAccess(callee: Node, chain: ResolvedChain, ctx: FileContext): Disposition | undefined {
  const positions = REFLECTIVE_ACCESSORS.get([chain.rootName, ...chain.path].join("."));
  if (positions === undefined) return undefined;
  const call = callee.getParent();
  if (!Node.isCallExpression(call) || call.getExpression() !== callee) return undefined;
  const args = call.getArguments();
  const base = args[positions.base];
  const key = args[positions.key];
  if (base === undefined) return undefined;
  const root = maximalAccessRoot(base);
  if (!Node.isIdentifier(root)) return undefined;
  const baseChain = substituteAlias({ rootName: root.getText(), path: [] }, ctx);
  const rootIsGlobal =
    DENIED_CAPABILITY_PRIMITIVES.has(baseChain.rootName) ||
    ctx.bindings.get(baseChain.rootName)?.kind === "admitted-global";
  if (!rootIsGlobal) return undefined;
  if (key !== undefined && isSymbolKey(key, ctx)) return undefined;
  return { kind: "unclassifiable", detail: oneLine(call.getText()) };
}

/** WHAT IS ADMITTED. Total over SurfaceNodeKind; the `default` arm yields `unclassifiable`. */
export function classifySurfaceNode(node: SurfaceNode, ctx: FileContext): Disposition {
  switch (node.kind) {
    case "module-specifier": {
      const moduleName = node.text;
      if (DENIED_CAPABILITY_PRIMITIVES.has(moduleName)) {
        return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: moduleName };
      }
      // An `export … from "node:…"` binds nothing locally, so its names are never checked at a
      // use site the way an import's are — the per-name admission has to happen here or the
      // export-from leg is a blanket admission of every name in the module (REQ-XPO-01.4).
      // `getName()` is the ORIGINAL name, so an alias cannot launder it.
      if (Node.isExportDeclaration(node.node)) {
        const admittedNames = ADMITTED_NODE_SURFACES.get(moduleName);
        const laundered = node.node
          .getNamedExports()
          .map((named) => named.getName())
          .find((name) => !(admittedNames?.has(name) ?? false));
        if (laundered !== undefined) {
          return { kind: "violation", rule: "constraint-4-inadmissible-origin", detail: laundered };
        }
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
      const resolution = resolveChain(node.node);
      if (resolution === undefined) {
        return { kind: "violation", rule: "constraint-4-undecidable-callee", detail: node.text };
      }
      if (resolution.kind === "computed") {
        // M2.1's shape (`globalThis["ev"+"al"]("1+1")`) — the only shape REQ-CAP-03 exists for.
        return { kind: "violation", rule: "constraint-4-undecidable-callee", detail: node.text };
      }
      if (resolution.kind === "safe-terminal") {
        return classifySafeTerminal(resolution, node, true);
      }
      const reflective = classifyReflectiveAccess(node.node, resolution.chain, ctx);
      if (reflective !== undefined) return reflective;
      // REQ-CAP-05: positional decidability never applies to a callee position (only
      // instanceof/typeof operands are non-capability-yielding) — origin admission decides.
      return classifyOrigin(resolution.chain, ctx, { isCalleePosition: true, node: node.node });
    }
    case "member-path": {
      const resolution = resolveChain(node.node);
      if (resolution === undefined) {
        return { kind: "unclassifiable", detail: node.text };
      }
      if (resolution.kind === "computed") {
        return classifyComputedAccess(node.node, node.text, ctx);
      }
      if (resolution.kind === "safe-terminal") {
        return classifySafeTerminal(resolution, node, false);
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
  anchorExemptionConsumed = false;
}
