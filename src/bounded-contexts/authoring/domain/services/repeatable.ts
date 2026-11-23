// Kept apart from define-dialect.ts, which pulls in the whole handle machinery: the conformance
// kit and every dialect's op module import this at run time, and must not carry that weight.
import type { Op } from "./define-dialect.ts";

const repeatableOps = new WeakSet<object>();

/**
 * Declares an op repeatable: its effect depends on how many times it is applied. It adds again
 * on every application, or it acts on a position, so applied again it reaches another element.
 * The conformance kit checks every other op for idempotency (A-11) and skips a chain holding a
 * repeatable op. The op itself is marked and returned, so it stays repeatable in every pack
 * that reuses it.
 *
 * @example
 * export const push = repeatable(function push(ast: string[], line: string): void {
 *   ast.push(line);
 * });
 * const pack = defineOpPack({
 *   setLine(ast: string[], index: number, line: string) { ast[index] = line; },
 *   push,
 * });
 */
export function repeatable<F extends Op>(op: F): F {
  repeatableOps.add(op);
  return op;
}

export function isRepeatable(op: unknown): boolean {
  return typeof op === "function" && repeatableOps.has(op);
}
