// REQ-EXC-01.2 fixture (item d): a plain TypeError thrown from INSIDE the factory
// function body (a run-time crash, not an import-time throw — distinct from
// `import-crash/factory.ts`, which throws at MODULE TOP LEVEL and is RUN-07.2's fixture).
// Unclassified by AuthoringError/TransportFault — exit-codes.ts's classifyExitCode falls
// through to code 4 (crash).
export default function frameRunnerCrashFactory(): void {
  throw new TypeError("frame-runner crash fixture: author code throws mid-run");
}
