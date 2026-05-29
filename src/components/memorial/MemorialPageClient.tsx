"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Share2,
  Flag,
  Camera,
  Mail,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ReportModal } from "./ReportModal";
import { PhotoUploadModal } from "@/components/photo/PhotoUploadModal";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Portion, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { heClaimButton, getClaimVerbForm } from "@/lib/track-config";
import { computeProgress, cyclesLabel } from "@/lib/progress";
import { Leaderboard } from "@/components/activity/Leaderboard";
import { ActivityBubbles } from "@/components/activity/ActivityBubbles";
import { toHebrewCalendarDate } from "@/lib/hebrew-date";

const TRACK_EMOJI: Record<TrackType, string> = {
  mishnayos: "📖",
  tehillim: "🎵",
  shnayim_mikra: "📜",
  kabalos: "🕯️",
  daf_yomi: "⌛",
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

// ── ReminderSection — module-level component prevents remount-on-keystroke ────

type ReminderPreset = 'confirmation' | 'light' | 'daily' | 'weekly' | 'custom';

interface ReminderSectionProps {
  showEmailSection: boolean;
  setShowEmailSection: (v: boolean) => void;
  claimerEmail: string;
  setClaimerEmail: (v: string) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (v: boolean) => void;
  reminderPreset: ReminderPreset;
  setReminderPreset: (v: ReminderPreset) => void;
  showCustomReminders: boolean;
  setShowCustomReminders: (v: boolean) => void;
  reminderPrefs: string[];
  setReminderPrefs: (update: string[] | ((prev: string[]) => string[])) => void;
}

function ReminderSection({
  showEmailSection, setShowEmailSection,
  claimerEmail, setClaimerEmail,
  reminderEnabled, setReminderEnabled,
  reminderPreset, setReminderPreset,
  showCustomReminders, setShowCustomReminders,
  reminderPrefs, setReminderPrefs,
}: ReminderSectionProps) {
  const t = useTranslations("memorial");
  if (!showEmailSection) {
    return (
      <button
        type="button"
        onClick={() => setShowEmailSection(true)}
        className="text-xs text-navy/60 hover:text-navy underline underline-offset-2 transition-colors"
      >
        {t("addEmailReminders") || "+ Add email for reminders (optional)"}
      </button>
    );
  }
  return (
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
  );
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
  const [completing] = useState(false);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [bulkClaimScope, setBulkClaimScope] = useState<{ scope: string; scopeId: string; scopeName: string } | null>(null);
  const [bulkClaiming, setBulkClaiming] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(project.photoURL || null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [chizukMessage, setChizukMessage] = useState<{ he: string; en: string; es: string; fr: string } | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderPreset, setReminderPreset] = useState<'confirmation' | 'light' | 'daily' | 'weekly' | 'custom'>('light');
  const [showCustomReminders, setShowCustomReminders] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimerCustomText, setClaimerCustomText] = useState("");

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completingPortion, setCompletingPortion] = useState<Portion | null>(null);
  const [completingPortionIds, setCompletingPortionIds] = useState<string[]>([]);
  const [completerName, setCompleterName] = useState("");
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Multi-select claim state
  const [multiClaimPortionIds, setMultiClaimPortionIds] = useState<string[]>([]);
  const [multiClaimDialogOpen, setMultiClaimDialogOpen] = useState(false);

  // Track selector state (replaces Tabs)
  const defaultTrack = (["mishnayos", "tehillim", "shnayim_mikra", "kabalos"] as const)
    .find((tt) => project.tracks.includes(tt as TrackType)) || project.tracks[0];
  const [selectedTrack, setSelectedTrack] = useState<TrackType>(defaultTrack);

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

  // Canonical progress — SAME definition as the homepage card (src/lib/progress.ts),
  // computed live from portions so it can't drift. Current-set % (0–100) + cycles.
  const heroProgress = computeProgress(portions);
  const pct = heroProgress.pct;
  const completedPct = heroProgress.completedPct;
  const cyclesText = cyclesLabel(heroProgress.cycles, locale);

  const trackGroups = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      if (!groups[p.trackType]) groups[p.trackType] = [];
      groups[p.trackType].push(p);
    }
    return groups;
  }, [portions]);

  const honorific = (project as MemorialProject & { honorific?: string }).honorific ||
    (project.gender === "female" ? "ע״ה" : "ז״ל");

  const hebrewFirstLast = `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
  const fullName = project.fatherNameHebrew
    ? `${hebrewFirstLast} ${project.gender === "male" ? "בן" : "בת"} ${project.fatherNameHebrew}`
    : hebrewFirstLast;

  const displayNameWithHonorific = `${fullName} ${honorific}`;

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

  function openClaimDialog(portion: Portion) {
    setSelectedPortion(portion);
    setMultiClaimPortionIds([]);
    setClaimerName(user?.displayName || "");
    setClaimerEmail(user?.email || "");
    setClaimerCustomText("");
    setReminderEnabled(false);
    setReminderPreset('light');
    setShowCustomReminders(false);
    setReminderPrefs([]);
    setShowEmailSection(Boolean(user?.email));
    setSubmitting(false);
    setConfirmDialogOpen(true);
  }

  function handleClaimClick(portion: Portion) {
    openClaimDialog(portion);
  }

  async function confirmClaim() {
    if (!selectedPortion) {
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
          specificItem: (selectedPortion as Portion & { isFreeText?: boolean }).isFreeText && claimerCustomText.trim() ? claimerCustomText.trim() : undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
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
      console.error("[claim] error:", err);
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

  function handleComplete(portion: Portion) {
    setCompletingPortion(portion);
    setCompletingPortionIds([]);
    setCompleterName(user?.displayName || "");
    setSubmittingComplete(false);
    setCompleteDialogOpen(true);
  }

  function handleBulkComplete(portionIds: string[]) {
    setCompletingPortion(null);
    setCompletingPortionIds(portionIds);
    setCompleterName(user?.displayName || "");
    setSubmittingComplete(false);
    setCompleteDialogOpen(true);
  }

  async function confirmComplete() {
    const ids = completingPortion ? [completingPortion.id] : completingPortionIds;
    if (ids.length === 0) return;
    setSubmittingComplete(true);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/claims/complete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionIds: ids,
          projectId: project.id,
          completedByName: completerName.trim() || undefined,
          idToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Failed to mark complete"); return; }
      const now = Date.now();
      setPortions(prev => prev.map(p =>
        ids.includes(p.id) && p.status === "claimed"
          ? { ...p, status: "completed" as const, completedAt: now, completedByName: completerName.trim() || p.claimedByName }
          : p
      ));
      toast.success(locale === "he" ? `${data.count || ids.length} פרקים הושלמו` : `${data.count || ids.length} portions completed`);
      setCompleteDialogOpen(false);
    } catch(err) {
      console.error("[complete] error:", err);
      toast.error("Failed to mark complete");
    } finally {
      setSubmittingComplete(false);
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

  // Multi-select handler — opens one modal for all selected portions
  function handleMultiClaim(portionIds: string[]) {
    setMultiClaimPortionIds(portionIds);
    setSelectedPortion(null);
    setClaimerName(user?.displayName || "");
    setClaimerEmail(user?.email || "");
    setReminderEnabled(false);
    setReminderPreset('light');
    setShowCustomReminders(false);
    setReminderPrefs([]);
    setShowEmailSection(Boolean(user?.email));
    setSubmitting(false);
    setMultiClaimDialogOpen(true);
  }

  async function confirmMultiClaim() {
    if (!multiClaimPortionIds.length) return;
    if (!claimerName.trim()) {
      toast.error(t("nameRequired") || "Please enter your name");
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const resolvedPrefs = getResolvedReminderPrefs();
      const res = await fetch("/api/claims/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionIds: multiClaimPortionIds,
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
        toast.error(data.error || t("claimError"));
        return;
      }
      const claimedSet = new Set(multiClaimPortionIds);
      setPortions((prev) =>
        prev.map((p) =>
          claimedSet.has(p.id)
            ? { ...p, status: "claimed" as const, claimedByName: claimerName.trim(), claimedBy: user?.uid || "anonymous", claimedAt: Date.now() }
            : p
        )
      );
      const count = data.claimedCount ?? multiClaimPortionIds.length;
      toast.success(
        locale === "he"
          ? `${count} פרקים נלקחו`
          : `${count} portions claimed`
      );
      setMultiClaimDialogOpen(false);
    } catch (err) {
      console.error("[multi-claim] error:", err);
      toast.error(t("claimError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBulkClaim() {
    if (!bulkClaimScope) {
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
        toast.error(data.error || t("claimError"));
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error("[bulk-claim] error:", err);
      toast.error(t("claimError"));
    } finally {
      setBulkClaiming(false);
    }
  }

  const reminderSectionProps: ReminderSectionProps = {
    showEmailSection, setShowEmailSection,
    claimerEmail, setClaimerEmail,
    reminderEnabled, setReminderEnabled,
    reminderPreset, setReminderPreset,
    showCustomReminders, setShowCustomReminders,
    reminderPrefs, setReminderPrefs,
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden text-cream"
        style={{ background: "linear-gradient(165deg, #1B2138 0%, #252C48 60%, #2d2a3a 100%)" }}
      >
        {/* Radial gold glow behind top center */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "640px", height: "420px",
            top: "-140px", left: "50%", transform: "translateX(-50%)",
            background: "radial-gradient(ellipse, rgba(201,162,75,0.22) 0%, transparent 68%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">

            {/* Photo with mini candle above, OR full YahrzeitCandle */}
            {photoUrl ? (
              <div className="relative inline-flex flex-col items-center mb-6">
                {/* Mini candle above oval */}
                <svg viewBox="0 0 40 60" width={40} height={60} fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-[-4px] relative z-10">
                  <ellipse cx="20" cy="20" rx="18" ry="18" fill="rgba(201,162,75,0.10)">
                    <animate attributeName="rx" values="18;14;20;16;18" dur="7s" repeatCount="indefinite" />
                  </ellipse>
                  <rect x="14" y="33" width="12" height="22" rx="3" fill="#FAF6EC" fillOpacity="0.85" stroke="#C9A961" strokeWidth="0.8" strokeOpacity="0.3" />
                  <rect x="14.5" y="38" width="11" height="16" rx="2.5" fill="#F5EDD9" />
                  <line x1="20" y1="33" x2="20" y2="25" stroke="#2A2D34" strokeWidth="1" strokeLinecap="round">
                    <animate attributeName="x2" values="20;19.7;20.3;20" dur="3.2s" repeatCount="indefinite" />
                  </line>
                  <ellipse cx="20" cy="17" rx="5" ry="9" fill="#C9A961" fillOpacity="0.18">
                    <animate attributeName="ry" values="9;7;10;8;9" dur="6s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="17;15.5;18;16.5;17" dur="6s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="20" cy="17" rx="3" ry="6" fill="#C9A961" fillOpacity="0.55">
                    <animate attributeName="ry" values="6;4.5;7;5.5;6" dur="4.8s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="17;15;18;16;17" dur="4.8s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="20" cy="15" rx="1.5" ry="3.5" fill="#E8CD93">
                    <animate attributeName="ry" values="3.5;2.5;4;3;3.5" dur="3.8s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="15;13.5;16;14.5;15" dur="3.8s" repeatCount="indefinite" />
                  </ellipse>
                  <rect x="13" y="32" width="14" height="2.5" rx="1.25" fill="#C9A961" fillOpacity="0.12" stroke="#C9A961" strokeWidth="0.4" strokeOpacity="0.2" />
                </svg>
                {/* Oval gold-framed photo */}
                <div
                  style={{
                    width: "120px", height: "150px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "3px solid #C9A24B",
                    boxShadow: "0 0 44px rgba(201,162,75,.35), inset 0 1px 1px rgba(255,255,255,0.15)",
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={project.nameHebrew}
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(20%) sepia(8%)" }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <YahrzeitCandle size="lg" />
              </div>
            )}

            {/* Eyebrow */}
            <p className="font-serif italic tracking-widest text-sm sm:text-base mb-3" style={{ color: "rgba(201,162,75,0.78)" }}>
              — {t("lIluyNishmas")} —
            </p>

            {/* Honoree name */}
            <h1 className="font-heading font-black text-3xl sm:text-4xl lg:text-5xl text-cream mb-2" style={{ fontWeight: 900 }} dir="rtl">
              {displayNameWithHonorific}
            </h1>

            {/* English name accent */}
            {(project.nameEnglish || project.familyNameEnglish) && (
              <p className="font-serif italic text-lg mb-1" style={{ color: "rgba(201,162,75,0.55)" }}>
                {`${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim()}
              </p>
            )}

            {/* Date */}
            {dateDisplay && (
              <p className="text-sm mt-1 font-heading" style={{ color: "rgba(250,246,236,0.40)" }} dir="rtl">
                {dateDisplay}
              </p>
            )}

            {/* Ornament divider */}
            <div className="flex items-center justify-center gap-3 my-6 max-w-xs mx-auto">
              <div className="h-px flex-1" style={{ background: "rgba(201,162,75,0.25)" }} />
              <span style={{ color: "rgba(201,162,75,0.50)", fontSize: "0.65rem" }}>&#x2726;</span>
              <div className="h-px flex-1" style={{ background: "rgba(201,162,75,0.25)" }} />
            </div>

            {/* Single stat: % taken + progress bar + sub-count */}
            <div className="max-w-xs mx-auto">
              <p className="font-heading font-black text-5xl sm:text-6xl" style={{ color: "#C9A961" }}>
                {pct}%
              </p>
              <p className="text-sm mt-1 mb-1" style={{ color: "rgba(250,246,236,0.55)" }}>
                {t("taken")}
              </p>
              {cyclesText && (
                <p className="text-xs font-bold mb-2" style={{ color: "#8FB07F" }} dir={locale === "he" ? "rtl" : "ltr"}>
                  {cyclesText}
                </p>
              )}
              <Progress value={pct} className="h-2 mb-3" style={{ background: "rgba(250,246,236,0.10)" }} indicatorClassName="bg-gold" />
              {completedPct > 0 && (
                <div className="mt-2">
                  <p className="text-xs mb-1" style={{ color: "rgba(250,246,236,0.45)" }}>
                    {locale === "he" ? `${completedPct}% הושלמו` : locale === "es" ? `${completedPct}% completados` : locale === "fr" ? `${completedPct}% complétés` : `${completedPct}% completed`}
                  </p>
                  <Progress value={completedPct} className="h-1.5 mb-1" style={{ background: "rgba(250,246,236,0.10)" }} indicatorClassName="bg-[#5B7A52]" />
                </div>
              )}
              {(() => {
                const parts: string[] = [];
                const mClaimed = portions.filter(p => p.trackType === "mishnayos" && p.status !== "available").length;
                const tClaimed = portions.filter(p => p.trackType === "tehillim" && p.status !== "available").length;
                const kTotal = portions.filter(p => p.trackType === "kabalos").reduce((s, p) => s + (p.currentClaimerCount || 0), 0);
                if (mClaimed > 0) parts.push(`${mClaimed} ${locale === "he" ? "משניות" : "Mishnayos"}`);
                if (tClaimed > 0) parts.push(`${tClaimed} ${locale === "he" ? "פרקי תהילים" : "Tehillim"}`);
                if (kTotal > 0) parts.push(`${kTotal} ${locale === "he" ? "קבלות" : "Kabalos"}`);
                if ((project.participantCount || 0) > 0) parts.push(`${project.participantCount} ${locale === "he" ? "משתתפים" : "participants"}`);
                if (parts.length === 0 && claimed > 0) parts.push(`${claimed} ${locale === "he" ? "חלקים נלקחו" : "portions taken"}`);
                return parts.length > 0 ? (
                  <p className="text-xs" style={{ color: "rgba(250,246,236,0.35)" }}>{parts.join(" · ")}</p>
                ) : null;
              })()}
            </div>

            {/* Action buttons */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="sm"
                onClick={shareLink}
                className="hover:opacity-90 transition-opacity"
                style={{ background: "rgba(201,162,75,0.20)", border: "1px solid rgba(201,162,75,0.40)", color: "#FAF6EC" }}
              >
                <Share2 className="h-4 w-4 mr-1.5" />
                {t("share")}
              </Button>
              <button
                onClick={() => setContactOpen(true)}
                className="text-xs text-cream/50 hover:text-cream/80 transition-colors"
              >
                <Mail className="h-3 w-3 inline mr-1" />
                {t("contactFamily")}
              </button>
              {!photoUrl && user && user.uid === project.createdBy && (
                <button
                  className="text-xs text-cream/30 hover:text-cream/60 transition-colors"
                  onClick={() => setPhotoUploadOpen(true)}
                >
                  <Camera className="h-3 w-3 inline mr-1" />
                  {t("addPhoto")}
                </button>
              )}
              <button
                onClick={() => setReportOpen(true)}
                className="text-xs text-cream/25 hover:text-cream/55 transition-colors"
              >
                <Flag className="h-3 w-3 inline mr-1" />
                {t("report")}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Siyum Banner — triggers when all portions are TAKEN (Item 3.4) */}
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

      {/* Pinned announcement (admin) */}
      {project.announcement && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6">
          <div
            className="rounded-xl px-5 py-4 text-center"
            style={{ background: "rgba(201,162,75,0.12)", border: "1px solid rgba(201,162,75,0.4)" }}
          >
            <p className="text-sm text-navy leading-relaxed font-medium whitespace-pre-line" dir={locale === "he" ? "rtl" : "ltr"}>
              {project.announcement}
            </p>
          </div>
        </div>
      )}

      {/* Custom dedication shown at the top (admin) */}
      {project.customDedication && (
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-6 text-center">
          <p className="font-serif italic text-base whitespace-pre-line" style={{ color: "rgba(15,27,45,0.7)" }} dir={locale === "he" ? "rtl" : "ltr"}>
            {project.customDedication}
          </p>
        </div>
      )}

      {/* Tribute/Biography — framed letter */}
      {project.biography && (
        <div
          className="py-12 sm:py-16"
          style={{ background: "radial-gradient(ellipse at top, #FFF8E8 0%, #FAF6EC 65%)" }}
        >
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div
              className="relative rounded-2xl p-8 sm:p-12"
              style={{
                background: "#FFFDF8",
                border: "1px solid rgba(201,162,75,0.38)",
                boxShadow: "0 8px 48px rgba(15,27,45,0.10), 0 2px 8px rgba(15,27,45,0.06)",
              }}
            >
              {/* Inner inset border — double-frame effect */}
              <div
                className="absolute pointer-events-none"
                style={{ inset: "8px", border: "1px solid rgba(201,162,75,0.16)", borderRadius: "12px" }}
              />
              {/* Decorative quotation mark */}
              <span
                className="absolute select-none font-serif"
                style={{
                  top: "10px",
                  [locale === "he" ? "right" : "left"]: "18px",
                  fontSize: "80px",
                  lineHeight: 1,
                  color: "rgba(201,162,75,0.20)",
                  fontFamily: "Georgia, serif",
                  pointerEvents: "none",
                }}
              >
                ״
              </span>
              {/* Heading */}
              <h3
                className="font-serif italic text-center tracking-widest text-xs uppercase mb-6"
                style={{ color: "rgba(201,162,75,0.82)", letterSpacing: "0.18em" }}
              >
                {t("tribute")}
              </h3>
              {/* Tribute text */}
              <p
                className="text-center whitespace-pre-line relative z-10"
                style={{
                  fontFamily: "'Frank Ruhl Libre', Georgia, serif",
                  fontSize: "1.1rem",
                  color: "#0F1B2D",
                  lineHeight: "1.9",
                  direction: locale === "he" ? "rtl" : "ltr",
                }}
              >
                {project.biography}
              </p>
              {/* Signature */}
              <p
                className="font-serif italic text-center text-sm mt-7"
                style={{ color: "rgba(15,27,45,0.32)" }}
              >
                {t("tributeSignature")}
              </p>
            </div>
          </div>
        </div>
      )}

      {project.familyMessage && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-4">
          <Card className="border-gold/20 bg-cream-glow">
            <CardContent className="p-6">
              <p className="text-sm text-navy leading-relaxed font-serif italic">{project.familyMessage}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* "Started by" attribution — small, dignified, near the tribute */}
      {project.startedByVisible && project.startedByText && (
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pb-6 text-center">
          <p className="text-xs tracking-wide" style={{ color: "rgba(15,27,45,0.45)" }} dir={locale === "he" ? "rtl" : "ltr"}>
            {t("startedByLabel")} · <span className="font-medium" style={{ color: "rgba(15,27,45,0.6)" }}>{project.startedByText}</span>
          </p>
        </div>
      )}

      {/* המתמידים — leaderboard of top takers in this project */}
      <Leaderboard
        projectId={project.id}
        initial={(project as MemorialProject & { topMatmidim?: { name: string; count: number }[] }).topMatmidim}
      />

      {/* Live activity bubbles */}
      <ActivityBubbles />

      {/* Track Selector — Square Tile Grid (Phase 4.2) */}
      {totalPortions > 0 && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <div className="text-center mb-8">
            <h2
              className="font-heading font-bold text-navy mb-2"
              style={{ fontSize: "28px" }}
            >
              {t("learnSectionTitle")}
            </h2>
            <p className="font-serif italic text-muted text-sm">
              {t("trackPickSubtitle")}
            </p>
          </div>

          {/* Tile Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "18px",
              maxWidth: "920px",
              margin: "0 auto 36px",
            }}
          >
            {project.tracks.map((track) => {
              const tp = trackGroups[track] || [];
              const taken = tp.filter((p) => p.status !== "available").length;
              const total = tp.length;
              const tilePct = total > 0 ? Math.round((taken / total) * 100) : 0;
              const isActive = selectedTrack === track;
              const emoji = TRACK_EMOJI[track] ?? "📖";

              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className={cn(
                    "rounded-[18px] p-6 text-center border-2 transition-all cursor-pointer",
                    isActive
                      ? "border-navy shadow-lg"
                      : "bg-white border-[rgba(15,27,45,0.10)] hover:border-gold/50 hover:shadow-md hover:-translate-y-0.5"
                  )}
                  style={isActive
                    ? { background: "#0F1B2D" }
                    : { background: "#FFFFFF" }
                  }
                >
                  {/* Icon */}
                  <div style={{ fontSize: "32px", marginBottom: "10px", lineHeight: 1 }}>
                    {emoji}
                  </div>
                  {/* Track name */}
                  <p
                    className="font-heading font-bold"
                    style={{
                      fontSize: "22px",
                      color: isActive ? "#C9A961" : "#0F1B2D",
                      marginBottom: "8px",
                    }}
                  >
                    {t(`track_${track}` as "track_mishnayos")}
                  </p>
                  {/* Count line */}
                  <p
                    style={{
                      fontFamily: "Heebo, Inter, sans-serif",
                      fontSize: "14px",
                      color: isActive ? "rgba(250,246,236,0.70)" : "#6B6F76",
                      marginBottom: "10px",
                    }}
                  >
                    {taken} / {total} {locale === "he" ? "נלקחו" : t("taken").split(" ")[0]}
                  </p>
                  {/* Mini progress bar */}
                  <div
                    style={{
                      width: "80%", margin: "0 auto 12px",
                      height: "5px", borderRadius: "3px",
                      background: isActive ? "rgba(250,246,236,0.18)" : "rgba(201,162,75,0.15)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${tilePct}%`,
                        background: "#C9A961",
                        borderRadius: "3px",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  {/* CTA */}
                  <p
                    style={{
                      fontFamily: "Heebo, Inter, sans-serif",
                      fontSize: "13px",
                      color: isActive ? "rgba(201,162,75,0.85)" : "#C9A961",
                    }}
                  >
                    {t("trackTileCta")}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected track content */}
          {(() => {
            const tp = trackGroups[selectedTrack] || [];
            return tp.length === 0 ? (
              <p className="text-center text-muted py-8">{t("noPortions")}</p>
            ) : (
              <TrackHierarchy
                portions={tp}
                trackType={selectedTrack}
                onClaim={handleClaimClick}
                onComplete={handleComplete}
                onBulkComplete={handleBulkComplete}
                onBulkClaim={handleBulkClaim}
                onMultiClaim={handleMultiClaim}
                claimingId={claimingId}
                completing={completing}
                currentUserId={user?.uid}
              />
            );
          })()}
        </div>
      )}

      {totalPortions === 0 && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
          <p className="text-muted">{t("noPortions")}</p>
        </div>
      )}

      {/* Single Claim Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmClaim")}</DialogTitle>
            <DialogDescription>
              {t("confirmClaimDesc", { reference: selectedPortion?.displayName || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(selectedPortion as (Portion & { isFreeText?: boolean }) | null)?.trackType === "kabalos" && (
              <p className="text-xs text-gold-deep font-medium text-right" dir="rtl">
                {locale === "he" ? "כל הקבלות הן בלי נדר" : "All commitments are bli neder"}
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{t("yourName")}</label>
              <Input
                value={claimerName}
                onChange={(e) => setClaimerName(e.target.value)}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            {(selectedPortion as (Portion & { isFreeText?: boolean }) | null)?.isFreeText && (
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {locale === "he" ? "תאר את הקבלה שלך (אופציונלי)" : "Describe your commitment (optional)"}
                </label>
                <Input
                  value={claimerCustomText}
                  onChange={(e) => setClaimerCustomText(e.target.value)}
                  placeholder={locale === "he" ? "לדוגמה: לקרוא שמע פעמיים ביום" : "e.g., Read Shema twice daily"}
                />
              </div>
            )}
            <ReminderSection {...reminderSectionProps} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)} disabled={submitting}>{t("cancel")}</Button>
            <Button onClick={confirmClaim} disabled={!claimerName.trim() || submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-select Claim Dialog — one name entry for several portions (Item 5) */}
      <Dialog open={multiClaimDialogOpen} onOpenChange={setMultiClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "he"
                ? `קח ${multiClaimPortionIds.length} פרקים`
                : `Claim ${multiClaimPortionIds.length} portions`}
            </DialogTitle>
            <DialogDescription>
              {locale === "he"
                ? "הכנס שמך פעם אחת — כל הפרקים שנבחרו ייקלטו תחת שמך"
                : "Enter your name once — all selected portions will be claimed under your name"}
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
            <ReminderSection {...reminderSectionProps} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMultiClaimDialogOpen(false)} disabled={submitting}>{t("cancel")}</Button>
            <Button onClick={confirmMultiClaim} disabled={!claimerName.trim() || submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : (locale === "he" ? "קח הכל" : t("confirm"))}
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
          <p className="text-sm text-muted">{pct}% {t("taken")} · {claimed} {t("takenSublabel")}</p>
          <DialogFooter className="mt-4">
            <Button onClick={() => setChizukMessage(null)}>{t("continue" as never) || "Continue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Claim Dialog */}
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
            <ReminderSection {...reminderSectionProps} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkClaimScope(null)} disabled={bulkClaiming}>{t("cancel")}</Button>
            <Button onClick={confirmBulkClaim} disabled={bulkClaiming || !claimerName.trim()}>
              {bulkClaiming ? <Spinner className="h-4 w-4" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Family Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{locale === "he" ? "צור קשר עם המשפחה" : "Contact the family"}</DialogTitle>
            <DialogDescription>
              {locale === "he"
                ? "הודעתך תועבר למשפחה. כתובת האימייל שלך לא תיחשף."
                : "Your message will be forwarded to the family. Your email address will not be exposed."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              dir={locale === "he" ? "rtl" : "ltr"}
              placeholder={locale === "he" ? "כתבו הודעה למשפחה..." : "Write a message to the family..."}
              value={contactMessage}
              onChange={e => setContactMessage(e.target.value)}
              rows={5}
              className="text-sm"
            />
            <Input
              type="email"
              dir="ltr"
              placeholder={locale === "he" ? "כתובת אימייל שלך (אופציונלי)" : "Your email (optional)"}
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactOpen(false)} disabled={contactSending}>
              {locale === "he" ? "ביטול" : "Cancel"}
            </Button>
            <Button
              disabled={contactSending || !contactMessage.trim()}
              onClick={async () => {
                setContactSending(true);
                try {
                  const res = await fetch(`/api/memorials/${project.slug}/contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: contactMessage, senderEmail: contactEmail || undefined }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    if (res.status === 429) {
                      toast.error(locale === "he" ? "שלחת יותר מדי הודעות היום" : "Too many messages today. Try again tomorrow.");
                    } else {
                      toast.error(err.error || (locale === "he" ? "שגיאה בשליחה" : "Failed to send"));
                    }
                    return;
                  }
                  toast.success(locale === "he" ? "הודעתך נשלחה למשפחה" : "Your message was sent to the family");
                  setContactMessage("");
                  setContactEmail("");
                  setContactOpen(false);
                } catch {
                  toast.error(locale === "he" ? "שגיאה בשליחה" : "Failed to send");
                } finally {
                  setContactSending(false);
                }
              }}
            >
              {contactSending ? <Spinner className="h-4 w-4" /> : (locale === "he" ? "שלח" : "Send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Completion dialog ── */}
      <Dialog open={completeDialogOpen} onOpenChange={(o) => !o && setCompleteDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">
              {completingPortionIds.length > 0
                ? (locale === "he" ? `סמן ${completingPortionIds.length} פרקים כהושלמו` : `Mark ${completingPortionIds.length} portions complete`)
                : (locale === "he" ? "סמן פרק כהושלם" : "Mark portion complete")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {completingPortion && (
              <p className="text-sm text-muted" dir="rtl">
                {completingPortion.displayNameHebrew || completingPortion.displayName}
              </p>
            )}
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2" dir="rtl">
              {locale === "he" ? "כל אחד יכול לאשר השלמה לעילוי הנשמה." : "Anyone can confirm completion for the elevation of the soul."}
            </p>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block" dir="rtl">
                {locale === "he" ? "שמך (אופציונלי)" : "Your name (optional)"}
              </label>
              <Input
                value={completerName}
                onChange={(e) => setCompleterName(e.target.value)}
                placeholder={locale === "he" ? "שמך" : "Your name"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteDialogOpen(false)} disabled={submittingComplete}>
              {locale === "he" ? "ביטול" : "Cancel"}
            </Button>
            <Button onClick={confirmComplete} disabled={submittingComplete}>
              {submittingComplete ? <Spinner className="h-4 w-4" /> : (locale === "he" ? "אישור" : "Confirm")}
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
