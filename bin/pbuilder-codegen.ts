import { runCli } from "../src/bounded-contexts/authoring/infrastructure/in/codegen/cli.ts";

if (import.meta.main) {
  process.exitCode = runCli(process.argv.slice(2));
}
