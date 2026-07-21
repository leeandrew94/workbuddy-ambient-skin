---
name: workbuddy-ambient-skin
description: Apply, create, switch, verify, pause, or restore reversible ambient skins for the WorkBuddy desktop app on macOS or Windows through loopback CDP injection. Use when users want to change WorkBuddy's theme, wallpaper, colors, or visual atmosphere; apply a personal PNG, JPEG, or WebP image; create or switch a WorkBuddy skin; troubleshoot a missing skin; or restore the original WorkBuddy appearance.
---

# WorkBuddy Ambient Skin

Give WorkBuddy a route-aware ambient background and lightweight Material Layer while preserving its native sidebar, composer, messages, menus, and keyboard interaction. Never modify `WorkBuddy.app`, `app.asar`, or the application signature.

## Entry point

Choose the entry point for the current operating system and run all operations through it:

```bash
scripts/workbuddy-ambient.sh <command> [options]
# Windows PowerShell
scripts\workbuddy-ambient.ps1 <command> [options]
```

Read JSON output and report the concrete result. Do not reconstruct CDP commands manually.
Execute the entry point yourself by default. Use Terminal as a documented fallback when the agent sandbox cannot complete an otherwise valid operation, or when the user explicitly asks for manual CLI instructions.

## Workflow

1. Run `scripts/workbuddy-ambient.sh doctor` on macOS or `scripts\workbuddy-ambient.ps1 doctor` on Windows.
2. Stop if WorkBuddy is missing, the macOS bundle id or Windows executable identity is invalid, or the runtime is unsupported.
3. Choose a theme with `list`, or create one from the user's image.
4. Always execute `apply --theme ID` for a conversational theme request. A valid Session Passport makes this a no-restart hot switch without host PID access.
5. If `apply` reports that a restart is required, tell the user to save unsaved WorkBuddy work and obtain explicit permission in chat. After confirmation, execute the same command with `--restart confirmed`; never ask the user to run it by default.
6. When no authenticated CDP session exists, `apply --restart confirmed` starts a detached graceful handoff and returns `status: pending`; do not start a second apply.
7. WorkBuddy closes normally, reopens, signs a new Session Passport, and applies the skin. Run `verify` or `status` to read the recorded handoff result.
8. Report the active theme and visual mode. Mention the loopback port or restore command only when useful.
9. If graceful shutdown fails, stop and explain that forced closure can discard unsaved WorkBuddy input. Obtain a second, separate explicit confirmation for forced closure. Only then rerun with both `--restart confirmed --force-restart confirmed`. Never infer this consent from the earlier restart confirmation.
10. A handoff is one-shot. The injector may reconnect to a refreshed renderer once, but it must never restart WorkBuddy for that retry. If the handoff result is `failed`, never rerun `apply`, restart WorkBuddy, or start another handoff automatically. Report the saved error and stop. The engine requests a normal WorkBuddy launch as a fallback when CDP startup or injection fails.
11. If the agent environment cannot see the host process, cannot launch the detached handoff, cannot send the precisely targeted signal, or cannot access the installed skill, give the user one exact, quoted Terminal command for the detected platform and theme. Explain why host Terminal is required, preserve both consent requirements, and ask the user to paste the JSON result. Do not weaken ownership checks or patch in a process-name fallback.

## Apply a built-in theme

List themes:

```bash
scripts/workbuddy-ambient.sh list
```

After restart permission:

```bash
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
scripts/workbuddy-ambient.sh verify
```

The bundled safe default is `paper-aurora`, a light theme tuned for readable text. `miku-neko-maid` and `doraemon-snow-fortune` are image-based light presets with automatic OKLCH colors. Personal images provide additional visual styles. Do not substitute `switch` for this conversational workflow; `apply` already chooses the authenticated hot path or the safe restart path.

## Create a theme from an image

Accept PNG, JPEG, or WebP up to 15 MB. Use only clean artwork without embedded UI, fake controls, or copyrighted material the user cannot use.

```bash
scripts/workbuddy-ambient.sh create --image "/absolute/image.webp" --name "My Theme"
scripts/workbuddy-ambient.sh apply --theme returned-theme-id --restart confirmed
```

Custom images use one-time renderer analysis for light/dark appearance, OKLCH-derived primary and secondary colors, contrast-corrected text, visual safe area, and focus. Read [theme-schema.md](references/theme-schema.md) only when manually authoring or repairing a theme.

Users can also choose `＋ 选择本地图片` from the top-right `◐` menu. The renderer compresses the image, analyzes it once, persists the versioned palette and composition, and reuses the cached result on later injections. A palette algorithm upgrade invalidates the prior analysis cache without deleting the user's image.

