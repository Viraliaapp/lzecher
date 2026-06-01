"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Eye, EyeOff, Trash2, Search, AlertTriangle, Pencil, Share2, Inbox, UserPlus, BarChart3, RotateCw } from "lucide-react";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "hidden" | "reported";

type SuperFeedback = {
  id: string;
  type: string;
  message: string;
  email: string | null;
  locale: string;
  currentPath: string | null;
  status: string;
  allowAsTestimonial: boolean;
  submittedAt: number;
};

type AdminUserSummary = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
  updatedAt?: number | null;
  createdAt?: number | null;
};

type SuperOverview = {
  stats: Record<string, number>;
  recentFeedback: SuperFeedback[];
  adminUsers: AdminUserSummary[];
  recentReports: Record<string, unknown>[];
};

const PERMISSIONS = [
  { key: "projects", he: "פרויקטים", en: "Projects" },
  { key: "feedback", he: "משוב", en: "Feedback" },
  { key: "reports", he: "דיווחים", en: "Reports" },
  { key: "stats", he: "סטטיסטיקות", en: "Stats" },
  { key: "users", he: "מנהלים", en: "Admins" },
  { key: "settings", he: "הגדרות", en: "Settings" },
] as const;

function label(locale: string, he: string, en: string) {
  return locale === "he" ? he : en;
}

