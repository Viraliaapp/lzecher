"use client";

import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Download, Lock, Mail, Plus, RotateCw, Search, Send, Unlock, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Claim } from "@/lib/types";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";
import { toHebrewCalendarDate } from "@/lib/hebrew-date";
import { learningLabel } from "@/lib/learning-label";
import { cyclesLabel, progressFromProject } from "@/lib/progress";
import { formatHebrewHonoreeName } from "@/lib/honoree-name";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalClaimedPortions: number;
  uniqueParticipants: number;
  claimsThisWeek: number;
}

interface ActivityItem {
  id: string;
  claimerName: string;
  reference?: string;
  trackType?: string;
  projectId: string;
  claimedAt: number;
  projectHonoree?: string;
  projectSlug?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const TRACK_EMOJI: Record<string, string> = {
  mishnayos: "📖",
  tehillim: "🎵",
  shnayim_mikra: "📜",
  kabalos: "🕯️",
  daf_yomi: "⌛",
};

function relativeTime(ts: number, locale: string): string {
  if (!ts) return "";
  if (locale === "he") return toHebrewCalendarDate(ts, locale);
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const isHe = locale === "he";
  if (diff < 60000) return isHe ? "עכשיו" : "Just now";
  if (mins < 60) return isHe ? `לפני ${mins} דק׳` : `${mins}m ago`;
  if (hours < 24) return isHe ? `לפני ${hours} שעות` : `${hours}h ago`;
  return isHe ? `לפני ${days} ימים` : `${days}d ago`;
}

function formatDate(ts: unknown, locale: string): string {
  if (!ts) return "";
  try {
    if (locale === "he") return toHebrewCalendarDate(Number(ts), locale);
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(Number(ts)));
  } catch {
    return "";
  }
}

function claimStatusLabel(status: string, locale: string) {
  if (status === "completed") return locale === "he" ? "נלמד" : "Learned";
  if (status === "expired") return locale === "he" ? "עבר הזמן" : "Expired";
  return locale === "he" ? "בלימוד" : "Learning";
}

