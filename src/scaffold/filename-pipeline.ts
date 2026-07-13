// src/scaffold/filename-pipeline.ts (ADR-0044): the pure per-source-path pipeline —
// rename (matches the ORIGINAL source-relative path) → filename token translation
// (`__x__` → `{= x =}` in the wire pathTemplate) → `.template` suffix strip, in that PINNED
// order (REQ-FSC-05). Also owns include/exclude glob filtering (REQ-FSC-03, hand-rolled —
// the repo carries no glob library and none may be added) and intra-scaffold
// destination-collision detection (REQ-FSC-08). Zero I/O — pure string transforms over
// already-enumerated `walk.ts` entries.

import { invalidInput } from "../core/authoring-error.ts";

const TEMPLATE_SUFFIX = ".template";
const TOKEN_PATTERN = /__([A-Za-z_][A-Za-z0-9_]*(?:@[A-Za-z_][A-Za-z0-9_]*)*)__/g;

/**
 * Translates on-disk filename tokens to the wire `pathTemplate` syntax the ENGINE
 * substitutes (obs #915 ruling 4) — the SDK never renders these itself, only rewrites the
 * marker syntax. `__name@dasherize__` → `{= name | dasherize =}`; a bare `__name__`
 * (no `@pipe`) → `{= name =}`.
 */
export function translateTokens(path: string): string {
  return path.replace(TOKEN_PATTERN, (_match, inner: string) => {
    const [field, ...pipes] = inner.split("@");
    return pipes.length > 0 ? `{= ${field} | ${pipes.join(" | ")} =}` : `{= ${field} =}`;
  });
}

/** REQ-FSC-05 step (3): strips a `.template` suffix from the (post-translation) path. */
export function stripTemplateSuffix(path: string): { stripped: string; wasTemplate: boolean } {
  if (path.endsWith(TEMPLATE_SUFFIX)) {
    return { stripped: path.slice(0, -TEMPLATE_SUFFIX.length), wasTemplate: true };
  }
  return { stripped: path, wasTemplate: false };
}

export interface PipelineResult {
  /** The original, unmodified source-relative path (used for classification + naming). */
  sourceRelPath: string;
  /** The final destination-relative path, post rename/token/strip — NOT prefixed by `to`. */
  destRelPath: string;
  /** Whether the (post-translation) path carried the `.template` render-request marker. */
  isTemplateMarked: boolean;
}

/**
 * Applies the PINNED REQ-FSC-05 order to one source-relative path: (1) `rename` — matched
 * against the ORIGINAL path (so authors never predict token-translated names); (2) filename
 * token translation on the (possibly renamed) path; (3) `.template` suffix strip, last
 * (the marker must survive translation to be recognized).
 */
export function runFilenamePipeline(
  relPath: string,
  rename: Record<string, string> | undefined
): PipelineResult {
  const renamed = rename?.[relPath] ?? relPath;
  const translated = translateTokens(renamed);
  const { stripped, wasTemplate } = stripTemplateSuffix(translated);
  return { sourceRelPath: relPath, destRelPath: stripped, isTemplateMarked: wasTemplate };
}

function escapeRegexChar(ch: string): string {
  return /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

/**
 * Compiles ONE glob pattern (REQ-FSC-03's hand-rolled MVP dialect) into a regex matched
 * against a source-relative path: `*` = any run of characters WITHIN a segment (never
 * crosses `/`); `**` = any run of segments (zero or more), consuming its trailing `/` when
 * one follows — so a leading `**` combined with a following segment pattern also matches a
 * ROOT-level file (zero segments consumed), not only nested ones.
 */
// Compiled-pattern memo: `isIncluded` runs per walked entry with the SAME include/exclude
// pattern strings — no flags on the compiled regex, so a cached instance is stateless.
const globRegexCache = new Map<string, RegExp>();

function globToRegex(pattern: string): RegExp {
  const cached = globRegexCache.get(pattern);
  if (cached !== undefined) {
    return cached;
  }
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith("**", i)) {
      if (pattern[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 3;
      } else {
        out += ".*";
        i += 2;
      }
    } else if (pattern[i] === "*") {
      out += "[^/]*";
      i += 1;
    } else {
      out += escapeRegexChar(pattern[i]!);
      i += 1;
    }
  }
  const compiled = new RegExp(`^${out}$`);
  globRegexCache.set(pattern, compiled);
  return compiled;
}

/**
 * REQ-FSC-03: include/exclude filtering — `exclude` WINS on overlap with `include`.
 * Default `include` matches everything (`["**"]`); default `exclude` matches nothing.
 */
export function isIncluded(
  relPath: string,
  include: readonly string[] | undefined,
  exclude: readonly string[] | undefined
): boolean {
  const includePatterns = include ?? ["**"];
  const excludePatterns = exclude ?? [];
  if (excludePatterns.some((p) => globToRegex(p).test(relPath))) return false;
  return includePatterns.some((p) => globToRegex(p).test(relPath));
}

function collisionMessage(collisions: ReadonlyArray<readonly [string, string[]]>): string {
  const parts = collisions.map(([dest, srcs]) => `"${dest}" ← ${srcs.join(", ")}`);
  return `invalid input: scaffold destination collision — ${parts.join("; ")}`;
}

/**
 * REQ-FSC-08: when two or more sources in the same `scaffold` call map to the SAME
 * destination (after the filename pipeline collapses their names), reject fail-loud,
 * deterministically, naming ALL offending source paths — never last-writer-wins, never
 * dependent on walk order.
 */
export function detectDestinationCollisions(results: readonly PipelineResult[]): void {
  const byDest = new Map<string, string[]>();
  for (const r of results) {
    const existing = byDest.get(r.destRelPath);
    if (existing) {
      existing.push(r.sourceRelPath);
    } else {
      byDest.set(r.destRelPath, [r.sourceRelPath]);
    }
  }

  const collisions = [...byDest.entries()]
    .filter(([, srcs]) => srcs.length > 1)
    .map((entry): [string, string[]] => [entry[0], entry[1].slice().sort()])
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (collisions.length > 0) {
    throw invalidInput(collisionMessage(collisions));
  }
}
