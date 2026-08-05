// REQ-RUN-09.3 fixture: throws TransportFault directly from the factory body — pins the
// terminal catch's curated-class branch (byte-identical, unscrubbed note), independent of
// the wire-level fault path that raises TransportFault in production.
import { TransportFault } from "../../../../src/transport/stdio-engine-client.ts";

export default function frameRunnerCuratedTransportFactory(): void {
  throw new TransportFault("malformed", "curated-transport fixture: known TransportFault message");
}
