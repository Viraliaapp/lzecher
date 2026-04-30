"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen, Check, Clock, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Portion } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const SEDER_ORDER = ["Zeraim", "Moed", "Nashim", "Nezikin", "Kodashim", "Tahorot"];
const SEDER_HEBREW: Record<string, string> = {
  Zeraim: "זרעים", Moed: "מועד", Nashim: "נשים",
  Nezikin: "נזיקין", Kodashim: "קדשים", Tahorot: "טהרות",
};
const SEDER_COLOR: Record<string, string> = {
  Zeraim: "bg-zeraim/10 text-zeraim border-zeraim/20",
  Moed: "bg-moed/10 text-moed border-moed/20",
  Nashim: "bg-nashim/10 text-nashim border-nashim/20",
  Nezikin: "bg-nezikin/10 text-nezikin border-nezikin/20",
  Kodashim: "bg-kodashim/10 text-kodashim border-kodashim/20",
  Tahorot: "bg-tahorot/10 text-tahorot border-tahorot/20",
};

const TEHILLIM_BOOKS = [
  { name: "Book 1", nameHe: "ספר א׳", start: 1, end: 41 },
  { name: "Book 2", nameHe: "ספר ב׳", start: 42, end: 72 },
  { name: "Book 3", nameHe: "ספר ג׳", start: 73, end: 89 },
  { name: "Book 4", nameHe: "ספר ד׳", start: 90, end: 106 },
  { name: "Book 5", nameHe: "ספר ה׳", start: 107, end: 150 },
];

const CHUMASH_BOOKS: Record<string, string> = {
  Bereishis: "בראשית", Shemos: "שמות", Vayikra: "ויקרא",
  Bamidbar: "במדבר", Devarim: "דברים",
};

interface Props {
  portions: Portion[];
  trackType: string;
  onClaim: (portion: Portion) => void;
  onComplete: (portion: Portion) => void;
  claimingId: string | null;
  completing: boolean;
  currentUserId?: string;
}

