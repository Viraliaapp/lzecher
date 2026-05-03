export interface ChizukMessage {
  id: string;
  scenario: ChizukScenario;
  he: string;
  en: string;
  es: string;
  fr: string;
}

export type ChizukScenario =
  | 'first_mishna'
  | 'first_tehillim'
  | 'first_checkin'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'masechta_complete'
  | 'tehillim_book_complete'
  | 'tehillim_all_complete'
  | 'seder_complete'
  | 'mishnayos_all_complete'
  | 'project_100_percent'
  | 'kabalah_started'
  | 'mussar_sefer_complete'
  | 'generic_complete'
  | 'generic_checkin'
  | 'missed_day_encouragement';

export const CHIZUK_MESSAGES: ChizukMessage[] = [
  // ── first_mishna ──────────────────────────────────────────────────────────
  {
    id: 'first_mishna_1',
    scenario: 'first_mishna',
    he: 'ראשית הדרך. כל מילה שלמדת יוצרת אורות חדשים בנשמת {name}.',
    en: 'The first step. Every word you learned creates new light for {name}\'s neshama.',
    es: 'El primer paso. Cada palabra que aprendiste crea nueva luz para la neshama de {name}.',
    fr: 'Le premier pas. Chaque mot que vous avez etudie cree une nouvelle lumiere pour la neshama de {name}.',
  },
  {
    id: 'first_mishna_2',
    scenario: 'first_mishna',
    he: 'המשנה הראשונה נלמדה. אותיות משנ״ה הן אותיות נשמ״ה — קשר עמוק בין לימודך לנשמת {name}.',
    en: 'The first mishna is learned. The letters of Mishna are the letters of Neshama — a deep bond between your learning and {name}\'s soul.',
    es: 'La primera mishna ha sido estudiada. Las letras de Mishna son las letras de Neshama, un vinculo profundo entre tu estudio y el alma de {name}.',
    fr: 'La premiere michna est etudiee. Les lettres de Michna sont les lettres de Neshama — un lien profond entre votre etude et l\'ame de {name}.',
  },

  // ── first_tehillim ────────────────────────────────────────────────────────
  {
    id: 'first_tehillim_1',
    scenario: 'first_tehillim',
    he: 'מזמור ראשון הושלם. דוד המלך אמר את המילים האלו ברוח הקודש — ועכשיו הן מוקדשות לנשמת {name}.',
    en: 'The first psalm is complete. King David composed these words with divine inspiration — now they are dedicated to {name}\'s neshama.',
    es: 'El primer salmo esta completo. El Rey David compuso estas palabras con inspiracion divina, y ahora estan dedicadas a la neshama de {name}.',
    fr: 'Le premier psaume est complete. Le roi David a compose ces mots avec inspiration divine — ils sont maintenant dedies a la neshama de {name}.',
  },
  {
    id: 'first_tehillim_2',
    scenario: 'first_tehillim',
    he: 'תהילים ראשון לעילוי נשמת {name}. כל פרק שתאמר מוסיף זכות לנשמה.',
    en: 'First Tehillim l\'iluy nishmas {name}. Every chapter you recite adds merit to the neshama.',
    es: 'Primer Tehilim l\'iluy nishmas {name}. Cada capitulo que recitas agrega merito a la neshama.',
    fr: 'Premier Tehilim l\'iluy nishmas {name}. Chaque chapitre que vous recitez ajoute du merite a la neshama.',
  },

  // ── first_checkin ─────────────────────────────────────────────────────────
  {
    id: 'first_checkin_1',
    scenario: 'first_checkin',
    he: 'צ\'ק-אין ראשון. ההתחייבות שלך אינה רק הבטחה — היא מעשה ממשי לעילוי נשמת {name}.',
    en: 'First check-in. Your commitment is not only a promise — it is a real act l\'iluy nishmas {name}.',
    es: 'Primer registro. Tu compromiso no es solo una promesa, es un acto real l\'iluy nishmas {name}.',
    fr: 'Premier enregistrement. Votre engagement n\'est pas seulement une promesse — c\'est un acte concret l\'iluy nishmas {name}.',
  },
  {
    id: 'first_checkin_2',
    scenario: 'first_checkin',
    he: 'היום הראשון של ההתמדה. נשמת {name} מאירה מכל יום שאתה לומד.',
    en: 'The first day of consistency. {name}\'s neshama is illuminated by every day you learn.',
    es: 'El primer dia de constancia. La neshama de {name} se ilumina con cada dia que estudias.',
    fr: 'Le premier jour de constance. La neshama de {name} est illuminee par chaque jour que vous etudiez.',
  },

  // ── streak_7 ──────────────────────────────────────────────────────────────
  {
    id: 'streak_7_1',
    scenario: 'streak_7',
    he: 'שבעה ימים של התמדה. {name} זוכה לקרבת ה׳ בכל יום שאתה לומד.',
    en: 'Seven days of consistency. {name} merits closeness to Hashem through every day you learn.',
    es: 'Siete dias de constancia. {name} merece la cercania a Hashem en cada dia que estudias.',
    fr: 'Sept jours de constance. {name} merite la proximite de Hachem par chaque jour que vous etudiez.',
  },
  {
    id: 'streak_7_2',
    scenario: 'streak_7',
    he: 'שבוע שלם של זכות. מה שהתחיל כהחלטה הופך לדרך.',
    en: 'A full week of zechus. What began as a decision is becoming a way.',
    es: 'Una semana completa de zechus. Lo que comenzo como una decision se esta convirtiendo en un camino.',
    fr: 'Une semaine entiere de zekhout. Ce qui a commence comme une decision devient un chemin.',
  },

  // ── streak_30 ─────────────────────────────────────────────────────────────
  {
    id: 'streak_30_1',
    scenario: 'streak_30',
    he: 'שלושים יום של זכות. זה כבר לא התחייבות — זה דרך חיים.',
    en: 'Thirty days of zechus. This is no longer just a commitment — it is a way of life.',
    es: 'Treinta dias de zechus. Esto ya no es solo un compromiso, es un estilo de vida.',
    fr: 'Trente jours de zekhout. Ce n\'est plus seulement un engagement — c\'est un mode de vie.',
  },
  {
    id: 'streak_30_2',
    scenario: 'streak_30',
    he: 'חודש של התמדה. {name} מקבל זכות מצטברת שאי אפשר למדוד בדיוק — אבל היא אמיתית.',
    en: 'A month of perseverance. {name} receives cumulative merit that cannot be measured precisely — but it is real.',
    es: 'Un mes de perseverancia. {name} recibe un merito acumulado que no puede medirse con precision, pero es real.',
    fr: 'Un mois de perseverance. {name} recoit un merite cumulatif qu\'on ne peut mesurer avec precision — mais il est reel.',
  },

  // ── streak_100 ────────────────────────────────────────────────────────────
  {
    id: 'streak_100_1',
    scenario: 'streak_100',
    he: 'מאה יום. מה שהתחיל לעילוי נשמת {name} הפך גם לחלק ממך.',
    en: 'One hundred days. What began l\'iluy nishmas {name} has also become part of who you are.',
    es: 'Cien dias. Lo que comenzo l\'iluy nishmas {name} tambien se ha convertido en parte de ti.',
    fr: 'Cent jours. Ce qui a commence l\'iluy nishmas {name} fait maintenant partie de vous.',
  },
  {
    id: 'streak_100_2',
    scenario: 'streak_100',
    he: 'מאה ימים של עמידה בהתחייבות. הקב״ה שומע כל לימוד ולימוד. נשמת {name} מוארת.',
    en: 'One hundred days of keeping your word. Hashem hears every session of learning. {name}\'s neshama is illuminated.',
    es: 'Cien dias cumpliendo tu palabra. Hashem escucha cada sesion de estudio. La neshama de {name} esta iluminada.',
    fr: 'Cent jours a tenir votre parole. Hachem entend chaque seance d\'etude. La neshama de {name} est illuminee.',
  },

  // ── masechta_complete ─────────────────────────────────────────────────────
  {
    id: 'masechta_complete_1',
    scenario: 'masechta_complete',
    he: 'סיום מסכת לעילוי נשמת {name}. אין מתנה רוחנית גדולה מזו.',
    en: 'A masechta completed l\'iluy nishmas {name}. There is no greater spiritual gift than this.',
    es: 'Una masejta completada l\'iluy nishmas {name}. No hay regalo espiritual mas grande que este.',
    fr: 'Une massekhet completee l\'iluy nishmas {name}. Il n\'y a pas de cadeau spirituel plus grand que cela.',
  },
  {
    id: 'masechta_complete_2',
    scenario: 'masechta_complete',
    he: 'הגעת לסוף המסכת. כל סוגיא שלמדת מוסיפה זוהר לנשמת {name}.',
    en: 'You reached the end of the masechta. Every sugya you learned adds radiance to {name}\'s neshama.',
    es: 'Llegaste al final de la masejta. Cada sugya que estudiaste agrega resplandor a la neshama de {name}.',
    fr: 'Vous avez atteint la fin de la massekhta. Chaque sugya etudie ajoute de l\'eclat a la neshama de {name}.',
  },

  // ── tehillim_book_complete ────────────────────────────────────────────────
  {
    id: 'tehillim_book_complete_1',
    scenario: 'tehillim_book_complete',
    he: 'ספר תהילים שלם הושלם. דברי דוד המלך עלו לפני הקב״ה כזכות לנשמת {name}.',
    en: 'A full book of Tehillim is complete. The words of King David have ascended before Hashem as a merit for {name}\'s neshama.',
    es: 'Un libro completo de Tehilim fue completado. Las palabras del Rey David han ascendido ante Hashem como merito para la neshama de {name}.',
    fr: 'Un livre entier de Tehilim est complete. Les paroles du roi David sont montees devant Hachem comme merite pour la neshama de {name}.',
  },
  {
    id: 'tehillim_book_complete_2',
    scenario: 'tehillim_book_complete',
    he: 'ספר תהילים הושלם לעילוי נשמת {name}. יהי רצון שיתקבל ברצון.',
    en: 'A book of Tehillim completed l\'iluy nishmas {name}. May it be received with favor above.',
    es: 'Un libro de Tehilim completado l\'iluy nishmas {name}. Que sea recibido con favor en lo Alto.',
    fr: 'Un livre de Tehilim complete l\'iluy nishmas {name}. Puisse-t-il etre recu avec faveur en Haut.',
  },

  // ── tehillim_all_complete ─────────────────────────────────────────────────
  {
    id: 'tehillim_all_complete_1',
    scenario: 'tehillim_all_complete',
    he: 'כל ספר תהילים הושלם לעילוי נשמת {name}. מאה וחמישים מזמורים — מתנה שלמה לנשמה.',
    en: 'All of Tehillim completed l\'iluy nishmas {name}. One hundred and fifty psalms — a whole gift for the neshama.',
    es: 'Todo el Tehilim completado l\'iluy nishmas {name}. Ciento cincuenta salmos, un regalo completo para la neshama.',
    fr: 'Tout le Tehilim complete l\'iluy nishmas {name}. Cent cinquante psaumes — un cadeau entier pour la neshama.',
  },

  // ── seder_complete ────────────────────────────────────────────────────────
  {
    id: 'seder_complete_1',
    scenario: 'seder_complete',
    he: 'סדר שלם של משנה הושלם. ששית מכל ששת הסדרים מוקדשת לנשמת {name}.',
    en: 'A full seder of Mishna is complete. One sixth of all six sedarim dedicated to {name}\'s neshama.',
    es: 'Un seder completo de Mishna esta completo. Un sexto de los seis sedarim dedicado a la neshama de {name}.',
    fr: 'Un seder complet de Michna est acheve. Un sixieme des six sedarim dedie a la neshama de {name}.',
  },
  {
    id: 'seder_complete_2',
    scenario: 'seder_complete',
    he: 'סדר הושלם לעילוי נשמת {name}. הנשמה מקבלת עליה מכל משנה ומשנה שנלמדת.',
    en: 'A seder completed l\'iluy nishmas {name}. The neshama receives elevation from every mishna learned.',
    es: 'Un seder completado l\'iluy nishmas {name}. La neshama recibe elevacion de cada mishna estudiada.',
    fr: 'Un seder complete l\'iluy nishmas {name}. La neshama recoit une elevation de chaque michna etudiee.',
  },

  // ── mishnayos_all_complete ────────────────────────────────────────────────
  {
    id: 'mishnayos_all_complete_1',
    scenario: 'mishnayos_all_complete',
    he: 'כל ששת הסדרים הושלמו לעילוי נשמת {name}. אין מילים לתאר את גודל הזכות.',
    en: 'All six sedarim completed l\'iluy nishmas {name}. There are no words to describe the greatness of this zechus.',
    es: 'Los seis sedarim completos l\'iluy nishmas {name}. No hay palabras para describir la grandeza de este zechus.',
    fr: 'Les six sedarim completes l\'iluy nishmas {name}. Il n\'y a pas de mots pour decrire la grandeur de ce zekhout.',
  },
  {
    id: 'mishnayos_all_complete_2',
    scenario: 'mishnayos_all_complete',
    he: 'שש מאות וחמש ועשרים פרקי משנה הושלמו. נשמת {name} עלתה לגבהים שרק הקב״ה יודע.',
    en: 'Five hundred and twenty-five chapters of Mishna completed. {name}\'s neshama has ascended to heights that only Hashem knows.',
    es: 'Quinientos veinticinco capitulos de Mishna completados. La neshama de {name} ha ascendido a alturas que solo Hashem conoce.',
    fr: 'Cinq cent vingt-cinq chapitres de Michna completes. La neshama de {name} a ascende a des hauteurs que seul Hachem connait.',
  },

  // ── project_100_percent ───────────────────────────────────────────────────
  {
    id: 'project_100_percent_1',
    scenario: 'project_100_percent',
    he: 'הושלם הלימוד כולו. זכות עצומה לנשמת {name}. הגיע הזמן לתכנן סיום.',
    en: 'All learning completed. An immense zechus for {name}\'s neshama. The time has come to plan a siyum.',
    es: 'Todo el estudio completado. Un zechus inmenso para la neshama de {name}. Es hora de planificar un siyum.',
    fr: 'Tout l\'apprentissage complete. Un zekhout immense pour la neshama de {name}. Le moment est venu de planifier un siyoum.',
  },
  {
    id: 'project_100_percent_2',
    scenario: 'project_100_percent',
    he: 'מאה אחוז. כל חלק נתבע ונלמד. הקהילה הזו עשתה משהו נדיר — עמדה בהתחייבות עד הסוף, לכבוד נשמת {name}.',
    en: 'One hundred percent. Every portion claimed and learned. This community did something rare — kept its commitment to the end, in honor of {name}\'s neshama.',
    es: 'Cien por ciento. Cada porcion reclamada y estudiada. Esta comunidad hizo algo raro: cumplio su compromiso hasta el final, en honor a la neshama de {name}.',
    fr: 'Cent pour cent. Chaque portion reclamee et etudiee. Cette communaute a fait quelque chose de rare — elle a tenu son engagement jusqu\'au bout, en l\'honneur de la neshama de {name}.',
  },

  // ── kabalah_started ───────────────────────────────────────────────────────
  {
    id: 'kabalah_started_1',
    scenario: 'kabalah_started',
    he: 'קיבלת על עצמך קבלה לעילוי נשמת {name}. כל פעם שתקיים אותה, הנשמה עולה.',
    en: 'You have taken on a kabalah l\'iluy nishmas {name}. Every time you keep it, the neshama ascends.',
    es: 'Has asumido una kabalah l\'iluy nishmas {name}. Cada vez que la cumplas, la neshama asciende.',
    fr: 'Vous avez pris sur vous une kabalah l\'iluy nishmas {name}. Chaque fois que vous la respectez, la neshama s\'eleve.',
  },
  {
    id: 'kabalah_started_2',
    scenario: 'kabalah_started',
    he: 'התחייבות חדשה. ההחלטה שקיבלת היום תשפיע על נשמת {name} כל עוד תקיים אותה.',
    en: 'A new commitment. The decision you made today will benefit {name}\'s neshama for as long as you keep it.',
    es: 'Un nuevo compromiso. La decision que tomaste hoy beneficiara la neshama de {name} mientras la mantengas.',
    fr: 'Un nouvel engagement. La decision que vous avez prise aujourd\'hui beneficiera a la neshama de {name} tant que vous la respecterez.',
  },

  // ── mussar_sefer_complete ─────────────────────────────────────────────────
  {
    id: 'mussar_sefer_complete_1',
    scenario: 'mussar_sefer_complete',
    he: 'ספר מוסר הושלם לעילוי נשמת {name}. כל פרק שהפנמת הוא זכות לנשמה ושיפור לך.',
    en: 'A mussar sefer completed l\'iluy nishmas {name}. Every chapter you internalized is a zechus for the neshama and an improvement for yourself.',
    es: 'Un sefer de mussar completado l\'iluy nishmas {name}. Cada capitulo que internalizaste es un zechus para la neshama y una mejora para ti.',
    fr: 'Un sefer de moussar complete l\'iluy nishmas {name}. Chaque chapitre que vous avez interiorise est un zekhout pour la neshama et une amelioration pour vous.',
  },
  {
    id: 'mussar_sefer_complete_2',
    scenario: 'mussar_sefer_complete',
    he: 'סיום ספר מוסר. הדרך לחיים טובים יותר ולזכות לנשמת {name} מחוברות כאחד.',
    en: 'A mussar sefer complete. The path toward better living and the zechus for {name}\'s neshama are joined as one.',
    es: 'Un sefer de mussar completo. El camino hacia una vida mejor y el zechus para la neshama de {name} estan unidos como uno.',
    fr: 'Un sefer de moussar complete. Le chemin vers une meilleure vie et le zekhout pour la neshama de {name} sont unis en un seul.',
  },

  // ── generic_complete ──────────────────────────────────────────────────────
  {
    id: 'generic_complete_1',
    scenario: 'generic_complete',
    he: 'הושלם. כל מה שלמדת לעילוי נשמת {name} נרשם למעלה.',
    en: 'Complete. Everything you learned l\'iluy nishmas {name} is recorded above.',
    es: 'Completo. Todo lo que aprendiste l\'iluy nishmas {name} esta registrado en lo Alto.',
    fr: 'Complete. Tout ce que vous avez etudie l\'iluy nishmas {name} est inscrit en Haut.',
  },
  {
    id: 'generic_complete_2',
    scenario: 'generic_complete',
    he: 'עוד זכות לנשמת {name}. כל השלמה — גדולה או קטנה — מוסיפה אור.',
    en: 'Another zechus for {name}\'s neshama. Every completion — large or small — adds light.',
    es: 'Otro zechus para la neshama de {name}. Cada finalizacion, grande o pequena, agrega luz.',
    fr: 'Un autre zekhout pour la neshama de {name}. Chaque achevement — grand ou petit — ajoute de la lumiere.',
  },
  {
    id: 'generic_complete_3',
    scenario: 'generic_complete',
    he: 'נשמת {name} מקבלת עליה מכל דבר שלמדת. המשך כך.',
    en: '{name}\'s neshama receives elevation from everything you learn. Continue this way.',
    es: 'La neshama de {name} recibe elevacion de todo lo que aprendes. Continua asi.',
    fr: 'La neshama de {name} recoit une elevation de tout ce que vous etudiez. Continuez ainsi.',
  },

  // ── generic_checkin ───────────────────────────────────────────────────────
  {
    id: 'generic_checkin_1',
    scenario: 'generic_checkin',
    he: 'צ\'ק-אין של היום. ההתמדה שלך היא הדבר החשוב ביותר — לא השלמות.',
    en: 'Today\'s check-in. Your consistency is what matters most — not perfection.',
    es: 'Registro de hoy. Tu constancia es lo que mas importa, no la perfeccion.',
    fr: 'Enregistrement d\'aujourd\'hui. Votre constance est ce qui compte le plus — non la perfection.',
  },
  {
    id: 'generic_checkin_2',
    scenario: 'generic_checkin',
    he: 'יום נוסף של זכות לנשמת {name}. כל יום שאתה לומד הוא מתנה שלא תישכח.',
    en: 'Another day of zechus for {name}\'s neshama. Every day you learn is a gift that will not be forgotten.',
    es: 'Otro dia de zechus para la neshama de {name}. Cada dia que estudias es un regalo que no sera olvidado.',
    fr: 'Un autre jour de zekhout pour la neshama de {name}. Chaque jour que vous etudiez est un cadeau qui ne sera pas oublie.',
  },
  {
    id: 'generic_checkin_3',
    scenario: 'generic_checkin',
    he: 'הופעת שוב. זה לא מובן מאליו — וזה בדיוק מה שנשמת {name} זקוקה לו.',
    en: 'You showed up again. That is not to be taken for granted — and it is exactly what {name}\'s neshama needs.',
    es: 'Volviste a aparecer. Eso no debe darse por sentado, y es exactamente lo que la neshama de {name} necesita.',
    fr: 'Vous etes revenu. Cela ne va pas de soi — et c\'est exactement ce dont la neshama de {name} a besoin.',
  },

  // ── missed_day_encouragement ──────────────────────────────────────────────
  {
    id: 'missed_day_1',
    scenario: 'missed_day_encouragement',
    he: 'יום אתמול חלף — אבל היום כאן. הזכות ממשיכה.',
    en: 'Yesterday passed — but today is here. The zechus continues.',
    es: 'Ayer paso, pero hoy esta aqui. El zechus continua.',
    fr: 'Hier est passe — mais aujourd\'hui est la. Le zekhout continue.',
  },
  {
    id: 'missed_day_2',
    scenario: 'missed_day_encouragement',
    he: 'אין כאן שיפוט. נשמת {name} מחכה לכל לימוד שתוסיף — היום, מחר, בכל עת.',
    en: 'There is no judgment here. {name}\'s neshama awaits every learning you add — today, tomorrow, at any time.',
    es: 'No hay juicio aqui. La neshama de {name} espera cada estudio que agregues, hoy, manana, en cualquier momento.',
    fr: 'Il n\'y a pas de jugement ici. La neshama de {name} attend chaque etude que vous ajoutez — aujourd\'hui, demain, a tout moment.',
  },
  {
    id: 'missed_day_3',
    scenario: 'missed_day_encouragement',
    he: 'חיי תורה אינם מדידים ביום אחד. מה שבנית עד עכשיו קיים — וניתן להמשיך.',
    en: 'A life of Torah cannot be measured by a single day. What you have built until now exists — and can be continued.',
    es: 'Una vida de Tora no puede medirse por un solo dia. Lo que has construido hasta ahora existe y puede continuarse.',
    fr: 'Une vie de Torah ne peut se mesurer a un seul jour. Ce que vous avez bati jusqu\'a maintenant existe — et peut etre continue.',
  },
];

export function getChizukMessage(scenario: ChizukScenario, index?: number): ChizukMessage {
  const messages = CHIZUK_MESSAGES.filter((m) => m.scenario === scenario);
  if (messages.length === 0) {
    return CHIZUK_MESSAGES.find((m) => m.scenario === 'generic_complete')!;
  }
  const i =
    index !== undefined
      ? index % messages.length
      : Math.floor(Math.random() * messages.length);
  return messages[i];
}
