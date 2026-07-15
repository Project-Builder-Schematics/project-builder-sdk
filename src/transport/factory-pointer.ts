// REQ-WPS-08: the factory pointer grammar `<url>#<export>` — `<url>` is validated per
// RUN-02, `<export>` is an optional fragment naming a non-default export (absent fragment
// == default export). S-001 owns the pure grammar parse below; RUN-02's `file:`+
// empty-host allowlist, RUN-03's 3-form export resolution, and RUN-06's double-wrap check
// are S-002 additions to this same file. RUN-07's import-failure split lives in runner.ts
// (it classifies the dynamic `import()` call itself, which this file never performs).

import { isDefineFactoryWrapped } from "../core/context.ts";

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

export type FactoryUrlValidation = { ok: true } | { ok: false; message: string };

// REQ-RUN-02: the factory pointer's URL scheme MUST be exactly `file:` AND its host
// component MUST be empty — checked BEFORE any dynamic import, since the factory's
// top-level code runs at import (input validation after import is not a containment
// control).
export function validateFactoryUrl(url: string): FactoryUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: `factory pointer is not a valid URL: "${url}"` };
  }
  if (parsed.protocol !== "file:") {
    return { ok: false, message: `factory pointer must use the file: scheme, got "${parsed.protocol}"` };
  }
  if (parsed.hostname !== "") {
    return {
      ok: false,
      message: `factory pointer's file: URL must have an empty host, got "${parsed.hostname}"`,
    };
  }
  return { ok: true };
}

export type BareFactoryFn = (o: unknown) => void | Promise<void>;

export type FactoryExportResolution =
  | { ok: true; fn: BareFactoryFn }
  | { ok: false; kind: "missing-default-export" }
  | { ok: false; kind: "missing-named-export"; exportName: string }
  | { ok: false; kind: "not-callable"; exportName: string | undefined }
  | { ok: false; kind: "double-wrapped" };

// REQ-RUN-03 (3-form export resolution) + REQ-RUN-06 (double-wrap detection): resolves
// `exportName` (undefined == default export) against `moduleNamespace`, classifying
// failure into exactly four distinct, actionable forms. The double-wrap check (ADR-04's
// brand marker) runs only once a callable value is found — it is arity-independent
// (RUN-06.2: an author's bare arity-2 factory is an ordinary bare factory, never
// misclassified), so "not callable" and "double-wrapped" are checked in sequence, never
// confused with each other.
export function resolveFactoryExport(
  moduleNamespace: Record<string, unknown>,
  exportName: string | undefined
): FactoryExportResolution {
  const resolved = exportName === undefined ? moduleNamespace.default : moduleNamespace[exportName];

  if (resolved === undefined) {
    return exportName === undefined
      ? { ok: false, kind: "missing-default-export" }
      : { ok: false, kind: "missing-named-export", exportName };
  }
  if (typeof resolved !== "function") {
    return { ok: false, kind: "not-callable", exportName };
  }
  if (isDefineFactoryWrapped(resolved)) {
    return { ok: false, kind: "double-wrapped" };
  }
  return { ok: true, fn: resolved as BareFactoryFn };
}
