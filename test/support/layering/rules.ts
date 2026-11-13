// fit-49's rules: project-builder-architecture CODE-LAYOUT.md "Dependency rule"
// (origin/main 16c3df0, lines 122-132) plus two SDK rules from the approved proposal
// (odd/tasks/hexagonal-layout-proposal.md section 4). `violation` returns the one rule an
// edge breaks, checked from the most specific rule to the most general.

import type { Classified } from "./classify.ts";

export const RULES = {
  noRuntimeIo: "domain/ and application/ never import runtime I/O (CODE-LAYOUT:126)",
  testingImporters: "testing/ is imported only by its own context's testing/ and the public test-kit entries (CODE-LAYOUT:130)",
  compositionImporters: "nothing inside a context imports composition; only entry points do (CODE-LAYOUT:129)",
  crossContext: "a context reaches another only through acl/ or that context's application layer (CODE-LAYOUT:132)",
  platformImporters: "only infrastructure/, composition and the entry points import platform/ (CODE-LAYOUT:127)",
  platformImports: "platform/ imports no bounded context, acl/ or application layer (CODE-LAYOUT:127)",
  sharedKernelImports: "shared-kernel/ imports no bounded context, acl/ or platform/ (CODE-LAYOUT:131, :127)",
  domainImports: "domain/ imports only domain/ and shared-kernel/ (CODE-LAYOUT:123)",
  applicationImports: "application/ imports only domain/, its own application/ and shared-kernel/ (CODE-LAYOUT:124)",
  infrastructureImports: "infrastructure/ imports application/, domain/, its own infrastructure/, acl/, shared-kernel/ and platform/ (CODE-LAYOUT:125)",
  aclImports: "acl/ imports the domain/ and application/ it translates, shared-kernel/, platform/ and itself",
  targetNeverImportsLegacy: "target-layout code never imports the legacy tree (proposal section 4)",
} as const;

export type Rule = keyof typeof RULES;

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

/** The rule `from → to` breaks, or undefined. `toClass` is undefined for an external module. */
export function violation(from: Classified, to: string, toClass: Classified | undefined): Rule | undefined {
  if (toClass === undefined) {
    return RUNTIME_IO.has(to) && isLayer(from, "domain", "application") ? "noRuntimeIo" : undefined;
  }

  if (isLayer(toClass, "testing")) {
    const allowed = (from.kind === "public-entry" && from.testKit) || (isLayer(from, "testing") && sameContext(from, toClass));
    if (!allowed) return "testingImporters";
  }
  if (isLayer(toClass, "composition") && !isEntry(from)) return "compositionImporters";
  if (isEntry(from)) return undefined;
  if (from.kind === "context" && toClass.kind === "context" && from.context !== toClass.context && toClass.layer !== "application") {
    return "crossContext";
  }
  if (toClass.kind === "platform" && !(isLayer(from, "infrastructure-in", "infrastructure-out", "composition") || from.kind === "acl" || from.kind === "platform")) {
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

  if (!from.legacy && toClass.legacy) return "targetNeverImportsLegacy";
  return undefined;
}
