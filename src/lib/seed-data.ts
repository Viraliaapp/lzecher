import type { Masechet, TehillimMizmor, Parsha, MitzvahTemplate } from "./types";

/* ── Mishnayos: 63 Masechtos across 6 Sedarim ── */
export const MASECHTOS: Masechet[] = [
  // Zeraim (11)
  { id: "berachos", name: "Berachos", nameHebrew: "ברכות", seder: "Zeraim", sederHebrew: "זרעים", order: 1, perakim: 9, mishnayot: 57 },
  { id: "peah", name: "Peah", nameHebrew: "פאה", seder: "Zeraim", sederHebrew: "זרעים", order: 2, perakim: 8, mishnayot: 69 },
  { id: "demai", name: "Demai", nameHebrew: "דמאי", seder: "Zeraim", sederHebrew: "זרעים", order: 3, perakim: 7, mishnayot: 53 },
  { id: "kilayim", name: "Kilayim", nameHebrew: "כלאים", seder: "Zeraim", sederHebrew: "זרעים", order: 4, perakim: 9, mishnayot: 63 },
  { id: "sheviis", name: "Sheviis", nameHebrew: "שביעית", seder: "Zeraim", sederHebrew: "זרעים", order: 5, perakim: 10, mishnayot: 73 },
  { id: "terumos", name: "Terumos", nameHebrew: "תרומות", seder: "Zeraim", sederHebrew: "זרעים", order: 6, perakim: 11, mishnayot: 86 },
  { id: "maasros", name: "Maasros", nameHebrew: "מעשרות", seder: "Zeraim", sederHebrew: "זרעים", order: 7, perakim: 5, mishnayot: 39 },
  { id: "maaser-sheni", name: "Maaser Sheni", nameHebrew: "מעשר שני", seder: "Zeraim", sederHebrew: "זרעים", order: 8, perakim: 5, mishnayot: 46 },
  { id: "challah", name: "Challah", nameHebrew: "חלה", seder: "Zeraim", sederHebrew: "זרעים", order: 9, perakim: 4, mishnayot: 35 },
  { id: "orlah", name: "Orlah", nameHebrew: "ערלה", seder: "Zeraim", sederHebrew: "זרעים", order: 10, perakim: 3, mishnayot: 27 },
  { id: "bikkurim", name: "Bikkurim", nameHebrew: "ביכורים", seder: "Zeraim", sederHebrew: "זרעים", order: 11, perakim: 4, mishnayot: 25 },

  // Moed (12)
  { id: "shabbos", name: "Shabbos", nameHebrew: "שבת", seder: "Moed", sederHebrew: "מועד", order: 12, perakim: 24, mishnayot: 157 },
  { id: "eruvin", name: "Eruvin", nameHebrew: "עירובין", seder: "Moed", sederHebrew: "מועד", order: 13, perakim: 10, mishnayot: 82 },
  { id: "pesachim", name: "Pesachim", nameHebrew: "פסחים", seder: "Moed", sederHebrew: "מועד", order: 14, perakim: 10, mishnayot: 88 },
  { id: "shekalim", name: "Shekalim", nameHebrew: "שקלים", seder: "Moed", sederHebrew: "מועד", order: 15, perakim: 8, mishnayot: 50 },
  { id: "yoma", name: "Yoma", nameHebrew: "יומא", seder: "Moed", sederHebrew: "מועד", order: 16, perakim: 8, mishnayot: 61 },
  { id: "sukkah", name: "Sukkah", nameHebrew: "סוכה", seder: "Moed", sederHebrew: "מועד", order: 17, perakim: 5, mishnayot: 42 },
  { id: "beitzah", name: "Beitzah", nameHebrew: "ביצה", seder: "Moed", sederHebrew: "מועד", order: 18, perakim: 5, mishnayot: 36 },
  { id: "rosh-hashanah", name: "Rosh Hashanah", nameHebrew: "ראש השנה", seder: "Moed", sederHebrew: "מועד", order: 19, perakim: 4, mishnayot: 31 },
  { id: "taanis", name: "Taanis", nameHebrew: "תענית", seder: "Moed", sederHebrew: "מועד", order: 20, perakim: 4, mishnayot: 30 },
  { id: "megillah", name: "Megillah", nameHebrew: "מגילה", seder: "Moed", sederHebrew: "מועד", order: 21, perakim: 4, mishnayot: 29 },
  { id: "moed-katan", name: "Moed Katan", nameHebrew: "מועד קטן", seder: "Moed", sederHebrew: "מועד", order: 22, perakim: 3, mishnayot: 24 },
  { id: "chagigah", name: "Chagigah", nameHebrew: "חגיגה", seder: "Moed", sederHebrew: "מועד", order: 23, perakim: 3, mishnayot: 21 },

  // Nashim (7)
  { id: "yevamos", name: "Yevamos", nameHebrew: "יבמות", seder: "Nashim", sederHebrew: "נשים", order: 24, perakim: 16, mishnayot: 107 },
  { id: "kesubos", name: "Kesubos", nameHebrew: "כתובות", seder: "Nashim", sederHebrew: "נשים", order: 25, perakim: 13, mishnayot: 95 },
  { id: "nedarim", name: "Nedarim", nameHebrew: "נדרים", seder: "Nashim", sederHebrew: "נשים", order: 26, perakim: 11, mishnayot: 72 },
  { id: "nazir", name: "Nazir", nameHebrew: "נזיר", seder: "Nashim", sederHebrew: "נשים", order: 27, perakim: 9, mishnayot: 55 },
  { id: "sotah", name: "Sotah", nameHebrew: "סוטה", seder: "Nashim", sederHebrew: "נשים", order: 28, perakim: 9, mishnayot: 60 },
  { id: "gittin", name: "Gittin", nameHebrew: "גיטין", seder: "Nashim", sederHebrew: "נשים", order: 29, perakim: 9, mishnayot: 70 },
  { id: "kiddushin", name: "Kiddushin", nameHebrew: "קידושין", seder: "Nashim", sederHebrew: "נשים", order: 30, perakim: 4, mishnayot: 42 },

  // Nezikin (10)
  { id: "bava-kamma", name: "Bava Kamma", nameHebrew: "בבא קמא", seder: "Nezikin", sederHebrew: "נזיקין", order: 31, perakim: 10, mishnayot: 68 },
  { id: "bava-metzia", name: "Bava Metzia", nameHebrew: "בבא מציעא", seder: "Nezikin", sederHebrew: "נזיקין", order: 32, perakim: 10, mishnayot: 75 },
  { id: "bava-basra", name: "Bava Basra", nameHebrew: "בבא בתרא", seder: "Nezikin", sederHebrew: "נזיקין", order: 33, perakim: 10, mishnayot: 74 },
  { id: "sanhedrin", name: "Sanhedrin", nameHebrew: "סנהדרין", seder: "Nezikin", sederHebrew: "נזיקין", order: 34, perakim: 11, mishnayot: 72 },
  { id: "makkos", name: "Makkos", nameHebrew: "מכות", seder: "Nezikin", sederHebrew: "נזיקין", order: 35, perakim: 3, mishnayot: 16 },
  { id: "shevuos", name: "Shevuos", nameHebrew: "שבועות", seder: "Nezikin", sederHebrew: "נזיקין", order: 36, perakim: 8, mishnayot: 49 },
  { id: "eduyos", name: "Eduyos", nameHebrew: "עדיות", seder: "Nezikin", sederHebrew: "נזיקין", order: 37, perakim: 8, mishnayot: 56 },
  { id: "avodah-zarah", name: "Avodah Zarah", nameHebrew: "עבודה זרה", seder: "Nezikin", sederHebrew: "נזיקין", order: 38, perakim: 5, mishnayot: 42 },
  { id: "avos", name: "Avos", nameHebrew: "אבות", seder: "Nezikin", sederHebrew: "נזיקין", order: 39, perakim: 6, mishnayot: 70 },
  { id: "horayos", name: "Horayos", nameHebrew: "הוריות", seder: "Nezikin", sederHebrew: "נזיקין", order: 40, perakim: 3, mishnayot: 14 },

  // Kodashim (11)
  { id: "zevachim", name: "Zevachim", nameHebrew: "זבחים", seder: "Kodashim", sederHebrew: "קדשים", order: 41, perakim: 14, mishnayot: 101 },
  { id: "menachos", name: "Menachos", nameHebrew: "מנחות", seder: "Kodashim", sederHebrew: "קדשים", order: 42, perakim: 13, mishnayot: 93 },
  { id: "chullin", name: "Chullin", nameHebrew: "חולין", seder: "Kodashim", sederHebrew: "קדשים", order: 43, perakim: 12, mishnayot: 88 },
  { id: "bechoros", name: "Bechoros", nameHebrew: "בכורות", seder: "Kodashim", sederHebrew: "קדשים", order: 44, perakim: 9, mishnayot: 62 },
  { id: "arachin", name: "Arachin", nameHebrew: "ערכין", seder: "Kodashim", sederHebrew: "קדשים", order: 45, perakim: 9, mishnayot: 47 },
  { id: "temurah", name: "Temurah", nameHebrew: "תמורה", seder: "Kodashim", sederHebrew: "קדשים", order: 46, perakim: 7, mishnayot: 34 },
  { id: "kereisos", name: "Kereisos", nameHebrew: "כריתות", seder: "Kodashim", sederHebrew: "קדשים", order: 47, perakim: 6, mishnayot: 34 },
  { id: "meilah", name: "Meilah", nameHebrew: "מעילה", seder: "Kodashim", sederHebrew: "קדשים", order: 48, perakim: 6, mishnayot: 27 },
  { id: "tamid", name: "Tamid", nameHebrew: "תמיד", seder: "Kodashim", sederHebrew: "קדשים", order: 49, perakim: 7, mishnayot: 33 },
  { id: "middos", name: "Middos", nameHebrew: "מידות", seder: "Kodashim", sederHebrew: "קדשים", order: 50, perakim: 5, mishnayot: 24 },
  { id: "kinnim", name: "Kinnim", nameHebrew: "קינים", seder: "Kodashim", sederHebrew: "קדשים", order: 51, perakim: 3, mishnayot: 11 },

  // Tahorot (12)
  { id: "keilim", name: "Keilim", nameHebrew: "כלים", seder: "Tahorot", sederHebrew: "טהרות", order: 52, perakim: 30, mishnayot: 198 },
  { id: "ohalos", name: "Ohalos", nameHebrew: "אהלות", seder: "Tahorot", sederHebrew: "טהרות", order: 53, perakim: 18, mishnayot: 117 },
  { id: "negaim", name: "Negaim", nameHebrew: "נגעים", seder: "Tahorot", sederHebrew: "טהרות", order: 54, perakim: 14, mishnayot: 101 },
  { id: "parah", name: "Parah", nameHebrew: "פרה", seder: "Tahorot", sederHebrew: "טהרות", order: 55, perakim: 12, mishnayot: 83 },
  { id: "taharos", name: "Taharos", nameHebrew: "טהרות", seder: "Tahorot", sederHebrew: "טהרות", order: 56, perakim: 10, mishnayot: 72 },
  { id: "mikvaos", name: "Mikvaos", nameHebrew: "מקוואות", seder: "Tahorot", sederHebrew: "טהרות", order: 57, perakim: 10, mishnayot: 62 },
  { id: "niddah", name: "Niddah", nameHebrew: "נידה", seder: "Tahorot", sederHebrew: "טהרות", order: 58, perakim: 10, mishnayot: 64 },
  { id: "machshirin", name: "Machshirin", nameHebrew: "מכשירין", seder: "Tahorot", sederHebrew: "טהרות", order: 59, perakim: 6, mishnayot: 40 },
  { id: "zavim", name: "Zavim", nameHebrew: "זבים", seder: "Tahorot", sederHebrew: "טהרות", order: 60, perakim: 5, mishnayot: 25 },
  { id: "tevul-yom", name: "Tevul Yom", nameHebrew: "טבול יום", seder: "Tahorot", sederHebrew: "טהרות", order: 61, perakim: 4, mishnayot: 19 },
  { id: "yadayim", name: "Yadayim", nameHebrew: "ידים", seder: "Tahorot", sederHebrew: "טהרות", order: 62, perakim: 4, mishnayot: 21 },
  { id: "uktzin", name: "Uktzin", nameHebrew: "עוקצין", seder: "Tahorot", sederHebrew: "טהרות", order: 63, perakim: 3, mishnayot: 18 },
];

