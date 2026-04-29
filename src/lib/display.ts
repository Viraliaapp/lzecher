import type { MemorialProject } from "./types";

/**
 * Get the best display name for a project given the viewer's locale.
 * Fallback chain: locale-specific name → nameEnglish → nameHebrew
 */
export function getDisplayName(
  project: MemorialProject,
  locale: string = "en"
): string {
  const localeMap: Record<string, string | undefined> = {
    en: project.nameEnglish,
    es: project.nameSpanish,
    fr: project.nameFrench,
    he: project.nameHebrew,
  };

  // Try viewer's locale first
  const localeName = localeMap[locale];
  if (localeName?.trim()) return localeName;

  // Fall back to English
  if (project.nameEnglish?.trim()) return project.nameEnglish;

  // Fall back to Hebrew (always present)
  return project.nameHebrew;
}

/**
 * Get the secondary display name (the other language name for subtitle).
 * If primary is Hebrew, show English. If primary is English, show Hebrew.
 */
export function getSecondaryName(
  project: MemorialProject,
  locale: string = "en"
): string | null {
  const primary = getDisplayName(project, locale);
  if (primary === project.nameHebrew && project.nameEnglish?.trim()) {
    return project.nameEnglish;
  }
  if (primary !== project.nameHebrew) {
    return project.nameHebrew;
  }
  return null;
}
