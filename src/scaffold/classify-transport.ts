// src/scaffold/classify-transport.ts (ADR-0044): the by-value/by-reference classifier —
// stat-gate → whole-file sniff → serialized-budget → verdict (content-classification
// REQ-CCL-01/02/03/06), plus the `.template`/`templateFile` render-request fail-loud
// carve-out (REQ-CCL-05). PURE per-file decision (Executor Context §18) — it never throws
// for an ORDINARY by-reference verdict; the caller (`expander.ts`) decides what a
// by-reference verdict means for THIS slice (S-001: fail-loud placeholder; S-003: real
// `copyIn` emission).
//
// Containment (S-002): delegates to `containment.ts`'s `validateSourceContainment` —
// realpath-based, segment-aware, case-fold ceiling check + regular-file allow-list
// (REQ-PRC-01..08) — REPLACING S-001's MINIMAL lexical-only placeholder guard. Containment
// runs BEFORE any of this module's own stat/sniff/budget checks (REQ-PRC-08); the `Stats`
// containment already obtained via `lstat` is reused here for the CCL-06 size gate rather
// than stat'ing the path a second time. A `readFileSync` failure AFTER containment has
// already proven an in-ceiling regular file (e.g. a permission/I/O error between lstat and
// read) classifies `source-unreadable` (REQ-AEC-10) — distinct from a CONTENT-level
// classify failure (binary/oversized), which stays `invalid-input` for `.template`-marked
// entries only (REQ-CCL-05/AEC-12) and by-reference for everything else.

import { readFileSync } from "node:fs";
import { AuthoringError } from "../core/authoring-error.ts";
import { BATCH_CAP_BYTES } from "../core/wire.ts";
import { validateSourceContainment } from "./containment.ts";

export type ClassificationVerdict = "by-value" | "by-reference";

export type ClassifyResult =
  | { verdict: "by-value"; /** The file's decoded UTF-8 content. */ content: string }
  | { verdict: "by-reference" };

// REQ-CCL-01's whole-file sniff, scoped to what a render REQUEST needs (S-000): valid UTF-8
// across the ENTIRE buffer (never a prefix sample — REQ-CCL-03) and no null byte anywhere.
// Lives here (the classify leaf) so the module graph stays acyclic — `index.ts` re-exports
// the boolean form for the historical `scaffold/index.ts` surface. A render request has no
// by-reference fallback (REQ-FEH-02), it fails loud. Returning the decoded string (instead
// of decoding a second time at the caller) is safe: a buffer that survives the fatal decode
// decodes identically under `buf.toString("utf-8")`.
export function decodeSniffableText(buf: Buffer): string | null {
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

export function isSniffableText(buf: Buffer): boolean {
  return decodeSniffableText(buf) !== null;
}

function templateSniffFailMessage(relPath: string, problem: string): string {
  return (
    `invalid input: source "${relPath}" is marked .template but ${problem} — ` +
    "render requests never silently fall back to a copy"
  );
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
  packageRoot: string;
  relPath: string;
  isTemplateMarked: boolean;
  /** Precomputed `resolveRealCeiling(packageRoot)` — threaded by loop callers (`runScaffold`). */
  realCeiling?: string;
}): ClassifyResult {
  const { packageDir, packageRoot, relPath, isTemplateMarked, realCeiling } = params;

  // REQ-PRC-08: containment + regular-file eligibility complete BEFORE any content read.
  // Throws one of the four `source-*` reasons on failure — regardless of `isTemplateMarked`
  // (a missing/outside-package/non-regular SOURCE is a source-read failure, not a
  // classify-level CCL-05 content failure; only steps AFTER containment get the
  // `.template` invalid-input carve-out below).
  const { absPath, stat } = validateSourceContainment({ packageDir, packageRoot, relPath, realCeiling });

  // Stat-size gate BEFORE any content read (REQ-CCL-06): zero content-read calls for an
  // over-budget-by-stat file. Reuses containment's own `lstat` — no second stat call.
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

  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch {
    // Containment already proved an in-ceiling regular file; a read failure THIS LATE is a
    // genuine read-path failure (permission/I/O), never a missing/outside-package source.
    throw new AuthoringError({ verb: undefined, path: relPath, reason: "source-unreadable", appliedCount: 0 });
  }
  const content = decodeSniffableText(buf);
  if (content === null) {
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
