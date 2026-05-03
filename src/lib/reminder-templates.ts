/**
 * Email reminder templates for the Lzecher platform.
 * Each template returns a { subject, body } pair for a given locale.
 */

export type ReminderLocale = "en" | "he" | "es" | "fr";

export type ReminderType =
  | "confirmation"
  | "halfway"
  | "sevenDaysBefore"
  | "threeDaysBefore"
  | "oneDayBefore"
  | "dailyReminder"
  | "weeklyDigest";

export interface ReminderTemplateArgs {
  honoreeName: string;
  commitmentDesc: string;
  deadline?: string; // Human-readable date string
  link: string; // URL back to the claim/memorial
  unsubscribeLink?: string;
}

export interface ReminderEmail {
  subject: string;
  body: string;
}

// ─── Shared HTML helpers ──────────────────────────────────────────────────────

function emailWrapper(
  content: string,
  tagline: string,
  dir: "ltr" | "rtl",
  locale: string,
  unsubscribeLink?: string,
  unsubscribeText?: string
): string {
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EC;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EC;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0F1B2D;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          <div style="display:inline-block;width:44px;height:44px;background:rgba(201,169,97,0.15);border-radius:10px;line-height:44px;text-align:center;">
            <span style="font-size:22px;color:#C9A961;">&#x2727;</span>
          </div>
          <h1 style="margin:10px 0 0;font-size:26px;color:#FAF6EC;font-weight:700;letter-spacing:-0.5px;">Lzecher</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#C9A961;letter-spacing:1px;">${tagline}</p>
        </td></tr>

        <!-- Body card -->
        <tr><td style="background:#FFFFFF;padding:36px 32px;border:1px solid rgba(15,27,45,0.07);">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0F1B2D;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B8CAA;">&copy; ${new Date().getFullYear()} Lzecher &nbsp;·&nbsp;
            <a href="https://lzecher.com" style="color:#C9A961;text-decoration:none;">lzecher.com</a>
          </p>
          ${
            unsubscribeLink
              ? `<p style="margin:8px 0 0;font-size:11px;color:#6B8CAA;">
              <a href="${unsubscribeLink}" style="color:#6B8CAA;text-decoration:underline;">${unsubscribeText || "Manage reminder preferences"}</a>
            </p>`
              : ""
          }
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, text: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td align="center">
      <a href="${href}" style="display:inline-block;padding:13px 36px;background:linear-gradient(135deg,#C9A961,#D4B679);color:#0F1B2D;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;letter-spacing:0.3px;">
        ${text}
      </a>
    </td></tr>
  </table>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid rgba(15,27,45,0.07);margin:24px 0;" />`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:22px;color:#0F1B2D;font-weight:700;line-height:1.3;">${text}</h2>`;
}

function body(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#2A2D34;line-height:1.7;">${text}</p>`;
}

function badge(text: string): string {
  return `<div style="display:inline-block;background:#FAF6EC;border:1px solid #C9A961;border-radius:8px;padding:6px 14px;font-size:13px;color:#0F1B2D;font-style:italic;margin:0 0 20px;">${text}</div>`;
}

// ─── Taglines per locale ──────────────────────────────────────────────────────

const TAGLINES: Record<ReminderLocale, string> = {
  en: "Honoring memory through Torah learning",
  he: "לעילוי נשמת — לזכר עולם יהיה צדיק",
  es: "Honrando la memoria a traves del estudio de la Tora",
  fr: "Honorer la memoire par l'etude de la Torah",
};

const UNSUBSCRIBE_TEXT: Record<ReminderLocale, string> = {
  en: "Manage reminder preferences",
  he: "ניהול העדפות תזכורת",
  es: "Gestionar preferencias de recordatorio",
  fr: "Gerer les preferences de rappel",
};

// ─── Template builders ────────────────────────────────────────────────────────

const templates: Record<
  ReminderType,
  Record<ReminderLocale, (args: ReminderTemplateArgs) => ReminderEmail>
