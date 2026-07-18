# Corpus Determinism Specification

**Spec version**: V3 (content unchanged from V2 — no V3 corrections applied to this domain)
**Status**: SIGNED (V3 re-signed by owner 2026-07-18)
**Change**: `conformance-corpus`

## Purpose

Guarantees the corpus's `expected/` byte-exact snapshots survive checkout identically on every
platform. Lands the registered, previously-unlanded followup (`openspec/pending-changes.md`
row 306): a repo-wide `.gitattributes` `* eol=lf` rule, with a verification step proving it does
not silently re-normalize already-tracked files. Enforcement mechanics for REQ-CDT-03..06 live
in `conformance-self-check`'s REQ-CSC-06 (named fail-closed verifier) — this domain states WHAT
the invariants are.

## Requirements

### REQ-CDT-01: `.gitattributes` `* eol=lf` Repo-Wide

The repo root MUST contain a `.gitattributes` file declaring `* eol=lf` for ALL tracked files —
not scoped to `conformance/` alone (owner ruling 2).

#### Scenario REQ-CDT-01.1: .gitattributes declares repo-wide eol=lf

- GIVEN `.gitattributes` at repo root
- WHEN read
- THEN it contains a `* eol=lf` rule applying to every path in the repo

### REQ-CDT-02: Renormalization Dry-Check — No Unexpected Diff

Once `.gitattributes` lands, running `git add --renormalize .` MUST produce NO diff on files
that were already tracked before this change (i.e., no file already using LF silently changes,
and any file that WAS CRLF-tracked is renormalized deliberately and reviewed as part of this
change's own diff, not left as a surprise for a later commit).

#### Scenario REQ-CDT-02.1: Renormalize dry-check yields no residual diff

- GIVEN `.gitattributes` committed
- WHEN `git add --renormalize .` runs immediately after
- THEN `git status`/`git diff --cached` shows no unexpected changes beyond what this change's
  own commit already includes

### REQ-CDT-03: Zero CR Bytes in Corpus Text Fixtures

Every text file under `conformance/` (manifests, factories, `seed/`, `expected/`, `schematic/`)
MUST contain zero `0x0D` (CR) bytes.

#### Scenario REQ-CDT-03.1: No CR byte in any corpus text file

- GIVEN every text file under `conformance/`
- WHEN scanned byte-by-byte
- THEN no `0x0D` byte is present

### REQ-CDT-04: No BOM in Corpus Text Fixtures

Every file under `conformance/` MUST NOT begin with a byte-order-mark (`EF BB BF`).

(Previously: worded backwards — "No file... MUST begin with a byte-order-mark," which literally
required a BOM. Corrected per BA blind-review wording-bug finding; the invariant itself is
unchanged — it always meant NO BOM anywhere in the corpus.)

#### Scenario REQ-CDT-04.1: No file starts with a BOM

- GIVEN every file under `conformance/`
- WHEN its first 3 bytes are inspected
- THEN none equal the UTF-8 BOM sequence

### REQ-CDT-05: POSIX Relative Paths Only

Every path value inside `corpus.json` and every `manifest.json` (fixture ids, `seed`/`expected`
dir names, `schematic` file paths) MUST be POSIX-style relative paths: forward slashes only, no
leading `/`, no `..` segments, no drive letters.

#### Scenario REQ-CDT-05.1: A backslash path is a violation

- GIVEN a hypothetical manifest value `"schematic\\files\\out.txt"`
- WHEN checked against REQ-CDT-05
- THEN it violates the POSIX-relative-path rule

### REQ-CDT-06: Byte-Exactness for `expected/**` and `schematic/files/**` Leaves

Every file under an `expected/` directory OR a `schematic/files/` directory MUST match its
documented intended content byte-for-byte. Concrete, machine-verifiable rule: no file under
`expected/**` or `schematic/files/**` MAY end in a trailing `0x0A` (`\n`) byte — every leaf
documented in the handoff for this corpus is newline-free content; an editor or build tool
silently appending a trailing newline at save time MUST NOT go undetected. This rule, combined
with REQ-CDT-03 (zero CR) and REQ-CDT-04 (no BOM), fully machine-verifies byte-exactness for
these two directory classes without requiring a hand-maintained golden-hash table.

(Previously: scoped to `expected/` only, and stated as a prose MUST without a concrete
verification rule. V2 extends scope to `schematic/files/**` and states the concrete
no-trailing-`\n` rule per QA blind-review findings QA-M4/QA-M5.)

#### Scenario REQ-CDT-06.1: No undeclared trailing newline in `expected/`

- GIVEN `expected/target.txt` whose documented content is `"replaced"` (no trailing newline)
- WHEN the file's raw bytes are read
- THEN they are exactly `replaced` — no appended `\n`

#### Scenario REQ-CDT-06.2: No undeclared trailing newline in `schematic/files/`

- GIVEN `schematic/files/out.txt` whose documented content is `"v1"` (no trailing newline)
- WHEN the file's raw bytes are read
- THEN they are exactly `v1` — no appended `\n`

### REQ-CDT-07: Corpus Text Encoding Baseline — 100% UTF-8, No Binary Files

Every file under `conformance/` MUST be UTF-8 text; the corpus contains zero binary files. This
baseline is why REQ-CDT-03's CR-byte scan and REQ-CDT-04's BOM scan MAY apply uniformly to every
file under `conformance/` without a binary-file exclusion list — a scan that would otherwise
need to skip images/archives/etc. has nothing to skip in this corpus.

#### Scenario REQ-CDT-07.1: Every corpus file is text, none binary

- GIVEN every file under `conformance/`
- WHEN each file's content is inspected
- THEN it decodes as valid UTF-8 text — no binary file is present

## Sensitive Areas Coverage

No sensitive areas covered. `.gitattributes` is a repo-config file, not a `deployment` or
`security` surface per `openspec/sensitive-areas.md`.
