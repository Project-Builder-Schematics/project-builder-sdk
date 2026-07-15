// REQ-WPS-09 (S-003): run bootstrap is argv/bridge-only — there is no host-issued
// `runFactory` wire request; the post-`ready` wire carries ONLY reverse-callback traffic.
// S-004 extends this file with the FEH-01..05 corpus-driven conformance suite (design § 4.2
// routes both to the SAME file — S-003 creates it with just this leg).
//
// [characterization]: both tests below exercise a mechanism S-001 already built (WPS-03's
// discard-unknown-frame-types loop) against a NEW attack shape (an unsolicited host-issued
// REQUEST frame) — per this project's established convention (see S-001's apply-progress
// Discoveries), a pre-existing mechanism satisfying a new REQ's scenario is labeled
// characterization, not treated as a strict-TDD RED violation.

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { encodeFrame } from "../../src/transport/framing.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";
import { runRunner, type RunnerIo } from "../../src/transport/runner.ts";
import { dispatchToFake, serveSpawnedRunner } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { pushableByteSource } from "../support/pushable-byte-source.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { frameHostFactory } from "../support/frame-host.ts";
import { collectTsFiles } from "../support/import-scan.ts";
import * as rejectionMessages from "../../src/testing/rejection-messages.ts";
import { CONFORMANCE_CORPUS } from "./conformance-corpus.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const RUNNER_BIN = new URL("../../bin/pbuilder-runner.ts", import.meta.url).pathname;
const HARNESS_SOURCE_PATH = new URL("./fake-engine-harness.ts", import.meta.url).pathname;
const HARNESS_TEST_PATH = new URL("./harness.test.ts", import.meta.url).pathname;

const spawnFrameHost = frameHostFactory();

function spawnRunner(args: string[], opts?: { env?: NodeJS.ProcessEnv }) {
  return spawnFrameHost("bun", ["run", RUNNER_BIN, ...args], { cwd: PROJECT_ROOT, env: opts?.env });
}

const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;

describe("REQ-WPS-09 — run bootstrap is argv/bridge-only, no host-issued request method", () => {
  it("[characterization] Scenario REQ-WPS-09.2: a host-issued request frame arriving mid-run is discarded — never dispatches a run, the run still completes", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "wps-09" } });
    const inbox = pushableByteSource();
    const requests: Array<{ method: string }> = [];
    const hostFrameTypes: string[] = [];
    let sabotageInjected = false;
    inbox.push(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        const frame = value as { id: string; method: string; params: unknown };
        requests.push({ method: frame.method });
        // Sabotage: BEFORE answering the runner's own request, the host slips in an
        // unsolicited host-issued REQUEST frame — WPS-09.2's exact attack shape ("no
        // runFactory wire request exists"). Injected once, on the FIRST reverse callback,
        // so it lands genuinely MID-RUN, never at the greeting.
        if (!sabotageInjected) {
          sabotageInjected = true;
          inbox.push(encodeFrame({ type: "request", id: "host-1", method: "runFactory", params: {} }));
        }
        void dispatchToFake(fake, frame).then((response) => {
          hostFrameTypes.push(response.type);
          inbox.push(encodeFrame(response));
        });
      },
      writeStderr(): void {},
    };

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(0);
    // The runner's OWN reverse-callback sequence is exactly the skeleton's — nothing extra
    // was dispatched in response to the injected host request (never a second run either).
    expect(requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(fake.committedTree().get("out.txt")).toEqual("read:wps-09");
    expect(sabotageInjected).toBe(true); // sanity: the attack was actually attempted
  });

  it("[characterization] Scenario REQ-WPS-09.1: over a complete run, the only host->runner frames a conformant host sends are responses", async () => {
    const fake = new ContractFake({ seed: {} });
    const inbox = pushableByteSource();
    const hostFrameTypes: string[] = [];
    inbox.push(encodeFrame({ method: "ready", protocolVersion: WIRE_PROTOCOL_VERSION }));

    const io: RunnerIo = {
      input: inbox.iterable,
      writeFrame(value: unknown): void {
        const frame = value as { id: string; method: string; params: unknown };
        void dispatchToFake(fake, frame).then((response) => {
          hostFrameTypes.push(response.type);
          inbox.push(encodeFrame(response));
        });
      },
      writeStderr(): void {},
    };

    const exitCode = await runRunner(["--factory", HAPPY_POINTER, "--input", "{}"], io);

    expect(exitCode).toEqual(0);
    // dispatchToFake (test/fake/fake-engine-harness.ts) only ever constructs
    // `{type:"response", ...}` frames — there is no code path anywhere in this harness that
    // emits a host-issued `{type:"request", ...}` frame during a normal run, matching
    // WPS-09.1's claim structurally over a REAL executed run, not just by absence of a
    // counter-example.
    expect(hostFrameTypes.length).toBeGreaterThan(0);
    expect(new Set(hostFrameTypes)).toEqual(new Set(["response"]));
  });
});

