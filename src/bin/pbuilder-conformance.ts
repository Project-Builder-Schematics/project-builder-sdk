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
  await new Promise<void>((done) => writeReport(`${JSON.stringify(report)}\n`, () => done()));
  return report.passed ? 0 : 1;
}

// Exits explicitly: a timer or socket the author's code left open must not keep the process alive.
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    const detail = err instanceof Error && err.message.startsWith("pbuilder-conformance:") ? err.message : "the fixture could not run";
    process.stderr.write(`${detail}\n`, () => process.exit(COULD_NOT_RUN));
  }
);