/* Total perakim: 525, Total mishnayot: ~4192 */

/* ── Tehillim: 150 Mizmorim ── */
export const TEHILLIM: TehillimMizmor[] = Array.from({ length: 150 }, (_, i) => ({
  number: i + 1,
  nameHebrew: `מזמור ${i + 1}`,
  nameEnglish: `Psalm ${i + 1}`,
  verses: [6,12,9,9,13,11,18,10,21,18,7,9,6,7,10,11,11,15,51,18,14,8,6,7,10,10,22,13,5,12,25,10,14,7,12,7,22,13,6,20,22,18,5,26,22,8,12,7,14,7,9,6,8,15,14,7,7,13,9,14,7,13,8,7,14,14,11,7,41,9,20,7,24,17,28,12,8,8,66,8,5,14,12,4,14,48,7,18,7,18,9,31,14,15,8,11,8,6,9,3,5,28,22,35,4,48,31,28,28,176,8,10,9,9,7,4,19,14,8,29,6,8,8,6,5,6,8,8,6,8,3,18,26,5,21,7,14,6,40,8,13,12,6,9,15,21,11,5,15,6][i],
  book: i < 41 ? 1 : i < 72 ? 2 : i < 89 ? 3 : i < 106 ? 4 : 5,
}));

/* ── Parshiyot: 54 ── */
export const PARSHIYOT: Parsha[] = [
  { id: "bereishis", name: "Bereishis", nameHebrew: "בראשית", book: "Bereishis", bookHebrew: "בראשית", order: 1, aliyot: 7 },
  { id: "noach", name: "Noach", nameHebrew: "נח", book: "Bereishis", bookHebrew: "בראשית", order: 2, aliyot: 7 },
  { id: "lech-lecha", name: "Lech Lecha", nameHebrew: "לך לך", book: "Bereishis", bookHebrew: "בראשית", order: 3, aliyot: 7 },
  { id: "vayeira", name: "Vayeira", nameHebrew: "וירא", book: "Bereishis", bookHebrew: "בראשית", order: 4, aliyot: 7 },
  { id: "chayei-sarah", name: "Chayei Sarah", nameHebrew: "חיי שרה", book: "Bereishis", bookHebrew: "בראשית", order: 5, aliyot: 7 },
  { id: "toldos", name: "Toldos", nameHebrew: "תולדות", book: "Bereishis", bookHebrew: "בראשית", order: 6, aliyot: 7 },
  { id: "vayeitzei", name: "Vayeitzei", nameHebrew: "ויצא", book: "Bereishis", bookHebrew: "בראשית", order: 7, aliyot: 7 },
  { id: "vayishlach", name: "Vayishlach", nameHebrew: "וישלח", book: "Bereishis", bookHebrew: "בראשית", order: 8, aliyot: 7 },
  { id: "vayeishev", name: "Vayeishev", nameHebrew: "וישב", book: "Bereishis", bookHebrew: "בראשית", order: 9, aliyot: 7 },
  { id: "mikeitz", name: "Mikeitz", nameHebrew: "מקץ", book: "Bereishis", bookHebrew: "בראשית", order: 10, aliyot: 7 },
  { id: "vayigash", name: "Vayigash", nameHebrew: "ויגש", book: "Bereishis", bookHebrew: "בראשית", order: 11, aliyot: 7 },
  { id: "vayechi", name: "Vayechi", nameHebrew: "ויחי", book: "Bereishis", bookHebrew: "בראשית", order: 12, aliyot: 7 },
  { id: "shemos", name: "Shemos", nameHebrew: "שמות", book: "Shemos", bookHebrew: "שמות", order: 13, aliyot: 7 },
  { id: "vaeira", name: "Vaeira", nameHebrew: "וארא", book: "Shemos", bookHebrew: "שמות", order: 14, aliyot: 7 },
  { id: "bo", name: "Bo", nameHebrew: "בא", book: "Shemos", bookHebrew: "שמות", order: 15, aliyot: 7 },
  { id: "beshalach", name: "Beshalach", nameHebrew: "בשלח", book: "Shemos", bookHebrew: "שמות", order: 16, aliyot: 7 },
  { id: "yisro", name: "Yisro", nameHebrew: "יתרו", book: "Shemos", bookHebrew: "שמות", order: 17, aliyot: 7 },
  { id: "mishpatim", name: "Mishpatim", nameHebrew: "משפטים", book: "Shemos", bookHebrew: "שמות", order: 18, aliyot: 7 },
  { id: "terumah", name: "Terumah", nameHebrew: "תרומה", book: "Shemos", bookHebrew: "שמות", order: 19, aliyot: 7 },
  { id: "tetzaveh", name: "Tetzaveh", nameHebrew: "תצוה", book: "Shemos", bookHebrew: "שמות", order: 20, aliyot: 7 },
  { id: "ki-sisa", name: "Ki Sisa", nameHebrew: "כי תשא", book: "Shemos", bookHebrew: "שמות", order: 21, aliyot: 7 },
  { id: "vayakhel", name: "Vayakhel", nameHebrew: "ויקהל", book: "Shemos", bookHebrew: "שמות", order: 22, aliyot: 7 },
  { id: "pekudei", name: "Pekudei", nameHebrew: "פקודי", book: "Shemos", bookHebrew: "שמות", order: 23, aliyot: 7 },
  { id: "vayikra", name: "Vayikra", nameHebrew: "ויקרא", book: "Vayikra", bookHebrew: "ויקרא", order: 24, aliyot: 7 },
  { id: "tzav", name: "Tzav", nameHebrew: "צו", book: "Vayikra", bookHebrew: "ויקרא", order: 25, aliyot: 7 },
  { id: "shemini", name: "Shemini", nameHebrew: "שמיני", book: "Vayikra", bookHebrew: "ויקרא", order: 26, aliyot: 7 },
  { id: "tazria", name: "Tazria", nameHebrew: "תזריע", book: "Vayikra", bookHebrew: "ויקרא", order: 27, aliyot: 7 },
  { id: "metzora", name: "Metzora", nameHebrew: "מצורע", book: "Vayikra", bookHebrew: "ויקרא", order: 28, aliyot: 7 },
  { id: "acharei-mos", name: "Acharei Mos", nameHebrew: "אחרי מות", book: "Vayikra", bookHebrew: "ויקרא", order: 29, aliyot: 7 },
  { id: "kedoshim", name: "Kedoshim", nameHebrew: "קדושים", book: "Vayikra", bookHebrew: "ויקרא", order: 30, aliyot: 7 },
  { id: "emor", name: "Emor", nameHebrew: "אמור", book: "Vayikra", bookHebrew: "ויקרא", order: 31, aliyot: 7 },
  { id: "behar", name: "Behar", nameHebrew: "בהר", book: "Vayikra", bookHebrew: "ויקרא", order: 32, aliyot: 7 },
  { id: "bechukosai", name: "Bechukosai", nameHebrew: "בחוקותי", book: "Vayikra", bookHebrew: "ויקרא", order: 33, aliyot: 7 },
  { id: "bamidbar", name: "Bamidbar", nameHebrew: "במדבר", book: "Bamidbar", bookHebrew: "במדבר", order: 34, aliyot: 7 },
  { id: "naso", name: "Naso", nameHebrew: "נשא", book: "Bamidbar", bookHebrew: "במדבר", order: 35, aliyot: 7 },
  { id: "behaaloscha", name: "Behaaloscha", nameHebrew: "בהעלותך", book: "Bamidbar", bookHebrew: "במדבר", order: 36, aliyot: 7 },
  { id: "shelach", name: "Shelach", nameHebrew: "שלח", book: "Bamidbar", bookHebrew: "במדבר", order: 37, aliyot: 7 },
  { id: "korach", name: "Korach", nameHebrew: "קרח", book: "Bamidbar", bookHebrew: "במדבר", order: 38, aliyot: 7 },
  { id: "chukas", name: "Chukas", nameHebrew: "חקת", book: "Bamidbar", bookHebrew: "במדבר", order: 39, aliyot: 7 },
  { id: "balak", name: "Balak", nameHebrew: "בלק", book: "Bamidbar", bookHebrew: "במדבר", order: 40, aliyot: 7 },
  { id: "pinchas", name: "Pinchas", nameHebrew: "פינחס", book: "Bamidbar", bookHebrew: "במדבר", order: 41, aliyot: 7 },
  { id: "mattos", name: "Mattos", nameHebrew: "מטות", book: "Bamidbar", bookHebrew: "במדבר", order: 42, aliyot: 7 },
  { id: "masei", name: "Masei", nameHebrew: "מסעי", book: "Bamidbar", bookHebrew: "במדבר", order: 43, aliyot: 7 },
  { id: "devarim", name: "Devarim", nameHebrew: "דברים", book: "Devarim", bookHebrew: "דברים", order: 44, aliyot: 7 },
  { id: "vaeschanan", name: "Vaeschanan", nameHebrew: "ואתחנן", book: "Devarim", bookHebrew: "דברים", order: 45, aliyot: 7 },
  { id: "eikev", name: "Eikev", nameHebrew: "עקב", book: "Devarim", bookHebrew: "דברים", order: 46, aliyot: 7 },
  { id: "reeh", name: "Reeh", nameHebrew: "ראה", book: "Devarim", bookHebrew: "דברים", order: 47, aliyot: 7 },
  { id: "shoftim", name: "Shoftim", nameHebrew: "שופטים", book: "Devarim", bookHebrew: "דברים", order: 48, aliyot: 7 },
  { id: "ki-seitzei", name: "Ki Seitzei", nameHebrew: "כי תצא", book: "Devarim", bookHebrew: "דברים", order: 49, aliyot: 7 },
  { id: "ki-savo", name: "Ki Savo", nameHebrew: "כי תבוא", book: "Devarim", bookHebrew: "דברים", order: 50, aliyot: 7 },
  { id: "nitzavim", name: "Nitzavim", nameHebrew: "נצבים", book: "Devarim", bookHebrew: "דברים", order: 51, aliyot: 7 },
  { id: "vayeilech", name: "Vayeilech", nameHebrew: "וילך", book: "Devarim", bookHebrew: "דברים", order: 52, aliyot: 7 },
  { id: "haazinu", name: "Haazinu", nameHebrew: "האזינו", book: "Devarim", bookHebrew: "דברים", order: 53, aliyot: 7 },
  { id: "vezos-habracha", name: "Vezos Habracha", nameHebrew: "וזאת הברכה", book: "Devarim", bookHebrew: "דברים", order: 54, aliyot: 7 },
];

