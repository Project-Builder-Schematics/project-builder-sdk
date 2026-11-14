// Base operation interfaces for all handle types (KIT-04 / ADR-0004 amended by ADR-0010).
// ReadOps: the read path. WriteOps: the write verbs available on all handles.
// Both FoundHandle and WritableHandle compose from these via handle-state.ts.

export interface ReadOps {
  read(): Promise<string | undefined>;
}

export interface WriteOps {
  replaceContent(content: string): WritableHandleRef;
  rename(newName: string, opts?: { force?: boolean }): WritableHandleRef;
  move(toDir: string, opts?: { force?: boolean }): WritableHandleRef;
  copy(to: string, opts?: { force?: boolean }): WritableHandleRef;
}

// Forward reference — handle-state.ts provides the concrete type.
// We declare a structural alias here to avoid a circular import.
export interface WritableHandleRef extends ReadOps, WriteOps {}
