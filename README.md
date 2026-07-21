# WorkBuddy Ambient Skin

A reversible ambient skin skill for WorkBuddy on macOS and Windows. It keeps the native sidebar, composer, menus, and interaction intact while adding route-aware backgrounds, readable material surfaces, and a compact theme picker.

> This is not an official Tencent product. It does not modify the WorkBuddy application, `app.asar`, or its signature.

## Quick start

macOS:

```bash
scripts/workbuddy-ambient.sh doctor
scripts/workbuddy-ambient.sh list
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
scripts/workbuddy-ambient.sh verify
```

Windows PowerShell:

```powershell
.\scripts\workbuddy-ambient.ps1 doctor
.\scripts\workbuddy-ambient.ps1 list
.\scripts\workbuddy-ambient.ps1 apply --theme paper-aurora --restart confirmed
.\scripts\workbuddy-ambient.ps1 verify
```

Save unfinished work before `apply`: WorkBuddy must restart once to open a loopback-only CDP session. Ambient Skin asks WorkBuddy to quit normally and stops safely if it refuses; it never force-kills the app.

For a non-standard Windows installation, pass the executable explicitly:

```powershell
.\scripts\workbuddy-ambient.ps1 -WorkBuddyExe "D:\Apps\WorkBuddy\WorkBuddy.exe" doctor
```

## Built-in themes

### Paper Aurora

A restrained light workspace made from original gray, ice-blue, and aurora gradients.

<p align="center">
  <img src="assets/images/preview-paper-aurora.png" alt="Paper Aurora theme preview" width="900">
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
```

```powershell
.\scripts\workbuddy-ambient.ps1 apply --theme paper-aurora --restart confirmed
```

### Miku Neko Maid

A bright cyan, soft-white, and pink image theme with an automatically generated OKLCH palette.

<p align="center">
  <img src="assets/images/preview-miku-neko-maid.png" alt="Miku Neko Maid theme preview" width="900">
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme miku-neko-maid --restart confirmed
```

```powershell
.\scripts\workbuddy-ambient.ps1 apply --theme miku-neko-maid --restart confirmed
```

### Doraemon Snow Fortune

A winter theme combining snow blue, lantern red, and warm golden light.

<p align="center">
  <img src="assets/images/preview-doraemon-snow-fortune.png" alt="Doraemon Snow Fortune theme preview" width="900">
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme doraemon-snow-fortune --restart confirmed
```

```powershell
.\scripts\workbuddy-ambient.ps1 apply --theme doraemon-snow-fortune --restart confirmed
```

The two character themes use images supplied by the project maintainer. Their characters and related materials remain the property of their respective rights holders; verify your distribution rights before republishing them.

## Use your own image

After applying a skin, click `◐` at the top-right of WorkBuddy and choose a local PNG, JPEG, or WebP image. Analysis runs locally: it detects light or dark appearance, extracts separated OKLCH accent colors, corrects text contrast, estimates the visual focus and safe content area, and caches the result. Images are resized to a maximum 1600 px edge.

The menu keeps up to eight recent images. Use `✎` to rename one and `×` to confirm deletion. Long names are truncated in the menu. CLI management is also available:

```bash
scripts/workbuddy-ambient.sh create --image "/absolute/image.webp" --name "My Theme"
scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "New Name"
scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes
```

CLI deletion is recoverable: the theme moves to the local `deleted-themes` directory. Bundled themes cannot be renamed or deleted.

## Windows stable install

Install a managed copy under `%LOCALAPPDATA%\WorkBuddyAmbientSkin\engine` and create Apply/Restore shortcuts:

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\install-windows.ps1
```

Use `-NoShortcuts` to install only the runtime. The installer stages and validates the new engine before replacing the old one, and rolls back on failure. It does not add startup tasks, a tray process, or a background service.

## Everyday commands

| Action | macOS command |
|---|---|
| List themes | `scripts/workbuddy-ambient.sh list` |
| Switch now | `scripts/workbuddy-ambient.sh switch --theme THEME_ID` |
| Check state | `scripts/workbuddy-ambient.sh status` |
| Pause the skin | `scripts/workbuddy-ambient.sh pause` |
| Restore WorkBuddy | `scripts/workbuddy-ambient.sh restore --restart confirmed` |

On Windows, replace `scripts/workbuddy-ambient.sh` with `.\scripts\workbuddy-ambient.ps1`.

## Safety boundary

- CDP binds only to `127.0.0.1`.
- WorkBuddy installation identity and CDP process ownership are verified before injection.
- Windows operations use a per-user named mutex and an exact executable/process-tree check.
- WorkBuddy is never force-killed.
- Renderer injection is limited to the expected WorkBuddy URL and DOM markers.
- The official installation and application signature remain untouched.

Requires Node.js 22+ and macOS 13+ or Windows 10/11. Run `npm test` and `npm run check` for development verification. See [README_zh.md](README_zh.md) for Chinese documentation and [theme-schema.md](references/theme-schema.md) for the custom theme format.

## Thanks

This project draws design inspiration from [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin). Thank you for the creative ideas.
