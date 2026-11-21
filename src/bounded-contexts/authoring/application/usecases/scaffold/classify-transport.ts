// Scaffold's by-value/by-reference classifier (ADR-0044, #163): the author's `binary`
// declaration decides; every undeclared source renders, and one that cannot (not text, or too
// large for one emit frame) rejects rather than being copied. `create({templateFile})` render
// requests share the same gates through `failMessages` (REQ-FEH-02).
//
// ADR-0077: delegates to `path-guards.ts`'s `statSourceForRead` — IO hygiene (regular-file
// allow-list), no containment ceiling. Runs BEFORE any of this module's own stat/sniff/
// budget checks; the size it already obtained is reused here for the CCL-06 size gate
// rather than stat'ing the path a second time. Both reads go through the package-files
// port. A `readBytes` failure AFTER hygiene has
// already proven a regular file (e.g. a permission/I/O error between stat and read)
// classifies `source-unreadable` (REQ-AEC-10) — distinct from a CONTENT-level classify
// failure (binary/oversized), which is `invalid-input`.

import { invalidInput } from "../../../domain/valueobjects/authoring-error.ts";
import type { Directive, JsonValue } from "../../../domain/valueobjects/wire.ts";
import { serializedBatchSize } from "../../../domain/valueobjects/wire.ts";
import { EMIT_BATCH_BUDGET_BYTES } from "../../../../../shared-kernel/batch-cap.ts";
import { encodeOptions, forceEntry } from "../../../domain/services/directive-factory.ts";
import type { PackageFiles } from "../../../domain/ports/package-files.ts";
import { sourceRejection, statSourceForRead } from "./path-guards.ts";

export type ClassificationVerdict = "by-value" | "by-reference";

export type ClassifyResult =
  | { verdict: "by-value"; /** The file's decoded UTF-8 content. */ content: string }
  | { verdict: "by-reference" };

// REQ-CCL-01's whole-file sniff, scoped to what a render REQUEST needs (S-000): valid UTF-8
// across the ENTIRE buffer (never a prefix sample — REQ-CCL-03) and no null byte anywhere.
// Lives here (the classify leaf) so the module graph stays acyclic — `index.ts` re-exports
// the boolean form for the historical `scaffold/index.ts` surface. A render request has no
// by-reference fallback (REQ-FEH-02), it fails loud. `ignoreBOM: true` is REQUIRED (judgment-
// day iteration 2 fix, REQ-FEH-01.1): `TextDecoder` defaults to stripping a leading UTF-8 BOM
// (`ignoreBOM: false`), which would silently drop bytes from a file's exact content — this
// decoded string becomes the `create` directive's `template` (both the by-value scaffold path
// and `readTemplateFile`), so a BOM-prefixed source must decode BOM-preserving to honor "exact
// content" (REQ-FEH-01.1). `ignoreBOM: true` still fatal-validates the whole buffer in one pass
// — no second decode at the caller.
export function decodeSniffableText(buf: Uint8Array): string | null {
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    return null;
  }
}

export function isSniffableText(buf: Uint8Array): boolean {
  return decodeSniffableText(buf) !== null;
}

function templateSniffFailMessage(relPath: string, problem: string): string {
  return (
    `invalid input: source "${relPath}" is marked .template but ${problem} — ` +
    "render requests never silently fall back to a copy"
  );
}

function notTextMessage(relPath: string, binaryPattern: string): string {
  return (
    `invalid input: source "${relPath}" is not valid text, so it cannot be rendered — ` +
    `declare it in scaffold's binary option (binary: [${JSON.stringify(binaryPattern)}]) to copy it byte for byte`
  );
}

function tooLargeMessage(relPath: string, size: number): string {
  return (
    `invalid input: source "${relPath}" (${size} bytes) does not fit in one emit frame once rendered ` +
    `(the limit is ${EMIT_BATCH_BUDGET_BYTES} bytes) — make it smaller, or declare it in scaffold's binary option ` +
    "to copy it byte for byte"
  );
}

