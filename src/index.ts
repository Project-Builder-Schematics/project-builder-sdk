// Umbrella entry (PKG-01): re-exports the commons surface only.
// The core kit is NOT re-exported from the umbrella — it is an internal boundary (ADR-0009).

export * from "./commons/index.ts";
