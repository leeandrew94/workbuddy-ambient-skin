import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { assetsRoot } from "./constants.mjs";
import { evaluateAll, fetchBrowserIdentity, fetchTargets, waitForTargets } from "./cdp.mjs";
import { buildInstallExpression, buildPassportProofExpression, buildRemoveExpression, buildStatusExpression } from "./renderer.mjs";
import { createChallenge, expectedChallengeProof, validPassport } from "./session.mjs";

function entries(themes) {
  return themes.map(({ manifest, imageDataUrl, artKey }) => ({ ...manifest, imageDataUrl, artKey }));
}

export async function applyToRenderer({ port, themes, activeId, passport }) {
  if (!validPassport(passport)) throw new Error("a valid session passport is required for renderer injection");
  const css = await readFile(join(assetsRoot, "ambient.css"), "utf8");
  const targets = await waitForTargets(port);
  const values = await evaluateAll(targets, port, buildInstallExpression({
    css, themes: entries(themes), activeId, sessionId: passport.browserId, sessionSecret: passport.secret,
  }), undefined, 35000);
  return { applied: values.length, themeId: activeId, values, targetIds: targets.map((target) => target.id) };
}

export async function verifyRendererPassport({ port, passport, deps = {} }) {
  if (!validPassport(passport)) return { trusted: false, reason: "missing-passport" };
  const identity = await (deps.fetchBrowserIdentity ?? fetchBrowserIdentity)(port);
  if (identity.browserId !== passport.browserId) return { trusted: false, reason: "browser-id-mismatch" };
  const targets = await (deps.fetchTargets ?? fetchTargets)(port);
  if (!targets.length) return { trusted: false, reason: "renderer-missing" };
  const nonce = (deps.createChallenge ?? createChallenge)();
  const expected = expectedChallengeProof(passport.secret, nonce);
  const values = await evaluateAll(targets, port, buildPassportProofExpression(nonce), deps.Session, 5000);
  const trusted = values.length === targets.length && values.every((value) => value?.pass === true
    && value.sessionId === passport.browserId && value.proof === expected
    && Object.values(value.markers || {}).every(Boolean));
  return { trusted, reason: trusted ? "session-passport" : "challenge-failed", browserId: identity.browserId };
}

export async function removeFromRenderer(port) {
  const targets = await fetchTargets(port);
  return { removed: (await evaluateAll(targets, port, buildRemoveExpression())).length };
}

export async function rendererStatus(port) {
  const targets = await fetchTargets(port);
  return evaluateAll(targets, port, buildStatusExpression());
}

export async function watchRenderer({ port, themes, activeId, passport, signal, isCurrent }) {
  if (!validPassport(passport)) throw new Error("watcher requires a valid session passport");
  const css = await readFile(join(assetsRoot, "ambient.css"), "utf8");
  const expression = buildInstallExpression({
    css, themes: entries(themes), activeId, force: false, sessionId: passport.browserId, sessionSecret: passport.secret,
  });
  let failures = 0;
  while (!signal?.aborted && failures < 12) {
    try {
      if (isCurrent && !await isCurrent()) return { stopped: true, failures, reason: "superseded" };
      const identity = await fetchBrowserIdentity(port);
      if (identity.browserId !== passport.browserId) throw new Error("CDP browser session changed");
      const targets = await fetchTargets(port);
      for (const target of targets) {
        const [status] = await evaluateAll([target], port, buildStatusExpression());
        if (!status?.installed || status.sessionId !== passport.browserId) {
          await evaluateAll([target], port, expression, undefined, 35000);
        }
      }
      failures = targets.length ? 0 : failures + 1;
    } catch { failures += 1; }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { stopped: true, failures };
}
