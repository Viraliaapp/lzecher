import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const data = JSON.parse(readFileSync("src/data/tehillim-he.json", "utf8"));
const expectedVerseCounts = [
  6, 12, 9, 9, 13, 11, 18, 10, 21, 18, 7, 9, 6, 7, 5, 11, 15, 51, 15, 10,
  14, 32, 6, 10, 22, 12, 14, 9, 11, 13, 25, 11, 22, 23, 28, 13, 40, 23, 14, 18,
  14, 12, 5, 27, 18, 12, 10, 15, 21, 23, 21, 11, 7, 9, 24, 14, 12, 12, 18, 14,
  9, 13, 12, 11, 14, 20, 8, 36, 37, 6, 24, 20, 28, 23, 11, 13, 21, 72, 13, 20,
  17, 8, 19, 13, 14, 17, 7, 19, 53, 17, 16, 16, 5, 23, 11, 13, 12, 9, 9, 5,
  8, 29, 22, 35, 45, 48, 43, 14, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7,
  8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 14, 10, 8,
  12, 15, 21, 10, 20, 14, 9, 6,
];

assert(data.source?.provider === "Sefaria", "Tehillim text source metadata must name Sefaria");
assert(Array.isArray(data.chapters), "Tehillim payload must include chapters");
assert(data.chapters.length === 150, "Tehillim payload must contain exactly 150 chapters");

const allText = JSON.stringify(data.chapters);
assert(/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C7]/.test(allText), "Tehillim text must keep nikud");
assert(!/[\u0591-\u05AF]/.test(allText), "Tehillim text must not include cantillation marks");
assert(!/י[\u05B0-\u05C7]*ה[\u05B0-\u05C7]*ו[\u05B0-\u05C7]*ה/.test(allText), "Tehillim reader must not display the raw Tetragrammaton");
assert(!/אֱלֹה/.test(allText), "Tehillim reader must use the requested אלוקים spelling");

for (let i = 0; i < expectedVerseCounts.length; i += 1) {
  const chapter = data.chapters[i];
  assert(chapter?.chapter === i + 1, `Chapter ${i + 1} is missing or out of order`);
  assert(chapter.verses.length === expectedVerseCounts[i], `Chapter ${i + 1} verse count changed`);
  assert(chapter.verseCount === expectedVerseCounts[i], `Chapter ${i + 1} verseCount metadata changed`);
  assert(chapter.verses.every((verse) => typeof verse === "string" && verse.trim()), `Chapter ${i + 1} has an empty verse`);
}

const stripMarks = (text) => text.replace(/[\u0591-\u05C7]/g, "");
const psalm23 = data.chapters[22];
const psalm67 = data.chapters[66];
const psalm119 = data.chapters[118];

assert(stripMarks(psalm23.verses[0]).includes("ה׳ רעי"), "Psalm 23:1 must display ה׳ רֹעִי");
assert(psalm67.verses.length === 8, "Psalm 67 must have 8 verses");
assert(stripMarks(psalm67.verses[6]).includes("אלקינו"), "Psalm 67:7 must include אלוקינו/אלקינו");
assert(stripMarks(psalm67.verses[6]).includes("יברכנו אלקים אלקינו"), "Psalm 67:7 must keep יברכנו אלוקים אלוקינו");
assert(psalm119.verses.length === 176, "Psalm 119 must have 176 verses");

const heMessages = JSON.parse(readFileSync("messages/he.json", "utf8"));
assert(heMessages.globalCounter?.heading === "כלל ישראל ב'לזכר'", "Hebrew global counter heading must say ב'לזכר'");

console.log("Tehillim text static audit passed.");
