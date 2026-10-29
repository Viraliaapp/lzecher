const BASE_URL = "https://lzecher.com";

export const SEO_TOPIC_SLUGS = [
  "chalukat-mishnayos",
  "chalukat-tehillim",
  "learning-leiluy-neshama",
] as const;

export type SeoTopicSlug = (typeof SEO_TOPIC_SLUGS)[number];
export type SeoTopicLocale = "he" | "en" | "es" | "fr";

type SeoTopicPage = {
  slug: SeoTopicSlug;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  intro: string;
  sections: { title: string; body: string }[];
  stepsTitle: string;
  steps: string[];
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  primaryCta: string;
  secondaryCta: string;
  keywords: string[];
};

const TOPIC_PAGES: Record<SeoTopicLocale, Record<SeoTopicSlug, SeoTopicPage>> = {
  he: {
    "chalukat-mishnayos": {
      slug: "chalukat-mishnayos",
      title: "חלוקת משניות לעילוי נשמה",
      metaTitle: "חלוקת משניות לעילוי נשמה בחינם | לזכר",
      description:
        "מערכת חינמית ומודרנית לחלוקת משניות לעילוי נשמה. יוצרים דף הנצחה, מחלקים פרקים מתוך ששה סדרי משנה, משתפים קישור ועוקבים אחרי ההתקדמות.",
      eyebrow: "דף מסודר למשפחה ולקהילה",
      intro:
        "לזכר נבנתה כדי להפוך חלוקת משניות לעילוי נשמה לדבר ברור, מכובד ונגיש. במקום טבלאות מבולבלות או הודעות שמתפזרות, יוצרים דף אחד שבו כל משתתף בוחר פרק פנוי ומסמן לאחר הלימוד.",
      sections: [
        {
          title: "חלוקה לפי סדרים, מסכתות ופרקים",
          body:
            "הדף מציג את ששה סדרי משנה בצורה מסודרת: זרעים, מועד, נשים, נזיקין, קדשים וטהרות. אפשר לראות מה פנוי, מה נלקח ומה כבר נלמד.",
        },
        {
          title: "מתאים לשבעה, שלושים, יארצייט ושנת אבל",
          body:
            "בעת יצירת הדף בוחרים את מטרת ההנצחה ואת מסלולי הלימוד המתאימים, כדי שהקישור יהיה נכון למשפחה, לבית הכנסת או לקהילה.",
        },
        {
          title: "שיתוף פשוט בלי בלבול",
          body:
            "המשפחה מקבלת קישור ונוסח שיתוף מסודר. המשתתפים אינם צריכים להבין מערכת מורכבת: נכנסים, בוחרים חלק פנוי ומצטרפים ללימוד.",
        },
      ],
      stepsTitle: "איך זה עובד",
      steps: [
        "יוצרים דף הנצחה עם שם הנפטר או הנפטרת.",
        "בוחרים מסלול משניות ומוסיפים מסלולים נוספים לפי הצורך.",
        "משתפים את הקישור עם משפחה, חברים וקהילה.",
        "כל משתתף בוחר פרק פנוי ומסמן לאחר שסיים ללמוד.",
      ],
      faqTitle: "שאלות נפוצות על חלוקת משניות",
      faqs: [
        {
          question: "האם חלוקת המשניות בלזכר היא בחינם?",
          answer: "כן. אפשר ליצור דף הנצחה ולחלק משניות ללא תשלום.",
        },
        {
          question: "האם אפשר לחלק מסכת שלמה או סדר שלם?",
          answer:
            "כן. המערכת תומכת בבחירת פרקים, מסכתות וסדרים, בהתאם למסלולים שהוגדרו בדף.",
        },
        {
          question: "האם משתתפים צריכים לפתוח חשבון?",
          answer:
            "לא. משתתף יכול לקחת חלק בלימוד דרך הקישור שהמשפחה שיתפה.",
        },
      ],
      primaryCta: "צור דף הנצחה",
      secondaryCta: "ראה דפי הנצחה",
      keywords: [
        "חלוקת משניות",
        "חלוקת משניות לעילוי נשמה",
        "משניות לעילוי נשמה",
        "לימוד משניות לנפטר",
        "משניות יארצייט",
        "משניות לשבעה",
        "סיום ששה סדרי משנה",
      ],
    },
    "chalukat-tehillim": {
      slug: "chalukat-tehillim",
      title: "חלוקת תהילים לעילוי נשמה",
      metaTitle: "חלוקת תהילים לעילוי נשמה | לזכר",
      description:
        "פתחו דף לחלוקת פרקי תהילים לעילוי נשמה. המשתתפים בוחרים פרק, קוראים אותו באתר ומסמנים לאחר הסיום.",
      eyebrow: "פרקי תהילים בצורה ברורה",
      intro:
        "חלוקת תהילים בלזכר מיועדת לקריאה חד-פעמית ומכובדת לעילוי נשמה. כל משתתף יכול לבחור פרק פנוי, לקרוא אותו ישירות באתר ולסמן לאחר שסיים.",
      sections: [
        {
          title: "לא התחייבות יומית",
          body:
            "הנוסח והמסך מבהירים שמדובר בקריאת פרק תהילים פעם אחת, כדי שאנשים ירגישו נוח להצטרף מיד.",
        },
        {
          title: "קריאה באתר וסימון בסיום",
          body:
            "המשתתף יכול לפתוח את הפרק עם ניקוד באתר, לקרוא בצורה נוחה, ולסמן שהפרק נקרא לעילוי הנשמה.",
        },
        {
          title: "מעקב משפחתי",
          body:
            "בדף ההנצחה רואים כמה פרקים נלקחו וכמה כבר הושלמו, כך שהמשפחה יכולה לעקוב אחרי ההתקדמות.",
        },
      ],
      stepsTitle: "איך מחלקים תהילים",
      steps: [
        "יוצרים דף הנצחה ובוחרים מסלול תהילים.",
        "משתפים את הקישור עם הקרובים.",
        "כל משתתף בוחר פרק פנוי וקורא אותו לעילוי הנשמה.",
        "לאחר הקריאה מסמנים שהפרק הושלם.",
      ],
      faqTitle: "שאלות נפוצות על חלוקת תהילים",
      faqs: [
        {
          question: "האם תהילים בלזכר הוא לימוד יומי?",
          answer:
            "לא. פרקי תהילים מוצגים כקריאה חד-פעמית, לא כהתחייבות יומית.",
        },
        {
          question: "האם אפשר לקרוא את הפרק באתר?",
          answer:
            "כן. בפרקי תהילים ניתן לפתוח את הפרק, לקרוא אותו באתר ולסמן בסיום.",
        },
      ],
      primaryCta: "צור דף תהילים",
      secondaryCta: "ראה דפי הנצחה",
      keywords: [
        "חלוקת תהילים",
        "תהילים לעילוי נשמה",
        "פרקי תהילים לנפטר",
        "קריאת תהילים לעילוי נשמה",
      ],
    },
    "learning-leiluy-neshama": {
      slug: "learning-leiluy-neshama",
      title: "לימוד לעילוי נשמה",
      metaTitle: "לימוד לעילוי נשמה: משניות, תהילים וקבלות | לזכר",
      description:
        "לזכר מאפשרת לארגן לימוד לעילוי נשמה: משניות, תהילים, שניים מקרא וקבלות טובות בדף הנצחה אחד.",
      eyebrow: "דרך מכובדת לזכות נשמת יקיריכם",
      intro:
        "כשמשפחה רוצה לארגן לימוד לעילוי נשמה, חשוב שהדף יהיה ברור, מכובד ונוח לשיתוף. לזכר מרכזת את מסלולי הלימוד בדף אחד עם מעקב התקדמות בזמן אמת.",
      sections: [
        {
          title: "מסלולים שמתאימים לעולם התורה",
          body:
            "אפשר לבחור משניות, תהילים, שניים מקרא וקבלות טובות, לפי מה שמתאים למשפחה ולזמן ההנצחה.",
        },
        {
          title: "דף הנצחה שאפשר לשתף",
          body:
            "כל דף מקבל קישור ברור שאפשר לשלוח בווטסאפ, אימייל או הודעה לקהילה.",
        },
        {
          title: "מכובד, פשוט ורב-לשוני",
          body:
            "המערכת תומכת בעברית, אנגלית, ספרדית וצרפתית, ומתאימה למשפחות וקהילות בארץ ובעולם.",
        },
      ],
      stepsTitle: "מה אפשר לארגן בלזכר",
      steps: [
        "חלוקת משניות לפי פרקים, מסכתות וסדרים.",
        "חלוקת תהילים כקריאה חד-פעמית.",
        "קבלות טובות לזמן קצר או ארוך.",
        "שיתוף דף אחד עם מעקב התקדמות ברור.",
      ],
      faqTitle: "שאלות נפוצות",
      faqs: [
        {
          question: "למה ליצור דף הנצחה במקום קובץ או הודעת וואטסאפ?",
          answer:
            "דף הנצחה מרכז את כל ההתחייבויות במקום אחד ומונע כפילויות ובלבול.",
        },
        {
          question: "האם אפשר להשתמש בדף ליארצייט?",
          answer:
            "כן. בעת יצירת הדף אפשר לבחור יארצייט כאחת ממטרות ההנצחה.",
        },
      ],
      primaryCta: "התחל דף הנצחה",
      secondaryCta: "ראה איך זה נראה",
      keywords: [
        "לעילוי נשמה",
        "לימוד לעילוי נשמה",
        "דף הנצחה",
        "הנצחה יהודית",
        "משניות תהילים לעילוי נשמה",
      ],
    },
  },
  en: {
    "chalukat-mishnayos": {
      slug: "chalukat-mishnayos",
      title: "Free Mishnayos Chart for L'iluy Nishmas",
      metaTitle: "Free Mishnayos Chart for L'iluy Nishmas | Lzecher",
      description:
        "Create a free online Mishnayos chart for l'iluy nishmas. Divide sedarim, masechtos, and perakim, share one link, and track progress clearly.",
      eyebrow: "Organized memorial learning",
      intro:
        "Lzecher gives families and communities a clear online Mishnayos chart for l'iluy nishmas. Instead of scattered messages or spreadsheets, everyone joins one page, chooses an available perek, and marks it learned.",
      sections: [
        {
          title: "Sedarim, masechtos, and perakim",
          body:
            "Mishnayos are organized by the six sedarim, with clear status for what is available, taken, and completed.",
        },
        {
          title: "Built for shiva, shloshim, yahrzeit, and the year",
          body:
            "Choose the occasion, select learning tracks, and share a page that fits the family and community.",
        },
        {
          title: "Simple sharing",
          body:
            "Send one link to relatives, friends, and shul groups. Participants can join without learning a complicated system.",
        },
      ],
      stepsTitle: "How it works",
      steps: [
        "Create a memorial page with the niftar's name.",
        "Choose Mishnayos and any other tracks you want.",
        "Share the link with family, friends, and community members.",
        "Participants choose available perakim and mark them learned.",
      ],
      faqTitle: "Mishnayos chart questions",
      faqs: [
        {
          question: "Is Lzecher free?",
          answer: "Yes. You can create a memorial learning page and divide Mishnayos for free.",
        },
        {
          question: "Can someone take a whole masechta or seder?",
          answer: "Yes. Lzecher supports larger Mishnayos commitments while keeping individual perakim visible.",
        },
        {
          question: "Do participants need accounts?",
          answer: "No. Participants can join from the shared link.",
        },
      ],
      primaryCta: "Create a memorial page",
      secondaryCta: "View memorial pages",
      keywords: [
        "Mishnayos chart",
        "Mishnayos l'iluy nishmas",
        "divide Mishnayos",
        "mishnayos for yahrzeit",
        "shisha sidrei mishna",
      ],
    },
    "chalukat-tehillim": {
      slug: "chalukat-tehillim",
      title: "Tehillim Sharing for L'iluy Nishmas",
      metaTitle: "Tehillim Sharing for L'iluy Nishmas | Lzecher",
      description:
        "Create a page for dividing Tehillim l'iluy nishmas. Participants choose a kapitel, read it on the site, and mark it completed.",
      eyebrow: "Clear one-time Tehillim commitments",
      intro:
        "Lzecher makes Tehillim sharing clear and approachable. Each participant chooses a kapitel, says it l'iluy nishmas, and marks it completed.",
      sections: [
        {
          title: "Not a daily obligation",
          body:
            "Tehillim chapters are presented as one-time commitments, so people can join right away.",
        },
        {
          title: "Read and complete on the site",
          body:
            "Participants can open the chapter, read it comfortably, and mark it completed when finished.",
        },
        {
          title: "Progress for the family",
          body:
            "The memorial page shows how many chapters were taken and completed.",
        },
      ],
      stepsTitle: "How to divide Tehillim",
      steps: [
        "Create a memorial page and choose Tehillim.",
        "Share the link.",
        "Each participant chooses an available kapitel.",
        "After saying it, they mark it completed.",
      ],
      faqTitle: "Tehillim questions",
      faqs: [
        {
          question: "Is Tehillim on Lzecher daily?",
          answer: "No. It is mainly a one-time kapitel commitment.",
        },
        {
          question: "Can participants read the kapitel on the site?",
          answer: "Yes. They can open the chapter and mark it completed after reading.",
        },
      ],
      primaryCta: "Create a Tehillim page",
      secondaryCta: "View memorial pages",
      keywords: ["Tehillim l'iluy nishmas", "divide Tehillim", "kapitel Tehillim", "Tehillim for neshama"],
    },
    "learning-leiluy-neshama": {
      slug: "learning-leiluy-neshama",
      title: "Learning L'iluy Nishmas",
      metaTitle: "Learning L'iluy Nishmas: Mishnayos, Tehillim, and Kabalos | Lzecher",
      description:
        "Organize Mishnayos, Tehillim, Shnayim Mikra, and Kabalos commitments l'iluy nishmas on one memorial learning page.",
      eyebrow: "A respectful way to honor a neshama",
      intro:
        "When a family wants to organize learning l'iluy nishmas, the page should be respectful, clear, and easy to share. Lzecher keeps the learning tracks and progress in one place.",
      sections: [
        {
          title: "Tracks for frum communities",
          body:
            "Choose Mishnayos, Tehillim, Shnayim Mikra, and Kabalos according to the family's needs.",
        },
        {
          title: "One page to share",
          body:
            "Every memorial page has a clear link for WhatsApp, email, or community groups.",
        },
        {
          title: "Multilingual and practical",
          body:
            "Lzecher supports Hebrew, English, Spanish, and French for families around the world.",
        },
      ],
      stepsTitle: "What you can organize",
      steps: [
        "Mishnayos by perek, masechta, or seder.",
        "Tehillim as one-time chapter commitments.",
        "Personal Kabalos for a short or longer period.",
        "One shared page with clear progress.",
      ],
      faqTitle: "Common questions",
      faqs: [
        {
          question: "Why use a memorial page instead of a spreadsheet?",
          answer: "A page keeps commitments in one place and reduces duplicate claims and confusion.",
        },
        {
          question: "Can I use it for a yahrzeit?",
          answer: "Yes. Yahrzeit is one of the supported memorial occasions.",
        },
      ],
      primaryCta: "Start a memorial page",
      secondaryCta: "See memorial pages",
      keywords: [
        "l'iluy nishmas",
        "memorial learning",
        "Jewish memorial page",
        "Mishnayos and Tehillim",
        "yahrzeit learning",
      ],
    },
  },
  es: {
    "chalukat-mishnayos": {
      slug: "chalukat-mishnayos",
      title: "Dividir Mishnayot en memoria de un ser querido",
      metaTitle: "Dividir Mishnayot en memoria de un ser querido | Lzecher",
      description:
        "Crea una pagina gratuita para dividir Mishnayot, compartir un enlace y seguir el progreso de aprendizaje en memoria de un ser querido.",
      eyebrow: "Aprendizaje memorial organizado",
      intro:
        "Lzecher ayuda a familias y comunidades a organizar Mishnayot en una sola pagina clara y facil de compartir.",
      sections: [
        { title: "Por sedarim y masechtot", body: "Los participantes ven que partes estan libres, tomadas o completadas." },
        { title: "Para yahrzeit, shiva o shloshim", body: "El creador elige la ocasion y los tracks adecuados." },
        { title: "Un solo enlace", body: "La familia puede compartir una pagina con todos los participantes." },
      ],
      stepsTitle: "Como funciona",
      steps: ["Crea una pagina.", "Elige Mishnayot.", "Comparte el enlace.", "Los participantes eligen y completan partes."],
      faqTitle: "Preguntas frecuentes",
      faqs: [
        { question: "Es gratis?", answer: "Si. Lzecher permite crear paginas memoriales gratuitas." },
        { question: "Se necesita cuenta?", answer: "No. Los participantes pueden entrar con el enlace compartido." },
      ],
      primaryCta: "Crear pagina",
      secondaryCta: "Ver paginas",
      keywords: ["Mishnayot", "lilui nishmat", "yahrzeit", "pagina memorial judia"],
    },
    "chalukat-tehillim": {
      slug: "chalukat-tehillim",
      title: "Dividir Tehilim en memoria de un ser querido",
      metaTitle: "Dividir Tehilim en memoria de un ser querido | Lzecher",
      description:
        "Crea una pagina para dividir capitulos de Tehilim, compartir un enlace y marcar capitulos completados.",
      eyebrow: "Tehilim claro y simple",
      intro:
        "Cada participante puede elegir un capitulo de Tehilim, leerlo y marcarlo completado.",
      sections: [
        { title: "Compromiso de una vez", body: "Tehilim se presenta como una lectura unica, no una obligacion diaria." },
        { title: "Leer en el sitio", body: "Los participantes pueden abrir el capitulo y marcarlo completado." },
        { title: "Progreso visible", body: "La familia ve el avance en la pagina memorial." },
      ],
      stepsTitle: "Como funciona",
      steps: ["Crea una pagina.", "Elige Tehilim.", "Comparte el enlace.", "Los participantes leen y completan."],
      faqTitle: "Preguntas frecuentes",
      faqs: [
        { question: "Es diario?", answer: "No. Es principalmente una lectura unica." },
        { question: "Se puede leer en el sitio?", answer: "Si." },
      ],
      primaryCta: "Crear pagina",
      secondaryCta: "Ver paginas",
      keywords: ["Tehilim", "lilui nishmat", "Tehilim memoria"],
    },
    "learning-leiluy-neshama": {
      slug: "learning-leiluy-neshama",
      title: "Aprendizaje en memoria de un ser querido",
      metaTitle: "Aprendizaje en memoria de un ser querido | Lzecher",
      description:
        "Organiza Mishnayot, Tehilim y compromisos personales en una pagina memorial compartida.",
      eyebrow: "Una forma respetuosa de honrar una neshamah",
      intro:
        "Lzecher reune tracks de aprendizaje y progreso en una pagina clara para familia y comunidad.",
      sections: [
        { title: "Tracks principales", body: "Mishnayot, Tehilim, Shnayim Mikra y Kabalot." },
        { title: "Compartir facilmente", body: "Un enlace para familia, amigos y comunidad." },
        { title: "Multilingue", body: "Hebreo, ingles, espanol y frances." },
      ],
      stepsTitle: "Que puedes organizar",
      steps: ["Mishnayot.", "Tehilim.", "Kabalot.", "Una pagina con progreso."],
      faqTitle: "Preguntas frecuentes",
      faqs: [
        { question: "Sirve para yahrzeit?", answer: "Si." },
        { question: "Por que usar una pagina?", answer: "Ayuda a mantener todo en un lugar." },
      ],
      primaryCta: "Empezar",
      secondaryCta: "Ver paginas",
      keywords: ["memorial judio", "Mishnayot", "Tehilim", "yahrzeit"],
    },
  },
  fr: {
    "chalukat-mishnayos": {
      slug: "chalukat-mishnayos",
      title: "Partager des Michnayot pour une neshamah",
      metaTitle: "Partager des Michnayot pour une neshamah | Lzecher",
      description:
        "Creez gratuitement une page pour partager des Michnayot, envoyer un lien et suivre l'avancement.",
      eyebrow: "Etude memoriale organisee",
      intro:
        "Lzecher aide les familles et communautes a organiser les Michnayot sur une page claire et partageable.",
      sections: [
        { title: "Par sedarim et masechtot", body: "Les participants voient ce qui est disponible, pris ou termine." },
        { title: "Pour yahrzeit, shiva ou shloshim", body: "Le createur choisit l'occasion et les tracks." },
        { title: "Un lien simple", body: "La famille partage une page avec tous les participants." },
      ],
      stepsTitle: "Comment ca marche",
      steps: ["Creez une page.", "Choisissez Michnayot.", "Partagez le lien.", "Les participants choisissent et terminent."],
      faqTitle: "Questions frequentes",
      faqs: [
        { question: "Est-ce gratuit?", answer: "Oui." },
        { question: "Faut-il un compte?", answer: "Non." },
      ],
      primaryCta: "Creer une page",
      secondaryCta: "Voir les pages",
      keywords: ["Michnayot", "ilui neshama", "yahrzeit", "page memoriale juive"],
    },
    "chalukat-tehillim": {
      slug: "chalukat-tehillim",
      title: "Partager des Tehilim pour une neshamah",
      metaTitle: "Partager des Tehilim pour une neshamah | Lzecher",
      description:
        "Creez une page pour partager des chapitres de Tehilim et suivre ce qui a ete termine.",
      eyebrow: "Tehilim clair et simple",
      intro:
        "Chaque participant peut choisir un chapitre de Tehilim, le lire et le marquer termine.",
      sections: [
        { title: "Engagement ponctuel", body: "Tehilim est presente comme une lecture unique, pas une obligation quotidienne." },
        { title: "Lecture sur le site", body: "Les participants peuvent ouvrir le chapitre et le marquer termine." },
        { title: "Progression visible", body: "La famille voit l'avancement sur la page." },
      ],
      stepsTitle: "Comment ca marche",
      steps: ["Creez une page.", "Choisissez Tehilim.", "Partagez le lien.", "Les participants lisent et terminent."],
      faqTitle: "Questions frequentes",
      faqs: [
        { question: "Est-ce quotidien?", answer: "Non, c'est principalement une lecture unique." },
        { question: "Peut-on lire sur le site?", answer: "Oui." },
      ],
      primaryCta: "Creer une page",
      secondaryCta: "Voir les pages",
      keywords: ["Tehilim", "ilui neshama", "Tehilim memorial"],
    },
    "learning-leiluy-neshama": {
      slug: "learning-leiluy-neshama",
      title: "Etude pour une neshamah",
      metaTitle: "Etude pour une neshamah | Lzecher",
      description:
        "Organisez Michnayot, Tehilim et engagements personnels sur une page memoriale partagee.",
      eyebrow: "Une facon respectueuse d'honorer une neshamah",
      intro:
        "Lzecher rassemble les tracks d'etude et la progression sur une page claire pour la famille et la communaute.",
      sections: [
        { title: "Tracks principaux", body: "Michnayot, Tehilim, Shnayim Mikra et Kabalot." },
        { title: "Partage facile", body: "Un lien pour famille, amis et communaute." },
        { title: "Multilingue", body: "Hebreu, anglais, espagnol et francais." },
      ],
      stepsTitle: "Ce que vous pouvez organiser",
      steps: ["Michnayot.", "Tehilim.", "Kabalot.", "Une page avec progression."],
      faqTitle: "Questions frequentes",
      faqs: [
        { question: "Est-ce adapte au yahrzeit?", answer: "Oui." },
        { question: "Pourquoi utiliser une page?", answer: "Tout reste au meme endroit." },
      ],
      primaryCta: "Commencer",
      secondaryCta: "Voir les pages",
      keywords: ["page memoriale juive", "Michnayot", "Tehilim", "yahrzeit"],
    },
  },
};

