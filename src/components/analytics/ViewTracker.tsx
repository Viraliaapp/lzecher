"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function ViewTracker() {
  const locale = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const path = window.location.pathname;
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
