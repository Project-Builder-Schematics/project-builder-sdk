// Pure re-export shim (ADR-0035): the normative fake now lives, and ships, under
// src/testing/ — this path stays alive so the ~25 existing importers keep their import
// specifiers unchanged. Parity is reference identity, never a second declaration (FSP-02).
export { ContractFake, type ContractFakeOptions, type ServedFrom } from "../../src/testing/contract-fake.ts";
