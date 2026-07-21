import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { assetsRoot } from "./constants.mjs";
import { evaluateAll, fetchTargets, waitForTargets } from "./cdp.mjs";
import { buildInstallExpression, buildRemoveExpression, buildStatusExpression } from "./renderer.mjs";

function entries(themes) {
  return themes.map(({ manifest, imageDataUrl, artKey }) => ({ ...manifest, imageDataUrl, artKey }));
}

export async function applyToRenderer({ port, themes, activeId }) {
  const css = await readFile(join(assetsRoot, "ambient.css"), "utf8");
  const targets = await waitForTargets(port);
  const values = await evaluateAll(targets, port, buildInstallExpression({ css, themes: entries(themes), activeId }), undefined, 35000);
  return { applied: values.length, themeId: activeId, values, targetIds: targets.map((target) => target.id) };
}

export async function removeFromRenderer(port) {
  const targets = await fetchTargets(port);
  return { removed: (await evaluateAll(targets, port, buildRemoveExpression())).length };
}

export async function rendererStatus(port) {
  const targets = await fetchTargets(port);
  return evaluateAll(targets, port, buildStatusExpression());
}

export async function watchRenderer({ port, themes, activeId, signal }) {
  const css = await readFile(join(assetsRoot, "ambient.css"), "utf8");
  const expression = buildInstallExpression({ css, themes: entries(themes), activeId, force: false });
  let failures = 0;
  while (!signal?.aborted && failures < 12) {
    try {
      const targets = await fetchTargets(port);
      for (const target of targets) {
        const [status] = await evaluateAll([target], port, buildStatusExpression());
      if (!status?.installed) await evaluateAll([target], port, expression, undefined, 35000);
      }
      failures = targets.length ? 0 : failures + 1;
    } catch { failures += 1; }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { stopped: true, failures };
}
