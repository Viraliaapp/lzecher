import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-roles";

// Read-only language QA: no Firestore collections are read or written here.
// Super-admin access is still verified through the Lzecher role path (lzecher_users).
const LOCALES = ["en", "he", "es", "fr"] as const;
const ALLOWED_EMPTY_KEYS = new Set(["leaderboard.subtitle"]);
const FORBIDDEN_HEBREW_PHRASES = [
  ["ניהול", " תביעות"],
  ["המת", "מידים"],
  ["לומדים שלקחו", " על עצמם הכי הרבה חלקים"],
  ["ש", "בח"],
].map((parts) => parts.join(""));
const ALLOWED_HEBREW_ENGLISH_WORDS = new Set([
  "Lzecher",
  "Rav",
  "Rabbanim",
  "Daf",
  "Yomi",
  "Shas",
  "Mishnah",
  "Mishnayos",
  "Tehillim",
  "Tanach",
  "PDF",
  "WhatsApp",
  "Email",
]);

type FlatMessages = Record<string, string>;

function flattenMessages(value: unknown, prefix = "", out: FlatMessages = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenMessages(child, full, out);
    } else if (typeof child === "string") {
      out[full] = child;
    }
  }
  return out;
}

function readMessages(locale: string) {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return flattenMessages(JSON.parse(fs.readFileSync(file, "utf8")));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasForbiddenPhrase(value: string, phrase: string) {
  if (phrase.length <= 3) {
    return new RegExp(`(^|[^\\u0590-\\u05FF])${escapeRegExp(phrase)}($|[^\\u0590-\\u05FF])`).test(value);
  }
  return value.includes(phrase);
}

function hebrewEnglishSamples(messages: FlatMessages) {
  const samples: { key: string; word: string; text: string }[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const matches = value.match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
    for (const word of matches) {
      if (ALLOWED_HEBREW_ENGLISH_WORDS.has(word)) continue;
      samples.push({ key, word, text: value.slice(0, 180) });
      break;
    }
    if (samples.length >= 30) break;
  }
  return samples;
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await requireSuperAdmin(idToken);

    const messagesByLocale = Object.fromEntries(LOCALES.map((locale) => [locale, readMessages(locale)]));
    const allKeys = [...new Set(LOCALES.flatMap((locale) => Object.keys(messagesByLocale[locale])))].sort();
    const locales = LOCALES.map((locale) => {
      const messages = messagesByLocale[locale];
      const missingKeys = allKeys.filter((key) => !(key in messages));
      const emptyKeys = Object.entries(messages)
        .filter(([key, value]) => !ALLOWED_EMPTY_KEYS.has(key) && value.trim() === "")
        .map(([key]) => key);
      const forbiddenHits = locale === "he"
        ? Object.entries(messages).flatMap(([key, value]) =>
            FORBIDDEN_HEBREW_PHRASES
              .filter((phrase) => hasForbiddenPhrase(value, phrase))
              .map((phrase) => ({ key, phrase }))
          )
        : [];

      return {
        locale,
        totalKeys: Object.keys(messages).length,
        missingKeys,
        emptyKeys,
        forbiddenHits,
      };
    });

    return NextResponse.json({
      generatedAt: Date.now(),
      totalKeys: allKeys.length,
      forbiddenPhrases: FORBIDDEN_HEBREW_PHRASES,
      locales,
      hebrewEnglishSamples: hebrewEnglishSamples(messagesByLocale.he),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/translations]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
