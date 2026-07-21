---
name: workbuddy-ambient-skin
description: Apply, create, switch, verify, pause, or restore reversible ambient skins for the WorkBuddy desktop app through loopback CDP injection. Use when users want to change WorkBuddy's theme, wallpaper, colors, or visual atmosphere; apply a personal PNG, JPEG, or WebP image; create or switch a WorkBuddy skin; troubleshoot a missing skin; or restore the original WorkBuddy appearance.
---

# WorkBuddy Ambient Skin

Give WorkBuddy a route-aware ambient background and lightweight Material Layer while preserving its native sidebar, composer, messages, menus, and keyboard interaction. Never modify `WorkBuddy.app`, `app.asar`, or the application signature.

## Entry point

Run all operations through:

```bash
scripts/workbuddy-ambient.sh <command> [options]
```

Read JSON output and report the concrete result. Do not reconstruct CDP commands manually.

## Workflow

1. Run `scripts/workbuddy-ambient.sh doctor`.
2. Stop if WorkBuddy is missing, the bundle id differs from `com.workbuddy.workbuddy`, or the runtime is unsupported.
3. Choose a theme with `list`, or create one from the user's image.
4. If applying requires a restart, tell the user to save unsaved WorkBuddy work and obtain explicit permission.
5. Apply the skin. When no verified CDP session exists, `apply` starts a detached graceful handoff and returns `status: pending`; do not start a second apply.
6. WorkBuddy closes normally and reopens with the skin. After relaunch, run `verify` or `status` to read the recorded handoff result.
7. Report the active theme, visual mode, loopback port, and restore option.

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

The bundled default is `paper-aurora`, a light theme tuned for readable text. Personal images provide additional visual styles.

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
- Never force-kill WorkBuddy. If it does not quit cleanly, stop and report the failure.
- Let the built-in graceful handoff survive the host restart. Do not wrap `apply` in another `nohup`, `pkill`, or custom restart script.
- Accept only the exact WorkBuddy renderer URL shape and native DOM markers.
- Stop a watcher only when its PID command matches this skill's exact entry point and `watch` command.
- Keep decoration non-interactive and keep work/detail backgrounds quieter than the home background.
- Apply Material Layer effects only to known WorkBuddy regions. Keep panel surfaces opaque enough for readable text and retain visible keyboard focus.
- Use `pause` for immediate visual cleanup and `restore` to close the CDP port through a normal restart.
- Never offer live or temporary injection into an ordinarily launched WorkBuddy process. Injection requires a verified CDP session; `pause` only removes a skin that is already active.

## Verification

Treat the operation as successful only when `verify` reports an installed renderer state, the requested theme, the menu, and a known mode (`home`, `work`, or `detail`).

## Troubleshooting signals

- `fetch failed` means the saved/default CDP port is unavailable; diagnose launch or port state.
- `status: pending` with `handoff: true` means the restart was safely delegated; wait for WorkBuddy to reopen instead of launching another apply.
- `the CDP listener is not owned by WorkBuddy` means the loopback listener ownership check failed; diagnose the listener and process tree.
- `WorkBuddy DOM ... missing markers` means CDP discovery and ownership verification already passed. Diagnose renderer readiness or a WorkBuddy DOM adapter change; do not attribute this error to the single-instance lock or process-query sandbox.
