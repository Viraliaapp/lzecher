"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function ViewTracker() {
  const locale = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const path = window.location.pathname;
    const storageKey = `lzecher:viewed:${path}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // If sessionStorage is unavailable, still record one lightweight aggregate view.
    }

    const payload = JSON.stringify({ locale, path });
    if ("sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/metrics/view", blob);
      return;
    }

    void fetch("/api/metrics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }, [locale, pathname]);

  return null;
}
