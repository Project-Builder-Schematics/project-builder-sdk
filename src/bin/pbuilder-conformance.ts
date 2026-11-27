#!/usr/bin/env bun
// `pbuilder-conformance --dialect <installed package dir>` (CA-13): prints one JSON report line.
// Exit 0: the fixture passed. Exit 1: it ran and failed, a missing fixture included. Exit 2: it
// could not run, with nothing on stdout. Runs under Bun, from the SDK root of the Run, so the
// dialect's `@pbuilder/sdk` imports reach this same SDK.

import { checkDialectPackage } from "../conformance/index.ts";
import { redirectConsoleToStderr } from "../shared-kernel/framing.ts";

// The fixture runs the author's code, so everything but the report goes to stderr.
const writeReport = process.stdout.write.bind(process.stdout);
Object.defineProperty(process, "stdout", { value: process.stderr, writable: true, configurable: true });
redirectConsoleToStderr();

const COULD_NOT_RUN = 2;

async function main(argv: string[]): Promise<number> {
  if (argv.length !== 2 || argv[0] !== "--dialect" || argv[1] === "") {
    process.stderr.write("usage: pbuilder-conformance --dialect <installed package dir>\n");
    return COULD_NOT_RUN;
  }
  const report = await checkDialectPackage(argv[1]!);
  writeReport(`${JSON.stringify(report)}\n`);
  return report.passed ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`pbuilder-conformance: the fixture could not run: ${err instanceof Error ? err.name : "error"}\n`);
    process.exitCode = COULD_NOT_RUN;
  }
);
