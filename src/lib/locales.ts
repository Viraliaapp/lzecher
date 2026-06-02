export const SUPPORTED_LOCALES = ["en", "he", "es", "fr"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(value: unknown, fallback: SupportedLocale = "en"): SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as SupportedLocale)
    : fallback;
}
