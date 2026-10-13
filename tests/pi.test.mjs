import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createPiSandbox, getCommands, installPackage } from "./pi-test-utils.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const expectedCommands = [
  "skill:build-incident-history", "skill:build-knowledge-company", "skill:check-skill-health", "skill:gh",
  "skill:incident-investigation", "skill:knowledge-technology", "skill:otel-collector", "skill:otel-instrumentation",
  "skill:signal-choice-advisor", "skill:tsuga-analyze-trace-latency", "skill:tsuga-audit-monitor-coverage",
  "skill:tsuga-audit-telemetry-quality", "skill:tsuga-build-dashboard", "skill:tsuga-cli", "skill:tsuga-contrast-sets",
  "skill:tsuga-debug-telemetry-ingestion", "skill:tsuga-investigate-errors", "skill:tsuga-investigate-service-health",
];

test("native Pi installation exposes all 18 skills without a model request", async (t) => {
  const sandbox = createPiSandbox(t);
  installPackage(process.env.PI_TSUGA_TEST_SOURCE ?? root, sandbox);
  const result = await getCommands(sandbox);
  const skills = result.commands.filter((command) => command.source === "skill");
  assert.deepEqual(skills.map((skill) => skill.name).sort(), expectedCommands);
  for (const skill of skills) {
    assert.ok(skill.description.length > 0);
    assert.equal(skill.sourceInfo.origin, "package");
    assert.ok(skill.sourceInfo.path.endsWith("/SKILL.md"));
    assert.ok(readFileSync(skill.sourceInfo.path, "utf8").length > 0);
  }
  assert.equal(result.commands.filter((command) => command.source === "extension").length, 0);
  assert.doesNotMatch(result.stderr, /warning|collision|invalid skill/i);
});

test("generated team skill pointers address commands that Pi actually discovers", async (t) => {
  const sandbox = createPiSandbox(t);
  installPackage(process.env.PI_TSUGA_TEST_SOURCE ?? root, sandbox);
  const { commands } = await getCommands(sandbox);
  const available = new Set(commands.map((command) => `/${command.name}`));
  const template = readFileSync(join(root, "skills/build-knowledge-company/references/TEAM_KNOWLEDGE_TEMPLATE.md"), "utf8");
  const pointers = [...template.matchAll(/\/skill:[a-z0-9/-]+/g)].map((match) => match[0]);
  assert.ok(pointers.length > 0);
  for (const pointer of pointers) {
    assert.ok(available.has(pointer), `Pi cannot invoke generated skill pointer ${pointer}`);
  }
});

test("published tarball inventory retains every upstream asset and Pi runtime guidance", () => {
  const result = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" }))[0];
  const shipped = new Set(result.files.map((file) => file.path));
  const provenance = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
  for (const file of provenance.files) {
    assert.ok(shipped.has(`skills/${file.path}`), `${file.path} omitted from tarball`);
  }
  for (const file of ["LICENSE", "UPSTREAM.md", "README.md", "references/pi-compat.md", "package.json"]) {
    assert.ok(shipped.has(file), `${file} omitted from tarball`);
  }
  assert.ok([...shipped].every((file) => !file.startsWith(".superpowers/") && !file.startsWith("docs/superpowers/")));
});
