import { describe, it, expect } from "bun:test";
import { YAML } from "bun";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateRelease } from "../../scripts/validate-release.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const PUBLISH = "npm publish --registry=https://registry.npmjs.org --tag=latest --access=public --provenance --fetch-retries=0 --fetch-timeout=30000";
const ATTEMPT = `printf 'outcome=attempted\\n' >> "$GITHUB_OUTPUT"\n${PUBLISH}\nprintf 'outcome=command succeeded\\n' >> "$GITHUB_OUTPUT"`;
const SUMMARY = `printf 'Package: @pbuilder/sdk\\nVersion: %s\\nSHA: %s\\nRegistry: https://registry.npmjs.org\\nChannel: latest\\nOutcome: %s\\nRegistry confirmation: owner verification pending\\n' "$RELEASE_VERSION" "$GITHUB_SHA" "$PUBLISH_OUTCOME" >> "$GITHUB_STEP_SUMMARY"`;
const ALLOWED = new Set([
  "bun install --frozen-lockfile", "bun run build", "bun test", "bun run typecheck",
  "bun scripts/validate-release.ts", ATTEMPT, SUMMARY,
]);

const SOURCE_PACKAGE = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const PACKAGE = { ...SOURCE_PACKAGE, version: "0.3.0" };
const ABSENT = (async () => new Response(JSON.stringify("version not found: 0.3.0"), { status: 404 })) as typeof fetch;

describe("release validator", () => {
  it("accepts a stable unchanged release with an absent registry version", async () => {
    const before = JSON.stringify(PACKAGE);
    expect(await validateRelease(PACKAGE, "## 0.3.0\n", {}, ABSENT).catch(() => "blocked")).toBe("0.3.0");
    expect(JSON.stringify(PACKAGE)).toBe(before);
  });
  it.each([
    ["name", { ...PACKAGE, name: "@other/sdk" }, "## 0.3.0"],
    ["private", { ...PACKAGE, private: true }, "## 0.3.0"],
    ["missing private", { ...PACKAGE, private: undefined }, "## 0.3.0"],
    ["repository", { ...PACKAGE, repository: { url: "https://example.com/repo" } }, "## 0.3.0"],
    ["prerelease", { ...PACKAGE, version: "0.0.0-dev.abc1234" }, "## 0.0.0"],
    ["leading zero", { ...PACKAGE, version: "01.2.3" }, "## 01.2.3"],
    ["shell metadata", { ...PACKAGE, version: "$(npm publish)" }, "## 0.3.0"],
    ["heading mismatch", PACKAGE, "## 0.2.0"],
    ["missing heading", PACKAGE, "# Changes"],
    ["null metadata", null, "## 0.3.0"],
  ])("rejects %s before registry access", async (_name, pkg, changelog) => {
    let calls = 0;
    const lookup = (async () => { calls++; return ABSENT(""); }) as typeof fetch;
    expect(await validateRelease(pkg, changelog as string, {}, lookup).then(() => "accepted", () => "blocked")).toBe("blocked");
    expect(calls).toBe(0);
  });
  it("accepts another canonical stable version rather than pinning the current release", async () => {
    const lookup = (async () => new Response(JSON.stringify("version not found: 12.34.56"), { status: 404 })) as typeof fetch;
    expect(await validateRelease({ ...PACKAGE, version: "12.34.56" }, "## 12.34.56", {}, lookup)).toBe("12.34.56");
  });
  it.each([
    ["registry", "https://example.com"], ["@pbuilder:registry", "https://example.com"],
    ["tag", "dev"], ["access", "restricted"], ["dry-run", true], ["ignore-scripts", true],
    ["//registry.npmjs.org/:_authToken", "secret"], ["_auth", "secret"],
  ])("rejects contradictory effective npm setting %s", async (key, value) => {
    expect(await validateRelease(PACKAGE, "## 0.3.0", { [key as string]: value }, ABSENT).then(() => "accepted", () => "blocked")).toBe("blocked");
  });
  it.each([
    ["registry", "https://example.com"], ["tag", "dev"], ["access", "restricted"],
    ["provenance", false], ["dry-run", true], ["ignore-scripts", true],
  ])("rejects contradictory publishConfig setting %s", async (key, value) => {
    expect(await validateRelease({ ...PACKAGE, publishConfig: { [key as string]: value } }, "## 0.3.0", {}, ABSENT).then(() => "accepted", () => "blocked")).toBe("blocked");
  });
  it.each([200, 301, 401, 403, 429, 500])("blocks registry status %s", async (status) => {
    const lookup = (async () => new Response(JSON.stringify("version not found: 0.3.0"), { status })) as typeof fetch;
    expect(await validateRelease(PACKAGE, "## 0.3.0", {}, lookup).then(() => "accepted", () => "blocked")).toBe("blocked");
  });
  it.each(["not json", JSON.stringify("Not found"), JSON.stringify("version not found: 0.2.0"), JSON.stringify({ error: "version not found: 0.3.0" })])("blocks uncertain 404 payload %s", async (body) => {
    const lookup = (async () => new Response(body, { status: 404 })) as typeof fetch;
    expect(await validateRelease(PACKAGE, "## 0.3.0", {}, lookup).then(() => "accepted", () => "blocked")).toBe("blocked");
  });
  it.each(["network", "timeout"])("blocks %s failure without retry", async (message) => {
    let calls = 0;
    const lookup = (async () => { calls++; throw new Error(message); }) as typeof fetch;
    expect(await validateRelease(PACKAGE, "## 0.3.0", {}, lookup).then(() => "accepted", () => "blocked")).toBe("blocked");
    expect(calls).toBe(1);
  });
  it("looks up only the exact fixed npmjs version without redirects", async () => {
    const requests: unknown[] = [];
    const lookup = (async (url: unknown, options: RequestInit) => {
      requests.push([url, options.method, options.redirect, options.signal instanceof AbortSignal]);
      return ABSENT("");
    }) as typeof fetch;
    await validateRelease(PACKAGE, "## 0.3.0", {}, lookup);
    expect(requests).toEqual([["https://registry.npmjs.org/@pbuilder%2fsdk/0.3.0", "GET", "error", true]]);
  });
});

