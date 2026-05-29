/**
 * SERVER-ONLY. Memorial-project password hashing.
 *
 * Passwords are simple words/phrases an admin sets to gate viewing a memorial.
 * Stored as scrypt(password, salt) — never plaintext. Verified server-side only;
 * the hash/salt are never sent to the client.
 */
import * as crypto from "crypto";

const KEYLEN = 32;
const N = 16384; // scrypt cost — fine for short admin-set words

export interface PasswordHash {
  passwordHash: string;
  passwordSalt: string;
}

/** Hash a plaintext password. Returns hex hash + hex salt to store on the project doc. */
export function hashPassword(plain: string): PasswordHash {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain.normalize("NFKC"), salt, KEYLEN, { N }).toString("hex");
  return { passwordHash: hash, passwordSalt: salt };
}

/** Constant-time verify a plaintext against a stored hash/salt. */
export function verifyPassword(plain: string, passwordHash?: string | null, passwordSalt?: string | null): boolean {
  if (!passwordHash || !passwordSalt) return false;
  try {
    const candidate = crypto.scryptSync(plain.normalize("NFKC"), passwordSalt, KEYLEN, { N });
    const stored = Buffer.from(passwordHash, "hex");
    if (stored.length !== candidate.length) return false;
    return crypto.timingSafeEqual(stored, candidate);
  } catch {
    return false;
  }
}

/** Whether a project doc is password-protected. */
export function isProtected(p: { passwordHash?: string | null }): boolean {
  return Boolean(p.passwordHash);
}
