import { randomUUID } from "node:crypto";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";

const LOCK_TTL_MS = 2 * 60 * 1000;

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function handoffArguments(options, token) {
  const args = ["handoff-apply", "--theme", options.theme || "paper-aurora", "--port", String(options.port), "--handoff-token", token];
  if (options.watch === "false") args.push("--watch", "false");
  return args;
}

export async function reserveHandoff(paths, { theme, port, watch, now = Date.now() }) {
  let handle;
  try {
    handle = await open(paths.handoffLockPath, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = await readJson(paths.handoffLockPath).catch(() => null);
    if (existing?.startedAt && now - Date.parse(existing.startedAt) < LOCK_TTL_MS) {
      throw new Error(`a skin handoff is already running for theme ${existing.themeId || "unknown"}`);
    }
    await unlink(paths.handoffLockPath).catch((unlinkError) => { if (unlinkError.code !== "ENOENT") throw unlinkError; });
    handle = await open(paths.handoffLockPath, "wx", 0o600);
  }
  const token = randomUUID();
  const reservation = { token, themeId: theme, port, watch: watch !== "false", startedAt: new Date(now).toISOString() };
  await handle.writeFile(`${JSON.stringify(reservation, null, 2)}\n`);
  await handle.close();
  await writeJsonAtomic(paths.handoffResultPath, { status: "pending", themeId: theme, port, startedAt: reservation.startedAt });
  return reservation;
}

export async function validateHandoff(paths, token) {
  const reservation = await readJson(paths.handoffLockPath);
  if (!reservation || typeof token !== "string" || token.length < 20 || reservation.token !== token) {
    throw new Error("invalid or expired skin handoff token");
  }
  return reservation;
}

export async function finishHandoff(paths, token, result) {
  const reservation = await validateHandoff(paths, token);
  const completed = { ...result, themeId: result.themeId || reservation.themeId, port: result.port || reservation.port, finishedAt: new Date().toISOString() };
  await writeJsonAtomic(paths.handoffResultPath, completed);
  const current = await readJson(paths.handoffLockPath);
  if (current?.token === token) await unlink(paths.handoffLockPath);
  return completed;
}

export async function readHandoffResult(paths) {
  return readJson(paths.handoffResultPath);
}
