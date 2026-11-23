// fit-49's rules: project-builder-architecture CODE-LAYOUT.md "Dependency rule"
// (origin/main 16c3df0, lines 122-132) plus the SDK rules of the approved proposal
// (odd/tasks/hexagonal-layout-proposal.md sections 3.2 and 4). `violation` returns the one rule an
// edge breaks, checked from the most specific rule to the most general.

import type { Classified } from "./classify.ts";
import { ALLOWED_SIBLINGS } from "./dialects.ts";

export const RULES = {
  noRuntimeIo: "domain/ and application/ never import runtime I/O (CODE-LAYOUT:126)",
  testingImporters: "testing/ is imported only by its own context's testing/ and the public test-kit entries (CODE-LAYOUT:130)",
  compositionImporters: "nothing inside a context imports composition; only entry points do (CODE-LAYOUT:129)",
  crossContext:
    "a context reaches another only through acl/ or that context's application layer (CODE-LAYOUT:132); the one exception is runner-hosting's driving adapters passing Authoring's package-files adapter to the run use case",
  platformImporters: "only infrastructure/, a context's testing/, composition and the entry points import platform/ (CODE-LAYOUT:127)",
  platformImports: "platform/ imports no bounded context, acl/ or application layer (CODE-LAYOUT:127)",
  sharedKernelImports: "shared-kernel/ imports no bounded context, acl/ or platform/ (CODE-LAYOUT:131, :127)",
  domainImports: "domain/ imports only domain/ and shared-kernel/ (CODE-LAYOUT:123)",
  applicationImports: "application/ imports only domain/, its own application/ and shared-kernel/ (CODE-LAYOUT:124)",
  infrastructureImports: "infrastructure/ imports application/, domain/, its own infrastructure/, acl/, shared-kernel/ and platform/ (CODE-LAYOUT:125)",
  aclImports: "acl/ imports the domain/ and application/ it translates, shared-kernel/, platform/ and itself",
  acceptance:
    "acceptance/ imports only the public entries, itself and, until sdk#103, the dialect kit and the JSON dialect's ast and ops; nothing outside acceptance/ imports it (CODE-LAYOUT:118, :130)",
  dialectIsolation:
    "a dialect adapter imports only domain/, shared-kernel/, platform/, its own folder, the siblings ALLOWED_SIBLINGS lists and no runtime I/O; only composition, its public barrel and those siblings import it (proposal 3.2)",
  scaffoldLeaf:
    "only the scaffold use case, its parts, the entry points and Authoring's commons facade in infrastructure/in/commons/ (CODE-LAYOUT:125) import the scaffold use case; scaffold code imports only itself, domain/, platform/, the run-factory use case, files that left src/core and node: builtins",
  binImporters: "nothing imports the repo-root bin/: it holds only the codegen process entry, which imports src/ (REQ-FPS-03)",
  handleDirection:
    "the run-factory use case never imports the dialect handle: the handle reaches the run one way, through run-context.ts and currentContext() (ADR-0037 F2)",
  noClosedDialectSet: "domain/ and application/ never name a dialect: no string literal equal to a dialect folder name or a declared extension (proposal 3.2)",
} as const;

export type Rule = keyof typeof RULES;

// Checked over string literals, not import edges, so `violation` never returns them.
export const LITERAL_RULES: readonly Rule[] = ["noClosedDialectSet"];

// CODE-LAYOUT:126's TypeScript list, plus the node modules that are the same I/O by another
// name. I/O-free builtins (node:path, node:url, node:crypto hashing, node:async_hooks) are
// allowed in every layer.
export const RUNTIME_IO = new Set([
  "node:fs",
  "node:fs/promises",
  "node:child_process",
  "node:net",
  "node:http",
  "node:https",
  "node:http2",
  "node:dgram",
  "node:tls",
  "node:readline",
  "process.stdin",
  "process.stdout",
  "process.env",
  "process.cwd",
]);

const isLayer = (c: Classified, ...layers: string[]): boolean => c.kind === "context" && layers.includes(c.layer);
const isEntry = (c: Classified): boolean => c.kind === "public-entry" || c.kind === "process-entry";
const sameContext = (a: Classified, b: Classified): boolean =>
  a.kind === "context" && b.kind === "context" && a.context === b.context;

const isSibling = (from: Classified, to: Classified): boolean =>
  from.dialect !== undefined && to.dialect !== undefined && (from.dialect === to.dialect || (ALLOWED_SIBLINGS[from.dialect] ?? []).includes(to.dialect));

// The parser library is not pinned here: fit-37 and fit-38 keep each parser inside its dialect's ast.ts.
function dialectIsolation(from: Classified, to: string, toClass: Classified | undefined): boolean {
  const isAdapter = from.dialect !== undefined && from.kind !== "public-entry";
  if (toClass === undefined) return isAdapter && RUNTIME_IO.has(to);
  if (toClass.dialect !== undefined) {
    return !(isSibling(from, toClass) || (isLayer(from, "composition") && sameContext(from, toClass)));
  }
  return isAdapter && !(isLayer(toClass, "domain") || toClass.kind === "shared-kernel" || toClass.kind === "platform");
}

