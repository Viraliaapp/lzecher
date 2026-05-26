"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen, Check, ChevronRight, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Portion, TrackType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";
import { TRACK_CONFIGS, heClaimButton, type ClaimVerbForm } from "@/lib/track-config";

/**
 * Localize a display name for the active locale. In Hebrew, trailing Arabic
 * digits are converted to gematria letters.
 */
function localizedDisplay(name: string, locale: string): string {
  if (locale !== "he" || !name) return name;
  return name.replace(/\s(\d{1,3})\s*$/, (_m, num) => " " + toHebrewNumeral(parseInt(num, 10)));
}

function getVerbForm(portion: Portion): ClaimVerbForm {
  return portion.claimVerbForm ?? TRACK_CONFIGS[portion.trackType as TrackType]?.claimVerbForm ?? "masculine";
}

const SEDER_ORDER = ["Zeraim", "Moed", "Nashim", "Nezikin", "Kodashim", "Tahorot"];
const SEDER_HEBREW: Record<string, string> = {
  Zeraim: "זרעים", Moed: "מועד", Nashim: "נשים",
  Nezikin: "נזיקין", Kodashim: "קדשים", Tahorot: "טהרות",
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
  onBulkClaim?: (scope: string, scopeId: string, scopeName: string) => void;
  onMultiClaim?: (portionIds: string[]) => void;
  claimingId: string | null;
  completing: boolean;
  currentUserId?: string;
}

export function TrackHierarchy({
  portions, trackType, onClaim, onComplete, onBulkClaim, onMultiClaim, claimingId, completing, currentUserId,
}: Props) {
  const t = useTranslations("memorial");
  const bt = useTranslations("bulkClaim");
  const locale = useLocale();

  // ── Repeating sets: group by setNumber for mishnayos / tehillim ─────────────
  if (trackType === "mishnayos" || trackType === "tehillim") {
    const maxSet = Math.max(...portions.map(p => p.setNumber || 1), 1);
    if (maxSet > 1) {
      return (
        <SetGroupedWrapper
          portions={portions}
          trackType={trackType as "mishnayos" | "tehillim"}
          onClaim={onClaim}
          onBulkClaim={onBulkClaim}
          onMultiClaim={onMultiClaim}
          claimingId={claimingId}
          completing={completing}
          currentUserId={currentUserId}
          t={t} bt={bt} locale={locale}
        />
      );
    }
  }

  if (trackType === "mishnayos") return <MishnayosHierarchy {...{ portions, onClaim, onBulkClaim, onMultiClaim, claimingId, completing, currentUserId, t, bt, locale }} />;
  if (trackType === "tehillim") return <TehillimHierarchy {...{ portions, onClaim, onMultiClaim, claimingId, completing, currentUserId, t, locale }} />;
  if (trackType === "shnayim_mikra") return <ShnayimMikraHierarchy {...{ portions, onClaim, claimingId, completing, currentUserId, t, locale }} />;

  if (trackType === "kabalos" || trackType === "daf_yomi") {
    return <InclusiveGrid {...{ portions, onClaim, claimingId, completing, currentUserId, t, locale }} />;
  }

  return <FlatGrid {...{ portions, onClaim, claimingId, completing, currentUserId, t, locale }} />;
}

// ── Floating multi-select action bar ─────────────────────────────────────────

