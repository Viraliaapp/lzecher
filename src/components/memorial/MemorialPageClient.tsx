"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrackHierarchy } from "./TrackHierarchy";
import { TehillimReaderDialog } from "./TehillimReaderDialog";
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
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ReportModal } from "./ReportModal";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Portion, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { computeProgress, cyclesLabel } from "@/lib/progress";
import { Leaderboard } from "@/components/activity/Leaderboard";
import { ActivityBubbles } from "@/components/activity/ActivityBubbles";
import { fillShareMessage } from "@/lib/share-templates";
import { formatHebrewHonoreeName } from "@/lib/honoree-name";
import { getTehillimChapterNumberFromPortion } from "@/lib/tehillim-ref";

const TRACK_EMOJI: Record<TrackType, string> = {
  mishnayos: "📖",
  tehillim: "🎵",
  shnayim_mikra: "📜",
  kabalos: "🕯️",
  daf_yomi: "⌛",
};

const HEBREW_SET_LABELS: Record<number, string> = {
  1: "א׳",
  2: "ב׳",
  3: "ג׳",
  4: "ד׳",
  5: "ה׳",
  6: "ו׳",
  7: "ז׳",
  8: "ח׳",
  9: "ט׳",
  10: "י׳",
};

function setLabel(setNumber: number, locale: string): string {
  if (locale === "he") return `מחזור ${HEBREW_SET_LABELS[setNumber] || setNumber}`;
  if (locale === "es") return `ciclo ${setNumber}`;
  if (locale === "fr") return `cycle ${setNumber}`;
  return `set ${setNumber}`;
}

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

const CLAIM_REMINDER_PREFS = ["confirmation", "halfway", "sevenDays"];

interface ReminderSectionProps {
  showEmailSection: boolean;
  setShowEmailSection: (v: boolean) => void;
  claimerEmail: string;
  setClaimerEmail: (v: string) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (v: boolean) => void;
  hasDeadline: boolean;
}

