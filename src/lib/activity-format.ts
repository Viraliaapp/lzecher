/**
 * Pure (client-safe) formatting for live-activity bubbles and the global counter.
 * Localized unit nouns + sentence assembly for en/he/es/fr.
 */

type Locale = string;

interface UnitForms {
  one: (n: number) => string;
  many: (n: number) => string;
}

const UNITS: Record<string, Record<string, UnitForms>> = {
  he: {
    mishnayos: { one: () => "משנה אחת", many: (n) => `${n} משניות` },
    tehillim: { one: () => "פרק תהילים", many: (n) => `${n} פרקי תהילים` },
    kabalos: { one: () => "קבלה טובה", many: (n) => `${n} קבלות טובות` },
    shnayim_mikra: { one: () => "פרשה", many: (n) => `${n} פרשות` },
    daf_yomi: { one: () => "דף", many: (n) => `${n} דפים` },
  },
  en: {
    mishnayos: { one: () => "1 Mishnah", many: (n) => `${n} Mishnayos` },
    tehillim: { one: () => "1 Tehillim chapter", many: (n) => `${n} Tehillim chapters` },
    kabalos: { one: () => "a kabbalah", many: (n) => `${n} kabbalos` },
    shnayim_mikra: { one: () => "a parsha", many: (n) => `${n} parshiyos` },
    daf_yomi: { one: () => "a daf", many: (n) => `${n} dapim` },
  },
  es: {
    mishnayos: { one: () => "1 Mishná", many: (n) => `${n} Mishnayot` },
    tehillim: { one: () => "1 capítulo de Tehilim", many: (n) => `${n} capítulos de Tehilim` },
    kabalos: { one: () => "una kabalá", many: (n) => `${n} kabalot` },
    shnayim_mikra: { one: () => "una parashá", many: (n) => `${n} parashiot` },
    daf_yomi: { one: () => "un daf", many: (n) => `${n} dapim` },
  },
  fr: {
    mishnayos: { one: () => "1 Mishna", many: (n) => `${n} Mishnayot` },
    tehillim: { one: () => "1 chapitre de Tehilim", many: (n) => `${n} chapitres de Tehilim` },
    kabalos: { one: () => "une kabbale", many: (n) => `${n} kabbalot` },
    shnayim_mikra: { one: () => "une paracha", many: (n) => `${n} parachiot` },
    daf_yomi: { one: () => "un daf", many: (n) => `${n} dapim` },
  },
};

export function unitLabel(trackType: string, count: number, locale: Locale): string {
  const byLocale = UNITS[locale] || UNITS.en;
  const forms = byLocale[trackType] || { one: () => `${count}`, many: (n: number) => `${n}` };
  return count === 1 ? forms.one(count) : forms.many(count);
}

/** "שלמה בחר/ה 2 משניות עבור רפאל כהן ז״ל" and locale equivalents. */
export function activitySentence(
  e: { name: string | null; count: number; trackType: string; honoreeHebrew: string; honoreeHonorific: string },
  locale: Locale
): string {
  const unit = unitLabel(e.trackType, e.count, locale);
  const honoree = `${e.honoreeHebrew}${e.honoreeHonorific ? " " + e.honoreeHonorific : ""}`.trim();
  switch (locale) {
    case "he": {
      const who = e.name || "מישהו";
      const verb = e.trackType === "mishnayos" || e.trackType === "shnayim_mikra" ? "לקח" : "לקח/ה";
      return `${who} ${verb} ${unit} עבור ${honoree}`;
    }
    case "es": {
      const who = e.name || "Alguien";
      return `${who} tomó ${unit} por ${honoree}`;
    }
    case "fr": {
      const who = e.name || "Quelqu'un";
      return `${who} a pris ${unit} pour ${honoree}`;
    }
    default: {
      const who = e.name || "Someone";
      return `${who} took ${unit} for ${honoree}`;
    }
  }
}

/** Format an integer with thousands separators per locale. */
export function fmtNum(n: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === "he" ? "he-IL" : locale).format(n);
  } catch {
    return String(n);
  }
}
