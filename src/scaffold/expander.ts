// src/scaffold/expander.ts (ADR-0044): the SINGLE owner of the scaffold fan-out — drives
// `walk.ts` → `filename-pipeline.ts` → `classify-transport.ts` → emits `factory.create(...)`
// directives via the run's session (Executor Context §18). `classify-transport.ts` stays a
// PURE per-file decision; a by-reference VERDICT is handled HERE, not there — in S-001
// (no `copyIn` wire op yet) a by-reference verdict fails loud. S-003.3 swaps this exact
// throw site for real `factory.copyIn(...)` emission; S-004 adds the serialized-size
// accumulator + mid-walk `session.flush()` chunking on top of this same fan-out.

import { posix, join } from "node:path";
import { currentContext } from "../core/context.ts";
import { AuthoringError } from "../core/authoring-error.ts";
import { forceEntry } from "../core/directive-factory.ts";
import type { JsonValue } from "../core/wire.ts";
import { walkFolder } from "./walk.ts";
import { runFilenamePipeline, isIncluded, detectDestinationCollisions, translateTokens } from "./filename-pipeline.ts";
import { classifyTransport } from "./classify-transport.ts";

/**
 * Argument shape for the `scaffold` author verb (REQ-FSC-01). `from`/`to` are mandatory;
 * every other field defaults per REQ-FSC-01: `options` → `{}`, `include` → match
 * everything, `exclude` → match nothing, `rename` → no remap, `force` → `false`.
 */
export interface ScaffoldArgs {
  from: string;
  to: string;
  options?: JsonValue;
  include?: string[];
  exclude?: string[];
  rename?: Record<string, string>;
  force?: boolean;
}

function noResolutionAnchorMessage(): string {
  return (
    "invalid input: scaffold requires defineFactory({ packageDir }) — " +
    "there is no resolution anchor to read package-local files against"
  );
}

function missingArgMessage(field: "from" | "to"): string {
  return `invalid input: scaffold requires "${field}"`;
}

function filtersEliminatedEverythingMessage(include: string[] | undefined, exclude: string[] | undefined): string {
  return (
    `invalid input: scaffold filters eliminated every entry — ` +
    `include: ${JSON.stringify(include ?? [])}, exclude: ${JSON.stringify(exclude ?? [])}`
  );
}

function byReferenceNotYetSupportedMessage(relPath: string): string {
  return (
    `invalid input: source "${relPath}" classified by-reference — by-reference copy is not ` +
    "yet available in this build (temporary restriction, landed in a later slice)"
  );
}

function invalidInput(message: string): AuthoringError {
  return new AuthoringError({ verb: undefined, path: undefined, reason: "invalid-input", appliedCount: 0, message });
}

/**
 * Walks a package-local folder and mirrors it into the target tree (REQ-FSC-01..09):
 * every source-relative path enumerates (REQ-FSC-09), passes include/exclude filtering
 * (REQ-FSC-03), runs the rename→token→`.template`-strip pipeline (REQ-FSC-05), and is
 * checked for intra-scaffold destination collisions (REQ-FSC-08) BEFORE any file is
 * classified. Each surviving source classifies by-value or by-reference
 * (`content-classification`); by-value sources emit a `create` directive through the
 * existing IR. A truly-empty `from` folder no-ops (REQ-FSC-04.1); filters eliminating
 * every entry fail loud, naming them (REQ-FSC-04.2). `force` passes through unchanged to
 * every emitted directive (REQ-FSC-06).
 */
export function runScaffold(args: ScaffoldArgs): void {
  if (args.from === undefined) {
    throw invalidInput(missingArgMessage("from"));
  }
  if (args.to === undefined) {
    throw invalidInput(missingArgMessage("to"));
  }

  const { packageDir, session, factory } = currentContext();
  if (packageDir === undefined) {
    throw invalidInput(noResolutionAnchorMessage());
  }

  const fromAbs = join(packageDir, args.from);
  const walked = walkFolder(fromAbs);
  if (walked.length === 0) {
    return; // REQ-FSC-04.1: a truly-empty source folder is a silent no-op.
  }

  const filtered = walked.filter((entry) => isIncluded(entry.relPath, args.include, args.exclude));
  if (filtered.length === 0) {
    throw invalidInput(filtersEliminatedEverythingMessage(args.include, args.exclude));
  }

  const pipelineResults = filtered.map((entry) => runFilenamePipeline(entry.relPath, args.rename));
  detectDestinationCollisions(pipelineResults);

  const toPrefix = translateTokens(args.to);

  for (const result of pipelineResults) {
    const sourceRelPath = posix.join(args.from, result.sourceRelPath);
    const verdict = classifyTransport({
      packageDir,
      relPath: sourceRelPath,
      isTemplateMarked: result.isTemplateMarked,
    });

    if (verdict.verdict === "by-reference") {
      throw invalidInput(byReferenceNotYetSupportedMessage(sourceRelPath));
    }

    const destPath = posix.join(toPrefix, result.destRelPath);
    session.buffer(
      factory.create({
        pathTemplate: destPath,
        template: verdict.content!,
        options: args.options ?? {},
        ...forceEntry(args.force),
      })
    );
  }
}
