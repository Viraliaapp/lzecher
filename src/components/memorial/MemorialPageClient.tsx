"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrackHierarchy } from "./TrackHierarchy";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Music,
  ScrollText,
  Heart,
  Share2,
  Check,
  Clock,
  Flag,
} from "lucide-react";
import { ReportModal } from "./ReportModal";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Portion, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_ICONS: Record<TrackType, typeof BookOpen> = {
  mishnayos: BookOpen,
  tehillim: Music,
  shnayim_mikra: ScrollText,
  mussar: BookOpen,
  mitzvot: Heart,
};

const SEDER_BADGE: Record<string, string> = {
  Zeraim: "zeraim",
  Moed: "moed",
  Nashim: "nashim",
  Nezikin: "nezikin",
  Kodashim: "kodashim",
  Tahorot: "tahorot",
};

function formatGregorianDate(dateStr: string, locale: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "he" ? "he-IL" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface Props {
  project: MemorialProject;
  portions: Portion[];
}

export function MemorialPageClient({ project, portions: initialPortions }: Props) {
  const t = useTranslations("memorial");
  const locale = useLocale();
  const { user } = useAuth();
  const [portions, setPortions] = useState(initialPortions);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState<Portion | null>(null);
  const [claimerName, setClaimerName] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const totalPortions = portions.length;
  const claimed = portions.filter((p) => p.status !== "available").length;
  const completed = portions.filter((p) => p.status === "completed").length;
  const pct = totalPortions > 0 ? Math.round((completed / totalPortions) * 100) : 0;

  const trackGroups = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      if (!groups[p.trackType]) groups[p.trackType] = [];
      groups[p.trackType].push(p);
    }
    return groups;
  }, [portions]);

  // Build display name with honorific
  const honorific = (project as MemorialProject & { honorific?: string }).honorific ||
    (project.gender === "female" ? "ע״ה" : "ז״ל");

  const fullName = project.fatherNameHebrew
    ? `${project.nameHebrew} ${project.gender === "male" ? "בן" : "בת"} ${project.fatherNameHebrew}`
    : project.nameHebrew;

  const displayNameWithHonorific = `${fullName} ${honorific}`;

  // Format dates
  const dateDisplay = (() => {
    const pref = (project as MemorialProject & { datePreference?: string }).datePreference || "both";
    const hebrewDate = (project as MemorialProject & { dateOfPassingHebrew?: string }).dateOfPassingHebrew;
    const gregDate = project.dateOfPassing;
    const gregFormatted = gregDate ? formatGregorianDate(gregDate, locale) : "";

    if (pref === "hebrew" && hebrewDate) return hebrewDate;
    if (pref === "gregorian" && gregFormatted) return gregFormatted;
    if (hebrewDate && gregFormatted) return `${hebrewDate} · ${gregFormatted}`;
    return hebrewDate || gregFormatted || "";
  })();

  function handleClaimClick(portion: Portion) {
    setSelectedPortion(portion);
    setClaimerName(user?.displayName || "");
    setConfirmDialogOpen(true);
  }

  async function confirmClaim() {
    if (!selectedPortion || !claimerName.trim()) return;
    setClaimingId(selectedPortion.id);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionId: selectedPortion.id,
          projectId: project.id,
          claimerName: claimerName.trim(),
          idToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("claimError"));
        return;
      }
      setPortions((prev) =>
        prev.map((p) =>
          p.id === selectedPortion.id
            ? { ...p, status: "claimed" as const, claimedByName: claimerName.trim(), claimedBy: user?.uid || "anonymous", claimedAt: Date.now() }
            : p
        )
      );
      toast.success(t("claimSuccess"));
    } catch {
      toast.error(t("claimError"));
    } finally {
      setClaimingId(null);
      setConfirmDialogOpen(false);
      setSelectedPortion(null);
    }
  }

  async function handleComplete(portion: Portion) {
    setCompleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error(t("completeError"));
        return;
      }
      const res = await fetch("/api/claims/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionId: portion.id,
          projectId: project.id,
          idToken,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("completeError"));
        return;
      }
      setPortions((prev) =>
        prev.map((p) =>
          p.id === portion.id ? { ...p, status: "completed" as const, completedAt: Date.now() } : p
        )
      );
      toast.success(t("completedSuccess"));
    } catch {
      toast.error(t("completeError"));
    } finally {
      setCompleting(false);
    }
  }

  function shareLink() {
    const url = `${window.location.origin}/${locale}/memorial/${project.slug}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Hero ── */}
      <div className="bg-navy text-cream">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            {/* Yahrzeit Candle */}
            <div className="flex justify-center mb-6">
              <YahrzeitCandle size="lg" />
            </div>

            {/* L'iluy Nishmas eyebrow */}
            <p className="font-serif italic text-gold text-base sm:text-lg tracking-wide mb-3">
              {t("lIluyNishmas")}
            </p>

            {/* Name with honorific */}
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" dir="rtl">
              {displayNameWithHonorific}
            </h1>

            {/* English/secondary name */}
            {project.nameEnglish && (
              <p className="font-serif italic text-cream/60 text-lg mb-2">{project.nameEnglish}</p>
            )}

            {/* Dates */}
            {dateDisplay && (
              <p className="text-cream/50 text-sm mt-2 font-heading" dir="rtl">
                {dateDisplay}
              </p>
            )}

            {/* Gold divider */}
            <div className="flex items-center justify-center gap-3 my-6 max-w-xs mx-auto">
              <div className="h-px flex-1 bg-gold/20" />
              <span className="text-gold/50 text-xs">&#x2727;</span>
              <div className="h-px flex-1 bg-gold/20" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{claimed}</p>
                <p className="text-xs text-cream/50">{t("claimed")}</p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{completed}</p>
                <p className="text-xs text-cream/50">{t("completed")}</p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{pct}%</p>
                <p className="text-xs text-cream/50">{t("progress")}</p>
              </div>
            </div>

            <div className="mt-4 max-w-md mx-auto">
              <Progress value={pct} className="h-2 bg-cream/10" indicatorClassName="bg-gold" />
            </div>

            {/* Share + Report */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" className="border-cream/20 text-cream hover:bg-cream/10" onClick={shareLink}>
                <Share2 className="h-4 w-4" />
                {t("share")}
              </Button>
              <button
                onClick={() => setReportOpen(true)}
                className="text-xs text-cream/30 hover:text-cream/60 transition-colors"
              >
                <Flag className="h-3 w-3 inline mr-1" />
                {t("report")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tribute/Biography ── */}
      {project.biography && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <h3 className="font-heading text-lg font-semibold text-navy mb-3">{t("tribute")}</h3>
              <p className="text-muted leading-relaxed whitespace-pre-line">{project.biography}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Family message */}
      {project.familyMessage && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-4">
          <Card className="border-gold/20 bg-cream-glow">
            <CardContent className="p-6">
              <p className="text-sm text-navy leading-relaxed font-serif italic">{project.familyMessage}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Track Tabs with Claim Interface ── */}
      {totalPortions > 0 && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <h2 className="font-heading text-xl font-semibold text-navy mb-4">{t("claimPortions")}</h2>
          <Tabs defaultValue={project.tracks[0]} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {project.tracks.map((track) => {
                const Icon = TRACK_ICONS[track];
                const tp = trackGroups[track] || [];
                const tc = tp.filter((p) => p.status === "completed").length;
                return (
                  <TabsTrigger key={track} value={track} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {t(`track_${track}`)}
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {tc}/{tp.length}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {project.tracks.map((track) => {
              const tp = trackGroups[track] || [];
              return (
                <TabsContent key={track} value={track}>
                  {tp.length === 0 ? (
                    <p className="text-center text-muted py-8">{t("noPortions")}</p>
                  ) : (
                    <TrackHierarchy
                      portions={tp}
                      trackType={track}
                      onClaim={handleClaimClick}
                      onComplete={handleComplete}
                      claimingId={claimingId}
                      completing={completing}
                      currentUserId={user?.uid}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}

      {/* Empty portions state */}
      {totalPortions === 0 && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
          <p className="text-muted">{t("noPortions")}</p>
        </div>
      )}

      {/* ── Claim Confirmation Dialog ── */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmClaim")}</DialogTitle>
            <DialogDescription>
              {t("confirmClaimDesc", { reference: selectedPortion?.displayName || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{t("yourName")}</label>
              <Input
                value={claimerName}
                onChange={(e) => setClaimerName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={confirmClaim} disabled={!claimerName.trim()}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportModal slug={project.slug} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
