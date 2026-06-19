# Skill Registry: project-builder-sdk

**Last updated**: 2026-06-19

```yaml
project: project-builder-sdk
last_updated: "2026-06-19"
skills: []
```

## Notes

Greenfield — registry is **present but empty**. (Downstream skills distinguish "present-and-empty"
from "missing"; the latter is a halt condition.)

**Recommended to author once code lands** (mirrors the engine's `go-testing` skill): a
**`bun-testing`** skill triggering on `*.ts` / `*.test.ts` + test/tdd tasks, encoding the project's
TS/Bun testing standards (Strict TDD, `bun test`, black-box test layout, public-API contract tests
across the JSON-RPC wire). Create via `/skill-creator`, then `/skill-registry` to register it.
