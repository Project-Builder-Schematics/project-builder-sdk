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
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
import { AuthoringError } from "../../src/bounded-contexts/authoring/domain/valueobjects/authoring-error.ts";
import { frameHostFactory } from "../support/frame-host.ts";
import { collectTsFiles } from "../support/import-scan.ts";
import * as rejectionMessages from "../../src/testing/rejection-messages.ts";
import { CONFORMANCE_CORPUS } from "./conformance-corpus.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const RUNNER_BIN = new URL("../../src/bin/pbuilder-runner.ts", import.meta.url).pathname;
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
// citation guard, coverage map, and a real no-Go-toolchain proof.
// ===========================================================================================

// The stdio-engine-client spec's REQ-IDs (wire protocol, exit codes, runner bin, bridge,
// client, harness). Adding or removing a requirement means editing this list.
const SPEC_REQ_IDS: readonly string[] = [
  "WPS-01", "WPS-02", "WPS-03", "WPS-04", "WPS-05", "WPS-06", "WPS-07", "WPS-08", "WPS-09", "WPS-10", "WPS-11",
  "EXC-01", "EXC-02",
  "RUN-01", "RUN-02", "RUN-03", "RUN-04", "RUN-05", "RUN-06", "RUN-07", "RUN-08", "RUN-09",
  "BRB-01", "BRB-02", "BRB-03",
  "SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05", "SEC-06", "SEC-07", "SEC-08", "SEC-09", "SEC-10",
  "FEH-01", "FEH-02", "FEH-03", "FEH-04", "FEH-05", "FEH-06",
];

// S-005 shrunk this to empty (shrink-only, never grow — see S-004's Discoveries for the
// original build-ordering rationale). The S-004-time gaps were exercised by fitness tests
// built in S-005: WPS-06/FEH-06 (BATCH_CAP drift, `fit-34-batch-cap-drift.test.ts`) and
// WPS-11 (doc-scan + header stamp, `fit-31-single-owner-framing.test.ts`). Every one now has
// a real, non-vacuous test citing its REQ-ID in a test title, so FEH-05's whole-suite citation scan (`scanReqCitationsAcrossTests`)
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

/** REQ-FEH-05: every REQ-ID cited in an `it(...)`/`describe(...)` TITLE under `testRoot`
 * (any `.ts` file) counts as covered; scope is the whole test suite, not just this file.
 * TITLES ONLY (judgment-day R2): a comment citing a REQ is not evidence of an exercising
 * test — counting comments made the map satisfiable by annotation alone. Reuses
 * `extractCitedReqIds`, the same title-scoped extraction the FEH-03 citation guard runs. */
function scanReqCitationsAcrossTests(testRoot: string): Set<string> {
  const cited = new Set<string>();
  for (const file of collectTsFiles(testRoot)) {
    for (const id of extractCitedReqIds(readFileSync(file, "utf-8"))) cited.add(id);
  }
  return cited;
}

/** REQ-FEH-05.1: every `reqIds` entry that is neither `exemptions`-listed nor `cited` —
 * shared by the real coverage assertion and its red-proof, one filter, never two. */
function uncoveredReqIds(reqIds: readonly string[], cited: Set<string>, exemptions: Set<string>): string[] {
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
        // EXC-01 write-rejected exit code — same classification family the in-process
        // AuthoringError.reason resolves to via authoring-error.ts's CODE_TO_REASON
        // (e.g. "collision" -> "path-collision", "cap" -> "changes-too-large"), read-only,
        // not re-derived here.
        expect({ id: scenario.id, reason: (inProcess.error as AuthoringError).reason }).toEqual({
          id: scenario.id,
          reason: scenario.rejection!.reason,
        });
        expect({ id: scenario.id, exitCode: spawned.exitCode }).toEqual({ id: scenario.id, exitCode: 2 });
        if (scenario.rejection!.via === "local") {
          // The client refused BEFORE writing (REQ-WPS-04.1): the over-budget ir.emit
          // frame never crossed the wire — no ir.emit request, no error response.
          expect(spawned.requests.map((r) => r.method)).not.toContain("ir.emit");
          expect(spawned.responses.find((r) => r.error !== undefined)).toBeUndefined();
        } else {
          const rejection = spawned.responses.find((r) => r.error !== undefined);
          expect(rejection?.error?.data?.emitRejectionCode).toEqual(scenario.rejection!.via.wireCode);
        }
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
    const universe = new Set(SPEC_REQ_IDS);
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

});

