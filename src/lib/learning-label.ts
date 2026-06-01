import { MASECHTOS, PARSHIYOT } from "@/lib/seed-data";
import { TRACK_CONFIGS } from "@/lib/track-config";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";

const MASECHTA_HE_BY_NAME = new Map(MASECHTOS.map((masechta) => [masechta.name, masechta.nameHebrew]));
const MASECHTA_HE_BY_ID = new Map(MASECHTOS.map((masechta) => [masechta.id, masechta.nameHebrew]));
const SEDER_HE_BY_NAME = new Map(MASECHTOS.map((masechta) => [masechta.seder, masechta.sederHebrew]));
const SEDER_HE_BY_KEY = new Map(MASECHTOS.map((masechta) => [masechta.seder.toLowerCase(), masechta.sederHebrew]));
const PARSHA_HE_BY_NAME = new Map(PARSHIYOT.map((parsha) => [parsha.name, parsha.nameHebrew]));

function hebrewNumberSequence(value: string) {
  return value
    .split(":")
    .map((part) => {
      const num = Number(part);
      return Number.isFinite(num) && num > 0 ? toHebrewNumeral(num) : part;
    })
    .join(":");
}

function masechtaNameHebrew(value?: string | null) {
  const name = value?.trim();
  if (!name) return "";
  const key = name.toLowerCase().replace(/\s+/g, "-");
  return MASECHTA_HE_BY_NAME.get(name) || MASECHTA_HE_BY_ID.get(name) || MASECHTA_HE_BY_ID.get(key) || name;
}

function sederNameHebrew(value?: string | null) {
  const name = value?.trim();
  if (!name) return "";
  return SEDER_HE_BY_NAME.get(name) || SEDER_HE_BY_KEY.get(name.toLowerCase()) || name;
}

function englishScopeLabel(scope: string, scopeId?: string | null, portionCount?: number | null) {
  if (scope === "shas") return "Shas Mishnayos";
  if (scope === "seder") return `Seder ${scopeId || ""}`.trim();
  if (scope === "masechta") return `Masechta ${scopeId || ""}`.trim();
  if (scope === "whole_tehillim") return "All Tehillim";
  if (scope === "tehillim_book") return `Tehillim Book ${scopeId || ""}`.trim();
  if (scope === "multi") return `${portionCount || 0} portions`;
  return scopeId || scope;
}

export function learningScopeLabel(
  locale: string,
  scope?: string | null,
  scopeId?: string | null,
  trackType?: string | null,
  portionCount?: number | null
) {
  const resolvedScope = scope || trackType || "";
  if (locale !== "he") return englishScopeLabel(resolvedScope, scopeId, portionCount);

  if (resolvedScope === "shas") return "כל ששה סדרי משנה";
  if (resolvedScope === "seder") return `סדר ${sederNameHebrew(scopeId)}`;
  if (resolvedScope === "masechta") return `מסכת ${masechtaNameHebrew(scopeId)}`;
  if (resolvedScope === "whole_tehillim") return "כל ספר תהלים";
  if (resolvedScope === "tehillim_book") {
    const bookNumber = Number(scopeId);
    return Number.isFinite(bookNumber) && bookNumber > 0
      ? `ספר ${toHebrewNumeral(bookNumber)} בתהלים`
      : "ספר בתהלים";
  }
  if (resolvedScope === "multi") return portionCount ? `${portionCount} חלקים` : "כמה חלקים";

  const track = trackType ? TRACK_CONFIGS[trackType as keyof typeof TRACK_CONFIGS] : null;
  return track?.label.he || resolvedScope;
}

export function learningLabel(locale: string, reference?: string | null, trackType?: string | null) {
  const cleanReference = reference?.trim();
  const fallback = cleanReference || trackType || "";
  if (locale !== "he") return fallback;
  if (cleanReference) {
    if (cleanReference === "Daf Yomi commitment") return "דף יומי";
    if (/^personal commitment$/i.test(cleanReference)) return "קבלה אישית";
    if (/^shas mishnayos$/i.test(cleanReference)) return "כל ששה סדרי משנה";
    if (/^(all|whole)\s+tehillim$/i.test(cleanReference)) return "כל ספר תהלים";

    const portionCount = cleanReference.match(/^(\d+)\s+portions?$/i);
    if (portionCount) return `${Number(portionCount[1])} חלקים`;

    const bulkMasechta = cleanReference.match(/^Masechta\s+(.+)$/i);
    if (bulkMasechta) return `מסכת ${masechtaNameHebrew(bulkMasechta[1])}`;

    const bulkSeder = cleanReference.match(/^Seder\s+(.+)$/i);
    if (bulkSeder) return `סדר ${sederNameHebrew(bulkSeder[1])}`;

    const tehillimBook = cleanReference.match(/^Tehillim\s+Book\s+(\d+)$/i);
    if (tehillimBook) return `ספר ${toHebrewNumeral(Number(tehillimBook[1]))} בתהלים`;

    const tehillim = cleanReference.match(/^(?:Tehillim|Psalm)\s+(\d+)$/);
    if (tehillim) return `תהלים ${toHebrewNumeral(Number(tehillim[1]))}`;

    const parsha = cleanReference.match(/^Parshas\s+(.+)$/);
    if (parsha) {
      const parshaName = PARSHA_HE_BY_NAME.get(parsha[1]) || parsha[1];
      return `פרשת ${parshaName}`;
    }

    const masechta = cleanReference.match(/^(.+?)\s+(\d+(?::\d+)?)$/);
    if (masechta) {
      const [, name, number] = masechta;
      const hebrewName = MASECHTA_HE_BY_NAME.get(name) || MASECHTA_HE_BY_ID.get(name) || MASECHTA_HE_BY_ID.get(name.toLowerCase().replace(/\s+/g, "-"));
      if (hebrewName) return `${hebrewName} ${hebrewNumberSequence(number)}`;
    }
  }
  const track = trackType ? TRACK_CONFIGS[trackType as keyof typeof TRACK_CONFIGS] : null;
  return track?.label.he || fallback;
}
