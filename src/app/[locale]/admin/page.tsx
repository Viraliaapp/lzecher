"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Link, useRouter } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Eye, EyeOff, Trash2, Search, AlertTriangle, Pencil, Share2, Inbox, UserPlus, BarChart3, RotateCw, Wrench, History, CheckCircle2, Lock, Unlock, ClipboardList, Mail, Settings, Megaphone, ShieldCheck } from "lucide-react";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject } from "@/lib/types";
import type { SiteSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";
import { MASECHTOS } from "@/lib/seed-data";
import { TRACK_CONFIGS } from "@/lib/track-config";

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

type SuperProjectSummary = {
  id: string;
  slug: string | null;
  nameHebrew: string;
  familyNameHebrew: string;
  nameEnglish: string;
  familyNameEnglish: string;
  createdBy: string | null;
  createdByEmail: string | null;
  createdAt: number;
  updatedAt: number;
  status: string;
  tracks: string[];
  isPasswordProtected: boolean;
  showLeaderboard: boolean;
  allowAnonymous: boolean;
  isPublic?: boolean;
  locked: boolean;
  repeatingSetEnabled?: boolean;
  startedByVisible?: boolean;
  announcement?: string | null;
  customDedication?: string | null;
  totalPortions: number;
  claimedPortions: number;
  completedPortions: number;
  participantCount: number;
  progressPct: number;
  completedProgressPct: number;
  completedCycles: number;
  reportsCount: number;
  topMatmidim: { name: string; count: number }[];
  issues: string[];
};

type SuperHealthCheck = {
  key: string;
  status: "pass" | "warn" | "fail";
  label: string;
  detail: string;
  count?: number;
};

type SuperClaim = {
  id: string;
  projectId: string | null;
  userName: string;
  userEmail: string | null;
  trackType: string | null;
  reference: string | null;
  status: string;
  claimedAt: number;
  completedAt?: number | null;
};

type SuperReport = {
  id: string;
  projectId?: string | null;
  projectSlug?: string | null;
  reason: string;
  details: string | null;
  reporterEmail: string | null;
  status: string;
  reportedAt: number;
};

type SuperContactMessage = {
  id: string;
  projectId: string | null;
  slug: string | null;
  senderEmail: string | null;
  message: string;
  delivered: boolean;
  reason: string | null;
  sentAt: number;
};

type SuperAuditEntry = {
  id: string;
  action: string;
  adminUid: string | null;
  projectId: string | null;
  targetUid: string | null;
  feedbackId: string | null;
  at: number;
  details: unknown;
};

type SuperOverview = {
  stats: Record<string, number>;
  healthChecks: SuperHealthCheck[];
  projectSummaries: SuperProjectSummary[];
  recentFeedback: SuperFeedback[];
  recentClaims: SuperClaim[];
  adminUsers: AdminUserSummary[];
  recentReports: SuperReport[];
  recentContacts: SuperContactMessage[];
  recentAudit: SuperAuditEntry[];
};

type SuperProjectDetail = {
  project: SuperProjectSummary & Record<string, unknown>;
  diagnostics: { severity: "info" | "warn" | "fail"; key: string; detail: string }[];
  recomputed: Record<string, unknown>;
  trackStats: Record<string, { total: number; claimed: number; completed: number }>;
  recentClaims: SuperClaim[];
  reports: SuperReport[];
  contactMessages: SuperContactMessage[];
  feedback: SuperFeedback[];
  scheduledEmails: { id: string; status: string | null; type: string | null; scheduledFor: number | null; recipientEmail: string | null }[];
};

type AdminRole = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
};

const PERMISSIONS = [
  { key: "projects", he: "פרויקטים", en: "Projects" },
  { key: "feedback", he: "משוב", en: "Feedback" },
  { key: "reports", he: "דיווחים", en: "Reports" },
  { key: "stats", he: "סטטיסטיקות", en: "Stats" },
  { key: "users", he: "מנהלים", en: "Admins" },
  { key: "settings", he: "הגדרות", en: "Settings" },
] as const;

const SITE_FEATURES: {
  key: keyof SiteSettings["featureFlags"];
  he: string;
  en: string;
  heDesc: string;
  enDesc: string;
}[] = [
  {
    key: "feedbackWidget",
    he: "בועת משוב",
    en: "Feedback bubble",
    heDesc: "כפתור המשוב הצף בעמודי האתר.",
    enDesc: "The floating feedback button across the site.",
  },
  {
    key: "activityBubbles",
    he: "בועות פעילות",
    en: "Activity bubbles",
    heDesc: "הודעות עדינות כשמשתתפים בוחרים לימוד.",
    enDesc: "Gentle live notices when participants take learning.",
  },
  {
    key: "globalCounter",
    he: "מונה כלל ישראל",
    en: "Global counter",
    heDesc: "פס הפעילות בדף הבית עם סיכומי לימוד.",
    enDesc: "The homepage learning totals band.",
  },
  {
    key: "siteNotice",
    he: "הודעת אתר",
    en: "Site notice",
    heDesc: "פס הודעה בראש האתר לכל המבקרים.",
    enDesc: "A sitewide notice banner for visitors.",
  },
];

const EMPTY_SITE_SETTINGS: SiteSettings = {
  featureFlags: {
    feedbackWidget: true,
    activityBubbles: true,
    globalCounter: true,
    siteNotice: false,
  },
  announcement: {
    tone: "info",
    he: "",
    en: "",
    es: "",
    fr: "",
  },
  updatedAt: null,
  updatedBy: null,
};

const PROJECT_STATUS_OPTIONS = ["active", "completed", "hidden", "archived", "pending_moderation"] as const;

