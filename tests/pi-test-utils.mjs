import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createPiSandbox(t) {
  const directory = mkdtempSync(join(tmpdir(), "pi-tsuga runtime "));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const agentDir = join(directory, "agent");
  mkdirSync(agentDir);
  writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ enableInstallTelemetry: false, enableAnalytics: false }));
  return {
    cwd: directory,
    env: {
      ...process.env,
      HOME: directory,
      XDG_CONFIG_HOME: join(directory, "config"),
      XDG_DATA_HOME: join(directory, "data"),
      XDG_CACHE_HOME: join(directory, "cache"),
      PI_CODING_AGENT_DIR: agentDir,
      PI_CODING_AGENT_SESSION_DIR: join(directory, "sessions"),
      PI_OFFLINE: "1",
      PI_SKIP_VERSION_CHECK: "1",
      PI_TELEMETRY: "0",
    },
  };
}

export function installPackage(source, sandbox) {
  const result = spawnSync("pi", ["install", source], { ...sandbox, encoding: "utf8", timeout: 90_000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}

export function getCommands(sandbox) {
  return new Promise((resolve, reject) => {
    const child = spawn("pi", ["--mode", "rpc", "--offline", "--no-session", "--no-extensions", "--no-context-files", "--no-approve"], sandbox);
    let buffer = "";
    let stderr = "";
    let response;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Pi RPC command discovery timed out: ${stderr}`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, "");
        buffer = buffer.slice(end + 1);
        if (!line) continue;
        try {
          const record = JSON.parse(line);
          if (record.id === "commands") {
            response = record;
            child.stdin.end();
          }
        } catch (error) {
          child.kill("SIGKILL");
          clearTimeout(timeout);
          reject(error);
        }
      }
    });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || !response?.success) {
        reject(new Error(`Pi RPC failed (exit ${code}): ${stderr}; ${JSON.stringify(response)}`));
      } else {
        resolve({ commands: response.data.commands, stderr });
      }
    });
    child.stdin.on("error", (error) => { clearTimeout(timeout); child.kill("SIGKILL"); reject(error); });
    child.stdin.write(`${JSON.stringify({ id: "commands", type: "get_commands" })}\n`);
  });
}
