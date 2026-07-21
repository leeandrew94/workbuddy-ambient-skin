import { HOST_ID, STATE_KEY, STYLE_ID, VERSION } from "./constants.mjs";

export function buildInstallExpression({ css, themes, activeId, force = true }) {
  const payload = JSON.stringify({ css, themes, activeId, force, STYLE_ID, HOST_ID, STATE_KEY, VERSION });
  return `(${installInRenderer.toString()})(${payload})`;
}

export function buildRemoveExpression() {
  return `(() => { const state = window[${JSON.stringify(STATE_KEY)}]; if (state?.cleanup) state.cleanup(); return true; })()`;
}

export function buildStatusExpression() {
  return `(() => { const s = window[${JSON.stringify(STATE_KEY)}]; if (!s) return { installed: false, pass: false }; const mode = document.documentElement.dataset.wbasMode; const checks = { application: document.body?.getAttribute?.("data-application-name") === "workbuddy", root: Boolean(document.querySelector("#root")), sidebar: Boolean(document.querySelector('[data-view-id="sidebar"]')), main: Boolean(document.querySelector('[data-view-id="main-content"]')), menu: Boolean(document.getElementById(${JSON.stringify(HOST_ID)})), mode: ["home", "work", "detail"].includes(mode), horizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 }; return { installed: true, pass: Object.values(checks).every(Boolean), version: s.version, themeId: s.themeId, mode, checks }; })()`;
}

