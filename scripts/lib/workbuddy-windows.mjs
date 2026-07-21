import { execFile as execFileCallback } from "node:child_process";
import net from "node:net";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { DEFAULT_PORT, PORT_SCAN_LIMIT } from "./constants.mjs";

const execFile = promisify(execFileCallback);
const helperPath = join(dirname(fileURLToPath(import.meta.url)), "workbuddy-windows.ps1");

export function normalizeWindowsPath(value) {
  return win32.normalize(String(value || "").trim()).replace(/[\\/]+$/, "").toLowerCase();
}

export function candidateWindowsPaths({ localAppData = "", programFiles = "", programFilesX86 = "" } = {}) {
  return [
    localAppData && win32.join(localAppData, "workbuddy", "WorkBuddy.exe"),
    localAppData && win32.join(localAppData, "Programs", "workbuddy", "WorkBuddy.exe"),
    programFiles && win32.join(programFiles, "WorkBuddy", "WorkBuddy.exe"),
    programFilesX86 && win32.join(programFilesX86, "WorkBuddy", "WorkBuddy.exe"),
  ].filter(Boolean);
}

async function runPowerShell(action, values = []) {
  const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", helperPath, "-Action", action, ...values.map(String)];
  let result;
  try { result = await execFile("powershell.exe", args, { windowsHide: true, maxBuffer: 1024 * 1024 }); }
  catch (error) {
    if (error.code !== "ENOENT") throw new Error(error.stderr?.trim() || error.message);
    try { result = await execFile("pwsh.exe", args, { windowsHide: true, maxBuffer: 1024 * 1024 }); }
    catch (fallback) { throw new Error(fallback.stderr?.trim() || "PowerShell was not found"); }
  }
  const output = result.stdout.trim();
  if (!output) throw new Error(`Windows platform helper returned no result for ${action}`);
  try { return JSON.parse(output.split(/\r?\n/).at(-1)); }
  catch { throw new Error(`Windows platform helper returned malformed JSON for ${action}`); }
}

export async function inspectWorkBuddy() { return runPowerShell("inspect"); }
export async function isWorkBuddyRunning() { return Boolean(await runPowerShell("is-running")); }

async function freePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)));
  });
}

export async function selectPort(preferred = DEFAULT_PORT) {
  for (let offset = 0; offset < PORT_SCAN_LIMIT; offset += 1) {
    const port = preferred + offset;
    if (port <= 65535 && await freePort(port)) return port;
  }
  throw new Error("no free loopback CDP port was found");
}

export async function quitWorkBuddy({ timeoutMs = 15000 } = {}) {
  return runPowerShell("quit", ["-TimeoutMs", timeoutMs]);
}

export async function launchWithCdp(port) {
  return runPowerShell("launch-cdp", ["-Port", port]);
}

export async function launchNormally() { await runPowerShell("launch-normal"); }

export async function processCommand(pid) {
  if (!Number.isInteger(pid) || pid < 1) return "";
  return runPowerShell("process-command", ["-ProcessId", pid]);
}

export async function verifiedCdpOwner(port) {
  return Boolean(await runPowerShell("verify-owner", ["-Port", port]));
}
