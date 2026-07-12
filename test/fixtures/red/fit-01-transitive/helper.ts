// [permanent-fixture] FIT-01 transitive red-proof companion (S-000, REQ-FIT-01) — the file
// the graph walk must REACH (via leaf.ts's relative import) to catch this ts-morph import.
// Never imported/executed — scanned as text only.
import { Project } from "ts-morph";

export function helperFn(): Project {
  return new Project();
}
