// REQ-WPS-08: the factory pointer grammar `<url>#<export>` — `<url>` is validated per
// RUN-02, `<export>` is an optional fragment naming a non-default export (absent fragment
// == default export). S-001 owns only the pure grammar parse below; RUN-02's `file:`+
// empty-host allowlist, RUN-03's 3-form export resolution, RUN-06's double-wrap check, and
// RUN-07's import-failure split are S-002 additions to this same file.

export interface ParsedFactoryPointer {
  url: string;
  // undefined == the module's default export (no fragment, or an empty fragment).
  exportName: string | undefined;
}

// Splits on the FIRST '#' only — a url containing a later literal '#' (e.g. percent-encoded
// as %23 in practice, but defensively handled here regardless) is never mis-split.
export function parseFactoryPointer(pointer: string): ParsedFactoryPointer {
  const hashIndex = pointer.indexOf("#");
  if (hashIndex === -1) {
    return { url: pointer, exportName: undefined };
  }
  const url = pointer.slice(0, hashIndex);
  const fragment = pointer.slice(hashIndex + 1);
  return { url, exportName: fragment.length > 0 ? fragment : undefined };
}
