"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS, sanitizeSiteSettings, type SiteSettings } from "@/lib/site-settings";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    async function load() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setSettings(sanitizeSiteSettings(data));
      } catch {
        // Keep defaults if the settings endpoint is unavailable.
      } finally {
        clearTimeout(timeout);
        if (alive) setLoaded(true);
      }
    }
    void load();
    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return { settings, loaded };
}