export function TrackHierarchy({
  portions, trackType, onClaim, onComplete, claimingId, completing, currentUserId,
}: Props) {
  const t = useTranslations("memorial");

  if (trackType === "mishnayos") return <MishnayosHierarchy {...{ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }} />;
  if (trackType === "tehillim") return <TehillimHierarchy {...{ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }} />;
  if (trackType === "shnayim_mikra") return <ShnayimMikraHierarchy {...{ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }} />;

  // Default flat grid for mussar/mitzvot (smaller counts)
  return <FlatGrid {...{ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MishnayosHierarchy({ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }: any) {
  const [expandedSeder, setExpandedSeder] = useState<string | null>(null);
  const [expandedMasechta, setExpandedMasechta] = useState<string | null>(null);

  const sedarim = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      const s = p.seder || "Other";
      if (!groups[s]) groups[s] = [];
      groups[s].push(p);
    }
    return groups;
  }, [portions]);

  const masechtotInSeder = useMemo(() => {
    if (!expandedSeder || !sedarim[expandedSeder]) return {};
    const groups: Record<string, Portion[]> = {};
    for (const p of sedarim[expandedSeder]) {
      const m = p.masechet || p.displayName?.split(" ")[0] || "Other";
      if (!groups[m]) groups[m] = [];
      groups[m].push(p);
    }
    return groups;
  }, [expandedSeder, sedarim]);

  return (
    <div className="space-y-3 mt-4">
      {/* Level 1: Sedarim */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SEDER_ORDER.map((seder) => {
          const sp = sedarim[seder] || [];
          const done = sp.filter((p) => p.status === "completed").length;
          const claimed = sp.filter((p) => p.status !== "available").length;
          const pct = sp.length > 0 ? Math.round((done / sp.length) * 100) : 0;
          const isExpanded = expandedSeder === seder;

          return (
            <button
              key={seder}
              onClick={() => { setExpandedSeder(isExpanded ? null : seder); setExpandedMasechta(null); }}
              className={cn(
                "p-4 rounded-xl border-2 text-start transition-all",
                isExpanded ? "border-gold bg-gold/5" : "border-navy/5 bg-white hover:border-navy/10 hover:shadow-sm"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant={(seder.toLowerCase() as "zeraim") || "default"} className="text-[10px]">
                  {SEDER_HEBREW[seder]}
                </Badge>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-gold" /> : <ChevronRight className="h-4 w-4 text-muted" />}
              </div>
              <p className="font-heading text-sm font-semibold text-navy">{seder}</p>
              <p className="text-xs text-muted mt-0.5">{claimed}/{sp.length}</p>
              <Progress value={pct} className="h-1 mt-2" />
            </button>
          );
        })}
      </div>

      {/* Level 2: Masechtot */}
      <AnimatePresence>
        {expandedSeder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-cream-warm rounded-xl">
              {Object.entries(masechtotInSeder).map(([name, mp]) => {
                const done = (mp as Portion[]).filter((p) => p.status === "completed").length;
                const isExp = expandedMasechta === name;
                return (
                  <button
                    key={name}
                    onClick={() => setExpandedMasechta(isExp ? null : name)}
                    className={cn(
                      "p-3 rounded-lg border text-start transition-all text-sm",
                      isExp ? "border-gold bg-white shadow-sm" : "border-navy/5 bg-white hover:border-navy/10"
                    )}
                  >
                    <p className="font-medium text-navy truncate">{name}</p>
                    <p className="text-xs text-muted">{done}/{(mp as Portion[]).length}</p>
                  </button>
                );
              })}
            </div>

            {/* Level 3: Perakim */}
            <AnimatePresence>
              {expandedMasechta && masechtotInSeder[expandedMasechta] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-white rounded-xl border border-navy/5">
                    {(masechtotInSeder[expandedMasechta] as Portion[]).sort((a, b) => (a.order || 0) - (b.order || 0)).map((portion) => (
                      <PortionCard key={portion.id} portion={portion} onClaim={onClaim} onComplete={onComplete} claimingId={claimingId} completing={completing} currentUserId={currentUserId} t={t} compact />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TehillimHierarchy({ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }: any) {
  const [expandedBook, setExpandedBook] = useState<number | null>(null);

  return (
    <div className="space-y-3 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEHILLIM_BOOKS.map((book, i) => {
          const bp = portions.filter((p: Portion) => {
            const num = p.mizmor || parseInt(p.reference?.replace(/\D/g, "") || "0");
            return num >= book.start && num <= book.end;
          });
          const done = bp.filter((p: Portion) => p.status === "completed").length;
          const isExp = expandedBook === i;

          return (
            <div key={i}>
              <button
                onClick={() => setExpandedBook(isExp ? null : i)}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-start transition-all",
                  isExp ? "border-gold bg-gold/5" : "border-navy/5 bg-white hover:border-navy/10"
                )}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-heading text-sm font-semibold text-navy" dir="rtl">{book.nameHe}</p>
                    <p className="text-xs text-muted">{t("psalms")} {book.start}-{book.end}</p>
                  </div>
                  <p className="text-xs text-muted">{done}/{bp.length}</p>
                </div>
                <Progress value={bp.length ? Math.round((done / bp.length) * 100) : 0} className="h-1 mt-2" />
              </button>
              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 mt-1 bg-cream-warm rounded-xl">
                      {bp.sort((a: Portion, b: Portion) => (a.order || 0) - (b.order || 0)).map((p: Portion) => (
                        <PortionCard key={p.id} portion={p} onClaim={onClaim} onComplete={onComplete} claimingId={claimingId} completing={completing} currentUserId={currentUserId} t={t} compact />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShnayimMikraHierarchy({ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }: any) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  const books = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      const book = p.parsha ? (["Bereishis", "Shemos", "Vayikra", "Bamidbar", "Devarim"].find(b =>
        p.order && p.order <= (b === "Bereishis" ? 12 : b === "Shemos" ? 23 : b === "Vayikra" ? 33 : b === "Bamidbar" ? 43 : 54)
      ) || "Other") : "Other";
      if (!groups[book]) groups[book] = [];
      groups[book].push(p);
    }
    return groups;
  }, [portions]);

  return (
    <div className="space-y-3 mt-4">
      {Object.entries(CHUMASH_BOOKS).map(([eng, heb]) => {
        const bp = books[eng] || [];
        if (bp.length === 0) return null;
        const done = bp.filter((p) => p.status === "completed").length;
        const isExp = expandedBook === eng;
        return (
          <div key={eng}>
            <button
              onClick={() => setExpandedBook(isExp ? null : eng)}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-start transition-all",
                isExp ? "border-gold bg-gold/5" : "border-navy/5 bg-white hover:border-navy/10"
              )}
            >
              <div className="flex justify-between items-center">
                <p className="font-heading text-sm font-semibold text-navy">{eng} / <span dir="rtl">{heb}</span></p>
                <p className="text-xs text-muted">{done}/{bp.length}</p>
              </div>
              <Progress value={bp.length ? Math.round((done / bp.length) * 100) : 0} className="h-1 mt-2" />
            </button>
            <AnimatePresence>
              {isExp && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 mt-1 bg-cream-warm rounded-xl">
                    {bp.sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => (
                      <PortionCard key={p.id} portion={p} onClaim={onClaim} onComplete={onComplete} claimingId={claimingId} completing={completing} currentUserId={currentUserId} t={t} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FlatGrid({ portions, onClaim, onComplete, claimingId, completing, currentUserId, t }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
      {(portions as Portion[]).sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => (
        <PortionCard key={p.id} portion={p} onClaim={onClaim} onComplete={onComplete} claimingId={claimingId} completing={completing} currentUserId={currentUserId} t={t} />
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PortionCard({ portion, onClaim, onComplete, claimingId, completing, currentUserId, t, compact }: any) {
  const p = portion as Portion;
  return (
    <Card className={cn(
      "transition-all",
      p.status === "completed" && "opacity-50",
      p.status === "available" && "hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
      p.status === "claimed" && "border-gold/20 bg-gold/5"
    )}>
      <CardContent className={cn("p-3", compact && "p-2")}>
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className={cn("font-medium text-navy truncate", compact ? "text-xs" : "text-sm")}>
            {p.displayNameHebrew || p.displayName}
          </p>
          {p.status === "completed" && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
          {p.status === "claimed" && <Clock className="h-3 w-3 text-gold shrink-0" />}
        </div>

        {p.status === "available" && (
          <Button size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => onClaim(p)} disabled={claimingId === p.id}>
            {claimingId === p.id ? <Spinner className="h-3 w-3" /> : <><BookOpen className="h-3 w-3" />{t("claimPortion")}</>}
          </Button>
        )}

        {p.status === "claimed" && (
          <div className="mt-1">
            <p className="text-[10px] text-muted truncate">{t("claimedBy", { name: p.claimedByName || t("someone") })}</p>
            {currentUserId && p.claimedBy === currentUserId && (
              <Button size="sm" variant="secondary" className="w-full mt-1 h-7 text-xs" onClick={() => onComplete(p)} disabled={completing}>
                <Check className="h-3 w-3" />{t("markComplete")}
              </Button>
            )}
          </div>
        )}

        {p.status === "completed" && (
          <p className="text-[10px] text-emerald-600 mt-1">{t("completedBy", { name: p.claimedByName || t("someone") })}</p>
        )}
      </CardContent>
    </Card>
  );
}
