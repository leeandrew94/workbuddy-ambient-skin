import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCT_ID = "workbuddy-ambient-skin";
export const VERSION = "0.6.0";
export const BUNDLE_ID = "com.workbuddy.workbuddy";
export const APP_PATH = "/Applications/WorkBuddy.app";
export const DEFAULT_PORT = 9347;
export const PORT_SCAN_LIMIT = 20;
export const RENDERER_SUFFIX = "/app.asar/renderer/index.html";
export const STYLE_ID = "workbuddy-ambient-skin-style";
export const HOST_ID = "workbuddy-ambient-skin-host";
export const STATE_KEY = "__WORKBUDDY_AMBIENT_SKIN__";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const libDir = dirname(fileURLToPath(import.meta.url));
export const skillRoot = resolve(libDir, "../..");
export const assetsRoot = join(skillRoot, "assets");
export const bundledThemesRoot = join(assetsRoot, "themes");

export function studioPaths(home = homedir()) {
  const stateRoot = join(home, "Library", "Application Support", "WorkBuddyAmbientSkin");
  return {
    stateRoot,
    statePath: join(stateRoot, "state.json"),
    userThemesRoot: join(stateRoot, "themes"),
    deletedThemesRoot: join(stateRoot, "deleted-themes"),
    logPath: join(stateRoot, "ambient.log"),
    handoffLockPath: join(stateRoot, "handoff.lock.json"),
    handoffResultPath: join(stateRoot, "handoff-result.json"),
  };
}
