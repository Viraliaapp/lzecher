import type { TrackType } from "./types";

export const PROJECT_TYPES = [
  "shiva",
  "shloshim",
  "year",
  "yahrzeit",
  "permanent",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const DEFAULT_PROJECT_TYPE: ProjectType = "shiva";

export const TRACKS_BY_PURPOSE: Record<ProjectType, TrackType[]> = {
  shiva: ["mishnayos", "tehillim", "kabalos"],
  shloshim: ["mishnayos", "tehillim", "kabalos"],
  year: ["mishnayos", "tehillim", "kabalos"],
  yahrzeit: ["mishnayos", "tehillim"],
  permanent: ["mishnayos", "kabalos"],
};

export function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && PROJECT_TYPES.includes(value as ProjectType);
}

export function normalizeProjectType(value: unknown): ProjectType {
  return isProjectType(value) ? value : DEFAULT_PROJECT_TYPE;
}

export function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDays(value: string, days: number): number {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.getTime();
}

function addGregorianYear(value: string): number {
  const date = dateFromIso(value);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.getTime();
}

export function completionTargetForPurpose(
  projectType: ProjectType,
  dateOfPassingGregorian: string | null
): { completionTargetType: "shiva" | "shloshim" | "year" | "yahrzeit" | "open"; completionTargetDate: number | null } {
  if (projectType === "permanent") {
    return { completionTargetType: "open", completionTargetDate: null };
  }

  if (!dateOfPassingGregorian) {
    return { completionTargetType: projectType, completionTargetDate: null };
  }

  if (projectType === "shiva") {
    return { completionTargetType: "shiva", completionTargetDate: addDays(dateOfPassingGregorian, 7) };
  }
  if (projectType === "shloshim") {
    return { completionTargetType: "shloshim", completionTargetDate: addDays(dateOfPassingGregorian, 30) };
  }
  if (projectType === "year") {
    return { completionTargetType: "year", completionTargetDate: addGregorianYear(dateOfPassingGregorian) };
  }

  // A true yahrzeit target needs Hebrew-date anniversary logic. Keep the option
  // useful as a creation purpose now, without pretending the full yahrzeit system exists.
  return { completionTargetType: "yahrzeit", completionTargetDate: null };
}
