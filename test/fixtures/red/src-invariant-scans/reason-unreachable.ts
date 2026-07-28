// [red-fixture] REQ-FTG-07.1 — mirrors `src/core/authoring-error.ts`'s shape: the
// `AuthoringReason` union declaration and `originFor`'s switch list EVERY member (by
// definition — both would credit "unreachable-reason" vacuously if the scanner read them),
// but "unreachable-reason" is deliberately absent from BOTH `CODE_TO_REASON` and every
// direct construction site below — proving the scan does not credit the two excluded
// locations. Never imported by real code; read as TEXT by fit-44's red-proof only.

export type FixtureReason =
  | "path-collision"
  | "unreachable-reason"
  | "invalid-input";

function originFor(reason: FixtureReason): string {
  switch (reason) {
    case "path-collision":
      return "write-rejected";
    case "unreachable-reason":
    case "invalid-input":
      return "authoring-rejected";
  }
}

const CODE_TO_REASON: Record<string, FixtureReason> = {
  collision: "path-collision",
};

function rejection(reason: FixtureReason, message: string): Error {
  return new Error(`${reason}: ${message}`);
}

export function mintInvalidInput(message: string): Error {
  return rejection("invalid-input", message);
}
