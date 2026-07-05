/**
 * S-03 — CI permissive-proof guard (REQ-03).
 *
 * Replaces the old `ci.yml` inverted-exit "Permissive-proof (must fail)" step. That step only
 * asserted "tsc exited non-zero", which is blind to WHICH negative held: if the `create<S>`
 * overload regressed so a negative (excess / missing-required / wrong-type) became LEGAL, its
 * `@ts-expect-error` would turn UNUSED and itself raise TS2578 → tsc still exits non-zero → the
 * old step still "passed" while the negative proof silently rotted.
 *
 * This guard instead pins the EXACT expected diagnostic set by error code + directive region:
 *   - TS2578 (unused @ts-expect-error) MUST be PRESENT on every `[idiom-1]` directive line
 *     (a directive on VALID code — its unusedness IS the proof), AND
 *   - TS2578 MUST be ABSENT on every `[idiom-2]` directive line (a directive suppressing a REAL
 *     error — it must stay USED), AND
 *   - NO other diagnostic is allowed (any error that is not an expected TS2578 on an idiom-1 line
 *     — e.g. unrelated `src/**` compile breakage — is rejected, so it cannot false-green the proof).
 *
 * Directive lines are found by SCANNING `permissive-proof.ts` for the `[idiom-1]`/`[idiom-2]`
 * markers — never hard-coded line numbers — so editing the fixture (adding cases) needs no edits here.
 *
 * The pure `evaluateGuard` function is exercised against SIMULATED diagnostic blobs (REQ-03.1 /
 * REQ-03.2) and then run LIVE via `spawnSync(tsc)`.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const PROOF_FILE = join(PROJECT_ROOT, "test/types/permissive-proof.ts");
const PROOF_FILE_REL = "test/types/permissive-proof.ts";

interface Diagnostic {
  file: string;
  line: number;
  col: number;
  code: string;
}

// Parses tsc `--pretty false` output: lines of the form
//   path/to/file.ts(LINE,COL): error TSxxxx: message
// Lines that are continuations of a multi-line message (no leading `file(line,col):`) are ignored.
// The file group is anchored to end in `.ts(` specifically (not just the nearest paren) so a
// file path that itself contains a literal `(digit,digit):`-shaped substring cannot shift where
// the location group starts.
function parseDiagnostics(blob: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const pattern = /^(.+\.ts)\((\d+),(\d+)\): error (TS\d+):/;
  for (const raw of blob.split("\n")) {
    const m = pattern.exec(raw);
    if (m === null) continue;
    out.push({ file: m[1]!, line: Number(m[2]), col: Number(m[3]), code: m[4]! });
  }
  return out;
}

// Returns the 1-based line numbers of every `@ts-expect-error [<marker>]` directive in `source`.
// TS reports TS2578 on the directive's own line, so these are the lines the guard reasons about.
function findDirectiveLines(source: string, marker: "idiom-1" | "idiom-2"): number[] {
  const needle = `@ts-expect-error [${marker}]`;
  const lines: number[] = [];
  source.split("\n").forEach((text, i) => {
    if (text.includes(needle)) lines.push(i + 1);
  });
  return lines;
}

interface GuardResult {
  ok: boolean;
  reasons: string[];
}

// Pure decision over a parsed diagnostic set. `fileMatch` scopes which diagnostics belong to the
// proof fixture (so an unrelated `src/**` error is still SEEN — and rejected — not silently dropped).
function evaluateGuard(args: {
  diagnostics: Diagnostic[];
  idiom1Lines: number[];
  idiom2Lines: number[];
  fileMatch: (file: string) => boolean;
}): GuardResult {
  const { diagnostics, idiom1Lines, idiom2Lines, fileMatch } = args;
  const reasons: string[] = [];

  const is2578OnLine = (line: number): boolean =>
    diagnostics.some((d) => d.code === "TS2578" && d.line === line && fileMatch(d.file));

  // 1. Every idiom-1 directive must be UNUSED → TS2578 present.
  for (const line of idiom1Lines) {
    if (!is2578OnLine(line)) {
      reasons.push(`expected TS2578 (unused @ts-expect-error) on idiom-1 line ${line}, but it was absent`);
    }
  }

  // 2. Every idiom-2 directive must be USED → TS2578 absent.
  for (const line of idiom2Lines) {
    if (is2578OnLine(line)) {
      reasons.push(
        `idiom-2 directive on line ${line} became UNUSED (TS2578) — the negative type proof regressed (a rejected case now compiles)`
      );
    }
  }

  // 3. No unexpected diagnostics: the only acceptable error is TS2578 on an idiom-1 line.
  //    Anything else (a TS2578 on a non-idiom-1 line, or any non-TS2578 code anywhere) is rejected,
  //    so unrelated src/** breakage cannot masquerade as the proof passing.
  const idiom1Set = new Set(idiom1Lines);
  for (const d of diagnostics) {
    const expected = d.code === "TS2578" && idiom1Set.has(d.line) && fileMatch(d.file);
    if (!expected) {
      reasons.push(`unexpected diagnostic ${d.code} at ${d.file}(${d.line},${d.col}) — not an expected idiom-1 TS2578`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

const proofSource = readFileSync(PROOF_FILE, "utf-8");
const idiom1Lines = findDirectiveLines(proofSource, "idiom-1");
const idiom2Lines = findDirectiveLines(proofSource, "idiom-2");
// Match by path suffix so absolute/relative tsc paths both resolve to the proof fixture —
// but require a real path-segment boundary (start-of-string or a preceding `/`), not a bare
// `endsWith`, so a different file whose name merely SHARES that trailing substring (e.g.
// `vendor/xtest/types/permissive-proof.ts`) cannot collide with the real fixture path
// (theoretical, but cheap to close).
const fileMatch = (file: string): boolean => {
  const normalized = file.replace(/\\/g, "/");
  return normalized === PROOF_FILE_REL || normalized.endsWith(`/${PROOF_FILE_REL}`);
};

describe("S-03 — permissive-proof CI guard (REQ-03)", () => {
  it("the fixture exposes the expected idiom markers", () => {
    expect(idiom1Lines.length).toBe(1);
    expect(idiom2Lines.length).toBe(3);
  });

  it("LIVE — the real permissive-proof diagnostics satisfy the guard", () => {
    const result = spawnSync(
      "bunx",
      ["tsc", "--noEmit", "-p", "tsconfig.permissive-proof.json", "--pretty", "false"],
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    // Distinguish a broken toolchain (spawn ENOENT, tsc absent) from a real proof regression:
    // without this, a failed spawn yields an empty blob → "TS2578 absent on idiom-1", masking the
    // environment error as a proof failure.
    expect(result.error).toBeUndefined();
    // tsc writes diagnostics to stdout; combine defensively.
    const blob = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(blob.trim().length).toBeGreaterThan(0);
    const diagnostics = parseDiagnostics(blob);
    const verdict = evaluateGuard({ diagnostics, idiom1Lines, idiom2Lines, fileMatch });
    expect(verdict.reasons).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  // REQ-03.1 — a deliberate over-permissive regression flips the guard RED.
  // Simulate: the create<S> overload relaxed so excess is legal → the [idiom-2] excess directive
  // becomes UNUSED → tsc emits TS2578 on it. The idiom-1 TS2578 still fires. Both simulated lines
  // are derived from the real fixture's directive positions (idiom1Lines[0]/idiom2Lines[0]), not
  // hardcoded — a fixture edit that shifts these lines can't silently stale this proof.
  it("[red-proof] REQ-03.1 — an over-permissive regression (idiom-2 directive gone unused) is REJECTED", () => {
    const regressedBlob = [
      `${PROOF_FILE_REL}(${idiom1Lines[0]},3): error TS2578: Unused '@ts-expect-error' directive.`,
      `${PROOF_FILE_REL}(${idiom2Lines[0]},3): error TS2578: Unused '@ts-expect-error' directive.`,
    ].join("\n");
    const diagnostics = parseDiagnostics(regressedBlob);
    const verdict = evaluateGuard({ diagnostics, idiom1Lines, idiom2Lines, fileMatch });
    expect(verdict.ok).toBe(false);
    expect(
      verdict.reasons.some((r) => r.includes(`line ${idiom2Lines[0]}`) && r.includes("regressed"))
    ).toBe(true);
  });

  // REQ-03.2 — an unrelated compile error is NOT counted as the proof passing.
  // Simulate: the expected idiom-1 TS2578 fires AND an unrelated TS2304 (cannot find name) appears
  // in src/. The old "any non-zero exit = pass" rule would green this; the guard rejects it.
  it("[red-proof] REQ-03.2 — an unrelated src/** compile error is NOT counted as passing", () => {
    const unrelatedBlob = [
      `${PROOF_FILE_REL}(${idiom1Lines[0]},3): error TS2578: Unused '@ts-expect-error' directive.`,
      `src/commons/index.ts(10,5): error TS2304: Cannot find name 'Frobnicate'.`,
    ].join("\n");
    const diagnostics = parseDiagnostics(unrelatedBlob);
    const verdict = evaluateGuard({ diagnostics, idiom1Lines, idiom2Lines, fileMatch });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.some((r) => r.includes("TS2304"))).toBe(true);
  });

  // Positive control: the exact clean diagnostic set (idiom-1 TS2578 only) is ACCEPTED.
  it("[red-proof] the clean expected diagnostic set (idiom-1 TS2578 only) is ACCEPTED", () => {
    const cleanBlob = `${PROOF_FILE_REL}(${idiom1Lines[0]},3): error TS2578: Unused '@ts-expect-error' directive.`;
    const diagnostics = parseDiagnostics(cleanBlob);
    const verdict = evaluateGuard({ diagnostics, idiom1Lines, idiom2Lines, fileMatch });
    expect(verdict.reasons).toEqual([]);
    expect(verdict.ok).toBe(true);
  });
});
