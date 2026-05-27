"use client";

import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Claim } from "@/lib/types";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";

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
  const pct = project.totalPortions > 0
    ? Math.round((project.claimedPortions / project.totalPortions) * 100)
    : 0;
  const honorific = (project as MemorialProject & { honorific?: string }).honorific ||
    (project.gender === "female" ? "ע״ה" : "ז״ל");
  const hebrewName = `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
  const englishName = `${project.nameEnglish || ""} ${project.familyNameEnglish || ""}`.trim();
  const isActive = project.status === "active";

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
        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(15,27,45,0.07)", overflow: "hidden", marginBottom: "10px" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#C9A961", borderRadius: "2px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span style={{ color: "#8B7355" }}>
            <strong style={{ color: "#0F1B2D" }}>{project.claimedPortions}</strong>/{project.totalPortions} {t("portionsLabel")}
          </span>
          <span style={{ color: "#8B7355" }}>
            <strong style={{ color: "#0F1B2D" }}>{project.participantCount || 0}</strong> {t("participantsLabel")}
          </span>
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
                {" · "}{t("activityTook", { reference: item.reference || "" })}
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
    if (!user) { setLoading(false); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  if (authLoading || loading) {
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
      <style>{`.dashboard-action-btn { width: 100%; padding: 11px 4px; font-size: 12px; font-weight: 700; color: #0F1B2D; background: transparent; border: none; cursor: pointer; display: block; text-align: center; transition: background 0.15s; } .dashboard-action-btn:hover { background: rgba(201,169,97,0.08); }`}</style>

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
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={!!shareProject} onOpenChange={(o) => !o && setShareProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle dir="rtl">{shareProject?.nameHebrew}</DialogTitle>
          </DialogHeader>
          {shareProject && (
            <ShareTemplates
              honoree={`${shareProject.nameHebrew} ${shareProject.familyNameHebrew || ""}`.trim()}
              url={`${typeof window !== "undefined" ? window.location.origin : ""}/memorial/${shareProject.slug}`}
            />
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
