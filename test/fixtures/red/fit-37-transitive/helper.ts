// [permanent-fixture] FIT-37 transitive red-proof companion (react-dialect S-000) — the file
// the graph walk must REACH (via leaf.ts's relative import) to catch this ts-morph import.
// Never imported/executed — scanned as text only.
import { Project } from "ts-morph";

export function helperFn(): Project {
  return new Project();
}
