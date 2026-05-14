/**
 * Convert an Arabic numeral (1..999) into a Hebrew letter representation
 * with proper geresh (׳ U+05F3) for single letters and gershayim (״ U+05F4)
 * for multi-letter values.
 *
 * Special cases:
 *   15 → ט״ו (NOT י״ה — would spell a divine name)
 *   16 → ט״ז (NOT י״ו — same reason)
 *
 * Examples:
 *   1  → א׳    10 → י׳    15 → ט״ו   100 → ק׳    115 → קט״ו
 *   2  → ב׳    11 → י״א   16 → ט״ז   200 → ר׳    246 → רמ״ו
 *   9  → ט׳    14 → י״ד   30 → ל׳    250 → ר״נ   400 → ת׳
 */
const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

const GERESH = "׳"; // ׳
const GERSHAYIM = "״"; // ״

export function toHebrewNumeral(n: number): string {
  if (!Number.isFinite(n) || n < 1) return String(n);
  if (n > 999) return String(n); // out of common gematria range; render as digits

  let value = Math.floor(n);
  let letters = "";

  // Hundreds
  while (value >= 100) {
    const h = Math.min(Math.floor(value / 100), 9);
    letters += HUNDREDS[h];
    value -= h * 100;
  }

  // Special-case 15 and 16 within the tens-and-ones segment
  if (value === 15) {
    letters += "טו";
    value = 0;
  } else if (value === 16) {
    letters += "טז";
    value = 0;
  } else {
    if (value >= 10) {
      const tIdx = Math.floor(value / 10);
      letters += TENS[tIdx];
      value -= tIdx * 10;
    }
    if (value >= 1) {
      letters += ONES[value];
    }
  }

  // Punctuation: single letter gets geresh, multi-letter gets gershayim
  // before the LAST letter (e.g. רמ״ו).
  if (letters.length === 1) return letters + GERESH;
  return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
}