type Step = { run?: string; id?: string; if?: string };
type Document = { jobs: { publish: { steps: Step[] } } };

// This is a closed command vocabulary, not a shell sandbox or an Actions emulator.
// Reject the entire batch before executing even its first command.
function runBodies(bodies: string[], fail = "", version: string = SOURCE_PACKAGE.version): { attempts: string[]; status: number; summary: string; output?: string; uploads?: number } {
  if (bodies.some((body) => !ALLOWED.has(body.trim()))) return { attempts: [], status: 125, summary: "unsupported command" };
  const root = mkdtempSync(join(tmpdir(), "manual-publish-"));
  try {
    const bin = join(root, "bin");
    mkdirSync(bin);
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ ...SOURCE_PACKAGE, version }));
    writeFileSync(join(root, "CHANGELOG.md"), `## ${version}\n`);
    const validator = join(ROOT, "scripts/validate-release.ts");
    if (existsSync(validator)) writeFileSync(join(root, "scripts/validate-release.ts"), readFileSync(validator));
    writeFileSync(join(root, "preload.ts"), `globalThis.fetch = (async () => { if (process.env.FAIL === "registry") throw new Error("network blocked"); return new Response(JSON.stringify(${JSON.stringify(`version not found: ${version}`)}), {status: 404}); }) as typeof fetch;`);
    writeFileSync(join(bin, "bun"), `#!/bin/sh
if [ "$*" = "$FAIL" ]; then exit 1; fi
case "$*" in
  "install --frozen-lockfile"|"run build"|"test"|"run typecheck") exit 0 ;;
  "scripts/validate-release.ts") exec "$BUN_EXE" --preload ./preload.ts scripts/validate-release.ts ;;
  *) exit 125 ;;
esac
`, { mode: 0o700 });
    writeFileSync(join(bin, "npm"), `#!/bin/sh
case "$*" in
  "--version") if [ "$FAIL" = runtime ]; then printf '11.4.0\\n'; else printf '11.19.0\\n'; fi ;;
  "config list --json") if [ "$FAIL" = config ]; then exit 1; fi; printf '{"registry":"https://registry.npmjs.org/","tag":"latest","access":null,"provenance":false,"dry-run":false,"ignore-scripts":false}\\n' ;;
  "config list --json=false --long=false")
    case "$FAIL" in
      protected-token) printf '//registry.npmjs.org/:_authToken = (protected)\\n' ;;
      explicit-provenance) printf 'provenance = false\\n' ;;
      explicit-provenance-enabled) printf 'provenance = true\\n' ;;
      *) printf '; no nondefault settings\\n' ;;
    esac ;;
  "${PUBLISH.slice(4)}") printf '%s\\n' "$*" >> "$ATTEMPTS"; if [ "$FAIL" = lifecycle ]; then exit 1; fi; printf 'upload\\n' >> "$UPLOADS"; if [ "$FAIL" = publish ]; then exit 1; fi ;;
  *) exit 125 ;;
esac
`, { mode: 0o700 });
    const output = join(root, "output");
    const summary = join(root, "summary");
    const attempts = join(root, "attempts");
    const env = {
      PATH: bin, HOME: root, BUN_EXE: process.execPath, FAIL: fail,
      GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ATTEMPTS: attempts, UPLOADS: join(root, "uploads"),
      GITHUB_SHA: "a".repeat(40), RELEASE_VERSION: version, PUBLISH_OUTCOME: "blocked",
    };
    let status = 0;
    for (const body of bodies) {
      if (status !== 0 && body.trim() !== SUMMARY) continue;
      if (body.trim() === SUMMARY && existsSync(output)) {
        env.PUBLISH_OUTCOME = readFileSync(output, "utf8").match(/outcome=(.*)/g)?.at(-1)?.slice(8) ?? "blocked";
      }
      const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", body], { cwd: root, env, encoding: "utf8" });
      if (result.status !== 0) status = result.status ?? 1;
    }
    return {
      attempts: existsSync(attempts) ? readFileSync(attempts, "utf8").trim().split("\n") : [],
      status, summary: existsSync(summary) ? readFileSync(summary, "utf8") : "",
      output: existsSync(output) ? readFileSync(output, "utf8") : "",
      uploads: existsSync(env.UPLOADS) ? readFileSync(env.UPLOADS, "utf8").trim().split("\n").length : 0,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("manual publisher command isolation", () => {
  it("rejects escape routes before invoking any command", () => {
    for (const escape of ["/usr/bin/npm publish", "bunx npm publish", "npm exec -- npm publish", "bun run build; npm publish", "$(npm publish)", "PATH=/usr/bin npm publish"]) {
      expect(runBodies([ATTEMPT, escape])).toEqual({ attempts: [], status: 125, summary: "unsupported command" });
    }
  });
});

describe("manual publisher outer loop", () => {
  it("publishes the unchanged release once after the actual workflow command bodies pass", () => {
    const doc = YAML.parse(readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8")) as Document;
    const result = runBodies(doc.jobs.publish.steps.flatMap((step) => step.run ? [step.run.trim()] : []));
    expect(result.attempts).toEqual([PUBLISH.slice(4)]);
    expect(result.status).toBe(0);
    expect(result.output).toContain(`version=${SOURCE_PACKAGE.version}\n`);
  });
  it.each(["install --frozen-lockfile", "run build", "test", "run typecheck", "scripts/validate-release.ts"])("blocks publication when gate %s fails", (failure) => {
    const doc = YAML.parse(readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8")) as Document;
    const result = runBodies(doc.jobs.publish.steps.flatMap((step) => step.run ? [step.run.trim()] : []), failure);
    expect(result.status).toBe(1);
    expect(result.attempts).toEqual([]);
    expect(result.summary).toContain("Outcome: blocked");
  });
  it("reports a failed publish as attempted with unknown effects and no retry", () => {
    const doc = YAML.parse(readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8")) as Document;
    const result = runBodies(doc.jobs.publish.steps.flatMap((step) => step.run ? [step.run.trim()] : []), "publish");
    expect(result.attempts).toEqual([PUBLISH.slice(4)]);
    expect(result.status).toBe(1);
    expect(result.summary).toContain("Outcome: attempted");
    expect(result.summary).toContain("owner verification pending");
  });
  it("distinguishes command invocation from a simulated lifecycle failure before upload", () => {
    const doc = YAML.parse(readFileSync(join(ROOT, ".github/workflows/publish.yml"), "utf8")) as Document;
    const result = runBodies(doc.jobs.publish.steps.flatMap((step) => step.run ? [step.run.trim()] : []), "lifecycle");
    expect(result.attempts).toEqual([PUBLISH.slice(4)]);
    expect(result.uploads).toBe(0);
    expect(result.status).toBe(1);
    expect(result.summary).toContain("Outcome: attempted");
  });
});

describe("release validator CLI", () => {
  it("emits the validated declared version for the workflow", () => {
    expect(runBodies(["bun scripts/validate-release.ts"], "", "0.3.0").output).toBe("version=0.3.0\n");
  });
  it.each(["runtime", "config", "registry"])("fails closed on %s failure", (failure) => {
    expect(runBodies(["bun scripts/validate-release.ts"], failure).status).toBe(1);
  });
  it.each(["protected-token", "explicit-provenance"])("blocks explicit %s omitted or defaulted in JSON config", (failure) => {
    expect(runBodies(["bun scripts/validate-release.ts"], failure).status).toBe(1);
  });
  it("accepts explicitly enabled provenance with whitespace around the assignment", () => {
    expect(runBodies(["bun scripts/validate-release.ts"], "explicit-provenance-enabled").status).toBe(0);
  });
  it("validates a future stable version through the real CLI rather than a current-version fixture", () => {
    expect(runBodies(["bun scripts/validate-release.ts"], "", "12.34.56").output).toBe("version=12.34.56\n");
  });
});

describe("release operator guidance", () => {
  it("separates preparation, first-live authorization and uncertain-effect recovery", () => {
    const text = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
    for (const phrase of ["## Publishing a release", "separate first-live authorization", "environment `npm`", "Inconclusive inspection never authorizes a retry", "provenance source SHA/run", "self-review is not independent review"]) expect(text).toContain(phrase);
  });
  it("retains required reviewers for manual-only publication", () => {
    const text = readFileSync(join(ROOT, "SECURITY.md"), "utf8");
    expect(text).toContain("manual-only");
    expect(text).toContain("required-reviewer approval");
    expect(text).toContain("CONTRIBUTING.md#publishing-a-release");
  });
  it("amends the rehearsal decision without removing approval protection", () => {
    const text = readFileSync(join(ROOT, "openspec/decisions/0042-publish-rehearsal-interlock.md"), "utf8");
    expect(text).toContain("## Amendment: manual stable publication");
    expect(text).toContain("required-reviewer approval remains mandatory");
  });
  it("records the new deployment flow separately from the historical baseline", () => {
    const text = readFileSync(join(ROOT, "openspec/architecture.md"), "utf8");
    expect(text).toContain("Manual publication amendment (2026-09-11)");
    expect(text).toContain("scripts/validate-release.ts");
  });
});
