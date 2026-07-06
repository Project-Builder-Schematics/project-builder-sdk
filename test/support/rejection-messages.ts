// Shared message-fragment dictionary (design §4.7 / REQ-AEC-05): the SAME constants the
// fake's throw sites compose their messages from AND FIT-11's leak-scan dictionary reads
// from. Rewording a fake message can never silently false-green the leak scan — both
// sides read this one module, so a wording drift shows up as a compile-time/test failure
// at the fake's throw site, not a stale copy nobody remembers to update.

export const CONTRACT_FAKE_PREFIX = "ContractFake:";
export const ALREADY_EXISTS = "already exists";
export const USE_FORCE_TO_OVERWRITE = "use force to overwrite";
export const NOT_FOUND = "not found";
export const EXCEEDS_SIZE_CAP = "exceeds size cap";
export const ROUND_TRIP_FIDELITY_CHECK = "round-trip fidelity check";
export const JSON_SERIALIZATION = "JSON serialization";
