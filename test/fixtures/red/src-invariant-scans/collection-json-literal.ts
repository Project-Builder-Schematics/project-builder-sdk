// [red-fixture] REQ-FTG-06.1 — a deliberately reintroduced `collection.json` literal.
// Never imported by real code; read as TEXT by fit-43's clause (a) red-proof only.

export function regrownMarkerCheck(dir: string): boolean {
  return dir.endsWith("collection.json");
}
