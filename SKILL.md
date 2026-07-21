---
name: workbuddy-ambient-skin
description: Apply, create, switch, verify, pause, or restore lightweight image skins for WorkBuddy on macOS or Windows. Use when users want to change WorkBuddy's theme or wallpaper, use a personal PNG/JPEG/WebP image, troubleshoot skin application, or restore the native appearance.
---

# WorkBuddy Ambient Skin

Use the platform entry point. Never edit `WorkBuddy.app`, `app.asar`, or the application signature.

```bash
scripts/workbuddy-ambient.sh <command> [options]
# Windows PowerShell
scripts\workbuddy-ambient.ps1 <command> [options]
```

## Apply workflow

1. Run `doctor`, then `list` or create a theme from the user's image.
2. Before any apply, show exactly these choices and wait:
   - **① 确认 apply**：Agent 执行并验证皮肤；WorkBuddy 会被强制重启，未保存内容可能丢失。
   - **② 复制命令跑**：Agent 不操作 WorkBuddy，只返回一条完整本机终端命令。
3. For choice ①, run `apply --theme ID --restart confirmed`. It starts one detached worker because WorkBuddy hosts the Agent session. Do not run a second apply. After WorkBuddy reopens, read `status` once.
4. For choice ②, return the installed command and do nothing else:

```bash
"$HOME/.workbuddy/skills/workbuddy-ambient-skin/scripts/workbuddy-ambient.sh" terminal-apply --theme ID --restart confirmed
```

```powershell
& "$HOME\.workbuddy\skills\workbuddy-ambient-skin\scripts\workbuddy-ambient.ps1" terminal-apply --theme ID --restart confirmed
```

Both paths perform the same bounded operation: kill only processes whose executable belongs to the verified WorkBuddy installation, wait two seconds, start Electron once with `--remote-debugging-port=9347`, wait for the renderer, inject once, and verify the requested theme once. Never retry, change ports, or launch WorkBuddy normally after failure.

## Theme commands

```bash
scripts/workbuddy-ambient.sh list
scripts/workbuddy-ambient.sh create --image "/absolute/image.webp" --name "My Theme"
scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "New Name"
scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes
```

Accept PNG, JPEG, or WebP up to 15 MB. Custom images are analyzed locally for appearance, OKLCH colors, contrast, safe area, and focus. The injected `◐` menu also supports switching themes, importing an image, renaming, and deleting.

When CDP is already active, use `switch --theme ID` for a no-restart change. Use `pause` to remove the current skin. Use `restore --restart confirmed` to return to a normally launched WorkBuddy.

## Result handling

- `status: pending` means the single detached worker owns choice ①. Wait; never start another apply.
- Success requires `status`/`verify` to report renderer markers, the requested theme ID, the menu, and a known mode.
- On failure, report the exact JSON error and `~/Library/Application Support/WorkBuddyAmbientSkin/workbuddy-launch.log` on macOS. Do not run extra restart attempts or infer causes from historical log entries.
- Port `9347` is fixed. If occupied, fail clearly instead of selecting another port.
- CDP is loopback-only. Warn users not to run untrusted local software while the skin session is active.

Read [theme-schema.md](references/theme-schema.md) only when manually authoring or repairing a theme.
