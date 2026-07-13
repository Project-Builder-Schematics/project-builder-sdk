// src/scaffold/ (ADR-0044): the isolated leaf that reads package-local disk content and
// hands rendered strings back to `commons`. `commons` never touches `node:fs` itself — this
// module is the ONE place that does (FIT-01: `commons -> ../scaffold -> node:fs` is
// compliant by the fitness rule's own terms — it bans bare external PACKAGES, not `node:`
// builtins).

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { currentContext } from "../core/context.ts";
import { AuthoringError } from "../core/authoring-error.ts";
import { BATCH_CAP_BYTES } from "../core/wire.ts";
import { isErrnoException } from "../core/fs-errors.ts";
import { forceEntry } from "../core/directive-factory.ts";
import { validateSourceContainment, validateDestinationLexical } from "./containment.ts";

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

function templateFileNotFoundMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" does not exist in the package`;
}

function templateFileUnreadableMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" could not be read`;
}

function templateFileBinaryMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" is not valid text (binary content) — render requests never silently fall back to a copy`;
}

function templateFileOversizedMessage(relPath: string): string {
  return `invalid input: templateFile "${relPath}" exceeds the serialized frame budget`;
}

// REQ-CCL-01's whole-file sniff, scoped to what a render REQUEST needs (S-000): valid UTF-8
// across the ENTIRE buffer (never a prefix sample — REQ-CCL-03) and no null byte anywhere.
// Reused fully by S-001's `classify-transport.ts`, which layers the by-value/by-reference
// VERDICT on top — a render request has no by-reference fallback (REQ-FEH-02), it fails loud.
export function isSniffableText(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a package-local file (relative to the active run's `packageDir`) and returns its
 * content as the string to use for a `create({ templateFile })` render request.
 *
 * Stat-size gate BEFORE any content read (REQ-CCL-06 posture): an oversized file is
 * rejected on its stat size alone. A `templateFile` REQUESTS a render — unlike `scaffold`'s
 * by-value/by-reference classification of unmarked files, there is no silent by-reference
 * fallback here (REQ-FEH-02): invalid UTF-8, a null byte, or an over-budget file all fail
 * loud with reason `invalid-input`.
 */
export function readTemplateFile(relPath: string): string {
  const { packageDir } = currentContext();
  if (packageDir === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: noResolutionAnchorMessage(relPath),
    });
  }

  const abs = join(packageDir, relPath);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(abs);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: templateFileNotFoundMessage(relPath),
      });
    }
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: templateFileUnreadableMessage(relPath),
    });
  }

  // Stat-size gate before any content read — a multi-GB asset never gets slurped into
  // memory just to be told it's over budget (REQ-CCL-06 posture, applied here as the
  // render-request fail-loud carve-out rather than CCL-06's by-reference verdict).
  if (stat.size > BATCH_CAP_BYTES) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: templateFileOversizedMessage(relPath),
    });
  }

  const buf = readFileSync(abs);
  if (!isSniffableText(buf)) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: templateFileBinaryMessage(relPath),
    });
  }

  const content = buf.toString("utf-8");

  // Serialized-form budget (REQ-CCL-02): JSON-escaping overhead can push a raw-under-budget
  // file over the cap (heavy quote/backslash/newline escaping) — measured the same way the
  // fake measures a batch (`Buffer.byteLength(JSON.stringify(x), "utf8")`), never raw bytes
  // alone. `>` (not `>=`) — exactly-at-budget still fits.
  const serializedSize = Buffer.byteLength(JSON.stringify(content), "utf8");
  if (serializedSize > BATCH_CAP_BYTES) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: templateFileOversizedMessage(relPath),
    });
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
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: missingCopyInArgMessage("from"),
    });
  }
  if (args.to === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: missingCopyInArgMessage("to"),
    });
  }

  const ctx = currentContext();
  const { packageDir, session, factory } = ctx;
  if (packageDir === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: noResolutionAnchorForCopyInMessage(),
    });
  }
  // packageRoot is ALWAYS resolved together with packageDir (context.ts's pre-`als.run`
  // chokepoint sets both or throws before either is set, ADR-0046) — no reachable
  // RunContext has packageDir set with packageRoot left undefined.
  const packageRoot = ctx.packageRoot!;

  validateSourceContainment({ packageDir, packageRoot, relPath: args.from });
  validateDestinationLexical(args.to);

  session.buffer(factory.copyIn({ from: args.from, to: args.to, ...forceEntry(args.force) }));
}
