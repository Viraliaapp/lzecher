"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, BookOpen, CheckCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { MemorialProject, Claim } from "@/lib/types";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!user) return;
    try {
      // Load user's projects
      const projQ = query(
        collection(db, "lzecher_projects"),
        where("createdBy", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const projSnap = await getDocs(projQ);
      setProjects(projSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MemorialProject)));

      // Load user's claims
      const claimQ = query(
        collection(db, "lzecher_claims"),
        where("userId", "==", user.uid),
        orderBy("claimedAt", "desc")
      );
      const claimSnap = await getDocs(claimQ);
      setClaims(claimSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Claim)));
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const activeClaims = claims.filter((c) => c.status === "active");
  const completedClaims = claims.filter((c) => c.status === "completed");

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: BookOpen, label: t("myProjects"), value: projects.length },
          { icon: Clock, label: t("activeClaims"), value: activeClaims.length },
          { icon: CheckCircle, label: t("completed"), value: completedClaims.length },
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
                  ? Math.round((project.completedPortions / project.totalPortions) * 100)
                  : 0;
              return (
                <Link key={project.id} href={`/memorial/${project.slug}` as "/memorial/[slug]"}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{project.nameHebrew}</CardTitle>
                        <Badge variant={project.status === "active" ? "success" : "secondary"}>
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">{project.nameEnglish}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted">{t("progress")}</span>
                          <span className="font-medium text-navy">{pct}%</span>
                        </div>
                        <Progress value={pct} />
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>
                            {project.completedPortions}/{project.totalPortions} {t("portions")}
                          </span>
                          <span>{project.participantCount} {t("participants")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Claims */}
      {activeClaims.length > 0 && (
        <section>
          <h2 className="font-heading text-xl font-semibold text-navy mb-4">{t("myClaims")}</h2>
          <div className="space-y-3">
            {activeClaims.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy">{claim.reference}</p>
                    <p className="text-xs text-muted capitalize">{claim.trackType.replace("_", " ")}</p>
                  </div>
                  <Badge>{t("inProgress")}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
