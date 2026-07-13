/**
 * FIT-24 (REQ-FTG-02): corpus purity — every committed corpus file must contain no binary
 * magic bytes, no absolute-filesystem-path-shaped strings, and no non-deterministic-field
 * shapes (timestamps, durations, uuids/nonces — REQ-GCC-06). Pre-merge, RED-provable
 * against the REQ-GCC-12 skeleton record alone.
 *
 * Failure-message taxonomy (design §4.4): guard id + broken invariant + named offender +
 * rule cite.
 *
 * Red-proofs:
 *  - `abs-path-corpus.transcript.json` — a planted corpus-shaped record with a leaked
 *    absolute path.
 *  - `nondeterministic-factory.ts` — a factory embedding a fresh `randomUUID()` per run.
 *  - an inline PNG magic-byte sequence (binary check needs no committed fixture — this
 *    corpus is always text-only, so the check has nothing real to exercise it against).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { captureRun } from "../support/ir-transcript.ts";
import { buildRecord, serializeCorpus } from "../support/corpus-format.ts";
import { run as nondeterministicRun } from "../fixtures/red/author-emulation/nondeterministic-factory.ts";

const CORPUS_DIR = new URL("../e2e/author-emulation/corpus", import.meta.url).pathname;
const ABS_PATH_FIXTURE = new URL(
  "../fixtures/red/author-emulation/abs-path-corpus.transcript.json",
  import.meta.url
).pathname;

// Read as latin1 (byte-preserving, 1 char per byte) so a real committed binary blob's raw
// bytes survive intact for the magic-byte scan — a plain `utf-8` decode would silently
// mangle any non-UTF8 byte sequence before we ever get to compare it.
const BINARY_MAGIC_BYTES: readonly Buffer[] = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP
];
const BINARY_MAGIC_SEQUENCES = BINARY_MAGIC_BYTES.map((b) => b.toString("latin1"));

function hasBinaryMagicBytes(latin1Text: string): boolean {
  return BINARY_MAGIC_SEQUENCES.some((magic) => latin1Text.includes(magic));
}

// Package-relative paths in this corpus NEVER start with "/" (REQ-BRC-07/GCC-06) — any
// quoted JSON string VALUE beginning with a leading slash is an absolute-path leak.
const ABS_PATH_VALUE_RE = /:\s*"(\/[^"]*)"/g;

function absolutePathStrings(text: string): string[] {
  return [...text.matchAll(ABS_PATH_VALUE_RE)].map((m) => m[1]!);
}

// Timestamp (ISO-8601) and UUID shapes — neither may survive into a deterministic record.
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function nondeterministicFieldMatches(text: string): string[] {
  const matches: string[] = [];
  const iso = text.match(ISO_TIMESTAMP_RE);
  if (iso) matches.push(iso[0]);
  const uuid = text.match(UUID_RE);
  if (uuid) matches.push(uuid[0]);
  return matches;
}

function collectCorpusFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".transcript.json"))
    .map((name) => join(dir, name));
}

describe("FIT-24 — corpus purity (no binary / absolute-path / nondeterministic-field content, REQ-FTG-02)", () => {
  it("every committed corpus file is free of binary bytes, absolute paths, and nondeterministic fields", () => {
    for (const file of collectCorpusFiles(CORPUS_DIR)) {
      const latin1 = readFileSync(file, "latin1");
      const utf8 = readFileSync(file, "utf-8");

      expect({ file, binary: hasBinaryMagicBytes(latin1) }).toEqual({ file, binary: false });
      expect({ file, absPaths: absolutePathStrings(utf8) }).toEqual({ file, absPaths: [] });
      expect({ file, nondeterministic: nondeterministicFieldMatches(utf8) }).toEqual({
        file,
        nondeterministic: [],
      });
    }
  });

  // RED-PROOF: a corpus file containing an absolute path is caught.
  it("[red-proof] a corpus file containing an absolute path is detected", () => {
    const text = readFileSync(ABS_PATH_FIXTURE, "utf-8");
    expect(absolutePathStrings(text)).toContain("/etc/passwd");
  });

  // RED-PROOF: a corpus record embedding a fresh UUID (the FIT-23 companion factory) is
  // detected as a nondeterministic field.
  it("[red-proof] a corpus record embedding a fresh UUID is detected", async () => {
    const capture = await captureRun(nondeterministicRun, { tag: "red-proof" });
    const record = buildRecord(capture, { scenarioId: "red-00", slug: "nondeterministic" });
    const text = serializeCorpus(record);

    expect(nondeterministicFieldMatches(text).length).toBeGreaterThan(0);
  });

  // RED-PROOF: a PNG magic-byte sequence embedded in otherwise-plain text is detected.
  it("[red-proof] a PNG magic-byte sequence is detected", () => {
    const text = `{"blob": "${BINARY_MAGIC_SEQUENCES[0]}"}`;
    expect(hasBinaryMagicBytes(text)).toBe(true);
  });

  // RED-PROOF (no false positive): plain package-relative paths are never flagged.
  it("[red-proof] a package-relative path is NOT flagged as absolute", () => {
    const text = `{"path": "src/scaffold/index.ts"}`;
    expect(absolutePathStrings(text)).toEqual([]);
  });
});
