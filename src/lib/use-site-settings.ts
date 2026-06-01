"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setSettings({ ...DEFAULT_SITE_SETTINGS, ...data });
      } catch {
        // Keep defaults if the settings endpoint is unavailable.
      } finally {
        if (alive) setLoaded(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { settings, loaded };
}