The menu retains up to eight recent image skins. `✎` opens an inline editor and renames one without reanalysis; `×` opens an inline confirmation and deletes it with its analysis cache. These controls do not use Electron system dialogs. For command-created user themes:

```bash
scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "New Name"
scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes
```

Only themes inside the user theme store can be renamed or deleted. CLI deletion moves the theme to a recoverable deleted-themes directory; bundled themes are immutable.

## Switch, pause, and restore

Switch while the verified CDP session is active:

```bash
scripts/workbuddy-ambient.sh switch --theme paper-aurora
```

Users can also switch from the `◐` button at WorkBuddy's top-right. The injected menu uses Shadow DOM and offers installed themes plus the native appearance.

Pause without restarting:

```bash
scripts/workbuddy-ambient.sh pause
```

Restore the native appearance and close the debugging session only after restart permission:

```bash
scripts/workbuddy-ambient.sh restore --restart confirmed
```

## Guardrails

- Bind CDP only to `127.0.0.1`; warn users not to run untrusted local software while it is active.
- Require explicit permission before closing or restarting WorkBuddy.
- Never force-kill WorkBuddy by default. Forced closure requires a second explicit confirmation after graceful shutdown fails and must use `--force-restart confirmed`.
- Force only the revalidated official WorkBuddy main executable. Never use `pkill Electron`, `killall Electron`, `taskkill /IM`, or another broad process-name kill.
- On Windows, accept only a resolved `WorkBuddy.exe` from an explicit override, known install location, or WorkBuddy uninstall registry entry, and require a valid signature or matching product identity.
- On Windows, serialize public operations with the per-user named mutex and verify CDP ownership through the exact executable process tree.
- Let the built-in graceful handoff survive the host restart. Do not wrap `apply` in another `nohup`, `pkill`, or custom restart script.
- Accept only the exact WorkBuddy renderer URL shape and native DOM markers.
- Sign a Session Passport only after this skill launched WorkBuddy or verified the official WorkBuddy process tree. For later hot switches, require the saved Browser ID and renderer HMAC challenge to match.
- Never accept a listener merely because `lsof` labels it Electron or WorkBuddy. A process-name fallback is not a valid ownership proof.
- Keep the passport secret only in the mode-`0600` state file and renderer closure. Never print it in `doctor`, `status`, logs, or command arguments.
- Stop a watcher only when its PID command matches this skill's exact entry point and `watch` command.
- Keep decoration non-interactive and keep work/detail backgrounds quieter than the home background.
- Apply Material Layer effects only to known WorkBuddy regions. Keep panel surfaces opaque enough for readable text and retain visible keyboard focus.
- Use `pause` for immediate visual cleanup and `restore` to close the CDP port through a restart. Apply the same separate forced-closure consent if normal shutdown fails.
- Never offer live or temporary injection into an ordinarily launched WorkBuddy process. Injection requires a verified CDP session; `pause` only removes a skin that is already active.

## Verification

Treat the operation as successful only when `verify` reports an installed renderer state, the requested theme, the menu, and a known mode (`home`, `work`, or `detail`).

## Troubleshooting signals

- `fetch failed` means the saved/default CDP port is unavailable; diagnose launch or port state.
- `status: pending` with `handoff: true` means the restart was safely delegated; wait for WorkBuddy to reopen instead of launching another apply.
- `the active skin session could not be authenticated` means neither the Session Passport nor the visible process tree proved ownership. Ask for restart permission in chat and execute `apply --restart confirmed` yourself.
- If the same authentication or handoff failure remains because the agent sandbox cannot reach host state, provide the exact installed entry-point command as the final fallback. Use the real detected path, quote it, and include `--restart confirmed` only after the user authorized a restart.
- `WorkBuddy did not quit cleanly` means the graceful path was blocked. Ask separately whether the user accepts possible loss of unsaved input. After confirmation, run `apply --theme ID --restart confirmed --force-restart confirmed`; if the sandbox cannot deliver the exact signal, provide that same command for the host Terminal.
- `WorkBuddy normal launch was requested as fallback` means CDP startup or injection failed after the single restart attempt. WorkBuddy was asked to reopen normally; report the error and do not run `apply` again automatically.
- `WorkBuddy DOM ... missing markers` means CDP discovery and ownership verification already passed. Diagnose renderer readiness or a WorkBuddy DOM adapter change; do not attribute this error to the single-instance lock or process-query sandbox.
