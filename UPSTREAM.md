# Upstream provenance

This is an unofficial Pi port of [Tsuga's official agent toolkit](https://github.com/tsuga-dev/agent-plugins), not an official Tsuga integration.

The initial import contains all **18 skills** from plugin version **0.12.6**, at commit [`611e2f2431c4f2b246d4ca637bc7d080065e4f9f`](https://github.com/tsuga-dev/agent-plugins/commit/611e2f2431c4f2b246d4ca637bc7d080065e4f9f).

`upstream.json` records the imported commit, plugin version and SHA-256 hashes of all original files. These hashes describe upstream originals, not the adapted copies. The complete upstream skills tree is retained, including reference pages, prompts, scripts, `index.json` and the nested `agents/openai.yaml` metadata. The latter is preserved as an asset, not registered as a Pi agent.

## Port-specific changes

- An explicit `pi.skills` manifest exposes the complete skill collection.
- Each skill loads the shared [Pi runtime notes](references/pi-compat.md).
- Claude's plugin-root paths become an explicitly resolved `TSUGA_SKILLS_DIR`, with quoted shell paths and Bash interpreter calls.
- Skill pointers use Pi's `/skill:name` syntax; generated company knowledge resolves its own references outside the package.
- Ready-to-paste prompts target Pi and the existing Tsuga CLI rather than requiring a Tsuga MCP server.
- Batch tracking uses a checklist; subagent workflows have a sequential fallback when no subagent tools are installed.
- The health checker also discovers Pi's user and project skill locations.
- Remote writes require explicit user approval, including incident records and proofs dashboards.

## Refreshing the snapshot

From a development checkout of this package, clone the upstream repository separately, choose a reviewed commit, then run:

```bash
git clone https://github.com/tsuga-dev/agent-plugins.git /tmp/tsuga-agent-plugins
git -C /tmp/tsuga-agent-plugins checkout <reviewed-commit>
npm run sync:upstream -- /tmp/tsuga-agent-plugins
npm test
npm run lint:skills
```

Review the resulting diff and update this document's version and commit links before publishing. The importer replaces only the vendored `skills/` tree, `LICENSE` and `upstream.json`; keep company-specific generated skills in a separate repository. Updates never fetch or run automatically during package installation.

Tsuga owns the upstream content, distributed under the MIT license reproduced in `LICENSE`.