/* ── Mitzvah Templates: 10 ── */
export const MITZVAH_TEMPLATES: MitzvahTemplate[] = [
  { id: "chesed-visit-sick", title: "Visit the Sick", titleHebrew: "ביקור חולים", description: "Visit someone who is unwell to bring them comfort and support", descriptionHebrew: "לבקר חולה ולהביא לו נחמה ותמיכה", category: "chesed" },
  { id: "chesed-hachnasas-orchim", title: "Host Guests", titleHebrew: "הכנסת אורחים", description: "Host guests for a Shabbos or Yom Tov meal", descriptionHebrew: "לארח אורחים לסעודת שבת או יום טוב", category: "chesed" },
  { id: "tefillah-daven-minyan", title: "Daven with a Minyan", titleHebrew: "תפילה במניין", description: "Commit to davening with a minyan for a set period", descriptionHebrew: "להתחייב להתפלל במניין לתקופה מסוימת", category: "tefillah" },
  { id: "tefillah-extra-tehillim", title: "Extra Tehillim", titleHebrew: "תהילים נוספים", description: "Say additional chapters of Tehillim daily", descriptionHebrew: "לומר פרקי תהילים נוספים כל יום", category: "tefillah" },
  { id: "tzedakah-daily", title: "Daily Tzedakah", titleHebrew: "צדקה יומית", description: "Give tzedakah every weekday for a set period", descriptionHebrew: "לתת צדקה בכל יום חול לתקופה מסוימת", category: "tzedakah" },
  { id: "tzedakah-maaser", title: "Maaser Commitment", titleHebrew: "התחייבות מעשר", description: "Commit to giving maaser from earnings for a period", descriptionHebrew: "להתחייב לתת מעשר מהכנסות לתקופה מסוימת", category: "tzedakah" },
  { id: "limud-daf-yomi", title: "Learn Daf Yomi", titleHebrew: "דף יומי", description: "Learn a page of Gemara daily in the niftar's merit", descriptionHebrew: "ללמוד דף גמרא ביום לעילוי נשמת הנפטר", category: "limud" },
  { id: "limud-mishnah-yomis", title: "Mishnah Yomis", titleHebrew: "משנה יומית", description: "Learn the daily Mishnah in the niftar's merit", descriptionHebrew: "ללמוד משנה יומית לעילוי נשמת הנפטר", category: "limud" },
  { id: "middot-shemiras-halashon", title: "Shemiras HaLashon", titleHebrew: "שמירת הלשון", description: "Strengthen your speech in their memory. Avoid lashon hara, rechilus, and motzi shem ra. Many take on specific hours of the day or learn daily from Sefer Chofetz Chaim.", descriptionHebrew: "התחזקות בשמירת הלשון לעילוי נשמתם. הימנעות מלשון הרע, רכילות ומוציא שם רע. רבים מקבלים על עצמם שעות מסוימות ביום או לימוד יומי מספר חפץ חיים.", category: "middot" },
  { id: "middot-ahavas-yisrael", title: "Ahavas Yisrael", titleHebrew: "אהבת ישראל", description: "Perform daily acts of kindness toward fellow Jews", descriptionHebrew: "לעשות מעשי חסד יומיים כלפי יהודים אחרים", category: "middot" },
  { id: "middot-hakaras-hatov", title: "Daily Hakaras Hatov to Hashem", titleHebrew: "הכרת הטוב יומית להשם", description: "Each day, consciously thank Hashem for one specific thing in your life. The act of recognizing daily blessings — health, family, parnassah, the small kindnesses — elevates the neshama.", descriptionHebrew: "מדי יום, להודות להשם בכוונה על דבר אחד ספציפי בחיים. ההכרה בברכות היומיומיות — בריאות, משפחה, פרנסה, החסדים הקטנים — מעלה את הנשמה.", category: "middot" },
];