const MASECHTA_HE_BY_NAME = new Map(MASECHTOS.map((masechta) => [masechta.name, masechta.nameHebrew]));

function label(locale: string, he: string, en: string) {
  return locale === "he" ? he : en;
}

export default function AdminPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<MemorialProject[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
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
      if (data.adminRole) setAdminRole(data.adminRole);
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
  const isSuperAdmin = Boolean(profile?.isSuperAdmin || adminRole?.isSuperAdmin);

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
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-gold" />
          <h1 className="font-heading text-2xl font-bold text-navy">{t("dashTitle")}</h1>
          <Badge variant="secondary">{projects.length}</Badge>
        </div>

        {isSuperAdmin && <SuperAdminPortal locale={locale} />}

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
                      {projectStatusLabel(locale, project.status)}
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
                    <Link href={`/admin/projects/${project.id}/edit` as never}>
                      <Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4 text-navy/60" /></Button>
                    </Link>
                    {project.status === "active" ? (
                      <Button variant="ghost" size="icon" onClick={() => { setActionId(project.id); setHideDialogOpen(true); }}>
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    ) : project.status === "hidden" ? (
                      <Button variant="ghost" size="icon" onClick={() => handleAction("unhide", project.id)}>
                        <Eye className="h-4 w-4 text-gold" />
                      </Button>
                    ) : null}
                    {isSuperAdmin && (
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

function reportStatusLabel(locale: string, status: string) {
  const he: Record<string, string> = {
    open: "פתוח",
    reviewing: "בטיפול",
    resolved: "טופל",
    dismissed: "נסגר",
  };
  const en: Record<string, string> = {
    open: "Open",
    reviewing: "Reviewing",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function projectStatusLabel(locale: string, status: string) {
  const he: Record<string, string> = {
    active: "פעיל",
    hidden: "מוסתר",
    archived: "בארכיון",
    deleted: "נמחק",
  };
  const en: Record<string, string> = {
    active: "Active",
    hidden: "Hidden",
    archived: "Archived",
    deleted: "Deleted",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function feedbackStatusLabel(locale: string, status: string) {
  const he: Record<string, string> = {
    new: "חדש",
    read: "נקרא",
    open: "לטיפול",
    archived: "בארכיון",
  };
  const en: Record<string, string> = {
    new: "New",
    read: "Read",
    open: "Open",
    archived: "Archived",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function learningLabel(locale: string, reference?: string | null, trackType?: string | null) {
  const fallback = reference || trackType || "";
  if (locale !== "he") return fallback;
  if (reference) {
    const match = reference.match(/^(.+?)\s+(\d+(?::\d+)?)$/);
    if (match) {
      const [, name, number] = match;
      const hebrewName = MASECHTA_HE_BY_NAME.get(name);
      if (hebrewName) return `${hebrewName} ${number}`;
    }
    if (reference.startsWith("Tehillim ")) return reference.replace("Tehillim", "תהלים");
    if (reference.startsWith("Psalm ")) return reference.replace("Psalm", "תהלים");
  }
  const track = trackType ? TRACK_CONFIGS[trackType as keyof typeof TRACK_CONFIGS] : null;
  return track?.label.he || fallback;
}

function healthCheckCopy(locale: string, check: SuperHealthCheck, stats: Record<string, number>) {
  if (locale !== "he") return { title: check.label, detail: check.detail };
  if (check.key === "firebase_scope") {
    return {
      title: "גבולות Firebase של לזכר",
      detail: "הפורטל הזה קורא וכותב רק לאוספים שמתחילים ב-lzecher_.",
    };
  }
  if (check.key === "project_integrity") {
    const count = Number(check.count || stats.projectsWithIssues || 0);
    return {
      title: "תקינות נתוני הפרויקטים",
      detail: count ? `${count} פרויקט(ים) דורשים בדיקה.` : "לא נמצאו בעיות בסיכומי הפרויקטים.",
    };
  }
  if (check.key === "support_queue") {
    const feedback = Number(stats.newFeedback || 0);
    const reports = Number(stats.openReports || 0);
    const contacts = Number(stats.undeliveredContacts || 0);
    const feedbackText = feedback === 1 ? "משוב חדש אחד" : `${feedback} משובים חדשים`;
    const reportsText = reports === 1 ? "דיווח פתוח אחד" : `${reports} דיווחים פתוחים`;
    const contactsText = contacts === 1 ? "הודעת משפחה אחת שלא נשלחה" : `${contacts} הודעות משפחה שלא נשלחו`;
    return {
      title: "תור תמיכה",
      detail: `${feedbackText}, ${reportsText}, ${contactsText}.`,
    };
  }
  if (check.key === "site_controls") {
    const count = Number(check.count || stats.enabledFeatureFlags || 0);
    return {
      title: "בקרת האתר הציבורי",
      detail: `${count} מתגי אתר פעילים מתוך מסמך lzecher_settings/site.`,
    };
  }
  return { title: check.label, detail: check.detail };
}

function projectIssueCopy(locale: string, issue: string) {
  const he: Record<string, string> = {
    missing_slug: "חסר קישור",
    missing_creator_uid: "חסר יוצר",
    missing_creator: "חסר יוצר",
    no_tracks: "אין מסלולי לימוד",
    no_portions: "אין חלקים",
    claimed_gt_total: "נלקחו יותר מהסך",
    completed_gt_claimed: "נלמדו יותר ממה שנלקח",
    password_hash_salt_mismatch: "הגדרת סיסמה לא תקינה",
    password_mismatch: "הגדרת סיסמה לא תקינה",
    total_portions_drift: "סך החלקים לא תואם",
    claimed_portions_drift: "מספר הבחירות לא תואם",
    completed_portions_drift: "מספר הנלמדים לא תואם",
    participant_drift: "מספר המשתתפים לא תואם",
    reports_count_drift: "מספר הדיווחים לא תואם",
    open_reports: "דיווחים פתוחים",
  };
  const en: Record<string, string> = {
    missing_slug: "Missing link",
    missing_creator_uid: "Missing creator",
    missing_creator: "Missing creator",
    no_tracks: "No learning tracks",
    no_portions: "No portions",
    claimed_gt_total: "Taken exceeds total",
    completed_gt_claimed: "Learned exceeds taken",
    password_hash_salt_mismatch: "Password setup mismatch",
    password_mismatch: "Password setup mismatch",
    total_portions_drift: "Total portions drift",
    claimed_portions_drift: "Taken count drift",
    completed_portions_drift: "Learned count drift",
    participant_drift: "Participant count drift",
    reports_count_drift: "Report count drift",
    open_reports: "Open reports",
  };
  return locale === "he" ? he[issue] || issue : en[issue] || issue;
}

function projectIssueSeverity(issue: string) {
  if (["missing_slug", "no_tracks", "no_portions", "claimed_gt_total", "completed_gt_claimed", "password_hash_salt_mismatch", "password_mismatch"].includes(issue)) {
    return "fail";
  }
  if (issue.endsWith("_drift") || issue === "open_reports" || issue === "missing_creator_uid" || issue === "missing_creator") {
    return "warn";
  }
  return "info";
}

function SuperAdminPortal({ locale }: { locale: string }) {
  const [overview, setOverview] = useState<SuperOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [superTab, setSuperTab] = useState("stats");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<SuperProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [recomputingProject, setRecomputingProject] = useState(false);
  const [savingProjectControls, setSavingProjectControls] = useState(false);
  const [projectAnnouncement, setProjectAnnouncement] = useState("");
  const [projectDedication, setProjectDedication] = useState("");
  const [target, setTarget] = useState("");
  const [targetIsAdmin, setTargetIsAdmin] = useState(true);
  const [targetIsSuper, setTargetIsSuper] = useState(false);
  const [targetPermissions, setTargetPermissions] = useState<string[]>(["projects", "feedback", "reports", "stats"]);
  const [savingUser, setSavingUser] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(EMPTY_SITE_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

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
      if (!selectedProjectId && Array.isArray(data.projectSummaries) && data.projectSummaries[0]) {
        setSelectedProjectId(data.projectSummaries[0].id);
      }
    } catch {
      toast.error(label(locale, "לא ניתן לטעון את פורטל המנהל", "Could not load super-admin portal"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadSiteSettings() {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/super/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לטעון הגדרות", "Could not load settings"));
        return;
      }
      setSiteSettings({ ...EMPTY_SITE_SETTINGS, ...(data.settings || {}) });
    } catch {
      toast.error(label(locale, "לא ניתן לטעון הגדרות", "Could not load settings"));
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void loadOverview();
      void loadSiteSettings();
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProjectDetail(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  function togglePermission(permission: string) {
    setTargetPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  }

  async function loadProjectDetail(projectId: string) {
    setSelectedProjectId(projectId);
    setLoadingProject(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לטעון פרויקט", "Could not load project"));
        return;
      }
      setProjectDetail(data);
      setProjectAnnouncement(typeof data.project?.announcement === "string" ? data.project.announcement : "");
      setProjectDedication(typeof data.project?.customDedication === "string" ? data.project.customDedication : "");
    } catch {
      toast.error(label(locale, "לא ניתן לטעון פרויקט", "Could not load project"));
    } finally {
      setLoadingProject(false);
    }
  }

  function inspectProject(projectId: string) {
    setSuperTab("projects");
    if (projectId === selectedProjectId) {
      void loadProjectDetail(projectId);
      return;
    }
    setSelectedProjectId(projectId);
  }

  async function recomputeProject(projectId: string) {
    setSelectedProjectId(projectId);
    setRecomputingProject(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/projects/${projectId}/recompute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmProjectId: projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לחשב מחדש", "Could not recompute"));
        return;
      }
      toast.success(label(locale, "נתוני הפרויקט חושבו מחדש", "Project stats recomputed"));
      await Promise.all([loadOverview(), loadProjectDetail(projectId)]);
      setSuperTab("projects");
    } catch {
      toast.error(label(locale, "לא ניתן לחשב מחדש", "Could not recompute"));
    } finally {
      setRecomputingProject(false);
    }
  }

  async function recomputeSelectedProject() {
    if (!selectedProjectId) return;
    await recomputeProject(selectedProjectId);
  }

  async function updateProjectControls(updates: Record<string, unknown>) {
    if (!selectedProjectId) return;
    setSavingProjectControls(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/projects/${selectedProjectId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmProjectId: selectedProjectId, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן בקרת פרויקט", "Could not update project controls"));
        return;
      }
      if (data.noChanges) {
        toast.message(label(locale, "לא היו שינויים לשמור", "No changes to save"));
        return;
      }
      toast.success(label(locale, "בקרת הפרויקט עודכנה", "Project controls updated"));
      await Promise.all([loadOverview(), loadProjectDetail(selectedProjectId)]);
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן בקרת פרויקט", "Could not update project controls"));
    } finally {
      setSavingProjectControls(false);
    }
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

  async function updateReportStatus(id: string, status: string) {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/reports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן דיווח", "Could not update report"));
        return;
      }
      setOverview((prev) => prev
        ? {
            ...prev,
            recentReports: prev.recentReports.map((item) =>
              item.id === id ? { ...item, status } : item
            ),
          }
        : prev
      );
      setProjectDetail((prev) => prev
        ? {
            ...prev,
            reports: prev.reports.map((item) =>
              item.id === id ? { ...item, status } : item
            ),
          }
        : prev
      );
      toast.success(label(locale, "הדיווח עודכן", "Report updated"));
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן דיווח", "Could not update report"));
    }
  }

  async function saveAdminUser() {
    const value = target.trim();
    if (!value) return;
    setSavingUser(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const isEmail = value.includes("@");
      const nextIsAdmin = targetIsSuper || targetIsAdmin;
      const res = await fetch("/api/admin/super/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          targetEmail: isEmail ? value : undefined,
          targetUid: isEmail ? undefined : value,
          isAdmin: nextIsAdmin,
          isSuperAdmin: targetIsSuper,
          permissions: nextIsAdmin ? targetPermissions : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן מנהל", "Could not update admin user"));
        return;
      }
      toast.success(label(locale, "הרשאות המנהל עודכנו", "Admin permissions updated"));
      setTarget("");
      setTargetIsAdmin(true);
      setTargetIsSuper(false);
      await loadOverview();
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן מנהל", "Could not update admin user"));
    } finally {
      setSavingUser(false);
    }
  }

  function updateFeatureFlag(key: keyof SiteSettings["featureFlags"], value: boolean) {
    setSiteSettings((prev) => ({
      ...prev,
      featureFlags: { ...prev.featureFlags, [key]: value },
    }));
  }

  function updateAnnouncement<K extends keyof SiteSettings["announcement"]>(key: K, value: SiteSettings["announcement"][K]) {
    setSiteSettings((prev) => ({
      ...prev,
      announcement: { ...prev.announcement, [key]: value },
    }));
  }

  async function saveSiteSettings() {
    setSavingSettings(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/super/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, settings: siteSettings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לשמור הגדרות", "Could not save settings"));
        return;
      }
      setSiteSettings({ ...EMPTY_SITE_SETTINGS, ...(data.settings || {}) });
      toast.success(label(locale, "הגדרות האתר נשמרו", "Site settings saved"));
      await loadOverview();
    } catch {
      toast.error(label(locale, "לא ניתן לשמור הגדרות", "Could not save settings"));
    } finally {
      setSavingSettings(false);
    }
  }

  const stats = overview?.stats || {};
  const projectSummaries = overview?.projectSummaries || [];
  const projectsWithIssues = projectSummaries
    .filter((project) => project.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length || Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const issueCounts = projectsWithIssues.reduce<Record<string, number>>((acc, project) => {
    for (const issue of project.issues) acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {});
  const failIssueCount = projectsWithIssues.reduce(
    (count, project) => count + project.issues.filter((issue) => projectIssueSeverity(issue) === "fail").length,
    0
  );
  const warningIssueCount = projectsWithIssues.reduce(
    (count, project) => count + project.issues.filter((issue) => projectIssueSeverity(issue) === "warn").length,
    0
  );
  const filteredProjects = projectSummaries.filter((project) => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      project.nameHebrew,
      project.familyNameHebrew,
      project.nameEnglish,
      project.familyNameEnglish,
      project.slug || "",
      project.createdByEmail || "",
      project.id,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const selectedProject = projectSummaries.find((project) => project.id === selectedProjectId) || filteredProjects[0] || null;

  return (
    <Card className="mb-8 overflow-hidden border-gold/30 shadow-md">
      <CardContent className="p-0">
        <div className="bg-navy px-4 py-4 text-cream sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15">
                <ShieldCheck className="h-5 w-5 text-gold" />
              </span>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="default">{label(locale, "מנהל ראשי פעיל", "Super admin active")}</Badge>
                  <Badge variant="secondary">lzecher_ only</Badge>
                </div>
                <h2 className="font-heading text-xl font-bold">
                  {label(locale, "חדר בקרה של לזכר", "Lzecher Command Center")}
                </h2>
                <p className="text-xs text-cream/70">
                  {label(locale, "כל פעולה רגישה מוגבלת לאוספי לזכר ונרשמת ביומן ביקורת.", "Sensitive actions are limited to Lzecher collections and written to the audit log.")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void loadOverview(); void loadSiteSettings(); }} disabled={refreshing} className="border-cream/25 bg-transparent text-cream hover:bg-cream/10">
              {refreshing ? <Spinner className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
              {label(locale, "רענן", "Refresh")}
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
        {loading && !overview ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <Tabs value={superTab} onValueChange={setSuperTab} dir={locale === "he" ? "rtl" : "ltr"}>
            <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
              <TabsTrigger value="stats"><BarChart3 className="h-4 w-4" /> {label(locale, "נתונים", "Stats")}</TabsTrigger>
              <TabsTrigger value="projects"><ClipboardList className="h-4 w-4" /> {label(locale, "פרויקטים", "Projects")}</TabsTrigger>
              <TabsTrigger value="support"><Inbox className="h-4 w-4" /> {label(locale, "תמיכה", "Support")}</TabsTrigger>
              <TabsTrigger value="integrity"><ShieldCheck className="h-4 w-4" /> {label(locale, "תקינות", "Integrity")}</TabsTrigger>
              <TabsTrigger value="health"><Wrench className="h-4 w-4" /> {label(locale, "בדיקות", "Health")}</TabsTrigger>
              <TabsTrigger value="audit"><History className="h-4 w-4" /> {label(locale, "יומן", "Audit")}</TabsTrigger>
              <TabsTrigger value="control"><Settings className="h-4 w-4" /> {label(locale, "בקרה", "Control")}</TabsTrigger>
              <TabsTrigger value="admins"><UserPlus className="h-4 w-4" /> {label(locale, "מנהלים", "Admins")}</TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [label(locale, "פרויקטים", "Projects"), stats.totalProjects],
                  [label(locale, "פעילים", "Active"), stats.activeProjects],
                  [label(locale, "עם סיסמה", "Password protected"), stats.protectedProjects],
                  [label(locale, "פתוחים", "Open links"), stats.openProjects],
                  [label(locale, "נוצרו היום", "Created today"), stats.projectsToday],
                  [label(locale, "נוצרו השבוע", "Created this week"), stats.projectsThisWeek],
                  [label(locale, "בחירות לימוד", "Claims"), stats.totalClaims],
                  [label(locale, "בחירות השבוע", "Claims this week"), stats.claimsThisWeek],
                  [label(locale, "נלמדו", "Learned"), stats.completedClaims],
                  [label(locale, "נלמדו השבוע", "Learned this week"), stats.completedThisWeek],
                  [label(locale, "משוב חדש", "New feedback"), stats.newFeedback],
                  [label(locale, "דיווחים פתוחים", "Open reports"), stats.openReports],
                  [label(locale, "בעיות לבדיקה", "Diagnostics"), stats.projectsWithIssues],
                  [label(locale, "הודעות שלא נשלחו", "Undelivered contacts"), stats.undeliveredContacts],
                ].map(([name, value]) => (
                  <div key={String(name)} className="rounded-lg border border-navy/10 bg-cream/40 p-3">
                    <p className="text-xs text-muted">{name}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "פעילות אחרונה", "Recent learning activity")}</h3>
                  <div className="space-y-2">
                    {(overview?.recentClaims || []).slice(0, 8).map((claim) => (
                      <div key={claim.id} className="flex items-center justify-between gap-3 rounded-md bg-cream/40 px-2 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-navy">{claim.userName || label(locale, "אנונימי", "Anonymous")} · {learningLabel(locale, claim.reference, claim.trackType)}</span>
                        <span className="shrink-0 text-muted">{formatTimestamp(claim.claimedAt)}</span>
                      </div>
                    ))}
                    {!overview?.recentClaims.length && <p className="py-4 text-center text-sm text-muted">{label(locale, "אין פעילות עדיין", "No activity yet")}</p>}
                  </div>
                </div>
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "בדיקות מערכת", "System checks")}</h3>
                  <div className="space-y-2">
                    {(overview?.healthChecks || []).map((check) => {
                      const copy = healthCheckCopy(locale, check, stats);
                      return (
                        <div key={check.key} className="flex items-start gap-2 rounded-md bg-cream/40 px-2 py-2">
                          {check.status === "pass" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-gold" />}
                          <div>
                            <p className="text-sm font-medium text-navy">{copy.title}</p>
                            <p className="text-xs text-muted">{copy.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="projects">
              <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder={label(locale, "חיפוש פרויקט", "Search projects")} className="pl-9" />
                  </div>
                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-start transition",
                          selectedProjectId === project.id ? "border-gold bg-gold/10" : "border-navy/10 bg-cream/30 hover:border-gold/30"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate font-medium text-navy" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</p>
                          {project.issues.length ? <Badge variant="destructive">{project.issues.length}</Badge> : <Badge variant="secondary">{label(locale, "תקין", "OK")}</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted">
                          <span>{projectStatusLabel(locale, project.status)}</span>
                          <span>·</span>
                          <span>{project.claimedPortions}/{project.totalPortions}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">{project.isPasswordProtected ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}{project.isPasswordProtected ? label(locale, "סיסמה", "Password") : label(locale, "פתוח", "Open")}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-navy/10 bg-white p-4">
                  {loadingProject ? (
                    <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
                  ) : selectedProject ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-heading text-xl font-bold text-navy" dir="rtl">{selectedProject.nameHebrew} {selectedProject.familyNameHebrew}</h3>
                          <p className="text-xs text-muted">{selectedProject.slug} · {selectedProject.createdByEmail || selectedProject.createdBy}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.slug && (
                            <a href={`/${locale}/memorial/${selectedProject.slug}`} target="_blank" rel="noopener">
                              <Button size="sm" variant="ghost"><Eye className="h-4 w-4" />{label(locale, "פתח", "Open")}</Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" onClick={recomputeSelectedProject} disabled={recomputingProject}>
                            {recomputingProject ? <Spinner className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                            {label(locale, "חשב מחדש", "Recompute")}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          [label(locale, "חלקים", "Portions"), selectedProject.totalPortions],
                          [label(locale, "נלקחו", "Taken"), selectedProject.claimedPortions],
                          [label(locale, "נלמדו", "Learned"), selectedProject.completedPortions],
                          [label(locale, "משתתפים", "Participants"), selectedProject.participantCount],
                        ].map(([name, value]) => (
                          <div key={String(name)} className="rounded-lg bg-cream/40 p-3">
                            <p className="text-xs text-muted">{name}</p>
                            <p className="font-heading text-xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-gold/20 bg-cream/30 p-3">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="font-medium text-navy">{label(locale, "בקרת פרויקט", "Project controls")}</h4>
                            <p className="text-xs text-muted">
                              {label(locale, "שינויים כאן נוגעים רק לפרויקט הזה ונרשמים ביומן ביקורת.", "Changes here affect only this project and are written to the audit log.")}
                            </p>
                          </div>
                          {savingProjectControls && <Spinner className="h-4 w-4" />}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">{label(locale, "סטטוס", "Status")}</label>
                            <Select
                              value={String(projectDetail?.project?.status || selectedProject.status || "active")}
                              onValueChange={(value) => updateProjectControls({ status: value })}
                              disabled={savingProjectControls}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROJECT_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {projectStatusLabel(locale, status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                              {
                                key: "isPublic",
                                value: (projectDetail?.project?.isPublic ?? selectedProject.isPublic ?? true) !== false,
                                he: "מופיע בספרייה",
                                en: "Directory listing",
                              },
                              {
                                key: "allowAnonymous",
                                value: (projectDetail?.project?.allowAnonymous ?? selectedProject.allowAnonymous) !== false,
                                he: "אפשר אנונימי",
                                en: "Allow anonymous",
                              },
                              {
                                key: "showLeaderboard",
                                value: (projectDetail?.project?.showLeaderboard ?? selectedProject.showLeaderboard) !== false,
                                he: "הצג יישר כח",
                                en: "Show Yasher Koach",
                              },
                              {
                                key: "locked",
                                value: (projectDetail?.project?.locked ?? selectedProject.locked) === true,
                                he: "נעול לבחירות חדשות",
                                en: "Lock new claims",
                              },
                              {
                                key: "repeatingSetEnabled",
                                value: (projectDetail?.project?.repeatingSetEnabled ?? selectedProject.repeatingSetEnabled ?? true) !== false,
                                he: "פתח מחזור נוסף",
                                en: "Open bonus rounds",
                              },
                              {
                                key: "startedByVisible",
                                value: (projectDetail?.project?.startedByVisible ?? selectedProject.startedByVisible ?? true) !== false,
                                he: "הצג הוקם על ידי",
                                en: "Show started by",
                              },
                            ].map((control) => (
                              <label key={control.key} className="flex items-center justify-between gap-3 rounded-lg border border-navy/10 bg-white px-3 py-2 text-sm text-navy">
                                <span>{label(locale, control.he, control.en)}</span>
                                <Switch
                                  checked={control.value}
                                  disabled={savingProjectControls}
                                  onCheckedChange={(checked) => updateProjectControls({ [control.key]: checked })}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          <Textarea
                            value={projectAnnouncement}
                            onChange={(e) => setProjectAnnouncement(e.target.value)}
                            placeholder={label(locale, "הודעה מוצמדת בדף ההנצחה", "Pinned announcement on the memorial page")}
                            rows={2}
                            dir={locale === "he" ? "rtl" : "ltr"}
                          />
                          <Textarea
                            value={projectDedication}
                            onChange={(e) => setProjectDedication(e.target.value)}
                            placeholder={label(locale, "הקדשה מותאמת בראש הדף", "Custom dedication at the top of the page")}
                            rows={2}
                            dir={locale === "he" ? "rtl" : "ltr"}
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateProjectControls({ announcement: projectAnnouncement, customDedication: projectDedication })}
                            disabled={savingProjectControls}
                          >
                            {savingProjectControls ? <Spinner className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                            {label(locale, "שמור הודעות פרויקט", "Save project notes")}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-navy/10 p-3">
                          <h4 className="mb-2 font-medium text-navy">{label(locale, "אבחון", "Diagnostics")}</h4>
                          <div className="space-y-2">
                            {(projectDetail?.diagnostics || []).length ? projectDetail?.diagnostics.map((issue) => (
                              <div key={issue.key} className="flex gap-2 rounded-md bg-gold/10 p-2 text-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                                <span className="text-navy">{issue.detail}</span>
                              </div>
                            )) : (
                              <div className="flex gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                {label(locale, "לא נמצאו בעיות בפרויקט הזה.", "No issues found for this project.")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-navy/10 p-3">
                          <h4 className="mb-2 font-medium text-navy">{label(locale, "לפי תחום לימוד", "By learning track")}</h4>
                          <div className="space-y-1.5">
                            {Object.entries(projectDetail?.trackStats || {}).map(([track, stat]) => (
                              <div key={track} className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-1.5 text-sm">
                                <span className="text-navy">{learningLabel(locale, null, track)}</span>
                                <span className="text-muted">{stat.claimed}/{stat.total} · {stat.completed} {label(locale, "נלמדו", "learned")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-navy/10 p-3">
                          <h4 className="mb-2 font-medium text-navy">{label(locale, "בחירות אחרונות", "Recent claims")}</h4>
                          <div className="space-y-1.5">
                            {(projectDetail?.recentClaims || []).slice(0, 8).map((claim) => (
                              <div key={claim.id} className="rounded-md bg-cream/40 px-2 py-1.5 text-xs text-navy">
                                <span className="font-medium">{claim.userName || label(locale, "אנונימי", "Anonymous")}</span> · {learningLabel(locale, claim.reference, claim.trackType)} · {formatTimestamp(claim.claimedAt)}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-navy/10 p-3">
                          <h4 className="mb-2 font-medium text-navy">{label(locale, "דיווחים והודעות", "Reports and messages")}</h4>
                          <div className="space-y-1.5 text-xs">
                            {(projectDetail?.reports || []).slice(0, 4).map((report) => (
                              <div key={report.id} className="rounded-md bg-red-50 px-2 py-1.5 text-red-800">
                                {report.reason} · {reportStatusLabel(locale, report.status)} · {report.details || ""}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "reviewing")}>{label(locale, "בטיפול", "Review")}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "resolved")}>{label(locale, "טופל", "Resolve")}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")}>{label(locale, "סגור", "Dismiss")}</Button>
                                </div>
                              </div>
                            ))}
                            {(projectDetail?.contactMessages || []).slice(0, 4).map((message) => (
                              <div key={message.id} className="rounded-md bg-cream/40 px-2 py-1.5 text-navy">{message.delivered ? label(locale, "נשלח", "sent") : label(locale, "לא נשלח", "not sent")} · {message.senderEmail || label(locale, "ללא אימייל", "No email")}</div>
                            ))}
                            {!projectDetail?.reports.length && !projectDetail?.contactMessages.length && <p className="py-2 text-muted">{label(locale, "אין דיווחים או הודעות.", "No reports or messages.")}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-muted">{label(locale, "אין פרויקטים להצגה", "No projects to show")}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="support">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><Inbox className="mr-1 inline h-4 w-4" /> {label(locale, "משוב", "Feedback")}</h3>
                  {overview?.recentFeedback.length ? overview.recentFeedback.map((item) => (
                    <div key={item.id} className="rounded-lg border border-navy/10 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === "new" ? "default" : "secondary"}>{feedbackStatusLabel(locale, item.status)}</Badge>
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
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><AlertTriangle className="mr-1 inline h-4 w-4" /> {label(locale, "דיווחים", "Reports")}</h3>
                  {(overview?.recentReports || []).length ? overview?.recentReports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant={report.status === "open" ? "destructive" : "secondary"}>{reportStatusLabel(locale, report.status)}</Badge>
                        <span className="text-xs text-muted">{formatTimestamp(report.reportedAt)}</span>
                      </div>
                      <p className="font-medium text-navy">{report.reason}</p>
                      <p className="text-xs text-muted">{report.projectSlug || report.projectId}</p>
                      {report.details && <p className="mt-2 text-navy">{report.details}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "reviewing")}>{label(locale, "בטיפול", "Review")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "resolved")}>{label(locale, "טופל", "Resolve")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")}>{label(locale, "סגור", "Dismiss")}</Button>
                      </div>
                    </div>
                  )) : <p className="py-6 text-center text-sm text-muted">{label(locale, "אין דיווחים", "No reports")}</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><Mail className="mr-1 inline h-4 w-4" /> {label(locale, "הודעות למשפחות", "Family messages")}</h3>
                  {(overview?.recentContacts || []).length ? overview?.recentContacts.map((message) => (
                    <div key={message.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant={message.delivered ? "secondary" : "destructive"}>{message.delivered ? label(locale, "נשלח", "Sent") : label(locale, "לא נשלח", "Not sent")}</Badge>
                        <span className="text-xs text-muted">{formatTimestamp(message.sentAt)}</span>
                      </div>
                      <p className="text-xs text-muted">{message.senderEmail || label(locale, "ללא אימייל", "No email")} · {message.slug || message.projectId}</p>
                      <p className="mt-2 line-clamp-4 text-navy">{message.message}</p>
                    </div>
                  )) : <p className="py-6 text-center text-sm text-muted">{label(locale, "אין הודעות", "No messages")}</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="integrity">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-navy/10 bg-white p-3">
                      <p className="text-xs text-muted">{label(locale, "פרויקטים לבדיקה", "Projects to review")}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{projectsWithIssues.length}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">{label(locale, "חמור", "Critical")}</p>
                      <p className="font-heading text-2xl font-bold text-red-800">{failIssueCount}</p>
                    </div>
                    <div className="rounded-lg border border-gold/30 bg-gold/10 p-3">
                      <p className="text-xs text-navy/70">{label(locale, "דורש תשומת לב", "Warnings")}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{warningIssueCount}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-gold" />
                      <div>
                        <h3 className="font-heading font-bold text-navy">{label(locale, "מרכז תקינות נתונים", "Data Integrity Center")}</h3>
                        <p className="text-xs text-muted">
                          {label(locale, "הבדיקות כאן קוראות רק אוספי lzecher_ וכל תיקון נשאר ברמת פרויקט יחיד.", "These checks read only lzecher_ collections and every repair stays scoped to one project.")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {projectsWithIssues.slice(0, 20).map((project) => (
                        <div key={project.id} className="rounded-lg border border-navy/10 bg-cream/30 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-navy" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</p>
                              <p className="text-xs text-muted">{project.slug || project.id}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1">
                              <Button size="sm" variant="ghost" onClick={() => inspectProject(project.id)}>
                                <Eye className="h-4 w-4" />
                                {label(locale, "בדוק", "Inspect")}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => recomputeProject(project.id)} disabled={recomputingProject}>
                                {recomputingProject && selectedProjectId === project.id ? <Spinner className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                                {label(locale, "חשב מחדש", "Recompute")}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {project.issues.map((issue) => (
                              <Badge
                                key={`${project.id}-${issue}`}
                                variant={projectIssueSeverity(issue) === "fail" ? "destructive" : "secondary"}
                              >
                                {projectIssueCopy(locale, issue)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!projectsWithIssues.length && (
                        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                          {label(locale, "לא נמצאו בעיות תקינות בפרויקטים.", "No project integrity issues found.")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "סוגי בעיות", "Issue types")}</h3>
                    <div className="space-y-1.5">
                      {Object.entries(issueCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([issue, count]) => (
                          <div key={issue} className="flex items-center justify-between gap-3 rounded-md bg-cream/40 px-2 py-1.5 text-sm">
                            <span className="text-navy">{projectIssueCopy(locale, issue)}</span>
                            <Badge variant={projectIssueSeverity(issue) === "fail" ? "destructive" : "secondary"}>{count}</Badge>
                          </div>
                        ))}
                      {!Object.keys(issueCounts).length && (
                        <p className="py-4 text-center text-sm text-muted">{label(locale, "אין סוגי בעיות להצגה", "No issue types to show")}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-sm text-navy">
                    <p className="font-medium">{label(locale, "כללי בטיחות", "Safety rules")}</p>
                    <p className="mt-1 text-xs text-muted">
                      {label(locale, "אין כאן תיקון גורף. כל פעולה דורשת בחירת פרויקט אחד, אישור מזהה פרויקט, ורישום ביומן ביקורת.", "There is no bulk repair here. Every action requires one selected project, explicit project confirmation, and an audit entry.")}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="health">
              <div className="space-y-3">
                {(overview?.healthChecks || []).map((check) => {
                  const copy = healthCheckCopy(locale, check, stats);
                  return (
                    <div key={check.key} className="flex items-start gap-3 rounded-lg border border-navy/10 bg-white p-4">
                      {check.status === "pass" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-gold" />}
                      <div>
                        <p className="font-heading font-bold text-navy">{copy.title}</p>
                        <p className="text-sm text-muted">{copy.detail}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-sm text-navy">
                  {label(locale, "כלי התיקון בפורטל מוגבלים למסמך פרויקט אחד בכל פעם ונרשמים ביומן ביקורת.", "Repair tools are limited to one project document at a time and are recorded in the audit log.")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit">
              <div className="space-y-2">
                {(overview?.recentAudit || []).length ? overview?.recentAudit.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-navy">{entry.action}</p>
                      <span className="text-xs text-muted">{formatTimestamp(entry.at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {entry.adminUid || label(locale, "ללא מנהל", "No admin")} {entry.projectId ? `· ${entry.projectId}` : ""} {entry.targetUid ? `· ${entry.targetUid}` : ""}
                    </p>
                  </div>
                )) : (
                  <p className="py-6 text-center text-sm text-muted">{label(locale, "אין עדיין יומן ביקורת", "No audit entries yet")}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="control">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="rounded-lg border border-navy/10 bg-white p-4">
                  <div className="mb-4 flex items-start gap-2">
                    <Settings className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "מתגי אתר חיים", "Live site controls")}</h3>
                      <p className="text-xs text-muted">
                        {label(locale, "המתגים האלה משפיעים על האתר הציבורי ונשמרים רק במסמך lzecher_settings/site.", "These controls affect the public site and are stored only in lzecher_settings/site.")}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SITE_FEATURES.map((feature) => (
                      <label key={feature.key} className="flex items-start justify-between gap-3 rounded-lg border border-navy/10 bg-cream/30 p-3">
                        <span>
                          <span className="block text-sm font-medium text-navy">{locale === "he" ? feature.he : feature.en}</span>
                          <span className="mt-1 block text-xs text-muted">{locale === "he" ? feature.heDesc : feature.enDesc}</span>
                        </span>
                        <Switch
                          checked={siteSettings.featureFlags[feature.key]}
                          onCheckedChange={(checked) => updateFeatureFlag(feature.key, checked)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gold/20 bg-cream/40 p-4">
                  <div className="mb-3 flex items-start gap-2">
                    <Megaphone className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "הודעת אתר", "Site notice")}</h3>
                      <p className="text-xs text-muted">
                        {label(locale, "מופיעה בראש האתר רק כשהמתג פעיל ויש טקסט.", "Shown at the top of the site only when enabled and text is present.")}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {(["info", "warning"] as const).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => updateAnnouncement("tone", tone)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs font-medium",
                          siteSettings.announcement.tone === tone
                            ? "border-gold bg-gold/10 text-navy"
                            : "border-navy/10 bg-white text-muted"
                        )}
                      >
                        {tone === "warning" ? label(locale, "אזהרה", "Warning") : label(locale, "מידע", "Info")}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={siteSettings.announcement.he}
                      onChange={(e) => updateAnnouncement("he", e.target.value)}
                      placeholder="הודעה בעברית"
                      rows={2}
                      dir="rtl"
                    />
                    <Textarea
                      value={siteSettings.announcement.en}
                      onChange={(e) => updateAnnouncement("en", e.target.value)}
                      placeholder="English notice"
                      rows={2}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={siteSettings.announcement.es}
                        onChange={(e) => updateAnnouncement("es", e.target.value)}
                        placeholder="Aviso en español"
                      />
                      <Input
                        value={siteSettings.announcement.fr}
                        onChange={(e) => updateAnnouncement("fr", e.target.value)}
                        placeholder="Avis en français"
                      />
                    </div>
                  </div>
                  <Button className="mt-4 w-full" onClick={saveSiteSettings} disabled={savingSettings}>
                    {savingSettings ? <Spinner className="h-4 w-4" /> : label(locale, "שמור הגדרות אתר", "Save Site Settings")}
                  </Button>
                  {siteSettings.updatedAt && (
                    <p className="mt-2 text-center text-xs text-muted">
                      {label(locale, "עודכן לאחרונה", "Last updated")}: {formatTimestamp(siteSettings.updatedAt)}
                    </p>
                  )}
                </div>
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
                    <span>{label(locale, "גישת מנהל", "Admin access")}</span>
                    <Switch
                      checked={targetIsAdmin || targetIsSuper}
                      onCheckedChange={(checked) => {
                        setTargetIsAdmin(checked);
                        if (!checked) setTargetIsSuper(false);
                      }}
                    />
                  </label>
                  <label className="mb-3 flex items-center justify-between gap-3 text-sm text-navy">
                    <span>{label(locale, "מנהל ראשי", "Super admin")}</span>
                    <Switch
                      checked={targetIsSuper}
                      onCheckedChange={(checked) => {
                        setTargetIsSuper(checked);
                        if (checked) setTargetIsAdmin(true);
                      }}
                    />
                  </label>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {PERMISSIONS.map((permission) => (
                      <button
                        key={permission.key}
                        type="button"
                        disabled={!targetIsAdmin && !targetIsSuper}
                        onClick={() => togglePermission(permission.key)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-medium",
                          targetPermissions.includes(permission.key) && (targetIsAdmin || targetIsSuper)
                            ? "border-gold bg-gold/10 text-navy"
                            : "border-navy/10 bg-white text-muted",
                          !targetIsAdmin && !targetIsSuper && "cursor-not-allowed opacity-50"
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
        </div>
      </CardContent>
    </Card>
  );
}