export default function AdminPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareProject, setShareProject] = useState<MemorialProject | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (!profile?.isAdmin && !profile?.isSuperAdmin))) {
      router.push("/dashboard");
      return;
    }
    if (user && (profile?.isAdmin || profile?.isSuperAdmin)) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  async function loadProjects() {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t("actionError"));
        return;
      }
      setProjects(data.projects || []);
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

        {profile?.isSuperAdmin && <SuperAdminPortal locale={locale} />}

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
                    <a href={`/${locale}/memorial/${project.slug}`} target="_blank" rel="noopener">
                      <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                    </a>
                    <Button variant="ghost" size="icon" title="Share" onClick={() => setShareProject(project)}>
                      <Share2 className="h-4 w-4 text-navy/60" />
                    </Button>
                    <a href={`/admin/projects/${project.id}/edit`}>
                      <Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4 text-navy/60" /></Button>
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
                  {label(locale, "הקישור תקין, אבל מי שפותח אותו יצטרך את סיסמת הפרויקט.", "The link works, but visitors will need the project password.")}
                </p>
              )}
              <ShareTemplates
                honoree={`${shareProject.nameHebrew} ${shareProject.familyNameHebrew || ""}`.trim()}
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/memorial/${shareProject.slug}`}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

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

function formatTimestamp(ts?: number | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function SuperAdminPortal({ locale }: { locale: string }) {
  const [overview, setOverview] = useState<SuperOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState("");
  const [targetIsSuper, setTargetIsSuper] = useState(false);
  const [targetPermissions, setTargetPermissions] = useState<string[]>(["projects", "feedback", "reports", "stats"]);
  const [savingUser, setSavingUser] = useState(false);

  async function loadOverview() {
    setRefreshing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/super/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לטעון את פורטל המנהל", "Could not load super-admin portal"));
        return;
      }
      setOverview(data);
    } catch {
      toast.error(label(locale, "לא ניתן לטעון את פורטל המנהל", "Could not load super-admin portal"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePermission(permission: string) {
    setTargetPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  }

  async function updateFeedbackStatus(id: string, status: string) {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/feedback/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן משוב", "Could not update feedback"));
        return;
      }
      setOverview((prev) => prev
        ? {
            ...prev,
            recentFeedback: prev.recentFeedback.map((item) =>
              item.id === id ? { ...item, status } : item
            ),
          }
        : prev
      );
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן משוב", "Could not update feedback"));
    }
  }

  async function saveAdminUser() {
    const value = target.trim();
    if (!value) return;
    setSavingUser(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const isEmail = value.includes("@");
      const res = await fetch("/api/admin/super/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          targetEmail: isEmail ? value : undefined,
          targetUid: isEmail ? undefined : value,
          isAdmin: true,
          isSuperAdmin: targetIsSuper,
          permissions: targetPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן מנהל", "Could not update admin user"));
        return;
      }
      toast.success(label(locale, "הרשאות המנהל עודכנו", "Admin permissions updated"));
      setTarget("");
      await loadOverview();
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן מנהל", "Could not update admin user"));
    } finally {
      setSavingUser(false);
    }
  }

  const stats = overview?.stats || {};

  return (
    <Card className="mb-8 border-gold/20">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-heading text-lg font-bold text-navy">
                {label(locale, "פורטל מנהל ראשי", "Super Admin Portal")}
              </h2>
              <p className="text-xs text-muted">
                {label(locale, "סטטיסטיקות, משוב, דיווחים והרשאות מנהלים של לזכר בלבד.", "Lzecher-only stats, feedback, reports, and admin permissions.")}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadOverview} disabled={refreshing}>
            {refreshing ? <Spinner className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
            {label(locale, "רענן", "Refresh")}
          </Button>
        </div>

        {loading && !overview ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <Tabs defaultValue="stats" dir={locale === "he" ? "rtl" : "ltr"}>
            <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
              <TabsTrigger value="stats"><BarChart3 className="h-4 w-4" /> {label(locale, "נתונים", "Stats")}</TabsTrigger>
              <TabsTrigger value="feedback"><Inbox className="h-4 w-4" /> {label(locale, "משוב", "Feedback")}</TabsTrigger>
              <TabsTrigger value="admins"><UserPlus className="h-4 w-4" /> {label(locale, "מנהלים", "Admins")}</TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [label(locale, "פרויקטים", "Projects"), stats.totalProjects],
                  [label(locale, "פעילים", "Active"), stats.activeProjects],
                  [label(locale, "עם סיסמה", "Password protected"), stats.protectedProjects],
                  [label(locale, "פתוחים", "Open links"), stats.openProjects],
                  [label(locale, "בחירות לימוד", "Claims"), stats.totalClaims],
                  [label(locale, "נלמדו", "Learned"), stats.completedClaims],
                  [label(locale, "משוב חדש", "New feedback"), stats.newFeedback],
                  [label(locale, "דיווחים פתוחים", "Open reports"), stats.openReports],
                ].map(([name, value]) => (
                  <div key={String(name)} className="rounded-lg border border-navy/10 bg-cream/40 p-3">
                    <p className="text-xs text-muted">{name}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="feedback">
              <div className="space-y-2">
                {overview?.recentFeedback.length ? overview.recentFeedback.map((item) => (
                  <div key={item.id} className="rounded-lg border border-navy/10 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.status === "new" ? "default" : "secondary"}>{item.status}</Badge>
                        <span className="text-xs text-muted">{item.type} · {formatTimestamp(item.submittedAt)}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "read")}>{label(locale, "נקרא", "Read")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "open")}>{label(locale, "לטיפול", "Open")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "archived")}>{label(locale, "ארכיון", "Archive")}</Button>
                      </div>
                    </div>
                    <p className="text-sm text-navy" dir={item.locale === "he" ? "rtl" : "ltr"}>{item.message}</p>
                    <p className="mt-2 text-xs text-muted">
                      {item.email || label(locale, "ללא אימייל", "No email")}
                      {item.currentPath ? ` · ${item.currentPath}` : ""}
                    </p>
                  </div>
                )) : (
                  <p className="py-6 text-center text-sm text-muted">{label(locale, "אין משוב עדיין", "No feedback yet")}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="admins">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                <div className="space-y-2">
                  {overview?.adminUsers.map((admin) => (
                    <div key={admin.uid} className="rounded-lg border border-navy/10 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-navy">{admin.email || admin.uid}</p>
                          <p className="text-xs text-muted">{admin.displayName || admin.uid}</p>
                        </div>
                        <div className="flex gap-1">
                          {admin.isSuperAdmin && <Badge variant="default">{label(locale, "מנהל ראשי", "Super")}</Badge>}
                          {admin.isAdmin && <Badge variant="secondary">{label(locale, "מנהל", "Admin")}</Badge>}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {admin.permissions.length
                          ? admin.permissions.join(", ")
                          : label(locale, "אין הרשאות מפורשות", "No explicit permissions")}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-gold/20 bg-cream/40 p-3">
                  <h3 className="mb-3 font-heading font-bold text-navy">{label(locale, "הוספת / עדכון מנהל", "Add / Update Admin")}</h3>
                  <Input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={label(locale, "אימייל או UID", "Email or UID")}
                    className="mb-3"
                  />
                  <label className="mb-3 flex items-center justify-between gap-3 text-sm text-navy">
                    <span>{label(locale, "מנהל ראשי", "Super admin")}</span>
                    <Switch checked={targetIsSuper} onCheckedChange={setTargetIsSuper} />
                  </label>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {PERMISSIONS.map((permission) => (
                      <button
                        key={permission.key}
                        type="button"
                        onClick={() => togglePermission(permission.key)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-medium",
                          targetPermissions.includes(permission.key)
                            ? "border-gold bg-gold/10 text-navy"
                            : "border-navy/10 bg-white text-muted"
                        )}
                      >
                        {locale === "he" ? permission.he : permission.en}
                      </button>
                    ))}
                  </div>
                  <Button className="w-full" onClick={saveAdminUser} disabled={!target.trim() || savingUser}>
                    {savingUser ? <Spinner className="h-4 w-4" /> : label(locale, "שמור הרשאות", "Save Permissions")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
