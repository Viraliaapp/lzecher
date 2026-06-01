import { toHebrewNumeral } from "@/lib/hebrew-numerals";

function toHebrewYear(year: number): string {
  if (!Number.isFinite(year)) return String(year);
  const shortYear = year > 5000 ? year - 5000 : year;
  return toHebrewNumeral(shortYear);
}

export function toHebrewCalendarDate(timestamp: number, locale: string): string {
  try {
    const date = new Date(timestamp);
    if (locale === 'he') {
      const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).formatToParts(date);
      const day = Number(parts.find((part) => part.type === "day")?.value);
      const month = parts.find((part) => part.type === "month")?.value || "";
      const year = Number(parts.find((part) => part.type === "year")?.value);
      if (day && month && year) {
        return `${toHebrewNumeral(day)} ב${month} ${toHebrewYear(year)}`;
      }
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(date);
    }
    const localeMap: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
    return new Intl.DateTimeFormat(localeMap[locale] || 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}
