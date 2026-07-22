// m2-copy (wire-mutation, REQ-CFX-15, verb PINNED to `copy`): default export copies
// src.txt to dst.txt, source retained; collisionWithForceProbe (collision-with-force)
// overwrites the seeded occupied.txt with force:true; collisionNoForceProbe
// (collision-no-force-twin) targets the same occupied.txt with no force — directive-level
// collision; missingSourceProbe (missing-source-twin) sources an absent path —
// directive-level not-found; dirSourceProbe (dir-source-twin) sources the seeded
// directory adir — the engine rejects directory sources batch-level, unrepresentable;
// copyThenModifyProbe (copy-then-modify) composes copy(src→dst2) with an in-place modify
// of dst2 in the SAME batch — the engine applies both directives sequentially in array
// order, so the final bytes are the modify's, never the copy's intermediate (REQ-CFX-15.6).
// All twins are case-level factory overrides (ADR-0065).
import { copy, replaceContent } from "../../src/index.ts";

export default function m2CopyFactory(_input: Record<string, never>): void {
  copy("src.txt", "dst.txt");
}

export function collisionWithForceProbe(_input: Record<string, never>): void {
  copy("src.txt", "occupied.txt", { force: true });
}

export function collisionNoForceProbe(_input: Record<string, never>): void {
  copy("src.txt", "occupied.txt");
}

export function missingSourceProbe(_input: Record<string, never>): void {
  copy("missing.txt", "dst.txt");
}

export function dirSourceProbe(_input: Record<string, never>): void {
  copy("adir", "bdir");
}

export function copyThenModifyProbe(_input: Record<string, never>): void {
  copy("src.txt", "dst2.txt");
  replaceContent("dst2.txt", "final");
}
