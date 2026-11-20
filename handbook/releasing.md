## Publishing a release

Publication is manual-only. Preparing or merging the workflow is not authorization
to publish. The owner must first confirm npm trusted publishing binds
`@pbuilder/sdk` to `Project-Builder-Schematics/project-builder-sdk`, workflow
`publish.yml`, environment `npm`, with direct npm publication permission and the
previous unbound mapping removed or replaced. Retain required reviewers, main-only
deployment and disabled protection bypass. Where self-review is allowed,
self-review is not independent review.

After that confirmation and workflow merge, obtain **separate first-live authorization**.
The owner selects **Actions → Publish → Run workflow → main** and approves the
`npm` environment request. Wrong refs or repositories are refused; pending or
rejected approval cannot start the publisher. Never dispatch just to test trust.

The workflow checks out the immutable dispatch SHA, installs with the frozen lockfile,
builds explicitly, runs the full suite and typecheck, then validates the public package
identity, stable declared version, matching release heading and npm configuration.
Only confirmed exact-version absence permits one provenance-enabled publication to
`https://registry.npmjs.org`, public access, `latest`. It never stamps or bumps a
version, creates tags/releases, chooses another channel or falls back to a token.
The retained `prepublishOnly` hook may rebuild; this is not a promise that the final
published bytes equal the earlier tested build. Noncancelling package concurrency
prevents overlapping runs, but is not a durable FIFO queue or registry reservation.

Read the run summary's package, declared version (or explicit `unavailable`), SHA,
registry, channel and outcome:

| Outcome | Meaning / next action |
|---|---|
| blocked | No publish command was reached; resolve the failed gate before another authorized request. |
| attempted | The command started; registry effects are unknown, including after a failure. |
| command succeeded | npm exited zero; owner registry confirmation is still outstanding. |
| registry confirmed | Owner checked the exact version, `latest` target and provenance source SHA/run. |

After a duplicate or ambiguous failure, inspect the registry before considering
another dispatch. Inconclusive inspection never authorizes a retry. An existing
version does not prove this run published it. Do not automatically retry, bump,
retag, downgrade provenance or switch authentication. A workflow rollback disables
future attempts; it cannot remove already distributed package bytes.

First-live acceptance requires the owner's registry checks above, with the run and
registry evidence recorded. Passing tests, dry-run, `whoami`, and configuration
confirmation alone cannot establish live activation. The command harness uses
isolated process and registry fixtures; its lifecycle-failure simulation proves
invocation versus simulated upload ordering, not npm's real upload behavior or
external approval/OIDC enforcement.
