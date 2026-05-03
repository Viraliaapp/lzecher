import type { TrackType, ClaimMode } from "./types";

export interface TrackConfiguration {
  trackType: TrackType;
  claimMode: ClaimMode;
  label: { en: string; he: string };
  supportsDaily: boolean;
  defaultDuration: "oneTime" | "daily" | "weekly" | "indefinite";
}

export const TRACK_CONFIGS: Record<TrackType, TrackConfiguration> = {
  mishnayos: {
    trackType: "mishnayos",
    claimMode: "exclusive",
    label: { en: "Mishnayos", he: "משניות" },
    supportsDaily: false,
    defaultDuration: "oneTime",
  },
  tehillim: {
    trackType: "tehillim",
    claimMode: "exclusive",
    label: { en: "Tehillim", he: "תהילים" },
    supportsDaily: false,
    defaultDuration: "oneTime",
  },
  shnayim_mikra: {
    trackType: "shnayim_mikra",
    claimMode: "inclusive",
    label: { en: "Shnayim Mikra", he: "שניים מקרא" },
    supportsDaily: false,
    defaultDuration: "weekly",
  },
  mussar: {
    trackType: "mussar",
    claimMode: "inclusive",
    label: { en: "Mussar", he: "מוסר" },
    supportsDaily: true,
    defaultDuration: "daily",
  },
  kabalos: {
    trackType: "kabalos",
    claimMode: "inclusive",
    label: { en: "Kabalos", he: "קבלות" },
    supportsDaily: true,
    defaultDuration: "daily",
  },
  daf_yomi: {
    trackType: "daf_yomi",
    claimMode: "inclusive",
    label: { en: "Daf Yomi", he: "דף יומי" },
    supportsDaily: true,
    defaultDuration: "daily",
  },
};

export function getClaimMode(trackType: TrackType): ClaimMode {
  return TRACK_CONFIGS[trackType]?.claimMode ?? "exclusive";
}
