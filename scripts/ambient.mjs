#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { bundledThemesRoot, DEFAULT_PORT, studioPaths, VERSION } from "./lib/constants.mjs";
import { fetchBrowserIdentity, fetchTargets, waitForTargets } from "./lib/cdp.mjs";
import { finishHandoff, handoffArguments, readHandoffResult, reserveHandoff, validateHandoff } from "./lib/handoff.mjs";
import { applyToRenderer, removeFromRenderer, rendererStatus, verifyRendererPassport, watchRenderer } from "./lib/injector.mjs";
import { createPassport, publicState, validPassport } from "./lib/session.mjs";
import { stopForRestart } from "./lib/restart.mjs";
import { createTheme, deleteUserTheme, listThemes, renameUserTheme } from "./lib/theme.mjs";
import { forceQuitWorkBuddy, inspectWorkBuddy, isWorkBuddyRunning, launchNormally, launchWithCdp, processCommand, quitWorkBuddy, selectPort, verifiedCdpOwner } from "./lib/workbuddy.mjs";
import { chooseApplyPath } from "./lib/workflow.mjs";

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
  await mkdir(paths.stateRoot, { recursive: true, mode: 0o700 });
  await chmod(paths.stateRoot, 0o700).catch(() => {});
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

async function startWatcher(portNumber, generation) {
  const child = spawn(process.execPath, [entryPath, "watch", "--port", String(portNumber), "--generation", generation], {
    detached: true, stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

async function passportForPort(portNumber) {
  const identity = await fetchBrowserIdentity(portNumber);
  return createPassport(identity.browserId);
}

async function authorizeLiveSession(state, portNumber) {
  if (state?.port === portNumber && validPassport(state.passport)) {
    try {
      const proof = await verifyRendererPassport({ port: portNumber, passport: state.passport });
      if (proof.trusted) return { ownership: "session-passport", passport: state.passport };
    } catch {}
  }
  if (await verifiedCdpOwner(portNumber)) {
    return { ownership: "process-tree", passport: await passportForPort(portNumber) };
  }
  return null;
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
  let shutdown = null;
  let authorization = targets.length ? await authorizeLiveSession(previous, selectedPort) : null;
  if (!targets.length || !authorization) {
    if (options.restart !== "confirmed") {
      const running = await isWorkBuddyRunning();
      const detail = targets.length ? "the active skin session could not be authenticated from this sandbox" : "WorkBuddy needs a loopback CDP session";
      throw new Error(running
        ? `${detail}; save work and rerun with --restart confirmed`
        : `${detail}; rerun with --restart confirmed to launch WorkBuddy`);
    }
    if (targets.length && options["replace-session"] !== "confirmed") {
      throw new Error("the active skin session is not authenticated; use the graceful handoff to replace it");
    }
    await stopWatcher(previous);
    shutdown = await stopForRestart({ forceRestart: options["force-restart"], quit: quitWorkBuddy, forceQuit: forceQuitWorkBuddy });
    selectedPort = await selectPort(selectedPort);
    try {
      launch = await launchWithCdp(selectedPort);
      targets = await waitForTargets(selectedPort);
    } catch (error) {
      await launchNormally().catch(() => {});
      throw new Error(`${error.message}; WorkBuddy normal launch was requested as fallback`);
    }
    authorization = { ownership: "spawn-capability", passport: await passportForPort(selectedPort) };
  }
  const { ownership, passport } = authorization;
  let result;
  try {
    result = await applyToRenderer({ port: selectedPort, themes: allThemes, activeId, passport });
  } catch (error) {
    if (launch) await launchNormally().catch(() => {});
    throw new Error(launch ? `${error.message}; WorkBuddy normal launch was requested as fallback` : error.message);
  }
  await stopWatcher(previous);
  const watcherGeneration = options.watch === "false" ? null : randomUUID();
  const state = {
    schemaVersion: 2, version: VERSION, status: "active", port: selectedPort,
    themeId: activeId, appPid: launch?.pid ?? previous?.appPid ?? null, watcherPid: null,
    watcherGeneration, ownership, passport,
    executable: launch?.executable ?? previous?.executable ?? null,
    platform: process.platform,
    updatedAt: new Date().toISOString(),
  };
  await writeState(state);
  const watcherPid = watcherGeneration ? await startWatcher(selectedPort, watcherGeneration) : null;
  await writeState({ ...state, watcherPid, updatedAt: new Date().toISOString() });
  return { ok: true, ...result, port: selectedPort, watcherPid, ownership, sessionPassport: true, ...(shutdown || {}) };
}

async function startHandoff(options) {
  const { activeId } = await validateTheme(options);
  const previous = await readState();
  const selectedPort = port(options.port ?? previous?.port);
  await mkdir(paths.stateRoot, { recursive: true });
  const reservation = await reserveHandoff(paths, { theme: activeId, port: selectedPort, watch: options.watch });
  await writeState({ schemaVersion: 2, version: VERSION, status: "handoff", themeId: activeId, port: selectedPort, watcherPid: null, watcherGeneration: null, updatedAt: new Date().toISOString() });
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
  const targets = await liveTargets(selectedPort);
  const authorization = targets.length ? await authorizeLiveSession(previous, selectedPort) : null;
  const path = chooseApplyPath({ targetsAvailable: targets.length > 0, authenticated: Boolean(authorization), restartConfirmed: options.restart === "confirmed" });
  return path === "handoff" ? startHandoff(options) : applyDirect(options);
}

async function runHandoff(options) {
  const token = options["handoff-token"];
  const reservation = await validateHandoff(paths, token);
  try {
    const applied = await applyDirect({ theme: reservation.themeId, port: String(reservation.port), watch: reservation.watch ? "true" : "false", restart: "confirmed", "force-restart": options["force-restart"], "replace-session": "confirmed" });
    const verification = await status({ port: String(applied.port) });
    if (!verification.ok) throw new Error("skin handoff applied but verification failed");
    const result = await finishHandoff(paths, token, {
      status: "complete", ok: true, themeId: applied.themeId, port: applied.port,
      mode: verification.renderers[0]?.mode ?? null,
      forceRestarted: applied.forceRestarted ?? false,
      ...(applied.gracefulError ? { gracefulError: applied.gracefulError } : {}),
    });
    return { ok: true, handoff: true, ...result };
  } catch (error) {
    await writeState({ schemaVersion: 2, version: VERSION, status: "failed", themeId: reservation.themeId, port: reservation.port, watcherPid: null, watcherGeneration: null, error: error.message, updatedAt: new Date().toISOString() });
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
  await writeState({ ...(state || {}), status: "paused", watcherPid: null, watcherGeneration: null, updatedAt: new Date().toISOString() });
  return { ok: true, ...result, watcherStopped, port: selectedPort };
}

async function restore(options) {
  if (options.restart !== "confirmed") throw new Error("restore closes and reopens WorkBuddy; rerun with --restart confirmed");
  const paused = await pause(options);
  const shutdown = await stopForRestart({ forceRestart: options["force-restart"], quit: quitWorkBuddy, forceQuit: forceQuitWorkBuddy });
  await launchNormally();
  await writeState({ schemaVersion: 2, version: VERSION, status: "restored", watcherPid: null, watcherGeneration: null, updatedAt: new Date().toISOString() });
  return { ok: true, restored: true, paused, ...shutdown };
}

async function status(options) {
  const state = await readState();
  const handoff = await readHandoffResult(paths).catch(() => null);
  const selectedPort = port(options.port ?? state?.port);
  try {
    const session = await authorizeLiveSession(state, selectedPort);
    const renderers = await rendererStatus(selectedPort);
    return { ok: Boolean(session) && renderers.length > 0 && renderers.every((renderer) => renderer.pass), state: publicState(state), handoff, port: selectedPort, ownership: session?.ownership ?? null, renderers };
  } catch (error) {
    return { ok: false, state: publicState(state), handoff, port: selectedPort, renderers: [], error: error.message };
  }
}

export async function run(argv) {
  const { command, options } = parse(argv);
  if (command === "help") return {
    version: VERSION,
    commands: ["doctor", "list", "create --image PATH --name NAME", "rename --theme ID --name NAME", "delete --theme ID --confirm yes", "apply [--theme ID] --restart confirmed [--force-restart confirmed]", "switch --theme ID", "status", "verify", "pause", "restore --restart confirmed [--force-restart confirmed]"],
  };
  if (command === "doctor") {
    const app = await inspectWorkBuddy();
    const state = await readState();
    const identityValid = app.identityValid ?? app.bundleMatches;
    return { ok: app.appFound && identityValid && Number(process.versions.node.split(".")[0]) >= 22, ...app, identityValid, node: process.versions.node, nodeSupported: Number(process.versions.node.split(".")[0]) >= 22, state: publicState(state) };
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
  if (command === "apply" || command === "switch") return apply(options);
  if (command === "handoff-apply") return runHandoff(options);
  if (command === "pause") return pause(options);
  if (command === "restore") return restore(options);
  if (command === "status" || command === "verify") return status(options);
  if (command === "watch") {
    const state = await readState();
    if (!options.generation || state?.watcherGeneration !== options.generation || !validPassport(state?.passport)) {
      return { stopped: true, reason: "superseded" };
    }
    const allThemes = await themes();
    return watchRenderer({
      port: port(options.port), themes: allThemes, activeId: null, passport: state.passport,
      isCurrent: async () => (await readState())?.watcherGeneration === options.generation,
    });
  }
  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`).href)) {
  run(process.argv.slice(2)).then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  });
}
