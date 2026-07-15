/**
 * REQ-FIT-09 (file: fit-10-*.test.ts — 10th fitness file; fit-09 is already claimed by
 * fit-09-pkg-exports-resolution.test.ts, which tests REQ-PKG-01. Cite REQ-FIT-09, never
 * "REQ-FIT-10" — see spec cross-cutting note 1).
 *
 * No module under src/** OUTSIDE src/core may name `EngineClient` or call a
 * `.emit(`/`.commit(`/`.discard(` site reachable from it — the port stays behind src/core.
 * emit-rejection-metadata REQ-ERM-02 extends the same structural guard to the
 * `EmitRejection` identifier: it is port-internal (ADR-0022), so no module outside
 * src/core may name it either, except the allow-listed fake's import.
 *
 * Reachability gate: a file's `.emit(`/`.commit(`/`.discard(` call sites are only scanned
 * when the file textually references the `EngineClient` symbol first. This is what kills
 * the false positive of a bare EventEmitter `.emit(` call in a file that has nothing to do
 * with the port.
 *
 * Allow-list (ADR-01, stdio-engine-client change): `src/testing/contract-fake.ts` (REQ-TES-07,
 * post-relocation ADR-0035 — the original legitimate `EngineClient` implementer / `EmitRejection`
 * thrower) PLUS `src/transport/stdio-engine-client.ts` — the first REAL `EngineClient`
 * implementer, extending the allow-list by EXACTLY one path. A structural `implements
 * EngineClient` exception was rejected at design time (spoofable by a planted bypass); a path
 * allow-list cannot be spoofed. The facade `src/testing/index.ts` is explicitly RULED OFF this
 * allow-list — it must achieve its spy-wrapping via a local structural type, never by naming
 * `EngineClient`/`EmitRejection`.
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

const ALLOW_LISTED_PATHS: readonly string[] = ["src/testing/contract-fake.ts", "src/transport/stdio-engine-client.ts"];

const PORT_SYMBOL_PATTERN = /\b(?:EngineClient|EmitRejection)\b/;
const PORT_CALL_PATTERN = /\.(emit|commit|discard)\(/g;

/**
 * Flags port-symbol bleed (EngineClient or EmitRejection) in a single source file.
 * relPath is project-root-relative, forward-slash (e.g. "src/commons/index.ts").
 */
function scanPortBleed(source: string, relPath: string): string[] {
  if (ALLOW_LISTED_PATHS.includes(relPath)) {
    return [];
  }

  if (!PORT_SYMBOL_PATTERN.test(source)) {
    return [];
  }

  const violations: string[] = [`names port symbol (EngineClient/EmitRejection) outside src/core: ${relPath}`];

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

  // RED-PROOF (REQ-ERM-02.1): a planted-bypass fixture importing EmitRejection outside
  // src/core is flagged too — the guard extends to the port-internal rejection type, not
  // just EngineClient. [permanent-fixture]
  it("[permanent-fixture] planted-bypass fixture importing EmitRejection outside src/core is flagged", () => {
    const fixtureSource = `
import { EmitRejection } from "../core/emit-rejection.ts";

export function bypass(): never {
  throw new EmitRejection("collision", "boom");
}
`;
    const violations = scanPortBleed(fixtureSource, "src/sneaky/emit-rejection-bypass.ts");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("EmitRejection"))).toBe(true);
  });

  it("src/testing/contract-fake.ts (real source) is allow-listed clean", () => {
    const relPath = "src/testing/contract-fake.ts";
    const source = readFileSync(join(PROJECT_ROOT, relPath), "utf-8");
    const violations = scanPortBleed(source, relPath);
    expect(violations).toEqual([]);
  });

  // ADR-01 (stdio-engine-client change): the FIT-10 allow-list is widened by EXACTLY one
  // path — the first real EngineClient implementer.
  it("src/transport/stdio-engine-client.ts (real source) is allow-listed clean", () => {
    const relPath = "src/transport/stdio-engine-client.ts";
    const source = readFileSync(join(PROJECT_ROOT, relPath), "utf-8");
    const violations = scanPortBleed(source, relPath);
    expect(violations).toEqual([]);
  });

  // RED-PROOF (ADR-01): the widened list is a PATH allow-list, not a directory exemption —
  // an unrelated file inside src/transport/ that names EngineClient is still caught.
  it("[red-proof] ADR-01: an unrelated file inside src/transport/ naming EngineClient is still caught", () => {
    const fixtureSource = `
import type { EngineClient } from "../core/engine-client.ts";

export async function bypass(client: EngineClient) {
  return client.emit({ protocolVersion: 1, force: false, instructions: [] });
}
`;
    const violations = scanPortBleed(fixtureSource, "src/transport/sneaky-bypass.ts");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("EngineClient"))).toBe(true);
    expect(violations.some((v) => v.includes(".emit("))).toBe(true);
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
    // Single tree walk, shared by both tests below.
    const files = collectTsOutsideCore(SRC_ROOT);

    // Characterization: today's production sources hold no EngineClient reference at all
    // outside src/core, so this passes without further production code.
    it("every file is free of EngineClient port bleed", () => {
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

      // Cleanliness for these two paths is already proven above (they're members of
      // `files`, which the prior test scanned in full) — this test only pins membership.
      expect(files).toContain(commonsPath);
      expect(files).toContain(conformancePath);
    });
  });

  describe("REQ-TES-07 — allow-list transition post fake relocation", () => {
    it("REQ-TES-07.1 (ADR-01 amendment): the allow-list is exactly these two paths", () => {
      expect(ALLOW_LISTED_PATHS).toEqual(["src/testing/contract-fake.ts", "src/transport/stdio-engine-client.ts"]);
    });

    // RED-PROOF (REQ-TES-07.2): the facade is NOT on the allow-list — naming EngineClient
    // there is caught, same as any other non-allow-listed src/** file.
    it("[red-proof] REQ-TES-07.2: src/testing/index.ts naming EngineClient is caught", () => {
      const fixtureSource = `
import type { EngineClient } from "../core/engine-client.ts";

export function makeClient(): EngineClient {
  throw new Error("not implemented");
}
`;
      const violations = scanPortBleed(fixtureSource, "src/testing/index.ts");
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes("EngineClient"))).toBe(true);
    });

    // RED-PROOF (REQ-TES-07.3): a bleed in an unrelated src/** file (never the
    // allow-listed path) is still caught post-transition — the widened path did not become
    // a directory- or module-level exemption.
    it("[red-proof] REQ-TES-07.3: a bleed in an unrelated src/** file is still caught post-transition", () => {
      const fixtureSource = `
import { EngineClient } from "../core/engine-client.ts";

export async function bypass(client: EngineClient) {
  return client.emit({ protocolVersion: 1, force: false, instructions: [] });
}
`;
      const violations = scanPortBleed(fixtureSource, "src/testing/helpers.ts");
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes("EngineClient"))).toBe(true);
      expect(violations.some((v) => v.includes(".emit("))).toBe(true);
    });
  });
});