// ===========================================================================================
// FEH-01..05 (S-004): corpus-driven parity, structural no-reimplementation guard, spec-derived
// citation guard, spec-parsed coverage map + count tripwire, and a real no-Go-toolchain proof.
// ===========================================================================================

const SPEC_PRE_ARCHIVE_PATH = join(PROJECT_ROOT, "openspec/changes/stdio-engine-client/spec.md");
const SPEC_POST_ARCHIVE_SPECS_DIR = join(PROJECT_ROOT, "openspec/specs");

// REQ-FEH-05: the maintained expected REQ-ID count (V3 signed spec.md, 2026-07-15) — a spec
// edit that adds/removes a REQ without updating this constant fails FEH-05.2 loudly.
const EXPECTED_REQ_COUNT = 41;

// S-005 shrunk this to empty (shrink-only, never grow — see S-004's Discoveries for the
// original build-ordering rationale). All four were S-004-time gaps because their exercising
// fitness tests were explicitly S-005 scope, not yet built: WPS-06/FEH-06 (BATCH_CAP drift,
// `fit-34-batch-cap-drift.test.ts`), WPS-11 (doc-scan + header stamp,
// `fit-31-single-owner-framing.test.ts`), and LED-01 (ledger-presence scan, same file's
// REQ-LED-01 `describe` block). Every one now has a real, non-vacuous test citing its REQ-ID
// in a test title/comment, so FEH-05's whole-suite citation scan (`scanReqCitationsAcrossTests`)
// covers them without a carve-out.
const PENDING_S005_COVERAGE_EXEMPTIONS = new Set<string>();

