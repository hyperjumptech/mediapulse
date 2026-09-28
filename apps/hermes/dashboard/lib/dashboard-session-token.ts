import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { env } from "@hermes/env";

const HKDF_INFO = Buffer.from("hermes-dashboard-session-v1", "utf8");
const SIGNING_KEY_LENGTH = 32;

export const DASHBOARD_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export type DashboardSessionClaims = {
  id: string;
  name: string;
  email: string;
  credentialVersion: number;
};

type SessionSigningKeys = {
  current: string;
  previous?: string;
};

const defaultSigningKeys = (): SessionSigningKeys => ({
  current: env.HERMES_INTERNAL_API_KEY,
  previous: env.HERMES_INTERNAL_API_KEY_PREVIOUS,
});

const deriveSigningKey = (masterKey: string): Buffer => {
  const derived = hkdfSync(
    "sha256",
    Buffer.from(masterKey, "utf8"),
    Buffer.alloc(0),
    HKDF_INFO,
    SIGNING_KEY_LENGTH,
  );

  return Buffer.from(derived);
};

const computeSignature = (encodedPayload: string, masterKey: string) => {
  const signingKey = deriveSigningKey(masterKey);

  return createHmac("sha256", signingKey).update(encodedPayload).digest();
};

const signatureMatches = (
  encodedPayload: string,
  providedSignature: Buffer,
  masterKey: string,
): boolean => {
  const expectedSignature = computeSignature(encodedPayload, masterKey);
  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }

  return timingSafeEqual(expectedSignature, providedSignature);
};

export const signDashboardSession = (
  claims: DashboardSessionClaims,
  {
    now = Date.now(),
    keys = defaultSigningKeys(),
  }: { now?: number; keys?: SessionSigningKeys } = {},
): string => {
  const expiresAt = Math.floor(now / 1000) + DASHBOARD_SESSION_MAX_AGE_SECONDS;
  const payload = JSON.stringify({ ...claims, exp: expiresAt });
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = computeSignature(encodedPayload, keys.current);

  return `${encodedPayload}.${signature.toString("base64url")}`;
};

export const verifyDashboardSession = (
  token: string,
  {
    now = Date.now(),
    keys = defaultSigningKeys(),
  }: { now?: number; keys?: SessionSigningKeys } = {},
): unknown => {
  const separatorIndex = token.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex !== token.lastIndexOf(".")) {
    return null;
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const providedSignature = Buffer.from(
    token.slice(separatorIndex + 1),
    "base64url",
  );
  const candidateKeys = [keys.current, keys.previous].filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );
  const isAuthentic = candidateKeys.some((masterKey) =>
    signatureMatches(encodedPayload, providedSignature, masterKey),
  );
  if (!isAuthentic) {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (typeof decoded !== "object" || decoded === null) {
      return null;
    }
    const expiresAt = (decoded as { exp?: unknown }).exp;
    const nowSeconds = Math.floor(now / 1000);
    if (typeof expiresAt !== "number" || expiresAt <= nowSeconds) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};
