type HebrewHonoreeNameParts = {
  nameHebrew?: string | null;
  familyNameHebrew?: string | null;
  fatherNameHebrew?: string | null;
  motherNameHebrew?: string | null;
  gender?: "male" | "female" | string | null;
  honorific?: string | null;
};

type HebrewHonoreeNameOptions = {
  includeParents?: boolean;
  includeHonorific?: boolean;
  fallback?: string;
};

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Frum-facing Hebrew display name for share text and link previews.
 * Keeps the family name, then adds father/mother when available.
 */
export function formatHebrewHonoreeName(
  parts: HebrewHonoreeNameParts,
  options: HebrewHonoreeNameOptions = {}
): string {
  const includeParents = options.includeParents !== false;
  const base = [clean(parts.nameHebrew), clean(parts.familyNameHebrew)].filter(Boolean).join(" ");
  const fallback = options.fallback || "";
  const father = clean(parts.fatherNameHebrew);
  const mother = clean(parts.motherNameHebrew);
  const benBat = parts.gender === "female" ? "בת" : "בן";
  const honorific = clean(parts.honorific) || (parts.gender === "female" ? "ע״ה" : "ז״ל");

  let name = base || fallback;
  if (includeParents && name && (father || mother)) {
    const parents = [father, mother].filter(Boolean).join(" ו");
    name = `${name} ${benBat} ${parents}`;
  }
  if (options.includeHonorific && honorific) {
    name = `${name} ${honorific}`.trim();
  }
  return name.trim();
}
