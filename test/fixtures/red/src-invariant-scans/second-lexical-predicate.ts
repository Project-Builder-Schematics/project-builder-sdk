// [red-fixture] REQ-FTG-08.1 — the REAL predicate (mirrors
// `src/scaffold/path-guards.ts#isLexicallyEscaping`) PLUS a SECOND, deliberately
// reintroduced parallel `../`/absolute-path check implementing the SAME idiom for a
// different verb. Never imported by real code; read as TEXT by fit-45's red-proof only.

export function isLexicallyEscaping(relPath: string): boolean {
  const isAbsolute = relPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relPath);
  const segments = relPath.split(/[\\/]+/);
  return isAbsolute || segments.includes("..");
}

export function isLexicallyEscapingForDestination(relPath: string): boolean {
  const isAbsolute = relPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relPath);
  const segments = relPath.split(/[\\/]+/);
  return isAbsolute || segments.includes("..");
}
