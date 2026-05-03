import type { MemorialProject } from "./types";

/**
 * Always returns the full Hebrew first + family name.
 */
export function getFullHebrewName(project: MemorialProject): string {
  return `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
}

/**
 * Get the best display name for a project given the viewer's locale.
 * Combines first name + family name.
 * Fallback chain: locale-specific name → nameEnglish → nameHebrew
 */
export function getDisplayName(
  project: MemorialProject,
  locale: string = "en"
): string {
  if (locale === "he") {
    return getFullHebrewName(project);
  }

  // For English locale: first+last English, or fall back to Hebrew full name
  if (locale === "en") {
    const engFull = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();
    if (engFull) return engFull;
    return getFullHebrewName(project);
  }

  const localeMap: Record<string, string | undefined> = {
    es: project.nameSpanish,
    fr: project.nameFrench,
  };

  // Try viewer's locale first
  const localeName = localeMap[locale];
  if (localeName?.trim()) return localeName;

  // Fall back to English full name
  const engFull = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();
  if (engFull) return engFull;

  // Fall back to Hebrew full name (always present)
  return getFullHebrewName(project);
}

/**
 * Returns the display name with the honorific appended.
 */
export function getDisplayNameWithHonorific(
  project: MemorialProject,
  locale: string = "en"
): string {
  const honorific =
    (project as MemorialProject & { honorific?: string }).honorific ||
    (project.gender === "female" ? "ע״ה" : "ז״ל");
  return `${getDisplayName(project, locale)} ${honorific}`.trim();
}

/**
 * Get the secondary display name (the other language name for subtitle).
 * If primary is Hebrew, show English. If primary is English, show Hebrew.
 */
export function getSecondaryName(
  project: MemorialProject,
  locale: string = "en"
): string | null {
  const hebrewFull = getFullHebrewName(project);
  const primary = getDisplayName(project, locale);
  const engFull = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();

  if (primary === hebrewFull && engFull) {
    return engFull;
  }
  if (primary !== hebrewFull) {
    return hebrewFull;
  }
  return null;
}