function MultiSelectBar({
  count,
  locale,
  onClaim,
  onCancel,
}: {
  count: number;
  locale: string;
  onClaim: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 mx-auto max-w-sm pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-3 bg-navy text-cream rounded-2xl px-4 py-3 shadow-xl">
        <div>
          <p className="text-sm font-bold" dir="rtl">
            {locale === "he" ? `נבחרו ${count} פרקים` : `${count} selected`}
          </p>
          <button onClick={onCancel} className="text-xs text-cream/60 hover:text-cream underline mt-0.5">
            {locale === "he" ? "ביטול" : "Cancel"}
          </button>
        </div>
        <Button
          size="sm"
          className="bg-gold text-navy hover:bg-gold/90 font-bold shrink-0"
          onClick={onClaim}
        >
          {locale === "he" ? `קח ${count} פרקים` : `Claim ${count}`}
        </Button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MishnayosHierarchy({ portions, onClaim, onBulkClaim, onMultiClaim, claimingId, completing, currentUserId, t, bt, locale }: any) {
  const [expandedSeder, setExpandedSeder] = useState<string | null>(null);
  const [expandedMasechta, setExpandedMasechta] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleMultiClaim() {
    onMultiClaim?.(Array.from(selectedIds));
    exitSelectMode();
  }

  const sedarim = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      const s = p.seder || "Other";
      if (!groups[s]) groups[s] = [];
      groups[s].push(p);
    }
    return groups;
  }, [portions]);

  const { masechtotInSeder, hebrewMasechtaNames } = useMemo(() => {
    if (!expandedSeder || !sedarim[expandedSeder]) return { masechtotInSeder: {}, hebrewMasechtaNames: {} };
    const groups: Record<string, Portion[]> = {};
    for (const p of sedarim[expandedSeder]) {
      const m = p.masechet || p.displayName?.split(" ")[0] || "Other";
      if (!groups[m]) groups[m] = [];
      groups[m].push(p);
    }
    const hebrewNames: Record<string, string> = {};
    for (const [eng, ps] of Object.entries(groups)) {
      const first = (ps as Portion[])[0];
      if (first?.displayNameHebrew) {
        hebrewNames[eng] = first.displayNameHebrew.replace(/\s+פרק\s+\d+$/, "").trim();
      } else {
        hebrewNames[eng] = eng;
      }
    }
    return { masechtotInSeder: groups, hebrewMasechtaNames: hebrewNames };
  }, [expandedSeder, sedarim]);

  const totalAvailable = portions.filter((p: Portion) => p.status === "available").length;

  return (
    <div className="space-y-3 mt-4">
      {/* Level 1: Sedarim */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SEDER_ORDER.map((seder) => {
          const sp = sedarim[seder] || [];
          const claimed = sp.filter((p) => p.status !== "available").length;
          const pct = sp.length > 0 ? Math.round((claimed / sp.length) * 100) : 0;
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
              <p className="font-heading text-sm font-semibold text-navy">{locale === "he" ? SEDER_HEBREW[seder] : seder}</p>
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
            {/* Take entire Seder button */}
            {onBulkClaim && expandedSeder && (
              <div className="p-3 bg-cream-warm rounded-t-xl">
                <button
                  onClick={() => onBulkClaim("seder", expandedSeder, locale === "he" ? `סדר ${SEDER_HEBREW[expandedSeder]}` : `Seder ${expandedSeder}`)}
                  className="w-full py-2 px-3 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-all text-center"
                >
                  <p className="text-xs font-medium text-navy">{bt("takeEntireSeder", { sederName: locale === "he" ? SEDER_HEBREW[expandedSeder] : expandedSeder })}</p>
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-cream-warm rounded-b-xl">
              {Object.entries(masechtotInSeder).map(([name, mp]) => {
                const claimed = (mp as Portion[]).filter((p) => p.status !== "available").length;
                const isExp = expandedMasechta === name;
                const displayName = locale === "he" ? (hebrewMasechtaNames[name] || name) : name;
                return (
                  <button
                    key={name}
                    onClick={() => setExpandedMasechta(isExp ? null : name)}
                    className={cn(
                      "p-3 rounded-lg border text-start transition-all text-sm",
                      isExp ? "border-gold bg-white shadow-sm" : "border-navy/5 bg-white hover:border-navy/10"
                    )}
                  >
                    <p className="font-medium text-navy truncate">{displayName}</p>
                    <p className="text-xs text-muted">{claimed}/{(mp as Portion[]).length}</p>
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
                  <div className="p-3 bg-white rounded-xl border border-navy/5">
                    {/* Take entire Masechta button */}
                    {onBulkClaim && (masechtotInSeder[expandedMasechta] as Portion[]).some(p => p.status === "available") && !multiSelectMode && (
                      <button
                        onClick={() => {
                          const mName = locale === "he" ? (hebrewMasechtaNames[expandedMasechta] || expandedMasechta) : expandedMasechta;
                          onBulkClaim("masechta", expandedMasechta, locale === "he" ? `מסכת ${mName}` : `Masechta ${mName}`);
                        }}
                        className="w-full mb-2 py-2 px-3 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-all text-center"
                      >
                        <p className="text-xs font-medium text-navy">
                          {bt("takeEntireMasechta", { masechtaName: locale === "he" ? (hebrewMasechtaNames[expandedMasechta] || expandedMasechta) : expandedMasechta })}
                        </p>
                      </button>
                    )}
                    {/* Multi-select toggle — inside expanded masechta */}
                    {onMultiClaim && totalAvailable > 0 && !multiSelectMode && (
                      <button
                        onClick={() => setMultiSelectMode(true)}
                        className="text-xs text-navy/60 hover:text-navy underline underline-offset-2 transition-colors mb-2 block"
                      >
                        {locale === "he" ? "בחר כמה פרקים" : "Select several chapters"}
                      </button>
                    )}
                    {multiSelectMode && (
                      <p className="text-xs text-gold font-medium mb-2">
                        {locale === "he" ? "לחץ על פרקים לבחירה" : "Tap chapters to select"}
                      </p>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
                      {(masechtotInSeder[expandedMasechta] as Portion[]).sort((a, b) => (a.order || 0) - (b.order || 0)).map((portion) => (
                        <PortionCard
                          key={portion.id}
                          portion={portion}
                          onClaim={onClaim}
                          claimingId={claimingId}
                          completing={completing}
                          currentUserId={currentUserId}
                          t={t}
                          locale={locale}
                          compact
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedIds.has(portion.id)}
                          onSelect={toggleSelect}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating multi-select bar */}
      {multiSelectMode && selectedIds.size > 0 && (
        <MultiSelectBar
          count={selectedIds.size}
          locale={locale}
          onClaim={handleMultiClaim}
          onCancel={exitSelectMode}
        />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TehillimHierarchy({ portions, onClaim, onMultiClaim, claimingId, completing, currentUserId, t, locale }: any) {
  const [expandedBook, setExpandedBook] = useState<number | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleMultiClaim() {
    onMultiClaim?.(Array.from(selectedIds));
    exitSelectMode();
  }

  const totalAvailable = portions.filter((p: Portion) => p.status === "available").length;

  return (
    <div className="space-y-3 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEHILLIM_BOOKS.map((book, i) => {
          const bp = portions.filter((p: Portion) => {
            const num = p.mizmor || parseInt(p.reference?.replace(/\D/g, "") || "0");
            return num >= book.start && num <= book.end;
          });
          const claimed = bp.filter((p: Portion) => p.status !== "available").length;
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
                  <p className="text-xs text-muted">{claimed}/{bp.length}</p>
                </div>
                <Progress value={bp.length ? Math.round((claimed / bp.length) * 100) : 0} className="h-1 mt-2" />
              </button>
              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-3 mt-1 bg-cream-warm rounded-xl">
                      {/* Multi-select toggle — inside expanded book */}
                      {onMultiClaim && totalAvailable > 0 && !multiSelectMode && (
                        <button
                          onClick={() => setMultiSelectMode(true)}
                          className="text-xs text-navy/60 hover:text-navy underline underline-offset-2 transition-colors mb-2 block"
                        >
                          {locale === "he" ? "בחר כמה פרקים" : "Select several chapters"}
                        </button>
                      )}
                      {multiSelectMode && (
                        <p className="text-xs text-gold font-medium mb-2">
                          {locale === "he" ? "לחץ על פרקים לבחירה" : "Tap chapters to select"}
                        </p>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
                        {bp.sort((a: Portion, b: Portion) => (a.order || 0) - (b.order || 0)).map((p: Portion) => (
                          <PortionCard
                            key={p.id}
                            portion={p}
                            onClaim={onClaim}
                            claimingId={claimingId}
                            completing={completing}
                            currentUserId={currentUserId}
                            t={t}
                            locale={locale}
                            compact
                            multiSelectMode={multiSelectMode}
                            isSelected={selectedIds.has(p.id)}
                            onSelect={toggleSelect}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Floating multi-select bar */}
      {multiSelectMode && selectedIds.size > 0 && (
        <MultiSelectBar
          count={selectedIds.size}
          locale={locale}
          onClaim={handleMultiClaim}
          onCancel={exitSelectMode}
        />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShnayimMikraHierarchy({ portions, onClaim, claimingId, completing, currentUserId, t, locale }: any) {
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  const books = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    // Sort by global order to recover the canonical parsha sequence (1–54 relative to this track).
    // The global `order` field is shared across all tracks, so use relative index, not absolute value.
    const sorted = [...portions].sort((a, b) => (a.order || 0) - (b.order || 0));
    sorted.forEach((p, idx) => {
      const relOrder = idx + 1;
      const book = p.parsha ? (["Bereishis", "Shemos", "Vayikra", "Bamidbar", "Devarim"].find(b =>
        relOrder <= (b === "Bereishis" ? 12 : b === "Shemos" ? 23 : b === "Vayikra" ? 33 : b === "Bamidbar" ? 43 : 54)
      ) || "Other") : "Other";
      if (!groups[book]) groups[book] = [];
      groups[book].push(p);
    });
    return groups;
  }, [portions]);

  return (
    <div className="space-y-3 mt-4">
      {Object.entries(CHUMASH_BOOKS).map(([eng, heb]) => {
        const bp = books[eng] || [];
        if (bp.length === 0) return null;
        const claimed = bp.filter((p) => p.status !== "available").length;
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
                <p className="font-heading text-sm font-semibold text-navy">{locale === "he" ? <span dir="rtl">{heb}</span> : <>{eng} / <span dir="rtl">{heb}</span></>}</p>
                <p className="text-xs text-muted">{claimed}/{bp.length}</p>
              </div>
              <Progress value={bp.length ? Math.round((claimed / bp.length) * 100) : 0} className="h-1 mt-2" />
            </button>
            <AnimatePresence>
              {isExp && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 mt-1 bg-cream-warm rounded-xl">
                    {bp.sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => (
                      <PortionCard
                        key={p.id}
                        portion={p}
                        onClaim={onClaim}
                        claimingId={claimingId}
                        completing={completing}
                        currentUserId={currentUserId}
                        t={t}
                        locale={locale}
                      />
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
function InclusiveGrid({ portions, onClaim, claimingId, t, locale }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      {(portions as Portion[]).sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => {
        const primaryName = locale === "he" ? (p.displayNameHebrew || p.displayName) : (p.displayName || p.displayNameHebrew);
        const secondaryName = locale === "he" ? (p.displayName !== p.displayNameHebrew ? p.displayName : null) : (p.displayNameHebrew !== p.displayName ? p.displayNameHebrew : null);
        const verbForm = getVerbForm(p);
        const btnLabel = locale === "he"
          ? heClaimButton(verbForm, false).replace("אני ", "")
          : t("joinCommitment");
        return (
          <Card key={p.id} className="transition-all hover:shadow-sm hover:-translate-y-0.5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-medium text-navy text-sm" dir={locale === "he" ? "rtl" : "ltr"}>
                    {primaryName}
                  </p>
                  {secondaryName && (
                    <p className="text-xs text-muted" dir={locale === "he" ? "ltr" : "rtl"}>{secondaryName}</p>
                  )}
                </div>
                {(p.currentClaimerCount || 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gold-deep bg-gold/10 px-2 py-0.5 rounded-full shrink-0">
                    <Users className="h-3 w-3" />
                    <span>{p.currentClaimerCount}</span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => onClaim(p)}
                disabled={claimingId === p.id}
              >
                {claimingId === p.id ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  <>
                    <Users className="h-3 w-3" />
                    {btnLabel}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FlatGrid({ portions, onClaim, claimingId, completing, currentUserId, t, locale }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }} className="mt-4">
      {(portions as Portion[]).sort((a, b) => (a.order || 0) - (b.order || 0)).map((p) => (
        <PortionCard key={p.id} portion={p} onClaim={onClaim} claimingId={claimingId} completing={completing} currentUserId={currentUserId} t={t} locale={locale} />
      ))}
    </div>
  );
}

interface PortionCardProps {
  portion: Portion;
  onClaim: (p: Portion) => void;
  claimingId: string | null;
  completing: boolean;
  currentUserId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  locale: string;
  compact?: boolean;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

function PortionCard({ portion, onClaim, claimingId, compact, locale, t, multiSelectMode, isSelected, onSelect }: PortionCardProps) {
  const p = portion;
  const verbForm = getVerbForm(p);

  let displayName: string = p.displayNameHebrew || p.displayName;
  if (locale === "he") {
    if (compact && p.trackType === "tehillim" && p.displayNameHebrew) {
      const m = p.displayNameHebrew.match(/^תהילים\s+(\d+)/);
      if (m) displayName = "פרק " + toHebrewNumeral(parseInt(m[1], 10));
      else displayName = localizedDisplay(p.displayNameHebrew, "he");
    } else {
      displayName = localizedDisplay(p.displayNameHebrew || p.displayName, "he");
    }
  }

  const isTaken = p.status === "claimed";
  const isDone = p.status === "completed";
  const isAvailable = p.status === "available";

  // Hebrew claim button text
  const claimLabel = locale === "he"
    ? heClaimButton(verbForm, compact || p.trackType === "mishnayos" || p.trackType === "tehillim")
    : t("claimPortion");

  return (
    <Card className={cn(
      "transition-all overflow-hidden",
      isDone && "opacity-60",
      isAvailable && !multiSelectMode && "hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
      isTaken && "bg-[#E6EDE0] border-[#A3B99A]",
      multiSelectMode && isSelected && "ring-2 ring-gold ring-offset-1",
    )}>
      <CardContent className="min-h-[86px] p-3.5 flex flex-col justify-between" style={{ paddingLeft: 16, paddingRight: 16 }}>
        {/* Top: name + status icon / checkbox */}
        <div className="flex items-start gap-2 mb-2">
          <p
            className={cn(
              "font-heading font-bold text-navy leading-snug flex-1",
              compact ? "text-sm" : "text-base"
            )}
            dir={locale === "he" ? "rtl" : "ltr"}
            style={{ wordBreak: "break-word" as const, overflowWrap: "break-word" as const }}
          >
            {displayName}
          </p>
          {multiSelectMode && isAvailable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect?.(p.id)}
              className="mt-0.5 shrink-0 h-4 w-4 accent-gold cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {isDone && <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
        </div>

        {/* Bottom: action or status */}
        {isAvailable && !multiSelectMode && (
          <Button
            size="sm"
            className="w-full h-8 text-xs font-medium mt-auto"
            onClick={() => onClaim(p)}
            disabled={claimingId === p.id}
          >
            {claimingId === p.id ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <>
                <BookOpen className="h-3 w-3 shrink-0" />
                <span dir="rtl" className="truncate">{claimLabel}</span>
              </>
            )}
          </Button>
        )}

        {isAvailable && multiSelectMode && (
          <button
            onClick={() => onSelect?.(p.id)}
            className="text-[10px] text-navy/40 mt-auto text-start"
          >
            {locale === "he" ? "לחץ לבחירה" : "tap to select"}
          </button>
        )}

        {isTaken && (
          <div className="mt-auto">
            <p
              className="text-xs font-bold text-navy"
              dir="rtl"
              style={{ wordBreak: "break-word" as const, overflowWrap: "break-word" as const }}
            >
              {t("claimedBy", { name: p.claimedByName || t("someone") })}
            </p>
          </div>
        )}

        {isDone && (
          <p className="text-[10px] text-emerald-600 mt-auto">
            {t("completedBy", { name: (p as Portion & { completedByName?: string }).completedByName || p.claimedByName || t("someone") })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Repeating Sets Wrapper ────────────────────────────────────────────────────

const SET_HEBREW_LETTERS: Record<number, string> = {
  1: "א׳", 2: "ב׳", 3: "ג׳", 4: "ד׳", 5: "ה׳",
  6: "ו׳", 7: "ז׳", 8: "ח׳", 9: "ט׳", 10: "י׳",
};
function setLabel(setNumber: number, locale: string): string {
  if (locale === "he") return `סט ${SET_HEBREW_LETTERS[setNumber] || setNumber}`;
  return `Set ${setNumber}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SetGroupedWrapper({ portions, trackType, onClaim, onBulkClaim, onMultiClaim, claimingId, completing, currentUserId, t, bt, locale }: any) {
  // Group by setNumber (descending = newest first)
  const setGroups = useMemo(() => {
    const groups: Record<number, Portion[]> = {};
    for (const p of portions) {
      const sn = (p as Portion).setNumber || 1;
      if (!groups[sn]) groups[sn] = [];
      groups[sn].push(p as Portion);
    }
    return Object.entries(groups)
      .map(([sn, ps]) => ({ setNumber: parseInt(sn), portions: ps }))
      .sort((a, b) => b.setNumber - a.setNumber); // newest first
  }, [portions]);

  // Determine which set is "active" (highest with any available portions)
  const activeSetNumber = useMemo(() => {
    for (const g of [...setGroups].sort((a, b) => b.setNumber - a.setNumber)) {
      if (g.portions.some(p => p.status === "available")) return g.setNumber;
    }
    return setGroups[0]?.setNumber || 1;
  }, [setGroups]);

  // Per-set expand state — active set expanded by default
  const [expandedSets, setExpandedSets] = useState<Set<number>>(() => new Set([activeSetNumber]));

  // Overall progress across all sets
  const totalTaken = portions.filter((p: Portion) => p.status !== "available").length;
  const totalAll = portions.length;
  const completedSets = setGroups.filter(g => g.portions.every(p => p.status !== "available")).length;
  const activeSetPortions = setGroups.find(g => g.setNumber === activeSetNumber)?.portions || [];
  const activeSetTaken = activeSetPortions.filter(p => p.status !== "available").length;
  const activeSetPct = activeSetPortions.length > 0 ? Math.round((activeSetTaken / activeSetPortions.length) * 100) : 0;
  const overallPct = completedSets * 100 + activeSetPct;

  function toggleSet(sn: number) {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn); else next.add(sn);
      return next;
    });
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Overall progress meter */}
      <div className="rounded-xl bg-navy/5 px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-navy" dir="rtl">
            {locale === "he"
              ? `${completedSets} סטים הושלמו — סה״כ ${overallPct}%`
              : `${completedSets} sets completed — total ${overallPct}%`}
          </span>
          <span className="text-navy font-heading font-bold text-lg">{overallPct}%</span>
        </div>
        {/* Segmented bar: one segment per completed set, then active set */}
        <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-navy/10">
          {setGroups.map(g => {
            const isComplete = g.portions.every(p => p.status !== "available");
            const pct = isComplete ? 100 : Math.round(g.portions.filter(p => p.status !== "available").length / g.portions.length * 100);
            return (
              <div key={g.setNumber} className="flex-1 rounded-full overflow-hidden bg-navy/10">
                <div className={cn("h-full transition-all", isComplete ? "bg-emerald-500" : "bg-gold")} style={{ width: `${pct}%` }} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">{totalTaken}/{totalAll} {locale === "he" ? "פרקים נלקחו" : "portions taken"}</p>
      </div>

      {/* Stacked sets (newest on top) */}
      {setGroups.map(({ setNumber, portions: setPortions }) => {
        const isActive = setNumber === activeSetNumber;
        const isComplete = setPortions.every(p => p.status !== "available");
        const setTaken = setPortions.filter(p => p.status !== "available").length;
        const setPct = setPortions.length > 0 ? Math.round(setTaken / setPortions.length * 100) : 0;
        const isExpanded = expandedSets.has(setNumber);

        return (
          <div key={setNumber} className={cn(
            "rounded-xl border-2 overflow-hidden transition-all",
            isActive && !isComplete ? "border-gold bg-gold/5" : isComplete ? "border-emerald-200 bg-emerald-50/30" : "border-navy/10 bg-white"
          )}>
            {/* Set header */}
            <button
              onClick={() => toggleSet(setNumber)}
              className="w-full flex items-center justify-between px-4 py-3 text-start"
            >
              <div className="flex items-center gap-3">
                <span className={cn("font-heading font-bold text-base", isActive && !isComplete ? "text-gold-deep" : "text-navy")}>
                  {setLabel(setNumber, locale)}
                </span>
                {isActive && !isComplete && (
                  <span className="text-xs bg-gold/20 text-gold-deep px-2 py-0.5 rounded-full font-medium">
                    {locale === "he" ? "● פעיל — מתמלא עכשיו" : "● Active — filling now"}
                  </span>
                )}
                {isComplete && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    {locale === "he" ? "✓ הושלם" : "✓ Completed"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-navy/10 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", isComplete ? "bg-emerald-500" : "bg-gold")} style={{ width: `${setPct}%` }} />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{setPct}%</span>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
              </div>
            </button>

            {/* Set content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-3 pb-3 border-t border-navy/5">
                    {trackType === "mishnayos" ? (
                      <MishnayosHierarchy
                        portions={setPortions}
                        onClaim={onClaim}
                        onBulkClaim={onBulkClaim}
                        onMultiClaim={onMultiClaim}
                        claimingId={claimingId}
                        completing={completing}
                        currentUserId={currentUserId}
                        t={t} bt={bt} locale={locale}
                      />
                    ) : (
                      <TehillimHierarchy
                        portions={setPortions}
                        onClaim={onClaim}
                        onMultiClaim={onMultiClaim}
                        claimingId={claimingId}
                        completing={completing}
                        currentUserId={currentUserId}
                        t={t} locale={locale}
                      />
                    )}
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
