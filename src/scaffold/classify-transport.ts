// src/scaffold/classify-transport.ts (ADR-0044): the by-value/by-reference classifier —
// stat-gate → whole-file sniff → serialized-budget → verdict (content-classification
// REQ-CCL-01/02/03/06), plus the `.template`/`templateFile` render-request fail-loud
// carve-out (REQ-CCL-05). PURE per-file decision (Executor Context §18) — it never throws
// for an ORDINARY by-reference verdict; the caller (`expander.ts`) decides what a
// by-reference verdict means for THIS slice (S-001: fail-loud placeholder; S-003: real
// `copyIn` emission).
//
// Containment: MINIMAL lexical guard only (S-001 placeholder — slices.md S-001.3). S-002's
// `containment.ts` REPLACES this with the full realpath/segment-aware/case-fold ceiling
// check; this guard is NOT a security control on its own — it only rejects an obviously
// escaping source-relative path before any read, keeping SOME guard in front of the read
// while containment.ts does not exist yet.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AuthoringError } from "../core/authoring-error.ts";
import { BATCH_CAP_BYTES } from "../core/wire.ts";
import { isErrnoException } from "../core/fs-errors.ts";
import { isSniffableText } from "./index.ts";

export type ClassificationVerdict = "by-value" | "by-reference";

export interface ClassifyResult {
  verdict: ClassificationVerdict;
  /** Present ONLY for `verdict: "by-value"` — the file's decoded UTF-8 content. */
  content?: string;
}

function placeholderGuardMessage(relPath: string): string {
  return `invalid input: source "${relPath}" escapes the package (containment placeholder — hardened by a later slice)`;
}

// MINIMAL lexical guard (S-001 placeholder, hardened by S-002's containment.ts): rejects an
// obviously escaping source-relative path — a literal ".." segment or an absolute path —
// before any read. A symlink pointing outside the package sails through this guard
// untouched; only containment.ts's realpath ceiling check closes that gap.
function placeholderContainmentGuard(relPath: string): void {
  const isAbsolute = relPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relPath);
  const segments = relPath.split(/[\\/]+/);
  if (isAbsolute || segments.includes("..")) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: placeholderGuardMessage(relPath),
    });
  }
}

function templateSniffFailMessage(relPath: string, problem: string): string {
  return (
    `invalid input: source "${relPath}" is marked .template but ${problem} — ` +
    "render requests never silently fall back to a copy"
  );
}

function readFailureMessage(relPath: string, problem: string): string {
  return `invalid input: source "${relPath}" ${problem}`;
}

/**
 * Classifies ONE package-local source: stat-size gate before any content read
 * (REQ-CCL-06) → whole-file UTF-8/null-byte sniff (REQ-CCL-01/03) → serialized-budget
 * check (REQ-CCL-02) → verdict. A `.template`-marked source (`isTemplateMarked`, from the
 * filename pipeline's post-translation check) NEVER degrades to by-reference on a failed
 * gate — it fails loud instead (REQ-CCL-05), same posture `readTemplateFile` already
 * applies to `create({templateFile})` render requests (REQ-FEH-02).
 */
export function classifyTransport(params: {
  packageDir: string;
  relPath: string;
  isTemplateMarked: boolean;
}): ClassifyResult {
  const { packageDir, relPath, isTemplateMarked } = params;
  placeholderContainmentGuard(relPath);
  const abs = join(packageDir, relPath);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(abs);
  } catch (err) {
    const problem = isErrnoException(err) && err.code === "ENOENT" ? "does not exist" : "could not be read";
    if (isTemplateMarked) {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: templateSniffFailMessage(relPath, problem),
      });
    }
    // Non-template entries never fail on stat during the S-001 placeholder path — a
    // broken/unreadable non-template source is out of this slice's tested surface
    // (S-002's containment.ts owns source-not-found/source-unreadable attribution).
    // Wrapped here only so a raw Node error never crosses the public API boundary.
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "invalid-input",
      appliedCount: 0,
      message: readFailureMessage(relPath, problem),
    });
  }

  // Stat-size gate BEFORE any content read (REQ-CCL-06): zero content-read calls for an
  // over-budget-by-stat file.
  if (stat.size > BATCH_CAP_BYTES) {
    if (isTemplateMarked) {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: templateSniffFailMessage(relPath, "exceeds the serialized frame budget"),
      });
    }
    return { verdict: "by-reference" };
  }

  const buf = readFileSync(abs);
  if (!isSniffableText(buf)) {
    if (isTemplateMarked) {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: templateSniffFailMessage(relPath, "is not valid text (binary content)"),
      });
    }
    return { verdict: "by-reference" };
  }

  const content = buf.toString("utf-8");

  // Serialized-form budget (REQ-CCL-02): measured the same way the fake measures a batch
  // (`Buffer.byteLength(JSON.stringify(x), "utf8")`), never raw bytes alone. `>` (not
  // `>=`) — exactly-at-budget still fits (REQ-CCL-02.3).
  const serializedSize = Buffer.byteLength(JSON.stringify(content), "utf8");
  if (serializedSize > BATCH_CAP_BYTES) {
    if (isTemplateMarked) {
      throw new AuthoringError({
        verb: undefined,
        path: undefined,
        reason: "invalid-input",
        appliedCount: 0,
        message: templateSniffFailMessage(relPath, "exceeds the serialized frame budget"),
      });
    }
    return { verdict: "by-reference" };
  }

  return { verdict: "by-value", content };
}