export function seoTopicLocale(locale: string): SeoTopicLocale {
  return locale === "he" || locale === "en" || locale === "es" || locale === "fr" ? locale : "he";
}

export function getSeoTopicPage(locale: string, slug: SeoTopicSlug): SeoTopicPage {
  return TOPIC_PAGES[seoTopicLocale(locale)][slug] ?? TOPIC_PAGES.he[slug];
}

export function getSeoTopicLinks(locale: string) {
  const normalizedLocale = seoTopicLocale(locale);
  return SEO_TOPIC_SLUGS.map((slug) => {
    const page = getSeoTopicPage(normalizedLocale, slug);
    return { slug, title: page.title, href: `/${slug}` };
  });
}

export function seoTopicAlternates(slug: SeoTopicSlug) {
  return {
    he: `${BASE_URL}/he/${slug}`,
    en: `${BASE_URL}/en/${slug}`,
    es: `${BASE_URL}/es/${slug}`,
    fr: `${BASE_URL}/fr/${slug}`,
    "x-default": `${BASE_URL}/he/${slug}`,
  };
}

export function getSeoTopicStructuredData(locale: string, slug: SeoTopicSlug) {
  const normalizedLocale = seoTopicLocale(locale);
  const page = getSeoTopicPage(normalizedLocale, slug);
  const url = `${BASE_URL}/${normalizedLocale}/${slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: normalizedLocale,
        isPartOf: { "@id": `${BASE_URL}/#website` },
        about: page.keywords.map((keyword) => ({ "@type": "Thing", name: keyword })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: normalizedLocale === "he" ? "לזכר" : "Lzecher",
            item: `${BASE_URL}/${normalizedLocale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.title,
            item: url,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: normalizedLocale,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
