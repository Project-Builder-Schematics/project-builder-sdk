#!/usr/bin/env bun
// `pbuilder-conformance --dialect <installed package dir>` (CA-13), or
// `pbuilder-conformance --local <name> --conformance <file> --path <base file>` for a local dialect
// (CA-18): prints one JSON report line.
// Exit 0: the fixture passed. Exit 1: it ran and failed, a missing fixture included. Exit 2: it
// could not run, with nothing on stdout. Runs under Bun, from the SDK root of the Run, so the
// dialect's `@pbuilder/sdk` imports reach this same SDK.

import { checkDialectPackage, checkLocalDialect, type ConformanceReport } from "../conformance/index.ts";
import { redirectConsoleToStderr } from "../shared-kernel/framing.ts";

// The fixture runs the author's code, so everything but the report goes to stderr.
const writeReport = process.stdout.write.bind(process.stdout);
Object.defineProperty(process, "stdout", { value: process.stderr, writable: true, configurable: true });
redirectConsoleToStderr();

const COULD_NOT_RUN = 2;

const USAGE =
  "usage: pbuilder-conformance --dialect <installed package dir>\n" +
  "       pbuilder-conformance --local <name> --conformance <file> --path <base file>\n";

function check(argv: string[]): Promise<ConformanceReport> | undefined {
  if (argv.some((value) => value === "")) return undefined;
  if (argv.length === 2 && argv[0] === "--dialect") return checkDialectPackage(argv[1]!);
  if (argv.length !== 6 || argv[0] !== "--local") return undefined;
  const flags = new Map([[argv[2], argv[3]], [argv[4], argv[5]]]);
  const conformance = flags.get("--conformance");
  const path = flags.get("--path");
  if (conformance === undefined || path === undefined) return undefined;
  return checkLocalDialect({ name: argv[1]!, conformance, path });
}

async function main(argv: string[]): Promise<number> {
  const checking = check(argv);
  if (checking === undefined) {
    process.stderr.write(USAGE);
    return COULD_NOT_RUN;
  }
  const report = await checking;
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
