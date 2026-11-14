// fit-49's classifier. Target-layout paths (CODE-LAYOUT, as the SDK names them:
// `src/bounded-contexts/<ctx>/…`, `src/acl/<counterpart>/`, `src/shared-kernel/`,
// `src/platform/`, `src/acceptance/`) are classified from the path and fail closed on any context, layer,
// domain folder or counterpart the layout does not know. Today's folders are classified by
// the LEGACY table, by dominant role with the other roles listed in `mixed`; the table
// shrinks as slices move files into the target tree.

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
// scaffold use case is built from outside its own folder.
export type Classified = Class & {
  legacy: boolean;
  mixed?: readonly string[];
  dialect?: string;
  useCase?: string;
  scaffoldPart?: true;
};

type LegacyRow = { path: string; class: Class; mixed?: readonly string[] };

const authoring = (layer: Layer): Class => ({ kind: "context", context: "authoring", layer });
const runnerHosting = (layer: Layer): Class => ({ kind: "context", context: "runner-hosting", layer });

// Longest matching path wins; a path ending in "/" covers its folder. Sources for each role:
// the current-state map in odd/tasks/hexagonal-layout-proposal.md section 2.1.
export const LEGACY: readonly LegacyRow[] = [
  { path: "src/commons/", class: authoring("application") },
  { path: "src/core/", class: authoring("domain") },
  { path: "src/core/emit-rejection.ts", class: { kind: "acl", counterpart: "irwire" } },
  { path: "src/dialects/", class: authoring("infrastructure-out") },
  { path: "src/testing/", class: authoring("testing") },
  { path: "src/conformance/", class: authoring("testing") },
  { path: "src/transport/", class: runnerHosting("infrastructure-in") },
  { path: "src/transport/stdio-engine-client.ts", class: { kind: "acl", counterpart: "irwire" } },
  { path: "src/transport/frame-reader.ts", class: { kind: "acl", counterpart: "irwire" } },
  { path: "src/transport/framing.ts", class: { kind: "shared-kernel" } },
  { path: "src/transport/wire-protocol.ts", class: { kind: "shared-kernel" } },
  { path: "src/transport/error-text.ts", class: { kind: "platform" } },
  { path: "bin/emit-type.ts", class: authoring("infrastructure-in") },
  { path: "bin/project-codegen.ts", class: authoring("infrastructure-in") },
];

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

function classifyLegacy(path: string): LegacyRow | undefined {
  let best: LegacyRow | undefined;
  for (const row of LEGACY) {
    const hit = row.path.endsWith("/") ? path.startsWith(row.path) : path === row.path;
    if (hit && (best === undefined || row.path.length > best.path.length)) best = row;
  }
  return best;
}

export type Entries = { publicEntries: ReadonlySet<string>; testKitEntries: ReadonlySet<string>; processEntries: ReadonlySet<string> };

export const SCAFFOLD_PARTS: ReadonlySet<string> = new Set([
  "src/bounded-contexts/authoring/domain/services/filename-pipeline.ts",
  "src/bounded-contexts/authoring/infrastructure/out/fs/walk.ts",
  "src/bounded-contexts/authoring/infrastructure/out/fs/path-guards.ts",
  "src/bounded-contexts/authoring/infrastructure/out/fs/classify-transport.ts",
]);

function unitOf(path: string): Pick<Classified, "dialect" | "useCase" | "scaffoldPart"> {
  const dialect = /^src\/(?:dialects|bounded-contexts\/authoring\/infrastructure\/out\/dialects)\/([^/]+)\/./.exec(path);
  const useCase = /^src\/bounded-contexts\/[^/]+\/application\/usecases\/([^/]+)\/./.exec(path);
  return {
    ...(dialect ? { dialect: dialect[1]! } : {}),
    ...(useCase ? { useCase: useCase[1]! } : {}),
    ...(SCAFFOLD_PARTS.has(path) ? { scaffoldPart: true as const } : {}),
  };
}

/** Classifies one repo-relative path; throws ClassificationError for anything unknown. */
export function classify(path: string, entries: Entries): Classified {
  if (entries.publicEntries.has(path)) {
    return { kind: "public-entry", testKit: entries.testKitEntries.has(path), legacy: false, ...unitOf(path) };
  }
  if (entries.processEntries.has(path)) return { kind: "process-entry", legacy: false };
  const target = classifyTarget(path);
  if (target !== undefined) return { ...target, legacy: false, ...unitOf(path) };
  const row = classifyLegacy(path);
  if (row !== undefined) return { ...row.class, legacy: true, ...(row.mixed ? { mixed: row.mixed } : {}), ...unitOf(path) };
  throw new ClassificationError(`${path}: unclassified — add it to the target layout or the LEGACY table`);
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
