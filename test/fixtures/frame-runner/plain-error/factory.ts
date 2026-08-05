// REQ-RUN-09.1 fixture: a plain Error thrown mid-run (not import-time, not one of the
// curated classes) — pins the spec's own literal GWT message, distinct from
// `crash/factory.ts`'s TypeError (which only pins the branch EXISTS, not its exact text).
export default function frameRunnerPlainErrorFactory(): void {
  throw new Error("Could not locate the imports array closing in src/app.module.ts");
}
