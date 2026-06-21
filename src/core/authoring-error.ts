// SEAM-04 (ADR-02): author-vocabulary error attribution.
// toAuthoringError translates an opaque engine/fake rejection into the author's own
// vocabulary (verb + primary path of the FAILING directive). Gap-#2 pin: the message is
// a FRESH string built from verb+path; the raw engine message is DISCARDED and NOT chained
// via `.cause` — so the no-engine-text guarantee (REQ-11/12.2/13.1) holds for the WHOLE
// error object, not only `.message`. Rich cause access is deferred to #3.

import type { Directive } from "./wire.ts";

export type AuthoringVerb = "create" | "modify" | "delete" | "rename" | "move" | "copy";

export class AuthoringError extends Error {
  readonly verb: AuthoringVerb;
  readonly path: string;

  constructor(verb: AuthoringVerb, path: string) {
    super(`${verb} failed at ${path}`);
    this.name = "AuthoringError";
    this.verb = verb;
    this.path = path;
  }
}

// Primary path per op (design §4.4): pathTemplate (create), path (modify/delete/rename/move),
// from (copy). The verb is the wire op tag.
function primaryPath(directive: Directive): string {
  switch (directive.op) {
    case "create":
      return directive.create.pathTemplate;
    case "modify":
      return directive.modify.path;
    case "delete":
      return directive.delete.path;
    case "rename":
      return directive.rename.path;
    case "move":
      return directive.move.path;
    case "copy":
      return directive.copy.from;
  }
}

// Builds a fresh AuthoringError from the failing directive. `raw` is intentionally unused —
// the skeleton discards the engine message rather than chaining it (gap-#2). #3 may reintroduce
// structured cause access once attribution is frozen.
export function toAuthoringError(_raw: unknown, directive: Directive): AuthoringError {
  return new AuthoringError(directive.op, primaryPath(directive));
}
