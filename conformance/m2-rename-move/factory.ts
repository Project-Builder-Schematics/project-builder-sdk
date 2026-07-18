// m2-rename-move (wire-mutation, REQ-CFX-08, verb PINNED to `rename`): default export
// renames src.txt to dst.txt; collisionProbe (collision-twin) targets the seeded
// occupied.txt as the new name with no force — directive-level collision; dirSourceProbe
// (dir-source-twin) sources the seeded directory adir — the engine rejects directory
// sources batch-level, unrepresentable. Both twins are case-level factory overrides
// (ADR-0065).
import { rename } from "../../src/index.ts";

export default function m2RenameMoveFactory(_input: Record<string, never>): void {
  rename("src.txt", "dst.txt");
}

export function collisionProbe(_input: Record<string, never>): void {
  rename("src.txt", "occupied.txt");
}

export function dirSourceProbe(_input: Record<string, never>): void {
  rename("adir", "bdir");
}
