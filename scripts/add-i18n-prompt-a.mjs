/**
 * One-shot i18n key adder for PROMPT A (password protection + started-by + admin powers).
 * Idempotent: only sets keys that are missing. Run: node scripts/add-i18n-prompt-a.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const T = {
  en: {
    landing: { protectedBadge: "Password protected" },
    passwordGate: {
      title: "This memorial is password protected",
      subtitle: "Enter the password shared with you to view the full page.",
      placeholder: "Password",
      submit: "View memorial",
      checking: "Checking…",
      wrong: "Incorrect password. Please try again.",
      tooMany: "Too many attempts. Please wait a few minutes and try again.",
      error: "Something went wrong. Please try again.",
    },
    create: {
      passwordSectionTitle: "Password protection (optional)",
      passwordSectionDesc: "Leave blank for an open memorial anyone can view. Set a password to require it before viewing the full page (the card stays visible in the directory).",
      passwordLabel: "Password",
      passwordPlaceholder: "A word or phrase",
      startedByLabel: "Started by (optional)",
      startedByPlaceholder: "e.g. The Cohen family",
      startedByShow: "Show on the memorial page",
      protected: "Password protected",
      open: "Open to all",
    },
    memorial: {
      startedByLabel: "Started by",
      announcementLabel: "Announcement",
    },
  },
  he: {
    landing: { protectedBadge: "מוגן בסיסמה" },
    passwordGate: {
      title: "הנצחה זו מוגנת בסיסמה",
      subtitle: "הזן את הסיסמה ששותפה איתך כדי לצפות בעמוד המלא.",
      placeholder: "סיסמה",
      submit: "צפייה בהנצחה",
      checking: "בודק…",
      wrong: "סיסמה שגויה. נסה שוב.",
      tooMany: "יותר מדי ניסיונות. המתן מספר דקות ונסה שוב.",
      error: "משהו השתבש. נסה שוב.",
    },
    create: {
      passwordSectionTitle: "הגנה בסיסמה (רשות)",
      passwordSectionDesc: "השאר ריק להנצחה פתוחה שכל אחד יכול לצפות בה. הגדר סיסמה כדי לדרוש אותה לפני צפייה בעמוד המלא (הכרטיס נשאר גלוי בספרייה).",
      passwordLabel: "סיסמה",
      passwordPlaceholder: "מילה או ביטוי",
      startedByLabel: "הוקם על ידי (רשות)",
      startedByPlaceholder: "לדוגמה: משפחת כהן",
      startedByShow: "הצג בעמוד ההנצחה",
      protected: "מוגן בסיסמה",
      open: "פתוח לכולם",
    },
    memorial: {
      startedByLabel: "הוקם על ידי",
      announcementLabel: "הודעה",
    },
  },
  es: {
    landing: { protectedBadge: "Protegido con contraseña" },
    passwordGate: {
      title: "Este memorial está protegido con contraseña",
      subtitle: "Ingresa la contraseña que te compartieron para ver la página completa.",
      placeholder: "Contraseña",
      submit: "Ver memorial",
      checking: "Comprobando…",
      wrong: "Contraseña incorrecta. Inténtalo de nuevo.",
      tooMany: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
      error: "Algo salió mal. Inténtalo de nuevo.",
    },
    create: {
      passwordSectionTitle: "Protección con contraseña (opcional)",
      passwordSectionDesc: "Déjalo en blanco para un memorial abierto que cualquiera pueda ver. Establece una contraseña para requerirla antes de ver la página completa (la tarjeta sigue visible en el directorio).",
      passwordLabel: "Contraseña",
      passwordPlaceholder: "Una palabra o frase",
      startedByLabel: "Iniciado por (opcional)",
      startedByPlaceholder: "p. ej. La familia Cohen",
      startedByShow: "Mostrar en la página del memorial",
      protected: "Protegido con contraseña",
      open: "Abierto a todos",
    },
    memorial: {
      startedByLabel: "Iniciado por",
      announcementLabel: "Anuncio",
    },
  },
  fr: {
    landing: { protectedBadge: "Protégé par mot de passe" },
    passwordGate: {
      title: "Ce mémorial est protégé par un mot de passe",
      subtitle: "Saisissez le mot de passe qui vous a été communiqué pour voir la page complète.",
      placeholder: "Mot de passe",
      submit: "Voir le mémorial",
      checking: "Vérification…",
      wrong: "Mot de passe incorrect. Veuillez réessayer.",
      tooMany: "Trop de tentatives. Veuillez patienter quelques minutes et réessayer.",
      error: "Une erreur s'est produite. Veuillez réessayer.",
    },
    create: {
      passwordSectionTitle: "Protection par mot de passe (facultatif)",
      passwordSectionDesc: "Laissez vide pour un mémorial ouvert que tout le monde peut voir. Définissez un mot de passe pour l'exiger avant d'afficher la page complète (la carte reste visible dans l'annuaire).",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "Un mot ou une phrase",
      startedByLabel: "Lancé par (facultatif)",
      startedByPlaceholder: "ex. La famille Cohen",
      startedByShow: "Afficher sur la page du mémorial",
      protected: "Protégé par mot de passe",
      open: "Ouvert à tous",
    },
    memorial: {
      startedByLabel: "Lancé par",
      announcementLabel: "Annonce",
    },
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
