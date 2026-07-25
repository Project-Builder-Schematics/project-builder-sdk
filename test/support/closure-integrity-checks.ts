// Pure checkers shared by fit-42 (applies them to the real built tree) and
// fit-42.negative (plants inputs that prove they fire). Same split as the FIT-40 pair:
// the assertion and its red-proof must run the SAME code, or the red-proof proves nothing.
// Deliberately dependency-free — plain data in, findings out.

export interface PathHygieneFinding {
  readonly rule: "non-posix" | "leading-dot-slash" | "absolute" | "parent-segment" | "duplicate";
  readonly path: string;
}

export function findPathHygieneViolations(paths: readonly string[]): PathHygieneFinding[] {
  const findings: PathHygieneFinding[] = [];
  for (const path of paths) {
    if (path.includes("\\")) findings.push({ rule: "non-posix", path });
    if (path.startsWith("./")) findings.push({ rule: "leading-dot-slash", path });
    if (path.startsWith("/")) findings.push({ rule: "absolute", path });
    if (path.split("/").includes("..")) findings.push({ rule: "parent-segment", path });
  }

  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) findings.push({ rule: "duplicate", path });
    seen.add(path);
  }
  return findings;
}

export interface ByteFinding {
  readonly path: string;
  readonly offset: number;
}

const CR = 0x0d;
const LF = 0x0a;
const BOM = [0xef, 0xbb, 0xbf];

export function findCrlfOffenders(
  files: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>
): ByteFinding[] {
  const findings: ByteFinding[] = [];
  for (const { path, bytes } of files) {
    for (let offset = 0; offset < bytes.length - 1; offset += 1) {
      if (bytes[offset] === CR && bytes[offset + 1] === LF) {
        findings.push({ path, offset });
        break;
      }
    }
  }
  return findings;
}

export function findBomOffenders(
  files: ReadonlyArray<{ readonly path: string; readonly bytes: Uint8Array }>
): string[] {
  return files
    .filter(({ bytes }) => BOM.every((byte, index) => bytes[index] === byte))
    .map(({ path }) => path);
}
