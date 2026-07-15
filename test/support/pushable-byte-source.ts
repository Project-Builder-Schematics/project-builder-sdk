// Shared "host->runner stdin" half of an in-process framed wire (extracted from
// runner.integration.test.ts, S-003 — reused by the BRB-01 integration tests, the SEC-02
// overlap tests, fit-35's real concurrent-run proof, and the WPS-09 harness leg, so this
// pushable async byte source exists exactly once).

export interface PushableByteSource {
  iterable: AsyncIterable<Uint8Array>;
  push(chunk: Buffer): void;
  close(): void;
}

export function pushableByteSource(): PushableByteSource {
  const pending: Buffer[] = [];
  let wake: (() => void) | undefined;
  let closed = false;

  const iterable: AsyncIterable<Uint8Array> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        const chunk = pending.shift();
        if (chunk !== undefined) {
          yield chunk;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };

  return {
    iterable,
    push(chunk: Buffer): void {
      pending.push(chunk);
      wake?.();
      wake = undefined;
    },
    close(): void {
      closed = true;
      wake?.();
      wake = undefined;
    },
  };
}
