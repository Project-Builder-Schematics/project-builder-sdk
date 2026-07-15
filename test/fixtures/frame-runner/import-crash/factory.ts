// REQ-RUN-07.2 fixture: an author-level throw at MODULE TOP LEVEL (during dynamic import),
// distinct from a throw inside the factory function body (which is a run-time crash,
// classified separately by EXC-01 code 4 via exit-codes.ts's classifyExitCode, not by
// RUN-07's import-time split). Never imported outside this one negative test.
throw new Error("import-crash fixture: author top-level code always throws");
