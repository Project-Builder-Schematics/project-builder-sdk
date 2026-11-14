// Shared Node filesystem error narrowing — used wherever a read-path failure must branch
// on `.code` (ENOENT vs. EACCES/EPERM/EISDIR) before it can fail closed correctly.

export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
