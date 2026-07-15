// [permanent-fixture] REQ-RUN-07.1 (judgment-day F13): a factory module that fails to PARSE.
// Deliberately syntactically invalid — the runner's dynamic import() must classify the load
// failure as "could not be found or loaded" (exit 1), never as an author top-level throw
// (exit 4). Lives under test/fixtures/red/ (tsconfig-excluded) so `tsc --noEmit` never sees it.
export default function ( {{{ broken beyond repair
