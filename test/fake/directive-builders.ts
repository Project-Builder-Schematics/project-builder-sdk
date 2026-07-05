// Shared Batch/Directive literal builders for ContractFake fidelity suites.
// Kept out of test/support/ (that's runtime-facing) since these build wire literals
// directly, bypassing commons/context — the fidelity suites construct ContractFake
// inputs by hand on purpose (see fidelity.test.ts header).
import type { Batch, Directive, JsonValue } from "../../src/core/wire.ts";

export function batch(force: boolean, ...instructions: Directive[]): Batch {
  return { protocolVersion: 1, force, instructions };
}

// Convenience for the (common) envelope.force=false case.
export function batchOf(...instructions: Directive[]): Batch {
  return batch(false, ...instructions);
}

// Third arg disambiguates by type: a boolean sets create.force (options stays `{}`);
// a JsonValue object is used as create.options (no force key) — covers both call shapes
// in use across the fidelity suites without changing any call site.
export function createOp(pathTemplate: string, template: string, forceOrOptions?: boolean | JsonValue): Directive {
  const options: JsonValue = typeof forceOrOptions === "boolean" ? {} : (forceOrOptions ?? {});
  const create: { pathTemplate: string; template: string; options: JsonValue; force?: boolean } = {
    pathTemplate,
    template,
    options,
  };
  if (typeof forceOrOptions === "boolean") create.force = forceOrOptions;
  return { op: "create", create };
}

export function modifyOp(path: string, content: string): Directive {
  return { op: "modify", modify: { path, content } };
}

export function deleteOp(path: string): Directive {
  return { op: "delete", delete: { path } };
}

export function renameOp(path: string, newName: string, force?: boolean): Directive {
  const op: { path: string; newName: string; force?: boolean } = { path, newName };
  if (force !== undefined) op.force = force;
  return { op: "rename", rename: op };
}

export function copyOp(from: string, to: string, force?: boolean): Directive {
  const op: { from: string; to: string; force?: boolean } = { from, to };
  if (force !== undefined) op.force = force;
  return { op: "copy", copy: op };
}

export function moveOp(path: string, toDir: string, force?: boolean): Directive {
  const move: { path: string; toDir: string; force?: boolean } = { path, toDir };
  if (force !== undefined) move.force = force;
  return { op: "move", move };
}
