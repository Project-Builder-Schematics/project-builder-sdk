/**
 * REQ-FIT-09 (file: fit-10-*.test.ts — 10th fitness file; fit-09 is already claimed by
 * fit-09-pkg-exports-resolution.test.ts, which tests REQ-PKG-01. Cite REQ-FIT-09, never
 * "REQ-FIT-10" — see spec cross-cutting note 1).
 *
 * No module under src/** OUTSIDE src/core may name `EngineClient` or call a
 * `.emit(`/`.commit(`/`.discard(` site reachable from it — the port stays behind src/core.
 *
 * Reachability gate: a file's `.emit(`/`.commit(`/`.discard(` call sites are only scanned
 * when the file textually references the `EngineClient` symbol first. This is what kills
 * the false positive of a bare EventEmitter `.emit(` call in a file that has nothing to do
 * with the port.
 *
 * Allow-list = exactly `test/support/contract-fake.ts` (the one legitimate EngineClient
 * implementer). A structural `implements EngineClient` exception was rejected at design time
 * (spoofable by a planted bypass); a path allow-list cannot be spoofed.
 *
 * `Directive`/`JsonValue` are data shapes, not the port — the scan never matches them.
 *
 * Red-proof: a planted-bypass string fixture (never a committed poisoned module) that
 * imports EngineClient and calls .emit(...) outside src/core is caught. [permanent-fixture]
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PROJECT_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SRC_ROOT = join(PROJECT_ROOT, "src");
const CORE_DIR = join(SRC_ROOT, "core");

const ALLOW_LISTED_PATH = "test/support/contract-fake.ts";

const ENGINE_CLIENT_PATTERN = /\bEngineClient\b/;
const PORT_CALL_PATTERN = /\.(emit|commit|discard)\(/g;

/**
 * Flags EngineClient port bleed in a single source file.
 * relPath is project-root-relative, forward-slash (e.g. "src/commons/index.ts").
 */
function scanPortBleed(source: string, relPath: string): string[] {
  if (relPath === ALLOW_LISTED_PATH) {
    return [];
  }

  if (!ENGINE_CLIENT_PATTERN.test(source)) {
    return [];
  }

  const violations: string[] = [`names EngineClient port symbol outside src/core: ${relPath}`];

  for (const match of source.matchAll(PORT_CALL_PATTERN)) {
    violations.push(`port call site: ${match[0]} (${relPath})`);
  }

  return violations;
}

function toRelPath(filePath: string): string {
  return filePath.replace(PROJECT_ROOT, "").replace(/^\//, "");
}

/** Collects .ts files under dir, recursively, excluding CORE_DIR entirely. */
function collectTsOutsideCore(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full === CORE_DIR) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectTsOutsideCore(full));
    } else if (extname(full) === ".ts") {
      files.push(full);
    }
  }
  return files;
}

describe("REQ-FIT-09 [file: fit-10] — structural EngineClient port guard", () => {
  // RED-PROOF: a planted-bypass fixture outside src/core, importing EngineClient and
  // calling .emit(...), is caught. [permanent-fixture] — stays in the suite forever.
  it("[permanent-fixture] planted-bypass fixture importing EngineClient and calling .emit(...) is flagged", () => {
    const fixtureSource = `
import type { EngineClient } from "../core/engine-client.ts";

export async function bypass(client: EngineClient) {
  return client.emit({ protocolVersion: 1, force: false, instructions: [] });
}
`;
    const violations = scanPortBleed(fixtureSource, "src/sneaky/bypass.ts");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("EngineClient"))).toBe(true);
    expect(violations.some((v) => v.includes(".emit("))).toBe(true);
  });

  it("test/support/contract-fake.ts (real source) is allow-listed clean", () => {
    const source = readFileSync(join(PROJECT_ROOT, ALLOW_LISTED_PATH), "utf-8");
    const violations = scanPortBleed(source, ALLOW_LISTED_PATH);
    expect(violations).toEqual([]);
  });

  it("a bare .emit( call with no EngineClient reference is not scanned (kills the EventEmitter false positive)", () => {
    const fixtureSource = `
import { EventEmitter } from "node:events";

export function ping(emitter: EventEmitter) {
  emitter.emit("ready");
}
`;
    const violations = scanPortBleed(fixtureSource, "src/telemetry/ping.ts");
    expect(violations).toEqual([]);
  });

  // Characterization: Directive/JsonValue are data shapes, not the port — the scan is
  // scoped to the literal `EngineClient` symbol only, so this passes without further
  // production code (an emergent property of the gate above, not a separate mechanism).
  it("a fixture importing only Directive/JsonValue types is not flagged", () => {
    const fixtureSource = `
import type { Directive, JsonValue } from "../core/wire.ts";

export function describe(directive: Directive): JsonValue {
  return directive as unknown as JsonValue;
}
`;
    const violations = scanPortBleed(fixtureSource, "src/dry-run/plan.ts");
    expect(violations).toEqual([]);
  });

  describe("production scan — src/** outside src/core", () => {
    // Characterization: today's production sources hold no EngineClient reference at all
    // outside src/core, so this passes without further production code.
    it("every file is free of EngineClient port bleed", () => {
      const files = collectTsOutsideCore(SRC_ROOT);
      const violations = files.flatMap((filePath) => {
        const relPath = toRelPath(filePath);
        const source = readFileSync(filePath, "utf-8");
        return scanPortBleed(source, relPath);
      });
      expect(violations).toEqual([]);
    });

    it("src/commons/index.ts and src/conformance/index.ts are included in the scan and pass clean", () => {
      const commonsPath = join(SRC_ROOT, "commons", "index.ts");
      const conformancePath = join(SRC_ROOT, "conformance", "index.ts");
      const scanned = collectTsOutsideCore(SRC_ROOT);

      expect(scanned).toContain(commonsPath);
      expect(scanned).toContain(conformancePath);

      for (const filePath of [commonsPath, conformancePath]) {
        const source = readFileSync(filePath, "utf-8");
        expect(scanPortBleed(source, toRelPath(filePath))).toEqual([]);
      }
    });
  });
});
