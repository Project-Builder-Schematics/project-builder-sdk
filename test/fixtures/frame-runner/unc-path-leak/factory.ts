// REQ-WPS-07.6 e2e fixture: seeds a canary token into a UNC or WSL-interop absolute path
// and throws it as a plain Error's message — proves LIVE, over the real spawned runner
// bin, that the raw canary substring never reaches stderr for either backslash-prefixed
// shape. Path builders exported for the same reason as `canary-path-leak/factory.ts`.
export function uncCanaryPath(canary: string): string {
  return `\\\\server\\share\\${canary}\\config.json`;
}

export function wslCanaryPath(canary: string): string {
  return `\\\\wsl.localhost\\Ubuntu\\home\\user\\${canary}\\file.ts`;
}

export default function frameRunnerUncPathLeakFactory(input: { canary: string; style: "unc" | "wsl" }): void {
  const path = input.style === "unc" ? uncCanaryPath(input.canary) : wslCanaryPath(input.canary);
  throw new Error(`EACCES: permission denied, open '${path}'`);
}
