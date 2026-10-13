# pi-tsuga

The complete [official Tsuga agent toolkit](https://github.com/tsuga-dev/agent-plugins), packaged for the [Pi coding agent](https://pi.dev).

**18 skills**, including every upstream script, reference, template and supporting asset. This is an **unofficial community port**, not an official Tsuga integration.

## Install

```bash
pi install git:github.com/mateogreil/pi-tsuga
```

Run `/reload` in an existing Pi session, or start a new session. Pi discovers the skills automatically and loads their instructions when relevant. Force a particular skill with its command:

```text
/skill:tsuga-cli
/skill:incident-investigation Investigate the errors on the checkout service during the last hour.
/skill:otel-instrumentation Review this application's OpenTelemetry instrumentation.
```

To pin a release:

```bash
pi install git:github.com/mateogreil/pi-tsuga@v0.1.0
```

Pinned versions stay pinned. For an unpinned install:

```bash
pi update git:github.com/mateogreil/pi-tsuga
pi remove git:github.com/mateogreil/pi-tsuga
```

Add `--local` to `pi install` for project-only configuration, subject to Pi's project trust settings.

## Prerequisites

- Pi and its supported Node.js runtime (Node.js 22.19 or newer).
- The `tsuga` CLI in `PATH`, authenticated for live Tsuga workflows. An account is not needed for offline instrumentation advice or skill linting.
- Bash for the bundled health-check scripts. Some build/reference workflows also use `jq`, Python 3, git or the GitHub `gh` CLI.

If you do not already have the Tsuga CLI, install and authenticate it yourself:

```bash
npm install -g @tsuga/cli
tsuga auth login
```

The package has **no runtime dependencies, extensions, MCP servers or lifecycle hooks**. It does not install the CLI, change Tsuga configuration or send telemetry on installation. You do not need `tsuga install plugin claude-code`.

## Included skills

| Skill | Purpose |
| --- | --- |
| `tsuga-cli` | CLI commands, TQL, aggregation, output interpretation and safety |
| `incident-investigation` | Full incident investigation and root-cause analysis |
| `tsuga-investigate-service-health` | Multi-signal service health checks |
| `tsuga-investigate-errors` | Error spikes, patterns and exceptions |
| `tsuga-analyze-trace-latency` | Slow requests, spans and latency changes |
| `tsuga-contrast-sets` | Differences between failing, slow or deployed populations |
| `tsuga-debug-telemetry-ingestion` | Missing, sparse or delayed telemetry |
| `tsuga-audit-monitor-coverage` | Monitor coverage and notification-routing gaps |
| `tsuga-audit-telemetry-quality` | Telemetry quality and resource identity |
| `tsuga-build-dashboard` | Dashboard creation, updates and validation |
| `knowledge-technology` | Technology-specific metrics and diagnostic references |
| `otel-instrumentation` | OpenTelemetry application instrumentation across nine languages |
| `otel-collector` | Collector configuration, pipelines and OTTL |
| `signal-choice-advisor` | Choosing telemetry signals, instruments and attributes |
| `gh` | GitHub changes, workflow runs, releases and deployments |
| `build-incident-history` | Building a deployment-specific incident archive |
| `build-knowledge-company` | Building company, team and service knowledge |
| `check-skill-health` | Offline validation of skill bundles and generated archives |

Pi keeps the first skill when names collide. Use `pi config` if another package supplies a skill with the same name, such as `gh`.

## Pi-specific behavior

The shared [runtime notes](references/pi-compat.md) adapt plugin-root paths and skill pointers to Pi. They also describe how to run the same workflows sequentially if your Pi installation has no subagent extension. No subagent extension or Tsuga MCP server is required; installed subagent tools can be used when available.

Company knowledge and incident archives are **generated from your own data**, not included sample data. Build them in a separate working repository and register the resulting skills separately with Pi. Never write company-specific material into this installed public package. Technology and product references served by `tsuga docs get` remain fetched on demand.

**Remote writes require your explicit approval**, including the investigation records and proofs dashboards that upstream calls default deliverables. Without approval, the skills return the analysis and proposed deliverables without publishing them.

The upstream `agents/openai.yaml` file is preserved as supporting metadata; it does not register a Pi agent.

## Development and verification

Tests require `pi`, Node.js, npm, git and Bash in `PATH`. No Tsuga credentials or model API key are used: native Pi discovery runs through RPC without a model request, in a disposable configuration directory.

```bash
npm test
npm run lint:skills
npm pack --dry-run
```

The tests verify local importing, provenance, all supporting assets, quoted script paths, Pi skill-location discovery, native Pi installation and the published file inventory. For a remote-install smoke test:

```bash
PI_TSUGA_TEST_SOURCE=git:github.com/mateogreil/pi-tsuga@v0.1.0 node --test tests/pi.test.mjs
```

See [UPSTREAM.md](UPSTREAM.md) for the pinned source commit, port-specific changes and the manual refresh procedure. `pi update` updates this port; it does not pull new skills directly from Tsuga upstream.

## License

MIT. Upstream skill content is copyright Tsuga; its original license is preserved in [LICENSE](LICENSE).
