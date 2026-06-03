const BASE_URL = "https://lzecher.com";

type SeoLocale = "he" | "en" | "es" | "fr";

type HomeSeoCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  points: { title: string; body: string }[];
  faqTitle: string;
  faqs: { question: string; answer: string }[];
};

const HOME_SEO_COPY: Record<SeoLocale, HomeSeoCopy> = {
  he: {
    eyebrow: "לימוד תורה לעילוי נשמה",
    title: "דרך מכובדת לחלוקת משניות, תהילים וקבלות טובות",
    intro:
      "לזכר עוזרת למשפחות ולקהילות לפתוח דף הנצחה מסודר, לבחור מסלולי לימוד, לשתף קישור אחד, ולעקוב אחרי ההתקדמות עד לסיום. הדף מתאים לשבעה, שלושים, יארצייט, שנת אבל או הנצחה קבועה.",
    points: [
      {
        title: "חלוקת משניות לעילוי נשמה",
        body:
          "אפשר לחלק את ששה סדרי משנה לפרקים ברורים, כך שכל משתתף יודע בדיוק מה קיבל על עצמו ומה כבר נלמד.",
      },
      {
        title: "תהילים חד-פעמי עם מעקב ברור",
        body:
          "פרקי תהילים מוצגים כקבלה חד-פעמית, עם אפשרות לבחור פרק, לקרוא אותו ולסמן לאחר הלימוד.",
      },
      {
        title: "שיתוף למשפחה, קהילה ובית כנסת",
        body:
          "יוצר הדף מקבל קישור ונוסח שיתוף מסודר, כדי להזמין קרובים וחברים להצטרף ללימוד לעילוי הנשמה.",
      },
    ],
    faqTitle: "שאלות נפוצות",
    faqs: [
      {
        question: "איך מחלקים משניות לעילוי נשמה?",
        answer:
          "יוצרים דף הנצחה, בוחרים במסלול משניות, ומשתפים את הקישור. המשתתפים בוחרים פרקים פנויים ומסמנים אותם כנלמדו לאחר הסיום.",
      },
      {
        question: "האם תהילים בלזכר הוא לימוד יומי?",
        answer:
          "לא. פרקי תהילים בלזכר מיועדים בעיקר כקבלה חד-פעמית: כל משתתף בוחר פרק, אומר אותו לעילוי נשמה, ומסמן בסיום.",
      },
      {
        question: "אפשר ליצור דף ליארצייט?",
        answer:
          "כן. בעת יצירת דף הנצחה אפשר לבחור יארצייט, שלושים, שבעה, שנת אבל או הנצחה קבועה, ולבחור את מסלולי הלימוד המתאימים.",
      },
      {
        question: "מה קורה לדף שמוגן בסיסמה?",
        answer:
          "דף שמוגן בסיסמה אינו נכלל במפת האתר ואינו מיועד לאינדוקס ציבורי. רק מי שקיבל את הקישור והסיסמה יכול לפתוח את הדף המלא.",
      },
    ],
  },
  en: {
    eyebrow: "Torah learning in memory of a loved one",
    title: "A respectful way to organize Mishnayos, Tehillim, and commitments",
    intro:
      "Lzecher helps families and communities create a memorial learning page, choose learning tracks, share one link, and follow the progress toward completion. Pages can be used for shiva, shloshim, yahrzeit, a year of mourning, or an ongoing memorial.",
    points: [
      {
        title: "Mishnayos divided clearly",
        body:
          "Divide the six sedarim into clear perakim so every participant knows what they took and what has already been learned.",
      },
      {
        title: "One-time Tehillim with progress",
        body:
          "Tehillim chapters are presented as one-time commitments, with the option to read a chapter and mark it learned.",
      },
      {
        title: "Simple sharing for family and community",
        body:
          "The creator receives a link and share text to invite relatives, friends, and shul groups to join the learning.",
      },
    ],
    faqTitle: "Common Questions",
    faqs: [
      {
        question: "How do you divide Mishnayos l'iluy nishmas?",
        answer:
          "Create a memorial page, choose Mishnayos, and share the link. Participants choose available perakim and mark them learned when they finish.",
      },
      {
        question: "Is Tehillim on Lzecher a daily commitment?",
        answer:
          "No. Tehillim on Lzecher is mainly a one-time commitment: each participant chooses a chapter, says it l'iluy nishmas, and marks it learned.",
      },
      {
        question: "Can I create a page for a yahrzeit?",
        answer:
          "Yes. While creating a memorial page, you can choose yahrzeit, shiva, shloshim, a year of mourning, or an ongoing memorial.",
      },
      {
        question: "Are password-protected pages indexed?",
        answer:
          "Password-protected pages are excluded from the sitemap and marked not for public indexing. Only people with the link and password can open the full page.",
      },
    ],
  },
  es: {
    eyebrow: "Torah learning in memory of a loved one",
    title: "Organize Mishnayot, Tehilim, and meaningful commitments",
    intro:
      "Lzecher helps families create a memorial learning page, share one link, and follow the progress as participants join the learning.",
    points: [
      {
        title: "Clear learning portions",
        body: "Participants can choose available portions and mark them learned when they finish.",
      },
      {
        title: "Tehilim as a one-time commitment",
        body: "Tehilim chapters are treated as one-time commitments, not daily assignments.",
      },
      {
        title: "Respectful sharing",
        body: "Families can share a link and invite others to join the learning in memory of the departed.",
      },
    ],
    faqTitle: "Common Questions",
    faqs: [
      {
        question: "Can I create a page for a yahrzeit?",
        answer: "Yes. Lzecher supports yahrzeit, shiva, shloshim, a year of mourning, and ongoing memorial pages.",
      },
      {
        question: "Are password-protected pages indexed?",
        answer: "Password-protected pages are excluded from the sitemap and marked not for public indexing.",
      },
    ],
  },
  fr: {
    eyebrow: "Torah learning in memory of a loved one",
    title: "Organize Mishnayot, Tehilim, and meaningful commitments",
    intro:
      "Lzecher helps families create a memorial learning page, share one link, and follow the progress as participants join the learning.",
    points: [
      {
        title: "Clear learning portions",
        body: "Participants can choose available portions and mark them learned when they finish.",
      },
      {
        title: "Tehilim as a one-time commitment",
        body: "Tehilim chapters are treated as one-time commitments, not daily assignments.",
      },
      {
        title: "Respectful sharing",
        body: "Families can share a link and invite others to join the learning in memory of the departed.",
      },
    ],
    faqTitle: "Common Questions",
    faqs: [
      {
        question: "Can I create a page for a yahrzeit?",
        answer: "Yes. Lzecher supports yahrzeit, shiva, shloshim, a year of mourning, and ongoing memorial pages.",
      },
      {
        question: "Are password-protected pages indexed?",
        answer: "Password-protected pages are excluded from the sitemap and marked not for public indexing.",
      },
    ],
  },
};

