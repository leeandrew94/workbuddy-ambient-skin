import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, open } from "node:fs/promises";
import { promisify } from "node:util";

import { APP_PATH, BUNDLE_ID, studioPaths } from "./constants.mjs";

const execFile = promisify(execFileCallback);
const executable = `${APP_PATH}/Contents/MacOS/Electron`;
const plist = `${APP_PATH}/Contents/Info.plist`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(path) { try { await access(path); return true; } catch { return false; } }

export async function inspectWorkBuddy() {
  if (!await exists(APP_PATH)) return { appFound: false, appPath: APP_PATH };
  let bundleId = null;
  let version = null;
  try {
    bundleId = (await execFile("/usr/bin/plutil", ["-extract", "CFBundleIdentifier", "raw", "-o", "-", plist])).stdout.trim();
    version = (await execFile("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", plist])).stdout.trim();
  } catch {}
  return { appFound: true, appPath: APP_PATH, executable, bundleId, bundleMatches: bundleId === BUNDLE_ID, version };
}

export function parseBundleExecutablePids(output, appPath = APP_PATH) {
  const matches = new Set();
  let pid = null;
  let sawExecutable = false;
  for (const line of String(output || "").split(/\r?\n/)) {
    if (line.startsWith("p")) {
      const candidate = Number(line.slice(1));
      pid = Number.isInteger(candidate) && candidate > 1 ? candidate : null;
      sawExecutable = false;
    } else if (pid && line.startsWith("n") && !sawExecutable) {
      sawExecutable = true;
      if (line.slice(1).startsWith(`${appPath}/Contents/`)) matches.add(pid);
    }
  }
  return [...matches];
}

export async function bundleWorkBuddyPids(run = execFile) {
  try {
    const { stdout } = await run("/usr/sbin/lsof", ["-n", "-a", "-d", "txt", "-Fpcn"], { maxBuffer: 32 * 1024 * 1024 });
    return parseBundleExecutablePids(stdout);
  } catch (error) {
    throw new Error(`could not enumerate the WorkBuddy process family: ${error.message}`);
  }
}

export async function forceQuitWorkBuddy({ timeoutMs = 8000, settleMs = 2000, inspect = inspectWorkBuddy, findPids = bundleWorkBuddyPids, signal = process.kill, wait = sleep } = {}) {
  const info = await inspect();
  if (!info.appFound || !info.bundleMatches || info.executable !== executable) throw new Error("official WorkBuddy bundle could not be verified");
  const initial = await findPids();
  if (!initial.length) { await wait(settleMs); return { stopped: true, forced: false, pids: [] }; }
  const killed = new Set();
  const deadline = Date.now() + timeoutMs;
  let emptySince = null;
  while (Date.now() < deadline) {
    const current = await findPids();
    if (!current.length) {
      emptySince ??= Date.now();
      if (Date.now() - emptySince >= 500) {
        await wait(settleMs);
        if (!(await findPids()).length) return { stopped: true, forced: true, pids: [...killed], settledMs: settleMs };
        emptySince = null;
      }
    } else {
      emptySince = null;
      for (const pid of current) {
        try { signal(pid, "SIGKILL"); killed.add(pid); }
        catch (error) { if (error.code !== "ESRCH") throw error; }
      }
    }
    await wait(100);
  }
  throw new Error(`WorkBuddy processes did not stop: ${(await findPids()).join(", ")}`);
}

export async function launchWithCdp(port) {
  const info = await inspectWorkBuddy();
  if (!info.appFound || !info.bundleMatches) throw new Error("official WorkBuddy bundle was not found");
  const paths = studioPaths();
  await mkdir(paths.stateRoot, { recursive: true, mode: 0o700 });
  const log = await open(paths.launchLogPath, "a", 0o600);
  await log.write(`\n[${new Date().toISOString()}] LaunchServices open ${APP_PATH} --args --remote-debugging-port=${port}\n`);
  try {
    // LaunchServices creates WorkBuddy outside the Agent's inherited sandbox.
    // Directly spawning Electron from an in-app Agent causes Chromium helpers to
    // fail with "sandbox initialization failed: Operation not permitted".
    await execFile("/usr/bin/open", ["-n", APP_PATH, "--args", `--remote-debugging-port=${port}`]);
    return { port, executable, launcher: "LaunchServices", logPath: paths.launchLogPath };
  } finally { await log.close(); }
}

export async function launchNormally() {
  await execFile("/usr/bin/open", [APP_PATH]);
}
