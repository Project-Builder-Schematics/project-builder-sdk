// ADR-0049: canonical serialization binds the reader too. This module owns the
// TranscriptRecord data model (design.md §4.3) and the ONE pure `canonicalize()` shared
// by the regen writer (scripts/regen-corpus.ts) and every verifier (fit-24/28, the e2e
// byte-compare) — no second implementation can drift from this one. No fs anywhere here
// (FIT-27's write-boundary partition depends on this module staying pure).
import { createHash } from "node:crypto";
import type { JsonValue } from "../../src/core/wire.ts";

export const FORMAT_VERSION = 0;

// design.md R-G: a `create.template` over this many bytes serializes as a self-labeling
// digest object instead of the literal string — keeps the corpus content-free for large
// fixture content (M-09) while staying deterministic (sha256 of the same bytes, FIT-28)
// and drift-detectable (a content change flips the digest).
export const CONTENT_EMBED_BUDGET = 4096;

export interface ContentDigest {
  contentDigest: { algo: "sha-256"; bytes: number; sha256: string };
}

export interface NormativeDirectiveCreate {
  op: "create";
  pathTemplate: string;
  template: string | ContentDigest;
  options: JsonValue;
  force: boolean;
}

export interface NormativeDirectiveCopyIn {
  op: "copyIn";
  from: string;
  to: string;
  force: boolean;
}

// design.md §4.3: only `create`/`copyIn` are pinned — the only two wire ops this family's
// factories ever lower to (scaffold/copyIn/create(templateFile) all bottom out here).
export type NormativeDirective = NormativeDirectiveCreate | NormativeDirectiveCopyIn;

export interface RejectionTriple {
  reason: string;
  verb: string | null;
  path: string | null;
}

export interface NormativeRegion {
  outcome: "committed" | "rejected";
  directives: NormativeDirective[];
  // Omitted entirely (never emitted as null) when outcome is "committed" — self-labeling
  // (GCC-11) means an absent key, not a padded null, signals "not applicable here".
  rejection?: RejectionTriple;
}

export interface BatchGroupingEntry {
  directiveCount: number;
  protocolVersion: number;
}

export interface InformativeRegion {
  batchGrouping: BatchGroupingEntry[];
}

/**
 * What `captureRun` (ir-transcript.ts) produces — everything about a run except its
 * corpus IDENTITY (scenarioId/slug/formatVersion), which only the caller regenerating a
 * specific corpus file knows. `buildRecord` merges the two.
 */
export interface CapturedRecord {
  normative: NormativeRegion;
  informative: InformativeRegion;
}

export interface TranscriptRecord extends CapturedRecord {
  formatVersion: number;
  scenarioId: string; // "s-00" | "m-01".."m-21"
  slug: string; // kebab-case
}

/**
 * Embeds `content` per R-G: verbatim under `CONTENT_EMBED_BUDGET`, a self-labeling
 * sha-256 digest object over it — never a multi-KB blob inline in the committed corpus.
 * Pure function of `content` alone (FIT-28 determinism holds).
 */
export function embedTemplate(content: string): string | ContentDigest {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes <= CONTENT_EMBED_BUDGET) return content;
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  return { contentDigest: { algo: "sha-256", bytes, sha256 } };
}

// JS engines silently reorder integer-like string keys ("0", "1", ...) to the front in
// numeric order regardless of insertion order — the silent FIT-28 breaker design.md warns
// about. Recursive lexicographic re-sort makes `options` serialization stable regardless
// of what shape the author's options object happens to take.
function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, JsonValue>)[key] as JsonValue);
    }
    return sorted;
  }
  return value;
}

function canonicalTemplate(template: string | ContentDigest): JsonValue {
  if (typeof template === "string") return template;
  const { algo, bytes, sha256 } = template.contentDigest;
  return { contentDigest: { algo, bytes, sha256 } };
}

// Per-op pinned key order (design.md §4.3) — rebuilt explicitly every time, never trusting
// whatever order a round-tripped (parsed) record happens to carry.
function canonicalDirective(d: NormativeDirective): JsonValue {
  if (d.op === "create") {
    return {
      op: "create",
      pathTemplate: d.pathTemplate,
      template: canonicalTemplate(d.template),
      options: sortKeysDeep(d.options),
      force: d.force,
    };
  }
  return { op: "copyIn", from: d.from, to: d.to, force: d.force };
}

/**
 * The ONE pure canonicalization step (ADR-0049) — pinned key order at every level,
 * `options` recursively key-sorted, `force` always boolean, `rejection` present only when
 * the outcome is "rejected". Shared verbatim by the regen writer and every verifier, so
 * writer/verifier drift is structurally impossible.
 */
export function canonicalize(record: TranscriptRecord): JsonValue {
  const normative: Record<string, JsonValue> = {
    outcome: record.normative.outcome,
    directives: record.normative.directives.map(canonicalDirective),
  };
  if (record.normative.rejection !== undefined) {
    normative.rejection = {
      reason: record.normative.rejection.reason,
      verb: record.normative.rejection.verb,
      path: record.normative.rejection.path,
    };
  }

  return {
    formatVersion: record.formatVersion,
    scenarioId: record.scenarioId,
    slug: record.slug,
    normative,
    informative: {
      batchGrouping: record.informative.batchGrouping.map((g) => ({
        directiveCount: g.directiveCount,
        protocolVersion: g.protocolVersion,
      })),
    },
  };
}

/**
 * Assembles a full `TranscriptRecord` from a `captureRun` result plus the corpus identity
 * only the caller (regen script / e2e test) knows.
 */
export function buildRecord(
  capture: { record: CapturedRecord },
  identity: { scenarioId: string; slug: string }
): TranscriptRecord {
  return {
    formatVersion: FORMAT_VERSION,
    scenarioId: identity.scenarioId,
    slug: identity.slug,
    normative: capture.record.normative,
    informative: capture.record.informative,
  };
}

/**
 * Canonical serialization (ADR-0049): UTF-8, no BOM, LF, 2-space pretty JSON, exactly one
 * trailing newline. `JSON.stringify` never emits CRLF or a BOM, so this alone satisfies
 * the byte-format contract once `canonicalize` has pinned the key order.
 */
export function serializeCorpus(record: TranscriptRecord): string {
  return `${JSON.stringify(canonicalize(record), null, 2)}\n`;
}

/** Pure parse — no fs, no validation beyond `JSON.parse` itself. */
export function parseCorpus(text: string): TranscriptRecord {
  return JSON.parse(text) as TranscriptRecord;
}

/**
 * GCC-10: the pinned corpus filename stem — one literal format, shared by the regen
 * writer, the e2e byte-compare, and FIT-26's GCC-01 count check, so the three sites can
 * never drift onto different naming shapes. Pure string formatting, no fs (this module
 * stays fs-free).
 */
export function corpusFileNameFor(id: string, slug: string): string {
  return `${id}.${slug}.transcript.json`;
}
