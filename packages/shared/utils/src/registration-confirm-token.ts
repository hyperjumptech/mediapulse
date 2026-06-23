import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_EXPIRES_IN_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Payload embedded in the registration confirmation token.
 */
interface RegistrationConfirmTokenPayload {
  uti: string; // userTickerId
  ts: string; // tickerSymbol
  exp: number; // unix timestamp (seconds)
}

/**
 * URL-safe base64 encoding (no padding).
 */
function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * URL-safe base64 decoding.
 */
function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

/**
 * Creates a signed HMAC-SHA256 registration confirmation token.
 *
 * The token is a two-part string: `payload.signature`, both base64url-encoded.
 *
 * @param params.userTickerId - The UserTicker row UUID.
 * @param params.tickerSymbol - Ticker symbol for display (e.g. "BBCA").
 * @param params.secret - Shared HMAC secret (must match `REGISTRATION_CONFIRM_SECRET`).
 * @param params.expiresInMs - Token lifetime. Defaults to 48 hours.
 * @returns Token string for inclusion in confirmation URLs.
 */
export function createRegistrationConfirmToken(params: {
  userTickerId: string;
  tickerSymbol: string;
  secret: string;
  expiresInMs?: number;
}): string {
  const {
    userTickerId,
    tickerSymbol,
    secret,
    expiresInMs = DEFAULT_EXPIRES_IN_MS,
  } = params;

  const payload: RegistrationConfirmTokenPayload = {
    uti: userTickerId,
    ts: tickerSymbol,
    exp: Math.floor((Date.now() + expiresInMs) / 1000),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = base64UrlEncode(Buffer.from(payloadJson, "utf-8"));
  const signature = base64UrlEncode(
    createHmac("sha256", secret).update(payloadEncoded, "utf-8").digest(),
  );

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 registration confirmation token.
 *
 * Checks signature integrity (timing-safe comparison) and expiry.
 *
 * @param token - The token string from the URL query parameter.
 * @param secret - Shared HMAC secret (must match the signing secret).
 * @returns Decoded payload on success, or `{ valid: false, reason }` on failure.
 */
export function verifyRegistrationConfirmToken(
  token: string,
  secret: string,
):
  | { valid: true; userTickerId: string; tickerSymbol: string }
  | { valid: false; reason: "expired" | "invalid" } {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, reason: "invalid" };
    }

    const payloadEncoded = parts[0] as string;
    const signatureEncoded = parts[1] as string;

    const expectedSignature = createHmac("sha256", secret)
      .update(payloadEncoded, "utf-8")
      .digest();
    const providedSignature = base64UrlDecode(signatureEncoded);

    if (
      expectedSignature.length !== providedSignature.length ||
      !timingSafeEqual(expectedSignature, providedSignature)
    ) {
      return { valid: false, reason: "invalid" };
    }

    const payloadJson = base64UrlDecode(payloadEncoded).toString("utf-8");
    const payload: RegistrationConfirmTokenPayload = JSON.parse(payloadJson);

    if (
      !payload.uti ||
      !payload.ts ||
      !payload.exp ||
      typeof payload.uti !== "string" ||
      typeof payload.ts !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return { valid: false, reason: "invalid" };
    }

    if (Date.now() / 1000 > payload.exp) {
      return { valid: false, reason: "expired" };
    }

    return {
      valid: true,
      userTickerId: payload.uti,
      tickerSymbol: payload.ts,
    };
  } catch {
    return { valid: false, reason: "invalid" };
  }
}
