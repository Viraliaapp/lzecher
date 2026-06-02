"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, RefreshCw } from "lucide-react";
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
        if (active) setChapterData(data as TehillimChapterPayload);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-5xl overflow-hidden p-0 sm:rounded-3xl">
        <div className="grid max-h-[92vh] grid-rows-[auto_1fr_auto] bg-cream sm:grid-cols-[minmax(260px,330px)_1fr] sm:grid-rows-[1fr_auto]">
          <aside
            className="border-b border-navy/10 bg-navy px-5 py-5 text-cream sm:border-b-0 sm:border-l sm:border-navy/10 sm:px-6 sm:py-8"
            dir={isHebrew ? "rtl" : "ltr"}
          >
            <DialogHeader className="text-start">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <BookOpen className="h-5 w-5" />
              </div>
              <DialogTitle className="text-2xl leading-tight text-cream">
                {isHebrew ? `${chapterLabel} נשמר עבורך` : `${chapterLabel} is reserved for you`}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm leading-relaxed text-cream/70">
                {isHebrew
                  ? `קראו בנחת לעילוי נשמת ${honoreeName}. בסיום אפשר לסמן כנלמד, או לקבל פרק נוסף.`
                  : `Read it l'iluy nishmas ${honoreeName}. When finished, mark it learned or take another chapter.`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 rounded-2xl border border-gold/25 bg-cream/5 px-4 py-3 text-sm text-cream/80">
              <p className="font-medium text-gold">{isHebrew ? "חד־פעמי" : "One-time"}</p>
              <p className="mt-1 leading-relaxed">
                {isHebrew
                  ? "פרק תהילים אינו התחייבות יומית. קוראים את הפרק פעם אחת ומסמנים בסיום."
                  : "A Tehillim chapter is not a daily commitment. Read it once, then mark it learned."}
              </p>
            </div>
          </aside>

          <main className="min-h-0 bg-white" dir="rtl" lang="he">
            <div className="border-b border-navy/10 px-5 py-4 sm:px-7">
              <p className="font-heading text-2xl font-black text-navy">{chapterLabel}</p>
              {chapterData && (
                <p className="mt-1 text-xs text-muted">
                  {chapterData.verseCount} {isHebrew ? "פסוקים" : "verses"} · טקסט מנוקד
                </p>
              )}
            </div>

            <div className="tehillim-reader-scroll max-h-[48vh] min-h-[280px] overflow-y-auto px-5 py-5 sm:max-h-[70vh] sm:px-8 sm:py-7">
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
                        "font-heading text-[1.35rem] leading-[2.15] text-navy sm:text-[1.55rem]",
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

          <DialogFooter className="border-t border-navy/10 bg-cream px-4 py-4 sm:col-span-2 sm:flex-row sm:justify-between sm:px-6">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={completing || takingNext}
              className="text-navy/70"
            >
              {isHebrew ? "אקרא אחר כך" : "Read later"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={onCompleteAndNext}
                disabled={loading || !!loadError || completing || takingNext}
                className="border-gold/40 text-navy hover:bg-gold/10"
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
