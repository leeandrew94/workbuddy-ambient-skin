import { createHmac, randomBytes } from "node:crypto";

const SECRET_PATTERN = /^[a-f0-9]{64}$/;
const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const NONCE_PATTERN = /^[a-f0-9]{48}$/;

export function validPassport(passport) {
  return Boolean(passport && passport.schemaVersion === 1
    && SECRET_PATTERN.test(passport.secret || "")
    && BROWSER_ID_PATTERN.test(passport.browserId || "")
    && typeof passport.issuedAt === "string" && Number.isFinite(Date.parse(passport.issuedAt)));
}

export function createPassport(browserId, { bytes = randomBytes, now = new Date() } = {}) {
  if (!BROWSER_ID_PATTERN.test(browserId || "")) throw new Error("invalid CDP browser id");
  return { schemaVersion: 1, browserId, secret: bytes(32).toString("hex"), issuedAt: now.toISOString() };
}

export function createChallenge(bytes = randomBytes) {
  return bytes(24).toString("hex");
}

export function expectedChallengeProof(secret, nonce) {
  if (!SECRET_PATTERN.test(secret || "") || !NONCE_PATTERN.test(nonce || "")) throw new Error("invalid session challenge material");
  return createHmac("sha256", Buffer.from(secret, "hex")).update(nonce, "utf8").digest("hex");
}

export function publicState(state) {
  if (!state || typeof state !== "object") return state;
  const copy = structuredClone(state);
  if (copy.passport) copy.passport = {
    schemaVersion: copy.passport.schemaVersion,
    browserId: copy.passport.browserId,
    issuedAt: copy.passport.issuedAt,
    available: validPassport(copy.passport),
  };
  return copy;
}
