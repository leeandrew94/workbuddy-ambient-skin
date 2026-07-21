# WorkBuddy Ambient Skin

English · [中文](README_zh.md)

WorkBuddy does not have to feel like a gray utility panel.

Ambient Skin lets the home screen hold an image you care about, then fades into the background when the conversation becomes the work. The sidebar, composer, and menus remain native. Only the light, color, and atmosphere change.

> This is not an official Tencent product. It currently supports macOS and does not modify `WorkBuddy.app`, `app.asar`, or the application signature.

## What changes

- **The space, not the controls**: native interactions stay intact while a Material Layer styles the top bar, sidebar, cards, composer, and detail area independently.
- **Quiet when it matters**: the home screen is expressive; work and detail views progressively soften the background.
- **Images become layouts**: local OKLCH analysis derives a primary color, a distinct secondary color, appearance, focal position, and a text-safe region.
- **Easy to leave**: switch from the top-right menu, pause live, or fully restore the native app.

## Start in a minute

In an AI client that supports Skills, say:

> Use `$workbuddy-ambient-skin` to give my WorkBuddy a calm skin.

The agent follows [SKILL.md](SKILL.md), checks the environment, recommends a theme, and asks before restarting WorkBuddy.

For manual use, run three commands:

```bash
scripts/workbuddy-ambient.sh doctor
scripts/workbuddy-ambient.sh list
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
```

`apply` restarts WorkBuddy, so save unfinished input or tasks first. Then verify the session with:

On first apply, the command returns `handoff: true, status: pending`. A detached Graceful Handoff then quits and reopens WorkBuddy normally. It never uses `pkill`; if the app refuses to quit cleanly, the handoff stops safely.

```bash
scripts/workbuddy-ambient.sh verify
```

## Bring your own image

Once a skin is active, a `◐` button appears in the top-right corner. Use it to switch bundled themes, choose a local image, or temporarily return to the native appearance.

Ambient Skin analyzes the image locally to:

- choose a light or dark appearance from median perceptual lightness;
- cluster colors in OKLCH and select a secondary hue that remains distinct from the primary;
- correct accent and text colors against the generated surface for reliable contrast;
- keep content away from the visual subject and retain a useful focal point;
- resize the asset to a WebP with a maximum edge of 1600px.

The menu keeps up to eight recent images. `✎` opens an inline name editor and `×` opens an inline deletion confirmation, so neither action depends on an Electron system dialog. Renaming does not reanalyze the image.

For command-line theme management:

```bash
scripts/workbuddy-ambient.sh create \
  --image "/absolute/path/background.webp" \
  --name "My Theme"
scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "New Name"
scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes
```

CLI deletion is recoverable: the directory moves into the local `deleted-themes` store. Bundled themes cannot be renamed or deleted.

PNG, JPEG, and WebP are supported up to 15 MB and 50 megapixels. Clean background artwork usually works better than images containing text, buttons, or UI screenshots.

## Bundled mood

| Theme | Character | Best for |
|---|---|---|
| `paper-aurora` | Pale gray, ice blue, airy | Documents and everyday work |

Paper Aurora uses an original CSS gradient and a lightweight Material Layer with translucent regions, quiet depth, and consistent radii. Chat surfaces avoid prominent colored outlines, while work and detail views automatically strengthen their surfaces for readable text.

## Everyday actions

| Intent | Command |
|---|---|
| Browse themes | `scripts/workbuddy-ambient.sh list` |
| Rename an image theme | `scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "New Name"` |
| Delete an image theme | `scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes` |
| Switch instantly | `scripts/workbuddy-ambient.sh switch --theme THEME_ID` |
| Inspect the session | `scripts/workbuddy-ambient.sh status` |
| Pause the skin | `scripts/workbuddy-ambient.sh pause` |
| Fully restore | `scripts/workbuddy-ambient.sh restore --restart confirmed` |

`switch` and `pause` require an active skin session. After WorkBuddy fully exits, run `apply` again.

## Native by design

Ambient Skin uses the Chrome DevTools Protocol bound only to `127.0.0.1` to locate WorkBuddy's renderer. It injects theme variables, background styles, and an isolated Shadow DOM menu. It does not rewrite application behavior and has no npm runtime dependencies.

That lightweight approach has clear boundaries:

- do not run untrusted local software while a skin session is active;
- macOS is currently the only supported platform;
- WorkBuddy changes to key DOM anchors or `--cb-*` variables may require an adapter update;
- a full restore restarts WorkBuddy and closes the CDP skin session.

For development, run `npm test` and `npm run check`. See [references/theme-schema.md](references/theme-schema.md) for the custom theme format.
