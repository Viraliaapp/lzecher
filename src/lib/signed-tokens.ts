/**
 * HMAC-signed tokens for email links and auto-signin.
 *
 * NOT JWTs (no header). Format: base64url(payload).hexsig
 * Same pattern as src/app/api/claims/mark-complete-via-link/route.ts.
 */
import * as crypto from "crypto";

const SECRET =
  process.env.REMINDER_ACTION_SECRET ||
  process.env.CRON_SECRET ||
  "default-dev-secret-not-for-prod";

export type TokenPurpose = "email_signin" | "auto_signin" | "mark_complete" | "unsubscribe";

export interface TokenPayload {
  purpose: TokenPurpose;
  email?: string;
  uid?: string;
  locale?: string;
  claimId?: string;
  redirect?: string;
  iat: number;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, "iat" | "exp">, ttlMs: number): string {
  const full: TokenPayload = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [payloadB64, sigHex] = token.split(".");
    if (!payloadB64 || !sigHex) return null;
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(payloadB64)
      .digest("hex");
    // Constant-time compare
    if (sigHex.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sigHex.length; i++) diff |= sigHex.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    if (diff !== 0) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as TokenPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// TTL constants
export const TTL = {
  EMAIL_SIGNIN: 60 * 60 * 1000, // 1 hour — matches Firebase magic link expiry
  AUTO_SIGNIN: 30 * 24 * 60 * 60 * 1000, // 30 days
  MARK_COMPLETE: 90 * 24 * 60 * 60 * 1000, // 90 days
  UNSUBSCRIBE: 30 * 24 * 60 * 60 * 1000,
};
