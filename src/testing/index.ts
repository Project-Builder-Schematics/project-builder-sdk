// ./testing — the third audience, `author-testing` (ADR-0009 amendment, ADR-0033). Minimal
// walking-skeleton facade (S-000): re-exports `defineFactory` by value only. The full
// `runFactoryForTest` result-contract facade lands in S-001 — this file exists first so the
// installed-consumer spike can prove reachability through the published `./testing` entry.
export { defineFactory } from "../core/context.ts";
