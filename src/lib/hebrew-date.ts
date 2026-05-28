export function toHebrewCalendarDate(timestamp: number, locale: string): string {
  try {
    const date = new Date(timestamp);
    if (locale === 'he') {
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(date);
    }
    const localeMap: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
    return new Intl.DateTimeFormat(localeMap[locale] || 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}
