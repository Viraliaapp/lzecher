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
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'streak_broken_returning'
  | 'masechta_complete'
  | 'tehillim_book_complete'
  | 'tehillim_all_complete'
  | 'seder_complete'
  | 'mishnayos_all_complete'
  | 'project_25_percent'
  | 'project_50_percent'
  | 'project_75_percent'
  | 'project_100_percent'
  | 'kabalah_started'
  | 'kabalah_checkin'
  | 'mussar_sefer_complete'
  | 'shnayim_mikra_complete'
  | 'daf_yomi_checkin'
  | 'generic_complete'
  | 'generic_checkin'
  | 'missed_day_encouragement'
  | 'bulk_masechta'
  | 'bulk_seder'
  | 'bulk_shas';

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
  {
    id: 'first_mishna_3',
    scenario: 'first_mishna',
    he: 'פרק ראשון הושלם. הנשמה עולה בכל אות ואות שלמדת לעילוי נשמת {name}.',
    en: 'A first perek completed. The neshama ascends with each letter you learned l\'iluy nishmas {name}.',
    es: 'Un primer perek completado. La neshama asciende con cada letra que estudiaste l\'iluy nishmas {name}.',
    fr: 'Un premier perek acheve. La neshama s\'eleve avec chaque lettre etudiee l\'iluy nishmas {name}.',
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
  {
    id: 'first_tehillim_3',
    scenario: 'first_tehillim',
    he: 'המזמור הראשון עלה לפני הקב״ה. נשמת {name} מקבלת את הזכות של דברי תהלים שאמרת.',
    en: 'The first mizmor has risen before Hashem. {name}\'s neshama receives the zechus of these words of praise.',
    es: 'El primer mizmor ha subido ante Hashem. La neshama de {name} recibe el zechus de estas palabras de alabanza.',
    fr: 'Le premier mizmor est monte devant Hachem. La neshama de {name} recoit le zekhout de ces paroles de louange.',
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
  {
    id: 'first_checkin_3',
    scenario: 'first_checkin',
    he: 'הצעד הראשון נעשה. כל התחלה טובה — ובפרט כזו לעילוי נשמת {name}.',
    en: 'The first step is taken. Every good beginning matters — and especially one l\'iluy nishmas {name}.',
    es: 'El primer paso esta dado. Todo buen comienzo importa — y especialmente uno l\'iluy nishmas {name}.',
    fr: 'Le premier pas est fait. Chaque bon debut compte — et surtout celui-ci l\'iluy nishmas {name}.',
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
  {
    id: 'streak_7_3',
    scenario: 'streak_7',
    he: 'שבעה ימים — שבעה אורות לנשמת {name}. ההתמדה שלך נרשמת בספרי שמים.',
    en: 'Seven days — seven lights for {name}\'s neshama. Your perseverance is inscribed in the heavenly record.',
    es: 'Siete dias — siete luces para la neshama de {name}. Tu perseverancia queda inscrita en los registros celestiales.',
    fr: 'Sept jours — sept lumieres pour la neshama de {name}. Votre perseverance est inscrite dans les registres celestes.',
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
  {
    id: 'streak_30_3',
    scenario: 'streak_30',
    he: 'שלושים יום של התמדה. הזכות הזו מלווה את {name} בעולם שכולו טוב.',
    en: 'Thirty days of consistency. This zechus accompanies {name} in the world of eternal good.',
    es: 'Treinta dias de constancia. Este zechus acompana a {name} en el mundo del bien eterno.',
    fr: 'Trente jours de constance. Ce zekhout accompagne {name} dans le monde du bien eternel.',
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
  {
    id: 'streak_100_3',
    scenario: 'streak_100',
    he: 'מאה יום של אורות לנשמת {name}. ההתמדה שלך היא עדות לאהבה שאינה פוסקת.',
    en: 'A hundred days of light for {name}\'s neshama. Your perseverance is testimony to a love that does not cease.',
    es: 'Cien dias de luz para la neshama de {name}. Tu perseverancia es testimonio de un amor que no cesa.',
    fr: 'Cent jours de lumiere pour la neshama de {name}. Votre perseverance temoigne d\'un amour qui ne cesse pas.',
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
  {
    id: 'masechta_complete_3',
    scenario: 'masechta_complete',
    he: 'מסכת הושלמה. הדרן עלך — הנשמה לא תשכח את דבריך, ואתה לא תשכח אותה.',
    en: 'A masechta complete. Hadran alach — the neshama will not forget your words, and you will not forget it.',
    es: 'Una masejta completa. Hadran alaj — la neshama no olvidara tus palabras, y tu no la olvidaras.',
    fr: 'Une massekhet complete. Hadran alakh — la neshama n\'oubliera pas vos paroles, et vous ne l\'oublierez pas.',
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
  {
    id: 'tehillim_book_complete_3',
    scenario: 'tehillim_book_complete',
    he: 'ספר שלם של תהילים מוקדש לנשמת {name}. כל מזמור שאמרת הוא עוד אור בגן עדן.',
    en: 'A full book of Tehillim dedicated to {name}\'s neshama. Each mizmor you recited is another light in Gan Eden.',
    es: 'Un libro completo de Tehilim dedicado a la neshama de {name}. Cada mizmor que recitaste es otra luz en el Gan Eden.',
    fr: 'Un livre entier de Tehilim dedie a la neshama de {name}. Chaque mizmor recite est une lumiere de plus au Gan Eden.',
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
  {
    id: 'tehillim_all_complete_2',
    scenario: 'tehillim_all_complete',
    he: 'כל מאה וחמישים מזמורים הושלמו. נשמת {name} מקבלת עליה גדולה מכל פרק שנאמר.',
    en: 'All one hundred and fifty mizmors completed. {name}\'s neshama receives great elevation from each chapter recited.',
    es: 'Los ciento cincuenta mizmorim completados. La neshama de {name} recibe una gran elevacion de cada capitulo recitado.',
    fr: 'Les cent cinquante mizmorim completes. La neshama de {name} recoit une grande elevation de chaque chapitre recite.',
  },
  {
    id: 'tehillim_all_complete_3',
    scenario: 'tehillim_all_complete',
    he: 'כל תהלים הסתיים. ספר שלם של שירה ותפילה הוקדש לנשמת {name} — זכות עצומה לעד.',
    en: 'All of Tehillim concluded. An entire book of song and prayer has been dedicated to {name}\'s neshama — an eternal zechus.',
    es: 'Todo el Tehilim concluido. Un libro entero de canto y oracion ha sido dedicado a la neshama de {name} — un zechus eterno.',
    fr: 'Tout le Tehilim conclu. Un livre entier de chant et de priere a ete dedie a la neshama de {name} — un zekhout eternel.',
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
  {
    id: 'seder_complete_3',
    scenario: 'seder_complete',
    he: 'סדר שלם הושלם. בכל פעם שאתם לומדים, נשמת {name} מתעלה עוד ועוד בגן עדן.',
    en: 'A complete seder finished. Each time you learn, {name}\'s neshama ascends further in Gan Eden.',
    es: 'Un seder completo terminado. Cada vez que estudias, la neshama de {name} asciende mas en el Gan Eden.',
    fr: 'Un seder complet acheve. Chaque fois que vous etudiez, la neshama de {name} monte encore plus dans le Gan Eden.',
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
  {
    id: 'mishnayos_all_complete_3',
    scenario: 'mishnayos_all_complete',
    he: 'כל משנ״ה הושלמה — כל נשמ״ה הוארה. {name} זכה לזכות שאין גדולה ממנה.',
    en: 'All Mishna complete — the neshama fully illuminated. {name} has merited a zechus without equal.',
    es: 'Toda la Mishna completa — la neshama plenamente iluminada. {name} ha merecido un zechus sin igual.',
    fr: 'Toute la Michna complete — la neshama entierement illuminee. {name} a merite un zekhout sans egal.',
  },

  // ── project_25_percent ───────────────────────────────────────────────────
  {
    id: 'project_25_percent_1',
    scenario: 'project_25_percent',
    he: 'רבע מהלימוד הושלם. הקהילה הזו עומדת בדיבורה — וכל חלק שנלמד מאיר את נשמת {name}.',
    en: 'A quarter of the learning is complete. This community stands by its word — and every portion learned illuminates {name}\'s neshama.',
    es: 'Un cuarto del estudio esta completo. Esta comunidad cumple su palabra — y cada porcion estudiada ilumina la neshama de {name}.',
    fr: 'Un quart de l\'etude est acheve. Cette communaute tient sa parole — et chaque portion etudiee illumine la neshama de {name}.',
  },
  {
    id: 'project_25_percent_2',
    scenario: 'project_25_percent',
    he: 'עשרים וחמישה אחוז. כל לומד הוסיף את חלקו — ויחד בניתם משהו אמיתי לעילוי נשמת {name}.',
    en: 'Twenty-five percent. Each learner added their part — together you have built something real l\'iluy nishmas {name}.',
    es: 'Veinticinco por ciento. Cada participante agrego su parte — juntos construyeron algo real l\'iluy nishmas {name}.',
    fr: 'Vingt-cinq pour cent. Chaque participant a apporte sa part — ensemble vous avez bati quelque chose de reel l\'iluy nishmas {name}.',
  },
  {
    id: 'project_25_percent_3',
    scenario: 'project_25_percent',
    he: 'רבע מהדרך עברתם. נשמת {name} מרגישה כל אחד ואחד מהלומדים.',
    en: 'A quarter of the way through. {name}\'s neshama feels each and every learner.',
    es: 'Un cuarto del camino recorrido. La neshama de {name} siente a cada uno de los participantes.',
    fr: 'Un quart du chemin parcouru. La neshama de {name} ressent chacun des participants.',
  },

  // ── project_50_percent ───────────────────────────────────────────────────
  {
    id: 'project_50_percent_1',
    scenario: 'project_50_percent',
    he: 'מחצית הלימוד הושלמה. הקהילה שלך מוכיחה שדברים גדולים נעשים צעד אחר צעד, לעילוי נשמת {name}.',
    en: 'Half the learning complete. Your community proves that great things are done step by step, l\'iluy nishmas {name}.',
    es: 'La mitad del estudio completado. Tu comunidad demuestra que las grandes cosas se hacen paso a paso, l\'iluy nishmas {name}.',
    fr: 'La moitie de l\'etude est achevee. Votre communaute prouve que les grandes choses se font pas a pas, l\'iluy nishmas {name}.',
  },
  {
    id: 'project_50_percent_2',
    scenario: 'project_50_percent',
    he: 'חצי מהדרך הושלמה. נשמת {name} מקבלת את הזכות של כל לומד ולומד שנשאר אמון.',
    en: 'Halfway there. {name}\'s neshama receives the zechus of every learner who has remained faithful.',
    es: 'A mitad de camino. La neshama de {name} recibe el zechus de cada participante que se ha mantenido fiel.',
    fr: 'A mi-chemin. La neshama de {name} recoit le zekhout de chaque participant qui est reste fidele.',
  },
  {
    id: 'project_50_percent_3',
    scenario: 'project_50_percent',
    he: 'חמישים אחוז — מחציתו של משהו גדול. המשיכו לעילוי נשמת {name}.',
    en: 'Fifty percent — halfway through something great. Continue l\'iluy nishmas {name}.',
    es: 'Cincuenta por ciento — a mitad de algo grande. Continuen l\'iluy nishmas {name}.',
    fr: 'Cinquante pour cent — a mi-chemin de quelque chose de grand. Continuez l\'iluy nishmas {name}.',
  },

  // ── project_75_percent ───────────────────────────────────────────────────
  {
    id: 'project_75_percent_1',
    scenario: 'project_75_percent',
    he: 'שלושה רבעים הושלמו. קצת עוד, וזכות שלמה לנשמת {name} תהיה בידכם.',
    en: 'Three quarters complete. A little more, and a whole zechus for {name}\'s neshama will be in your hands.',
    es: 'Tres cuartos completados. Un poco mas, y un zechus completo para la neshama de {name} estara en sus manos.',
    fr: 'Trois quarts acheves. Encore un peu, et un zekhout complet pour la neshama de {name} sera entre vos mains.',
  },
  {
    id: 'project_75_percent_2',
    scenario: 'project_75_percent',
    he: 'שבעים וחמישה אחוז. הסיום מתקרב — הנשמה ממתינה לכל חלק שנותר לעילוי נשמת {name}.',
    en: 'Seventy-five percent. The siyum draws near — the neshama awaits every remaining portion l\'iluy nishmas {name}.',
    es: 'Setenta y cinco por ciento. El siyum se acerca — la neshama espera cada porcion restante l\'iluy nishmas {name}.',
    fr: 'Soixante-quinze pour cent. Le siyoum approche — la neshama attend chaque portion restante l\'iluy nishmas {name}.',
  },
  {
    id: 'project_75_percent_3',
    scenario: 'project_75_percent',
    he: 'שלושה מרבעים עברתם יחד. המחסום האחרון לסיום — המשיכו לזכות נשמת {name}.',
    en: 'Three quarters completed together. The final stretch to the siyum — continue for the zechus of {name}\'s neshama.',
    es: 'Tres cuartos completados juntos. El tramo final hacia el siyum — continuen por el zechus de la neshama de {name}.',
    fr: 'Trois quarts completes ensemble. La derniere ligne droite vers le siyoum — continuez pour le zekhout de la neshama de {name}.',
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
  {
    id: 'project_100_percent_3',
    scenario: 'project_100_percent',
    he: 'הלימוד הושלם. הגיע הזמן לסיום לעילוי נשמת {name} — יהי רצון שתתקבל הזכות ברצון.',
    en: 'The learning is complete. The time for the siyum has arrived l\'iluy nishmas {name} — may this zechus be received with favor.',
    es: 'El estudio esta completo. Ha llegado el momento del siyum l\'iluy nishmas {name} — que este zechus sea recibido con favor.',
    fr: 'L\'etude est achevee. Le moment du siyoum est arrive l\'iluy nishmas {name} — puisse ce zekhout etre recu avec faveur.',
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
  {
    id: 'kabalah_started_3',
    scenario: 'kabalah_started',
    he: 'קיבלת קבלה לעילוי נשמת {name}. בכל קיום ישנה עליה — גם לנשמה, גם לך.',
    en: 'A kabalah taken l\'iluy nishmas {name}. In every fulfillment there is elevation — for the neshama and for you.',
    es: 'Una kabalah tomada l\'iluy nishmas {name}. En cada cumplimiento hay elevacion — para la neshama y para ti.',
    fr: 'Une kabalah prise l\'iluy nishmas {name}. Dans chaque accomplissement il y a elevation — pour la neshama et pour vous.',
  },

  // ── kabalah_checkin ───────────────────────────────────────────────────────
  {
    id: 'kabalah_checkin_1',
    scenario: 'kabalah_checkin',
    he: 'קיימת את הקבלה שלך היום. כל קיום הוא עוד חוליה בשרשרת הזכות לנשמת {name}.',
    en: 'You fulfilled your kabalah today. Each fulfillment is another link in the chain of zechus for {name}\'s neshama.',
    es: 'Cumpliste tu kabalah hoy. Cada cumplimiento es otro eslabon en la cadena de zechus para la neshama de {name}.',
    fr: 'Vous avez accompli votre kabalah aujourd\'hui. Chaque accomplissement est un maillon de plus dans la chaine de zekhout pour la neshama de {name}.',
  },
  {
    id: 'kabalah_checkin_2',
    scenario: 'kabalah_checkin',
    he: 'יום נוסף של קיום הקבלה. ההתמדה שלך מלמדת שהתחייבותך לנשמת {name} אמיתית.',
    en: 'Another day of keeping the kabalah. Your consistency shows that your commitment l\'iluy nishmas {name} is genuine.',
    es: 'Otro dia cumpliendo la kabalah. Tu constancia muestra que tu compromiso l\'iluy nishmas {name} es autentico.',
    fr: 'Un autre jour a tenir la kabalah. Votre constance montre que votre engagement l\'iluy nishmas {name} est sincere.',
  },
  {
    id: 'kabalah_checkin_3',
    scenario: 'kabalah_checkin',
    he: 'הקבלה קוימה. מה שלקחת על עצמך לעילוי נשמת {name} — הקב״ה שומע ורואה.',
    en: 'The kabalah is kept. What you took upon yourself l\'iluy nishmas {name} — Hashem hears and sees.',
    es: 'La kabalah esta cumplida. Lo que te comprometi l\'iluy nishmas {name} — Hashem escucha y ve.',
    fr: 'La kabalah est accomplie. Ce que vous avez pris sur vous l\'iluy nishmas {name} — Hachem entend et voit.',
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
  {
    id: 'mussar_sefer_complete_3',
    scenario: 'mussar_sefer_complete',
    he: 'ספר מוסר הושלם לעילוי נשמת {name}. כל מידה שעבדת עליה מוסיפה זכות לנשמה.',
    en: 'A mussar sefer completed l\'iluy nishmas {name}. Every character trait you worked on adds zechus to the neshama.',
    es: 'Un sefer de mussar completado l\'iluy nishmas {name}. Cada midda en la que trabajaste agrega zechus a la neshama.',
    fr: 'Un sefer de moussar complete l\'iluy nishmas {name}. Chaque midda sur laquelle vous avez travaille ajoute du zekhout a la neshama.',
  },

  // ── shnayim_mikra_complete ────────────────────────────────────────────────
  {
    id: 'shnayim_mikra_complete_1',
    scenario: 'shnayim_mikra_complete',
    he: 'פרשה הושלמה בשניים מקרא ואחד תרגום לעילוי נשמת {name}. קיימת את חובת השבוע עם זכות נוספת.',
    en: 'A parsha completed with shnayim mikra v\'echad targum l\'iluy nishmas {name}. You fulfilled the weekly obligation with added zechus.',
    es: 'Una parasha completada con shnayim mikra l\'iluy nishmas {name}. Cumpliste la obligacion semanal con un zechus adicional.',
    fr: 'Une paracha completee avec chnayim mikra l\'iluy nishmas {name}. Vous avez accompli l\'obligation hebdomadaire avec un zekhout supplementaire.',
  },
  {
    id: 'shnayim_mikra_complete_2',
    scenario: 'shnayim_mikra_complete',
    he: 'עוד פרשה של שניים מקרא הושלמה. נשמת {name} מתעלה עם כל פרשה שקראת.',
    en: 'Another parsha of shnayim mikra completed. {name}\'s neshama ascends with each parsha you read.',
    es: 'Otra parasha de shnayim mikra completada. La neshama de {name} asciende con cada parasha que lees.',
    fr: 'Une autre paracha de chnayim mikra achevee. La neshama de {name} s\'eleve avec chaque paracha que vous lisez.',
  },
  {
    id: 'shnayim_mikra_complete_3',
    scenario: 'shnayim_mikra_complete',
    he: 'פרשת השבוע נלמדה לעילוי נשמת {name}. כל פרשה שתסיים מקשרת אותך לנשמה ולתורה.',
    en: 'The weekly parsha learned l\'iluy nishmas {name}. Each parsha you complete connects you to the neshama and to Torah.',
    es: 'La paracha semanal aprendida l\'iluy nishmas {name}. Cada paracha que completas te conecta con la neshama y con la Tora.',
    fr: 'La paracha hebdomadaire etudiee l\'iluy nishmas {name}. Chaque paracha que vous completez vous connecte a la neshama et a la Torah.',
  },

  // ── daf_yomi_checkin ──────────────────────────────────────────────────────
  {
    id: 'daf_yomi_checkin_1',
    scenario: 'daf_yomi_checkin',
    he: 'דף היומי נלמד לעילוי נשמת {name}. עם כל דף, הנשמה מקבלת חלק מהשפע הגדול של הש״ס.',
    en: 'Today\'s daf yomi learned l\'iluy nishmas {name}. With each daf, the neshama receives a portion of the great bounty of Shas.',
    es: 'El daf yomi de hoy aprendido l\'iluy nishmas {name}. Con cada daf, la neshama recibe una porcion de la gran riqueza del Shas.',
    fr: 'Le daf yomi d\'aujourd\'hui etudie l\'iluy nishmas {name}. Avec chaque daf, la neshama recoit une part de la grande richesse du Chas.',
  },
  {
    id: 'daf_yomi_checkin_2',
    scenario: 'daf_yomi_checkin',
    he: 'עוד דף — עוד זכות לנשמת {name}. מי שלומד דף יומי עם כוונה, זכותו גדולה מאד.',
    en: 'Another daf — another zechus for {name}\'s neshama. One who learns daf yomi with intention, their merit is very great.',
    es: 'Otro daf — otro zechus para la neshama de {name}. Quien estudia daf yomi con intencion, su merito es muy grande.',
    fr: 'Un autre daf — un autre zekhout pour la neshama de {name}. Celui qui etudie le daf yomi avec intention, son merite est tres grand.',
  },
  {
    id: 'daf_yomi_checkin_3',
    scenario: 'daf_yomi_checkin',
    he: 'הדף נלמד. יחד עם לומדי הש״ס ברחבי העולם, הקדשת את לימודך לנשמת {name}.',
    en: 'The daf is learned. Together with daf yomi learners around the world, you have dedicated your learning to {name}\'s neshama.',
    es: 'El daf esta aprendido. Junto con los participantes del daf yomi en todo el mundo, dedicaste tu estudio a la neshama de {name}.',
    fr: 'Le daf est etudie. Avec les participants au daf yomi dans le monde entier, vous avez dedie votre etude a la neshama de {name}.',
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

  // ── bulk_masechta ─────────────────────────────────────────────────────────
  {
    id: 'bulk_masechta_1',
    scenario: 'bulk_masechta',
    he: 'מסכת שלמה לעילוי נשמת {name} — מתנה רוחנית עצומה.',
    en: 'An entire masechta l\'iluy nishmas {name} — an immense spiritual gift.',
    es: 'Una masejta completa l\'iluy nishmas {name} — un regalo espiritual inmenso.',
    fr: 'Une massekhet entiere l\'iluy nishmas {name} — un don spirituel immense.',
  },
  {
    id: 'bulk_masechta_2',
    scenario: 'bulk_masechta',
    he: 'לקחת על עצמך מסכת שלמה. הנשמה של {name} מתעלה עם כל פרק שתלמד.',
    en: 'You took on an entire masechta. {name}\'s neshama rises with every perek you learn.',
    es: 'Asumiste una masejta completa. La neshama de {name} asciende con cada perek que aprendes.',
    fr: 'Vous avez pris en charge une massekhet entiere. La neshama de {name} s\'eleve a chaque perek que vous etudiez.',
  },
  {
    id: 'bulk_masechta_3',
    scenario: 'bulk_masechta',
    he: 'מסכת שלמה — כל מילה, כל סוגיה, כל פרק — זכות לנשמת {name}.',
    en: 'A whole masechta — every word, every sugya, every perek — zechus for {name}\'s neshama.',
    es: 'Una masejta completa — cada palabra, cada sugya, cada perek — zechus para la neshama de {name}.',
    fr: 'Une massekhet entiere — chaque mot, chaque sugya, chaque perek — zekhout pour la neshama de {name}.',
  },

  // ── bulk_seder ────────────────────────────────────────────────────────────
  {
    id: 'bulk_seder_1',
    scenario: 'bulk_seder',
    he: 'סדר שלם בש״ס — אורות גדולים נפתחים בנשמת {name}.',
    en: 'An entire seder of Shas — great lights open for {name}\'s neshama.',
    es: 'Un seder completo del Shas — grandes luces se abren para la neshama de {name}.',
    fr: 'Un seder entier du Chas — de grandes lumieres s\'ouvrent pour la neshama de {name}.',
  },
  {
    id: 'bulk_seder_2',
    scenario: 'bulk_seder',
    he: 'קיבלת על עצמך סדר שלם. המעשה הזה מהדהד בעולמות עליונים לזכות {name}.',
    en: 'You took on a full seder. This act echoes in the upper worlds as zechus for {name}.',
    es: 'Asumiste un seder completo. Este acto resuena en los mundos superiores como zechus para {name}.',
    fr: 'Vous avez pris en charge un seder complet. Cet acte resonne dans les mondes superieurs comme zekhout pour {name}.',
  },
  {
    id: 'bulk_seder_3',
    scenario: 'bulk_seder',
    he: 'סדר שלם של משניות — לימוד שמלווה את {name} בכל יום ויום.',
    en: 'A complete seder of Mishnayos — learning that accompanies {name} every single day.',
    es: 'Un seder completo de Mishnayot — estudio que acompana a {name} cada dia.',
    fr: 'Un seder complet de Mishnayot — un etude qui accompagne {name} chaque jour.',
  },

  // ── bulk_shas ─────────────────────────────────────────────────────────────
  {
    id: 'bulk_shas_1',
    scenario: 'bulk_shas',
    he: 'כל הש״ס לעילוי נשמת {name} — אין מתנה רוחנית גדולה מזו.',
    en: 'The entire Shas l\'iluy nishmas {name} — there is no greater spiritual gift than this.',
    es: 'El Shas completo l\'iluy nishmas {name} — no hay regalo espiritual mas grande que este.',
    fr: 'Tout le Chas l\'iluy nishmas {name} — il n\'y a pas de cadeau spirituel plus grand que cela.',
  },
  {
    id: 'bulk_shas_2',
    scenario: 'bulk_shas',
    he: 'ששה סדרים, 525 פרקים — כולם לזכות נשמת {name}. הנשמה מתעלה לאין ערוך.',
    en: 'Six sedarim, 525 perakim — all as zechus for {name}\'s neshama. The neshama is elevated beyond measure.',
    es: 'Seis sedarim, 525 perakim — todos como zechus para la neshama de {name}. La neshama asciende de manera inconmensurable.',
    fr: 'Six sedarim, 525 perakim — tout comme zekhout pour la neshama de {name}. La neshama est elevee au-dela de toute mesure.',
  },
  {
    id: 'bulk_shas_3',
    scenario: 'bulk_shas',
    he: 'קיבלת על עצמך את כל הש״ס. {name} ז״ל זוכה לאור תורה שאין כמותו.',
    en: 'You took upon yourself the entire Shas. {name} merits a light of Torah unlike any other.',
    es: 'Asumiste la responsabilidad de todo el Shas. {name} merece una luz de Tora como ninguna otra.',
    fr: 'Vous avez pris sur vous la totalite du Chas. {name} merite une lumiere de Torah sans pareille.',
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

  // ── streak_3 ──────────────────────────────────────────────────────────
  {
    id: 'streak_3_1',
    scenario: 'streak_3',
    he: '3 ימים של התמדה. כל יום שלמדת בנה שכבה נוספת של זכות לנשמת {name}.',
    en: '3 days of consistency. Each day you learned built another layer of merit for {name}\'s neshama.',
    es: '3 dias de constancia. Cada dia que estudiaste construyo otra capa de merito para la neshama de {name}.',
    fr: '3 jours de perseverance. Chaque jour d\'etude a ajoute une couche de merite pour la neshama de {name}.',
  },

  // ── streak_broken_returning ───────────────────────────────────────────
  {
    id: 'streak_broken_returning_1',
    scenario: 'streak_broken_returning',
    he: 'אתמול חלף, אבל הזכות ממשיכה. כל יום הוא התחלה חדשה לעילוי נשמת {name}.',
    en: 'Yesterday slipped by, but the zechus continues. Every day is a fresh start l\'iluy nishmas {name}.',
    es: 'Ayer paso, pero el zechus continua. Cada dia es un nuevo comienzo l\'iluy nishmas {name}.',
    fr: 'Hier est passe, mais le zekhout continue. Chaque jour est un nouveau depart l\'iluy nishmas {name}.',
  },
  {
    id: 'streak_broken_returning_2',
    scenario: 'streak_broken_returning',
    he: 'החזרה ללימוד אחרי הפסקה היא בעצמה זכות. נמשיך יחד.',
    en: 'Returning to learning after a break is itself a merit. Let\'s continue together.',
    es: 'Volver al estudio despues de una pausa es en si un merito. Continuemos juntos.',
    fr: 'Reprendre l\'etude apres une pause est en soi un merite. Continuons ensemble.',
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