export const HOME_SEO_KEYWORDS: Record<SeoLocale, string[]> = {
  he: [
    "לזכר",
    "לעילוי נשמה",
    "לימוד לעילוי נשמה",
    "חלוקת משניות לעילוי נשמה",
    "תהילים לעילוי נשמה",
    "חלוקת תהילים",
    "דף הנצחה",
    "קבלות טובות לעילוי נשמה",
    "שניים מקרא לעילוי נשמה",
    "יארצייט",
    "שלושים",
    "שבעה",
  ],
  en: [
    "Lzecher",
    "l'iluy nishmas",
    "memorial learning",
    "Mishnayos l'iluy nishmas",
    "Tehillim l'iluy nishmas",
    "yahrzeit learning",
    "Jewish memorial page",
  ],
  es: ["Lzecher", "Tehilim", "Mishnayot", "memorial judío", "yahrzeit"],
  fr: ["Lzecher", "Tehilim", "Mishnayot", "page memoriale juive", "yahrzeit"],
};

export function seoLocale(locale: string): SeoLocale {
  return locale === "he" || locale === "en" || locale === "es" || locale === "fr" ? locale : "he";
}

export function getHomeSeoCopy(locale: string): HomeSeoCopy {
  return HOME_SEO_COPY[seoLocale(locale)];
}

export function getHomeKeywords(locale: string): string[] {
  return HOME_SEO_KEYWORDS[seoLocale(locale)];
}

export function getHomeStructuredData(locale: string, memorialCount: number) {
  const normalizedLocale = seoLocale(locale);
  const copy = getHomeSeoCopy(normalizedLocale);
  const url = `${BASE_URL}/${normalizedLocale}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "Lzecher",
        alternateName: "לזכר",
        url: BASE_URL,
        logo: `${BASE_URL}/icons/icon-512.png`,
        description:
          normalizedLocale === "he"
            ? "פלטפורמה לחלוקת לימוד תורה לעילוי נשמה."
            : "A multilingual memorial learning platform for organizing Torah study in memory of loved ones.",
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        name: "Lzecher",
        alternateName: "לזכר",
        url: BASE_URL,
        publisher: { "@id": `${BASE_URL}/#organization` },
        inLanguage: ["he", "en", "es", "fr"],
      },
      {
        "@type": "WebApplication",
        "@id": `${BASE_URL}/#app`,
        name: normalizedLocale === "he" ? "לזכר" : "Lzecher",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        url,
        inLanguage: normalizedLocale,
        description: copy.intro,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#learning-tracks`,
        name: normalizedLocale === "he" ? "מסלולי לימוד לעילוי נשמה" : "Memorial learning tracks",
        numberOfItems: 4,
        itemListElement: copy.points.map((point, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: point.title,
          description: point.body,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: normalizedLocale,
        mainEntity: copy.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#memorial-directory`,
        name: normalizedLocale === "he" ? "דפי הנצחה בלזכר" : "Lzecher memorial pages",
        url,
        inLanguage: normalizedLocale,
        isPartOf: { "@id": `${BASE_URL}/#website` },
        description: copy.intro,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: memorialCount,
        },
      },
    ],
  };
}
