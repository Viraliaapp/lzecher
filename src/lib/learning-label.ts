import { MASECHTOS, PARSHIYOT } from "@/lib/seed-data";
import { TRACK_CONFIGS } from "@/lib/track-config";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";

const MASECHTA_HE_BY_NAME = new Map(MASECHTOS.map((masechta) => [masechta.name, masechta.nameHebrew]));
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

export function learningLabel(locale: string, reference?: string | null, trackType?: string | null) {
  const fallback = reference || trackType || "";
  if (locale !== "he") return fallback;
  if (reference) {
    if (reference === "Daf Yomi commitment") return "דף יומי";

    const tehillim = reference.match(/^(?:Tehillim|Psalm)\s+(\d+)$/);
    if (tehillim) return `תהלים ${toHebrewNumeral(Number(tehillim[1]))}`;

    const parsha = reference.match(/^Parshas\s+(.+)$/);
    if (parsha) {
      const parshaName = PARSHA_HE_BY_NAME.get(parsha[1]) || parsha[1];
      return `פרשת ${parshaName}`;
    }

    const masechta = reference.match(/^(.+?)\s+(\d+(?::\d+)?)$/);
    if (masechta) {
      const [, name, number] = masechta;
      const hebrewName = MASECHTA_HE_BY_NAME.get(name);
      if (hebrewName) return `${hebrewName} ${hebrewNumberSequence(number)}`;
    }
  }
  const track = trackType ? TRACK_CONFIGS[trackType as keyof typeof TRACK_CONFIGS] : null;
  return track?.label.he || fallback;
}
