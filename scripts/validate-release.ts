import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

export function checkVersionHasChangelogHeading(version: string, topHeading: string | undefined): { ok: boolean; reason?: string } {
  if (topHeading === undefined) return { ok: false, reason: "CHANGELOG.md has no `## <major.minor.patch>` heading" };
  if (version !== topHeading) return { ok: false, reason: `version ${version} does not match the CHANGELOG's topmost heading ${topHeading}` };
  return { ok: true };
}

export async function validateRelease(
  pkg: unknown,
  changelog: string,
  config: Record<string, unknown>,
  lookup: typeof fetch = fetch,
): Promise<string> {
  const metadata = pkg as { name?: unknown; private?: unknown; version?: unknown; repository?: { url?: unknown }; publishConfig?: Record<string, unknown> } | null;
  if (metadata?.name !== "@pbuilder/sdk" || metadata.private !== false) throw new Error("invalid package identity or privacy");
  if (metadata.repository?.url !== "git+https://github.com/Project-Builder-Schematics/project-builder-sdk.git") throw new Error("invalid repository");
  const version = metadata.version;
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error("invalid stable version");
  const heading = checkVersionHasChangelogHeading(version, /^## (\d+\.\d+\.\d+)$/m.exec(changelog)?.[1]);
  if (!heading.ok) throw new Error(heading.reason);
  for (const settings of [config, metadata.publishConfig ?? {}]) {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null) continue;
      const lower = key.toLowerCase();
      if (/(?:^|:)(?:_auth|_authtoken|_password|username)$/.test(lower)) throw new Error("token authentication is not allowed");
      if ((lower === "registry" || lower === "@pbuilder:registry") && value !== "https://registry.npmjs.org" && value !== "https://registry.npmjs.org/") throw new Error("registry configuration conflict");
      if ((lower === "tag" && value !== "latest") || (lower === "access" && value !== "public")) throw new Error("publication target configuration conflict");
      if ((lower === "dry-run" || lower === "ignore-scripts") && value !== false) throw new Error("publication lifecycle configuration conflict");
      if (settings === metadata.publishConfig && lower === "provenance" && value !== true) throw new Error("provenance configuration conflict");
    }
  }
  const response = await lookup(`https://registry.npmjs.org/@pbuilder%2fsdk/${version}`, {
    method: "GET", redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 404 || await response.json() !== `version not found: ${version}`) throw new Error("registry version exists or absence is unconfirmed");
  return version;
}

if (import.meta.main) {
  try {
    const runtime = spawnSync("npm", ["--version"], { encoding: "utf8", timeout: 30_000 });
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(runtime.stdout?.trim() ?? "");
    if (runtime.status !== 0 || !match || !(Number(match[1]) > 11 || (Number(match[1]) === 11 && (Number(match[2]) > 5 || (Number(match[2]) === 5 && Number(match[3]) >= 1))))) throw new Error("npm >=11.5.1 is required");
    const configuration = spawnSync("npm", ["config", "list", "--json"], { encoding: "utf8", timeout: 30_000 });
    if (configuration.status !== 0) throw new Error("effective npm configuration unavailable");
    // JSON cannot distinguish default provenance=false from an explicit override.
    // The non-default listing also retains protected authentication key names.
    const explicit = spawnSync("npm", ["config", "list", "--json=false", "--long=false"], { encoding: "utf8", timeout: 30_000 });
    if (explicit.status !== 0) throw new Error("explicit npm configuration unavailable");
    for (const line of explicit.stdout.split("\n")) {
      if (/^\s*[;#]/.test(line)) continue;
      const setting = /^\s*([^=]+?)\s*=\s*(.*?)\s*$/.exec(line);
      if (!setting) continue;
      const key = setting[1]!.trim().toLowerCase();
      if (/(?:^|:)(?:_authtoken|_auth|_password|username)$/.test(key) || (key === "provenance" && setting[2] !== "true")) throw new Error("explicit authentication or provenance conflict");
    }
    const version = await validateRelease(JSON.parse(readFileSync("package.json", "utf8")), readFileSync("CHANGELOG.md", "utf8"), JSON.parse(configuration.stdout));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
    console.log(`Validated @pbuilder/sdk ${version}`);
  } catch {
    // npm diagnostics and configuration can contain credentials; never echo them.
    console.error("Release blocked: metadata, npm runtime/configuration, or registry absence could not be validated.");
    process.exitCode = 1;
  }
}
