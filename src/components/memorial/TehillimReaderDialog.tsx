"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Moon, Pause, Play, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { MemorialProject, Portion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";
import { getTehillimChapterNumberFromPortion } from "@/lib/tehillim-ref";
import { formatHebrewHonoreeName } from "@/lib/honoree-name";

interface TehillimChapterPayload {
  chapter: number;
  ref: string;
  titleHe: string;
  verses: string[];
  verseCount: number;
}

interface Props {
  open: boolean;
  portion: Portion | null;
  project: MemorialProject;
  locale: string;
  completing: boolean;
  takingNext: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onCompleteAndNext: () => void;
}

export function TehillimReaderDialog({
  open,
  portion,
  project,
  locale,
  completing,
  takingNext,
  onOpenChange,
  onComplete,
  onCompleteAndNext,
}: Props) {
  const [chapterData, setChapterData] = useState<TehillimChapterPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [darkReader, setDarkReader] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const chapterNumber = useMemo(
    () => (portion ? getTehillimChapterNumberFromPortion(portion) : null),
    [portion]
  );
  const isHebrew = locale === "he";
  const chapterLabel = chapterNumber
    ? isHebrew
      ? `פרק ${toHebrewNumeral(chapterNumber)}`
      : `Psalm ${chapterNumber}`
    : isHebrew
      ? "פרק תהילים"
      : "Tehillim chapter";
  const honoreeName = isHebrew
    ? formatHebrewHonoreeName(project, { includeParents: true, includeHonorific: true })
    : [project.nameEnglish || project.nameHebrew, project.familyNameEnglish || project.familyNameHebrew].filter(Boolean).join(" ");

  useEffect(() => {
    if (!open || !chapterNumber) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setLoadError(null);
      setChapterData(null);

      try {
        const res = await fetch(`/api/tehillim/${chapterNumber}`, { signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.verses) throw new Error(data?.error || "Chapter unavailable");
        if (active) {
          setChapterData(data as TehillimChapterPayload);
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
        }
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (!isAbort) {
          setLoadError(isHebrew ? "לא ניתן לטעון את הפרק כרגע." : "Could not load this chapter right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [chapterNumber, isHebrew, open]);

  useEffect(() => {
    if (!autoScroll) return;

    let frame = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const el = scrollRef.current;
      if (!el) {
        frame = requestAnimationFrame(step);
        return;
      }

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= maxScroll - 2) {
        setAutoScroll(false);
        return;
      }

      const elapsed = time - lastTime;
      lastTime = time;
      el.scrollTop += Math.max(0.35, elapsed * 0.028);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [autoScroll]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100dvh-16px)] max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-5xl gap-0 overflow-hidden p-0 sm:h-[min(92vh,820px)] sm:max-h-[92vh] sm:rounded-3xl">
        <div className={cn(
          "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-cream sm:grid-cols-[minmax(240px,310px)_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)_auto]",
          darkReader && "bg-[#07101D]"
        )}>
          <aside
            className="border-b border-navy/10 bg-navy px-4 py-3 text-cream sm:border-b-0 sm:border-l sm:border-navy/10 sm:px-6 sm:py-8"
            dir={isHebrew ? "rtl" : "ltr"}
          >
            <DialogHeader className="text-start">
              <div className="mb-3 hidden h-11 w-11 items-center justify-center rounded-2xl bg-gold/15 text-gold sm:flex">
                <BookOpen className="h-5 w-5" />
              </div>
              <DialogTitle className="pe-10 text-xl leading-tight text-cream sm:pe-0 sm:text-2xl">
                {isHebrew ? `${chapterLabel} נשמר עבורך` : `${chapterLabel} is reserved for you`}
              </DialogTitle>
              <DialogDescription className="pt-1 text-xs leading-relaxed text-cream/70 sm:pt-2 sm:text-sm">
                {isHebrew
                  ? `קראו בנחת לעילוי נשמת ${honoreeName}. בסיום אפשר לסמן כנלמד, או לקבל פרק נוסף.`
                  : `Read it l'iluy nishmas ${honoreeName}. When finished, mark it learned or take another chapter.`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 hidden rounded-2xl border border-gold/25 bg-cream/5 px-4 py-3 text-sm text-cream/80 sm:block">
              <p className="font-medium text-gold">{isHebrew ? "חד־פעמי" : "One-time"}</p>
              <p className="mt-1 leading-relaxed">
                {isHebrew
                  ? "פרק תהילים אינו התחייבות יומית. קוראים את הפרק פעם אחת ומסמנים בסיום."
                  : "A Tehillim chapter is not a daily commitment. Read it once, then mark it learned."}
              </p>
            </div>
          </aside>

          <main className={cn("flex min-h-0 flex-col", darkReader ? "bg-[#080D17]" : "bg-white")} dir="rtl" lang="he">
            <div className={cn("shrink-0 border-b px-4 py-2.5 sm:px-7 sm:py-3", darkReader ? "border-cream/10" : "border-navy/10")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn("font-heading text-xl font-black sm:text-2xl", darkReader ? "text-cream" : "text-navy")}>{chapterLabel}</p>
                  {chapterData && (
                    <p className={cn("mt-0.5 text-xs", darkReader ? "text-cream/55" : "text-muted")}>
                      {chapterData.verseCount} {isHebrew ? "פסוקים" : "verses"} · טקסט מנוקד
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5" dir={isHebrew ? "rtl" : "ltr"}>
                  <button
                    type="button"
                    onClick={() => setDarkReader((v) => !v)}
                    aria-pressed={darkReader}
                    title={isHebrew ? "מצב כהה" : "Dark mode"}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      darkReader ? "border-cream/15 bg-cream/10 text-gold hover:bg-cream/15" : "border-navy/10 bg-cream text-navy hover:bg-cream-warm"
                    )}
                  >
                    {darkReader ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span className="sr-only">{isHebrew ? "מצב כהה" : "Dark mode"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoScroll((v) => !v)}
                    aria-pressed={autoScroll}
                    title={isHebrew ? "גלילה אוטומטית" : "Auto scroll"}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      autoScroll
                        ? "border-gold/60 bg-gold text-navy"
                        : darkReader
                          ? "border-cream/15 bg-cream/10 text-gold hover:bg-cream/15"
                          : "border-navy/10 bg-cream text-navy hover:bg-cream-warm"
                    )}
                  >
                    {autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span className="sr-only">{isHebrew ? "גלילה אוטומטית" : "Auto scroll"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className={cn(
                "tehillim-reader-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-12 sm:px-8 sm:py-6 sm:pb-14",
                darkReader && "tehillim-reader-scroll-dark"
              )}
            >
              {loading && (
                <div className="flex min-h-[240px] items-center justify-center text-gold">
                  <Spinner className="h-6 w-6" />
                </div>
              )}
              {!loading && loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loadError}
                </div>
              )}
              {!loading && chapterData && (
                <div className="mx-auto max-w-2xl space-y-5">
                  {chapterData.verses.map((verse, index) => (
                    <p
                      key={index}
                      className={cn(
                        "font-heading text-[1.35rem] leading-[2.15] sm:text-[1.55rem]",
                        darkReader ? "text-cream" : "text-navy",
                        index === 0 && "text-[1.45rem] sm:text-[1.7rem]"
                      )}
                    >
                      <span className="me-2 inline-block min-w-5 align-super text-xs font-sans font-bold text-gold-deep">
                        {toHebrewNumeral(index + 1)}
                      </span>
                      {verse}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </main>

          <DialogFooter className={cn(
            "shrink-0 border-t px-3 py-2.5 sm:col-span-2 sm:flex-row sm:justify-between sm:px-6 sm:py-4",
            darkReader ? "border-cream/10 bg-[#07101D]" : "border-navy/10 bg-cream"
          )}>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={completing || takingNext}
              className={cn(darkReader ? "text-cream/70 hover:bg-cream/10 hover:text-cream" : "text-navy/70")}
            >
              {isHebrew ? "אקרא אחר כך" : "Read later"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={onCompleteAndNext}
                disabled={loading || !!loadError || completing || takingNext}
                className={cn(
                  "border-gold/40",
                  darkReader ? "bg-transparent text-cream hover:bg-cream/10 hover:text-cream" : "text-navy hover:bg-gold/10"
                )}
              >
                {takingNext ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {isHebrew ? "סיימתי — רוצה פרק נוסף" : "Done, take another"}
              </Button>
              <Button
                onClick={onComplete}
                disabled={loading || !!loadError || completing || takingNext}
                className="bg-gold text-navy hover:bg-gold/90"
              >
                {completing ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {isHebrew ? "סיימתי — סמן כנלמד" : "Done — mark learned"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
