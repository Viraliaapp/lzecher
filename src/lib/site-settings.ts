export type SiteSettings = {
  featureFlags: {
    feedbackWidget: boolean;
    activityBubbles: boolean;
    globalCounter: boolean;
    siteNotice: boolean;
  };
  announcement: {
    tone: "info" | "warning";
    he: string;
    en: string;
    es: string;
    fr: string;
  };
  updatedAt: number | null;
  updatedBy: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  featureFlags: {
    feedbackWidget: true,
    activityBubbles: true,
    globalCounter: true,
    siteNotice: false,
  },
  announcement: {
    tone: "info",
    he: "",
    en: "",
    es: "",
    fr: "",
  },
  updatedAt: null,
  updatedBy: null,
};

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function sanitizeSiteSettings(input: unknown): SiteSettings {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const featureFlags = data.featureFlags && typeof data.featureFlags === "object"
    ? data.featureFlags as Record<string, unknown>
    : {};
  const announcement = data.announcement && typeof data.announcement === "object"
    ? data.announcement as Record<string, unknown>
    : {};

  return {
    featureFlags: {
      feedbackWidget: bool(featureFlags.feedbackWidget, DEFAULT_SITE_SETTINGS.featureFlags.feedbackWidget),
      activityBubbles: bool(featureFlags.activityBubbles, DEFAULT_SITE_SETTINGS.featureFlags.activityBubbles),
      globalCounter: bool(featureFlags.globalCounter, DEFAULT_SITE_SETTINGS.featureFlags.globalCounter),
      siteNotice: bool(featureFlags.siteNotice, DEFAULT_SITE_SETTINGS.featureFlags.siteNotice),
    },
    announcement: {
      tone: announcement.tone === "warning" ? "warning" : "info",
      he: text(announcement.he),
      en: text(announcement.en),
      es: text(announcement.es),
      fr: text(announcement.fr),
    },
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

export function publicSiteSettings(settings: SiteSettings) {
  return {
    featureFlags: settings.featureFlags,
    announcement: settings.announcement,
    updatedAt: settings.updatedAt,
  };
}
