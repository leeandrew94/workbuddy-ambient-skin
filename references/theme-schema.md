# Theme schema

Use this reference only when creating or repairing a WorkBuddy Ambient Skin theme.

## Required fields

```json
{
  "schemaVersion": 1,
  "id": "lowercase-hyphen-id",
  "name": "Human name"
}
```

Provide either `image` or `background`:

- `image`: relative PNG, JPEG, or WebP path inside the theme folder; maximum 15 MB.
- `background`: safe CSS image value composed from gradients. Do not include braces or semicolons.

## Appearance and palette

Set `appearance` to `auto`, `light`, or `dark`.

Set `palette` to `auto` for custom images, or provide four six-digit colors:

```json
{
  "accent": "#78A7FF",
  "secondary": "#A78BFA",
  "surface": "#11151F",
  "text": "#F2F5FA"
}
```

## Composition

```json
{
  "art": {
    "focusX": 0.74,
    "focusY": 0.45,
    "safeArea": "left"
  }
}
```

- Keep focus values between `0` and `1`.
- Set `safeArea` to `auto`, `left`, `right`, `center`, or `none`.
- Use `auto` for imported user images. The renderer samples the image once and persists the result under an image-content key, so later injections do not repeat the analysis.

## Route intensity

```json
{
  "modes": {
    "homeOpacity": 1,
    "workOpacity": 0.16,
    "detailOpacity": 0.08,
    "sidebarOpacity": 0.9
  }
}
```

Keep work opacity between `0.12` and `0.2` for readable conversations. Keep all decoration free of text, fake controls, or rasterized WorkBuddy UI.

## Material layer

```json
{
  "material": {
    "style": "studio",
    "panelOpacity": 0.84,
    "cardOpacity": 0.76,
    "blur": 20,
    "radius": 16,
    "borderStrength": 0.14,
    "shadowStrength": 0.1
  }
}
```

Use `ambient` for the original minimal treatment or `studio` for layered glass surfaces. Opacities and strengths use `0`–`1`; blur is `0`–`40` px and radius is `6`–`28` px. Keep panel opacity at or above `0.78` when the image is visually busy.
