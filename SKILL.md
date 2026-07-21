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
Treat Agent execution and host-Terminal execution as equal user-selectable modes. Never silently choose Agent execution first and downgrade Terminal to a fallback.

## Workflow

1. Run `scripts/workbuddy-ambient.sh doctor` on macOS or `scripts\workbuddy-ambient.ps1 doctor` on Windows.
2. Stop if WorkBuddy is missing, the macOS bundle id or Windows executable identity is invalid, or the runtime is unsupported.
3. Choose a theme with `list`, or create one from the user's image. Do not execute `apply` yet, including an unconfirmed hot-switch probe.
4. Present exactly this two-option choice with the selected theme name and wait for the user's answer:
   - **① 确认 apply**：Agent 执行并验证皮肤；如果需要重启，可能丢失未保存内容。
   - **② 复制命令跑**：Agent 不操作 WorkBuddy，只返回一条完整的本机终端命令。
5. If the user selects **① 确认 apply**, execute `apply --theme ID --restart confirmed`, wait for the single handoff result, then run `verify` once. Treat this selection as the one restart confirmation.
6. If the user selects **② 复制命令跑**, do not execute, restart, inspect processes, or diagnose anything. Return one exact installed `terminal-apply --theme ID --restart confirmed` command for the current platform.
7. Respect the selected mode. Never execute any apply before offering the choice, never treat the command as a failure fallback, and never switch modes without a new user request.
8. For Agent apply, `status: pending` means the detached restart worker owns the transaction. Do not start another apply. Read the one saved completion result and verify once after WorkBuddy reopens.
9. The restart transaction precisely closes the verified WorkBuddy process family, waits for resources to settle, launches fixed-port loopback CDP once, injects once, and verifies once.
10. If either mode fails, report only its final JSON error plus the launch-log path. Do not restart, retry, run extra process diagnostics, infer proxy causes, or switch to the other mode automatically.
11. Never hide a CDP failure by launching WorkBuddy normally. When reading logs, use entries from the current transaction timestamp only; do not treat historical `did not quit cleanly` or old-port entries as the current implementation's result.

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

Manual Terminal choice on macOS:

```bash
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" terminal-apply --theme paper-aurora --restart confirmed
```

Manual Terminal choice on Windows PowerShell:

```powershell
& "$HOME\.workbuddy\skills\workbuddy-ambient-skin\scripts\workbuddy-ambient.ps1" terminal-apply --theme paper-aurora --restart confirmed
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
- Never close WorkBuddy without explicit permission. One `--restart confirmed` authorizes one bounded restart transaction that precisely closes only the revalidated official WorkBuddy process family.
- Force only the revalidated official WorkBuddy process family: on macOS require each process's first executable mapping to live inside the official app bundle; on Windows require the exact verified installation path. Never use `pkill Electron`, `killall Electron`, `taskkill /IM`, or another broad process-name kill.
- On Windows, accept only a resolved `WorkBuddy.exe` from an explicit override, known install location, or WorkBuddy uninstall registry entry, and require a valid signature or matching product identity.
- On Windows, serialize public operations with the per-user named mutex and verify CDP ownership through the exact executable process tree.
- Let the built-in detached restart worker survive the host restart. Do not wrap `apply` in another `nohup`, `pkill`, or custom restart script.
- Accept only the exact WorkBuddy renderer URL shape and native DOM markers.
- Sign a Session Passport only after this skill launched WorkBuddy or verified the official WorkBuddy process tree. For later hot switches, require the saved Browser ID and renderer HMAC challenge to match.
- Never accept a listener merely because `lsof` labels it Electron or WorkBuddy. A process-name fallback is not a valid ownership proof.
- Keep the passport secret only in the mode-`0600` state file and renderer closure. Never print it in `doctor`, `status`, logs, or command arguments.
- Stop a watcher only when its PID command matches this skill's exact entry point and `watch` command.
- Keep decoration non-interactive and keep work/detail backgrounds quieter than the home background.
- Apply Material Layer effects only to known WorkBuddy regions. Keep panel surfaces opaque enough for readable text and retain visible keyboard focus.
- Use `pause` for immediate visual cleanup and `restore` to close the CDP port through the same once-confirmed restart transaction.
- Never offer live or temporary injection into an ordinarily launched WorkBuddy process. Injection requires a verified CDP session; `pause` only removes a skin that is already active.

## Verification

Treat the operation as successful only when `verify` reports an installed renderer state, the requested theme, the menu, and a known mode (`home`, `work`, or `detail`).

## Troubleshooting signals

- `fetch failed` means the saved/default CDP port is unavailable; diagnose launch or port state.
- `status: pending` with `handoff: true` means the restart was safely delegated; wait for WorkBuddy to reopen instead of launching another apply.
- `the active skin session could not be authenticated` means neither the Session Passport nor the visible process tree proved ownership. Ask for restart permission in chat and execute `apply --restart confirmed` yourself.
- When the user selects Manual Terminal, provide the exact installed `terminal-apply --theme ID --restart confirmed` command immediately. Do not run Agent apply first and do not provide a partial CDP command when the synchronous command can also inject and verify.
- A forced-shutdown error means process identity could not be revalidated or a verified process survived. Report the exact error and do not broaden the kill target.
- A CDP startup or injection failure remains visible as the final error; the skill does not replace it with an ordinary WorkBuddy launch. Do not run `apply` again automatically.
- The macOS launch log is `~/Library/Application Support/WorkBuddyAmbientSkin/workbuddy-launch.log`. Read it when CDP does not appear after restart; do not speculate about injection until this log and the fixed port `9347` are checked.
- `WorkBuddy DOM ... missing markers` means CDP discovery and ownership verification already passed. Diagnose renderer readiness or a WorkBuddy DOM adapter change; do not attribute this error to the single-instance lock or process-query sandbox.
