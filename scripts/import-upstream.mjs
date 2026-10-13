import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "https://github.com/tsuga-dev/agent-plugins";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function inventory(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return inventory(join(directory, entry.name), path);
    if (!entry.isFile()) throw new Error(`Unsupported upstream file: ${path}`);
    return [path];
  }).sort();
}

function adaptMarkdown(text, path, skillNames) {
  let adapted = text.replaceAll("${CLAUDE_PLUGIN_ROOT}/skills/", "${TSUGA_SKILLS_DIR}/");
  for (const name of [...skillNames, "incident-history", "knowledge-company"]) {
    adapted = adapted.replaceAll(`$${name}`, `/skill:${name}`);
  }
  adapted = adapted.replace(/^(\s*)("?\$\{TSUGA_SKILLS_DIR\}\/[^\s"`]+\.sh"?)(.*)$/gm,
    (_, indent, script, rest) => `${indent}bash "${script.replaceAll('"', '')}"${rest}`);
  adapted = adapted.replace(/`\$\{TSUGA_SKILLS_DIR\}\/([^\s`]+\.sh)/g,
    '`bash "${TSUGA_SKILLS_DIR}/$1"');
  adapted = adapted.replace(/^(\s*[A-Z_]+)=\$\{TSUGA_SKILLS_DIR\}\/([^\s]+)$/gm,
    '$1="${TSUGA_SKILLS_DIR}/$2"');
  adapted = adapted.replaceAll("Claude (or Codex)", "Pi");
  adapted = adapted.replaceAll("Claude / Codex", "Pi");
  adapted = adapted.replaceAll("Pi load into context", "Pi loads into context");
  adapted = adapted.replaceAll("Codex's skill loader silently drops skills with longer descriptions", "Pi warns about descriptions over this limit");
  adapted = adapted.replaceAll("use TodoWrite entries per wave of 20", "track each wave of 20 in a local checklist");
  adapted = adapted.replaceAll("Tsuga MCP tools: must be available to your subagents for live discovery + live probes.",
    "Tsuga CLI: must be available to each worker for live discovery + live probes.");
  if (path.endsWith("/SKILL.md")) {
    const end = adapted.indexOf("\n---", 4);
    if (end < 0) throw new Error(`Missing upstream frontmatter: ${path}`);
    const offset = end + 4;
    adapted = `${adapted.slice(0, offset)}\n\nRead [Pi runtime notes](../../references/pi-compat.md) before executing this skill.${adapted.slice(offset)}`;
  }
  if (path.endsWith("/references/SKILL_TEMPLATE.md")) {
    adapted = adapted.replaceAll("${TSUGA_SKILLS_DIR}/knowledge-company/references/", "references/");
    adapted = adapted.replaceAll("# references/ sits next to this SKILL.md; ${CLAUDE_PLUGIN_ROOT} resolves to the plugin root on Claude Code\nCK=\"${TSUGA_SKILLS_DIR}/knowledge-company/references\"",
      'CK="<absolute directory containing this generated SKILL.md>/references"');
    adapted = adapted.replaceAll("**Link sibling skills by `$name` convention** in the Boundary section. These are soft references that render in Claude's UI.",
      "**Link sibling skills by `/skill:name` convention** in the Boundary section. Pi resolves installed skills by name.");
  }
  return adapted;
}

function importUpstream(source, target) {
  const sourceSkills = join(source, "plugins/tsuga/skills");
  const index = JSON.parse(readFileSync(join(sourceSkills, "index.json"), "utf8"));
  const names = index.skills.map((skill) => skill.name);
  for (const skill of index.skills) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)) throw new Error(`Invalid upstream skill name: ${skill.name}`);
    for (const file of skill.files) {
      if (file.startsWith("/") || file.split("/").includes("..")) throw new Error(`Invalid upstream path: ${file}`);
      const path = join(sourceSkills, skill.name, file);
      if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Missing upstream file: ${skill.name}/${file}`);
    }
  }
  const files = inventory(sourceSkills).map((path) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(join(sourceSkills, path))).digest("hex"),
  }));
  const license = readFileSync(join(source, "LICENSE"));
  const { version } = JSON.parse(readFileSync(join(source, "plugins/tsuga/.claude-plugin/plugin.json"), "utf8"));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
  mkdirSync(target, { recursive: true });
  const targetSkills = join(target, "skills");
  rmSync(targetSkills, { recursive: true, force: true });
  cpSync(sourceSkills, targetSkills, { recursive: true });
  for (const { path } of files.filter((file) => file.path.endsWith(".md"))) {
    const destination = join(targetSkills, path);
    writeFileSync(destination, adaptMarkdown(readFileSync(destination, "utf8"), path, names));
  }
  const linter = join(targetSkills, "check-skill-health/scripts/lint-all.sh");
  if (existsSync(linter)) {
    const script = readFileSync(linter, "utf8").replace(
      '  [ -d "./.agents/skills" ]       && candidates+=("./.agents/skills")',
      '  [ -d "./.agents/skills" ]       && candidates+=("./.agents/skills")\n' +
      '  [ -d "./.pi/skills" ]          && candidates+=("./.pi/skills")\n' +
      '  [ -d "${PI_CODING_AGENT_DIR:-${HOME:-}/.pi/agent}/skills" ] && candidates+=("${PI_CODING_AGENT_DIR:-${HOME:-}/.pi/agent}/skills")\n' +
      '  [ -d "${HOME:-}/.agents/skills" ] && candidates+=("${HOME:-}/.agents/skills")',
    ).replace("No skill dirs found in ./skills, ./plugins/tsuga/skills, ~/.claude/skills, ~/.codex/skills, or ./.agents/skills.",
      "No skill dirs found in the project or user skill locations (including .pi/skills and PI_CODING_AGENT_DIR/skills).");
    writeFileSync(linter, script);
  }
  writeFileSync(join(target, "LICENSE"), license);
  writeFileSync(join(target, "upstream.json"), `${JSON.stringify({ repository, commit, version, files }, null, 2)}\n`);
  console.log(`Imported ${names.length} Tsuga skills at ${commit}`);
}

try {
  if (!process.argv[2]) throw new Error("Usage: node scripts/import-upstream.mjs <upstream-checkout> [destination]");
  importUpstream(resolve(process.argv[2]), resolve(process.argv[3] ?? packageRoot));
} catch (error) {
  console.error(`Unable to import upstream: ${error.message}`);
  process.exitCode = 1;
}
