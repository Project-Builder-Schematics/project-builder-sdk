// `chmod(0o000)` does not deny ROOT, so a check whose subject IS an unreadable file cannot run
// as root. Skipping it silently makes "N pass" mean something different on a root CI runner than
// on a developer machine — the failure mode this module exists to prevent. Two rules follow:
//
//  (a) a skip is scoped to the chmod-dependent LEG, never to a whole loop. Wrapping a loop over
//      three fault kinds dropped all three, two of them permission-INDEPENDENT.
//  (b) a root run is LOUD: the active set is asserted as a recorded fact of the environment, and
//      a warning names what is inactive, so the weaker guarantee is visible rather than implied.
export const RUNNING_AS_ROOT = process.getuid?.() === 0;

export function warnIfPermissionChecksInactive(context: string): void {
  if (!RUNNING_AS_ROOT) return;
  process.stderr.write(
    `[permission-dependent] RUNNING AS ROOT — ${context}: chmod-based checks are INACTIVE. ` +
      "A green run here is strictly weaker than a green run as an unprivileged user.\n"
  );
}
