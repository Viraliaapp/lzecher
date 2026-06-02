export function getTehillimChapterNumberFromPortion(portion: {
  mizmor?: number;
  reference?: string;
  displayName?: string;
  displayNameHebrew?: string;
}): number | null {
  if (Number.isInteger(portion.mizmor) && portion.mizmor! >= 1 && portion.mizmor! <= 150) {
    return portion.mizmor!;
  }
  const joined = [portion.reference, portion.displayName, portion.displayNameHebrew].filter(Boolean).join(" ");
  const match = joined.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const chapter = Number(match[1]);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 150 ? chapter : null;
}
