// FAKE-01..06 (S-002 full fidelity): seeded flat in-memory tree, single-phase eager apply.
// Tree-first read: staged content takes precedence over the seed.
// served:"tree"|"disk" is fake-internal test state (lastServed), never in the EngineClient.read return.
// Force semantics (FAKE-04): effective = envelope.force OR op.force.
// create/rename/copy over an existing target → error unless effective.
// Idempotent delete (FAKE-05): absent target → succeed (no error).

import { posix as path } from "node:path";
import type { EngineClient } from "../core/engine-client.ts";
import type { Batch, Directive } from "../core/wire.ts";
import { BATCH_CAP_BYTES } from "../core/wire.ts";
import { EmitRejection } from "../core/emit-rejection.ts";
import { deepEqual } from "../core/deep-equal.ts";
import {
  CONTRACT_FAKE_PREFIX,
  ALREADY_EXISTS,
  USE_FORCE_TO_OVERWRITE,
  NOT_FOUND,
  EXCEEDS_SIZE_CAP,
  ROUND_TRIP_FIDELITY_CHECK,
  JSON_SERIALIZATION,
} from "./rejection-messages.ts";

export type ServedFrom = "tree" | "disk";

export interface ContractFakeOptions {
  seed: Record<string, string>;
}

export class ContractFake implements EngineClient {
  // Null-prototype + Object.hasOwn everywhere below: a plain-prototype seed object makes
  // "path in seed" / seed[path] leak Object.prototype members ("__proto__", "constructor",
  // "toString", ...) as spuriously present, even when the caller never seeded them.
  readonly #seed: Record<string, string>;
  readonly #tree: Map<string, string> = new Map();
  // ADR-01 two-phase model: #committed is empty until commit() promotes staging into it.
  // read() NEVER consults #committed — read-your-own-writes stays bound to #tree (staging).
  readonly #committed: Map<string, string> = new Map();
  // Tracks paths that have been explicitly deleted (so deleted seed paths stay absent).
  readonly #deleted: Set<string> = new Set();
  lastServed: ServedFrom | null = null;

  constructor({ seed }: ContractFakeOptions) {
    this.#seed = Object.assign(Object.create(null) as Record<string, string>, seed);
  }

  async emit(batch: Batch): Promise<void> {
    // boundary REQ-02 (stringify-throw family): BigInt/circular values make
    // JSON.stringify itself throw. Guarded here — once, shared with the cap check below
    // and the round-trip compare — so the throw surfaces as an `emit` rejection instead
    // of an uncaught crash.
    let serialized: string;
    try {
      serialized = JSON.stringify(batch);
    } catch (err) {
      throw new EmitRejection(
        "unrepresentable",
        `${CONTRACT_FAKE_PREFIX} batch failed ${JSON_SERIALIZATION}: "${err instanceof Error ? err.message : String(err)}"`
      );
    }

    // ADR-0019: cap enforced HERE — the fake is the engine stand-in and the sole judge
    // of size (ADR-0018); Session.flush calls emit unconditionally, no SDK-side branch.
    //
    const size = Buffer.byteLength(serialized, "utf8");
    if (size > BATCH_CAP_BYTES) {
      throw new EmitRejection(
        "cap",
        `${CONTRACT_FAKE_PREFIX} batch ${EXCEEDS_SIZE_CAP} — ${size} bytes serialized, cap is ${BATCH_CAP_BYTES} bytes`
      );
    }

    // boundary REQ-01/02 (silent-drop family): stringify can SUCCEED while quietly
    // dropping function/undefined/Symbol values — only a structural compare against the
    // original catches that.
    const roundTripped = JSON.parse(serialized) as unknown;
    if (!deepEqual(batch, roundTripped)) {
      throw new EmitRejection(
        "unrepresentable",
        `${CONTRACT_FAKE_PREFIX} batch failed ${ROUND_TRIP_FIDELITY_CHECK}: non-JSON-safe value detected`
      );
    }

    for (const [index, directive] of batch.instructions.entries()) {
      this.#apply(directive, batch.force, index);
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
    if (Object.hasOwn(this.#seed, filePath)) {
      this.lastServed = "disk";
      return this.#seed[filePath]!;
    }
    return undefined;
  }

  #exists(p: string): boolean {
    if (this.#deleted.has(p)) return false;
    return this.#tree.has(p) || Object.hasOwn(this.#seed, p);
  }

  #getContent(p: string): string {
    if (this.#tree.has(p)) return this.#tree.get(p)!;
    return this.#seed[p]!;
  }

  // FAKE-04: envelope force wins over an absent/false op-level force.
  #effectiveForce(envelopeForce: boolean, opForce: boolean | undefined): boolean {
    return envelopeForce || (opForce ?? false);
  }

  #requireExists(target: string, label: string, pos: { failedIndex: number; appliedCount: number }): void {
    if (!this.#exists(target)) {
      throw new EmitRejection("not-found", `${CONTRACT_FAKE_PREFIX} ${label} ${NOT_FOUND}: "${target}"`, pos);
    }
  }

  #rejectIfCollides(
    target: string,
    effective: boolean,
    label: string,
    pos: { failedIndex: number; appliedCount: number }
  ): void {
    if (this.#exists(target) && !effective) {
      throw new EmitRejection(
        "collision",
        `${CONTRACT_FAKE_PREFIX} ${label} ${ALREADY_EXISTS} (${USE_FORCE_TO_OVERWRITE})`,
        pos
      );
    }
  }

  // `index` is this directive's position in the batch — every earlier directive already
  // applied (eager array-order apply), so a throw HERE means `appliedCount === index`
  // (emit-rejection-metadata REQ-ERM-01).
  #apply(directive: Directive, envelopeForce: boolean, index: number): void {
    const pos = { failedIndex: index, appliedCount: index };

    if (directive.op === "create") {
      const { pathTemplate, template, force: opForce } = directive.create;
      const effective = this.#effectiveForce(envelopeForce, opForce);
      this.#rejectIfCollides(pathTemplate, effective, `create collision — "${pathTemplate}"`, pos);
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
      this.#requireExists(p, "modify target", pos);
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
      this.#requireExists(src, "rename source", pos);
      const dir = path.dirname(src);
      const dst = dir === "." ? newName : path.join(dir, newName);
      const effective = this.#effectiveForce(envelopeForce, opForce);
      this.#rejectIfCollides(dst, effective, `rename collision — destination "${dst}"`, pos);
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
      this.#requireExists(from, "copy source", pos);
      const effective = this.#effectiveForce(envelopeForce, opForce);
      this.#rejectIfCollides(to, effective, `copy collision — destination "${to}"`, pos);
      const content = this.#getContent(from);
      this.#deleted.delete(to);
      this.#tree.set(to, content);
      return;
    }

    if (directive.op === "move") {
      const { path: src, toDir, force: opForce } = directive.move;
      // The real engine cannot move a non-existent source (FAKE-06 fidelity).
      this.#requireExists(src, "move source", pos);
      const base = path.basename(src);
      // Use path.join to normalize trailing-slash toDir (e.g. "lib/" → "lib/foo.ts").
      const dst = path.join(toDir, base);
      const effective = this.#effectiveForce(envelopeForce, opForce);
      // ADR-0017 self-move identity amendment: dst === src is not a collision — a
      // self-move is a file-preserving success, no force required.
      const isSelfMove = dst === src;
      if (!isSelfMove) {
        this.#rejectIfCollides(dst, effective, `move collision — destination "${dst}"`, pos);
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
