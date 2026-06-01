"use client";

/**
 * Live activity bubbles — gentle, dignified toasts in the bottom corner showing
 * recent claims across all projects. Polls /api/activity/recent every ~20s and
 * animates in only genuinely-new events. Memorial-appropriate: warm, slow, capped.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { activitySentence } from "@/lib/activity-format";
import { useSiteSettings } from "@/lib/use-site-settings";

interface RawEvent {
  id: string;
  name: string | null;
  count: number;
  trackType: string;
  honoreeHebrew: string;
  honoreeHonorific: string;
  claimedAt: number;
}

const POLL_MS = 20000;
const SHOW_MS = 6500;
const MAX_VISIBLE = 3;

export function ActivityBubbles() {
  const locale = useLocale();
  const { settings, loaded } = useSiteSettings();
  const [visible, setVisible] = useState<RawEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setVisible((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const enqueue = useCallback((events: RawEvent[]) => {
    for (const e of events) {
      setVisible((prev) => {
        if (prev.some((p) => p.id === e.id)) return prev;
        const next = [e, ...prev].slice(0, MAX_VISIBLE);
        return next;
      });
      if (timers.current[e.id]) clearTimeout(timers.current[e.id]);
      timers.current[e.id] = setTimeout(() => dismiss(e.id), SHOW_MS);
    }
  }, [dismiss]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/activity/recent", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const events: RawEvent[] = data.events || [];
      if (!initialized.current) {
        // First load: seed "seen" with everything, but gently show the 1 latest.
        initialized.current = true;
        events.forEach((e) => seen.current.add(e.id));
        if (events.length > 0) {
          const latest = events[0];
          seen.current.add(latest.id);
          enqueue([latest]);
        }
        return;
      }
      // Subsequent polls: show only new events (oldest-first so newest ends on top).
      const fresh = events.filter((e) => !seen.current.has(e.id)).reverse();
      fresh.forEach((e) => seen.current.add(e.id));
      if (fresh.length > 0) enqueue(fresh.slice(-MAX_VISIBLE));
    } catch {
      /* network hiccup — ignore */
    }
  }, [enqueue]);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void poll();
    }, 0);
    const iv = setInterval(poll, POLL_MS);
    const t = timers.current;
    return () => {
      clearTimeout(kickoff);
      clearInterval(iv);
      Object.values(t).forEach(clearTimeout);
    };
  }, [poll]);

  const isRtl = locale === "he";
  if (!loaded || !settings.featureFlags.activityBubbles) return null;

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
