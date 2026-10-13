import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const importer = join(root, "scripts/import-upstream.mjs");
const expectedSkills = [
  "build-incident-history", "build-knowledge-company", "check-skill-health", "gh",
  "incident-investigation", "knowledge-technology", "otel-collector", "otel-instrumentation",
  "signal-choice-advisor", "tsuga-analyze-trace-latency", "tsuga-audit-monitor-coverage",
  "tsuga-audit-telemetry-quality", "tsuga-build-dashboard", "tsuga-cli", "tsuga-contrast-sets",
  "tsuga-debug-telemetry-ingestion", "tsuga-investigate-errors", "tsuga-investigate-service-health",
];

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "pi-tsuga test "));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, "upstream");
  const target = join(directory, "installed package");
  const skills = join(source, "plugins/tsuga/skills");
  mkdirSync(join(skills, "check-skill-health/scripts"), { recursive: true });
  mkdirSync(join(skills, "check-skill-health/agents"), { recursive: true });
  mkdirSync(join(source, "plugins/tsuga/.claude-plugin"), { recursive: true });
  writeFileSync(join(source, "LICENSE"), "MIT License\nCopyright (c) 2026 Tsuga\n");
  writeFileSync(join(source, "plugins/tsuga/.claude-plugin/plugin.json"), JSON.stringify({ version: "0.12.6" }));
  writeFileSync(join(skills, "check-skill-health/SKILL.md"), '---\nname: check-skill-health\ndescription: Use when checking skills.\n---\n\n# Check skills\n\n```bash\n${CLAUDE_PLUGIN_ROOT}/skills/check-skill-health/scripts/lint-all.sh\n```\n');
  writeFileSync(join(skills, "check-skill-health/scripts/lint-all.sh"), '#!/bin/bash\nprintf "fixture-ok\\n"\n');
  chmodSync(join(skills, "check-skill-health/scripts/lint-all.sh"), 0o755);
  writeFileSync(join(skills, "check-skill-health/agents/openai.yaml"), "interface:\n  display_name: Health check\n");
  writeFileSync(join(skills, "index.json"), JSON.stringify({ skills: [{
    name: "check-skill-health", files: ["SKILL.md", "scripts/lint-all.sh", "agents/openai.yaml"],
  }] }));
  execFileSync("git", ["init", "-q"], { cwd: source });
  execFileSync("git", ["add", "."], { cwd: source });
  execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"], { cwd: source });
  return { source, target, skills };
}

function importFixture(source, target) {
  return spawnSync(process.execPath, [importer, source, target], { encoding: "utf8" });
}

test("Pi manifest exposes the complete upstream skill inventory", () => {
  assert.ok(existsSync(join(root, "package.json")), "Pi package manifest has not been created");
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  assert.ok(manifest.keywords.includes("pi-package"));
  const names = readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(names, expectedSkills);
  const index = JSON.parse(readFileSync(join(root, "skills/index.json"), "utf8"));
  assert.deepEqual(index.skills.map((skill) => skill.name).sort(), expectedSkills);
  for (const skill of index.skills) {
    for (const file of skill.files) {
      assert.ok(statSync(join(root, "skills", skill.name, file)).size > 0, `${skill.name}/${file} missing or empty`);
    }
  }
});

test("local importer preserves assets, executable modes, license and source provenance", (t) => {
  const { source, target, skills } = fixture(t);
  const result = importFixture(source, target);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(target, "LICENSE")), readFileSync(join(source, "LICENSE")));
  assert.deepEqual(readFileSync(join(target, "skills/check-skill-health/agents/openai.yaml")), readFileSync(join(skills, "check-skill-health/agents/openai.yaml")));
  assert.ok(statSync(join(target, "skills/check-skill-health/scripts/lint-all.sh")).mode & 0o111);
  const provenance = JSON.parse(readFileSync(join(target, "upstream.json"), "utf8"));
  assert.equal(provenance.commit, execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim());
  assert.equal(provenance.version, "0.12.6");
  assert.equal(provenance.repository, "https://github.com/tsuga-dev/agent-plugins");
  assert.equal(provenance.files.find((file) => file.path === "check-skill-health/agents/openai.yaml").sha256,
    createHash("sha256").update(readFileSync(join(skills, "check-skill-health/agents/openai.yaml"))).digest("hex"));
});

test("adapted quick-start runs outside the package from an installation path containing spaces", (t) => {
  const { source, target } = fixture(t);
  const imported = importFixture(source, target);
  assert.equal(imported.status, 0, imported.stderr);
  const skill = readFileSync(join(target, "skills/check-skill-health/SKILL.md"), "utf8");
  const command = skill.match(/```bash\n([\s\S]*?)\n```/)[1];
  const env = { ...process.env, TSUGA_SKILLS_DIR: join(target, "skills") };
  delete env.CLAUDE_PLUGIN_ROOT;
  const result = spawnSync("bash", ["-c", command], { cwd: tmpdir(), env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "fixture-ok\n");
});

test("missing upstream assets fail before changing an existing installation", (t) => {
  const { source, target, skills } = fixture(t);
  mkdirSync(join(target, "skills"), { recursive: true });
  writeFileSync(join(target, "skills/keep.txt"), "keep");
  rmSync(join(skills, "check-skill-health/agents/openai.yaml"));
  const result = importFixture(source, target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing upstream file/i);
  assert.equal(readFileSync(join(target, "skills/keep.txt"), "utf8"), "keep");
});

test("health checker discovers project and custom Pi skill locations from another directory", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pi-tsuga lint "));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const customAgentDir = join(directory, "custom agent");
  for (const location of [".pi/skills", "custom agent/skills"]) {
    mkdirSync(join(directory, location), { recursive: true });
    cpSync(join(root, "skills/tsuga-cli"), join(directory, location, "tsuga-cli"), { recursive: true });
  }
  const result = spawnSync("bash", [join(root, "skills/check-skill-health/scripts/lint-all.sh"), "--quiet"], {
    cwd: directory,
    env: { ...process.env, HOME: directory, PI_CODING_AGENT_DIR: customAgentDir },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\.pi\/skills\/tsuga-cli/);
  assert.match(result.stdout, /custom agent\/skills\/tsuga-cli/);
  assert.match(result.stdout, /FAIL: 0/);
});

test("nonexistent source fails without creating a package", (t) => {
  const { source, target } = fixture(t);
  const result = importFixture(join(source, "missing"), target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^Unable to import upstream:/);
  assert.equal(existsSync(target), false);
});
