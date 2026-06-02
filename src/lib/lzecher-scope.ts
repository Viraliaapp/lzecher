export const LZECHER_COLLECTION_PREFIX = "lzecher_";
export const LZECHER_STORAGE_PREFIX = "lzecher/";

export const LZECHER_CORE_COLLECTIONS = [
  "lzecher_admin_audit",
  "lzecher_claims",
  "lzecher_contact_messages",
  "lzecher_feedback",
  "lzecher_global_stats",
  "lzecher_inclusive_claims",
  "lzecher_portions",
  "lzecher_project_photos",
  "lzecher_projects",
  "lzecher_reports",
  "lzecher_scheduled_emails",
  "lzecher_settings",
  "lzecher_users",
  "lzecher_view_stats",
] as const;

export type LzecherCollectionName = (typeof LZECHER_CORE_COLLECTIONS)[number];

export function isLzecherCollectionName(name: string): name is LzecherCollectionName {
  return name.startsWith(LZECHER_COLLECTION_PREFIX);
}

export function assertLzecherCollectionName(name: string): asserts name is LzecherCollectionName {
  if (!isLzecherCollectionName(name)) {
    throw new Error(`Unsafe non-Lzecher collection name: ${name}`);
  }
}

export function isLzecherStoragePath(path: string) {
  return path.startsWith(LZECHER_STORAGE_PREFIX);
}

export function lzecherStoragePath(...segments: string[]) {
  const cleaned = segments
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  const path = `${LZECHER_STORAGE_PREFIX}${cleaned}`;
  if (!isLzecherStoragePath(path)) {
    throw new Error(`Unsafe non-Lzecher storage path: ${path}`);
  }
  return path;
}