/* ── Mussar Seforim ── */
export interface MussarSefer {
  id: string;
  name: string;
  nameHebrew: string;
  author: string;
  authorHebrew: string;
  units: number;
  unitType: string;
  unitTypeHebrew: string;
  description: string;
  descriptionHebrew: string;
}

export const MUSSAR_SEFORIM: MussarSefer[] = [
  {
    id: "mesilas-yesharim",
    name: "Mesilas Yesharim",
    nameHebrew: "מסילת ישרים",
    author: "Ramchal (R' Moshe Chaim Luzzatto)",
    authorHebrew: "רמח״ל",
    units: 26,
    unitType: "chapters",
    unitTypeHebrew: "פרקים",
    description: "The classic path of the upright — 26 chapters covering the ladder of spiritual growth from watchfulness to holiness.",
    descriptionHebrew: "דרך הישרים הקלסית — 26 פרקים המכסים את סולם הצמיחה הרוחנית מזהירות ועד קדושה.",
  },
  {
    id: "chovos-halevavos",
    name: "Chovos HaLevavos",
    nameHebrew: "חובות הלבבות",
    author: "Rabbeinu Bachya ibn Pakuda",
    authorHebrew: "רבינו בחיי אבן פקודא",
    units: 10,
    unitType: "gates (sha'arim)",
    unitTypeHebrew: "שערים",
    description: "The 10 Gates of the Duties of the Heart — from unity of God through love of God, covering the inner world of faith.",
    descriptionHebrew: "עשרת שערי חובות הלבבות — משער היחוד ועד שער אהבת ה׳, מכסים את עולם האמונה הפנימי.",
  },
  {
    id: "orchos-tzaddikim",
    name: "Orchos Tzaddikim",
    nameHebrew: "אורחות צדיקים",
    author: "Anonymous (15th century)",
    authorHebrew: "מחבר אלמוני (המאה ה-15)",
    units: 28,
    unitType: "gates (sha'arim)",
    unitTypeHebrew: "שערים",
    description: "The Ways of the Righteous — 28 gates on character traits, from shame and arrogance through love and joy.",
    descriptionHebrew: "דרכי הצדיקים — 28 שערים על מידות, מהבושה והגאווה ועד האהבה והשמחה.",
  },
  {
    id: "shaarei-teshuvah",
    name: "Shaarei Teshuvah",
    nameHebrew: "שערי תשובה",
    author: "Rabbeinu Yonah of Gerona",
    authorHebrew: "רבינו יונה מגירונדי",
    units: 4,
    unitType: "gates (sha'arim)",
    unitTypeHebrew: "שערים",
    description: "The Gates of Repentance — the foundational work on teshuvah, covering the principles and stages of return to Hashem.",
    descriptionHebrew: "שערי התשובה — היצירה היסודית על התשובה, מכסה את עקרונות ושלבי השיבה אל ה׳.",
  },
  {
    id: "pirkei-avos",
    name: "Pirkei Avos",
    nameHebrew: "פרקי אבות",
    author: "Tannaim (Mishnaic sages)",
    authorHebrew: "התנאים",
    units: 6,
    unitType: "chapters",
    unitTypeHebrew: "פרקים",
    description: "Ethics of the Fathers — 6 chapters of timeless mussar wisdom from the Mishnaic sages. Learn with a mussar commentary like Rabbeinu Yonah or Bartenura.",
    descriptionHebrew: "פרקי אבות — 6 פרקי מוסר נצחיים מחכמי המשנה. ללמוד עם פירוש מוסרי כמו רבינו יונה או ברטנורא.",
  },
  {
    id: "sefer-hachinuch",
    name: "Sefer HaChinuch",
    nameHebrew: "ספר החינוך",
    author: "Attributed to R' Aharon HaLevi of Barcelona",
    authorHebrew: "מיוחס לרבי אהרון הלוי מברצלונה",
    units: 54,
    unitType: "parshiyot",
    unitTypeHebrew: "פרשיות",
    description: "The 613 mitzvos organized by weekly parsha — learn the reasons and laws of each mitzvah following the Torah reading cycle.",
    descriptionHebrew: "תרי״ג מצוות לפי סדר הפרשיות — לימוד טעמי ודיני כל מצווה לפי מחזור קריאת התורה.",
  },
  {
    id: "chofetz-chaim-yomi",
    name: "Chofetz Chaim Yomi",
    nameHebrew: "חפץ חיים יומי",
    author: "The Chofetz Chaim (R' Yisrael Meir Kagan)",
    authorHebrew: "החפץ חיים (ר׳ ישראל מאיר הכהן)",
    units: 1,
    unitType: "daily commitment",
    unitTypeHebrew: "התחייבות יומית",
    description: "Follow the daily Chofetz Chaim Yomi calendar, studying the laws of proper speech from Sefer Chofetz Chaim and Sefer Shemiras HaLashon.",
    descriptionHebrew: "לעקוב אחר לוח חפץ חיים יומי, ללמוד את הלכות לשון הרע מספר חפץ חיים וספר שמירת הלשון.",
  },
  {
    id: "mussar-free-form",
    name: "Personal Mussar Commitment",
    nameHebrew: "התחייבות מוסר אישית",
    author: "",
    authorHebrew: "",
    units: 1,
    unitType: "personal commitment",
    unitTypeHebrew: "התחייבות אישית",
    description: "Commit to a personal daily mussar learning session — choose your own sefer and pace.",
    descriptionHebrew: "התחייבות ללימוד מוסר יומי אישי — בחרו ספר וקצב משלכם.",
  },
];
