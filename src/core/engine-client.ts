// KIT-01: sole transport seam. The fake and the real client both implement this.
// read() returns bare Promise<string> — no served-from tag (that is fake-internal state).

import type { Batch } from "./wire.ts";

export interface EngineClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string>;
  // ADR-01: all-or-nothing commit boundary. The engine stages emitted ops and commits/discards
  // them transactionally. ADDITIVE — emit/read signatures are unchanged.
  commit(): Promise<void>;
  discard(): Promise<void>;
}
