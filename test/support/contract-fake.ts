// FAKE-01..06 (S-002 full fidelity): seeded flat in-memory tree, single-phase eager apply.
// Tree-first read: staged content takes precedence over the seed.
// served:"tree"|"disk" is fake-internal test state (lastServed), never in the EngineClient.read return.
// Force semantics (FAKE-04): effective = envelope.force OR op.force.
// create/rename/copy over an existing target → error unless effective.
// Idempotent delete (FAKE-05): absent target → succeed (no error).

import { posix as path } from "node:path";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch, Directive } from "../../src/core/wire.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";

// boundary REQ-01/02: structural equality for the round-trip fidelity check. Plain `===`
// is not enough — JSON.stringify silently OMITS object keys (function/undefined/Symbol
// values) and nulls array elements holding those same values, so a mismatch shows up as
// a missing key (Object.keys length differs) or a null-vs-non-null array element, never
// as a thrown error.
function deepEqual(a: unknown, b: unknown): boolean {
  // Object.is, not `===`: `-0 === 0` is true but JSON round-trips -0 to 0, so `===`
  // would silently pass a fidelity-breaking mutation (fail-closed posture, REQ-01/02).
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

export type ServedFrom = "tree" | "disk";

export interface ContractFakeOptions {
  seed: Record<string, string>;
}

export class ContractFake implements EngineClient {
  readonly #seed: Record<string, string>;
  readonly #tree: Map<string, string> = new Map();
  // ADR-01 two-phase model: #committed is empty until commit() promotes staging into it.
  // read() NEVER consults #committed — read-your-own-writes stays bound to #tree (staging).
  readonly #committed: Map<string, string> = new Map();
  // Tracks paths that have been explicitly deleted (so deleted seed paths stay absent).
  readonly #deleted: Set<string> = new Set();
  lastServed: ServedFrom | null = null;

  constructor({ seed }: ContractFakeOptions) {
    this.#seed = { ...seed };
  }

  async emit(batch: Batch): Promise<void> {
    // boundary REQ-02 (stringify-throw family): BigInt/circular values make
    // JSON.stringify itself throw. Guarded here — once, shared with the cap check below
    // and the round-trip compare — so the throw surfaces as an `emit` rejection instead
    // of an uncaught crash. RAW-UNTIL-STAGE-2.1
    let serialized: string;
    try {
      serialized = JSON.stringify(batch);
    } catch (err) {
      throw new Error(
        `ContractFake: batch failed JSON serialization: "${err instanceof Error ? err.message : String(err)}"`
      );
    }

    // ADR-0019: cap enforced HERE — the fake is the engine stand-in and the sole judge
    // of size (ADR-0018); Session.flush calls emit unconditionally, no SDK-side branch.
    // RAW-UNTIL-STAGE-2.1
    const size = Buffer.byteLength(serialized, "utf8");
    if (size > BATCH_CAP_BYTES) {
      throw new Error(
        `ContractFake: batch exceeds size cap — ${size} bytes serialized, cap is ${BATCH_CAP_BYTES} bytes`
      );
    }

    // boundary REQ-01/02 (silent-drop family): stringify can SUCCEED while quietly
    // dropping function/undefined/Symbol values — only a structural compare against the
    // original catches that. RAW-UNTIL-STAGE-2.1
    const roundTripped = JSON.parse(serialized) as unknown;
    if (!deepEqual(batch, roundTripped)) {
      throw new Error(
        "ContractFake: batch failed round-trip fidelity check: non-JSON-safe value detected"
      );
    }

    for (const directive of batch.instructions) {
      this.#apply(directive, batch.force);
    }
  }

  // ADR-01: promote the staging tree into the committed tree atomically, then clear staging.
  // Staged deletions remove the path from committed. All-or-nothing: a single call promotes
  // the whole staged set.
  async commit(): Promise<void> {
    for (const [p, content] of this.#tree) {
      this.#committed.set(p, content);
    }
    for (const p of this.#deleted) {
      this.#committed.delete(p);
    }
    this.#tree.clear();
    this.#deleted.clear();
  }

  // ADR-01: drop the staging tree; the committed tree is untouched.
  async discard(): Promise<void> {
    this.#tree.clear();
    this.#deleted.clear();
  }

  // Test-only assertion accessors (NOT on the EngineClient port).
  committedTree(): ReadonlyMap<string, string> {
    return new Map(this.#committed);
  }

  stagingTree(): ReadonlyMap<string, string> {
    return new Map(this.#tree);
  }

  // ADR-01: not-found returns `undefined` (NOT a throw). Absence is detected by KEY MEMBERSHIP
  // (#deleted.has / !#tree.has / !(in #seed)) — never truthiness — so a seeded "" returns "".
  async read(filePath: string): Promise<string | undefined> {
    if (this.#deleted.has(filePath)) {
      return undefined;
    }
    if (this.#tree.has(filePath)) {
      this.lastServed = "tree";
      return this.#tree.get(filePath)!;
    }
    if (filePath in this.#seed) {
      this.lastServed = "disk";
      return this.#seed[filePath]!;
    }
    return undefined;
  }

  #exists(p: string): boolean {
    if (this.#deleted.has(p)) return false;
    return this.#tree.has(p) || p in this.#seed;
  }

  #getContent(p: string): string {
    if (this.#tree.has(p)) return this.#tree.get(p)!;
    return this.#seed[p]!;
  }

  // FAKE-04: envelope force wins over an absent/false op-level force.
  #effectiveForce(envelopeForce: boolean, opForce: boolean | undefined): boolean {
    return envelopeForce || (opForce ?? false);
  }

  #apply(directive: Directive, envelopeForce: boolean): void {
    if (directive.op === "create") {
      const { pathTemplate, template, force: opForce } = directive.create;
      const effective = this.#effectiveForce(envelopeForce, opForce);
      if (this.#exists(pathTemplate) && !effective) {
        throw new Error(
          `ContractFake: create collision — "${pathTemplate}" already exists (use force to overwrite)`
        );
      }
      // The fake stores the template as content; rendering is the engine's concern.
      this.#deleted.delete(pathTemplate);
      this.#tree.set(pathTemplate, template);
      return;
    }

    if (directive.op === "modify") {
      const { path: p, content } = directive.modify;
      // ADR-0017 rule 2: modify never materializes a new file — the target must already
      // exist (staging counts: eager array-order apply means an earlier create/modify in
      // the same batch is visible here).
      // RAW-UNTIL-STAGE-2.1
      if (!this.#exists(p)) {
        throw new Error(`ContractFake: modify target not found: "${p}"`);
      }
      this.#deleted.delete(p);
      this.#tree.set(p, content);
      return;
    }

    if (directive.op === "delete") {
      const { path: p } = directive.delete;
      // Idempotent: absent target is not an error.
      this.#tree.delete(p);
      this.#deleted.add(p);
      return;
    }

    if (directive.op === "rename") {
      const { path: src, newName, force: opForce } = directive.rename;
      // The real engine cannot rename a non-existent file (FAKE-06 fidelity).
      if (!this.#exists(src)) {
        throw new Error(`ContractFake: rename source not found: "${src}"`);
      }
      const dir = path.dirname(src);
      const dst = dir === "." ? newName : path.join(dir, newName);
      const effective = this.#effectiveForce(envelopeForce, opForce);
      if (this.#exists(dst) && !effective) {
        throw new Error(
          `ContractFake: rename collision — destination "${dst}" already exists (use force to overwrite)`
        );
      }
      const content = this.#getContent(src);
      // Remove source, write destination.
      this.#tree.delete(src);
      this.#deleted.add(src);
      this.#deleted.delete(dst);
      this.#tree.set(dst, content);
      return;
    }

    if (directive.op === "copy") {
      const { from, to, force: opForce } = directive.copy;
      // The real engine cannot copy a non-existent source (FAKE-06 fidelity).
      if (!this.#exists(from)) {
        throw new Error(`ContractFake: copy source not found: "${from}"`);
      }
      const effective = this.#effectiveForce(envelopeForce, opForce);
      if (this.#exists(to) && !effective) {
        throw new Error(
          `ContractFake: copy collision — destination "${to}" already exists (use force to overwrite)`
        );
      }
      const content = this.#getContent(from);
      this.#deleted.delete(to);
      this.#tree.set(to, content);
      return;
    }

    if (directive.op === "move") {
      const { path: src, toDir, force: opForce } = directive.move;
      // The real engine cannot move a non-existent source (FAKE-06 fidelity).
      if (!this.#exists(src)) {
        throw new Error(`ContractFake: move source not found: "${src}"`);
      }
      const base = path.basename(src);
      // Use path.join to normalize trailing-slash toDir (e.g. "lib/" → "lib/foo.ts").
      const dst = path.join(toDir, base);
      const effective = this.#effectiveForce(envelopeForce, opForce);
      // ADR-0017 self-move identity amendment: dst === src is not a collision — a
      // self-move is a file-preserving success, no force required.
      const isSelfMove = dst === src;
      // RAW-UNTIL-STAGE-2.1
      if (!isSelfMove && this.#exists(dst) && !effective) {
        throw new Error(
          `ContractFake: move collision — destination "${dst}" already exists (use force to overwrite)`
        );
      }
      const content = this.#getContent(src);
      this.#tree.delete(src);
      this.#deleted.add(src);
      this.#deleted.delete(dst);
      this.#tree.set(dst, content);
      return;
    }
  }
}
