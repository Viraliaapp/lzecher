export function isValidEmailAddress(value?: string | null): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (!email || email.length > 254) return false;
  if (email.includes("..")) return false;
  return /^[^\s@<>]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

export function normalizeEmailAddress(value?: string | null): string | null {
  if (!isValidEmailAddress(value)) return null;
  return value.trim().toLowerCase();
}
