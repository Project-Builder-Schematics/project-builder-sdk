// KIT-01: sole transport seam. The fake and the real client both implement this.
// read() returns Promise<string | undefined> — content string, or undefined for not-found
// (ADR-01: the PORT owns the not-found contract; not-found is a return, never a throw). The
// served-from tag is fake-internal state, never in the read return.

import type { Batch } from "./wire.ts";

export interface EngineClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string | undefined>;
  // ADR-01: all-or-nothing commit boundary. The engine stages emitted ops and commits/discards
  // them transactionally. ADDITIVE — emit/read signatures are unchanged.
  commit(): Promise<void>;
  discard(): Promise<void>;
}
