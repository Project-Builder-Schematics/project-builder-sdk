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

export default function frameRunnerCanaryPathLeakFactory(input: { canary: string; style: "posix" | "windows" }): void {
  const path = input.style === "posix" ? posixCanaryPath(input.canary) : windowsCanaryPath(input.canary);
  throw new Error(`ENOENT: no such file, open '${path}'`);
}