async function installInRenderer(data) {
  const readMarkers = () => ({
    application: document.body?.getAttribute?.("data-application-name") === "workbuddy",
    root: Boolean(document.querySelector("#root")),
    shell: Boolean(document.querySelector(".teams-container")),
  });
  const deadline = Date.now() + 30_000;
  let markers = readMarkers();
  while (!Object.values(markers).every(Boolean) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    markers = readMarkers();
  }
  if (!Object.values(markers).every(Boolean)) {
    const missing = Object.entries(markers).filter(([, present]) => !present).map(([name]) => name);
    throw new Error(`WorkBuddy DOM was not ready after 30s; missing markers: ${missing.join(", ")}`);
  }
  const html = document.documentElement;
  const body = document.body;
  const customStorageKey = "workbuddy-ambient-skin.custom-v2";
  const legacyCustomStorageKey = "workbuddy-ambient-skin.custom";
  const validCustom = (theme) => theme && typeof theme === "object" && /^user-[a-z0-9-]{1,80}$/.test(theme.id || "")
    && typeof theme.name === "string" && theme.name.trim() && /^data:image\/(png|jpeg|webp);base64,/.test(theme.imageDataUrl || "")
    && theme.imageDataUrl.length < 6_500_000;
  let customThemes = [];
  try {
    if (!data.force && localStorage.getItem("workbuddy-ambient-skin.paused") === "1") {
      return { installed: false, paused: true };
    }
    if (data.force) localStorage.removeItem("workbuddy-ambient-skin.paused");
    const saved = JSON.parse(localStorage.getItem(customStorageKey) || "[]");
    customThemes = (Array.isArray(saved) ? saved : []).filter(validCustom).slice(0, 8).map((theme) => ({ ...theme, localOnly: true }));
    const legacy = JSON.parse(localStorage.getItem(legacyCustomStorageKey) || "null");
    if (!customThemes.length && legacy?.id === "user-image" && /^data:image\/(png|jpeg|webp);base64,/.test(legacy.imageDataUrl || "") && legacy.imageDataUrl.length < 6_500_000) {
      customThemes = [{ ...legacy, id: "user-legacy", localOnly: true }];
      localStorage.setItem(customStorageKey, JSON.stringify(customThemes));
      localStorage.removeItem(legacyCustomStorageKey);
    }
    data.themes = data.themes.concat(customThemes);
  } catch {}
  window[data.STATE_KEY]?.cleanup?.();

  const style = document.createElement("style");
  style.id = data.STYLE_ID;
  style.textContent = data.css;
  document.head.appendChild(style);

  const rootVariables = ["--wbas-accent", "--wbas-secondary", "--wbas-surface", "--wbas-text", "--wbas-focus-x", "--wbas-focus-y", "--wbas-home-opacity", "--wbas-work-opacity", "--wbas-detail-opacity", "--wbas-sidebar-opacity", "--wbas-panel-opacity", "--wbas-card-opacity", "--wbas-material-blur", "--wbas-material-radius", "--wbas-border-strength", "--wbas-shadow-strength", "--wbas-background-image"];
  const cache = new Map();
  const analysisStorageKey = "workbuddy-ambient-skin.analysis-v2";
  try { localStorage.removeItem("workbuddy-ambient-skin.analysis-v1"); } catch {}
  let disposed = false;
  let activeTheme = null;
  let timer = null;
  let editingThemeId = null;
  let deletingThemeId = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const hex = (rgb) => `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const srgbLinear = (value) => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const linearSrgb = (value) => 255 * (value <= .0031308 ? 12.92 * value : 1.055 * Math.max(0, value) ** (1 / 2.4) - .055);
  const relativeLuminance = (rgb) => { const [r, g, b] = rgb.map(srgbLinear); return .2126 * r + .7152 * g + .0722 * b; };
  const contrastRatio = (foreground, background) => { const a = relativeLuminance(foreground), b = relativeLuminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const rgbToOklch = ([red, green, blue]) => {
    const [r, g, b] = [red, green, blue].map(srgbLinear);
    const l = .4122214708 * r + .5363325363 * g + .0514459929 * b;
    const m = .2119034982 * r + .6806995451 * g + .1073969566 * b;
    const s = .0883024619 * r + .2817188376 * g + .6299787005 * b;
    const lr = Math.cbrt(l), mr = Math.cbrt(m), sr = Math.cbrt(s);
    const L = .2104542553 * lr + .793617785 * mr - .0040720468 * sr;
    const a = 1.9779984951 * lr - 2.428592205 * mr + .4505937099 * sr;
    const bb = .0259040371 * lr + .7827717662 * mr - .808675766 * sr;
    return [L, Math.hypot(a, bb), (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360];
  };
  const oklchToRgb = ([L, initialC, H]) => {
    const angle = H * Math.PI / 180;
    const convert = (C) => {
      const a = C * Math.cos(angle), b = C * Math.sin(angle);
      const lr = L + .3963377774 * a + .2158037573 * b;
      const mr = L - .1055613458 * a - .0638541728 * b;
      const sr = L - .0894841775 * a - 1.291485548 * b;
      const l = lr ** 3, m = mr ** 3, s = sr ** 3;
      return [
        4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
        -.0041960863 * l - .7034186147 * m + 1.707614701 * s,
      ];
    };
    let C = initialC, linear = convert(C);
    for (let attempt = 0; attempt < 16 && linear.some((value) => value < 0 || value > 1); attempt += 1) { C *= .88; linear = convert(C); }
    return linear.map(linearSrgb);
  };
  const hueDistance = (a, b) => { const distance = Math.abs(a - b) % 360; return Math.min(distance, 360 - distance); };
  const ensureContrast = (color, background, minimum, direction) => {
    const adjusted = [...color];
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (contrastRatio(oklchToRgb(adjusted), background) >= minimum) break;
      adjusted[0] = clamp(adjusted[0] + direction * .025, .06, .96);
    }
    return oklchToRgb(adjusted);
  };
  const analysisKey = (theme) => theme.artKey || theme.id;
  const saveCustomThemes = (candidate) => {
    const unique = [...new Map(candidate.filter(validCustom).map((theme) => [theme.id, { ...theme, localOnly: true }])).values()].slice(0, 8);
    while (unique.length > 1 && JSON.stringify(unique).length > 7_000_000) unique.pop();
    try {
      localStorage.setItem(customStorageKey, JSON.stringify(unique));
      localStorage.removeItem(legacyCustomStorageKey);
      customThemes = unique;
      data.themes = data.themes.filter((theme) => !theme.localOnly).concat(customThemes);
      return true;
    } catch { return false; }
  };
  const removePersistedAnalysis = (theme) => {
    cache.delete(analysisKey(theme));
    try {
      const saved = JSON.parse(localStorage.getItem(analysisStorageKey) || "{}");
      delete saved[analysisKey(theme)];
      localStorage.setItem(analysisStorageKey, JSON.stringify(saved));
    } catch {}
  };
  const readPersistedAnalysis = (theme) => {
    if (theme.analysis?.algorithmVersion === 2 && theme.analysis?.palette) return theme.analysis;
    try {
      const saved = JSON.parse(localStorage.getItem(analysisStorageKey) || "{}");
      const analysis = saved[analysisKey(theme)];
      return analysis?.algorithmVersion === 2 && analysis?.palette ? analysis : null;
    } catch { return null; }
  };
  const persistAnalysis = (theme, analysis) => {
    cache.set(analysisKey(theme), analysis);
    try {
      const saved = JSON.parse(localStorage.getItem(analysisStorageKey) || "{}");
      saved[analysisKey(theme)] = analysis;
      const trimmed = Object.fromEntries(Object.entries(saved).slice(-20));
      localStorage.setItem(analysisStorageKey, JSON.stringify(trimmed));
    } catch {}
  };

  const analyzeImage = (theme) => new Promise((resolve) => {
    if (!theme.imageDataUrl) return resolve(null);
    const persisted = readPersistedAnalysis(theme);
    if (persisted) return resolve(persisted);
    if (cache.has(analysisKey(theme))) return resolve(cache.get(analysisKey(theme)));
    const image = new Image();
    image.onload = () => {
      try {
        const width = 72;
        const height = Math.max(16, Math.round(width * image.naturalHeight / image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const buckets = new Map();
        const lights = [];
        const perceptualLights = [];
        for (let index = 0; index < pixels.length; index += 4) {
          const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
          const light = luminance(rgb); lights.push(light);
          const [L, C, H] = rgbToOklch(rgb); perceptualLights.push(L);
          if (C < .035 || L < .12 || L > .94) continue;
          const key = `${Math.round(H / 24) % 15}:${Math.round(L / .12)}:${Math.round(C / .055)}`;
          const bucket = buckets.get(key) || { weight: 0, L: 0, C: 0, sin: 0, cos: 0 };
          const weight = .45 + Math.min(C, .26) * 5;
          bucket.weight += weight; bucket.L += L * weight; bucket.C += C * weight;
          bucket.sin += Math.sin(H * Math.PI / 180) * weight; bucket.cos += Math.cos(H * Math.PI / 180) * weight;
          buckets.set(key, bucket);
        }
        perceptualLights.sort((a, b) => a - b);
        const medianLight = perceptualLights[Math.floor(perceptualLights.length / 2)] ?? .5;
        const dark = medianLight < .62;
        const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight).map((bucket) => ({
          weight: bucket.weight,
          color: [bucket.L / bucket.weight, bucket.C / bucket.weight, (Math.atan2(bucket.sin, bucket.cos) * 180 / Math.PI + 360) % 360],
        }));
        const primary = ranked[0]?.color || [.66, .14, 245];
        const contrasting = ranked.slice(1).filter((candidate) => hueDistance(candidate.color[2], primary[2]) >= 45)
          .sort((a, b) => (b.weight * (1 + Math.min(hueDistance(b.color[2], primary[2]), 120) / 240)) - (a.weight * (1 + Math.min(hueDistance(a.color[2], primary[2]), 120) / 240)))[0];
        const secondarySeed = contrasting?.color || [primary[0], Math.max(.07, primary[1] * .82), (primary[2] + 72) % 360];
        const surfaceColor = dark ? [.135, Math.min(primary[1] * .1, .018), primary[2]] : [.97, Math.min(primary[1] * .09, .016), primary[2]];
        const surface = oklchToRgb(surfaceColor);
        const accentColor = [clamp(primary[0], dark ? .68 : .46, dark ? .8 : .62), clamp(primary[1] * 1.04, .085, .19), primary[2]];
        const secondaryColor = [clamp(secondarySeed[0], dark ? .68 : .48, dark ? .82 : .66), clamp(secondarySeed[1], .07, .17), secondarySeed[2]];
        const accent = ensureContrast(accentColor, surface, 3.2, dark ? 1 : -1);
        const secondary = ensureContrast(secondaryColor, surface, 2.8, dark ? 1 : -1);
        const textSeed = dark ? [.94, .012, primary[2]] : [.22, .018, primary[2]];
        const text = ensureContrast(textSeed, surface, 7, dark ? 1 : -1);
        const zoneInformation = (start, end) => {
          let score = 0, count = 0;
          for (let y = 0; y < height; y += 1) for (let x = start; x < end; x += 1) {
            const current = lights[y * width + x];
            const previous = x > start ? lights[y * width + x - 1] : current;
            const above = y > 0 ? lights[(y - 1) * width + x] : current;
            score += Math.abs(current - previous) + Math.abs(current - above); count += 1;
          }
          return score / Math.max(1, count);
        };
        const zone = Math.round(width * .38);
        const left = zoneInformation(0, zone), right = zoneInformation(width - zone, width);
        const safeArea = Math.abs(left - right) < 2 ? "center" : left < right ? "left" : "right";
        const result = {
          algorithmVersion: 2,
          appearance: dark ? "dark" : "light",
          palette: {
            accent: hex(accent), secondary: hex(secondary),
            surface: hex(surface), text: hex(text),
          },
          safeArea,
          focusX: safeArea === "left" ? .72 : safeArea === "right" ? .28 : .5,
        };
        persistAnalysis(theme, result); resolve(result);
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = theme.imageDataUrl;
  });

  const applyTheme = async (theme) => {
    if (disposed || !theme) return false;
    setNotice(theme.imageDataUrl && theme.palette === "auto" ? "正在分析图片…" : "");
    const analysis = await analyzeImage(theme);
    if (disposed) return false;
    const palette = theme.palette === "auto" ? (analysis?.palette || { accent: "#78A7FF", secondary: "#A78BFA", surface: "#11151F", text: "#F2F5FA" }) : theme.palette;
    const appearance = theme.appearance === "auto" ? (analysis?.appearance || "dark") : theme.appearance;
    const safeArea = theme.art.safeArea === "auto" ? (analysis?.safeArea || "center") : theme.art.safeArea;
    const focusX = theme.art.safeArea === "auto" ? (analysis?.focusX ?? theme.art.focusX) : theme.art.focusX;
    const material = theme.material || { style: "studio", panelOpacity: .84, cardOpacity: .78, blur: 20, radius: 16, borderStrength: .14, shadowStrength: .1 };
    const variables = {
      "--wbas-accent": palette.accent, "--wbas-secondary": palette.secondary,
      "--wbas-surface": palette.surface, "--wbas-text": palette.text,
      "--wbas-focus-x": `${focusX * 100}%`, "--wbas-focus-y": `${theme.art.focusY * 100}%`,
      "--wbas-home-opacity": theme.modes.homeOpacity, "--wbas-work-opacity": theme.modes.workOpacity,
      "--wbas-detail-opacity": theme.modes.detailOpacity, "--wbas-sidebar-opacity": theme.modes.sidebarOpacity,
      "--wbas-panel-opacity": `${(material.panelOpacity ?? .82) * 100}%`,
      "--wbas-card-opacity": `${(material.cardOpacity ?? .74) * 100}%`,
      "--wbas-material-blur": `${material.blur ?? 24}px`, "--wbas-material-radius": `${material.radius ?? 18}px`,
      "--wbas-border-strength": `${(material.borderStrength ?? .32) * 100}%`,
      "--wbas-shadow-strength": material.shadowStrength ?? .2,
      "--wbas-background-image": theme.imageDataUrl ? `url(${JSON.stringify(theme.imageDataUrl)})` : (theme.background || "none"),
    };
    for (const [name, value] of Object.entries(variables)) html.style.setProperty(name, String(value));
    html.classList.add("workbuddy-ambient-skin");
    html.dataset.wbasAppearance = appearance;
    html.dataset.wbasSafe = safeArea;
    html.dataset.wbasTheme = theme.id;
    html.dataset.wbasMaterial = material.style || "studio";
    activeTheme = theme;
    host.dataset.appearance = appearance;
    state.themeId = theme.id;
    try {
      localStorage.removeItem("workbuddy-ambient-skin.paused");
      localStorage.setItem("workbuddy-ambient-skin.active", theme.id);
      if (theme.localOnly && analysis) theme.analysis = analysis;
    } catch {}
    paintMenu();
    setNotice(analysis ? "图片已分析并应用" : "");
    return true;
  };

  const syncMode = () => {
    if (disposed) return;
    const detail = document.querySelector('[data-view-id="detail-panel"]');
    const visibleDetail = detail && detail.getBoundingClientRect().width > 40;
    const welcome = document.querySelector(".main-content--welcome") || document.querySelector('[class*="emptyStateContainer"]');
    html.dataset.wbasMode = visibleDetail ? "detail" : welcome ? "home" : "work";
  };
  const scheduleMode = () => {
    clearTimeout(timer);
    timer = setTimeout(syncMode, 80);
  };
  const observer = new MutationObserver(scheduleMode);
  observer.observe(document.querySelector("#root"), { childList: true, subtree: true });
  window.addEventListener("resize", scheduleMode);

  const host = document.createElement("div");
  host.id = data.HOST_ID;
  host.style.cssText = "position:fixed;right:16px;top:52px;z-index:2147483000;pointer-events:auto";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    :host{all:initial}button{font:13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#20242c}
    .trigger{width:36px;height:36px;border-radius:50%;border:1px solid rgb(120 130 150/.28);background:rgb(250 251 253/.9);box-shadow:0 5px 18px rgb(0 0 0/.2);backdrop-filter:blur(14px);cursor:pointer;font-size:17px}
    .panel{display:none;position:absolute;right:0;top:44px;width:250px;padding:7px;border:1px solid rgb(120 130 150/.22);border-radius:13px;background:rgb(250 251 253/.94);box-shadow:0 12px 34px rgb(0 0 0/.22);backdrop-filter:blur(18px)}
    :host([data-appearance="dark"]) button{color:#eef2f8}:host([data-appearance="dark"]) .trigger,:host([data-appearance="dark"]) .panel{background:rgb(25 29 38/.94);border-color:rgb(180 190 210/.2)}:host([data-appearance="dark"]) .title{color:#aeb7c7}:host([data-appearance="dark"]) .item:hover,:host([data-appearance="dark"]) .action:hover{background:rgb(235 240 255/.09)}
    .panel.open{display:block}.title{padding:7px 9px 5px;color:#687080;font:600 11px/1.2 -apple-system,sans-serif;text-transform:uppercase;letter-spacing:.06em}
    .row{display:flex;align-items:center;gap:2px;min-width:0}.row .item{flex:1;width:auto;min-width:0}.item{display:flex;width:100%;min-width:0;align-items:center;gap:9px;border:0;border-radius:8px;padding:8px 9px;background:transparent;cursor:pointer;text-align:left}.item>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.item:hover,.action:hover{background:rgb(20 30 50/.07)}
    .action{flex:0 0 26px;width:26px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:#737b89;cursor:pointer;font-size:12px}
    .editor{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px;padding:5px 4px 7px}.editor-input{min-width:0;height:30px;box-sizing:border-box;border:1px solid rgb(100 120 160/.3);border-radius:7px;padding:0 8px;background:rgb(255 255 255/.72);color:#20242c;font:13px/1.2 -apple-system,sans-serif;outline:none}.editor-input:focus{border-color:#68a5ef;box-shadow:0 0 0 2px rgb(104 165 239/.16)}
    .mini{height:30px;padding:0 8px;border:0;border-radius:7px;background:rgb(70 120 220/.13);cursor:pointer}.mini.danger{color:#c44858;background:rgb(196 72 88/.1)}.confirm{display:flex;align-items:center;gap:6px;padding:5px 4px 7px}.confirm-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#687080;font:12px/1.2 -apple-system,sans-serif}
    :host([data-appearance="dark"]) .editor-input{background:rgb(10 14 21/.58);border-color:rgb(180 190 210/.24);color:#eef2f8}:host([data-appearance="dark"]) .confirm-text{color:#aeb7c7}:host([data-appearance="dark"]) .mini{color:#eef2f8;background:rgb(120 160 240/.14)}:host([data-appearance="dark"]) .mini.danger{color:#ff8e9d;background:rgb(255 90 110/.1)}
    .item.active{background:rgb(80 125 230/.13);font-weight:650}.dot{width:10px;height:10px;border-radius:50%}.divider{height:1px;margin:5px 4px;background:rgb(100 110 130/.16)}
    .notice{min-height:14px;padding:3px 9px 2px;color:#70798a;font:11px/1.25 -apple-system,sans-serif}.notice.error{color:#c44858}:host([data-appearance="dark"]) .notice{color:#aeb7c7}:host([data-appearance="dark"]) .notice.error{color:#ff8e9d}
  </style><button class="trigger" title="WorkBuddy Ambient Skin">◐</button><div class="panel"><div class="title">Ambient Skin</div><div class="items"></div><div class="divider"></div><button class="item upload"><span class="dot" style="background:#68a5ef"></span>＋ 选择本地图片</button><button class="item native"><span class="dot" style="background:#9aa1ad"></span>原生界面</button><div class="notice"></div><input class="picker" type="file" accept="image/png,image/jpeg,image/webp" hidden></div>`;
  document.body.appendChild(host);
  const panel = shadow.querySelector(".panel");
  const items = shadow.querySelector(".items");
  const picker = shadow.querySelector(".picker");
  const notice = shadow.querySelector(".notice");
  const setNotice = (message, error = false) => {
    notice.textContent = message;
    notice.classList.toggle("error", error);
  };
  shadow.querySelector(".trigger").addEventListener("click", () => panel.classList.toggle("open"));
  shadow.querySelector(".native").addEventListener("click", () => {
    try { localStorage.setItem("workbuddy-ambient-skin.paused", "1"); } catch {}
    state.cleanup(true);
  });
  shadow.querySelector(".upload").addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (!file) return;
    if (file.size < 1 || file.size > 15 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setNotice("请选择 15 MB 以内的 PNG、JPEG 或 WebP", true); return;
    }
    setNotice("正在压缩并分析图片…");
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.naturalWidth > 16384 || image.naturalHeight > 16384 || image.naturalWidth * image.naturalHeight > 50_000_000) {
          setNotice("图片尺寸超过 50MP 限制", true); return;
        }
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const custom = {
          schemaVersion: 1, id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: (file.name.replace(/\.[^.]+$/, "") || "我的图片").slice(0, 60),
          image: "uploaded.webp", imageDataUrl: canvas.toDataURL("image/webp", .82), background: null,
          appearance: "auto", palette: "auto",
          art: { focusX: .5, focusY: .5, safeArea: "auto" },
          modes: { homeOpacity: 1, workOpacity: .16, detailOpacity: .08, sidebarOpacity: .9 },
          material: { style: "studio", panelOpacity: .84, cardOpacity: .78, blur: 20, radius: 16, borderStrength: .14, shadowStrength: .1 },
          localOnly: true,
        };
        data.themes = data.themes.concat(custom);
        await applyTheme(custom);
        const persistent = saveCustomThemes([custom, ...customThemes]);
        paintMenu();
        setNotice(persistent ? `图片已保存（${customThemes.length}/8）` : "图片已应用，但空间不足，重启后不会保留", !persistent);
      } finally { URL.revokeObjectURL(source); }
    };
    image.onerror = () => { setNotice("图片读取失败", true); URL.revokeObjectURL(source); };
    image.src = source;
  });
  const paintMenu = () => {
    items.textContent = "";
    for (const theme of data.themes) {
      const row = document.createElement("div");
      row.className = "row";
      const button = document.createElement("button");
      button.className = `item${theme.id === activeTheme?.id ? " active" : ""}`;
      button.title = theme.name;
      const accent = theme.palette === "auto" ? (theme.analysis?.palette?.accent || "#78A7FF") : theme.palette.accent;
      button.innerHTML = `<span class="dot" style="background:${accent}"></span><span></span>`;
      button.lastChild.textContent = theme.name;
      button.addEventListener("click", () => { applyTheme(theme); panel.classList.remove("open"); });
      row.appendChild(button);
      if (theme.localOnly) {
        const rename = document.createElement("button");
        rename.className = "action"; rename.title = "重命名"; rename.textContent = "✎";
        rename.addEventListener("click", () => { editingThemeId = theme.id; deletingThemeId = null; paintMenu(); });
        const remove = document.createElement("button");
        remove.className = "action"; remove.title = "删除"; remove.textContent = "×";
        remove.addEventListener("click", () => { deletingThemeId = theme.id; editingThemeId = null; paintMenu(); });
        row.append(rename, remove);
      }
      items.appendChild(row);
      if (theme.localOnly && editingThemeId === theme.id) {
        const editor = document.createElement("div"); editor.className = "editor";
        const input = document.createElement("input"); input.className = "editor-input"; input.value = theme.name; input.maxLength = 60; input.setAttribute("aria-label", "皮肤名称");
        const save = document.createElement("button"); save.className = "mini"; save.textContent = "保存";
        const cancel = document.createElement("button"); cancel.className = "mini"; cancel.textContent = "取消";
        const commit = () => {
          const name = input.value.trim().slice(0, 60);
          if (!name) { setNotice("名称不能为空", true); input.focus(); return; }
          const updated = customThemes.map((candidate) => candidate.id === theme.id ? { ...candidate, name } : candidate);
          if (!saveCustomThemes(updated)) { setNotice("重命名保存失败：本地存储空间不足", true); return; }
          if (activeTheme?.id === theme.id) activeTheme = data.themes.find((candidate) => candidate.id === theme.id) || activeTheme;
          editingThemeId = null; paintMenu(); setNotice("已重命名");
        };
        save.addEventListener("click", commit); cancel.addEventListener("click", () => { editingThemeId = null; paintMenu(); });
        input.addEventListener("keydown", (event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { editingThemeId = null; paintMenu(); } });
        editor.append(input, save, cancel); items.appendChild(editor); queueMicrotask(() => { input.focus(); input.select(); });
      }
      if (theme.localOnly && deletingThemeId === theme.id) {
        const confirm = document.createElement("div"); confirm.className = "confirm";
        const label = document.createElement("span"); label.className = "confirm-text"; label.textContent = `删除“${theme.name}”？`;
        const yes = document.createElement("button"); yes.className = "mini danger"; yes.textContent = "删除";
        const no = document.createElement("button"); no.className = "mini"; no.textContent = "取消";
        yes.addEventListener("click", async () => {
          const remaining = customThemes.filter((candidate) => candidate.id !== theme.id);
          if (!saveCustomThemes(remaining)) { setNotice("删除保存失败：本地存储不可用", true); return; }
          removePersistedAnalysis(theme); deletingThemeId = null;
          if (activeTheme?.id === theme.id) await applyTheme(data.themes.find((candidate) => candidate.id === "paper-aurora") || data.themes[0]);
          else paintMenu();
          setNotice("已删除图片皮肤");
        });
        no.addEventListener("click", () => { deletingThemeId = null; paintMenu(); });
        confirm.append(label, yes, no); items.appendChild(confirm);
      }
    }
  };

  const state = {
    version: data.VERSION,
    themeId: null,
    cleanup() {
      if (disposed) return;
      disposed = true; clearTimeout(timer); observer.disconnect(); window.removeEventListener("resize", scheduleMode);
      style.remove(); host.remove(); html.classList.remove("workbuddy-ambient-skin");
      delete html.dataset.wbasAppearance; delete html.dataset.wbasSafe; delete html.dataset.wbasTheme; delete html.dataset.wbasMode; delete html.dataset.wbasMaterial;
      for (const name of rootVariables) html.style.removeProperty(name);
      delete window[data.STATE_KEY];
    },
  };
  window[data.STATE_KEY] = state;
  paintMenu(); syncMode();
  const stored = (() => { try { return localStorage.getItem("workbuddy-ambient-skin.active"); } catch { return null; } })();
  const selected = data.themes.find((theme) => theme.id === (data.activeId || stored)) || data.themes.find((theme) => theme.id === "paper-aurora") || data.themes[0];
  return applyTheme(selected).then(() => ({ installed: true, version: data.VERSION, themeId: state.themeId, mode: html.dataset.wbasMode }));
}
