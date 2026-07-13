// src/scaffold/ (ADR-0044): the isolated leaf that reads package-local disk content and
// hands rendered strings back to `commons`. `commons` never touches `node:fs` itself — this
// leaf folder is the ONE place that does (FIT-01: `commons -> ../scaffold -> node:fs` is
// compliant by the fitness rule's own terms — it bans bare external PACKAGES, not `node:`
// builtins).

import { currentContext, requirePackageAnchors } from "../core/context.ts";
import { invalidInput } from "../core/authoring-error.ts";
import { forceEntry } from "../core/directive-factory.ts";
import type { JsonValue } from "../core/wire.ts";
import { validateSourceContainment, validateDestinationLexical } from "./containment.ts";
import { classifyTransport } from "./classify-transport.ts";

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
  return `invalid input: templateFile "${relPath}" is too large to render inline (over the 4 MiB limit)`;
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
 * `AuthoringReason` (REQ-AEC-10/11), never a parallel templateFile-only check. The whole
 * containment → stat-size (REQ-CCL-06 posture) → read → sniff (REQ-CCL-01/03) → budget
 * (REQ-CCL-02) chain is `classifyTransport`'s — ONE gate engine for both callers. A
 * `templateFile` REQUESTS a render — unlike `scaffold`'s by-value/by-reference
 * classification of unmarked files, there is no silent by-reference fallback here
 * (REQ-FEH-02): invalid UTF-8, a null byte, or an over-budget file all fail loud with
 * reason `invalid-input` via the pinned templateFile message pair (these are
 * RENDER-REQUEST failures, distinct from the source-* containment/existence failures).
 *
 * `destPath`/`options`/`force` are the SAME `pathTemplate`/`options`/`force` the caller
 * (`commons/index.ts`'s `create({templateFile})` handler) will put on the `create`
 * directive it builds from this call's return value — threaded through so the CCL-02
 * budget gate below measures the PROSPECTIVE DIRECTIVE, matching the emit authority,
 * never the template content alone.
 */
export function readTemplateFile(relPath: string, destPath: string, options: JsonValue, force?: boolean): string {
  const { packageDir, packageRoot } = requirePackageAnchors(noResolutionAnchorMessage(relPath));
  return classifyTransport({
    packageDir,
    packageRoot,
    relPath,
    isTemplateMarked: false,
    destPath,
    options,
    force,
    failMessages: {
      binary: templateFileBinaryMessage(relPath),
      oversized: templateFileOversizedMessage(relPath),
    },
  }).content;
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