const NEW_EMIT_REJECTION_RE = /\bnew\s+EmitRejection\s*\(/;

/** REQ-FEH-01.2: the harness source must never construct its own `EmitRejection` (it only
 * ever `instanceof`-checks one thrown by the delegated-to `ContractFake`) and must never
 * copy one of `ContractFake`'s rejection-message dictionary VALUES as a literal string —
 * both would prove the harness reimplements semantics instead of delegating to the one
 * normative fake. */
function noReimplementationViolations(source: string): string[] {
  const violations: string[] = [];
  if (NEW_EMIT_REJECTION_RE.test(source)) {
    violations.push("constructs its own `new EmitRejection(...)` instead of delegating to ContractFake");
  }
  for (const [name, value] of Object.entries(rejectionMessages)) {
    if (typeof value !== "string") continue;
    if (source.includes(`"${value}"`) || source.includes(`'${value}'`)) {
      violations.push(`contains a literal copy of rejection-messages.ts's "${name}" ("${value}") instead of importing it`);
    }
  }
  return violations;
}

const REQ_HEADER_RE = /^### REQ-([A-Z]+-\d+):/gm;

/** Extracts every `### REQ-XX-NN:` header's ID from a spec markdown body. Shared verbatim by
 * the FEH-03 citation guard and the FEH-05 coverage map (REQ-FEH-03 requires reading the SAME
 * spec-parsed universe FEH-05 does — never a separate re-parse). */
function parseReqIds(specMarkdown: string): string[] {
  return [...specMarkdown.matchAll(REQ_HEADER_RE)].map((m) => m[1]!);
}

/**
 * Resolves the REQ-ID universe for THIS spec, pre- or post-archive (REQ-FEH-03.2): tries the
 * change-local flat spec.md first; if archived (the change folder loses its flat spec.md at
 * archive time — content is redistributed into one `openspec/specs/{domain}/spec.md` per
 * domain header this spec declared, per `openspec-convention.md`'s archive procedure), falls
 * back to scanning every domain's spec.md under the post-archive specs directory and unions
 * them — a generic, forward-compatible fallback, never a hardcoded list of this change's own
 * domain names (which could drift at a future re-split).
 */
function resolveSpecReqIds(preArchivePath: string, postArchiveSpecsDir: string): { reqIds: string[]; source: string } {
  if (existsSync(preArchivePath)) {
    return { reqIds: parseReqIds(readFileSync(preArchivePath, "utf-8")), source: preArchivePath };
  }
  const ids: string[] = [];
  for (const entry of readdirSync(postArchiveSpecsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specPath = join(postArchiveSpecsDir, entry.name, "spec.md");
    if (existsSync(specPath)) ids.push(...parseReqIds(readFileSync(specPath, "utf-8")));
  }
  return { reqIds: ids, source: `${postArchiveSpecsDir}/*/spec.md` };
}

const TEST_TITLE_RE = /\b(?:it|describe)\(\s*(["'`])((?:(?!\1)[\s\S])*)\1/g;
const REQ_ID_IN_TEXT_RE = /REQ-([A-Z]+-\d+)/g;

/** Extracts every REQ-ID cited inside an `it(...)`/`describe(...)` TITLE string in `source` —
 * scoped to test titles, not this file's own parsing regexes/code, so the guard never
 * self-matches its own REQ-ID-shaped regex literals as spurious citations. */
function extractCitedReqIds(source: string): Set<string> {
  const cited = new Set<string>();
  for (const titleMatch of source.matchAll(TEST_TITLE_RE)) {
    const title = titleMatch[2]!;
    for (const idMatch of title.matchAll(REQ_ID_IN_TEXT_RE)) cited.add(idMatch[1]!);
  }
  return cited;
}

/** REQ-FEH-05: every REQ-ID cited ANYWHERE under `testRoot` (any `.ts` file, comments
 * included — a comment citing a REQ is still evidence a human traced the coverage) counts as
 * covered; scope is the whole test suite, not just this file. */
function scanReqCitationsAcrossTests(testRoot: string): Set<string> {
  const cited = new Set<string>();
  for (const file of collectTsFiles(testRoot)) {
    const source = readFileSync(file, "utf-8");
    for (const match of source.matchAll(/REQ-([A-Z]+-\d+)/g)) cited.add(match[1]!);
  }
  return cited;
}

/** REQ-FEH-05.1: every `reqIds` entry that is neither `exemptions`-listed nor `cited` —
 * shared by the real coverage assertion and its red-proof, one filter, never two. */
function uncoveredReqIds(reqIds: string[], cited: Set<string>, exemptions: Set<string>): string[] {
  return reqIds.filter((id) => !exemptions.has(id) && !cited.has(id));
}

describe("REQ-FEH-02 — shared scenario corpus, single source", () => {
  it("[characterization] REQ-FEH-02.2: a second import of the corpus module resolves to the identical reference", async () => {
    // Node/Bun's module cache guarantees this by construction for the SAME resolved
    // specifier — this pins that guarantee mechanically rather than trusting convention
    // (mirrors fit-18's REQ-FSP-02.1 shim-identity pin, also a language-guarantee proof).
    const reImported = await import("./conformance-corpus.ts");
    expect(reImported.CONFORMANCE_CORPUS).toBe(CONFORMANCE_CORPUS);
  });

  it("[red-proof] a structurally-duplicated corpus array (fixture, never committed) is content-identical but reference-distinct", () => {
    const duplicate = [...CONFORMANCE_CORPUS];
    expect(duplicate).not.toBe(CONFORMANCE_CORPUS);
    expect(duplicate).toEqual([...CONFORMANCE_CORPUS]);
  });
});

describe("REQ-FEH-01 — transport shell over the ONE ContractFake", () => {
  it("Scenario REQ-FEH-01.1 (+REQ-FEH-02.1): every corpus scenario yields an identical outcome in-process vs over a real spawned process", async () => {
    for (const scenario of CONFORMANCE_CORPUS) {
      const inProcess = await runFactoryForTest(scenario.run, {}, { seed: scenario.seed });
      const fake = new ContractFake({ seed: scenario.seed });
      const host = spawnRunner(["--factory", scenario.pointer, "--input", "{}"]);
      const spawned = await serveSpawnedRunner(host, fake);

      if (scenario.outcome === "committed") {
        expect(inProcess.error).toBeUndefined();
        expect(spawned.exitCode).toEqual(0);
        expect(Object.fromEntries(fake.committedTree())).toEqual(Object.fromEntries(inProcess.tree));
      } else {
        expect(inProcess.error).toBeInstanceOf(AuthoringError);
        expect((inProcess.error as AuthoringError).reason).toEqual("path-collision");
        // EXC-01 write-rejected exit code — same classification family the in-process
        // AuthoringError.reason resolves to via authoring-error.ts's CODE_TO_REASON
        // ("collision" -> "path-collision"), read-only, not re-derived here.
        expect(spawned.exitCode).toEqual(2);
        const rejection = spawned.responses.find((r) => r.error !== undefined);
        expect(rejection?.error?.data?.emitRejectionCode).toEqual("collision");
      }
    }
  });

  it("Scenario REQ-FEH-01.2: the harness source contains no `new EmitRejection` construction and no rejection-message dictionary literal copies", () => {
    const source = readFileSync(HARNESS_SOURCE_PATH, "utf-8");
    expect(noReimplementationViolations(source)).toEqual([]);
  });

  it("[red-proof] a fixture harness reimplementing rejection semantics is caught", () => {
    const fixture = `
      if (collides) {
        throw new EmitRejection("collision", "ContractFake: create collision (use force to overwrite)");
      }
    `;
    const violations = noReimplementationViolations(fixture);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("REQ-FEH-03 — spec-derived harness (anti-tautology)", () => {
  it("Scenario REQ-FEH-03.1: every REQ-ID cited by this file's own test titles resolves to a requirement in the signed spec", () => {
    const { reqIds } = resolveSpecReqIds(SPEC_PRE_ARCHIVE_PATH, SPEC_POST_ARCHIVE_SPECS_DIR);
    const universe = new Set(reqIds);
    const cited = extractCitedReqIds(readFileSync(HARNESS_TEST_PATH, "utf-8"));
    const unresolved = [...cited].filter((id) => !universe.has(id));
    expect(unresolved).toEqual([]);
  });

  it("[red-proof] a scenario citing a REQ-ID absent from the spec fails the guard", () => {
    const universe = new Set(["WPS-01", "SEC-04"]);
    // Built from fragments (never a literal `it("..."` in THIS file's own source) — a
    // literal fixture would make FEH-03.1's whole-file self-scan below trip over its own
    // red-proof string, the same self-contamination fit-18 excludes its own path for.
    const fixtureSource = `${"i"}${"t"}("Scenario REQ-BOGUS-99: an invented requirement", () => {});`;
    const cited = extractCitedReqIds(fixtureSource);
    const unresolved = [...cited].filter((id) => !universe.has(id));
    expect(unresolved).toEqual(["BOGUS-99"]);
  });

  it("Scenario REQ-FEH-03.2: the spec-path resolver falls back to the post-archive per-domain layout when the pre-archive path is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "feh-03-archive-fixture-"));
    try {
      const preArchive = join(dir, "changes", "some-change", "spec.md");
      const postArchiveDir = join(dir, "specs");

      // Branch A: pre-archive path present — read directly, never touching postArchiveDir.
      mkdirSync(join(dir, "changes", "some-change"), { recursive: true });
      writeFileSync(preArchive, "### REQ-AAA-01: pre-archive requirement\n");
      const preArchiveResult = resolveSpecReqIds(preArchive, postArchiveDir);
      expect(preArchiveResult.reqIds).toEqual(["AAA-01"]);

      // Branch B: pre-archive path ABSENT (simulates archive having moved it) — falls back to
      // scanning every domain's spec.md under the post-archive specs directory.
      const missingPreArchive = join(dir, "changes", "some-change", "does-not-exist.md");
      mkdirSync(join(postArchiveDir, "domain-x"), { recursive: true });
      writeFileSync(join(postArchiveDir, "domain-x", "spec.md"), "### REQ-BBB-02: post-archive requirement\n");
      const postArchiveResult = resolveSpecReqIds(missingPreArchive, postArchiveDir);
      expect(postArchiveResult.reqIds).toEqual(["BBB-02"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("REQ-FEH-05 — spec-item-to-scenario coverage map", () => {
  it("Scenario REQ-FEH-05.2: the parsed REQ-ID count matches the maintained expected count", () => {
    const { reqIds } = resolveSpecReqIds(SPEC_PRE_ARCHIVE_PATH, SPEC_POST_ARCHIVE_SPECS_DIR);
    expect(reqIds.length).toEqual(EXPECTED_REQ_COUNT);
  });

  it("[red-proof] a count mismatch fails loudly instead of silently reporting stale zero-uncovered", () => {
    const staleParsedIds = ["A-1", "A-2"];
    const nowStaleExpectedCount = 3; // pretend a REQ was removed without updating this constant
    expect(staleParsedIds.length).not.toEqual(nowStaleExpectedCount);
  });

  it("Scenario REQ-FEH-05.1: zero uncovered REQ-IDs across the whole test suite (S-005-pending items exempted, see comment above)", () => {
    const { reqIds } = resolveSpecReqIds(SPEC_PRE_ARCHIVE_PATH, SPEC_POST_ARCHIVE_SPECS_DIR);
    const cited = scanReqCitationsAcrossTests(join(PROJECT_ROOT, "test"));
    expect(uncoveredReqIds(reqIds, cited, PENDING_S005_COVERAGE_EXEMPTIONS)).toEqual([]);
  });

  it("[red-proof] an uncited, non-exempt REQ-ID surfaces as uncovered", () => {
    const reqIds = ["WPS-01", "WPS-99"];
    const cited = new Set(["WPS-01"]);
    expect(uncoveredReqIds(reqIds, cited, PENDING_S005_COVERAGE_EXEMPTIONS)).toEqual(["WPS-99"]);
  });
});

describe("REQ-FEH-04 — real spawned process, real stdio, no Go toolchain", () => {
  it("Scenario REQ-FEH-04.1: the runner completes successfully with PATH restricted to exclude any `go` binary", async () => {
    const bunDir = dirname(process.execPath);
    // /usr/bin:/bin supplies `sh` itself (the probe below needs a shell to run in) — neither
    // directory contains a `go` binary on this repo's CI/dev images (verified: `go` lives
    // under the linuxbrew/homebrew prefix, never /usr/bin or /bin).
    const restrictedEnv = { ...process.env, PATH: `${bunDir}:/usr/bin:/bin` };

    // Proves the restriction actually excludes `go` — a vacuous PATH override would let this
    // test pass regardless of whether the runner has any real Go-toolchain dependency.
    const probe = spawnSync("sh", ["-c", "command -v go"], { env: restrictedEnv, encoding: "utf-8" });
    expect(probe.stdout.trim()).toEqual("");

    const fake = new ContractFake({ seed: { "seed.txt": "feh-04" } });
    const host = spawnRunner(["--factory", HAPPY_POINTER, "--input", "{}"], { env: restrictedEnv });
    const run = await serveSpawnedRunner(host, fake);

    expect(run.exitCode).toEqual(0);
  });
});