function binaryTemplateMessage(relPath: string): string {
  return (
    `invalid input: source "${relPath}" is marked .template, which asks for rendering, and declared binary, ` +
    "which asks for a byte-for-byte copy — remove one of the two"
  );
}

interface ClassifyParams {
  files: PackageFiles;
  packageDir: string;
  relPath: string;
  isTemplateMarked: boolean;
  /** The author listed this source in scaffold's `binary` option: it is copied, never read. */
  declaredBinary?: boolean;
  /** The pattern a not-text rejection suggests for `binary`: the path inside the walked folder. */
  binaryPattern?: string;
  /**
   * The `pathTemplate`/`options`/`force` the caller puts on the `create` directive, so the
   * frame check measures the directive the emit authority will measure, options included.
   */
  destPath: string;
  options: JsonValue;
  force?: boolean;
  /** Render-request mode (`create({templateFile})`, REQ-FEH-02): the caller's own message texts. */
  failMessages?: { binary: string; oversized: string };
}

/**
 * Classifies ONE package-local source. A source declared binary goes by reference, after the
 * IO hygiene check and without any content read. Every other source renders: it must be
 * whole-file valid UTF-8 with no null byte, and its `create` directive must fit one emit frame.
 * A source that fails either rejects naming it, never degrading to a copy (#163): size and
 * options never decide render vs copy.
 */
export function classifyTransport(params: ClassifyParams & { failMessages: { binary: string; oversized: string } }): { verdict: "by-value"; content: string };
export function classifyTransport(params: ClassifyParams): ClassifyResult;
export function classifyTransport(params: ClassifyParams): ClassifyResult {
  const { files, packageDir, relPath, isTemplateMarked, declaredBinary, destPath, options, force, failMessages } = params;

  if (declaredBinary === true) {
    if (isTemplateMarked) throw invalidInput(binaryTemplateMessage(relPath));
    statSourceForRead({ files, packageDir, relPath });
    return { verdict: "by-reference" };
  }

  // IO hygiene completes BEFORE any content read and throws one of the `source-*` reasons.
  const { size } = statSourceForRead({ files, packageDir, relPath });
  const tooLarge = (): never => {
    throw invalidInput(
      failMessages?.oversized ??
        (isTemplateMarked
          ? templateSniffFailMessage(relPath, "is too large to render inline (over the 4 MiB limit)")
          : tooLargeMessage(relPath, size))
    );
  };

  // Size gate before any content read: an over-budget file is never read.
  if (size > EMIT_BATCH_BUDGET_BYTES) tooLarge();

  let buf: Uint8Array;
  try {
    buf = files.readBytes(packageDir, relPath);
  } catch {
    // Hygiene already proved a readable regular file, so a failure this late is a genuine
    // read-path failure (permission or I/O), reported with its category (REQ-AEC-11.1).
    throw sourceRejection("source-unreadable", relPath, "permission or I/O error");
  }
  const content = decodeSniffableText(buf);
  if (content === null) {
    throw invalidInput(
      failMessages?.binary ??
        (isTemplateMarked
          ? templateSniffFailMessage(relPath, "is not valid text (binary content)")
          : notTextMessage(relPath, params.binaryPattern ?? relPath))
    );
  }

  // Measured against the PROSPECTIVE `create` directive, envelope and options included, with
  // the same `serializedBatchSize` the emit authority applies; `>` so exactly-at-budget fits.
  // `options` goes through the same `encodeOptions` real emission applies.
  const prospectiveDirective: Directive = {
    op: "create",
    create: { pathTemplate: destPath, template: content, options: encodeOptions(options, destPath), ...forceEntry(force) },
  };
  if (serializedBatchSize([prospectiveDirective]) > EMIT_BATCH_BUDGET_BYTES) tooLarge();

  return { verdict: "by-value", content };
}
