#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { bundledThemesRoot, DEFAULT_PORT, studioPaths, VERSION } from "./lib/constants.mjs";
import { fetchTargets, waitForTargets } from "./lib/cdp.mjs";
import { finishHandoff, handoffArguments, readHandoffResult, reserveHandoff, validateHandoff } from "./lib/handoff.mjs";
import { applyToRenderer, removeFromRenderer, rendererStatus, watchRenderer } from "./lib/injector.mjs";
import { createTheme, deleteUserTheme, listThemes, renameUserTheme } from "./lib/theme.mjs";
import { inspectWorkBuddy, isWorkBuddyRunning, launchNormally, launchWithCdp, processCommand, quitWorkBuddy, selectPort, verifiedCdpOwner } from "./lib/workbuddy.mjs";

const entryPath = fileURLToPath(import.meta.url);
const paths = studioPaths();

function parse(argv) {
  const command = argv[0] || "help";
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`unknown argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    options[key.slice(2)] = value; index += 1;
  }
  return { command, options };
}

function port(value) {
  const result = value == null ? DEFAULT_PORT : Number(value);
  if (!Number.isInteger(result) || result < 1024 || result > 65535) throw new Error("port must be between 1024 and 65535");
  return result;
}

async function readState() {
  try { return JSON.parse(await readFile(paths.statePath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function writeState(state) {
  await mkdir(paths.stateRoot, { recursive: true });
  const temporary = `${paths.statePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, paths.statePath);
}

async function themes() {
  return listThemes([bundledThemesRoot, paths.userThemesRoot]);
}

async function liveTargets(portNumber) {
  try { return await fetchTargets(portNumber); } catch { return []; }
}

async function stopWatcher(state) {
  const pid = Number(state?.watcherPid);
  if (!Number.isInteger(pid) || pid < 1) return false;
  const command = await processCommand(pid);
  if (!command.includes(entryPath) || !/(^|\s)watch(\s|$)/.test(command)) return false;
  try { process.kill(pid, "SIGTERM"); return true; } catch { return false; }
}

