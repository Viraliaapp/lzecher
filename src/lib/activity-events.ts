/** Public popup contract. Never include contact data. */
export interface ActivityEvent {
  id: string;
  name: string | null;
  count: number;
  trackType: string;
  projectId: string;
  honoreeHebrew: string;
  honoreeHonorific: string;
  claimedAt: number;
  activityLabel?: Partial<Record<"he" | "en" | "es" | "fr", string>>;
}
export const ACTIVITY_TRACKS = new Set(["mishnayos", "tehillim", "kabalos", "shnayim_mikra", "daf_yomi"]);

export function recentActivityEvents(input: unknown, now = Date.now()): ActivityEvent[] {
  if (!Array.isArray(input)) return [];
  const events = new Map<string, ActivityEvent>();
  for (const value of input) {
    if (!value || typeof value !== "object") continue;
    const e = value as ActivityEvent;
    if (typeof e.id !== "string" || !e.id || typeof e.projectId !== "string" ||
      (e.name !== null && typeof e.name !== "string") || !ACTIVITY_TRACKS.has(e.trackType) ||
      !Number.isSafeInteger(e.count) || e.count < 1 || typeof e.honoreeHebrew !== "string" ||
      typeof e.honoreeHonorific !== "string" || !Number.isFinite(e.claimedAt) ||
      e.claimedAt > now + 60000) continue;
    events.set(e.id, e);
  }
  return [...events.values()].sort((a, b) => b.claimedAt - a.claimedAt).slice(0, 20);
}
