import * as macos from "./workbuddy-macos.mjs";
import * as windows from "./workbuddy-windows.mjs";

function platform() {
  if (process.platform === "darwin") return macos;
  if (process.platform === "win32") return windows;
  throw new Error(`unsupported platform: ${process.platform}; use macOS or Windows`);
}

export const inspectWorkBuddy = (...args) => platform().inspectWorkBuddy(...args);
export const forceQuitWorkBuddy = (...args) => platform().forceQuitWorkBuddy(...args);
export const isWorkBuddyRunning = (...args) => platform().isWorkBuddyRunning(...args);
export const launchNormally = (...args) => platform().launchNormally(...args);
export const launchWithCdp = (...args) => platform().launchWithCdp(...args);
export const processCommand = (...args) => platform().processCommand(...args);
export const quitWorkBuddy = (...args) => platform().quitWorkBuddy(...args);
export const selectPort = (...args) => platform().selectPort(...args);
export const verifiedCdpOwner = (...args) => platform().verifiedCdpOwner(...args);

// Kept as named exports for focused platform unit tests and compatibility.
export const isMainWorkBuddyCommand = macos.isMainWorkBuddyCommand;
export const parseApplicationRunning = macos.parseApplicationRunning;
export const parseExactExecutablePids = macos.parseExactExecutablePids;
export { candidateWindowsPaths, normalizeWindowsPath } from "./workbuddy-windows.mjs";
