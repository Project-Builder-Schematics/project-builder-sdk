// REQ-RUN-09.2 fixture: a non-Error thrown value (no `.message` property) — the terminal
// catch must fall back to the fixed literal "run failed", never a stringified coercion of
// the thrown value.
export default function frameRunnerThrowNonErrorFactory(): void {
  throw "x";
}
