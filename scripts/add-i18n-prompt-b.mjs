/** i18n adder for PROMPT B (global counter + leaderboard). Idempotent. */
import { readFileSync, writeFileSync } from "fs";

const T = {
  en: {
    globalCounter: { heading: "Klal Yisrael learning together", mishnayos: "Mishnayos", tehillim: "Tehillim chapters", kabalos: "Kabbalos" },
    leaderboard: { title: "The Dedicated · המתמידים", subtitle: "By portions taken" },
  },
  he: {
    globalCounter: { heading: "כלל ישראל לומד יחד", mishnayos: "משניות", tehillim: "פרקי תהילים", kabalos: "קבלות" },
    leaderboard: { title: "המתמידים", subtitle: "לפי מספר החלקים שנלקחו" },
  },
  es: {
    globalCounter: { heading: "El pueblo de Israel aprende junto", mishnayos: "Mishnayot", tehillim: "capítulos de Tehilim", kabalos: "Kabalot" },
    leaderboard: { title: "Los Constantes · המתמידים", subtitle: "Por porciones tomadas" },
  },
  fr: {
    globalCounter: { heading: "Le peuple d'Israël étudie ensemble", mishnayos: "Mishnayot", tehillim: "chapitres de Tehilim", kabalos: "Kabbalot" },
    leaderboard: { title: "Les Assidus · המתמידים", subtitle: "Par portions prises" },
  },
};

function deepMergeMissing(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMergeMissing(target[k], v);
    } else if (!(k in target)) {
      target[k] = v;
    }
  }
}

for (const locale of ["en", "he", "es", "fr"]) {
  const path = `messages/${locale}.json`;
  const json = JSON.parse(readFileSync(path, "utf8"));
  deepMergeMissing(json, T[locale]);
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`updated ${path}`);
}
console.log("done");
