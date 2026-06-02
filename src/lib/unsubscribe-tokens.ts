import * as crypto from "crypto";
import { verifyToken } from "./signed-tokens";

export interface VerifiedUnsubscribeToken {
  userId: string;
  claimId: string;
}

function normalizeSecret(secret?: string): string | null {
  const normalized = secret?.replace(/\\n/g, "\n").trim();
  return normalized || null;
}

function configuredLegacySecrets(): string[] {
  return [
    normalizeSecret(process.env.REMINDER_ACTION_SECRET),
    normalizeSecret(process.env.CRON_SECRET),
    process.env.NODE_ENV === "production" ? null : "default-dev-secret-not-for-prod",
  ].filter((secret): secret is string => Boolean(secret));
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyLegacyUnsubscribeToken(token: string): VerifiedUnsubscribeToken | null {
  try {
    const [encoded, sigB64] = token.split(".");
    if (!encoded || !sigB64) return null;

    const signature = Buffer.from(sigB64, "base64url");
    const matched = configuredLegacySecrets().some((secret) => {
      const expected = crypto.createHmac("sha256", secret).update(encoded).digest();
      return timingSafeEqual(signature, expected);
    });
    if (!matched) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as {
      userId?: unknown;
      claimId?: unknown;
      exp?: unknown;
    };

    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    if (typeof payload.userId !== "string" || typeof payload.claimId !== "string") return null;

    return { userId: payload.userId, claimId: payload.claimId };
  } catch {
    return null;
  }
}

export function verifyUnsubscribeToken(token: string): VerifiedUnsubscribeToken | null {
  const signed = verifyToken(token);
  if (signed?.purpose === "unsubscribe" && signed.uid && signed.claimId) {
    return { userId: signed.uid, claimId: signed.claimId };
  }

  return verifyLegacyUnsubscribeToken(token);
}
