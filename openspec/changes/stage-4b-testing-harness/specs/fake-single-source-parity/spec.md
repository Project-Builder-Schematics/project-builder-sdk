# Fake Single-Source Parity Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4b-testing-harness`

> V2 note: no council finding targets this domain. Content unchanged from V1 (REQ-FSP-01..04
> preserved verbatim, all four scenarios preserved).

## Purpose

Today `ContractFake` (277 lines, 25 importers) lives in `test/support/contract-fake.ts`,
outside the built tree — `src/` cannot import it (`tsconfig.build.json`'s `rootDir`/
`exclude`). This domain relocates it into `src/testing/` as the ONE physical
implementation, leaving the old path as a pure re-export shim, so the harness (which
lives in `src/`) can use the SAME fake every other test in the repo already trusts,
without ever forking it into two implementations.

## Requirements

### REQ-FSP-01: Single ContractFake Source

`ContractFake` MUST have exactly ONE physical implementation in the repository, located
under `src/testing/` after relocation. No second implementation (a copy, a subclass with
duplicated logic, or a structurally-similar rewrite) may exist anywhere else.

#### Scenario REQ-FSP-01.1: Exactly one implementation exists

- GIVEN a repository-wide scan for a class body implementing the `EngineClient` interface with `ContractFake`'s characteristic method set (`emit`/`read`/`commit`/`discard`/`committedTree`/`stagingTree`)
- WHEN the scan runs
- THEN exactly one such class body is found, under `src/testing/`

### REQ-FSP-02: Re-Export Shim Reference Identity

`test/support/contract-fake.ts` MUST become a pure re-export of the relocated
implementation — no logic, no wrapper class, no re-declared type. A reference-identity
assertion (`===` on the exported class) MUST prove the shim's `ContractFake` IS the
relocated class itself, not a structurally-similar copy.

#### Scenario REQ-FSP-02.1: Shim and relocated export are the same reference

- GIVEN `ContractFake` imported from `test/support/contract-fake.ts` and from `src/testing/contract-fake.ts`
- WHEN the two imports are compared with `===`
- THEN they are the identical reference
- AND a copy-pasted duplicate class (fixture, never committed) fails this same identity check, proving the assertion is not vacuous

### REQ-FSP-03: `rejection-messages.ts` Single Source

`test/support/rejection-messages.ts`'s exported constants MUST receive the SAME
relocation-and-shim treatment as `ContractFake` — one physical source under `src/testing/`,
with the old path re-exporting it. FIT-11's leak-scan dictionary (structurally derived from
this module today) MUST continue to read the SAME values after relocation, with zero
manual list maintenance.

#### Scenario REQ-FSP-03.1: Relocated constants remain FIT-11's dictionary source

- GIVEN `rejection-messages.ts` relocated under `src/testing/` with `test/support/rejection-messages.ts` as a shim
- WHEN FIT-11's `LEAK_DICTIONARY` is derived (`Object.values(rejectionMessages)`)
- THEN it is unchanged in content from before relocation, sourced through the shim without modification

### REQ-FSP-04: Fail-Closed Parity Enforcement

A fitness function MUST fail if the shim ever regresses into a structural copy instead of
a re-export — e.g. someone pastes the class body back into `test/support/contract-fake.ts`.
Detection MUST be by reference/value identity (REQ-FSP-02/03), never a behavioural diff
suite that could pass on two independently-drifting implementations.

#### Scenario REQ-FSP-04.1: A regressed structural copy is caught [red-proof]

- GIVEN a fixture where `test/support/contract-fake.ts` is rewritten to contain its own class body instead of re-exporting `src/testing/contract-fake.ts`
- WHEN the parity fitness function runs against that fixture
- THEN it fails, naming the broken re-export