function ReminderSection({
  showEmailSection, setShowEmailSection,
  claimerEmail, setClaimerEmail,
  reminderEnabled, setReminderEnabled,
  hasDeadline,
}: ReminderSectionProps) {
  const t = useTranslations("memorial");
  const locale = useLocale();
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
        <label className="text-sm font-medium text-navy mb-1 block">{t("yourEmail") || "Your email for reminders"}</label>
        <Input
          type="email"
          value={claimerEmail}
          onChange={(e) => setClaimerEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
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
            <p
              className="mt-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-muted"
              dir={locale === "he" ? "rtl" : "ltr"}
            >
              {hasDeadline
                ? (t("reminderPlanNote") || "We'll send a confirmation now, a midpoint reminder, and a final reminder one week before the deadline.")
                : (t("reminderPlanNoDeadline") || "We'll send a confirmation now. This memorial has no deadline, so no later reminders will be scheduled.")}
            </p>
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
  const [pageLoadedAt] = useState(() => Date.now());
  const [portions, setPortions] = useState(initialPortions);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState<Portion | null>(null);
  const [claimerName, setClaimerName] = useState("");
  const [claimerEmail, setClaimerEmail] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [completing] = useState(false);
  const [bulkClaimScope, setBulkClaimScope] = useState<{ scope: string; scopeId: string; scopeName: string } | null>(null);
  const [bulkClaiming, setBulkClaiming] = useState(false);
  const photoUrl = project.photoURL || null;
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedShareKind, setCopiedShareKind] = useState<"link" | "text" | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [chizukMessage, setChizukMessage] = useState<{ he: string; en: string; es: string; fr: string } | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimerCustomText, setClaimerCustomText] = useState("");

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completingPortion, setCompletingPortion] = useState<Portion | null>(null);
  const [completingPortionIds, setCompletingPortionIds] = useState<string[]>([]);
  const [completerName, setCompleterName] = useState("");
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [tehillimReaderPortion, setTehillimReaderPortion] = useState<Portion | null>(null);
  const [readerCompleting, setReaderCompleting] = useState(false);
  const [readerTakingNext, setReaderTakingNext] = useState(false);

  // Multi-select claim state
  const [multiClaimPortionIds, setMultiClaimPortionIds] = useState<string[]>([]);
  const [multiClaimDialogOpen, setMultiClaimDialogOpen] = useState(false);

  // Track selector state (replaces Tabs)
  const defaultTrack = (["mishnayos", "tehillim", "shnayim_mikra", "kabalos"] as const)
    .find((tt) => project.tracks.includes(tt as TrackType)) || project.tracks[0];
  const [selectedTrack, setSelectedTrack] = useState<TrackType>(defaultTrack);

  function getResolvedReminderPrefs(): string[] {
    if (!claimerEmail || !reminderEnabled) return [];
    return [...CLAIM_REMINDER_PREFS];
  }

  function getProjectReminderDeadline(): number | null {
    const deadline = project.completionTargetDate;
    return typeof deadline === "number" && deadline > pageLoadedAt ? deadline : null;
  }

  function validateReminderEmail(): boolean {
    const email = claimerEmail.trim();
    if (!reminderEnabled || !email) return true;
    if (/^[^\s@<>]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) && !email.includes("..")) return true;
    toast.error(locale === "he" ? "כתובת האימייל אינה תקינה" : "Please enter a valid email address");
    return false;
  }

  const totalPortions = portions.length;
  const claimed = portions.filter((p) => p.status !== "available").length;

  // Canonical progress — SAME definition as the homepage card (src/lib/progress.ts),
  // computed live from portions so it can't drift. Current-set % (0–100) + cycles.
  const heroProgress = computeProgress(portions);
  const pct = heroProgress.pct;
  const completedPct = heroProgress.completedPct;
  const cyclesText = cyclesLabel(heroProgress.cycles, locale);
  const activeSetNumber = useMemo(() => {
    const tmPortions = portions.filter((p) => p.trackType === "mishnayos" || p.trackType === "tehillim");
    const setNumbers = Array.from(new Set(tmPortions.map((p) => p.setNumber || 1))).sort((a, b) => a - b);
    for (const setNumber of setNumbers) {
      if (tmPortions.some((p) => (p.setNumber || 1) === setNumber && p.status === "available")) {
        return setNumber;
      }
    }
    return setNumbers[setNumbers.length - 1] || 1;
  }, [portions]);
  const bonusRoundText = heroProgress.cycles > 0
    ? locale === "he"
      ? `${setLabel(heroProgress.cycles, locale)} הושלם במלואו · עכשיו ${setLabel(activeSetNumber, locale)} (תוספת זכות)`
      : locale === "es"
        ? `${setLabel(heroProgress.cycles, locale)} completed · now ${setLabel(activeSetNumber, locale)}`
        : locale === "fr"
          ? `${setLabel(heroProgress.cycles, locale)} terminé · maintenant ${setLabel(activeSetNumber, locale)}`
          : `${setLabel(heroProgress.cycles, locale)} complete · now ${setLabel(activeSetNumber, locale)}`
    : null;
  const firstRoundComplete = heroProgress.cycles > 0 || (completedPct === 100 && totalPortions > 0);

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

  const hebrewFirstLast = formatHebrewHonoreeName(project, { includeParents: true });
  const displayNameWithHonorific = formatHebrewHonoreeName(
    { ...project, honorific },
    { includeParents: true, includeHonorific: true }
  );

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
    if (!validateReminderEmail()) return;
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
          durationEndDate: getProjectReminderDeadline() ?? undefined,
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
      const claimedPortion: Portion = {
        ...selectedPortion,
        status: "claimed",
        claimedByName: claimerName.trim(),
        claimedBy: user?.uid || "anonymous",
        claimedAt: Date.now(),
      };
      setPortions((prev) =>
        prev.map((p) =>
          p.id === selectedPortion.id
            ? claimedPortion
            : p
        )
      );
      toast.success(t("claimSuccess"));
      if (selectedPortion.trackType === "tehillim") {
        setTehillimReaderPortion(claimedPortion);
      }
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

  async function completePortionIds(ids: string[], completedByName: string): Promise<number | null> {
    if (ids.length === 0) return null;
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/claims/complete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionIds: ids,
          projectId: project.id,
          completedByName,
          idToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(locale === "he" ? "לא ניתן לסמן כנלמד" : (data.error || "Failed to mark complete"));
        return null;
      }
      const now = Date.now();
      setPortions(prev => prev.map(p =>
        ids.includes(p.id) && p.status === "claimed"
          ? { ...p, status: "completed" as const, completedAt: now, completedByName: completedByName || p.claimedByName }
          : p
      ));
      return data.count || ids.length;
    } catch(err) {
      console.error("[complete] error:", err);
      toast.error(locale === "he" ? "לא ניתן לסמן כנלמד" : "Failed to mark complete");
      return null;
    }
  }

  async function confirmComplete() {
    const ids = completingPortion ? [completingPortion.id] : completingPortionIds;
    if (ids.length === 0) return;
    if (!completerName.trim()) {
      toast.error(t("nameRequired") || (locale === "he" ? "אנא הזן את שמך" : "Please enter your name"));
      return;
    }
    setSubmittingComplete(true);
    try {
      const count = await completePortionIds(ids, completerName.trim());
      if (count === null) return;
      toast.success(locale === "he" ? `${count} פרקים סומנו כנלמדו` : `${count} portions marked learned`);
      setCompleteDialogOpen(false);
    } finally {
      setSubmittingComplete(false);
    }
  }

  function findNextAvailableTehillim(current: Portion): Portion | null {
    const currentSet = current.setNumber || 1;
    const currentChapter = getTehillimChapterNumberFromPortion(current) || 0;
    const byChapter = (a: Portion, b: Portion) => {
      const ac = getTehillimChapterNumberFromPortion(a) || a.order || 0;
      const bc = getTehillimChapterNumberFromPortion(b) || b.order || 0;
      return ac - bc;
    };
    const available = portions.filter((p) => p.trackType === "tehillim" && p.status === "available");
    const sameSet = available.filter((p) => (p.setNumber || 1) === currentSet).sort(byChapter);
    const afterCurrent = sameSet.find((p) => (getTehillimChapterNumberFromPortion(p) || 0) > currentChapter);
    if (afterCurrent) return afterCurrent;
    if (sameSet[0]) return sameSet[0];

    return available
      .sort((a, b) => (b.setNumber || 1) - (a.setNumber || 1) || byChapter(a, b))[0] || null;
  }

  async function claimReaderNextPortion(portion: Portion, name: string): Promise<Portion | null> {
    setClaimingId(portion.id);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portionId: portion.id,
          projectId: project.id,
          claimerName: name,
          idToken,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t("claimError"));
        return null;
      }
      const claimedPortion: Portion = {
        ...portion,
        status: "claimed",
        claimedByName: name,
        claimedBy: user?.uid || "anonymous",
        claimedAt: Date.now(),
      };
      setPortions((prev) => prev.map((p) => p.id === portion.id ? claimedPortion : p));
      return claimedPortion;
    } catch (err) {
      console.error("[tehillim-reader-claim-next] error:", err);
      toast.error(t("claimError"));
      return null;
    } finally {
      setClaimingId(null);
    }
  }

  async function completeReaderPortion(takeNext: boolean) {
    if (!tehillimReaderPortion) return;
    const name = (tehillimReaderPortion.claimedByName || user?.displayName || "").trim();
    if (!name) {
      toast.error(t("nameRequired") || (locale === "he" ? "נדרש שם כדי לסמן כנלמד" : "A name is required to mark learned"));
      return;
    }

    const nextPortion = takeNext ? findNextAvailableTehillim(tehillimReaderPortion) : null;
    if (takeNext) setReaderTakingNext(true);
    else setReaderCompleting(true);

    try {
      const count = await completePortionIds([tehillimReaderPortion.id], name);
      if (count === null) return;

      if (!takeNext) {
        toast.success(locale === "he" ? "הפרק סומן כנלמד" : "Chapter marked learned");
        setTehillimReaderPortion(null);
        return;
      }

      if (!nextPortion) {
        toast.success(locale === "he" ? "הפרק סומן כנלמד. לא נמצאו פרקים זמינים נוספים." : "Chapter marked learned. No more chapters are available.");
        setTehillimReaderPortion(null);
        return;
      }

      const claimedNext = await claimReaderNextPortion(nextPortion, name);
      if (claimedNext) {
        toast.success(locale === "he" ? "הפרק הבא נשמר עבורך" : "The next chapter is reserved for you");
        setTehillimReaderPortion(claimedNext);
      } else {
        setTehillimReaderPortion(null);
      }
    } finally {
      setReaderCompleting(false);
      setReaderTakingNext(false);
    }
  }

  function getShareUrl() {
    if (typeof window === "undefined") return `/${locale}/memorial/${project.slug}`;
    return `${window.location.origin}/${locale}/memorial/${project.slug}`;
  }

  function getFallbackShareText() {
    if (locale === "he") {
      return `לימוד תורה לעילוי נשמת ${displayNameWithHonorific}\nהצטרפו כאן:\n{link}`;
    }
    return `Torah learning in memory of ${displayNameWithHonorific}\nJoin here:\n{link}`;
  }

  function getFullShareText() {
    return fillShareMessage(project.shareMessage || getFallbackShareText(), getShareUrl());
  }

  function shareLink() {
    setShareOpen(true);
  }

  async function copyShare(kind: "link" | "text") {
    const url = getShareUrl();
    const text = kind === "link" ? url : getFullShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShareKind(kind);
      toast.success(kind === "link"
        ? t("linkCopied")
        : (locale === "he" ? "נוסח השיתוף הועתק!" : "Share text copied!"));
      setTimeout(() => setCopiedShareKind(null), 1800);
    } catch {
      toast.error(locale === "he" ? "לא ניתן להעתיק" : "Copy failed");
    }
  }

  function handleBulkClaim(scope: string, scopeId: string, scopeName: string) {
    setClaimerName(user?.displayName || "");
    setClaimerEmail(user?.email || "");
    setReminderEnabled(false);
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
    if (!validateReminderEmail()) return;
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
          durationEndDate: getProjectReminderDeadline() ?? undefined,
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
          ? `${count} פרקים נבחרו ללימוד`
          : `${count} portions reserved for learning`
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
    if (!validateReminderEmail()) return;
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
          durationEndDate: getProjectReminderDeadline() ?? undefined,
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
    hasDeadline: Boolean(getProjectReminderDeadline()),
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
                  <Image
                    src={photoUrl}
                    alt={project.nameHebrew}
                    width={120}
                    height={150}
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
            {locale === "en" && (project.nameEnglish || project.familyNameEnglish) && (
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

            {/* Current set progress */}
            <div className="max-w-xs mx-auto">
              <p className="font-heading font-black text-5xl sm:text-6xl" style={{ color: "#C9A961" }}>
                {pct}%
              </p>
              <p className="text-sm mt-1 mb-1" style={{ color: "rgba(250,246,236,0.55)" }}>
                {t("taken")}
              </p>
              {bonusRoundText ? (
                <div
                  className="mx-auto mb-3 mt-2 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ color: "#DDE9D7", background: "rgba(91,122,82,0.20)", border: "1px solid rgba(143,176,127,0.28)" }}
                  dir={locale === "he" ? "rtl" : "ltr"}
                >
                  {bonusRoundText}
                </div>
              ) : cyclesText ? (
                <p className="text-xs font-bold mb-2" style={{ color: "#8FB07F" }} dir={locale === "he" ? "rtl" : "ltr"}>
                  {cyclesText}
                </p>
              ) : null}
              <div className="mb-3" dir={locale === "he" ? "rtl" : "ltr"}>
                <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: "rgba(250,246,236,0.54)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gold" />
                    {locale === "he" ? "נלקחו ללימוד" : locale === "es" ? "Tomadas para estudiar" : locale === "fr" ? "Prises pour étude" : "Taken for learning"}
                  </span>
                  <strong>{pct}%</strong>
                </div>
                <Progress value={pct} className="h-2" style={{ background: "rgba(250,246,236,0.10)" }} indicatorClassName="bg-gold" />
              </div>
              <div className="mb-2" dir={locale === "he" ? "rtl" : "ltr"}>
                <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: "rgba(250,246,236,0.45)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#5B7A52]" />
                    {locale === "he" ? "נלמדו בפועל" : locale === "es" ? "Ya completadas" : locale === "fr" ? "Déjà terminées" : "Already learned"}
                  </span>
                  <strong>{completedPct}%</strong>
                </div>
                <Progress value={completedPct} className="h-1.5" style={{ background: "rgba(250,246,236,0.10)" }} indicatorClassName="bg-[#5B7A52]" />
              </div>
              {(() => {
                const parts: string[] = [];
                const mClaimed = portions.filter(p => p.trackType === "mishnayos" && p.status !== "available").length;
                const tClaimed = portions.filter(p => p.trackType === "tehillim" && p.status !== "available").length;
                const kTotal = portions.filter(p => p.trackType === "kabalos").reduce((s, p) => s + (p.currentClaimerCount || 0), 0);
                if (mClaimed > 0) parts.push(`${mClaimed} ${locale === "he" ? "משניות" : "Mishnayos"}`);
                if (tClaimed > 0) parts.push(`${tClaimed} ${locale === "he" ? "פרקי תהילים" : "Tehillim"}`);
                if (kTotal > 0) parts.push(`${kTotal} ${locale === "he" ? "קבלות" : "Kabalos"}`);
                if ((project.participantCount || 0) > 0) parts.push(`${project.participantCount} ${locale === "he" ? "משתתפים" : "participants"}`);
                if (parts.length === 0 && claimed > 0) parts.push(`${claimed} ${locale === "he" ? "חלקים בלימוד" : "portions taken"}`);
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

      {/* Completion / bonus-round banner */}
      {firstRoundComplete && (
        <div className="border-b border-gold/20 bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 text-center sm:px-6 lg:grid-cols-[1fr_auto] lg:text-start" dir={locale === "he" ? "rtl" : "ltr"}>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-gold-deep">
                {locale === "he" ? "סיום מחזור" : "Completion milestone"}
              </p>
              <h2 className="mb-2 font-heading text-2xl font-bold text-navy">
                {heroProgress.cycles > 0
                  ? (locale === "he" ? `${setLabel(heroProgress.cycles, locale)} הושלם` : `${setLabel(heroProgress.cycles, locale)} complete`)
                  : t("siyumEligible")}
              </h2>
              <p className="text-sm text-muted">
                {heroProgress.cycles > 0
                  ? (locale === "he"
                      ? `המחזור הראשון כבר הושלם לעילוי נשמת ${hebrewFirstLast}. הדף ממשיך עכשיו למחזור נוסף כדי להרבות זכויות.`
                      : `The first round has been completed in memory of ${hebrewFirstLast}. This page is now continuing into an additional round.`)
                  : t("completionBanner", { name: hebrewFirstLast })}
              </p>
              <p className="mt-3 font-heading text-sm leading-relaxed text-navy" dir="rtl">
                הדרן עלך ועלן דעתך. לא נתנשי מינך ולא תתנשי מינן, לא בעלמא הדין ולא בעלמא דאתי.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 lg:flex-col">
              <Button size="sm" onClick={shareLink}>
                <Share2 className="h-4 w-4" />
                {locale === "he" ? "שתפו את הסיום" : "Share completion"}
              </Button>
              {heroProgress.cycles > 0 && (
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-navy">
                  {locale === "he" ? `עכשיו ${setLabel(activeSetNumber, locale)}` : `Now ${setLabel(activeSetNumber, locale)}`}
                </span>
              )}
            </div>
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

      {/* Yasher Koach — small side recognition panel for top takers */}
      {project.showLeaderboard !== false && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6" dir="ltr">
          <div className={cn("flex", locale === "he" ? "justify-start" : "justify-end")}>
            <Leaderboard
              projectId={project.id}
              initial={(project as MemorialProject & { topMatmidim?: { name: string; count: number }[] }).topMatmidim}
            />
          </div>
        </div>
      )}

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
                    {taken} / {total} {locale === "he" ? "בלימוד" : t("taken").split(" ")[0]}
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
                    {track === "kabalos" && locale === "he"
                      ? "לחצו לבחור קבלה"
                      : track === "kabalos"
                        ? "Click to choose a kabbalah"
                        : t("trackTileCta")}
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
                onReadTehillim={setTehillimReaderPortion}
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
            {selectedPortion?.trackType === "tehillim" && <TehillimOneTimeNote locale={locale} />}
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
                ? `קבלו על עצמכם ${multiClaimPortionIds.length} פרקים`
                : `Take ${multiClaimPortionIds.length} portions`}
            </DialogTitle>
            <DialogDescription>
              {locale === "he"
                ? "הכנס שמך פעם אחת — כל הפרקים שנבחרו יירשמו תחת שמך"
                : "Enter your name once — all selected portions will be saved under your name"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedTrack === "tehillim" && <TehillimOneTimeNote locale={locale} bulk />}
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
              {submitting ? <Spinner className="h-4 w-4" /> : (locale === "he" ? "קבל/י על עצמך" : t("confirm"))}
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
            {(bulkClaimScope?.scope === "whole_tehillim" || bulkClaimScope?.scope === "tehillim_book") && (
              <TehillimOneTimeNote locale={locale} bulk />
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

      {/* Share options */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir={locale === "he" ? "rtl" : "ltr"}>
              {locale === "he" ? "שיתוף דף ההנצחה" : "Share memorial page"}
            </DialogTitle>
            <DialogDescription dir={locale === "he" ? "rtl" : "ltr"}>
              {locale === "he"
                ? "אפשר לשלוח רק את הקישור, או את נוסח השיתוף שהמשפחה הכינה יחד עם הקישור."
                : "Share just the link, or the prepared invitation text together with the link."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button variant="outline" className="w-full justify-between" onClick={() => copyShare("link")}>
              <span>{locale === "he" ? "העתק קישור בלבד" : "Copy link only"}</span>
              {copiedShareKind === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button className="w-full justify-between" onClick={() => copyShare("text")}>
              <span>{locale === "he" ? "העתק נוסח שיתוף עם הקישור" : "Copy message with link"}</span>
              {copiedShareKind === "text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <div className="rounded-lg border border-navy/10 bg-cream/50 p-3">
              <p className="text-xs font-medium text-navy" dir={locale === "he" ? "rtl" : "ltr"}>
                {locale === "he" ? "הנוסח שיועתק" : "Message preview"}
              </p>
              <pre
                dir={locale === "he" ? "rtl" : "ltr"}
                className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted"
                style={{ unicodeBidi: "plaintext" }}
              >
                {getFullShareText()}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Completion dialog ── */}
      <Dialog open={completeDialogOpen} onOpenChange={(o) => !o && setCompleteDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle dir="rtl">
              {completingPortionIds.length > 0
                ? (locale === "he" ? `סמן ${completingPortionIds.length} פרקים כנלמדו` : `Mark ${completingPortionIds.length} portions as learned`)
                : (locale === "he" ? "סמן פרק כנלמד" : "Mark portion as learned")}
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
                {locale === "he" ? "שמך" : "Your name"}
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
            <Button onClick={confirmComplete} disabled={submittingComplete || !completerName.trim()}>
              {submittingComplete ? <Spinner className="h-4 w-4" /> : (locale === "he" ? "אישור" : "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TehillimReaderDialog
        open={!!tehillimReaderPortion}
        portion={tehillimReaderPortion}
        project={project}
        locale={locale}
        completing={readerCompleting}
        takingNext={readerTakingNext}
        onOpenChange={(open) => {
          if (!open && !readerCompleting && !readerTakingNext) {
            setTehillimReaderPortion(null);
          }
        }}
        onComplete={() => completeReaderPortion(false)}
        onCompleteAndNext={() => completeReaderPortion(true)}
      />

      <ReportModal slug={project.slug} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}

function TehillimOneTimeNote({ locale, bulk = false }: { locale: string; bulk?: boolean }) {
  return (
    <p
      className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-gold-deep"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      {locale === "he"
        ? bulk
          ? "חלוקת תהילים היא התחייבות חד־פעמית: אומרים את הפרקים שנבחרו לעילוי הנשמה, ואז אפשר לסמן אותם כנלמדו."
          : "פרק תהילים הוא התחייבות חד־פעמית: אומרים את הפרק לעילוי הנשמה, ואז אפשר לסמן אותו כנלמד."
        : bulk
          ? "Tehillim is a one-time commitment: say the selected chapters l'iluy nishmas, then mark them learned."
          : "A Tehillim chapter is a one-time commitment: say the chapter l'iluy nishmas, then mark it learned."}
    </p>
  );
}
