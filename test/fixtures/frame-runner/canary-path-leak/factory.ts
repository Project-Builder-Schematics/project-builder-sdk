// REQ-WPS-07.4 e2e fixture: seeds a canary token into a POSIX or Windows-drive-letter
// absolute path and throws it as a plain Error's message — proves LIVE, over the real
// spawned runner bin, that the raw canary substring never reaches stderr. The path
// builders are exported so the e2e test can independently compute the exact expected
// scrub outcome from the SAME absolute path this factory throws, instead of duplicating
// the template or guessing.
export function posixCanaryPath(canary: string): string {
  return `/home/barri/${canary}-secret-dir/app.module.ts`;
}

export function windowsCanaryPath(canary: string): string {
  return `C:\\Users\\dev\\${canary}-project\\app.module.ts`;
}

// The "-space" variants insert a literal space-bearing directory segment (a real OS default
// path shape — macOS "Application Support", Windows "Program Files") BEFORE the canary
// segment. `canaryToken()` itself is always `[a-z0-9]`-only, so it structurally cannot
// exercise the space-truncation bypass on its own — the space has to come from the fixture's
// own path shape, with the canary placed downstream of it, so a truncated match would leak
// the canary raw instead of scrubbing it.
export function posixSpaceCanaryPath(canary: string): string {
  return `/home/barri/Application Support/${canary}-secret-dir/app.module.ts`;
}

export function windowsSpaceCanaryPath(canary: string): string {
  return `C:\\Users\\dev\\Program Files\\${canary}-project\\app.module.ts`;
}

export default function frameRunnerCanaryPathLeakFactory(
  input: { canary: string; style: "posix" | "windows" | "posix-space" | "windows-space" }
): void {
  const builders = {
    posix: posixCanaryPath,
    windows: windowsCanaryPath,
    "posix-space": posixSpaceCanaryPath,
    "windows-space": windowsSpaceCanaryPath,
  } as const;
  const path = builders[input.style](input.canary);
  throw new Error(`ENOENT: no such file, open '${path}'`);
}