// The run use case takes the package-files adapter from its caller (S9); the runner is one caller.
const AUTHORING_PACKAGE_FILES = "src/bounded-contexts/authoring/infrastructure/out/fs/package-files.ts";
const DIALECT_HANDLE = "src/bounded-contexts/authoring/domain/entities/dialect-handle.ts";

// The A-11 conformance steps need a `Dialect` object, and no public entry offers one until
// sdk#103: the dialect kit, and the real JSON dialect's parse/print and ops for `a conforming
// dialect`. Remove these when sdk#103 makes the kit public.
const ACCEPTANCE_DIALECT_KIT = new Set([
  "src/bounded-contexts/authoring/domain/services/define-dialect.ts",
  "src/bounded-contexts/authoring/infrastructure/out/dialects/json/ast.ts",
  "src/bounded-contexts/authoring/infrastructure/out/dialects/json/ops.ts",
]);

const inScaffold = (c: Classified): boolean => c.useCase === "scaffold" || c.scaffoldPart === true;
// The commons facade is the scaffold use case's public driving adapter; other driving adapters are not.
const isCommonsFacade = (c: Classified): boolean =>
  isLayer(c, "infrastructure-in") && c.kind === "context" && c.context === "authoring" && c.drivingAdapter === "commons";

// The scaffold use case is a leaf. The layer rules already keep it off other contexts and
// dialects; this adds what they allow: a sibling use case or the domain
// reaching into scaffold, scaffold reaching a sibling use case, and third-party packages.
function scaffoldLeaf(from: Classified, to: string, toClass: Classified | undefined): boolean {
  if (toClass?.useCase === "scaffold" && !inScaffold(from) && !isEntry(from) && !isCommonsFacade(from)) return true;
  if (!inScaffold(from)) return false;
  if (toClass === undefined) return !(to.startsWith("node:") || to.startsWith("process."));
  return !(inScaffold(toClass) || isLayer(toClass, "domain") || toClass.kind === "platform" || toClass.useCase === "run-factory" || toClass.formerCore === true);
}

/** The rule `from → to` breaks, or undefined. `toClass` is undefined for an external module. */
export function violation(from: Classified, to: string, toClass: Classified | undefined): Rule | undefined {
  if (toClass !== undefined && to.startsWith("bin/")) return "binImporters";
  if (from.kind === "context" && from.context === "authoring" && from.useCase === "run-factory" && to === DIALECT_HANDLE) return "handleDirection";
  if (from.kind === "acceptance") {
    return toClass === undefined || toClass.kind === "public-entry" || toClass.kind === "acceptance" || ACCEPTANCE_DIALECT_KIT.has(to)
      ? undefined
      : "acceptance";
  }
  if (toClass?.kind === "acceptance") return "acceptance";
  if (dialectIsolation(from, to, toClass)) return "dialectIsolation";
  if (scaffoldLeaf(from, to, toClass)) return "scaffoldLeaf";
  if (toClass === undefined) {
    return RUNTIME_IO.has(to) && isLayer(from, "domain", "application") ? "noRuntimeIo" : undefined;
  }

  if (isLayer(toClass, "testing")) {
    const allowed = (from.kind === "public-entry" && from.testKit) || (isLayer(from, "testing") && sameContext(from, toClass));
    if (!allowed) return "testingImporters";
  }
  if (isLayer(toClass, "composition") && !isEntry(from)) return "compositionImporters";
  if (isEntry(from)) return undefined;
  if (
    from.kind === "context" && toClass.kind === "context" && from.context !== toClass.context && toClass.layer !== "application" &&
    !(isLayer(from, "infrastructure-in") && from.context === "runner-hosting" && to === AUTHORING_PACKAGE_FILES)
  ) {
    return "crossContext";
  }
  if (toClass.kind === "platform" && !(isLayer(from, "infrastructure-in", "infrastructure-out", "testing", "composition") || from.kind === "acl" || from.kind === "platform")) {
    return "platformImporters";
  }

  const toModel = toClass.kind === "context" || toClass.kind === "acl";
  switch (from.kind) {
    case "platform":
      if (toModel) return "platformImports";
      break;
    case "shared-kernel":
      if (toModel || toClass.kind === "platform") return "sharedKernelImports";
      break;
    case "acl":
      if (!(isLayer(toClass, "domain", "application") || toClass.kind === "acl" || toClass.kind === "shared-kernel" || toClass.kind === "platform")) {
        return "aclImports";
      }
      break;
    case "context":
      if (from.layer === "domain" && !(isLayer(toClass, "domain") || toClass.kind === "shared-kernel")) return "domainImports";
      if (from.layer === "application" && !(isLayer(toClass, "domain", "application") || toClass.kind === "shared-kernel")) {
        return "applicationImports";
      }
      if (
        (from.layer === "infrastructure-in" || from.layer === "infrastructure-out") &&
        !(isLayer(toClass, "domain", "application", "infrastructure-in", "infrastructure-out") || ["acl", "shared-kernel", "platform"].includes(toClass.kind))
      ) {
        return "infrastructureImports";
      }
      break;
  }

  return undefined;
}
