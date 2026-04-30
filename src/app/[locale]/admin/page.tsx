"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Eye, EyeOff, Trash2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import type { MemorialProject } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "hidden" | "reported";

export default function AdminPage() {
  const t = useTranslations("admin");
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hideReason, setHideReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !profile?.isAdmin)) {
      router.push("/dashboard");
      return;
    }
    if (user && profile?.isAdmin) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  async function loadProjects() {
    try {
      const q = query(
        collection(db, "lzecher_projects"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MemorialProject)));
    } catch (err) {
      console.error("Load projects error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string, projectId: string, extra?: Record<string, string>) {
    setProcessing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, idToken, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(t(`${action}Success`));
      loadProjects();
    } catch {
      toast.error(t("actionError"));
    } finally {
      setProcessing(false);
      setHideDialogOpen(false);
      setDeleteDialogOpen(false);
      setHideReason("");
      setDeleteConfirm("");
      setActionId(null);
    }
  }

  const filtered = projects.filter((p) => {
    if (filter === "active" && p.status !== "active") return false;
    if (filter === "hidden" && p.status !== "hidden") return false;
    if (filter === "reported" && !(p as MemorialProject & { reportsCount?: number }).reportsCount) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.nameHebrew.toLowerCase().includes(q) ||
        (p.nameEnglish?.toLowerCase().includes(q) ?? false) ||
        ((p as MemorialProject & { createdByEmail?: string }).createdByEmail?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="h-8 w-8" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl font-bold text-navy">{t("dashTitle")}</h1>
          <Badge variant="secondary">{projects.length}</Badge>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "active", "hidden", "reported"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  filter === f ? "border-gold bg-gold/10 text-navy" : "border-navy/10 text-muted"
                )}
              >
                {t(`filter_${f}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {filtered.map((project) => {
            const reports = (project as MemorialProject & { reportsCount?: number }).reportsCount || 0;
            return (
              <Card key={project.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-navy truncate" dir="rtl">
                      {project.nameHebrew}
                    </p>
                    {project.nameEnglish && (
                      <p className="text-sm text-muted truncate">{project.nameEnglish}</p>
                    )}
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={project.status === "active" ? "success" : project.status === "hidden" ? "destructive" : "secondary"}>
                      {project.status}
                    </Badge>
                    {reports > 0 && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {reports}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={`/en/memorial/${project.slug}`} target="_blank" rel="noopener">
                      <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                    </a>
                    {project.status === "active" ? (
                      <Button variant="ghost" size="icon" onClick={() => { setActionId(project.id); setHideDialogOpen(true); }}>
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    ) : project.status === "hidden" ? (
                      <Button variant="ghost" size="icon" onClick={() => handleAction("unhide", project.id)}>
                        <Eye className="h-4 w-4 text-gold" />
                      </Button>
                    ) : null}
                    {profile?.isSuperAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => { setActionId(project.id); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted py-12">{t("noResults")}</p>
          )}
        </div>
      </div>

      {/* Hide dialog */}
      <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("hideTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t("hideReasonPlaceholder")}
            value={hideReason}
            onChange={(e) => setHideReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHideDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => actionId && handleAction("hide", actionId, { reason: hideReason })} disabled={processing}>
              {processing ? <Spinner className="h-4 w-4" /> : t("hideConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">{t("deleteWarning")}</p>
          <p className="text-xs font-mono text-navy bg-cream p-2 rounded">
            DELETE_PROJECT_{actionId}
          </p>
          <Input
            placeholder={t("deleteConfirmPlaceholder")}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => actionId && handleAction("delete", actionId, { confirmation: deleteConfirm })}
              disabled={processing || deleteConfirm !== `DELETE_PROJECT_${actionId}`}
            >
              {processing ? <Spinner className="h-4 w-4" /> : t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
