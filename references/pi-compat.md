# Pi runtime notes

## Bundled paths

Pi supplies each skill's absolute `SKILL.md` location. Resolve supporting files relative to that skill directory, not the shell's current working directory.

`${TSUGA_SKILLS_DIR}` means the absolute parent directory of the bundled skill directories. Derive it from the loaded skill's location; it is not an environment variable installed by this package. Before a shell command uses it, explicitly set and quote it in that same command:

```bash
TSUGA_SKILLS_DIR="<absolute parent of the loaded skill directory>"
bash "${TSUGA_SKILLS_DIR}/check-skill-health/scripts/lint-all.sh" "<target skill directory>"
```

Pass resolved absolute paths to workers. Invoke Bash scripts through `bash`, including scripts assigned to a variable such as `LINT`.

## Skills and workers

`/skill:name` identifies a Pi skill. Read its `SKILL.md` from the available skill list before following its workflow. A skill is instructions, not a separately executing agent. `incident-history` and `knowledge-company` refer to generated, deployment-specific skills; they are not included in this package.

Use installed subagent tools when available. If this Pi installation has no subagent tool, execute the same branches sequentially, preserving their roles, evidence gates and output contracts, and say that the investigation ran sequentially. Track batches in a checklist when no task-tracking tool is available. This package does not install subagent tools.

Workers need the same authenticated `tsuga` CLI access. A Tsuga MCP server is not required. Product reference paths fetched with `tsuga docs get` are remote pages, not missing package assets.

## Generated knowledge

Keep company-specific knowledge and incident archives in a separate working repository, never inside this installed package. In build procedures, `skills/knowledge-company` and `skills/incident-history` refer to that repository's output directories. Register those generated skills separately with Pi, or use Pi's `.pi/skills` / `.agents/skills` discovery locations.

Generated skills resolve their own `references/` directory relative to their own `SKILL.md`, not `${TSUGA_SKILLS_DIR}`. Set the template's `CK` placeholder to that generated skill's absolute directory before running its examples. Keep raw incident exports and company data out of this public package.

## Remote mutations

Use the existing Tsuga CLI and honor its safety rules. A read-only investigation request does not authorize creating or updating investigation records, dashboards or other remote resources. Obtain explicit approval for the proposed writes before performing them, even if an upstream workflow calls them default deliverables. Without approval, return the analysis and proposed deliverables without publishing them.
