/**
 * fit-30 (design § 4.7, stdout-protocol-sacred — S-000): stdout IS the wire. No module under
 * `src/transport/**` may reference `console.log(` or `process.stdout` — comments included,
 * same all-text posture as fit-10 — EXCEPT `framing.ts`, whose single captured-fd-1 writer
 * (`captureFd1FrameWriter`) is the one sanctioned stdout touchpoint; its write-site count is
 * pinned to exactly one below so the exemption can never quietly grow a second writer.
 *
 * Red-proof: inline planted fixtures (fit-10/fit-29's established no-fixture-file pattern).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles } from "../support/import-scan.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const TRANSPORT_DIR = join(PROJECT_ROOT, "src/transport");
const FRAMING_FILE = join(TRANSPORT_DIR, "framing.ts");

// Exactly ONE exemption — the file owning the captured-fd-1 writer. Its write-site count is
// separately pinned to 1 below, so the exemption cannot hide a second writer.
const EXEMPT_FILES: ReadonlySet<string> = new Set([FRAMING_FILE]);

const BANNED_STDOUT_PATTERNS: readonly RegExp[] = [/\bconsole\.log\(/, /\bprocess\.stdout\b/];

function stdoutViolations(source: string, absPath: string): string[] {
  if (EXEMPT_FILES.has(absPath)) return [];
  return BANNED_STDOUT_PATTERNS.filter((pattern) => pattern.test(source)).map(
    (pattern) => `stdout-sacred violation (${pattern.source}): ${absPath.replace(PROJECT_ROOT, "")}`
  );
}

describe("fit-30 — stdout is the wire (stdout-protocol-sacred, src/transport/**)", () => {
  const files = collectTsFiles(TRANSPORT_DIR);

  it("the walk reaches the real transport modules (non-vacuous)", () => {
    expect(files).toContain(join(TRANSPORT_DIR, "runner.ts"));
    expect(files).toContain(FRAMING_FILE);
  });

  for (const file of files) {
    it(`${file.replace(PROJECT_ROOT, "")} holds no unsanctioned stdout reference`, () => {
      expect(stdoutViolations(readFileSync(file, "utf-8"), file)).toEqual([]);
    });
  }

  it("framing.ts's captured-fd-1 writer is SINGLE: exactly one process.stdout.write site", () => {
    const source = readFileSync(FRAMING_FILE, "utf-8");
    const writeSites = source.match(/process\.stdout\.write/g) ?? [];
    expect(writeSites.length).toEqual(1);
  });

  // RED-PROOF: a planted console.log in a non-exempt transport file is flagged.
  it("[red-proof] a planted console.log( in a transport file is flagged", () => {
    const fixture = `export function debug(x: unknown) { console.log(x); }`;
    const violations = stdoutViolations(fixture, join(TRANSPORT_DIR, "sneaky-log.ts"));
    expect(violations.length).toBeGreaterThan(0);
  });

  // RED-PROOF: a planted direct process.stdout.write bypassing the captured writer is flagged.
  it("[red-proof] a planted process.stdout.write in a transport file is flagged", () => {
    const fixture = `export function leak(b: Buffer) { process.stdout.write(b); }`;
    const violations = stdoutViolations(fixture, join(TRANSPORT_DIR, "sneaky-writer.ts"));
    expect(violations.length).toBeGreaterThan(0);
  });

  // RED-PROOF (no false negative via stderr): stderr notes are allowed — the scan only
  // guards fd-1.
  it("[red-proof] a process.stderr.write reference is NOT flagged", () => {
    const fixture = `export function note(t: string) { process.stderr.write(t); }`;
    expect(stdoutViolations(fixture, join(TRANSPORT_DIR, "stderr-note.ts"))).toEqual([]);
  });
});
