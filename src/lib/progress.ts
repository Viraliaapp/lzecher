/**
 * SINGLE SOURCE OF TRUTH for memorial progress display.
 *
 * One canonical definition, used identically by the homepage CARD and the inside
 * memorial HERO so they can never drift (the recurring stale-stats bug).
 *
 * Definition (per product decision):
 *   - Percentage is ALWAYS 0–100: the progress of the CURRENT active set
 *     (Tehillim + Mishnayos only; Kabalos / Daf Yomi / Shnayim Mikra are excluded
 *     from the percentage entirely).
 *   - `cycles` = how many full sets have already been completed ("מחזורים").
 *     Shown as a badge next to the percentage; hidden when 0.
 *   - Both the gold "taken" bar (pct) and the green "completed" bar (completedPct)
 *     are normalized to the current set, so neither ever exceeds 100%.
 *
 * The HERO computes from live portions via computeProgress(). The CARD reads the
 * denormalized fields written by recomputeProjectProgress() (server) via
 * progressFromProject(). Both go through the same definition, so they agree.
 */

export interface ProgressStats {
  /** 0–100: taken % of the current active set (TM only) */
  pct: number;
  /** 0–100: completed % of the current active set (TM only) */
  completedPct: number;
  /** number of fully-taken TM sets behind the current one ("cycles completed") */
  cycles: number;
  /** whether this project has any Tehillim/Mishnayos track (else pct is meaningless) */
  hasTM: boolean;
}

interface PortionLike {
  trackType?: string;
  setNumber?: number | null;
  status?: string;
}

const isTM = (t?: string) => t === "mishnayos" || t === "tehillim";
const setOf = (p: PortionLike) =>
  p.setNumber === undefined || p.setNumber === null ? 1 : p.setNumber;

/**
 * Canonical computation from the live portions array (the source of truth).
 */
export function computeProgress(portions: PortionLike[]): ProgressStats {
  const tm = portions.filter((p) => isTM(p.trackType));
  if (tm.length === 0) return { pct: 0, completedPct: 0, cycles: 0, hasTM: false };

  const maxSet = Math.max(...tm.map(setOf));

  let fullSets = 0;
  let currentSet = maxSet;
  let foundActive = false;
  for (let s = 1; s <= maxSet; s++) {
    const sp = tm.filter((p) => setOf(p) === s);
    if (sp.length === 0) continue;
    const taken = sp.filter((p) => p.status !== "available").length;
    if (taken === sp.length) {
      fullSets++;
    } else if (!foundActive) {
      currentSet = s;
      foundActive = true;
    }
  }

  // When every set is fully taken (transient — the next set auto-opens on the next
  // claim), keep the headline at 100% of the last set and don't also count that same
  // set in the cycles badge (avoids "100% · N cycles" double-count).
  const cycles = foundActive ? fullSets : Math.max(0, fullSets - 1);

  const cs = tm.filter((p) => setOf(p) === currentSet);
  const csLen = cs.length;
  const csTaken = cs.filter((p) => p.status !== "available").length;
  const csCompleted = cs.filter((p) => p.status === "completed").length;

  return {
    pct: csLen > 0 ? Math.round((csTaken / csLen) * 100) : 0,
    completedPct: csLen > 0 ? Math.round((csCompleted / csLen) * 100) : 0,
    cycles,
    hasTM: true,
  };
}

/**
 * For the CARD, which only has the denormalized project doc (no portions).
 * Reads the fields written by recomputeProjectProgress(). Falls back to a
 * claimed/total estimate for un-migrated docs so the card never crashes.
 */
export function progressFromProject(p: {
  progressPct?: number;
  completedProgressPct?: number;
  completedCycles?: number;
  totalPortions?: number;
  claimedPortions?: number;
  tracks?: string[];
}): ProgressStats {
  const hasTM = (p.tracks || []).some(isTM);
  if (typeof p.progressPct === "number") {
    return {
      pct: p.progressPct,
      completedPct: p.completedProgressPct ?? 0,
      cycles: p.completedCycles ?? 0,
      hasTM,
    };
  }
  // Fallback for docs not yet backfilled.
  const pct =
    p.totalPortions && p.totalPortions > 0
      ? Math.round(((p.claimedPortions || 0) / p.totalPortions) * 100)
      : 0;
  return { pct, completedPct: 0, cycles: 0, hasTM };
}

/**
 * Localized "N cycles completed" badge text. Returns null when cycles === 0.
 */
export function cyclesLabel(cycles: number, locale: string): string | null {
  if (cycles <= 0) return null;
  switch (locale) {
    case "he":
      return cycles === 1 ? "השלמנו מחזור אחד" : `השלמנו ${cycles} מחזורים`;
    case "es":
      return cycles === 1 ? "1 ciclo completado" : `${cycles} ciclos completados`;
    case "fr":
      return cycles === 1 ? "1 cycle terminé" : `${cycles} cycles terminés`;
    default:
      return cycles === 1 ? "1 cycle completed" : `${cycles} cycles completed`;
  }
}
