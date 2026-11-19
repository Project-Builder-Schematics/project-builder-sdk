// fit-49's classifier. Target-layout paths (CODE-LAYOUT, as the SDK names them:
// `src/bounded-contexts/<ctx>/…`, `src/acl/<counterpart>/`, `src/shared-kernel/`,
// `src/platform/`, `src/acceptance/`) are classified from the path and fail closed on any context, layer,
// domain folder or counterpart the layout does not know.

import { REPLACED_CORE_FILES } from "../replaced-core.ts";

export const CONTEXTS = ["authoring", "runner-hosting"] as const;
export const ACL_COUNTERPARTS = ["irwire"] as const;
const DOMAIN_FOLDERS = new Set(["aggregates", "entities", "valueobjects", "services", "ports"]);

export type Context = (typeof CONTEXTS)[number];
export type Layer = "domain" | "application" | "infrastructure-in" | "infrastructure-out" | "composition" | "testing";

export type Class =
  | { kind: "context"; context: Context; layer: Layer }
  | { kind: "acl"; counterpart: string }
  | { kind: "shared-kernel" }
  | { kind: "platform" }
  | { kind: "acceptance" }
  | { kind: "public-entry"; testKit: boolean }
  | { kind: "process-entry" };

// `dialect` names the dialect folder a file sits in (adapter files and public barrels alike);
// `useCase` names the application/usecases/<name>/ folder; `scaffoldPart` marks the files the
// scaffold use case is built from outside its own folder; `formerCore` marks a file that moved
// out of src/core (test/support/replaced-core.ts).
export type Classified = Class & {
  dialect?: string;
  useCase?: string;
  drivingAdapter?: string;
  scaffoldPart?: true;
  formerCore?: true;
};

export class ClassificationError extends Error {}

function classifyTarget(path: string): Class | undefined {
  const parts = path.split("/");
  if (parts[0] !== "src") return undefined;
  if (parts[1] === "shared-kernel") return { kind: "shared-kernel" };
  if (parts[1] === "platform") return { kind: "platform" };
  if (parts[1] === "acceptance") return { kind: "acceptance" };
  if (parts[1] === "acl") {
    const counterpart = parts[2] ?? "";
    if (!(ACL_COUNTERPARTS as readonly string[]).includes(counterpart) || parts.length < 4) {
      throw new ClassificationError(`${path}: unknown acl counterpart "${counterpart}"`);
    }
    return { kind: "acl", counterpart };
  }
  if (parts[1] !== "bounded-contexts") return undefined;

  const context = parts[2] as Context;
  if (!(CONTEXTS as readonly string[]).includes(context)) {
    throw new ClassificationError(`${path}: unknown bounded context "${parts[2]}"`);
  }
  const [layer, sub] = [parts[3], parts[4]];
  if (layer === "composition.ts" && parts.length === 4) return { kind: "context", context, layer: "composition" };
  if (layer === "testing" && parts.length > 4) return { kind: "context", context, layer: "testing" };
  if (layer === "domain" && DOMAIN_FOLDERS.has(sub ?? "") && parts.length > 5) return { kind: "context", context, layer: "domain" };
  if (layer === "application" && sub === "usecases" && parts.length > 5) return { kind: "context", context, layer: "application" };
  if (layer === "infrastructure" && sub === "out" && parts[5] === "dialects" && parts.length < 8) {
    throw new ClassificationError(`${path}: a dialect adapter file belongs in infrastructure/out/dialects/<name>/`);
  }
  if (layer === "infrastructure" && (sub === "in" || sub === "out") && parts.length > 5) {
    return { kind: "context", context, layer: sub === "in" ? "infrastructure-in" : "infrastructure-out" };
  }
  throw new ClassificationError(`${path}: not a CODE-LAYOUT slot of bounded context "${context}"`);
}

export type Entries = { publicEntries: ReadonlySet<string>; testKitEntries: ReadonlySet<string>; processEntries: ReadonlySet<string> };

export const SCAFFOLD_PARTS: ReadonlySet<string> = new Set([
  "src/bounded-contexts/authoring/domain/services/filename-pipeline.ts",
]);

const FORMER_CORE = new Set(REPLACED_CORE_FILES.map((file) => `src/${file}`));

function unitOf(path: string): Pick<Classified, "dialect" | "useCase" | "drivingAdapter" | "scaffoldPart" | "formerCore"> {
  const dialect = /^src\/(?:dialects|bounded-contexts\/authoring\/infrastructure\/out\/dialects)\/([^/]+)\/./.exec(path);
  const useCase = /^src\/bounded-contexts\/[^/]+\/application\/usecases\/([^/]+)\/./.exec(path);
  const drivingAdapter = /^src\/bounded-contexts\/[^/]+\/infrastructure\/in\/([^/]+)\/./.exec(path);
  return {
    ...(dialect ? { dialect: dialect[1]! } : {}),
    ...(useCase ? { useCase: useCase[1]! } : {}),
    ...(drivingAdapter ? { drivingAdapter: drivingAdapter[1]! } : {}),
    ...(SCAFFOLD_PARTS.has(path) ? { scaffoldPart: true as const } : {}),
    ...(FORMER_CORE.has(path) ? { formerCore: true as const } : {}),
  };
}

/** Classifies one repo-relative path; throws ClassificationError for anything unknown. */
export function classify(path: string, entries: Entries): Classified {
  if (entries.publicEntries.has(path)) {
    return { kind: "public-entry", testKit: entries.testKitEntries.has(path), ...unitOf(path) };
  }
  if (entries.processEntries.has(path)) return { kind: "process-entry" };
  const target = classifyTarget(path);
  if (target !== undefined) return { ...target, ...unitOf(path) };
  throw new ClassificationError(
    `${path}: unclassified — it is no package entry and sits outside the target layout (src/bounded-contexts/, src/acl/, src/shared-kernel/, src/platform/, src/acceptance/)`
  );
}

const TEST_KIT_SUBPATHS = new Set(["./testing", "./conformance"]);

/** Public entries come from package.json `exports`; process entries are `src/bin/*` and the package `bin` sources. */
export function entriesFrom(pkg: { exports: Record<string, { import: string }>; bin: Record<string, string> }, files: readonly string[]): Entries {
  const toSource = (dist: string): string => dist.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts");
  const publicEntries = new Set<string>();
  const testKitEntries = new Set<string>();
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    publicEntries.add(toSource(target.import));
    if (TEST_KIT_SUBPATHS.has(subpath)) testKitEntries.add(toSource(target.import));
  }
  // `build:codegen` bundles the package bin from the repo-root `bin/` folder.
  const processEntries = new Set<string>(files.filter((f) => f.startsWith("src/bin/")));
  for (const dist of Object.values(pkg.bin)) processEntries.add(dist.replace(/^dist\//, "").replace(/\.js$/, ".ts"));
  return { publicEntries, testKitEntries, processEntries };
}
