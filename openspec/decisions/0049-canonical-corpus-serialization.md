# ADR-0049: Canonical Serialization Binds the Reader Too

- Status: Accepted (2026-07-14, promoted at author-emulation-e2e-scaffold archive)
- Date: 2026-07-13
- Deciders: Daniel (Hyperxq)
- Origin: change `author-emulation-e2e-scaffold` (design §4.3/§4.5). Closes the
  FIT-28 determinism-breaker risk (silent JS key-order/integer-like-key reordering).
- Builds on: ADR-0048 (the third golden idiom this serialization backs); REQ-GCC-04/06
  (determinism and purity requirements).

## Context

Determinism (GCC-04/FIT-28) and purity (GCC-06/FIT-24) require byte-identical corpus
output across runs, and a raw-file reader (the future engine) able to parse the
corpus without hidden conventions. Plain JS object key order — and specifically
integer-like-key reordering — silently breaks byte-determinism between otherwise
equivalent runs.

## Decision

One pure `canonicalize()` function — UTF-8, no BOM, LF line endings, 2-space pretty
JSON, exactly one trailing newline; objects built key-by-key in a pinned order (never
JS iteration order); the `create.options` subtree recursively lexicographically
key-sorted (the most common silent FIT-28 breaker); `force` always emitted as a
boolean (default `false`) — is shared by BOTH the regen writer and every verifier.
The serialization is part of the contract the engine reader honors, not an internal
test detail.

## Consequences

- (+) Writer/verifier drift is impossible — both consume the same pure function, no
  parallel serialization logic to fall out of sync.
- (−) Any format-key change becomes a `formatVersion`-relevant event, not a silent
  refactor.
- (+) Explicit `options` sorting eliminates the most common determinism regression
  (JS integer-like-key reordering) before it can reach a committed corpus file.

## Alternatives Considered

- **`JSON.stringify` default key order** — REJECTED: non-deterministic across engines
  and key shapes; the exact failure mode this ADR prevents.
- **Serialization as a test-only concern** (each verifier free to reimplement) —
  REJECTED: leaves the future engine reader guessing at the grammar; this ADR binds
  the reader too, not just the writer.
