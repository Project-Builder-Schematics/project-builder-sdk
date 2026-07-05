export interface ReadOps {
    read(): Promise<string | undefined>;
}
export interface WriteOps {
    modify(content: string): WritableHandleRef;
    rename(newName: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
    move(toDir: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
    copy(to: string, opts?: {
        force?: boolean;
    }): WritableHandleRef;
}
export interface WritableHandleRef extends ReadOps, WriteOps {
}
//# sourceMappingURL=base-handle.d.ts.map