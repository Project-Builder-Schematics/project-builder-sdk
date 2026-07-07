// SEAM-02 (REQ-04): pure author-vocabulary plan renderer.
// AST-blind + core-blind by construction (REQ-05): the ONLY import is a type-only
// import from wire.ts — erased at compile time, zero runtime dependency on src/core/*.
//
// Wire→author verb mapping (frozen, six rows — identity for five ops, one translation):
//   create  → create
//   modify  → modify
//   delete  → remove
//   rename  → rename
//   move    → move
//   copy    → copy
//
// This internal `dryRunPlan(snapshot)` renderer is surfaced to authors as the zero-arg
// `dryRun()` accessor in src/commons — renderer edits here are publicly visible under
// that name.
import type { Directive } from "../core/wire.ts";

/**
 * Author-facing verb vocabulary for a dry-run plan entry.
 *
 * Frozen at exactly these six members — adding a member is a MAJOR event (ADR-0025).
 *
 * @example
 * function label(verb: DryRunVerb): string {
 *   switch (verb) {
 *     case "create": return "creates";
 *     case "modify": return "modifies";
 *     case "remove": return "removes";
 *     case "rename": return "renames";
 *     case "move": return "moves";
 *     case "copy": return "copies";
 *     default: {
 *       const exhaustive: never = verb;
 *       return exhaustive;
 *     }
 *   }
 * }
 */
export type DryRunVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy";

/**
 * One entry of a rendered dry-run plan: the author verb and the primary path the
 * operation targets. Carries no content or byte preview.
 *
 * @example
 * for (const entry of plan) {
 *   console.log(entry.verb, entry.path);
 * }
 */
export interface DryRunEntry {
  verb: DryRunVerb;
  path: string;
}

// Frozen six-row wire→author verb map — delete→remove, identity elsewhere. EXPORTED
// for the D3 consistency test (test-only reach, §4.6b): NOT re-exported by
// src/dry-run/index.ts or ./commons. The Record<Directive["op"], DryRunVerb> annotation
// itself compile-enforces totality over wire ops and value-membership in DryRunVerb.
export const WIRE_TO_AUTHOR_VERB: Record<Directive["op"], DryRunVerb> = {
  create: "create",
  modify: "modify",
  delete: "remove",
  rename: "rename",
  move: "move",
  copy: "copy",
};

/**
 * Renders a directive snapshot as an author-vocabulary plan.
 *
 * Each entry carries the author verb (per the frozen `WIRE_TO_AUTHOR_VERB` table above)
 * and the primary source path of the operation:
 *   create  → create.pathTemplate
 *   modify  → modify.path
 *   delete  → delete.path   (rendered as author verb "remove")
 *   rename  → rename.path
 *   move    → move.path
 *   copy    → copy.from     (primary source path)
 */
export function dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[] {
  return snapshot.map((d): DryRunEntry => {
    switch (d.op) {
      case "create": return { verb: WIRE_TO_AUTHOR_VERB.create, path: d.create.pathTemplate };
      case "modify": return { verb: WIRE_TO_AUTHOR_VERB.modify, path: d.modify.path };
      case "delete": return { verb: WIRE_TO_AUTHOR_VERB.delete, path: d.delete.path };
      case "rename": return { verb: WIRE_TO_AUTHOR_VERB.rename, path: d.rename.path };
      case "move":   return { verb: WIRE_TO_AUTHOR_VERB.move,   path: d.move.path };
      case "copy":   return { verb: WIRE_TO_AUTHOR_VERB.copy,   path: d.copy.from };
    }
  });
}