function mailtoUrl(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function DarkStatCard({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div style={{ background: "linear-gradient(165deg, #1B2138 0%, #252C48 100%)", borderRadius: "16px", padding: "22px 20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-50px", left: "50%", transform: "translateX(-50%)", width: "200px", height: "130px", background: "radial-gradient(ellipse, rgba(201,169,97,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div className="relative z-10 flex items-center gap-4">
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(201,169,97,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p className="font-heading font-black leading-none" style={{ fontSize: "30px", color: "#E8CD93" }}>{value.toLocaleString()}</p>
          <p style={{ fontSize: "12px", color: "rgba(250,246,236,0.55)", marginTop: "4px" }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function CreamStatCard({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div style={{ background: "#FFFDF8", borderRadius: "16px", padding: "22px 20px", border: "1px solid rgba(201,169,97,0.15)", boxShadow: "0 2px 8px rgba(15,27,45,0.05)" }}>
      <div className="flex items-center gap-4">
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(201,169,97,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p className="font-heading font-black text-navy leading-none" style={{ fontSize: "30px" }}>{value.toLocaleString()}</p>
          <p className="text-muted" style={{ fontSize: "12px", marginTop: "4px" }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, meta, textDir }: { title: string; meta?: string; textDir?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="font-heading font-bold text-navy whitespace-nowrap" dir={textDir} style={{ fontSize: "22px" }}>{title}</h2>
      <div style={{ flex: 1, height: "1px", background: "rgba(201,169,97,0.2)" }} />
      {meta && <span className="text-muted whitespace-nowrap" style={{ fontSize: "13px" }}>{meta}</span>}
    </div>
  );
}

// ─── Project card (memorial-card aesthetic) ───────────────────────────────────

function ProjectCard({ project, onShare }: { project: MemorialProject; onShare: () => void }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [manageOpen, setManageOpen] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(project.showLeaderboard !== false);
  const [projectLocked, setProjectLocked] = useState(project.locked === true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantStatus, setParticipantStatus] = useState<"all" | "active" | "completed" | "expired">("all");

  const progress = progressFromProject(project);
  const fallbackPct = project.totalPortions > 0
    ? Math.round(((project.claimedPortions || 0) / project.totalPortions) * 100)
    : 0;
  const fallbackCompletedPct = project.totalPortions > 0
    ? Math.round(((project.completedPortions || 0) / project.totalPortions) * 100)
    : 0;
  const pct = progress.hasTM ? progress.pct : fallbackPct;
  const completedPct = progress.hasTM ? progress.completedPct : fallbackCompletedPct;
  const cycleText = progress.hasTM ? cyclesLabel(progress.cycles, locale) : null;
  const remainingPortions = Math.max(0, (project.totalPortions || 0) - (project.claimedPortions || 0));
  const completedPortions = project.completedPortions || 0;
  const honorific = (project as MemorialProject & { honorific?: string }).honorific ||
    (project.gender === "female" ? "ע״ה" : "ז״ל");
  const hebrewName = `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
  const englishName = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();
  const isActive = project.status === "active";
  const memorialUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/memorial/${project.slug}` : "";
  const launchItems = [
    {
      key: "details",
      done: Boolean(project.nameHebrew && project.familyNameHebrew && (project.dateOfPassing || project.dateOfPassingGregorian)),
      label: locale === "he" ? "שם ותאריך מוכנים" : "Name and date ready",
    },
    {
      key: "tracks",
      done: Array.isArray(project.tracks) && project.tracks.length > 0 && project.totalPortions > 0,
      label: locale === "he" ? "תחומי לימוד נטענו" : "Learning tracks loaded",
    },
    {
      key: "access",
      done: Boolean(project.slug),
      label: project.isPasswordProtected
        ? (locale === "he" ? "קישור עם סיסמה" : "Password link")
        : (locale === "he" ? "קישור פתוח לשיתוף" : "Open share link"),
    },
    {
      key: "sharing",
      done: Boolean(project.slug),
      label: locale === "he" ? "הודעות שיתוף מוכנות" : "Share messages ready",
    },
    {
      key: "encouragement",
      done: leaderboardVisible,
      label: locale === "he" ? "יישר כח פעיל לעידוד" : "Yasher Koach encouragement on",
    },
  ];
  const launchDone = launchItems.filter((item) => item.done).length;
  const filteredClaims = claims.filter((claim) => {
    const query = participantSearch.trim().toLowerCase();
    const statusOk = participantStatus === "all" || claim.status === participantStatus;
    if (!statusOk) return false;
    if (!query) return true;
    return [
      claim.userName || "",
      claim.userEmail || "",
      claim.reference || "",
      learningLabel(locale, claim.reference, claim.trackType) || "",
      claim.trackType || "",
      claim.status || "",
    ].some((value) => String(value).toLowerCase().includes(query));
  });

  async function loadClaims() {
    if (claims.length > 0) return; // already loaded
    setLoadingClaims(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/projects/${project.id}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch { /* ignore */ }
    setLoadingClaims(false);
  }

  async function removeClaim(claimId: string) {
    if (!confirm(locale === "he" ? "להסיר את המשתתף מחלק זה?" : "Remove this participant entry?")) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/projects/${project.id}/claims/${claimId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        setClaims(prev => prev.filter(c => c.id !== claimId));
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function saveName(claimId: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/projects/${project.id}/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, userName: editName.trim() }),
      });
      if (res.ok) {
        setClaims(prev => prev.map(c =>
          c.id === claimId
            ? { ...c, userName: editName.trim() }
            : c
        ));
        setEditingId(null);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  function exportClaimsCsv() {
    const headers = locale === "he"
      ? ["שם", "אימייל", "תחום", "חלק", "סטטוס", "נלקח בתאריך", "סומן כנלמד"]
      : ["Name", "Email", "Track", "Portion", "Status", "Taken date", "Completed date"];
    const rows = [
      headers,
      ...filteredClaims.map((c) => {
        return [
          c.userName || "",
          c.userEmail || "",
          learningLabel(locale, null, c.trackType),
          learningLabel(locale, c.reference, c.trackType),
          claimStatusLabel(c.status || "active", locale),
          c.claimedAt ? formatDate(c.claimedAt, locale) : "",
          c.completedAt ? formatDate(c.completedAt, locale) : "",
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.slug || project.id}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function emailParticipants() {
    const emails = Array.from(new Set(
      filteredClaims
        .map((c) => String(c.userEmail || "").trim())
        .filter((email) => email.includes("@"))
    ));
    if (emails.length === 0) return;
    const body = locale === "he"
      ? `שלום,\n\nתודה שלקחתם חלק בלימוד לעילוי נשמת ${hebrewName}.\nאפשר לחזור לדף כאן:\n${memorialUrl}\n\nתזכו למצוות.`
      : `Hello,\n\nThank you for taking part in the learning in memory of ${hebrewName}.\nYou can return to the page here:\n${memorialUrl}\n\nTizku l'mitzvos.`;
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(hebrewName)}&body=${encodeURIComponent(body)}`;
  }

  function emailParticipant(claim: Claim) {
    if (!claim.userEmail) return;
    const reference = learningLabel(locale, claim.reference, claim.trackType) || (locale === "he" ? "חלק לימוד" : "a portion");
    const body = locale === "he"
      ? `שלום ${claim.userName || ""},\n\nיישר כח שלקחת על עצמך ${reference} לעילוי נשמת ${hebrewName}.\nאפשר לחזור לדף כאן:\n${memorialUrl}\n\nתזכו למצוות.`
      : `Hello ${claim.userName || ""},\n\nYasher koach for taking ${reference} in memory of ${hebrewName}.\nYou can return to the page here:\n${memorialUrl}\n\nTizku l'mitzvos.`;
    window.location.href = mailtoUrl(claim.userEmail, hebrewName, body);
  }

  async function updateLeaderboardVisibility(next: boolean) {
    const previous = leaderboardVisible;
    setLeaderboardVisible(next);
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/projects/${project.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, updates: { showLeaderboard: next } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLeaderboardVisible(previous);
        toast.error(data.error || (locale === "he" ? "לא ניתן לעדכן את ההגדרה" : "Could not update setting"));
        return;
      }
      toast.success(locale === "he" ? "הגדרת יישר כח עודכנה" : "Yasher Koach setting updated");
    } catch {
      setLeaderboardVisible(previous);
      toast.error(locale === "he" ? "לא ניתן לעדכן את ההגדרה" : "Could not update setting");
    } finally {
      setSaving(false);
    }
  }

  async function updateProjectLocked(next: boolean) {
    const previous = projectLocked;
    setProjectLocked(next);
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/projects/${project.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, updates: { locked: next } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProjectLocked(previous);
        toast.error(data.error || (locale === "he" ? "לא ניתן לעדכן את מצב ההצטרפות" : "Could not update project access"));
        return;
      }
      toast.success(next
        ? (locale === "he" ? "הפרויקט נסגר להצטרפות חדשה" : "Project closed to new participants")
        : (locale === "he" ? "הפרויקט נפתח להצטרפות חדשה" : "Project reopened to new participants"));
    } catch {
      setProjectLocked(previous);
      toast.error(locale === "he" ? "לא ניתן לעדכן את מצב ההצטרפות" : "Could not update project access");
    } finally {
      setSaving(false);
    }
  }

  async function resetShownClaims() {
    const targets = filteredClaims.filter((claim) => claim.id);
    if (!targets.length) return;
    const confirmed = window.confirm(locale === "he"
      ? `לאפס ${targets.length} רשומות שמוצגות עכשיו? השתמשו בחיפוש או בסינון כדי לאפס רק פרק, מסכת או סדר מסוים.`
      : `Reset the ${targets.length} entries currently shown? Use search/filter first to target only a chapter, tractate, or group.`);
    if (!confirmed) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      let resetCount = 0;
      const resetIds = new Set<string>();
      for (const claim of targets) {
        const res = await fetch(`/api/projects/${project.id}/claims/${claim.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          resetCount++;
          resetIds.add(claim.id);
        }
      }
      setClaims((prev) => prev.filter((claim) => !resetIds.has(claim.id)));
      toast.success(locale === "he"
        ? `${resetCount} רשומות אופסו`
        : `${resetCount} entries reset`);
    } catch {
      toast.error(locale === "he" ? "לא ניתן לאפס את הרשומות" : "Could not reset entries");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,27,45,0.08)", border: "1px solid rgba(232,223,200,0.6)", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 10px 32px rgba(15,27,45,0.14)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 4px 16px rgba(15,27,45,0.08)"; }}
    >
      {/* Dark hero band */}
      <div style={{ background: "linear-gradient(165deg, #1B2138 0%, #252C48 100%)", padding: "16px 16px 14px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "180px", height: "100px", background: "radial-gradient(ellipse, rgba(201,162,75,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 10 }}>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: isActive ? "rgba(91,122,82,0.25)" : "rgba(255,255,255,0.08)", color: isActive ? "#A8D090" : "rgba(250,246,236,0.40)", fontWeight: 600 }}>
            {isActive ? "● פעיל" : t(`status_${project.status}` as "status_active")}
          </span>
        </div>
        <p className="font-serif italic text-center relative z-10" style={{ color: "rgba(201,162,75,0.70)", fontSize: "10px", letterSpacing: "0.08em", marginBottom: "4px" }}>— לעילוי נשמת —</p>
        <h3 className="font-heading font-bold text-center relative z-10" dir="rtl" style={{ fontSize: "18px", color: "#FAF6EC", lineHeight: 1.25 }}>
          {hebrewName} {honorific}
        </h3>
        {englishName && (
          <p className="font-serif italic text-center relative z-10" style={{ fontSize: "11px", color: "rgba(201,162,75,0.45)", marginTop: "2px" }}>{englishName}</p>
        )}
      </div>

      {/* Cream stat band */}
      <div style={{ background: "#FFFDF8", padding: "14px 16px 10px" }}>
        <div style={{ textAlign: "center", marginBottom: "8px", display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px" }}>
          <span className="font-heading font-black" style={{ fontSize: "28px", color: "#C9A961", lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: "11px", color: "#8B7355" }}>{t("takenLabel")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#8B7355", marginBottom: "3px" }}>
          <span>{locale === "he" ? "נלקחו ללימוד" : "Taken for learning"}</span>
          <strong>{pct}%</strong>
        </div>
        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(15,27,45,0.07)", overflow: "hidden", marginBottom: "8px" }}>
          <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: "#C9A961", borderRadius: "2px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#5B7A52", marginBottom: "3px" }}>
          <span>{locale === "he" ? "נלמדו בפועל" : "Already learned"}</span>
          <strong>{completedPct}%</strong>
        </div>
        <div style={{ height: "3px", borderRadius: "2px", background: "rgba(91,122,82,0.10)", overflow: "hidden", marginBottom: "10px" }}>
          <div style={{ height: "100%", width: `${completedPct}%`, background: "#5B7A52", borderRadius: "2px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#8B7355" }}>
            <strong style={{ color: "#0F1B2D" }}>{project.claimedPortions}</strong>/{project.totalPortions} {t("portionsLabel")}
          </span>
          <span style={{ color: "#8B7355" }}>
            <strong style={{ color: "#0F1B2D" }}>{project.participantCount || 0}</strong> {t("participantsLabel")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
          <div style={{ borderRadius: "10px", background: "rgba(201,169,97,0.08)", padding: "8px 10px" }}>
            <p style={{ fontSize: "10px", color: "#8B7355", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {locale === "he" ? "חסרים" : "Still needed"}
            </p>
            <p className="font-heading font-bold" style={{ color: "#0F1B2D", fontSize: "18px", lineHeight: 1.1 }}>{remainingPortions}</p>
          </div>
          <div style={{ borderRadius: "10px", background: "rgba(91,122,82,0.08)", padding: "8px 10px" }}>
            <p style={{ fontSize: "10px", color: "#5B7A52", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {locale === "he" ? "נלמדו" : "Learned"}
            </p>
            <p className="font-heading font-bold" style={{ color: "#0F1B2D", fontSize: "18px", lineHeight: 1.1 }}>{completedPortions}</p>
          </div>
        </div>
        {cycleText && (
          <div style={{ marginTop: "10px", textAlign: "center", fontSize: "11px", color: "#5B7A52", fontWeight: 700 }}>
            {locale === "he" ? `${cycleText} · עכשיו במחזור הבא` : cycleText}
          </div>
        )}
        <div
          style={{ marginTop: "12px", borderRadius: "12px", border: "1px solid rgba(201,169,97,0.18)", background: "rgba(250,246,236,0.65)", padding: "10px" }}
          dir={locale === "he" ? "rtl" : "ltr"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#0F1B2D", fontSize: "12px", fontWeight: 800 }}>
              <ClipboardCheck className="h-3.5 w-3.5 text-gold" />
              {locale === "he" ? "בדיקת שיתוף" : "Launch checklist"}
            </span>
            <span style={{ fontSize: "11px", color: "#8B7355", fontWeight: 700 }}>{launchDone}/{launchItems.length}</span>
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            {launchItems.map((item) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "6px", color: item.done ? "#5B7A52" : "#8B7355", fontSize: "11px" }}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: item.done ? "#5B7A52" : "rgba(139,115,85,0.35)" }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action row — 3 equal buttons */}
      <div style={{ display: "flex", background: "#FAF6EC", borderTop: "1px solid rgba(232,223,200,0.7)" }}>
        <Link href={`/memorial/${project.slug}` as "/memorial/[slug]"} style={{ flex: 1, display: "block" }}>
          <button className="dashboard-action-btn">👁 {t("actionView")}</button>
        </Link>
        <div style={{ width: "1px", background: "rgba(232,223,200,0.7)" }} />
        <button onClick={onShare} className="dashboard-action-btn" style={{ flex: 1 }}>⤴ {t("actionShare")}</button>
        <div style={{ width: "1px", background: "rgba(232,223,200,0.7)" }} />
        <Link href={`/edit/${project.id}` as never} style={{ flex: 1, display: "block" }}>
          <button className="dashboard-action-btn">✎ {t("actionEdit")}</button>
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#FFFDF8", borderTop: "1px solid rgba(232,223,200,0.7)", padding: "10px 12px" }} dir={locale === "he" ? "rtl" : "ltr"}>
        <button
          type="button"
          onClick={() => updateProjectLocked(!projectLocked)}
          disabled={saving}
          className="dashboard-tool-btn"
          style={{ justifyContent: "center", minHeight: "38px" }}
        >
          {projectLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {projectLocked
            ? (locale === "he" ? "פתח הצטרפות" : "Open joining")
            : (locale === "he" ? "סגור הצטרפות" : "Close joining")}
        </button>
        <Link href={`/edit/${project.id}#reset-learning` as never} className="dashboard-tool-btn" style={{ justifyContent: "center", minHeight: "38px" }}>
          <RotateCw className="h-3.5 w-3.5" />
          {locale === "he" ? "איפוס וניהול" : "Reset & manage"}
        </Link>
      </div>

      {/* Manage participants section */}
      <div style={{ borderTop: "1px solid rgba(232,223,200,0.7)", background: "#FAF6EC" }}>
        <button
          onClick={() => { setManageOpen(o => !o); if (!manageOpen) loadClaims(); }}
          style={{ width: "100%", padding: "9px 16px", fontSize: "12px", fontWeight: 600, color: "#0F1B2D", background: "transparent", border: "none", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          ⚙ {locale === "he" ? "ניהול משתתפים" : "Manage Participants"}
          {manageOpen ? <span>▲</span> : <span>▼</span>}
        </button>
        {manageOpen && (
          <div style={{ padding: "0 12px 12px", maxHeight: "300px", overflowY: "auto" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px", margin: "4px 0 10px", borderRadius: "10px", background: "#FFFDF8", border: "1px solid rgba(232,223,200,0.8)" }}
              dir={locale === "he" ? "rtl" : "ltr"}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#0F1B2D" }}>
                  {locale === "he" ? "הצג יישר כח בעמוד" : "Show Yasher Koach on the page"}
                </p>
                <p style={{ fontSize: "11px", color: "#8B7355", lineHeight: 1.35 }}>
                  {locale === "he"
                    ? "מומלץ להשאיר פעיל כדי לעודד משתתפים לקחת עוד לימוד."
                    : "Recommended: keep it on to encourage people to take more learning."}
                </p>
              </div>
              <Switch checked={leaderboardVisible} onCheckedChange={updateLeaderboardVisibility} disabled={saving} />
            </div>
            {loadingClaims && (
              <p style={{ fontSize: "12px", color: "#8B7355", textAlign: "center", padding: "8px" }}>
                {locale === "he" ? "טוען משתתפים..." : "Loading participants..."}
              </p>
            )}
            {!loadingClaims && claims.length > 0 && (
              <div style={{ margin: "4px 0 10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "8px" }}>
                  <div className="dashboard-mini-stat">
                    <strong>{claims.length}</strong>
                    <span>{locale === "he" ? "משתתפים" : "participants"}</span>
                  </div>
                  <div className="dashboard-mini-stat">
                    <strong>{claims.filter((c) => c.status === "active").length}</strong>
                    <span>{locale === "he" ? "בלימוד" : "learning"}</span>
                  </div>
                  <div className="dashboard-mini-stat">
                    <strong>{claims.filter((c) => c.status === "completed").length}</strong>
                    <span>{locale === "he" ? "נלמד" : "learned"}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    onClick={exportClaimsCsv}
                    className="dashboard-tool-btn"
                    type="button"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {locale === "he" ? "CSV" : "CSV"}
                  </button>
                  <button
                    onClick={emailParticipants}
                    className="dashboard-tool-btn"
                    type="button"
                    disabled={!claims.some((c) => String(c.userEmail || "").includes("@"))}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {locale === "he" ? "אימייל" : "Email"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px", marginTop: "8px" }}>
                  <label style={{ position: "relative", display: "block" }}>
                    <Search
                      className="h-3.5 w-3.5"
                      style={{
                        position: "absolute",
                        top: "50%",
                        [locale === "he" ? "right" : "left"]: "8px",
                        transform: "translateY(-50%)",
                        color: "#8B7355",
                      }}
                    />
                    <input
                      value={participantSearch}
                      onChange={(event) => setParticipantSearch(event.target.value)}
                      placeholder={locale === "he" ? "חיפוש שם, אימייל או חלק" : "Search name, email, or portion"}
                      style={{
                        width: "100%",
                        minHeight: "32px",
                        borderRadius: "8px",
                        border: "1px solid rgba(232,223,200,0.9)",
                        background: "#FFFDF8",
                        color: "#0F1B2D",
                        fontSize: "12px",
                        padding: locale === "he" ? "4px 28px 4px 8px" : "4px 8px 4px 28px",
                      }}
                      dir={locale === "he" ? "rtl" : "ltr"}
                    />
                  </label>
                  <select
                    value={participantStatus}
                    onChange={(event) => setParticipantStatus(event.target.value as "all" | "active" | "completed" | "expired")}
                    style={{ minHeight: "32px", borderRadius: "8px", border: "1px solid rgba(232,223,200,0.9)", background: "#FFFDF8", color: "#0F1B2D", fontSize: "12px", padding: "4px 8px" }}
                  >
                    <option value="all">{locale === "he" ? "הכל" : "All"}</option>
                    <option value="active">{locale === "he" ? "בלימוד" : "Learning"}</option>
                    <option value="completed">{locale === "he" ? "נלמד" : "Learned"}</option>
                    <option value="expired">{locale === "he" ? "עבר הזמן" : "Expired"}</option>
                  </select>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", padding: "8px", borderRadius: "10px", background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.18)" }}
                  dir={locale === "he" ? "rtl" : "ltr"}
                >
                  <p style={{ margin: 0, fontSize: "11px", color: "#8B7355", lineHeight: 1.4 }}>
                    {locale === "he"
                      ? "רוצים לאפס פרק, מסכת או סדר? חפשו או סננו קודם, ואז אפסו רק את הרשומות שמוצגות."
                      : "Need to reset a chapter, tractate, or group? Search/filter first, then reset only the entries shown."}
                  </p>
                  <button
                    type="button"
                    onClick={resetShownClaims}
                    disabled={saving || filteredClaims.length === 0}
                    className="dashboard-tool-btn"
                    style={{ justifyContent: "center", minHeight: "32px", color: "#9A6B18", borderColor: "rgba(201,169,97,0.28)" }}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    {locale === "he"
                      ? `אפס את המוצגים (${filteredClaims.length})`
                      : `Reset shown (${filteredClaims.length})`}
                  </button>
                </div>
              </div>
            )}
            {!loadingClaims && claims.length === 0 && (
              <p style={{ fontSize: "12px", color: "#8B7355", textAlign: "center", padding: "8px" }}>
                {locale === "he" ? "אין משתתפים עדיין" : "No participants yet"}
              </p>
            )}
            {!loadingClaims && claims.length > 0 && filteredClaims.length === 0 && (
              <p style={{ fontSize: "12px", color: "#8B7355", textAlign: "center", padding: "8px" }}>
                {locale === "he" ? "אין משתתפים שמתאימים לחיפוש" : "No participants match this filter"}
              </p>
            )}
            {filteredClaims.map((c) => {
              const cl = c as Claim;
              const isEditing = editingId === cl.id;
              const statusColor = cl.status === "completed" ? "#5B7A52" : "#C9A961";
              return (
                <div key={cl.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 0", borderBottom: "1px solid rgba(232,223,200,0.4)", fontSize: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: "100%", padding: "2px 6px", border: "1px solid #C9A961", borderRadius: "4px", fontSize: "12px" }}
                        onKeyDown={(e) => e.key === "Enter" && saveName(cl.id)}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, color: "#0F1B2D" }} dir="rtl">{cl.userName}</span>
                        <span style={{ color: "#8B7355", marginLeft: "4px" }}>{learningLabel(locale, cl.reference, cl.trackType)}</span>
                        <span style={{ color: statusColor, marginLeft: "4px", fontSize: "10px", fontWeight: 700 }}>
                          {claimStatusLabel(cl.status, locale)}
                        </span>
                        {cl.userEmail && (
                          <span style={{ color: "#8B7355", marginLeft: "4px", fontSize: "11px" }}>{cl.userEmail}</span>
                        )}
                        {cl.claimedAt && (
                          <span style={{ color: "#8B7355", marginLeft: "4px", fontSize: "11px" }}>{formatDate(cl.claimedAt, locale)}</span>
                        )}
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <button onClick={() => saveName(cl.id)} disabled={saving} style={{ fontSize: "11px", color: "#5B7A52", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: "11px", color: "#8B7355", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(cl.id); setEditName(cl.userName); }} style={{ fontSize: "11px", color: "#8B7355", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                        {locale === "he" ? "ערוך שם" : "Edit"}
                      </button>
                      {cl.userEmail && (
                        <button onClick={() => emailParticipant(cl)} disabled={saving} title={locale === "he" ? "שלח תזכורת באימייל" : "Email reminder"} style={{ fontSize: "11px", color: "#5B7A52", background: "none", border: "none", cursor: "pointer" }}>
                          <Send className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => removeClaim(cl.id)} disabled={saving} style={{ fontSize: "11px", color: "#9A3B32", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                        {locale === "he" ? "אפס חלק" : "Reset"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ items, locale }: { items: ActivityItem[]; locale: string }) {
  const t = useTranslations("dashboard");

  if (items.length === 0) {
    return (
      <div style={{ background: "#FFFDF8", borderRadius: "16px", border: "1px solid rgba(232,223,200,0.6)", padding: "32px", textAlign: "center", marginBottom: "32px" }}>
        <p className="text-muted text-sm">{t("activityEmpty")}</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#FFFDF8", borderRadius: "16px", border: "1px solid rgba(232,223,200,0.6)", marginBottom: "32px", overflow: "hidden" }}>
      {items.map((item, i) => (
        <div key={item.id}>
          {i > 0 && <div style={{ height: "1px", background: "rgba(232,223,200,0.6)" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(201,169,97,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
              {TRACK_EMOJI[item.trackType || ""] || "📖"}
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <span className="font-heading font-bold text-navy" style={{ fontSize: "14px" }}>
                {item.claimerName}
              </span>
              <span className="text-muted" style={{ fontSize: "12px" }}>
                {" · "}{t("activityTook", { reference: learningLabel(locale, item.reference, item.trackType) })}
                {item.projectHonoree && (
                  <> {t("activityIn")} <em>{item.projectHonoree}</em></>
                )}
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#8B7355", flexShrink: 0, whiteSpace: "nowrap" }}>
              {relativeTime(item.claimedAt, locale)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state (no projects) ────────────────────────────────────────────────

function EmptyProjectsState() {
  const t = useTranslations("dashboard");
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div className="flex justify-center mb-6">
        <YahrzeitCandle size="md" />
      </div>
      <h3 className="font-heading font-bold text-navy mb-2" dir="rtl" style={{ fontSize: "24px" }}>
        {t("noProjectsNew")}
      </h3>
      <p className="font-serif italic text-muted mb-8 max-w-sm mx-auto" style={{ fontSize: "16px" }}>
        {t("noProjectsNewDesc")}
      </p>
      <Link href="/create">
        <Button size="lg">
          <Plus className="h-5 w-5" />
          {t("createNew")}
        </Button>
      </Link>
    </div>
  );
}

function CommunityCTA() {
  const t = useTranslations("dashboard");
  return (
    <div style={{ marginTop: "32px", background: "linear-gradient(165deg, #1B2138 0%, #252C48 100%)", borderRadius: "16px", padding: "24px", color: "#FAF6EC", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", flexWrap: "wrap" }}>
      <div className="flex items-center gap-4">
        <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(201,169,97,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Users className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h3 className="font-heading font-bold" style={{ fontSize: "20px" }}>{t("communityTitle")}</h3>
          <p style={{ color: "rgba(250,246,236,0.65)", fontSize: "13px", marginTop: "2px" }}>{t("communityDesc")}</p>
        </div>
      </div>
      <Link href="/">
        <Button variant="secondary">{t("browseMemorials")}</Button>
      </Link>
    </div>
  );
}

// ─── Main dashboard page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { user, profile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalClaimedPortions: 0, uniqueParticipants: 0, claimsThisWeek: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareProject, setShareProject] = useState<MemorialProject | null>(null);

  async function loadData() {
    if (!user) return;
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setClaims(data.claims || []);
        setStats(data.stats || { totalClaimedPortions: 0, uniqueParticipants: 0, claimsThisWeek: 0 });
        setRecentActivity(data.recentActivity || []);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
        <p className="text-muted text-sm">{t("sessionExpired")}</p>
        <Link href="/login"><Button>{t("signIn") || "Sign in"}</Button></Link>
      </div>
    );
  }

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "";
  const isRTL = locale === "he";

  return (
    <>
      {/* Inline styles for action buttons */}
      <style>{`.dashboard-action-btn { width: 100%; padding: 11px 4px; font-size: 12px; font-weight: 700; color: #0F1B2D; background: transparent; border: none; cursor: pointer; display: block; text-align: center; transition: background 0.15s; } .dashboard-action-btn:hover { background: rgba(201,169,97,0.08); } .dashboard-tool-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; border-radius: 8px; border: 1px solid rgba(201,169,97,0.25); background: #FFFDF8; color: #0F1B2D; font-size: 12px; font-weight: 700; } .dashboard-tool-btn:disabled { opacity: 0.45; cursor: not-allowed; } .dashboard-mini-stat { border-radius: 8px; background: rgba(255,253,248,0.85); border: 1px solid rgba(232,223,200,0.6); padding: 6px 8px; text-align: center; } .dashboard-mini-stat strong { display: block; color: #0F1B2D; font-size: 15px; line-height: 1; } .dashboard-mini-stat span { display: block; color: #8B7355; font-size: 10px; margin-top: 2px; }`}</style>

      <div className="bg-cream min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

          {/* ── Greeting row ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <h1
                className="font-heading font-bold text-navy"
                dir={isRTL ? "rtl" : "ltr"}
                style={{ fontSize: "32px" }}
              >
                {displayName ? t("greeting", { name: displayName }) : t("greetingNoName")}
              </h1>
              <p className="font-serif italic text-muted mt-1" style={{ fontSize: "17px" }}>
                {t("greetingSub")}
              </p>
            </div>
            <Link href="/create">
              <Button
                size="lg"
                style={{ background: "#C9A961", color: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(201,169,97,0.35)", border: "none" }}
              >
                <Plus className="h-5 w-5" />
                {t("createNew")}
              </Button>
            </Link>
          </div>

          {/* ── Three stat cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <DarkStatCard
              icon="📖"
              value={stats.totalClaimedPortions}
              label={t("statPortionsTaken")}
            />
            <CreamStatCard
              icon="👥"
              value={stats.uniqueParticipants}
              label={t("statParticipants")}
            />
            <CreamStatCard
              icon="✨"
              value={stats.claimsThisWeek}
              label={t("statThisWeek")}
            />
          </div>

          {/* ── My Memorials / Empty state ────────────────────────────────── */}
          {projects.length === 0 ? (
            <EmptyProjectsState />
          ) : (
            <>
              <SectionHeader
                title={t("myMemorials")}
                meta={t("activeCount", { count: projects.length })}
                textDir={isRTL ? "rtl" : undefined}
              />
              <div
                className="mb-10"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px" }}
              >
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onShare={() => setShareProject(project)}
                  />
                ))}
              </div>

              {/* ── Recent activity ────────────────────────────────────── */}
              <SectionHeader
                title={t("recentActivity")}
                meta={`${stats.claimsThisWeek} ${t("thisWeek")}`}
                textDir={isRTL ? "rtl" : undefined}
              />
              <ActivityFeed items={recentActivity} locale={locale} />
            </>
          )}

          {/* ── My Learning Journey (own claims accordion) ─────────────── */}
          {claims.length > 0 && (
            <section className="mt-4">
              <SectionHeader
                title={t("myClaims")}
                textDir={isRTL ? "rtl" : undefined}
              />
              <ClaimsAccordion claims={claims} />
            </section>
          )}

          <CommunityCTA />
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={!!shareProject} onOpenChange={(o) => !o && setShareProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle dir="rtl">{shareProject?.nameHebrew}</DialogTitle>
          </DialogHeader>
          {shareProject && (
            <>
              {shareProject.isPasswordProtected && (
                <p className="rounded-lg bg-gold/10 px-3 py-2 text-sm text-navy" dir={locale === "he" ? "rtl" : "ltr"}>
                  {locale === "he"
                    ? "הקישור תקין, אבל מי שפותח אותו יצטרך את הסיסמה שהגדרת."
                    : "The link works, but visitors will need the password you set."}
                </p>
              )}
              <ShareTemplates
                honoree={formatHebrewHonoreeName(shareProject, { includeParents: true })}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/memorial/${shareProject.slug}`}
                preferredText={shareProject.shareMessage}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Hierarchical claims accordion (unchanged) ────────────────────────────────

type AnyClaim = Claim & { projectId: string; projectSlug?: string; projectHonoree?: string };

function ClaimsAccordion({ claims }: { claims: AnyClaim[] }) {
  const byProject = useMemo(() => {
    const groups: Record<string, AnyClaim[]> = {};
    for (const c of claims) {
      const pid = (c as AnyClaim).projectId;
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(c as AnyClaim);
    }
    return groups;
  }, [claims]);

  return (
    <div className="space-y-4">
      {Object.entries(byProject).map(([projectId, projectClaims]) => (
        <ProjectSection key={projectId} projectId={projectId} claims={projectClaims} />
      ))}
    </div>
  );
}

function ProjectSection({ projectId, claims }: { projectId: string; claims: AnyClaim[] }) {
  const t = useTranslations("dashboard");
  const tm = useTranslations("memorial");
  const locale = useLocale();
  const total = claims.length;
  const taken = claims.filter((c) => c.status === "active" || c.status === "completed").length;
  const pct = total ? Math.round((taken / total) * 100) : 0;
  const projectSlug = (claims[0] as AnyClaim).projectSlug;
  const honoree = (claims[0] as AnyClaim).projectHonoree;
  const byTrack: Record<string, AnyClaim[]> = {};
  for (const c of claims) {
    if (!byTrack[c.trackType]) byTrack[c.trackType] = [];
    byTrack[c.trackType].push(c);
  }
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ background: "#FFFDF8", borderRadius: "14px", border: "1px solid rgba(232,223,200,0.6)", padding: "16px 20px" }}>
      <button type="button" onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between gap-3 text-start">
        <div className="flex items-center gap-3 min-w-0">
          <YahrzeitCandle size="sm" />
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-navy truncate" dir="rtl">
              {honoree || t("projectShort", { id: projectId.slice(0, 6) })}
            </p>
            <p className="text-xs text-muted">{taken} {t("active")} · {taken}/{total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-navy">{pct}%</span>
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </div>
      </button>
      <div style={{ height: "4px", borderRadius: "2px", background: "rgba(15,27,45,0.07)", overflow: "hidden", margin: "10px 0 0" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#C9A961", borderRadius: "2px" }} />
      </div>
      {!collapsed && (
        <div className="mt-4 space-y-3 border-t border-navy/5 pt-4">
          {projectSlug && (
            <Link href={`/memorial/${projectSlug}` as "/memorial/[slug]"} className="text-xs text-gold hover:underline">
              {t("viewMemorial")} →
            </Link>
          )}
          {Object.entries(byTrack).map(([track, trackClaims]) => (
            <TrackBlock key={track} track={track} claims={trackClaims} locale={locale} tMem={tm} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackBlock({ track, claims, locale, tMem }: {
  track: string;
  claims: AnyClaim[];
  locale: string;
  tMem: ReturnType<typeof useTranslations<"memorial">>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMishnayos = track === "mishnayos";
  const byMasechta: Record<string, AnyClaim[]> = {};
  if (isMishnayos) {
    for (const c of claims) {
      const m = ((c.reference || "") as string).split(" ")[0] || "Other";
      if (!byMasechta[m]) byMasechta[m] = [];
      byMasechta[m].push(c);
    }
  }
  return (
    <div className="rounded-lg border border-navy/5 bg-cream-warm/30 p-3">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded ? <ChevronDown className="h-4 w-4 text-gold shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted shrink-0" />}
          <span className="text-sm font-medium text-navy">{tMem(`track_${track}` as never)}</span>
          <span className="text-xs text-muted">{claims.length}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 pl-6">
          {isMishnayos
            ? Object.entries(byMasechta).map(([masechta, mClaims]) => (
                <MasechtaBlock key={masechta} masechta={masechta} claims={mClaims} locale={locale} />
              ))
            : claims.map((c) => <PortionRow key={c.id} claim={c} locale={locale} />)}
        </div>
      )}
    </div>
  );
}

function MasechtaBlock({ masechta, claims, locale }: { masechta: string; claims: AnyClaim[]; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md bg-white border border-navy/5 p-2.5">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gold shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />}
          <span className="text-xs font-medium text-navy">{masechta}</span>
          <span className="text-[10px] text-muted">{claims.length}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1 pl-4">
          {claims.map((c) => <PortionRow key={c.id} claim={c} locale={locale} />)}
        </div>
      )}
    </div>
  );
}

function PortionRow({ claim, locale }: { claim: AnyClaim; locale: string }) {
  let label: string = claim.reference || "";
  if (locale === "he") {
    label = label.replace(/\s(\d{1,3})\s*$/, (_m, n) => " " + toHebrewNumeral(parseInt(n, 10)));
  }
  return (
    <div className="flex items-center gap-2 text-xs py-1 text-navy">
      <span className="h-2 w-2 rounded-full border border-gold/30 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}
