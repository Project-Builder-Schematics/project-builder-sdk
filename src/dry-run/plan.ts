// SEAM-02 (REQ-04): pure author-vocabulary plan renderer.
// AST-blind + core-blind by construction (REQ-05): the ONLY import is a type-only
// import from wire.ts — erased at compile time, zero runtime dependency on src/core/*.
import type { Directive } from "../core/wire.ts";

export interface DryRunEntry {
  verb: string;
  path: string;
}

/**
 * Renders a directive snapshot as an author-vocabulary plan.
 *
 * Each entry carries the wire op tag as `verb` and the primary source path as `path`:
 *   create  → create.pathTemplate
 *   modify  → modify.path
 *   delete  → delete.path   (wire tag is "delete"; author verb "remove" is NOT used here)
 *   rename  → rename.path
 *   move    → move.path
 *   copy    → copy.from     (primary source path)
 */
export function dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[] {
  return snapshot.map((d): DryRunEntry => {
    switch (d.op) {
      case "create": return { verb: "create", path: d.create.pathTemplate };
      case "modify": return { verb: "modify", path: d.modify.path };
      case "delete": return { verb: "delete", path: d.delete.path };
      case "rename": return { verb: "rename", path: d.rename.path };
      case "move":   return { verb: "move",   path: d.move.path };
      case "copy":   return { verb: "copy",   path: d.copy.from };
    }
  });
}
