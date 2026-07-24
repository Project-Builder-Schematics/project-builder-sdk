// m2-copyin (wire-mutation, REQ-CFX-16, verb PINNED to `copyIn`, engine-plane cases ONLY,
// branch-held per REQ-CCR-09): default export copies the package-local assets/payload.txt
// by reference to dst.txt, a genuinely new path; verbatimContentProbe (verbatim-content)
// copies assets/verbatim.txt — containing a literal REQ-FSC-05-shaped `{= name =}` token —
// to dst2.txt, proving by-reference bypasses the by-value template engine that would
// otherwise render it; collisionWithForceProbe (collision-with-force) overwrites the
// seeded occupied.txt with force:true; collisionNoForceProbe (collision-no-force-twin)
// targets the same occupied.txt with no force — directive-level collision; destDirProbe
// (dest-dir-twin) targets the seeded existing-dir, a pre-existing DIRECTORY — the engine
// resolves a directory DESTINATION to collision, NOT unrepresentable (owner-confirmed,
// distinct from m2-copy's directory-SOURCE case). SOURCE-side rejections
// (containment-escape, missing-source, a directory source) are SDK-plane and explicitly
// DESCOPED from this corpus (owner ruling 2) — not authored here. All twins are case-level
// factory overrides (ADR-0065).
import { copyIn } from "../../src/index.ts";

export default function m2CopyinFactory(_input: Record<string, never>): void {
  copyIn("assets/payload.txt", "dst.txt");
}

export function verbatimContentProbe(_input: Record<string, never>): void {
  copyIn("assets/verbatim.txt", "dst2.txt");
}

export function collisionWithForceProbe(_input: Record<string, never>): void {
  copyIn("assets/payload.txt", "occupied.txt", { force: true });
}

export function collisionNoForceProbe(_input: Record<string, never>): void {
  copyIn("assets/payload.txt", "occupied.txt");
}

export function destDirProbe(_input: Record<string, never>): void {
  copyIn("assets/payload.txt", "existing-dir");
}
