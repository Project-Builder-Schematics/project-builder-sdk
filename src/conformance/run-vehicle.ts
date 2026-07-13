// S-004 — the conformance kit's run vehicle (ADR-0012 amendment, "Run vehicle", rev 4).
//
// `testDialect`/`testOpPack`'s DC-02..05 assertions need to observe an EMITTED, coalesced
// batch — which requires driving a REAL run through `defineFactory` (ADR-0012 forbids a
// mock/bypass of the emit seam). This module is a MINIMAL, kit-internal, in-memory transport
// implementing only the semantics those assertions need: stage a batch, apply it to an
// in-memory tree, read it back, commit/discard. It is NOT exported from `./conformance`
// (internal port use only — re-export is not, FIT-08). It does NOT replace `test/`'s
// `ContractFake`: that stays the normative, full-fidelity fake for the SDK's own test suite;
// this is a deliberately thin, SEPARATE implementation whose own fidelity is pinned by the
// kit's assertions running the REAL dialect through it (a divergence would fail DC-01..05,
// not hide).
//
// Deliberately does not name the SDK's transport-port TYPE anywhere in this file, in
// comments included (REQ-FIT-09 / fit-10's structural guard scans ALL text, not just code —
// its allow-list is exactly one path, and this is not it). The port shape is satisfied via a
// LOCAL structural type instead — the same sanctioned pattern `src/testing/index.ts`'s facade
// uses for its own spy-wrapping.

import type { Batch, Directive } from "../core/wire.ts";

/** Local structural mirror of the transport port — never names the port type (see header). */
interface RunVehicleClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string | undefined>;
  commit(): Promise<void>;
  discard(): Promise<void>;
}

function applyDirective(tree: Map<string, string>, directive: Directive): void {
  if (directive.op === "create") {
    tree.set(directive.create.pathTemplate, directive.create.template);
    return;
  }
  if (directive.op === "modify") {
    tree.set(directive.modify.path, directive.modify.content);
    return;
  }
  if (directive.op === "delete") {
    tree.delete(directive.delete.path);
    return;
  }
  if (directive.op === "rename") {
    const content = tree.get(directive.rename.path);
    if (content !== undefined) {
      tree.delete(directive.rename.path);
      tree.set(directive.rename.newName, content);
    }
    return;
  }
  if (directive.op === "move") {
    const content = tree.get(directive.move.path);
    if (content !== undefined) {
      tree.delete(directive.move.path);
      const base = directive.move.path.split("/").pop() ?? directive.move.path;
      tree.set(`${directive.move.toDir}/${base}`, content);
    }
    return;
  }
  if (directive.op === "copy") {
    const content = tree.get(directive.copy.from);
    if (content !== undefined) {
      tree.set(directive.copy.to, content);
    }
    return;
  }
  // S-003 (ATH-16): the ONLY op this vehicle adds collision machinery for — every other
  // branch above applies silently (header note). `copyIn`'s source is package-local, not
  // a tree entry (ADR-0045: SDK-side containment is the legitimate source-existence
  // check, this vehicle never re-checks it) — collision-only, and NEVER writes `to` into
  // `tree` on success (emit-only, REQ-ATH-15.1/BRC-04 — no simulation surface ever
  // materializes by-reference bytes).
  if (directive.op === "copyIn") {
    const { to, force } = directive.copyIn;
    if (tree.has(to) && !force) {
      throw new Error(`copyIn collision — destination "${to}" already exists (use force to overwrite)`);
    }
    return;
  }
}

/**
 * Builds a fresh, single-run in-memory transport seeded with the paths an `OpExercise` needs.
 * Every exercise runs its OWN isolated vehicle instance (§4.4c) — no shared state across
 * exercises. `emitted` collects every batch this vehicle's `emit` observed, in order, for the
 * kit's own directive-content assertions.
 */
export function createRunVehicle(seed: Record<string, string>): { client: RunVehicleClient; emitted: Batch[] } {
  const tree = new Map<string, string>(Object.entries(seed));
  const emitted: Batch[] = [];

  const client: RunVehicleClient = {
    async emit(batch: Batch): Promise<void> {
      emitted.push(batch);
      for (const directive of batch.instructions) {
        applyDirective(tree, directive);
      }
    },
    async read(path: string): Promise<string | undefined> {
      return tree.get(path);
    },
    async commit(): Promise<void> {
      // Nothing to promote — this vehicle applies eagerly on emit (no staging/committed
      // distinction; each exercise is a fresh, single-purpose, single-run instance whose
      // only consumer is the kit's own `emitted` inspection, never a "final tree" read).
    },
    async discard(): Promise<void> {
      tree.clear();
    },
  };

  return { client, emitted };
}
