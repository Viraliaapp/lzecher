"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { activitySentence } from "@/lib/activity-format";
import { recentActivityEvents, type ActivityEvent } from "@/lib/activity-events";
import { useSiteSettings } from "@/lib/use-site-settings";

const POLL_MS = 20000;
const SHOW_MS = 6500;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_VISIBLE = 3;
const MAX_PENDING = 60;

export function ActivityBubbles() {
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
  const enabled = settings.featureFlags.activityBubbles;
  const [visible, setVisible] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Start the display lifetime only after the settings gate can render it.
    if (!loaded || !enabled) return;
    let alive = true, initialized = false;
    let active: ActivityEvent[] = [], pending: ActivityEvent[] = [];
    const seen = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let request: AbortController | null = null;
    function later(fn: () => void, ms: number) {
      const timer = setTimeout(() => { timers.delete(timer); if (alive) fn(); }, ms);
      timers.add(timer);
      return timer;
    }
    function displayNext() {
      while (active.length < MAX_VISIBLE && pending.length) {
        const event = pending.shift()!;
        active.push(event);
        later(() => { active = active.filter(e => e.id !== event.id); displayNext(); }, SHOW_MS);
      }
      setVisible([...active]);
    }
    async function poll() {
      if (!alive || request) return;
      const controller = new AbortController();
      request = controller;
      const timeout = later(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch("/api/activity/recent", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || controller.signal.aborted || !Array.isArray(data.events)) return;
        const events = recentActivityEvents(data.events);
        // Refresh an in-flight bulk count without replaying its popup.
        const updates = new Map(events.map(e => [e.id, e]));
        active = active.map(e => updates.get(e.id) || e);
        pending = pending.map(e => updates.get(e.id) || e);
        const fresh = initialized ? events.filter(e => !seen.has(e.id)).reverse() : events.slice(0, MAX_VISIBLE);
        initialized = true;
        // Retain old event IDs too: the latest available reservation may be old,
        // but must still appear once rather than replaying on every poll.
        for (const e of events) seen.add(e.id);
        while (seen.size > 1000) seen.delete(seen.keys().next().value!);
        pending = [...pending, ...fresh].slice(-MAX_PENDING);
        displayNext();
      } catch {
        // Keep the existing queue on transient failures; the next poll retries.
      } finally {
        clearTimeout(timeout); timers.delete(timeout);
        if (request === controller) request = null;
        if (alive) later(() => { void poll(); }, POLL_MS);
      }
    }
    later(() => { setVisible([]); void poll(); }, 0);
    return () => {
      alive = false;
      request?.abort();
      for (const timer of timers) clearTimeout(timer);
      timers.clear(); pending = []; active = [];
    };
  }, [loaded, enabled]);

  const isRtl = locale === "he";
  if (!loaded || !enabled) return null;

  return (
    <div
      className="fixed bottom-4 z-40 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-6.5rem)] sm:max-w-xs"
      style={{ left: "1rem" }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {visible.map((e) => (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.5 } }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="pointer-events-auto rounded-xl px-3.5 py-2.5 shadow-lg flex items-center gap-2.5"
            style={{
              background: "linear-gradient(165deg, #FFFDF8 0%, #FAF6EC 100%)",
              border: "1px solid rgba(201,162,75,0.35)",
              boxShadow: "0 6px 24px rgba(15,27,45,0.14)",
              direction: isRtl ? "rtl" : "ltr",
            }}
          >
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0" style={{ background: "rgba(201,162,75,0.16)" }}>
              <BookOpen className="h-3.5 w-3.5" style={{ color: "#C9A961" }} />
            </span>
            <p
              className="text-[12.5px] leading-snug"
              style={{ color: "#3a2f1a", fontFamily: "'Frank Ruhl Libre', Georgia, serif" }}
            >
              {activitySentence(e, locale)}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
