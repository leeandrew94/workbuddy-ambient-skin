import { execFile as execFileCallback, spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import { promisify } from "node:util";

import { APP_PATH, BUNDLE_ID, DEFAULT_PORT, PORT_SCAN_LIMIT } from "./constants.mjs";

const execFile = promisify(execFileCallback);
const executable = `${APP_PATH}/Contents/MacOS/Electron`;
const plist = `${APP_PATH}/Contents/Info.plist`;

async function exists(path) { try { await access(path); return true; } catch { return false; } }

export async function inspectWorkBuddy() {
  const appFound = await exists(APP_PATH);
  if (!appFound) return { appFound: false, appPath: APP_PATH };
  let bundleId = null;
  let version = null;
  try {
    bundleId = (await execFile("/usr/bin/plutil", ["-extract", "CFBundleIdentifier", "raw", "-o", "-", plist])).stdout.trim();
    version = (await execFile("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", plist])).stdout.trim();
  } catch {}
  return { appFound: true, appPath: APP_PATH, executable, bundleId, bundleMatches: bundleId === BUNDLE_ID, version };
}

export function isMainWorkBuddyCommand(command) {
  if (command === executable) return true;
  if (!command.startsWith(`${executable} `)) return false;
  const args = command.slice(executable.length + 1).trim().split(/\s+/);
  if (args.length !== 2) return false;
  const address = args.find((arg) => arg.startsWith("--remote-debugging-address="));
  const port = args.find((arg) => arg.startsWith("--remote-debugging-port="));
  if (address !== "--remote-debugging-address=127.0.0.1" || !port) return false;
  const portNumber = Number(port.slice("--remote-debugging-port=".length));
  return Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535;
}

export async function runningPids() {
  try {
    const { stdout } = await execFile("/usr/bin/pgrep", ["-f", `^${executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`]);
    const candidates = stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger);
    const commands = await Promise.all(candidates.map(async (pid) => ({ pid, command: await processCommand(pid) })));
    return commands.filter(({ command }) => isMainWorkBuddyCommand(command)).map(({ pid }) => pid);
  } catch { return []; }
}

export function parseApplicationRunning(value) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("unexpected WorkBuddy application state");
}

export async function isWorkBuddyRunning(run = execFile) {
  try {
    const { stdout } = await run("/usr/bin/osascript", ["-e", 'application "WorkBuddy" is running']);
    return parseApplicationRunning(stdout);
  } catch (error) {
    throw new Error(`could not determine whether WorkBuddy is running: ${error.message}`);
  }
}

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

export async function quitWorkBuddy({ timeoutMs = 15000, isRunning = isWorkBuddyRunning } = {}) {
  const wasRunning = await isRunning();
  if (!wasRunning) return { wasRunning: false, stopped: true };
  await execFile("/usr/bin/osascript", ["-e", 'tell application "WorkBuddy" to quit']).catch(() => {});
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await isRunning()) return { wasRunning: true, stopped: true };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("WorkBuddy did not quit cleanly; no process was force-killed");
}

export async function launchWithCdp(port) {
  const info = await inspectWorkBuddy();
  if (!info.appFound || !info.bundleMatches) throw new Error("official WorkBuddy bundle was not found at /Applications/WorkBuddy.app");
  const child = spawn(executable, [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`], {
    detached: true, stdio: "ignore",
  });
  child.unref();
  return { pid: child.pid, port, executable };
}

export async function launchNormally() {
  await execFile("/usr/bin/open", ["-a", APP_PATH]);
}

export async function processCommand(pid) {
  if (!Number.isInteger(pid) || pid < 1) return "";
  try { return (await execFile("/bin/ps", ["-p", String(pid), "-o", "command="])).stdout.trim(); }
  catch { return ""; }
}

async function processIdentity(pid) {
  try {
    const output = (await execFile("/bin/ps", ["-p", String(pid), "-o", "ppid=", "-o", "command="])).stdout.trim();
    const match = /^(\d+)\s+([\s\S]+)$/.exec(output);
    return match ? { parentPid: Number(match[1]), command: match[2] } : null;
  } catch { return null; }
}

export async function verifiedCdpOwner(port) {
  let listeners = [];
  try {
    const output = (await execFile("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])).stdout.trim();
    listeners = output.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger);
  } catch { return false; }
  for (const listener of listeners) {
    let pid = listener;
    const seen = new Set();
    for (let depth = 0; depth < 8 && pid > 1 && !seen.has(pid); depth += 1) {
      seen.add(pid);
      const identity = await processIdentity(pid);
      if (!identity) break;
      if (identity.command === executable || identity.command.startsWith(`${executable} `)) return true;
      pid = identity.parentPid;
    }
  }
  return false;
}