describe("REQ-FEH-05 — spec-item-to-scenario coverage map", () => {
  it("Scenario REQ-FEH-05.1: zero uncovered REQ-IDs across the whole test suite (S-005-pending items exempted, see comment above)", () => {
    const cited = scanReqCitationsAcrossTests(join(PROJECT_ROOT, "test"));
    expect(uncoveredReqIds(SPEC_REQ_IDS, cited, PENDING_S005_COVERAGE_EXEMPTIONS)).toEqual([]);
  });

  it("[red-proof] an uncited, non-exempt REQ-ID surfaces as uncovered", () => {
    const reqIds = ["WPS-01", "WPS-99"];
    const cited = new Set(["WPS-01"]);
    expect(uncoveredReqIds(reqIds, cited, PENDING_S005_COVERAGE_EXEMPTIONS)).toEqual(["WPS-99"]);
  });

  it("[red-proof, judgment-day R2] a REQ-ID cited ONLY in a comment does NOT count as covered — coverage demands an exercising test TITLE", () => {
    const dir = mkdtempSync(join(tmpdir(), "feh-05-comment-only-"));
    try {
      // Built from fragments (never a literal `it("...REQ-..."` in THIS file's own source) —
      // a literal fixture would make FEH-03.1's whole-file self-scan trip over it, the same
      // self-contamination the FEH-03 red-proof above builds around.
      writeFileSync(
        join(dir, "comment-only.test.ts"),
        [
          "// REQ-ZZZ-42 is exercised here, honest! (a comment is not evidence)",
          `${"i"}${"t"}("a title citing no REQ at all", () => {});`,
          `${"i"}${"t"}("Scenario REQ-YYY-07: a genuinely title-cited requirement", () => {});`,
          "",
        ].join("\n")
      );
      const cited = scanReqCitationsAcrossTests(dir);
      expect(cited.has("YYY-07")).toBe(true);
      expect(cited.has("ZZZ-42")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("REQ-FEH-04 — real spawned process, real stdio, no Go toolchain", () => {
  it("Scenario REQ-FEH-04.1: the runner completes successfully with PATH restricted to exclude any `go` binary", async () => {
    const bunDir = dirname(process.execPath);
    // PATH carries ONLY bun's directory — the runner is spawned as bare `bun` and needs
    // nothing else. No system dirs may ride along: GitHub's CI image ships `go` at
    // /usr/bin/go (the dev image keeps it under the linuxbrew prefix), so any PATH wide
    // enough to supply a shell would smuggle the toolchain back in.
    const restrictedEnv = { ...process.env, PATH: bunDir };

    // Proves the restriction actually excludes `go` — a vacuous PATH override would let this
    // test pass regardless of whether the runner has any real Go-toolchain dependency. The
    // probe shell is invoked by absolute path, so it needs no PATH entry of its own.
    const probe = spawnSync("/bin/sh", ["-c", "command -v go"], { env: restrictedEnv, encoding: "utf-8" });
    expect(probe.stdout.trim()).toEqual("");

    const fake = new ContractFake({ seed: { "seed.txt": "feh-04" } });
    const host = spawnRunner(["--factory", HAPPY_POINTER, "--input", "{}"], { env: restrictedEnv });
    const run = await serveSpawnedRunner(host, fake);

    expect(run.exitCode).toEqual(0);
  });
});
