// [permanent-fixture] FIT-01 transitive red-proof (S-000, REQ-FIT-01): leaf.ts itself has
// NO direct AST-library import — a per-file scanner sees nothing wrong here. It relatively
// imports helper.ts, which DOES import ts-morph. The graph walk must follow this edge to
// catch the violation; a direct-only scanner cannot. Never imported/executed — scanned as
// text only (excluded from tsc via tsconfig's `test/fixtures/red/**` exclude).
export { helperFn } from "./helper.ts";
