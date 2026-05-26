"use client";

import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { Plus, BookOpen, Clock, Users, Eye, Share2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject, Claim } from "@/lib/types";
import { toast } from "sonner";
import { toHebrewNumeral } from "@/lib/hebrew-numerals";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user, profile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
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
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
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
        <p className="text-muted text-sm">
          {t("sessionExpired") || "Your session has expired."}
        </p>
        <Link href="/login">
          <Button>{t("signIn") || "Sign in"}</Button>
        </Link>
      </div>
    );
  }

  const takenClaims = claims.filter((c) => c.status === "active" || c.status === "completed");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">
            {t("title")}
          </h1>
          <p className="text-muted mt-1">
            {t("welcome", { name: profile?.displayName || user?.email?.split("@")[0] || "" })}
          </p>
        </div>
        <Link href="/create">
          <Button size="lg">
            <Plus className="h-5 w-5" />
            {t("createMemorial")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: BookOpen, label: t("myProjects"), value: projects.length },
          { icon: Clock, label: t("activeClaims"), value: takenClaims.length },
          { icon: Users, label: t("contributing"), value: new Set(claims.map((c) => c.projectId)).size },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                <stat.icon className="h-5 w-5 text-gold-deep" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-navy">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My Projects */}
      <section className="mb-10">
        <h2 className="font-heading text-xl font-semibold text-navy mb-4">{t("myProjects")}</h2>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-gold/40 mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                {t("noProjects")}
              </h3>
              <p className="text-sm text-muted mb-4">{t("noProjectsDesc")}</p>
              <Link href="/create">
                <Button>
                  <Plus className="h-4 w-4" />
                  {t("createFirst")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const pct =
                project.totalPortions > 0
                  ? Math.round((project.claimedPortions / project.totalPortions) * 100)
                  : 0;
              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg truncate" dir="rtl">{project.nameHebrew}</CardTitle>
                      <Badge variant={project.status === "active" ? "success" : "secondary"}>
                        {t(`status_${project.status}`)}
                      </Badge>
                    </div>
                    {project.nameEnglish && (
                      <p className="text-sm text-muted truncate">{project.nameEnglish}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">{t("taken") || "נלקחו"}</span>
                        <span className="font-medium text-navy">{pct}%</span>
                      </div>
                      <Progress value={pct} />
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{project.claimedPortions}/{project.totalPortions} {t("portions")}</span>
                        <span>{t("participants", { count: project.participantCount || 0 })}</span>
                      </div>
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <Link href={`/memorial/${project.slug}` as "/memorial/[slug]"} className="flex-1 min-w-[80px]">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="h-3 w-3" />
                            {t("view")}
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t("share") || "Share"}
                          onClick={() => setShareProject(project)}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                        {project.createdBy === user?.uid && (
                          <Link href={`/edit/${project.id}` as never}>
                            <Button variant="ghost" size="sm" title="ערוך הנצחה">
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* My Learning Journey */}
      {claims.length > 0 && (
        <section>
          <h2 className="font-heading text-xl font-semibold text-navy mb-4">{t("myClaims")}</h2>
          <ClaimsAccordion claims={claims} />
        </section>
      )}

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
    </div>
  );
}

// ─── Hierarchical claims accordion ───────────────────────────────────────────

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
        <ProjectSection
          key={projectId}
          projectId={projectId}
          claims={projectClaims}
        />
      ))}
    </div>
  );
}

function ProjectSection({ projectId, claims }: {
  projectId: string;
  claims: AnyClaim[];
}) {
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
    <Card>
      <CardContent className="p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-3 text-start group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <YahrzeitCandle size="sm" />
            <div className="min-w-0">
              <p className="font-heading text-base sm:text-lg font-semibold text-navy truncate" dir="rtl">
                {honoree || t("projectShort", { id: projectId.slice(0, 6) }) || `Project ${projectId.slice(0, 6)}`}
              </p>
              <p className="text-xs text-muted">{taken} {t("active") || "taken"} · {taken}/{total}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-navy">{pct}%</span>
            {collapsed ? <ChevronRight className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
          </div>
        </button>
        <Progress value={pct} className="h-1.5 mt-3" />
        {!collapsed && (
          <div className="mt-4 space-y-3 border-t border-navy/5 pt-4">
            {projectSlug && (
              <Link href={`/memorial/${projectSlug}` as "/memorial/[slug]"} className="text-xs text-gold hover:underline">
                {t("viewMemorial") || "View memorial"} →
              </Link>
            )}
            {Object.entries(byTrack).map(([track, trackClaims]) => (
              <TrackBlock
                key={track}
                track={track}
                claims={trackClaims}
                locale={locale}
                tMem={tm}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
                <MasechtaBlock
                  key={masechta}
                  masechta={masechta}
                  claims={mClaims}
                  locale={locale}
                />
              ))
            : claims.map((c) => (
                <PortionRow key={c.id} claim={c} locale={locale} />
              ))}
        </div>
      )}
    </div>
  );
}

function MasechtaBlock({ masechta, claims, locale }: {
  masechta: string;
  claims: AnyClaim[];
  locale: string;
}) {
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
          {claims.map((c) => (
            <PortionRow key={c.id} claim={c} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function PortionRow({ claim, locale }: {
  claim: AnyClaim;
  locale: string;
}) {
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
