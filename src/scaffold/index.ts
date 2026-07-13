// src/scaffold/ (ADR-0044): the isolated leaf that reads package-local disk content and
// hands rendered strings back to `commons`. `commons` never touches `node:fs` itself — this
// module is the ONE place that does (FIT-01: `commons -> ../scaffold -> node:fs` is
// compliant by the fitness rule's own terms — it bans bare external PACKAGES, not `node:`
// builtins).

import { readFileSync } from "node:fs";
import { currentContext, requirePackageAnchors } from "../core/context.ts";
import { AuthoringError, invalidInput } from "../core/authoring-error.ts";
import { BATCH_CAP_BYTES } from "../core/wire.ts";
import { forceEntry } from "../core/directive-factory.ts";
import { validateSourceContainment, validateDestinationLexical } from "./containment.ts";
import { isSniffableText } from "./classify-transport.ts";

// S-001: the folder-scaffold orchestrator lives in expander.ts (the single owner of the
// walk → filename-pipeline → classify → emit fan-out, ADR-0044); re-exported here so
// `commons` reaches every scaffold-family orchestrator through this one leaf entrypoint.
export { runScaffold } from "./expander.ts";
export type { ScaffoldArgs } from "./expander.ts";

function noResolutionAnchorMessage(relPath: string): string {
  return (
    `invalid input: templateFile "${relPath}" requires defineFactory({ packageDir }) — ` +
    "there is no resolution anchor to read a package-local file against"
  );
}

function templateFileBinaryMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" is not valid text (binary content) — render requests never silently fall back to a copy`;
}

function templateFileOversizedMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" exceeds the serialized frame budget`;
}

// REQ-CCL-01's whole-file sniff — moved into `classify-transport.ts` (the classify leaf)
// to break the `index → expander → classify-transport → index` import cycle; re-exported
// so this module's surface is unchanged.
export { isSniffableText } from "./classify-transport.ts";

/**
 * Reads a package-local file (relative to the active run's `packageDir`) and returns its
 * content as the string to use for a `create({ templateFile })` render request.
 *
 * Containment (S-005, verify-in-loop-4 Deviation #1 ruling): the path is validated through
 * the SAME `validateSourceContainment` machinery `scaffold`/`copyIn` already use
 * (`package-root-containment` REQ-PRC-01..08) BEFORE any content read — a missing/
 * outside-package/non-regular/unreadable source surfaces the matching neutral `source-*`
 * `AuthoringReason` (REQ-AEC-10/11), never a parallel templateFile-only check. Stat-size
 * gate BEFORE any content read (REQ-CCL-06 posture), reusing containment's own `lstat`
 * (no second stat call): an oversized file is rejected on its stat size alone. A
 * `templateFile` REQUESTS a render — unlike `scaffold`'s by-value/by-reference
 * classification of unmarked files, there is no silent by-reference fallback here
 * (REQ-FEH-02): invalid UTF-8, a null byte, or an over-budget file all fail loud with
 * reason `invalid-input` (these are RENDER-REQUEST failures, distinct from the source-*
 * containment/existence failures above).
 */
export function readTemplateFile(relPath: string): string {
  const { packageDir, packageRoot } = requirePackageAnchors(noResolutionAnchorMessage(relPath));
  const { absPath, stat } = validateSourceContainment({ packageDir, packageRoot, relPath });

  // Stat-size gate before any content read — a multi-GB asset never gets slurped into
  // memory just to be told it's over budget (REQ-CCL-06 posture, applied here as the
  // render-request fail-loud carve-out rather than CCL-06's by-reference verdict).
  if (stat.size > BATCH_CAP_BYTES) {
    throw invalidInput(templateFileOversizedMessage(relPath));
  }

  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch {
    // Containment already proved an in-ceiling regular file; a read failure THIS LATE is a
    // genuine read-path failure (permission/I/O TOCTOU), never a missing/outside-package
    // source — same posture as `classify-transport.ts`'s own post-containment read guard.
    throw new AuthoringError({ verb: undefined, path: relPath, reason: "source-unreadable", appliedCount: 0 });
  }
  if (!isSniffableText(buf)) {
    throw invalidInput(templateFileBinaryMessage(relPath));
  }

  const content = buf.toString("utf-8");

  // Serialized-form budget (REQ-CCL-02): JSON-escaping overhead can push a raw-under-budget
  // file over the cap (heavy quote/backslash/newline escaping) — measured the same way the
  // fake measures a batch (`Buffer.byteLength(JSON.stringify(x), "utf8")`), never raw bytes
  // alone. `>` (not `>=`) — exactly-at-budget still fits.
  const serializedSize = Buffer.byteLength(JSON.stringify(content), "utf8");
  if (serializedSize > BATCH_CAP_BYTES) {
    throw invalidInput(templateFileOversizedMessage(relPath));
  }

  return content;
}

function missingCopyInArgMessage(field: "from" | "to"): string {
  return `invalid input: copyIn requires "${field}"`;
}

function noResolutionAnchorForCopyInMessage(): string {
  return (
    "invalid input: copyIn requires defineFactory({ packageDir }) — " +
    "there is no resolution anchor to read a package-local file against"
  );
}

/**
 * Emits a by-reference copy of ONE package-local file (`from`, resolved against the active
 * run's `packageDir`) to `to` (REQ-FEH-03/04) — ALWAYS by-reference, never classified or
 * rendered: a text asset containing `{= =}`-like sequences travels verbatim, the documented
 * escape from `scaffold`'s by-value classification (`content-classification` REQ-CCL-04).
 * `from`/`to` are mandatory; a missing one rejects fail-loud before any emission
 * (REQ-FEH-04.1/.2). Source containment (existence, in-ceiling, regular-file) is validated
 * SDK-side against real disk BEFORE any directive is emitted — a missing/outside-package/
 * non-regular source surfaces the matching `source-*` reason
 * (`package-root-containment` REQ-PRC-04, `by-reference-copy-wire` REQ-BRC-06); content is
 * never read (`copyIn` never classifies, REQ-FEH-03).
 */
export function runCopyIn(args: { from: string | undefined; to: string | undefined; force?: boolean }): void {
  if (args.from === undefined) {
    throw invalidInput(missingCopyInArgMessage("from"));
  }
  if (args.to === undefined) {
    throw invalidInput(missingCopyInArgMessage("to"));
  }

  const { session, factory } = currentContext();
  const { packageDir, packageRoot } = requirePackageAnchors(noResolutionAnchorForCopyInMessage());

  validateSourceContainment({ packageDir, packageRoot, relPath: args.from });
  validateDestinationLexical(args.to);

  session.buffer(factory.copyIn({ from: args.from, to: args.to, ...forceEntry(args.force) }));
}