> = {
  // ── Confirmation ────────────────────────────────────────────────────────────
  confirmation: {
    en: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Your commitment for ${honoreeName} is confirmed`,
      body: emailWrapper(
        `
        ${heading(`Your commitment is confirmed`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Thank you for taking on this learning as a merit for <strong>${honoreeName}</strong>. Your commitment has been recorded and will be a zechus for their neshama.`)}
        ${body(`<strong>What you committed to:</strong> ${commitmentDesc}${deadline ? `<br><strong>By:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "View my commitment")}
        ${divider()}
        ${body(`<em>May the Torah you learn be a source of elevation for the neshama of ${honoreeName}.</em>`)}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `ההתחייבות שלך לעילוי נשמת ${honoreeName} אושרה`,
      body: emailWrapper(
        `
        ${heading(`ההתחייבות שלך אושרה`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`תודה שקיבלת על עצמך ללמוד לעילוי נשמת <strong>${honoreeName}</strong>. ההתחייבות שלך נרשמה ותהיה זכות לנשמה.`)}
        ${body(`<strong>מה שקיבלת על עצמך:</strong> ${commitmentDesc}${deadline ? `<br><strong>עד:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "צפה בהתחייבות שלי")}
        ${divider()}
        ${body(`<em>יהי רצון שהתורה שתלמד תהיה לעילוי נשמת ${honoreeName}.</em>`)}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Tu compromiso por ${honoreeName} ha sido confirmado`,
      body: emailWrapper(
        `
        ${heading(`Tu compromiso ha sido confirmado`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Gracias por asumir este estudio como merito para <strong>${honoreeName}</strong>. Tu compromiso ha sido registrado y sera una zechus para su neshama.`)}
        ${body(`<strong>Tu compromiso:</strong> ${commitmentDesc}${deadline ? `<br><strong>Fecha limite:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Ver mi compromiso")}
        ${divider()}
        ${body(`<em>Que el Torah que estudies sea una fuente de elevacion para la neshama de ${honoreeName}.</em>`)}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Votre engagement pour ${honoreeName} est confirme`,
      body: emailWrapper(
        `
        ${heading(`Votre engagement est confirme`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Merci d'avoir pris cet engagement d'etude comme merite pour <strong>${honoreeName}</strong>. Votre engagement a ete enregistre et sera une zekhout pour sa neshama.`)}
        ${body(`<strong>Votre engagement :</strong> ${commitmentDesc}${deadline ? `<br><strong>Echeance :</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Voir mon engagement")}
        ${divider()}
        ${body(`<em>Que la Torah que vous etudiez soit une source d'elevation pour la neshama de ${honoreeName}.</em>`)}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── Halfway ─────────────────────────────────────────────────────────────────
  halfway: {
    en: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Halfway there — keep going for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`You're halfway there!`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`You're at the midpoint of your commitment for <strong>${honoreeName}</strong>. Every word of Torah you've learned has been a merit for their neshama — keep going!`)}
        ${body(`<strong>Your commitment:</strong> ${commitmentDesc}${deadline ? `<br><strong>Deadline:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Continue learning")}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `באמצע הדרך — המשך לזכות את נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`הגעת לאמצע הדרך!`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`הגעת לאמצע ההתחייבות שלך לעילוי נשמת <strong>${honoreeName}</strong>. כל מילה שלמדת היא זכות לנשמה — המשך!`)}
        ${body(`<strong>ההתחייבות שלך:</strong> ${commitmentDesc}${deadline ? `<br><strong>עד:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "המשך ללמוד")}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `A mitad de camino — sigue adelante por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Estas a la mitad!`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Estas en el punto medio de tu compromiso por <strong>${honoreeName}</strong>. Cada palabra de Torah que has aprendido ha sido un merito para su neshama.`)}
        ${body(`<strong>Tu compromiso:</strong> ${commitmentDesc}${deadline ? `<br><strong>Fecha limite:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Continuar aprendiendo")}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `A mi-chemin — continuez pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Vous etes a mi-chemin !`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Vous etes au milieu de votre engagement pour <strong>${honoreeName}</strong>. Chaque mot de Torah que vous avez etudie a ete un merite pour sa neshama.`)}
        ${body(`<strong>Votre engagement :</strong> ${commitmentDesc}${deadline ? `<br><strong>Echeance :</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Continuer l'etude")}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── Seven Days Before ───────────────────────────────────────────────────────
  sevenDaysBefore: {
    en: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `7 days left — your commitment for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`7 days remaining`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`You have <strong>7 days left</strong> to complete your commitment for <strong>${honoreeName}</strong>. There's still time — you can do this!`)}
        ${body(`<strong>Your commitment:</strong> ${commitmentDesc}${deadline ? `<br><strong>Deadline:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "View my commitment")}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `נותרו 7 ימים — ההתחייבות שלך לעילוי נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`נותרו 7 ימים`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`נותרו לך <strong>7 ימים</strong> להשלים את ההתחייבות שלך לעילוי נשמת <strong>${honoreeName}</strong>. עוד יש זמן!`)}
        ${body(`<strong>ההתחייבות שלך:</strong> ${commitmentDesc}${deadline ? `<br><strong>עד:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "צפה בהתחייבות שלי")}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `7 dias restantes — tu compromiso por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Quedan 7 dias`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Te quedan <strong>7 dias</strong> para completar tu compromiso por <strong>${honoreeName}</strong>. Todavia hay tiempo.`)}
        ${body(`<strong>Tu compromiso:</strong> ${commitmentDesc}${deadline ? `<br><strong>Fecha limite:</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Ver mi compromiso")}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `7 jours restants — votre engagement pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Il reste 7 jours`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Il vous reste <strong>7 jours</strong> pour accomplir votre engagement pour <strong>${honoreeName}</strong>. Il est encore temps !`)}
        ${body(`<strong>Votre engagement :</strong> ${commitmentDesc}${deadline ? `<br><strong>Echeance :</strong> ${deadline}` : ""}`)}
        ${ctaButton(link, "Voir mon engagement")}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── Three Days Before ───────────────────────────────────────────────────────
  threeDaysBefore: {
    en: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `3 days left — complete your learning for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`3 days remaining`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Your deadline is in <strong>3 days</strong>. Now is a great time to complete your commitment of ${commitmentDesc} for <strong>${honoreeName}</strong>.`)}
        ${deadline ? body(`<strong>Deadline:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Complete now")}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `נותרו 3 ימים — השלם את הלימוד לעילוי נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`נותרו 3 ימים`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`המועד האחרון הוא בעוד <strong>3 ימים</strong>. עכשיו זה הזמן להשלים את ${commitmentDesc} לעילוי נשמת <strong>${honoreeName}</strong>.`)}
        ${deadline ? body(`<strong>עד:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "השלם עכשיו")}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `3 dias restantes — completa tu aprendizaje por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Quedan 3 dias`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Tu fecha limite es en <strong>3 dias</strong>. Ahora es un buen momento para completar tu compromiso de ${commitmentDesc} por <strong>${honoreeName}</strong>.`)}
        ${deadline ? body(`<strong>Fecha limite:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Completar ahora")}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `3 jours restants — completez votre etude pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Il reste 3 jours`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Votre echeance est dans <strong>3 jours</strong>. C'est le moment de completer votre engagement de ${commitmentDesc} pour <strong>${honoreeName}</strong>.`)}
        ${deadline ? body(`<strong>Echeance :</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Terminer maintenant")}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── One Day Before ──────────────────────────────────────────────────────────
  oneDayBefore: {
    en: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Tomorrow is your deadline for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Your deadline is tomorrow`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Your commitment of ${commitmentDesc} for <strong>${honoreeName}</strong> is due <strong>tomorrow</strong>. This is your last reminder — you're so close!`)}
        ${deadline ? body(`<strong>Deadline:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Complete my commitment")}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `מחר הוא המועד האחרון שלך לעילוי נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`המועד האחרון שלך הוא מחר`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`ההתחייבות שלך של ${commitmentDesc} לעילוי נשמת <strong>${honoreeName}</strong> היא <strong>מחר</strong>. זוהי התזכורת האחרונה שלך — אתה כמעט שם!`)}
        ${deadline ? body(`<strong>עד:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "השלם את ההתחייבות שלי")}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Manana es tu fecha limite por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Tu fecha limite es manana`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Tu compromiso de ${commitmentDesc} por <strong>${honoreeName}</strong> vence <strong>manana</strong>. Este es tu ultimo recordatorio.`)}
        ${deadline ? body(`<strong>Fecha limite:</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Completar mi compromiso")}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, deadline, link, unsubscribeLink }) => ({
      subject: `Demain est votre echeance pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Votre echeance est demain`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Votre engagement de ${commitmentDesc} pour <strong>${honoreeName}</strong> est du <strong>demain</strong>. C'est votre dernier rappel.`)}
        ${deadline ? body(`<strong>Echeance :</strong> ${deadline}`) : ""}
        ${ctaButton(link, "Completer mon engagement")}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── Daily Reminder ──────────────────────────────────────────────────────────
  dailyReminder: {
    en: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Daily reminder — ${commitmentDesc} for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Today's reminder`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`This is your daily reminder to complete <strong>${commitmentDesc}</strong> for <strong>${honoreeName}</strong>. Each day you learn is a merit for their neshama.`)}
        ${ctaButton(link, "Mark today complete")}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `תזכורת יומית — ${commitmentDesc} לעילוי נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`תזכורת להיום`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`זוהי תזכורת יומית להשלים <strong>${commitmentDesc}</strong> לעילוי נשמת <strong>${honoreeName}</strong>. כל יום שאתה לומד הוא זכות לנשמה.`)}
        ${ctaButton(link, "סמן את היום כהושלם")}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Recordatorio diario — ${commitmentDesc} por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Recordatorio de hoy`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Este es tu recordatorio diario para completar <strong>${commitmentDesc}</strong> por <strong>${honoreeName}</strong>. Cada dia que estudias es un merito para su neshama.`)}
        ${ctaButton(link, "Marcar hoy como completado")}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Rappel quotidien — ${commitmentDesc} pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Rappel du jour`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`C'est votre rappel quotidien pour completer <strong>${commitmentDesc}</strong> pour <strong>${honoreeName}</strong>. Chaque jour d'etude est un merite pour sa neshama.`)}
        ${ctaButton(link, "Marquer aujourd'hui comme complete")}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },

  // ── Weekly Digest ───────────────────────────────────────────────────────────
  weeklyDigest: {
    en: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Weekly update — your learning for ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Your weekly learning summary`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Here is your weekly reminder about your commitment of <strong>${commitmentDesc}</strong> for <strong>${honoreeName}</strong>.`)}
        ${body(`Every portion you complete adds to the collective merit being dedicated to their neshama. Your contribution matters.`)}
        ${ctaButton(link, "View my progress")}
        ${divider()}
        ${body(`<em style="font-size:13px;color:#6B6F76;">May this week's learning bring comfort and elevation to the neshama of ${honoreeName}.</em>`)}
        `,
        TAGLINES.en,
        "ltr",
        "en",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.en
      ),
    }),

    he: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `עדכון שבועי — הלימוד שלך לעילוי נשמת ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`סיכום הלימוד השבועי שלך`)}
        ${badge(`לעילוי נשמת ${honoreeName}`)}
        ${body(`זוהי תזכורת שבועית על ההתחייבות שלך של <strong>${commitmentDesc}</strong> לעילוי נשמת <strong>${honoreeName}</strong>.`)}
        ${body(`כל חלק שאתה מסיים מוסיף לזכות הכוללת המוקדשת לנשמה. ההשתתפות שלך חשובה.`)}
        ${ctaButton(link, "צפה בהתקדמות שלי")}
        ${divider()}
        ${body(`<em style="font-size:13px;color:#6B6F76;">יהי רצון שלימוד השבוע יביא נחמה ועלייה לנשמת ${honoreeName}.</em>`)}
        `,
        TAGLINES.he,
        "rtl",
        "he",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.he
      ),
    }),

    es: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Actualizacion semanal — tu estudio por ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Resumen semanal de tu estudio`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Este es tu recordatorio semanal sobre tu compromiso de <strong>${commitmentDesc}</strong> por <strong>${honoreeName}</strong>.`)}
        ${body(`Cada porcion que completas se suma al merito colectivo dedicado a su neshama.`)}
        ${ctaButton(link, "Ver mi progreso")}
        ${divider()}
        ${body(`<em style="font-size:13px;color:#6B6F76;">Que el estudio de esta semana traiga consuelo y elevacion a la neshama de ${honoreeName}.</em>`)}
        `,
        TAGLINES.es,
        "ltr",
        "es",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.es
      ),
    }),

    fr: ({ honoreeName, commitmentDesc, link, unsubscribeLink }) => ({
      subject: `Resume hebdomadaire — votre etude pour ${honoreeName}`,
      body: emailWrapper(
        `
        ${heading(`Votre resume hebdomadaire d'etude`)}
        ${badge(`L'iluy Nishmas ${honoreeName}`)}
        ${body(`Voici votre rappel hebdomadaire concernant votre engagement de <strong>${commitmentDesc}</strong> pour <strong>${honoreeName}</strong>.`)}
        ${body(`Chaque portion que vous completez s'ajoute au merite collectif dedie a sa neshama.`)}
        ${ctaButton(link, "Voir ma progression")}
        ${divider()}
        ${body(`<em style="font-size:13px;color:#6B6F76;">Que l'etude de cette semaine apporte consolation et elevation a la neshama de ${honoreeName}.</em>`)}
        `,
        TAGLINES.fr,
        "ltr",
        "fr",
        unsubscribeLink,
        UNSUBSCRIBE_TEXT.fr
      ),
    }),
  },
};

/**
 * Get a formatted reminder email.
 *
 * @example
 * const email = getReminderEmail("confirmation", "en", {
 *   honoreeName: "Avraham ben Yitzchak",
 *   commitmentDesc: "Mishnayos Berachos",
 *   link: "https://lzecher.com/en/memorial/smith",
 * });
 * // => { subject: "...", body: "<html>...</html>" }
 */
export function getReminderEmail(
  type: ReminderType,
  locale: ReminderLocale,
  args: ReminderTemplateArgs
): ReminderEmail {
  const safeLocale = (["en", "he", "es", "fr"].includes(locale) ? locale : "en") as ReminderLocale;
  return templates[type][safeLocale](args);
}
