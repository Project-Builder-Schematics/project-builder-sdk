// REQ-WPS-07.5 fixture: a plain Error whose message embeds secret-shaped, non-path-shaped
// content — pins the documented residual (the scrub only recognizes path-shaped
// substrings; it does not detect or redact secret values an author's own code
// interpolates into a thrown message).
export default function frameRunnerSecretErrorFactory(): void {
  throw new Error("configuration rejected: DB_PASSWORD=hunter2 failed validation");
}
