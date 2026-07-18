// m2-delete (wire-mutation, REQ-CFX-07): default export removes target.txt; notFoundProbe
// (not-found-twin) targets an absent path — directive-level not-found; dirTargetProbe
// (dir-target-twin) targets the seeded directory adir — the engine rejects directory
// targets batch-level, unrepresentable. Both twins are case-level factory overrides
// (ADR-0065).
import { remove } from "../../src/index.ts";

export default function m2DeleteFactory(_input: Record<string, never>): void {
  remove("target.txt");
}

export function notFoundProbe(_input: Record<string, never>): void {
  remove("missing.txt");
}

export function dirTargetProbe(_input: Record<string, never>): void {
  remove("adir");
}
