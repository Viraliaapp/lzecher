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
  Camera,
} from "lucide-react";
import { ReportModal } from "./ReportModal";
import { PhotoUploadModal } from "@/components/photo/PhotoUploadModal";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Portion, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_ICONS: Record<TrackType, typeof BookOpen> = {
  mishnayos: BookOpen,
  tehillim: Music,
  shnayim_mikra: ScrollText,
  kabalos: Heart,
  daf_yomi: BookOpen,
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
  const [claimerEmail, setClaimerEmail] = useState("");
  const [reminderPrefs, setReminderPrefs] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [bulkClaimScope, setBulkClaimScope] = useState<{ scope: string; scopeId: string; scopeName: string } | null>(null);
  const [bulkClaiming, setBulkClaiming] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(project.photoURL || null);
  const [chizukMessage, setChizukMessage] = useState<{ he: string; en: string; es: string; fr: string } | null>(null);
  const [completePortion, setCompletePortion] = useState<Portion | null>(null);
  const [completerName, setCompleterName] = useState("");
  const [completing2, setCompleting2] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderPreset, setReminderPreset] = useState<'confirmation' | 'light' | 'daily' | 'weekly' | 'custom'>('light');
  const [showCustomReminders, setShowCustomReminders] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function getResolvedReminderPrefs(): string[] {
    if (!claimerEmail || !reminderEnabled) return [];
    switch (reminderPreset) {
      case 'confirmation': return ['confirmation'];
      case 'light': return ['confirmation', 'halfway', 'sevenDays', 'oneDay'];
      case 'daily': return ['confirmation', 'daily'];
      case 'weekly': return ['confirmation', 'weeklyDigest'];
      case 'custom': return reminderPrefs;
    }
  }

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

  const hebrewFirstLast = `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
  const fullName = project.fatherNameHebrew
    ? `${hebrewFirstLast} ${project.gender === "male" ? "בן" : "בת"} ${project.fatherNameHebrew}`
    : hebrewFirstLast;

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

  // Frictionless claim: no SoftLogin step. Anyone clicks → claim modal opens directly.
  function handleClaimClick(portion: Portion) {
    setSelectedPortion(portion);
    setClaimerName(user?.displayName || "");
    setClaimerEmail(user?.email || "");
    setReminderEnabled(false);
    setReminderPreset('light');
    setShowCustomReminders(false);
    setReminderPrefs([]);
    // Pre-expand email section only if user is signed in WITH an email on profile
    setShowEmailSection(Boolean(user?.email));
    setSubmitting(false);
    setConfirmDialogOpen(true);
  }

  async function confirmClaim() {
    if (!selectedPortion) {
      console.error("[claim] confirmClaim called with no selectedPortion");
      toast.error(t("claimError"));
      return;
    }
    if (!claimerName.trim()) {
      toast.error(t("nameRequired") || "Please enter your name");
      return;
    }
    setSubmitting(true);
    setClaimingId(selectedPortion.id);
    let claimSucceeded = false;
    try {
      const idToken = await auth.currentUser?.getIdToken().catch((e) => {
        console.warn("[claim] could not get id token:", e);
        return null;
      });
      const resolvedPrefs = getResolvedReminderPrefs();
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionId: selectedPortion.id,
          projectId: project.id,
          claimerName: claimerName.trim(),
          idToken,
          claimerEmail: claimerEmail || undefined,
          reminderPreferences: resolvedPrefs.length > 0 ? resolvedPrefs : undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[claim] API error", res.status, data);
        toast.error(data.error || t("claimError"));
        return;
      }
      claimSucceeded = true;
      setPortions((prev) =>
        prev.map((p) =>
          p.id === selectedPortion.id
            ? { ...p, status: "claimed" as const, claimedByName: claimerName.trim(), claimedBy: user?.uid || "anonymous", claimedAt: Date.now() }
            : p
        )
      );
      toast.success(t("claimSuccess"));
    } catch (err) {
      console.error("[claim] network/exception during claim:", err);
      toast.error(t("claimError"));
    } finally {
      setClaimingId(null);
      setSubmitting(false);
      if (claimSucceeded) {
        setConfirmDialogOpen(false);
        setSelectedPortion(null);
      }
    }
  }

  // Open mark-complete confirmation modal. Owner gets one-click confirm;
  // non-owner / anonymous user must type a name.
  function handleComplete(portion: Portion) {
    setCompletePortion(portion);
    setCompleterName(user?.displayName || "");
    setCompleting2(false);
  }

  async function confirmComplete() {
    if (!completePortion) return;
    const isOwner = user && completePortion.claimedBy === user.uid;
    const trimmedName = completerName.trim();
    if (!isOwner && !trimmedName) {
      toast.error(t("nameRequired") || "Please enter your name");
      return;
    }
    setCompleting2(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true).catch(() => null);
      const res = await fetch("/api/claims/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionId: completePortion.id,
          projectId: project.id,
          idToken: idToken || undefined,
          completedByName: trimmedName || user?.displayName || undefined,
          completedByEmail: user?.email || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[complete] API error", res.status, data);
        toast.error(data.error || t("completeError"));
        return;
      }
      if (data.chizuk) setChizukMessage(data.chizuk);
      setPortions((prev) =>
        prev.map((p) =>
          p.id === completePortion.id
            ? { ...p, status: "completed" as const, completedAt: Date.now(), completedByName: trimmedName || user?.displayName || p.claimedByName }
            : p
        )
      );
      toast.success(t("completedSuccess"));
      setCompletePortion(null);
    } catch (err) {
      console.error("[complete] network/exception:", err);
      toast.error(t("completeError"));
    } finally {
      setCompleting2(false);
    }
  }

  function shareLink() {
    const url = `${window.location.origin}/${locale}/memorial/${project.slug}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  function handleBulkClaim(scope: string, scopeId: string, scopeName: string) {
    setClaimerName(user?.displayName || "");
    setClaimerEmail(user?.email || "");
    setReminderEnabled(false);
    setReminderPreset('light');
    setShowCustomReminders(false);
    setReminderPrefs([]);
    setShowEmailSection(Boolean(user?.email));
    setBulkClaimScope({ scope, scopeId, scopeName });
  }

  async function confirmBulkClaim() {
    if (!bulkClaimScope) {
      console.error("[bulk-claim] called with no scope");
      toast.error(t("claimError"));
      return;
    }
    if (!claimerName.trim()) {
      toast.error(t("nameRequired") || "Please enter your name");
      return;
    }
    setBulkClaiming(true);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch((e) => {
        console.warn("[bulk-claim] could not get id token:", e);
        return null;
      });
      const resolvedPrefs = getResolvedReminderPrefs();
      const res = await fetch("/api/claims/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          scope: bulkClaimScope.scope,
          scopeId: bulkClaimScope.scopeId,
          claimerName: claimerName.trim(),
          idToken,
          claimerEmail: claimerEmail || undefined,
          reminderPreferences: resolvedPrefs.length > 0 ? resolvedPrefs : undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[bulk-claim] API error", res.status, data);
        toast.error(data.error || t("claimError"));
        return;
      }
      // Reload to get fresh portion state
      window.location.reload();
    } catch (err) {
      console.error("[bulk-claim] network/exception:", err);
      toast.error(t("claimError"));
    } finally {
      setBulkClaiming(false);
      // Only clear scope on success — failure leaves modal open so user can retry
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Hero ── */}
      <div className="bg-navy text-cream">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            {/* Photo (if exists) */}
            {photoUrl && (
              <div className="flex justify-center mb-6">
                <div className="h-48 w-48 rounded-full overflow-hidden border-4 border-gold/30 shadow-lg">
                  <img
                    src={photoUrl}
                    alt={project.nameHebrew}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

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
            {(project.nameEnglish || project.familyNameEnglish) && (
              <p className="font-serif italic text-cream/60 text-lg mb-2">
                {`${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim()}
              </p>
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

            {/* Share + Report + Add Photo */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" className="border-cream/20 text-cream hover:bg-cream/10" onClick={shareLink}>
                <Share2 className="h-4 w-4" />
                {t("share")}
              </Button>
              {!photoUrl && user && (user.uid === (project as MemorialProject & { createdBy: string }).createdBy) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cream/20 text-cream hover:bg-cream/10"
                  onClick={() => setPhotoUploadOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                  {t("addPhoto")}
                </Button>
              )}
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

      {/* Siyum Banner */}
      {pct === 100 && totalPortions > 0 && (
        <div className="bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-b border-gold/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 text-center">
            <h2 className="font-heading text-xl font-bold text-navy mb-2">{t("siyumEligible")}</h2>
            <p className="text-sm text-muted mb-3">{t("completionBanner", { name: hebrewFirstLast })}</p>
            <p className="font-heading text-navy text-sm leading-relaxed" dir="rtl">
              הדרן עלך ועלן דעתך. לא נתנשי מינך ולא תתנשי מינן, לא בעלמא הדין ולא בעלמא דאתי.
            </p>
          </div>
        </div>
      )}

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
          <Tabs defaultValue={
            // Priority: mishnayos → tehillim → shnayim_mikra → kabalos → first available
            (["mishnayos", "tehillim", "shnayim_mikra", "kabalos"] as const)
              .find((t) => project.tracks.includes(t)) || project.tracks[0]
          } className="w-full">
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
                      onBulkClaim={handleBulkClaim}
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
                autoFocus
              />
            </div>
            {/* Email section — collapsed by default; expands on click */}
            {!showEmailSection ? (
              <button
                type="button"
                onClick={() => setShowEmailSection(true)}
                className="text-xs text-navy/60 hover:text-navy underline underline-offset-2 transition-colors"
              >
                {t("addEmailReminders") || "+ Add email for reminders (optional)"}
              </button>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">{t("yourEmail") || "Your email for reminders (optional)"}</label>
                  <Input
                    type="email"
                    value={claimerEmail}
                    onChange={(e) => setClaimerEmail(e.target.value)}
                    placeholder={t("emailPlaceholder") || "you@example.com"}
                  />
                </div>
                {/* Reminder preferences — only when email present */}
                {claimerEmail && (
                  <div className="border-t border-navy/5 pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                        className="rounded border-navy/20"
                      />
                      <span className="text-sm font-medium text-navy">{t("reminderToggle") || "Send me reminders to help me stay on track"}</span>
                    </label>
                    {reminderEnabled && (
                      <div className="mt-3 space-y-2 pl-6">
                        {([
                          { value: 'confirmation' as const, label: t("reminderPresetConfirmation") || "Just a confirmation now" },
                          { value: 'light' as const, label: t("reminderPresetLight") || "Light touch — recommended", desc: t("reminderPresetLightDesc") || "Halfway, 1 week before, 1 day before" },
                          { value: 'daily' as const, label: t("reminderPresetDaily") || "Daily — for daily commitments" },
                          { value: 'weekly' as const, label: t("reminderPresetWeekly") || "Weekly digest" },
                        ]).map(({ value, label, desc }) => (
                          <label key={value} className="flex items-start gap-2 text-xs text-muted cursor-pointer">
                            <input
                              type="radio"
                              name="reminderPreset"
                              checked={reminderPreset === value}
                              onChange={() => { setReminderPreset(value); setShowCustomReminders(false); }}
                              className="mt-0.5"
                            />
                            <span>
                              {label}
                              {desc && <span className="block text-[10px] text-muted/70">{desc}</span>}
                            </span>
                          </label>
                        ))}
                        <button
                          type="button"
                          className="text-xs text-navy/60 hover:text-navy underline mt-1"
                          onClick={() => { setReminderPreset('custom'); setShowCustomReminders(!showCustomReminders); }}
                        >
                          {t("reminderCustomize") || "Customize"}
                        </button>
                        {showCustomReminders && reminderPreset === 'custom' && (
                          <div className="space-y-2 mt-2">
                            {[
                              { key: "confirmation", label: t("reminderConfirmation") || "Confirmation email now" },
                              { key: "sevenDays", label: t("reminderSevenDays") || "7 days before deadline" },
                              { key: "threeDays", label: t("reminderThreeDays") || "3 days before deadline" },
                              { key: "oneDay", label: t("reminderOneDay") || "1 day before deadline" },
                              { key: "halfway", label: t("reminderHalfway") || "Halfway reminder" },
                              { key: "daily", label: t("reminderDaily") || "Daily reminder" },
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={reminderPrefs.includes(key)}
                                  onChange={(e) => {
                                    if (e.target.checked) setReminderPrefs(p => [...p, key]);
                                    else setReminderPrefs(p => p.filter(x => x !== key));
                                  }}
                                  className="rounded border-navy/20"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted mt-2">{t("reminderNote") || "We only send what you choose. Unsubscribe anytime."}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)} disabled={submitting}>{t("cancel")}</Button>
            <Button onClick={confirmClaim} disabled={!claimerName.trim() || submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chizuk Modal */}
      <Dialog open={!!chizukMessage} onOpenChange={() => setChizukMessage(null)}>
        <DialogContent className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <YahrzeitCandle size="md" />
          </div>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-navy">{t("chizukTitle")}</DialogTitle>
          </DialogHeader>
          <p className="font-heading text-navy leading-relaxed text-lg py-4" dir={locale === "he" ? "rtl" : "ltr"}>
            {chizukMessage?.[locale as "he" | "en" | "es" | "fr"] || chizukMessage?.en}
          </p>
          <div className="flex items-center justify-center gap-3 my-3">
            <div className="h-px flex-1 bg-gold/20" />
            <span className="text-gold/50 text-xs">✦</span>
            <div className="h-px flex-1 bg-gold/20" />
          </div>
          <p className="text-sm text-muted">{completed + 1} {t("completed").toLowerCase()} · {pct}% {t("progress").toLowerCase()}</p>
          <DialogFooter className="mt-4">
            <Button onClick={() => setChizukMessage(null)}>{t("continue" as never) || "Continue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Complete Confirmation — anyone can mark complete with a name */}
      <Dialog open={!!completePortion} onOpenChange={(o) => { if (!o) setCompletePortion(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("markCompleteConfirm") || "Mark this portion as learned?"}</DialogTitle>
            <DialogDescription>
              {completePortion?.displayNameHebrew || completePortion?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{t("yourName")}</label>
              <Input
                value={completerName}
                onChange={(e) => setCompleterName(e.target.value)}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            {/* Religious accountability message */}
            <p className="text-xs text-muted leading-relaxed border-l-2 border-gold/30 pl-3 py-1 bg-cream-warm/40">
              {t("markCompleteAccountability") || "Marking complete is a personal commitment between you and Hashem. The neshama benefits from honest learning."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompletePortion(null)} disabled={completing2}>{t("cancel")}</Button>
            <Button onClick={confirmComplete} disabled={completing2 || !completerName.trim()}>
              {completing2 ? <Spinner className="h-4 w-4" /> : (t("markComplete") || "Mark complete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Claim Confirmation */}
      <Dialog open={!!bulkClaimScope} onOpenChange={() => setBulkClaimScope(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkClaimScope?.scopeName}</DialogTitle>
            <DialogDescription>
              {t("confirmClaimDesc", { reference: bulkClaimScope?.scopeName || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{t("yourName")}</label>
              <Input
                value={claimerName}
                onChange={(e) => setClaimerName(e.target.value)}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            {/* Email section — collapsed by default */}
            {!showEmailSection ? (
              <button
                type="button"
                onClick={() => setShowEmailSection(true)}
                className="text-xs text-navy/60 hover:text-navy underline underline-offset-2 transition-colors"
              >
                {t("addEmailReminders") || "+ Add email for reminders (optional)"}
              </button>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">{t("yourEmail") || "Your email for reminders (optional)"}</label>
                  <Input
                    type="email"
                    value={claimerEmail}
                    onChange={(e) => setClaimerEmail(e.target.value)}
                    placeholder={t("emailPlaceholder") || "you@example.com"}
                  />
                </div>
                {claimerEmail && (
                  <div className="border-t border-navy/5 pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                        className="rounded border-navy/20"
                      />
                      <span className="text-sm font-medium text-navy">{t("reminderToggle") || "Send me reminders to help me stay on track"}</span>
                    </label>
                    {reminderEnabled && (
                      <div className="mt-3 space-y-2 pl-6">
                        {([
                          { value: 'confirmation' as const, label: t("reminderPresetConfirmation") || "Just a confirmation now" },
                          { value: 'light' as const, label: t("reminderPresetLight") || "Light touch — recommended", desc: t("reminderPresetLightDesc") || "Halfway, 1 week before, 1 day before" },
                          { value: 'daily' as const, label: t("reminderPresetDaily") || "Daily — for daily commitments" },
                          { value: 'weekly' as const, label: t("reminderPresetWeekly") || "Weekly digest" },
                        ]).map(({ value, label, desc }) => (
                          <label key={value} className="flex items-start gap-2 text-xs text-muted cursor-pointer">
                            <input
                              type="radio"
                              name="bulkReminderPreset"
                              checked={reminderPreset === value}
                              onChange={() => { setReminderPreset(value); setShowCustomReminders(false); }}
                              className="mt-0.5"
                            />
                            <span>
                              {label}
                              {desc && <span className="block text-[10px] text-muted/70">{desc}</span>}
                            </span>
                          </label>
                        ))}
                        <button
                          type="button"
                          className="text-xs text-navy/60 hover:text-navy underline mt-1"
                          onClick={() => { setReminderPreset('custom'); setShowCustomReminders(!showCustomReminders); }}
                        >
                          {t("reminderCustomize") || "Customize"}
                        </button>
                        {showCustomReminders && reminderPreset === 'custom' && (
                          <div className="space-y-2 mt-2">
                            {[
                              { key: "confirmation", label: t("reminderConfirmation") || "Confirmation email now" },
                              { key: "sevenDays", label: t("reminderSevenDays") || "7 days before deadline" },
                              { key: "threeDays", label: t("reminderThreeDays") || "3 days before deadline" },
                              { key: "oneDay", label: t("reminderOneDay") || "1 day before deadline" },
                              { key: "halfway", label: t("reminderHalfway") || "Halfway reminder" },
                              { key: "daily", label: t("reminderDaily") || "Daily reminder" },
                            ].map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={reminderPrefs.includes(key)}
                                  onChange={(e) => {
                                    if (e.target.checked) setReminderPrefs(p => [...p, key]);
                                    else setReminderPrefs(p => p.filter(x => x !== key));
                                  }}
                                  className="rounded border-navy/20"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted mt-2">{t("reminderNote") || "We only send what you choose. Unsubscribe anytime."}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkClaimScope(null)} disabled={bulkClaiming}>{t("cancel")}</Button>
            <Button onClick={confirmBulkClaim} disabled={bulkClaiming || !claimerName.trim()}>
              {bulkClaiming ? <Spinner className="h-4 w-4" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportModal slug={project.slug} open={reportOpen} onOpenChange={setReportOpen} />
      <PhotoUploadModal
        open={photoUploadOpen}
        onOpenChange={setPhotoUploadOpen}
        projectId={project.id}
        onUploadComplete={(url) => setPhotoUrl(url)}
      />
    </div>
  );
}
