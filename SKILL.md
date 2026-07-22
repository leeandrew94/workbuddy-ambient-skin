---
name: workbuddy-ambient-skin
description: Apply, create, switch, verify, pause, or restore lightweight image skins for WorkBuddy on macOS or Windows. Use when users want to change WorkBuddy's theme or wallpaper, use a personal PNG/JPEG/WebP image, troubleshoot skin application, or restore the native appearance.
---

# WorkBuddy Ambient Skin

Use the platform entry point. Never edit `WorkBuddy.app`, `app.asar`, or the application signature.

```bash
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" <command> [options]
# Windows PowerShell
& "$HOME\.workbuddy\skills\workbuddy-ambient-skin\scripts\workbuddy-ambient.ps1" <command> [options]
```

## Apply workflow

1. Run `doctor`, then `list` or create a theme from the user's image.
2. Never execute a restart/apply command from the Agent sandbox. Detect the operating system and return exactly one fenced command block for that system. Replace `ID` with the selected theme's real ID so the command can be copied unchanged. Do not show both platforms unless the user explicitly asks for both.

macOS:

```bash
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/apply.command" --theme ID
```

```powershell
& "$HOME\.workbuddy\skills\workbuddy-ambient-skin\scripts\workbuddy-ambient.ps1" terminal-apply --theme ID --restart confirmed
```

Precede the command with one short warning that WorkBuddy will be force-restarted and unsaved input may be lost. Ask the user to paste it into their own Terminal or PowerShell. Do not abbreviate the path, omit required flags, ask the user to `cd`, or attempt the command on their behalf.

The manual command closes WorkBuddy, waits two seconds, starts it once with `--remote-debugging-port=9347`, waits for CDP and the renderer, injects once, and verifies once. Never retry, change ports, or launch WorkBuddy normally after failure.

## Theme commands

```bash
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" list
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" create --image "/absolute/image.webp" --name "My Theme"
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" rename --theme THEME_ID --name "New Name"
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" delete --theme THEME_ID --confirm yes
```

Accept PNG, JPEG, or WebP up to 15 MB. Custom images are analyzed locally for appearance, OKLCH colors, contrast, safe area, and focus. The injected `◐` menu also supports switching themes, importing an image, renaming, and deleting.

When CDP is already active, use `switch --theme ID` for a no-restart change. Use `pause` to remove the current skin. Use `restore --restart confirmed` to return to a normally launched WorkBuddy.

## Result handling

- Success requires `status`/`verify` to report renderer markers, the requested theme ID, the menu, and a known mode.
- On failure, report the exact JSON error plus the current tail of `apply.log`; use `workbuddy-launch.log` for Electron-start failures. Both logs are under `~/Library/Application Support/WorkBuddyAmbientSkin/`. Do not run extra restart attempts or infer causes from historical entries.
- Port `9347` is fixed. If occupied, fail clearly instead of selecting another port.
- CDP is loopback-only. Warn users not to run untrusted local software while the skin session is active.

Read [theme-schema.md](references/theme-schema.md) only when manually authoring or repairing a theme.
