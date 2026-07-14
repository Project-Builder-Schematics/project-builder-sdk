// REQ-KIT-03: `modify` is no longer exported from commons; only `replaceContent` is.
// Not a `.test.ts` file — `bun test`'s glob never collects/executes it (a named import
// that fails to resolve throws a hard ESM SyntaxError at module load, crashing the whole
// file's test collection, not just one assertion). Only `bun run typecheck` enforces this.
// @ts-expect-error — `modify` no longer resolves from commons/index.ts.
import { modify } from "../../src/commons/index.ts";
void modify;