async function startWatcher(portNumber) {
  const child = spawn(process.execPath, [entryPath, "watch", "--port", String(portNumber)], {
    detached: true, stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

async function validateTheme(options) {
  const allThemes = await themes();
  if (!allThemes.length) throw new Error("no valid themes were found");
  const activeId = options.theme || (await readState())?.themeId || "paper-aurora";
  if (!allThemes.some((theme) => theme.manifest.id === activeId)) throw new Error(`theme not found: ${activeId}`);
  return { allThemes, activeId };
}

async function applyDirect(options) {
  const { allThemes, activeId } = await validateTheme(options);
  const previous = await readState();
  let selectedPort = port(options.port ?? previous?.port);
  let targets = await liveTargets(selectedPort);
  let launch = null;
  if (!targets.length) {
    if (options.restart !== "confirmed") {
      const running = await isWorkBuddyRunning();
      throw new Error(running
        ? "WorkBuddy must restart to enable the skin; save work and rerun with --restart confirmed"
        : "rerun with --restart confirmed to launch WorkBuddy with loopback CDP");
    }
    await stopWatcher(previous);
    await quitWorkBuddy();
    selectedPort = await selectPort(selectedPort);
    launch = await launchWithCdp(selectedPort);
    targets = await waitForTargets(selectedPort);
  }
  const ownership = launch ? "spawn-capability" : await verifiedCdpOwner(selectedPort) ? "process-tree" : null;
  if (!ownership) throw new Error("the CDP listener is not owned by WorkBuddy or its verified process tree");
  const result = await applyToRenderer({ port: selectedPort, themes: allThemes, activeId });
  await stopWatcher(previous);
  const watcherPid = options.watch === "false" ? null : await startWatcher(selectedPort);
  const state = {
    schemaVersion: 1, version: VERSION, status: "active", port: selectedPort,
    themeId: activeId, appPid: launch?.pid ?? null, watcherPid,
    ownership,
    executable: launch?.executable ?? previous?.executable ?? null,
    platform: process.platform,
    updatedAt: new Date().toISOString(),
  };
  await writeState(state);
  return { ok: true, ...result, port: selectedPort, watcherPid };
}

async function startHandoff(options) {
  const { activeId } = await validateTheme(options);
  const previous = await readState();
  const selectedPort = port(options.port ?? previous?.port);
  await mkdir(paths.stateRoot, { recursive: true });
  const reservation = await reserveHandoff(paths, { theme: activeId, port: selectedPort, watch: options.watch });
  await writeState({ schemaVersion: 1, version: VERSION, status: "handoff", themeId: activeId, port: selectedPort, watcherPid: null, updatedAt: new Date().toISOString() });
  const log = await open(paths.logPath, "a", 0o600);
  await log.write(`\n[${new Date().toISOString()}] graceful handoff started: ${activeId}\n`);
  try {
    const child = spawn(process.execPath, [entryPath, ...handoffArguments({ ...options, theme: activeId, port: selectedPort }, reservation.token)], {
      detached: true, stdio: ["ignore", log.fd, log.fd],
    });
    child.unref();
    return { ok: true, handoff: true, status: "pending", themeId: activeId, port: selectedPort, handoffPid: child.pid, resultPath: paths.handoffResultPath, logPath: paths.logPath };
  } finally {
    await log.close();
  }
}

async function apply(options) {
  const previous = await readState();
  const selectedPort = port(options.port ?? previous?.port);
  if ((await liveTargets(selectedPort)).length || options.restart !== "confirmed") return applyDirect(options);
  return startHandoff(options);
}

async function runHandoff(options) {
  const token = options["handoff-token"];
  const reservation = await validateHandoff(paths, token);
  try {
    const applied = await applyDirect({ theme: reservation.themeId, port: String(reservation.port), watch: reservation.watch ? "true" : "false", restart: "confirmed" });
    const verification = await status({ port: String(applied.port) });
    if (!verification.ok) throw new Error("skin handoff applied but verification failed");
    const result = await finishHandoff(paths, token, { status: "complete", ok: true, themeId: applied.themeId, port: applied.port, mode: verification.renderers[0]?.mode ?? null });
    return { ok: true, handoff: true, ...result };
  } catch (error) {
    await writeState({ schemaVersion: 1, version: VERSION, status: "failed", themeId: reservation.themeId, port: reservation.port, watcherPid: null, error: error.message, updatedAt: new Date().toISOString() });
    await finishHandoff(paths, token, { status: "failed", ok: false, error: error.message });
    throw error;
  }
}

async function pause(options) {
  const state = await readState();
  const selectedPort = port(options.port ?? state?.port);
  const watcherStopped = await stopWatcher(state);
  let result = { removed: 0 };
  try { result = await removeFromRenderer(selectedPort); } catch {}
  await writeState({ ...(state || {}), status: "paused", watcherPid: null, updatedAt: new Date().toISOString() });
  return { ok: true, ...result, watcherStopped, port: selectedPort };
}

async function restore(options) {
  if (options.restart !== "confirmed") throw new Error("restore closes and reopens WorkBuddy; rerun with --restart confirmed");
  const paused = await pause(options);
  await quitWorkBuddy();
  await launchNormally();
  await writeState({ schemaVersion: 1, version: VERSION, status: "restored", watcherPid: null, updatedAt: new Date().toISOString() });
  return { ok: true, restored: true, paused };
}

async function status(options) {
  const state = await readState();
  const handoff = await readHandoffResult(paths).catch(() => null);
  const selectedPort = port(options.port ?? state?.port);
  try {
    const renderers = await rendererStatus(selectedPort);
    return { ok: renderers.length > 0 && renderers.every((renderer) => renderer.pass), state, handoff, port: selectedPort, renderers };
  } catch (error) {
    return { ok: false, state, handoff, port: selectedPort, renderers: [], error: error.message };
  }
}

export async function run(argv) {
  const { command, options } = parse(argv);
  if (command === "help") return {
    version: VERSION,
    commands: ["doctor", "list", "create --image PATH --name NAME", "rename --theme ID --name NAME", "delete --theme ID --confirm yes", "apply [--theme ID] --restart confirmed", "switch --theme ID", "status", "verify", "pause", "restore --restart confirmed"],
  };
  if (command === "doctor") {
    const app = await inspectWorkBuddy();
    const state = await readState();
    const identityValid = app.identityValid ?? app.bundleMatches;
    return { ok: app.appFound && identityValid && Number(process.versions.node.split(".")[0]) >= 22, ...app, identityValid, node: process.versions.node, nodeSupported: Number(process.versions.node.split(".")[0]) >= 22, state };
  }
  if (command === "list") return (await themes()).map(({ manifest, root }) => ({ id: manifest.id, name: manifest.name, appearance: manifest.appearance, root }));
  if (command === "create") {
    if (!options.image || !options.name) throw new Error("create requires --image and --name");
    await access(options.image);
    const created = await createTheme({ imagePath: options.image, name: options.name, storeRoot: paths.userThemesRoot });
    return { ok: true, id: created.manifest.id, name: created.manifest.name, root: created.root };
  }
  if (command === "rename") {
    if (!options.theme || !options.name) throw new Error("rename requires --theme and --name");
    const renamed = await renameUserTheme({ id: options.theme, name: options.name, storeRoot: paths.userThemesRoot });
    return { ok: true, id: renamed.manifest.id, name: renamed.manifest.name };
  }
  if (command === "delete") {
    if (!options.theme || options.confirm !== "yes") throw new Error("delete requires --theme ID --confirm yes");
    return { ok: true, ...(await deleteUserTheme({ id: options.theme, storeRoot: paths.userThemesRoot, deletedRoot: paths.deletedThemesRoot })) };
  }
  if (command === "apply" || command === "switch") return apply(command === "switch" ? { ...options, restart: options.restart ?? "no" } : options);
  if (command === "handoff-apply") return runHandoff(options);
  if (command === "pause") return pause(options);
  if (command === "restore") return restore(options);
  if (command === "status" || command === "verify") return status(options);
  if (command === "watch") {
    const allThemes = await themes();
    return watchRenderer({ port: port(options.port), themes: allThemes, activeId: null });
  }
  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`).href)) {
  run(process.argv.slice(2)).then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  });
}
