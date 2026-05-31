/**
 * Pre-written, frum-appropriate share message templates.
 * Two authentic nusachim: shiva (early days) and azkara.
 * Relationship variations: parent, sibling, friend.
 * Placeholders: {name} and {link}.
 */

export type TemplateKey = "shiva" | "azkara" | "parent" | "sibling" | "friend";

export interface ShareTemplate {
  key: TemplateKey;
  label: Record<"he" | "en" | "es" | "fr", string>;
  text: Record<"he" | "en" | "es" | "fr", string>;
}

export const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    key: "shiva",
    label: {
      he: "שבעה",
      en: "Shiva / Early days",
      es: "Shivá / Primeros días",
      fr: "Shiva / Premiers jours",
    },
    text: {
      he: `רק אתמול נפרדנו מ{name} ז״ל, ועדיין קשה להאמין.

בימים הקרובים — ימי השבעה — יש כוח מיוחד לנשמה. כל פרק משנה שנלמד, כל תהילה שנאמרת, עולים ישר למעלה ומחזקים את הנשמה בדרכה.

המשפחה הקימה דף לימוד לזכרו:
{link}

ניתן לבחור פרק, להקליד שם ולשמור — כל קבלה היא חסד של אמת.

מן השמיים ננוחם.`,

      en: `We only just said goodbye to {name} z"l, and it still feels unreal.

In these early days — the days of shiva — learning carries special weight for the neshama. Every perek of Mishnayos, every kapitel Tehillim learned in their memory rises directly upward.

The family has set up a learning page l'iluy nishmas {name}:
{link}

Choose a portion, enter your name, and take it — each kabala is a chesed shel emes.

May we be comforted from Shamayim.`,

      es: `Apenas nos despedimos de {name} ז"ל, y todavía es difícil de creer.

En estos primeros días — los días del shivá — el estudio tiene un poder especial para el alma. Cada capítulo de Mishná, cada capítulo de Tehilim aprendido en su memoria, sube directamente hacia arriba.

La familia creó una página de estudio para la elevación del alma de {name}:
{link}

Elija una porción, escriba su nombre y tómela — cada kabbalá es un chesed shel emet.

Que seamos consolados desde el Cielo.`,

      fr: `Nous venons juste de dire au revoir à {name} ז"ל, et c'est encore difficile à croire.

En ces premiers jours — les jours du shiva — l'étude porte un poids particulier pour la neshama. Chaque pérek de Michnayot, chaque tehilim appris en leur mémoire, monte directement vers le haut.

La famille a créé une page d'étude pour l'élévation de l'âme de {name} :
{link}

Choisissez une portion, entrez votre nom et engagez-vous — chaque kabala est un chesed chel émet.

Que nous soyons consolés des Cieux.`,
    },
  },
  {
    key: "azkara",
    label: {
      he: "אזכרה / שלושים / יום השנה",
      en: "Azkara / Shloshim / Yahrzeit",
      es: "Azkará / Shloshim / Yahrzeit",
      fr: "Azkara / Shlochim / Yartsayt",
    },
    text: {
      he: `לקראת האזכרה של {name} ז״ל, אנחנו מנסים לארגן לימוד לזכרו/ה.

כבר נבחרו חלקים רבים ללימוד — בואו נמלא יחד. כל פרק שנלמד מוסיף נחת רוח לנשמה ומחזק את הקשר שלנו איתו/ה.

הדף המלא של הלימוד:
{link}

בחרו פרק, כתבו שמכם — וביחד נגיע לסיום שלם.

תזכו למצוות. שנזכה להיפגש בשמחות.`,

      en: `As we approach the azkara for {name} z"l, we're organizing learning l'iluy nishmaso/ah.

Many portions have already been taken — let's fill it together. Every perek learned adds nachas ruach to the neshama and strengthens our bond.

The full learning page:
{link}

Take a portion, write your name — and together we'll reach a complete siyum.

Tizku l'mitzvos. May we meet again b'simchos.`,

      es: `Al acercarnos al azkará de {name} ז"ל, estamos organizando estudio para la elevación de su alma.

Ya se han tomado muchas porciones — llenémoslo juntos. Cada capítulo aprendido añade nachas ruaj al alma y fortalece nuestra conexión.

La página completa de estudio:
{link}

Tomen una porción, escriban su nombre — y juntos llegaremos a un siyum completo.

Tizku lemitzvot. Que nos encontremos en alegría.`,

      fr: `À l'approche de l'azkara pour {name} ז"ל, nous organisons une étude pour l'élévation de son âme.

De nombreuses portions ont déjà été prises — prenons-les ensemble. Chaque pérek appris apporte une nachat rouah à la neshama et renforce notre lien.

La page d'étude complète :
{link}

Prenez une portion, écrivez votre nom — et ensemble nous atteindrons un siyoum complet.

Tizkou lemitsvot. Que nous nous rencontrions dans la joie.`,
    },
  },
  {
    key: "parent",
    label: {
      he: "הורה / סב/ה",
      en: "Parent / Grandparent",
      es: "Padre/Madre / Abuelo/a",
      fr: "Parent / Grand-parent",
    },
    text: {
      he: `אבא/אמא שלי, {name} ז״ל, עזב/ה אותנו, ואנחנו מנסים לכבד את זכרו/ה.

פתחנו דף לימוד לזכרו/ה — כל אחד יכול לבחור פרק משנה, מזמור תהלים, או קבלה טובה. כל מה שתלמדו עולה ישר אליו/ה.

הדף:
{link}

יהי זכרו/ה ברוך.`,

      en: `My father/mother, {name} z"l, has left us, and we're trying to honor their memory.

We've set up a learning page in their memory — anyone can take a perek of Mishnayos, a mizmor Tehillim, or a personal kabala. Everything you learn goes straight up to them.

The page:
{link}

Yehi zichro/zichronah baruch.`,

      es: `Mi padre/madre, {name} ז"ל, nos ha dejado, y estamos tratando de honrar su memoria.

Hemos creado una página de estudio en su memoria — cualquiera puede tomar un capítulo de Mishná, un capítulo de Tehilim, o una kabbalá personal. Todo lo que aprendan sube directamente hacia él/ella.

La página:
{link}

Que su memoria sea bendecida.`,

      fr: `Mon père/ma mère, {name} ז"ל, nous a quittés, et nous essayons d'honorer sa mémoire.

Nous avons créé une page d'étude en sa mémoire — chacun peut prendre un pérek de Michnayot, un mizmor Tehilim, ou une kabala personnelle. Tout ce que vous apprenez monte directement vers lui/elle.

La page :
{link}

Que sa mémoire soit bénie.`,
    },
  },
  {
    key: "sibling",
    label: {
      he: "אח / אחות",
      en: "Sibling",
      es: "Hermano/a",
      fr: "Frère / Sœur",
    },
    text: {
      he: `האח/אחות שלי, {name} ז״ל, הלך/הלכה מהעולם.

יצרנו דף לימוד לזכרו/ה — כל אחד מהחברים והמשפחה יכול לבחור חלק. כשייבחרו כל הפרקים, הנשמה תקבל עלייה מיוחדת.

{link}

תודה רבה לכולם.`,

      en: `My brother/sister, {name} z"l, has passed away.

We've created a learning page in their memory — family and friends can each take a portion. When all the portions are taken, the neshama receives a special iluy.

{link}

Thank you all so much.`,

      es: `Mi hermano/hermana, {name} ז"ל, falleció.

Hemos creado una página de estudio en su memoria — familiares y amigos pueden tomar una porción. Cuando todas las porciones sean tomadas, el alma recibe una elevación especial.

{link}

Muchas gracias a todos.`,

      fr: `Mon frère/ma sœur, {name} ז"ל, est décédé(e).

Nous avons créé une page d'étude en sa mémoire — famille et amis peuvent chacun prendre une portion. Quand toutes les portions seront prises, la neshama recevra une élévation spéciale.

{link}

Merci infiniment à tous.`,
    },
  },
  {
    key: "friend",
    label: {
      he: "חבר / ידיד",
      en: "Friend",
      es: "Amigo/a",
      fr: "Ami(e)",
    },
    text: {
      he: `{name} ז״ל, חבר יקר, עזב אותנו. המשפחה הקימה דף לימוד לזכרו, וביקשו שנפיץ:

{link}

כל אחד יכול לבחור חלק ולהשתתף בזיכויו. זה הכי פשוט — נכנסים, בוחרים פרק, כותבים שם ומאשרים. כל הלימוד עולה לנשמתו.

תזכו למצוות.`,

      en: `{name} z"l, a dear friend, has passed away. The family set up a learning page in his/her memory and asked us to share it:

{link}

Anyone can take a portion and participate in the zechus. It's simple — go in, pick a section, write your name, and confirm. All the learning goes l'iluy nishmas {name}.

Tizku l'mitzvos.`,

      es: `{name} ז"ל, un querido amigo/a, nos ha dejado. La familia creó una página de estudio en su memoria y pidió que la compartamos:

{link}

Cualquiera puede tomar una porción y participar en el zkhut. Es simple — entren, elijan una sección, escriban su nombre y confirmen. Todo el estudio es para la elevación del alma de {name}.

Tizku lemitzvot.`,

      fr: `{name} ז"ל, un cher ami(e), nous a quittés. La famille a créé une page d'étude en sa mémoire et nous a demandé de la partager :

{link}

Chacun peut prendre une portion et participer au zekhout. C'est simple — entrez, choisissez une section, écrivez votre nom et confirmez. Toute l'étude est pour l'élévation de l'âme de {name}.

Tizkou lemitsvot.`,
    },
  },
];

export function fillTemplate(text: string, honoree: string, url: string): string {
  return text.replace(/\{name\}/g, honoree).replace(/\{link\}/g, url);
}
