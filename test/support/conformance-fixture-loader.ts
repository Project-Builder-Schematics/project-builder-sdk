// Shapes + loader for the conformance/ corpus self-check (design.md §4.3, REQ-CSC series).
// Pure filesystem/JSON reads — no runner spawn, no behavioral proof (REQ-CFX-11 honesty
// boundary: this repo has no runner-driven verification path). Consumed exclusively by
// fit-40; a landed id without a manifest is left to the caller to flag, not thrown here —
// the whole point of REQ-CSC-01's mirror is to name the failure, not crash the loader.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type WireMethod = "tree.read" | "ir.emit" | "ir.commit" | "ir.discard";

export interface Corpus {
  wireSpecVersion: number;
  fixtures: string[];
}

export interface FactoryPointer {
  module: string;
  export: string | null;
}

export interface Outcome {
  exitCode: number;
  emitRejectionCode: string | null;
  failedIndex: number | null;
  writtenPaths: string[];
}

export interface Transcript {
  callbacks: WireMethod[];
  singleCommit: boolean;
  forbidDiscard: boolean;
  emitBeforeCommit: boolean;
}

export interface Case {
  name: string;
  greetingVersion?: number;
  seed: string | null;
  expected: string;
  factory?: FactoryPointer;
  outcome: Outcome;
  transcript: Transcript;
}

export interface Manifest {
  id: string;
  wireSpecVersion: number;
  class: "handshake" | "wire-mutation" | "composition";
  factory: FactoryPointer;
  input: unknown;
  lowering: { mode: "none" | "schematic"; schematicRoot?: string };
  cases: Case[];
}

/** A fixture id from `corpus.json#fixtures` whose `manifest.json` exists and parsed. */
export interface LoadedFixture {
  id: string;
  dir: string;
  manifest: Manifest;
}

export interface LoadedCorpus {
  root: string;
  corpus: Corpus;
  /** Only ids that resolved a `manifest.json` — REQ-CCR-02(a) violations are reported by
   * the caller via `missingManifestIds`, never silently dropped. */
  fixtures: LoadedFixture[];
  missingManifestIds: string[];
}

/** Parses `corpus.json` and every listed fixture's `manifest.json` under `root`. */
export function loadCorpus(root: string): LoadedCorpus {
  const corpus = JSON.parse(readFileSync(join(root, "corpus.json"), "utf8")) as Corpus;
  const fixtures: LoadedFixture[] = [];
  const missingManifestIds: string[] = [];

  for (const id of corpus.fixtures) {
    const dir = join(root, id);
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) {
      missingManifestIds.push(id);
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    fixtures.push({ id, dir, manifest });
  }

  return { root, corpus, fixtures, missingManifestIds };
}

/** Every directory directly under `root` (fixture candidates AND any orphan). */
export function listSubdirectories(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
