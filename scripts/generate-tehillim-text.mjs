import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_VERSION = "Tanach with Ta'amei Hamikra";
const SOURCE_VERSION_QUERY = encodeURIComponent(SOURCE_VERSION);
const SOURCE_BASE_URL = "https://www.sefaria.org/api/texts";
const OUT_PATH = path.join(process.cwd(), "src", "data", "tehillim-he.json");

const CANTILLATION_RE = /[\u0591-\u05AF]/g;
const HTML_TAG_RE = /<[^>]*>/g;
const HEBREW_MARKS = "[\\u05B0-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C7]*";
const TETRAGRAMMATON_RE = new RegExp(`י${HEBREW_MARKS}ה${HEBREW_MARKS}ו${HEBREW_MARKS}ה${HEBREW_MARKS}`, "g");
const DOUBLE_YUD_NAME_RE = new RegExp(`(^|[\\s׃,.;!?()[\\]{}"'׳״־])י${HEBREW_MARKS}י${HEBREW_MARKS}(?=$|[\\s׃,.;!?()[\\]{}"'׳״־])`, "g");

function decodeBasicHtml(text) {
  return text
    .replace(/&thinsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeVerse(raw) {
  return decodeBasicHtml(raw)
    .replace(HTML_TAG_RE, "")
    .replace(CANTILLATION_RE, "")
    .replace(TETRAGRAMMATON_RE, "ה׳")
    .replace(DOUBLE_YUD_NAME_RE, (_match, prefix) => `${prefix}ה׳`)
    .replace(/אֱלֹה/g, "אֱלֹק")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchChapter(chapter) {
  const url = `${SOURCE_BASE_URL}/Psalms.${chapter}?context=0&commentary=0&pad=0&wrapLinks=0&vhe=${SOURCE_VERSION_QUERY}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Sefaria fetch failed for Psalms.${chapter}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.he) || data.he.length === 0) {
    throw new Error(`Sefaria returned no Hebrew verses for Psalms.${chapter}`);
  }
  const verses = data.he.map((verse) => normalizeVerse(String(verse)));
  return {
    chapter,
    ref: data.ref || `Psalms ${chapter}`,
    titleHe: `תהילים ${chapter}`,
    verses,
    verseCount: verses.length,
  };
}

const chapters = [];
for (let chapter = 1; chapter <= 150; chapter += 1) {
  chapters.push(await fetchChapter(chapter));
}

const payload = {
  source: {
    provider: "Sefaria",
    api: SOURCE_BASE_URL,
    work: "Psalms",
    hebrewVersionTitle: SOURCE_VERSION,
    license: "Public Domain",
    sourceUrl: "https://www.sefaria.org/Psalms",
    generatedAt: new Date().toISOString(),
    normalization: "Cantillation marks removed, nikud preserved, requested holy-name display applied.",
  },
  chapters,
};

await mkdir(path.dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${chapters.length} chapters to ${OUT_PATH}`);
console.log(chapters.map((chapter) => chapter.verseCount).join(","));
