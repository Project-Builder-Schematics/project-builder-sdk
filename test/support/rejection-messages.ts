// Pure re-export shim (ADR-0035): the message dictionary relocated alongside the fake to
// src/testing/ — FIT-11's leak scan and every existing importer keep this import specifier.
export {
  CONTRACT_FAKE_PREFIX,
  ALREADY_EXISTS,
  USE_FORCE_TO_OVERWRITE,
  NOT_FOUND,
  EXCEEDS_SIZE_CAP,
  ROUND_TRIP_FIDELITY_CHECK,
  JSON_SERIALIZATION,
} from "../../src/testing/rejection-messages.ts";
