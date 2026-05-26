import type { TrackType, ClaimMode } from "./types";

export type ClaimVerbForm = "masculine" | "feminine" | "both";

export interface TrackConfiguration {
  trackType: TrackType;
  claimMode: ClaimMode;
  label: { en: string; he: string };
  supportsDaily: boolean;
  defaultDuration: "oneTime" | "daily" | "weekly" | "indefinite";
  claimVerbForm: ClaimVerbForm;
}

export const TRACK_CONFIGS: Record<TrackType, TrackConfiguration> = {
  mishnayos: {
    trackType: "mishnayos",
    claimMode: "exclusive",
    label: { en: "Mishnayos", he: "משניות" },
    supportsDaily: false,
    defaultDuration: "oneTime",
    claimVerbForm: "masculine",
  },
  tehillim: {
    trackType: "tehillim",
    claimMode: "exclusive",
    label: { en: "Tehillim", he: "תהילים" },
    supportsDaily: false,
    defaultDuration: "oneTime",
    claimVerbForm: "both",
  },
  shnayim_mikra: {
    trackType: "shnayim_mikra",
    claimMode: "inclusive",
    label: { en: "Shnayim Mikra", he: "שניים מקרא" },
    supportsDaily: false,
    defaultDuration: "weekly",
    claimVerbForm: "masculine",
  },
  kabalos: {
    trackType: "kabalos",
    claimMode: "inclusive",
    label: { en: "Kabalos", he: "קבלות" },
    supportsDaily: true,
    defaultDuration: "daily",
    claimVerbForm: "both",
  },
  daf_yomi: {
    trackType: "daf_yomi",
    claimMode: "inclusive",
    label: { en: "Daf Yomi", he: "דף יומי" },
    supportsDaily: true,
    defaultDuration: "daily",
    claimVerbForm: "masculine",
  },
};

export function getClaimMode(trackType: TrackType): ClaimMode {
  return TRACK_CONFIGS[trackType]?.claimMode ?? "exclusive";
}

export function getClaimVerbForm(trackType: TrackType): ClaimVerbForm {
  return TRACK_CONFIGS[trackType]?.claimVerbForm ?? "masculine";
}

/** Derive Hebrew claim button text from verb form */
export function heClaimButton(verbForm: ClaimVerbForm, isPerek = false): string {
  if (isPerek) {
    if (verbForm === "masculine") return "אני לוקח את הפרק";
    if (verbForm === "feminine") return "אני לוקחת את הפרק";
    return "אני לוקח/ת את הפרק";
  }
  if (verbForm === "masculine") return "אני לוקח";
  if (verbForm === "feminine") return "אני לוקחת";
  return "אני לוקח/ת";
}

/** Hebrew claim modal confirm text */
export function heClaimConfirm(verbForm: ClaimVerbForm): string {
  if (verbForm === "masculine") return "לוקח על עצמי";
  if (verbForm === "feminine") return "לוקחת על עצמי";
  return "לוקח/ת על עצמי";
}
