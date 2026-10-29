/**
 * Pure (client-safe) formatting for live-activity bubbles and the global counter.
 * Localized unit nouns + sentence assembly for en/he/es/fr.
 */

type Locale = string;
type ActivityLabel = Partial<Record<"he" | "en" | "es" | "fr", string>>;

interface UnitForms {
  one: (n: number) => string;
  many: (n: number) => string;
}

const HE_MASCULINE_COUNTS: Record<number, string> = {
  3: "שלושה",
  4: "ארבעה",
  5: "חמישה",
  6: "שישה",
  7: "שבעה",
  8: "שמונה",
  9: "תשעה",
  10: "עשרה",
  11: "אחד עשר",
  12: "שנים עשר",
  13: "שלושה עשר",
  14: "ארבעה עשר",
  15: "חמישה עשר",
  16: "שישה עשר",
  17: "שבעה עשר",
  18: "שמונה עשר",
  19: "תשעה עשר",
  20: "עשרים",
};

function hePerekCount(count: number): string {
  if (count === 1) return "פרק אחד";
  if (count === 2) return "שני פרקים";
  return `${HE_MASCULINE_COUNTS[count] || count} פרקים`;
}

function heTehillimChapterCount(count: number): string {
  if (count === 1) return "פרק תהילים";
  if (count === 2) return "שני פרקי תהילים";
  return `${HE_MASCULINE_COUNTS[count] || count} פרקי תהילים`;
}

const UNITS: Record<string, Record<string, UnitForms>> = {
  he: {
    mishnayos: { one: () => "פרק אחד", many: hePerekCount },
    tehillim: { one: () => "פרק תהילים", many: heTehillimChapterCount },
    kabalos: { one: () => "קבלה טובה", many: (n) => `${n} קבלות טובות` },
    shnayim_mikra: { one: () => "פרשה", many: (n) => `${n} פרשות` },
    daf_yomi: { one: () => "דף", many: (n) => `${n} דפים` },
  },
  en: {
    mishnayos: { one: () => "1 perek of Mishnayos", many: (n) => `${n} perakim of Mishnayos` },
    tehillim: { one: () => "1 Tehillim chapter", many: (n) => `${n} Tehillim chapters` },
    kabalos: { one: () => "a kabbalah", many: (n) => `${n} kabbalos` },
    shnayim_mikra: { one: () => "a parsha", many: (n) => `${n} parshiyos` },
    daf_yomi: { one: () => "a daf", many: (n) => `${n} dapim` },
  },
  es: {
    mishnayos: { one: () => "1 capítulo de Mishná", many: (n) => `${n} capítulos de Mishnayot` },
    tehillim: { one: () => "1 capítulo de Tehilim", many: (n) => `${n} capítulos de Tehilim` },
    kabalos: { one: () => "una kabalá", many: (n) => `${n} kabalot` },
    shnayim_mikra: { one: () => "una parashá", many: (n) => `${n} parashiot` },
    daf_yomi: { one: () => "un daf", many: (n) => `${n} dapim` },
  },
  fr: {
    mishnayos: { one: () => "1 chapitre de Michna", many: (n) => `${n} chapitres de Michna` },
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

function exactActivityLabel(label: ActivityLabel | undefined, locale: Locale): string | null {
  if (!label) return null;
  const lang = locale.split("-")[0] as keyof ActivityLabel;
  return label[lang] || label.en || null;
}

/** "שלמה לקח חמישה פרקים עבור רפאל כהן ז״ל" and locale equivalents. */
export function activitySentence(
  e: { name: string | null; count: number; trackType: string; honoreeHebrew: string; honoreeHonorific: string; activityLabel?: ActivityLabel },
  locale: Locale
): string {
  const unit = exactActivityLabel(e.activityLabel, locale) || unitLabel(e.trackType, e.count, locale);
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
