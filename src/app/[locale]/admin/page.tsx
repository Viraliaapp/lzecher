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
import { Shield, Eye, EyeOff, Trash2, Search, AlertTriangle, Pencil, Share2, Inbox, UserPlus, Users, BarChart3, RotateCw, Wrench, History, CheckCircle2, Lock, Unlock, ClipboardList, Mail, Settings, Megaphone, ShieldCheck, Languages, TrendingUp, Download } from "lucide-react";
import { ShareTemplates } from "@/components/memorial/ShareTemplates";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { MemorialProject } from "@/lib/types";
import type { SiteSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";
import { TRACK_CONFIGS } from "@/lib/track-config";
import { toHebrewCalendarDate } from "@/lib/hebrew-date";
import { learningLabel } from "@/lib/learning-label";
import { friendlyEmailError } from "@/lib/email-config";

type Filter = "all" | "active" | "hidden" | "reported";

type SupportPriority = "low" | "normal" | "high" | "urgent";
type SupportDraft = {
  status?: string;
  supportStatus?: string;
  priority: SupportPriority;
  tag: string;
  assignedTo: string;
  internalNote: string;
};

type SuperFeedback = {
  id: string;
  type: string;
  message: string;
  email: string | null;
  locale: string;
  currentPath: string | null;
  status: string;
  priority?: SupportPriority;
  tag?: string | null;
  assignedTo?: string | null;
  internalNote?: string | null;
  supportUpdatedAt?: number | null;
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

type UserSummary = AdminUserSummary & {
  projectCount: number;
  activeProjectCount: number;
  claimCount: number;
  completedClaimCount: number;
  lastProjectAt: number | null;
  lastClaimAt: number | null;
  lastActivityAt: number;
  projects: {
    id: string;
    slug: string | null;
    nameHebrew: string;
    familyNameHebrew: string;
    status: string;
    progressPct: number;
  }[];
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
  priority?: SupportPriority;
  tag?: string | null;
  assignedTo?: string | null;
  internalNote?: string | null;
  supportUpdatedAt?: number | null;
  reportedAt: number;
};

type SuperContactMessage = {
  id: string;
  projectId: string | null;
  slug: string | null;
  senderEmail: string | null;
  message: string;
  delivered: boolean;
  supportStatus?: string;
  priority?: SupportPriority;
  tag?: string | null;
  assignedTo?: string | null;
  internalNote?: string | null;
  supportUpdatedAt?: number | null;
  reason: string | null;
  sentAt: number;
};

type SuperScheduledEmail = {
  id: string;
  projectId: string | null;
  projectSlug: string | null;
  claimId: string | null;
  toEmail: string | null;
  userId: string | null;
  reminderType: string | null;
  locale: string;
  status: string;
  sendAt: number | null;
  createdAt: number | null;
  sentAt: number | null;
  failedAt: number | null;
  attempts: number;
  lastError: string | null;
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

type SuperSiteViews = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byLocale: Record<string, number>;
  byRoute: Record<string, number>;
  topProjects: { projectId: string; slug: string | null; name: string; views: number }[];
};

type SuperOverview = {
  stats: Record<string, number>;
  healthChecks: SuperHealthCheck[];
  projectSummaries: SuperProjectSummary[];
  recentFeedback: SuperFeedback[];
  recentClaims: SuperClaim[];
  adminUsers: AdminUserSummary[];
  userSummaries: UserSummary[];
  recentReports: SuperReport[];
  recentContacts: SuperContactMessage[];
  recentScheduledEmails: SuperScheduledEmail[];
  recentAudit: SuperAuditEntry[];
  siteViews?: SuperSiteViews;
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
  scheduledEmails: { id: string; status: string | null; type: string | null; scheduledFor: number | null; recipientEmail: string | null; attempts?: number; lastError?: string | null }[];
};

type AdminRole = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
};

type TranslationLocaleAudit = {
  locale: string;
  totalKeys: number;
  missingKeys: string[];
  emptyKeys: string[];
  forbiddenHits: { key: string; phrase: string }[];
};

type TranslationAudit = {
  generatedAt: number;
  totalKeys: number;
  forbiddenPhrases: string[];
  locales: TranslationLocaleAudit[];
  hebrewEnglishSamples: { key: string; word: string; text: string }[];
};

type SuperAnalyticsDay = {
  date: string;
  projectsCreated: number;
  claimsTaken: number;
  claimsCompleted: number;
  feedbackSubmitted: number;
  reportsSubmitted: number;
  remindersQueued: number;
  remindersSent: number;
  remindersFailed: number;
};

type SuperAnalyticsReport = {
  generatedAt: number;
  rangeDays: number;
  startAt: number;
  endAt: number;
  totals: Omit<SuperAnalyticsDay, "date">;
  daily: SuperAnalyticsDay[];
  truncated: Record<keyof Omit<SuperAnalyticsDay, "date">, boolean>;
};

const PERMISSIONS = [
  { key: "projects", he: "פרויקטים", en: "Projects" },
  { key: "feedback", he: "משוב", en: "Feedback" },
  { key: "reports", he: "דיווחים", en: "Reports" },
  { key: "stats", he: "סטטיסטיקות", en: "Stats" },
  { key: "users", he: "מנהלים", en: "Admins" },
  { key: "settings", he: "הגדרות", en: "Settings" },
] as const;

const SUPPORT_PRIORITIES: SupportPriority[] = ["low", "normal", "high", "urgent"];

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
                      {formatTimestamp(project.createdAt, locale)}
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
                preferredText={shareProject.shareMessage}
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

function formatTimestamp(ts?: number | null, locale = "en") {
  if (!ts) return "";
  try {
    if (locale === "he") return toHebrewCalendarDate(ts, locale);
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
    resolved: "טופל",
  };
  const en: Record<string, string> = {
    new: "New",
    read: "Read",
    open: "Open",
    archived: "Archived",
    resolved: "Resolved",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function feedbackTypeLabel(locale: string, type: string) {
  const he: Record<string, string> = {
    suggestion: "הצעה",
    question: "שאלה",
    bug: "תקלה",
    other: "אחר",
  };
  const en: Record<string, string> = {
    suggestion: "Suggestion",
    question: "Question",
    bug: "Bug",
    other: "Other",
  };
  return locale === "he" ? he[type] || type : en[type] || type;
}

function reportReasonLabel(locale: string, reason: string) {
  const he: Record<string, string> = {
    bug: "תקלה",
    issue: "תקלה",
    content: "תוכן",
    inappropriate: "תוכן לא מתאים",
    other: "אחר",
  };
  const en: Record<string, string> = {
    bug: "Bug",
    issue: "Issue",
    content: "Content",
    inappropriate: "Inappropriate content",
    other: "Other",
  };
  return locale === "he" ? he[reason] || reason : en[reason] || reason;
}

function supportText(locale: string, text?: string | null) {
  if (!text) return "";
  if (locale !== "he") return text;
  return text
    .replaceAll("Authentication required for inclusive commitments", "נדרשה התחברות לבחירת קבלה או התחייבות")
    .replaceAll("inclusive commitments", "קבלות והתחייבויות")
    .replaceAll("No email", "ללא אימייל")
    .replace(/\bbug\b/gi, "תקלה")
    .replace(/\bnew\b/gi, "חדש");
}

function contactSupportStatusLabel(locale: string, status: string) {
  const he: Record<string, string> = {
    new: "חדש",
    open: "לטיפול",
    resolved: "טופל",
    archived: "בארכיון",
  };
  const en: Record<string, string> = {
    new: "New",
    open: "Open",
    resolved: "Resolved",
    archived: "Archived",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function priorityLabel(locale: string, priority: string) {
  const he: Record<string, string> = {
    low: "נמוך",
    normal: "רגיל",
    high: "גבוה",
    urgent: "דחוף",
  };
  const en: Record<string, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };
  return locale === "he" ? he[priority] || priority : en[priority] || priority;
}

function reminderStatusLabel(locale: string, status: string) {
  const he: Record<string, string> = {
    pending: "ממתין",
    sent: "נשלח",
    failed: "נכשל",
    cancelled: "בוטל",
  };
  const en: Record<string, string> = {
    pending: "Pending",
    sent: "Sent",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return locale === "he" ? he[status] || status : en[status] || status;
}

function reminderTypeLabel(locale: string, type?: string | null) {
  const key = type || "unknown";
  const he: Record<string, string> = {
    confirmation: "אישור הצטרפות",
    halfway: "אמצע הדרך",
    sevenDaysBefore: "שבוע לפני",
    threeDaysBefore: "שלושה ימים לפני",
    oneDayBefore: "יום לפני",
    dailyReminder: "תזכורת יומית",
    weeklyDigest: "סיכום שבועי",
  };
  const en: Record<string, string> = {
    confirmation: "Confirmation",
    halfway: "Halfway",
    sevenDaysBefore: "Seven days before",
    threeDaysBefore: "Three days before",
    oneDayBefore: "One day before",
    dailyReminder: "Daily reminder",
    weeklyDigest: "Weekly digest",
  };
  return locale === "he" ? he[key] || key : en[key] || key;
}

function viewRouteLabel(locale: string, route: string) {
  const he: Record<string, string> = {
    home: "דף הבית",
    memorial: "דפי הנצחה",
    memorials: "ספריית הנצחות",
    create: "יצירת דף",
    halachic_guidance: "מקורות והדרכה",
    contact: "צור קשר",
    login: "כניסה",
    other: "אחר",
  };
  const en: Record<string, string> = {
    home: "Home",
    memorial: "Memorial pages",
    memorials: "Memorial directory",
    create: "Create page",
    halachic_guidance: "Halachic guidance",
    contact: "Contact",
    login: "Login",
    other: "Other",
  };
  return locale === "he" ? he[route] || route : en[route] || route;
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportRow(locale: string, fields: [he: string, en: string, value: unknown][]) {
  return Object.fromEntries(fields.map(([he, en, value]) => [label(locale, he, en), value]));
}

function yesNoLabel(locale: string, value: unknown) {
  return value ? label(locale, "כן", "Yes") : label(locale, "לא", "No");
}

function exportDate(locale: string, ts?: number | null) {
  return ts ? formatTimestamp(Number(ts), locale) : "";
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
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
  if (check.key === "reminder_queue") {
    return {
      title: "תור תזכורות באימייל",
      detail: `${Number(stats.pendingReminderEmails || 0)} ממתינות, ${Number(stats.failedReminderEmails || 0)} נכשלו, ${Number(stats.sentReminderEmails || 0)} נשלחו.`,
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
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
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
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [translationAudit, setTranslationAudit] = useState<TranslationAudit | null>(null);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState(30);
  const [analyticsReport, setAnalyticsReport] = useState<SuperAnalyticsReport | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [supportSearch, setSupportSearch] = useState("");
  const [communicationsSearch, setCommunicationsSearch] = useState("");
  const [accessSearch, setAccessSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [supportDrafts, setSupportDrafts] = useState<Record<string, SupportDraft>>({});
  const [savingSupportItem, setSavingSupportItem] = useState<string | null>(null);

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

  async function loadTranslationAudit() {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/super/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לטעון בדיקת שפה", "Could not load language QA"));
        return;
      }
      setTranslationAudit(data);
    } catch {
      toast.error(label(locale, "לא ניתן לטעון בדיקת שפה", "Could not load language QA"));
    }
  }

  async function loadAnalytics(rangeDays = analyticsRangeDays) {
    setLoadingAnalytics(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/admin/super/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, rangeDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לטעון מגמות לפי תאריך", "Could not load date-range analytics"));
        return;
      }
      setAnalyticsReport(data);
      if (typeof data.rangeDays === "number") setAnalyticsRangeDays(data.rangeDays);
    } catch {
      toast.error(label(locale, "לא ניתן לטעון מגמות לפי תאריך", "Could not load date-range analytics"));
    } finally {
      setLoadingAnalytics(false);
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void loadOverview();
      void loadSiteSettings();
      void loadTranslationAudit();
      void loadAnalytics(30);
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

  async function openProjectForSafetyReview(project: Pick<SuperProjectSummary, "id" | "slug" | "isPasswordProtected">) {
    if (!project.slug) {
      toast.error(label(locale, "לפרויקט אין קישור ציבורי", "Project has no public slug"));
      return;
    }
    setOpeningProjectId(project.id);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/admin/super/projects/${project.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לפתוח את הפרויקט", "Could not open project"));
        return;
      }
      window.open(String(data.url || `/${locale}/memorial/${project.slug}`), "_blank", "noopener");
      toast.success(project.isPasswordProtected
        ? label(locale, "נפתחה גישה מתועדת לפרויקט המוגן", "Audited access opened for protected project")
        : label(locale, "הפרויקט נפתח לבדיקה", "Project opened for review"));
      await loadOverview();
    } catch {
      toast.error(label(locale, "לא ניתן לפתוח את הפרויקט", "Could not open project"));
    } finally {
      setOpeningProjectId(null);
    }
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
    await updateSupportItem("feedback", id, { status });
  }

  async function updateReportStatus(id: string, status: string) {
    await updateSupportItem("report", id, { status });
  }

  function supportKey(kind: "feedback" | "report" | "contact", id: string) {
    return `${kind}:${id}`;
  }

  function supportDraftFromItem(item: SuperFeedback | SuperReport | SuperContactMessage): SupportDraft {
    const contact = item as SuperContactMessage;
    const statusItem = item as SuperFeedback | SuperReport;
    return {
      status: "status" in item ? statusItem.status : undefined,
      supportStatus: "supportStatus" in item ? contact.supportStatus || (contact.delivered ? "resolved" : "new") : undefined,
      priority: item.priority || "normal",
      tag: item.tag || "",
      assignedTo: item.assignedTo || "",
      internalNote: item.internalNote || "",
    };
  }

  function supportDraft(kind: "feedback" | "report" | "contact", item: SuperFeedback | SuperReport | SuperContactMessage) {
    return supportDrafts[supportKey(kind, item.id)] || supportDraftFromItem(item);
  }

  function updateSupportDraft(kind: "feedback" | "report" | "contact", id: string, updates: Partial<SupportDraft>) {
    setSupportDrafts((prev) => {
      const key = supportKey(kind, id);
      return {
        ...prev,
        [key]: {
          ...(prev[key] || { priority: "normal", tag: "", assignedTo: "", internalNote: "" }),
          ...updates,
        },
      };
    });
  }

  async function updateSupportItem(
    kind: "feedback" | "report" | "contact",
    id: string,
    updates: Partial<SupportDraft>
  ) {
    const key = supportKey(kind, id);
    setSavingSupportItem(key);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const path = kind === "feedback"
        ? `/api/admin/super/feedback/${id}`
        : kind === "report"
          ? `/api/admin/super/reports/${id}`
          : `/api/admin/super/contacts/${id}`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || label(locale, "לא ניתן לעדכן טיפול", "Could not update support item"));
        return;
      }
      const item = data.item || { id, ...updates };
      setOverview((prev) => prev
        ? {
            ...prev,
            recentFeedback: kind === "feedback"
              ? prev.recentFeedback.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.recentFeedback,
            recentReports: kind === "report"
              ? prev.recentReports.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.recentReports,
            recentContacts: kind === "contact"
              ? prev.recentContacts.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.recentContacts,
          }
        : prev
      );
      setProjectDetail((prev) => prev
        ? {
            ...prev,
            feedback: kind === "feedback"
              ? prev.feedback.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.feedback,
            reports: kind === "report"
              ? prev.reports.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.reports,
            contactMessages: kind === "contact"
              ? prev.contactMessages.map((entry) => entry.id === id ? { ...entry, ...item } : entry)
              : prev.contactMessages,
          }
        : prev
      );
      setSupportDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(label(locale, "פריט התמיכה עודכן", "Support item updated"));
    } catch {
      toast.error(label(locale, "לא ניתן לעדכן טיפול", "Could not update support item"));
    } finally {
      setSavingSupportItem(null);
    }
  }

  async function saveSupportDraft(kind: "feedback" | "report" | "contact", item: SuperFeedback | SuperReport | SuperContactMessage) {
    const draft = supportDraft(kind, item);
    const updates = kind === "contact"
      ? {
          supportStatus: draft.supportStatus,
          priority: draft.priority,
          tag: draft.tag,
          assignedTo: draft.assignedTo,
          internalNote: draft.internalNote,
        }
      : {
          status: draft.status,
          priority: draft.priority,
          tag: draft.tag,
          assignedTo: draft.assignedTo,
          internalNote: draft.internalNote,
        };
    await updateSupportItem(kind, item.id, updates);
  }

  function renderSupportControls(
    kind: "feedback" | "report" | "contact",
    item: SuperFeedback | SuperReport | SuperContactMessage
  ) {
    const draft = supportDraft(kind, item);
    const key = supportKey(kind, item.id);
    const statusOptions = kind === "report"
      ? ["open", "reviewing", "resolved", "dismissed"]
      : kind === "feedback"
        ? ["new", "read", "open", "archived"]
        : ["new", "open", "resolved", "archived"];
    const statusValue = kind === "contact" ? draft.supportStatus || "new" : draft.status || "open";
    return (
      <div className="mt-3 rounded-md border border-navy/10 bg-cream/30 p-2">
        <div className="grid gap-2">
          <Select
            value={statusValue}
            onValueChange={(value) => updateSupportDraft(kind, item.id, kind === "contact" ? { supportStatus: value } : { status: value })}
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {kind === "report"
                    ? reportStatusLabel(locale, status)
                    : kind === "feedback"
                      ? feedbackStatusLabel(locale, status)
                      : contactSupportStatusLabel(locale, status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draft.priority}
            onValueChange={(value) => updateSupportDraft(kind, item.id, { priority: value as SupportPriority })}
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORT_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priorityLabel(locale, priority)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.tag}
            onChange={(event) => updateSupportDraft(kind, item.id, { tag: event.target.value })}
            placeholder={label(locale, "תג", "Tag")}
            className="bg-white"
          />
        </div>
        <div className="mt-2 grid gap-2">
          <Input
            value={draft.assignedTo}
            onChange={(event) => updateSupportDraft(kind, item.id, { assignedTo: event.target.value })}
            placeholder={label(locale, "אחראי", "Assigned to")}
            className="bg-white"
          />
          <Textarea
            value={draft.internalNote}
            onChange={(event) => updateSupportDraft(kind, item.id, { internalNote: event.target.value })}
            placeholder={label(locale, "הערה פנימית לצוות", "Internal team note")}
            rows={2}
            className="bg-white"
            dir={locale === "he" ? "rtl" : "ltr"}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {label(locale, "נשמר רק בצד מנהלים ונרשם ביומן ביקורת.", "Saved for admins only and written to the audit log.")}
          </p>
          <Button size="sm" variant="ghost" onClick={() => saveSupportDraft(kind, item)} disabled={savingSupportItem === key}>
            {savingSupportItem === key ? <Spinner className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            {label(locale, "שמור טיפול", "Save triage")}
          </Button>
        </div>
      </div>
    );
  }

  function renderSupportMeta(kind: "feedback" | "report" | "contact", item: SuperFeedback | SuperReport | SuperContactMessage) {
    const priority = item.priority || "normal";
    const status = kind === "contact"
      ? contactSupportStatusLabel(locale, (item as SuperContactMessage).supportStatus || ((item as SuperContactMessage).delivered ? "resolved" : "new"))
      : kind === "report"
        ? reportStatusLabel(locale, (item as SuperReport).status)
        : feedbackStatusLabel(locale, (item as SuperFeedback).status);
    const priorityVariant = priority === "urgent" || priority === "high" ? "destructive" : priority === "low" ? "outline" : "secondary";
    return (
      <>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{status}</Badge>
          <Badge variant={priorityVariant}>{priorityLabel(locale, priority)}</Badge>
          {item.tag && <Badge variant="secondary">{item.tag}</Badge>}
          {item.assignedTo && (
            <Badge variant="outline">
              {label(locale, "אחראי", "Owner")}: {item.assignedTo}
            </Badge>
          )}
          {item.supportUpdatedAt && (
            <span className="text-xs text-muted">
              {label(locale, "עודכן", "Updated")}: {formatTimestamp(item.supportUpdatedAt, locale)}
            </span>
          )}
        </div>
        {item.internalNote && (
          <p className="mt-2 rounded-md bg-gold/10 p-2 text-xs text-navy" dir={locale === "he" ? "rtl" : "ltr"}>
            <span className="font-medium">{label(locale, "הערה פנימית", "Internal note")}:</span> {item.internalNote}
          </p>
        )}
      </>
    );
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
  const siteViews = overview?.siteViews || {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    byLocale: {},
    byRoute: {},
    topProjects: [],
  };
  const projectSummaries = overview?.projectSummaries || [];
  const userSummaries = overview?.userSummaries || [];
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
  const auditEntries = overview?.recentAudit || [];
  const auditActions = Array.from(new Set(auditEntries.map((entry) => entry.action))).sort();
  const translationMissingTotal = translationAudit?.locales.reduce((sum, item) => sum + item.missingKeys.length, 0) || 0;
  const translationEmptyTotal = translationAudit?.locales.reduce((sum, item) => sum + item.emptyKeys.length, 0) || 0;
  const translationForbiddenTotal = translationAudit?.locales.reduce((sum, item) => sum + item.forbiddenHits.length, 0) || 0;
  const analyticsTotals = projectSummaries.reduce(
    (acc, project) => {
      acc.totalPortions += project.totalPortions;
      acc.claimedPortions += project.claimedPortions;
      acc.completedPortions += project.completedPortions;
      acc.participants += project.participantCount;
      if (project.isPasswordProtected) acc.passwordProtected += 1;
      if (project.completedCycles > 0) acc.bonusProjects += 1;
      for (const track of project.tracks) acc.tracks[track] = (acc.tracks[track] || 0) + 1;
      return acc;
    },
    { totalPortions: 0, claimedPortions: 0, completedPortions: 0, participants: 0, passwordProtected: 0, bonusProjects: 0, tracks: {} as Record<string, number> }
  );
  const analyticsRates = {
    taken: analyticsTotals.totalPortions ? Math.round((analyticsTotals.claimedPortions / analyticsTotals.totalPortions) * 100) : 0,
    learned: analyticsTotals.totalPortions ? Math.round((analyticsTotals.completedPortions / analyticsTotals.totalPortions) * 100) : 0,
    protected: projectSummaries.length ? Math.round((analyticsTotals.passwordProtected / projectSummaries.length) * 100) : 0,
    averageParticipants: projectSummaries.length ? Math.round(analyticsTotals.participants / projectSummaries.length) : 0,
  };
  const analyticsDaily = analyticsReport?.daily || [];
  const analyticsRangeTotals = analyticsReport?.totals;
  const maxDailyRangeActivity = Math.max(
    1,
    ...analyticsDaily.map((day) =>
      day.projectsCreated +
      day.claimsTaken +
      day.claimsCompleted +
      day.feedbackSubmitted +
      day.reportsSubmitted +
      day.remindersQueued +
      day.remindersSent +
      day.remindersFailed
    )
  );
  const truncatedAnalyticsMetrics = analyticsReport
    ? Object.entries(analyticsReport.truncated).filter(([, truncated]) => truncated).map(([metric]) => metric)
    : [];
  const topProgressProjects = [...projectSummaries]
    .filter((project) => project.totalPortions > 0)
    .sort((a, b) => b.completedProgressPct - a.completedProgressPct || b.progressPct - a.progressPct)
    .slice(0, 8);
  const topParticipantProjects = [...projectSummaries]
    .sort((a, b) => b.participantCount - a.participantCount)
    .slice(0, 8);
  const trackAnalytics = Object.entries(analyticsTotals.tracks)
    .sort((a, b) => b[1] - a[1]);
  const supportQuery = supportSearch.trim().toLowerCase();
  const filteredFeedbackItems = (overview?.recentFeedback || []).filter((item) => {
    if (!supportQuery) return true;
    return [item.type, item.message, item.email || "", item.currentPath || "", item.status, item.priority || "", item.tag || "", item.assignedTo || "", item.internalNote || ""]
      .some((value) => value.toLowerCase().includes(supportQuery));
  });
  const filteredReportItems = (overview?.recentReports || []).filter((item) => {
    if (!supportQuery) return true;
    return [item.reason, item.details || "", item.reporterEmail || "", item.projectSlug || "", item.projectId || "", item.status, item.priority || "", item.tag || "", item.assignedTo || "", item.internalNote || ""]
      .some((value) => value.toLowerCase().includes(supportQuery));
  });
  const filteredContactItems = (overview?.recentContacts || []).filter((item) => {
    if (!supportQuery) return true;
    return [item.message, item.senderEmail || "", item.slug || "", item.projectId || "", item.reason || "", item.delivered ? "delivered" : "undelivered", item.supportStatus || "", item.priority || "", item.tag || "", item.assignedTo || "", item.internalNote || ""]
      .some((value) => value.toLowerCase().includes(supportQuery));
  });
  const communicationsQuery = communicationsSearch.trim().toLowerCase();
  const scheduledEmails = overview?.recentScheduledEmails || [];
  const filteredScheduledEmails = scheduledEmails.filter((item) => {
    if (!communicationsQuery) return true;
    return [
      item.status,
      item.reminderType || "",
      item.toEmail || "",
      item.projectId || "",
      item.projectSlug || "",
      item.claimId || "",
      item.locale,
      item.lastError || "",
    ].some((value) => String(value || "").toLowerCase().includes(communicationsQuery));
  });
  const reminderStatusCounts = scheduledEmails.reduce<Record<string, number>>((acc, item) => {
    const key = item.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const reminderTypeCounts = scheduledEmails.reduce<Record<string, number>>((acc, item) => {
    const key = item.reminderType || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const filteredAuditEntries = auditEntries.filter((entry) => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      entry.action,
      entry.adminUid || "",
      entry.projectId || "",
      entry.targetUid || "",
      entry.feedbackId || "",
      typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details || {}),
    ].some((value) => value.toLowerCase().includes(query));
  });
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
  const accessRows = projectSummaries.map((project) => {
    const notes: { severity: "warn" | "info"; text: string }[] = [];
    const publicProject = project.isPublic !== false;
    if (!project.slug || project.issues.includes("missing_slug")) {
      notes.push({ severity: "warn", text: label(locale, "חסר קישור ציבורי", "Missing public slug") });
    }
    if (project.status === "active" && !publicProject) {
      notes.push({ severity: "warn", text: label(locale, "פעיל אבל לא מופיע בספרייה", "Active but hidden from directory") });
    }
    if (!project.isPasswordProtected) {
      notes.push({ severity: "info", text: label(locale, "פתוח להצטרפות ללא סיסמה", "Open without password") });
    }
    if (project.isPasswordProtected) {
      notes.push({ severity: "info", text: label(locale, "דורש סיסמה לפני כניסה", "Requires password before entry") });
    }
    if (project.locked) {
      notes.push({ severity: "info", text: label(locale, "נעול לבחירות חדשות", "Locked for new claims") });
    }
    if (project.showLeaderboard === false) {
      notes.push({ severity: "info", text: label(locale, "יישר כח מוסתר", "Yasher Koach hidden") });
    }
    return { project, notes };
  });
  const accessQuery = accessSearch.trim().toLowerCase();
  const filteredAccessRows = accessRows.filter(({ project, notes }) => {
    if (!accessQuery) return true;
    return [
      project.nameHebrew,
      project.familyNameHebrew,
      project.nameEnglish,
      project.familyNameEnglish,
      project.slug || "",
      project.createdByEmail || "",
      project.status,
      project.id,
      project.isPasswordProtected ? "password protected" : "open link",
      project.isPublic === false ? "private hidden" : "public",
      ...notes.map((note) => note.text),
    ].some((value) => String(value || "").toLowerCase().includes(accessQuery));
  });
  const accessStats = {
    protected: projectSummaries.filter((project) => project.isPasswordProtected).length,
    open: projectSummaries.filter((project) => !project.isPasswordProtected).length,
    directoryHidden: projectSummaries.filter((project) => project.isPublic === false).length,
    locked: projectSummaries.filter((project) => project.locked).length,
    review: accessRows.filter((row) => row.notes.some((note) => note.severity === "warn")).length,
  };
  const commandCenterItems = [
    {
      key: "failed_reminders",
      severity: Number(stats.failedReminderEmails || 0) > 0 ? "warn" : "pass",
      title: label(locale, "תזכורות שנכשלו", "Failed reminders"),
      detail: label(locale, `${Number(stats.failedReminderEmails || 0)} הודעות תזכורת נכשלו ודורשות בדיקה בתור התזכורות.`, `${Number(stats.failedReminderEmails || 0)} reminder emails failed and need review in the reminder queue.`),
      action: () => setSuperTab("communications"),
    },
    {
      key: "support_queue",
      severity: Number(stats.newFeedback || 0) + Number(stats.openReports || 0) + Number(stats.openContactMessages || 0) > 0 ? "warn" : "pass",
      title: label(locale, "תור תמיכה", "Support queue"),
      detail: label(locale, `${Number(stats.newFeedback || 0)} משובים חדשים, ${Number(stats.openReports || 0)} דיווחים פתוחים, ${Number(stats.openContactMessages || 0)} הודעות משפחה פתוחות.`, `${Number(stats.newFeedback || 0)} new feedback, ${Number(stats.openReports || 0)} open reports, ${Number(stats.openContactMessages || 0)} open family messages.`),
      action: () => setSuperTab("support"),
    },
    {
      key: "project_integrity",
      severity: projectsWithIssues.length > 0 ? "warn" : "pass",
      title: label(locale, "תקינות פרויקטים", "Project integrity"),
      detail: label(locale, `${projectsWithIssues.length} פרויקטים דורשים בדיקה או תיקון נקודתי.`, `${projectsWithIssues.length} projects need review or single-project repair.`),
      action: () => setSuperTab("integrity"),
    },
    {
      key: "access_review",
      severity: accessStats.review > 0 ? "warn" : "pass",
      title: label(locale, "בדיקת גישה ושיתוף", "Access and sharing"),
      detail: label(locale, `${accessStats.review} פרויקטים עם שילוב גישה שכדאי לבדוק.`, `${accessStats.review} projects have access combinations worth reviewing.`),
      action: () => setSuperTab("access"),
    },
  ];
  const commandAttentionCount = commandCenterItems.filter((item) => item.severity === "warn").length;
  const filteredUserSummaries = userSummaries.filter((user) => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      user.email || "",
      user.displayName || "",
      user.uid,
      user.permissions.join(" "),
      ...user.projects.flatMap((project) => [project.nameHebrew, project.familyNameHebrew, project.slug || "", project.id]),
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const creatorCount = userSummaries.filter((user) => user.projectCount > 0).length;
  const userAdminCount = userSummaries.filter((user) => user.isAdmin || user.isSuperAdmin).length;
  const selectedProject = projectSummaries.find((project) => project.id === selectedProjectId) || filteredProjects[0] || null;
  const exportStamp = new Date().toISOString().slice(0, 10);
  const exportSuccessMessage = label(locale, "קובץ הייצוא נוצר", "Export file created");
  const exportEmptyMessage = label(locale, "אין נתונים לייצוא", "No data to export");

  function finishExport(success: boolean) {
    if (success) toast.success(exportSuccessMessage);
    else toast.error(exportEmptyMessage);
  }

  function exportAnalyticsCsv() {
    finishExport(downloadCsv(`lzecher-analytics-${analyticsRangeDays}d-${exportStamp}.csv`, analyticsDaily.map((day) => exportRow(locale, [
      ["תאריך", "Date", day.date],
      ["פרויקטים חדשים", "New projects", day.projectsCreated],
      ["בחירות לימוד", "Claims taken", day.claimsTaken],
      ["סומנו כנלמדו", "Marked learned", day.claimsCompleted],
      ["משובים", "Feedback submitted", day.feedbackSubmitted],
      ["דיווחים", "Reports submitted", day.reportsSubmitted],
      ["תזכורות שנוצרו", "Reminders queued", day.remindersQueued],
      ["תזכורות שנשלחו", "Reminders sent", day.remindersSent],
      ["תזכורות שנכשלו", "Reminders failed", day.remindersFailed],
    ]))));
  }

  function exportAccessCsv() {
    finishExport(downloadCsv(`lzecher-access-audit-${exportStamp}.csv`, filteredAccessRows.map(({ project, notes }) => exportRow(locale, [
      ["מזהה", "ID", project.id],
      ["קישור", "Slug", project.slug],
      ["סטטוס", "Status", projectStatusLabel(locale, project.status)],
      ["שם פרטי", "Hebrew first name", project.nameHebrew],
      ["שם משפחה", "Hebrew family name", project.familyNameHebrew],
      ["אימייל יוצר", "Creator email", project.createdByEmail],
      ["מופיע בספרייה", "Directory visible", yesNoLabel(locale, project.isPublic !== false)],
      ["דורש סיסמה", "Password protected", yesNoLabel(locale, project.isPasswordProtected)],
      ["נעול לבחירות חדשות", "Locked for new claims", yesNoLabel(locale, project.locked)],
      ["יישר כח מוצג", "Yasher Koach visible", yesNoLabel(locale, project.showLeaderboard)],
      ["מחזור נוסף פעיל", "Bonus rounds enabled", yesNoLabel(locale, project.repeatingSetEnabled)],
      ["הוקם על ידי מוצג", "Started-by visible", yesNoLabel(locale, project.startedByVisible)],
      ["סה״כ חלקים", "Total portions", project.totalPortions],
      ["נלקחו", "Taken", project.claimedPortions],
      ["נלמדו", "Learned", project.completedPortions],
      ["הערות", "Notes", notes.map((note) => note.text).join(" | ")],
      ["בעיות", "Issues", project.issues.map((issue) => projectIssueCopy(locale, issue)).join(" | ")],
    ]))));
  }

  function exportProjectsCsv() {
    finishExport(downloadCsv(`lzecher-projects-${exportStamp}.csv`, projectSummaries.map((project) => exportRow(locale, [
      ["מזהה", "ID", project.id],
      ["קישור", "Slug", project.slug],
      ["סטטוס", "Status", projectStatusLabel(locale, project.status)],
      ["שם פרטי", "Hebrew first name", project.nameHebrew],
      ["שם משפחה", "Hebrew family name", project.familyNameHebrew],
      ["שם באנגלית", "English first name", project.nameEnglish],
      ["משפחה באנגלית", "English family name", project.familyNameEnglish],
      ["מזהה יוצר", "Creator UID", project.createdBy],
      ["אימייל יוצר", "Creator email", project.createdByEmail],
      ["נוצר בתאריך", "Created at", exportDate(locale, project.createdAt)],
      ["עודכן בתאריך", "Updated at", exportDate(locale, project.updatedAt)],
      ["תחומי לימוד", "Learning tracks", project.tracks.map((track) => learningLabel(locale, null, track)).join(" | ")],
      ["דורש סיסמה", "Password protected", yesNoLabel(locale, project.isPasswordProtected)],
      ["מופיע בספרייה", "Directory visible", yesNoLabel(locale, project.isPublic !== false)],
      ["נעול לבחירות חדשות", "Locked for new claims", yesNoLabel(locale, project.locked)],
      ["יישר כח מוצג", "Yasher Koach visible", yesNoLabel(locale, project.showLeaderboard)],
      ["סה״כ חלקים", "Total portions", project.totalPortions],
      ["נלקחו", "Taken", project.claimedPortions],
      ["נלמדו", "Learned", project.completedPortions],
      ["משתתפים", "Participants", project.participantCount],
      ["אחוז שנלקח", "Taken percent", project.progressPct],
      ["אחוז שנלמד", "Learned percent", project.completedProgressPct],
      ["מחזורים שהושלמו", "Completed cycles", project.completedCycles],
      ["בעיות", "Issues", project.issues.map((issue) => projectIssueCopy(locale, issue)).join(" | ")],
    ]))));
  }

  function exportUsersCsv() {
    finishExport(downloadCsv(`lzecher-users-${exportStamp}.csv`, userSummaries.map((user) => exportRow(locale, [
      ["מזהה משתמש", "User ID", user.uid],
      ["אימייל", "Email", user.email],
      ["שם לתצוגה", "Display name", user.displayName],
      ["מנהל", "Admin", yesNoLabel(locale, user.isAdmin)],
      ["מנהל ראשי", "Super admin", yesNoLabel(locale, user.isSuperAdmin)],
      ["הרשאות", "Permissions", user.permissions.join(" | ")],
      ["מספר פרויקטים", "Project count", user.projectCount],
      ["פרויקטים פעילים", "Active project count", user.activeProjectCount],
      ["בחירות לימוד", "Claim count", user.claimCount],
      ["סומנו כנלמדו", "Completed claim count", user.completedClaimCount],
      ["פרויקט אחרון", "Last project at", exportDate(locale, user.lastProjectAt)],
      ["בחירה אחרונה", "Last claim at", exportDate(locale, user.lastClaimAt)],
      ["פעילות אחרונה", "Last activity at", exportDate(locale, user.lastActivityAt)],
    ]))));
  }

  function exportSupportCsv() {
    const rows = [
      ...filteredFeedbackItems.map((item) => exportRow(locale, [
        ["סוג", "Kind", label(locale, "משוב", "Feedback")],
        ["מזהה", "ID", item.id],
        ["סטטוס", "Status", feedbackStatusLabel(locale, item.status)],
        ["עדיפות", "Priority", priorityLabel(locale, item.priority || "normal")],
        ["נושא", "Subject", feedbackTypeLabel(locale, item.type)],
        ["הודעה", "Message", item.message],
        ["אימייל", "Email", item.email],
        ["מזהה פרויקט", "Project ID", ""],
        ["נתיב", "Path", item.currentPath],
        ["נשלח בתאריך", "Submitted at", exportDate(locale, item.submittedAt)],
        ["משויך אל", "Assigned to", item.assignedTo || ""],
        ["תגית", "Tag", item.tag || ""],
      ])),
      ...filteredReportItems.map((item) => exportRow(locale, [
        ["סוג", "Kind", label(locale, "דיווח", "Report")],
        ["מזהה", "ID", item.id],
        ["סטטוס", "Status", reportStatusLabel(locale, item.status)],
        ["עדיפות", "Priority", priorityLabel(locale, item.priority || "normal")],
        ["נושא", "Subject", reportReasonLabel(locale, item.reason)],
        ["הודעה", "Message", item.details || ""],
        ["אימייל", "Email", item.reporterEmail],
        ["מזהה פרויקט", "Project ID", item.projectId || ""],
        ["נתיב", "Path", item.projectSlug || ""],
        ["נשלח בתאריך", "Submitted at", exportDate(locale, item.reportedAt)],
        ["משויך אל", "Assigned to", item.assignedTo || ""],
        ["תגית", "Tag", item.tag || ""],
      ])),
      ...filteredContactItems.map((item) => exportRow(locale, [
        ["סוג", "Kind", label(locale, "הודעת משפחה", "Family message")],
        ["מזהה", "ID", item.id],
        ["סטטוס", "Status", feedbackStatusLabel(locale, item.supportStatus || (item.delivered ? "resolved" : "new"))],
        ["עדיפות", "Priority", priorityLabel(locale, item.priority || "normal")],
        ["נושא", "Subject", item.reason || label(locale, "הודעה", "Contact")],
        ["הודעה", "Message", item.message],
        ["אימייל", "Email", item.senderEmail],
        ["מזהה פרויקט", "Project ID", item.projectId || ""],
        ["נתיב", "Path", item.slug || ""],
        ["נשלח בתאריך", "Submitted at", exportDate(locale, item.sentAt)],
        ["משויך אל", "Assigned to", item.assignedTo || ""],
        ["תגית", "Tag", item.tag || ""],
      ])),
    ];
    finishExport(downloadCsv(`lzecher-support-${exportStamp}.csv`, rows));
  }

  function exportScheduledEmailsCsv() {
    finishExport(downloadCsv(`lzecher-reminders-${exportStamp}.csv`, filteredScheduledEmails.map((item) => exportRow(locale, [
      ["מזהה", "ID", item.id],
      ["סטטוס", "Status", reminderStatusLabel(locale, item.status)],
      ["סוג תזכורת", "Reminder type", reminderTypeLabel(locale, item.reminderType)],
      ["אימייל יעד", "Recipient email", item.toEmail],
      ["מזהה משתמש", "User ID", item.userId],
      ["מזהה פרויקט", "Project ID", item.projectId],
      ["קישור פרויקט", "Project slug", item.projectSlug],
      ["מזהה בחירה", "Claim ID", item.claimId],
      ["שפה", "Locale", item.locale],
      ["מתוכנן לתאריך", "Send at", exportDate(locale, item.sendAt)],
      ["נוצר בתאריך", "Created at", exportDate(locale, item.createdAt)],
      ["נשלח בתאריך", "Sent at", exportDate(locale, item.sentAt)],
      ["נכשל בתאריך", "Failed at", exportDate(locale, item.failedAt)],
      ["מספר ניסיונות", "Attempts", item.attempts],
      ["שגיאה אחרונה", "Last error", item.lastError ? friendlyEmailError(item.lastError) : ""],
    ]))));
  }

  function exportAuditCsv() {
    finishExport(downloadCsv(`lzecher-audit-${exportStamp}.csv`, auditEntries.map((entry) => exportRow(locale, [
      ["מזהה", "ID", entry.id],
      ["פעולה", "Action", entry.action],
      ["מזהה מנהל", "Admin UID", entry.adminUid],
      ["מזהה פרויקט", "Project ID", entry.projectId],
      ["מזהה יעד", "Target UID", entry.targetUid],
      ["מזהה משוב", "Feedback ID", entry.feedbackId],
      ["תאריך", "At", exportDate(locale, entry.at)],
      ["פרטים", "Details", entry.details],
    ]))));
  }

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
                  <Badge variant="secondary">{label(locale, "תחום לזכר בלבד", "Lzecher-only scope")}</Badge>
                </div>
                <h2 className="font-heading text-xl font-bold">
                  {label(locale, "חדר בקרה של לזכר", "Lzecher Command Center")}
                </h2>
                <p className="text-xs text-cream/70">
                  {label(locale, "כל פעולה רגישה מוגבלת לאוספי לזכר ונרשמת ביומן ביקורת.", "Sensitive actions are limited to Lzecher collections and written to the audit log.")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void loadOverview(); void loadSiteSettings(); void loadAnalytics(); }} disabled={refreshing || loadingAnalytics} className="border-cream/25 bg-transparent text-cream hover:bg-cream/10">
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
              <TabsTrigger value="analytics"><TrendingUp className="h-4 w-4" /> {label(locale, "מגמות", "Analytics")}</TabsTrigger>
              <TabsTrigger value="exports"><Download className="h-4 w-4" /> {label(locale, "ייצוא", "Exports")}</TabsTrigger>
              <TabsTrigger value="access"><Lock className="h-4 w-4" /> {label(locale, "גישה", "Access")}</TabsTrigger>
              <TabsTrigger value="projects"><ClipboardList className="h-4 w-4" /> {label(locale, "פרויקטים", "Projects")}</TabsTrigger>
              <TabsTrigger value="users"><Users className="h-4 w-4" /> {label(locale, "משתמשים", "Users")}</TabsTrigger>
              <TabsTrigger value="support"><Inbox className="h-4 w-4" /> {label(locale, "תמיכה", "Support")}</TabsTrigger>
              <TabsTrigger value="communications"><Mail className="h-4 w-4" /> {label(locale, "תזכורות", "Reminders")}</TabsTrigger>
              <TabsTrigger value="integrity"><ShieldCheck className="h-4 w-4" /> {label(locale, "תקינות", "Integrity")}</TabsTrigger>
              <TabsTrigger value="language"><Languages className="h-4 w-4" /> {label(locale, "שפה", "Language")}</TabsTrigger>
              <TabsTrigger value="health"><Wrench className="h-4 w-4" /> {label(locale, "בדיקות", "Health")}</TabsTrigger>
              <TabsTrigger value="audit"><History className="h-4 w-4" /> {label(locale, "יומן", "Audit")}</TabsTrigger>
              <TabsTrigger value="control"><Settings className="h-4 w-4" /> {label(locale, "בקרה", "Control")}</TabsTrigger>
              <TabsTrigger value="admins"><UserPlus className="h-4 w-4" /> {label(locale, "מנהלים", "Admins")}</TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <div className="mb-4 rounded-lg border border-navy/10 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-navy">{label(locale, "תור תשומת לב", "Attention Queue")}</h3>
                    <p className="text-xs text-muted">
                      {label(locale, "מבט מהיר על הדברים שכדאי לבדוק קודם, בלי פעולות גורפות.", "A quick read-only view of what deserves attention first, with no bulk actions.")}
                    </p>
                  </div>
                  <Badge variant={commandAttentionCount ? "destructive" : "secondary"}>
                    {commandAttentionCount ? label(locale, `${commandAttentionCount} לבדיקה`, `${commandAttentionCount} to review`) : label(locale, "תקין", "Clear")}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {commandCenterItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.action}
                      className={cn(
                        "rounded-lg border p-3 text-start transition hover:border-gold/40 hover:bg-gold/5",
                        item.severity === "warn" ? "border-gold/35 bg-gold/10" : "border-navy/10 bg-cream/30"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="font-medium text-navy">{item.title}</p>
                        {item.severity === "warn" ? <AlertTriangle className="h-4 w-4 text-gold" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                      <p className="text-xs text-muted">{item.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [label(locale, "פרויקטים", "Projects"), stats.totalProjects],
                  [label(locale, "פעילים", "Active"), stats.activeProjects],
                  [label(locale, "עם סיסמה", "Password protected"), stats.protectedProjects],
                  [label(locale, "פתוחים", "Open links"), stats.openProjects],
                  [label(locale, "נוצרו היום", "Created today"), stats.projectsToday],
                  [label(locale, "נוצרו השבוע", "Created this week"), stats.projectsThisWeek],
                  [label(locale, "צפיות היום", "Views today"), stats.siteViewsToday],
                  [label(locale, "צפיות השבוע", "Views this week"), stats.siteViewsThisWeek],
                  [label(locale, "צפיות החודש", "Views this month"), stats.siteViewsThisMonth],
                  [label(locale, "בחירות לימוד", "Claims"), stats.totalClaims],
                  [label(locale, "בחירות השבוע", "Claims this week"), stats.claimsThisWeek],
                  [label(locale, "נלמדו", "Learned"), stats.completedClaims],
                  [label(locale, "נלמדו השבוע", "Learned this week"), stats.completedThisWeek],
                  [label(locale, "משוב חדש", "New feedback"), stats.newFeedback],
                  [label(locale, "דיווחים פתוחים", "Open reports"), stats.openReports],
                  [label(locale, "בעיות לבדיקה", "Diagnostics"), stats.projectsWithIssues],
                  [label(locale, "הודעות שלא נשלחו", "Undelivered contacts"), stats.undeliveredContacts],
                  [label(locale, "תזכורות ממתינות", "Pending reminders"), stats.pendingReminderEmails],
                  [label(locale, "תזכורות שנכשלו", "Failed reminders"), stats.failedReminderEmails],
                ].map(([name, value]) => (
                  <div key={String(name)} className="rounded-lg border border-navy/10 bg-cream/40 p-3">
                    <p className="text-xs text-muted">{name}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "צפיות באתר", "Site views")}</h3>
                      <p className="text-xs text-muted">
                        {label(locale, "ספירה מצטברת וללא פרטים אישיים מתוך lzecher_view_stats.", "Aggregate, non-personal counts from lzecher_view_stats.")}
                      </p>
                    </div>
                    <Badge variant="secondary">{siteViews.thisMonth.toLocaleString()} {label(locale, "החודש", "this month")}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      [label(locale, "היום", "Today"), siteViews.today],
                      [label(locale, "השבוע", "This week"), siteViews.thisWeek],
                      [label(locale, "החודש", "This month"), siteViews.thisMonth],
                    ].map(([name, value]) => (
                      <div key={String(name)} className="rounded-md bg-cream/40 p-2">
                        <p className="text-xs text-muted">{name}</p>
                        <p className="font-heading text-xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-cream/30 p-2">
                      <p className="mb-1 text-xs font-medium text-navy">{label(locale, "לפי שפה", "By language")}</p>
                      {Object.entries(siteViews.byLocale).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3 text-xs text-muted">
                          <span>{key}</span>
                          <span>{value.toLocaleString()}</span>
                        </div>
                      ))}
                      {!Object.keys(siteViews.byLocale).length && <p className="text-xs text-muted">{label(locale, "אין נתונים עדיין", "No data yet")}</p>}
                    </div>
                    <div className="rounded-md bg-cream/30 p-2">
                      <p className="mb-1 text-xs font-medium text-navy">{label(locale, "לפי אזור באתר", "By site area")}</p>
                      {Object.entries(siteViews.byRoute).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3 text-xs text-muted">
                          <span>{viewRouteLabel(locale, key)}</span>
                          <span>{value.toLocaleString()}</span>
                        </div>
                      ))}
                      {!Object.keys(siteViews.byRoute).length && <p className="text-xs text-muted">{label(locale, "אין נתונים עדיין", "No data yet")}</p>}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "דפים נצפים ביותר", "Top viewed projects")}</h3>
                  <div className="space-y-2">
                    {siteViews.topProjects.map((project) => (
                      <div key={project.projectId} className="rounded-md bg-cream/40 px-2 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy" dir="rtl">{project.name}</p>
                            <p className="text-xs text-muted">{project.slug || project.projectId}</p>
                          </div>
                          <Badge variant="secondary">{project.views.toLocaleString()}</Badge>
                        </div>
                      </div>
                    ))}
                    {!siteViews.topProjects.length && (
                      <p className="py-4 text-center text-sm text-muted">{label(locale, "אין צפיות בפרויקטים עדיין", "No project views yet")}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-navy/10 bg-white p-3">
                  <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "פעילות אחרונה", "Recent learning activity")}</h3>
                  <div className="space-y-2">
                    {(overview?.recentClaims || []).slice(0, 8).map((claim) => (
                      <div key={claim.id} className="flex items-center justify-between gap-3 rounded-md bg-cream/40 px-2 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-navy">{claim.userName || label(locale, "אנונימי", "Anonymous")} · {learningLabel(locale, claim.reference, claim.trackType)}</span>
                        <span className="shrink-0 text-muted">{formatTimestamp(claim.claimedAt, locale)}</span>
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

            <TabsContent value="analytics">
              <div className="space-y-4">
                <div className="rounded-lg border border-navy/10 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "מגמות לפי תאריך", "Date-range trends")}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {label(locale, "קריאה בלבד מתוך אוספי lzecher_ בלבד: פרויקטים, בחירות לימוד, משוב, דיווחים ותזכורות.", "Read-only from Lzecher-scoped collections only: projects, claims, feedback, reports, and reminders.")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[7, 30, 90].map((days) => (
                        <Button
                          key={days}
                          size="sm"
                          variant={analyticsRangeDays === days ? "default" : "outline"}
                          onClick={() => {
                            setAnalyticsRangeDays(days);
                            void loadAnalytics(days);
                          }}
                          disabled={loadingAnalytics}
                        >
                          {label(locale, `${days} ימים`, `${days} days`)}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => void loadAnalytics()} disabled={loadingAnalytics}>
                        {loadingAnalytics ? <Spinner className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
                        {label(locale, "רענן", "Refresh")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportAnalyticsCsv} disabled={!analyticsDaily.length}>
                        <Download className="h-4 w-4" />
                        CSV
                      </Button>
                    </div>
                  </div>

                  {loadingAnalytics && !analyticsReport ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="h-6 w-6" />
                    </div>
                  ) : analyticsReport ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[
                          [label(locale, "פרויקטים חדשים", "New projects"), analyticsRangeTotals?.projectsCreated || 0, label(locale, "נוצרו בטווח", "created in range")],
                          [label(locale, "בחירות לימוד", "Claims taken"), analyticsRangeTotals?.claimsTaken || 0, label(locale, "לא כולל שורות סיכום", "excluding parent summaries")],
                          [label(locale, "סומנו כנלמדו", "Marked learned"), analyticsRangeTotals?.claimsCompleted || 0, label(locale, "הושלמו בטווח", "completed in range")],
                          [label(locale, "פניות ותזכורות", "Support and reminders"), (analyticsRangeTotals?.feedbackSubmitted || 0) + (analyticsRangeTotals?.reportsSubmitted || 0) + (analyticsRangeTotals?.remindersFailed || 0), label(locale, "משוב, דיווחים וכשלי שליחה", "feedback, reports, and send failures")],
                        ].map(([name, value, detail]) => (
                          <div key={String(name)} className="rounded-lg border border-navy/10 bg-cream/30 p-3">
                            <p className="text-xs text-muted">{name}</p>
                            <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                            <p className="mt-1 text-xs text-muted">{detail}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
                        <div className="rounded-lg border border-navy/10 bg-cream/20 p-3">
                          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <h4 className="font-heading font-bold text-navy">{label(locale, "תנועה יומית", "Daily movement")}</h4>
                            <span className="text-xs text-muted">
                              {new Date(analyticsReport.startAt).toLocaleDateString()} - {new Date(analyticsReport.endAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                            {analyticsDaily.map((day) => {
                              const support = day.feedbackSubmitted + day.reportsSubmitted;
                              const reminders = day.remindersQueued + day.remindersSent + day.remindersFailed;
                              const total = day.projectsCreated + day.claimsTaken + day.claimsCompleted + support + reminders;
                              const segments = [
                                { key: "claimsTaken", value: day.claimsTaken, className: "bg-gold" },
                                { key: "claimsCompleted", value: day.claimsCompleted, className: "bg-green-600" },
                                { key: "projectsCreated", value: day.projectsCreated, className: "bg-navy" },
                                { key: "support", value: support, className: "bg-red-500" },
                                { key: "reminders", value: reminders, className: "bg-sky-500" },
                              ];
                              return (
                                <div key={day.date} className="rounded-md bg-white px-2 py-2">
                                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                    <span className="font-medium text-navy">{day.date}</span>
                                    <span className="text-muted">{total.toLocaleString()}</span>
                                  </div>
                                  <div className="h-3 overflow-hidden rounded-full bg-navy/10">
                                    {total > 0 && (
                                      <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.max(4, Math.round((total / maxDailyRangeActivity) * 100))}%` }}>
                                        {segments.filter((segment) => segment.value > 0).map((segment) => (
                                          <div
                                            key={segment.key}
                                            className={segment.className}
                                            style={{ width: `${Math.max(6, Math.round((segment.value / total) * 100))}%` }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                                    <span>{label(locale, "נלקחו", "Taken")}: {day.claimsTaken}</span>
                                    <span>{label(locale, "נלמדו", "Learned")}: {day.claimsCompleted}</span>
                                    <span>{label(locale, "פרויקטים", "Projects")}: {day.projectsCreated}</span>
                                    <span>{label(locale, "תמיכה", "Support")}: {support}</span>
                                    <span>{label(locale, "תזכורות", "Reminders")}: {reminders}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-lg border border-navy/10 bg-cream/20 p-3">
                            <h4 className="font-heading font-bold text-navy">{label(locale, "מקרא", "Legend")}</h4>
                            <div className="mt-2 space-y-2 text-sm text-navy">
                              {[
                                ["bg-gold", label(locale, "בחירות לימוד חדשות", "New claims")],
                                ["bg-green-600", label(locale, "סומנו כנלמדו", "Marked learned")],
                                ["bg-navy", label(locale, "פרויקטים חדשים", "New projects")],
                                ["bg-red-500", label(locale, "משוב ודיווחים", "Feedback and reports")],
                                ["bg-sky-500", label(locale, "תזכורות אימייל", "Reminder emails")],
                              ].map(([color, name]) => (
                                <div key={String(name)} className="flex items-center gap-2">
                                  <span className={cn("h-2.5 w-2.5 rounded-full", String(color))} />
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border border-navy/10 bg-cream/20 p-3">
                            <h4 className="font-heading font-bold text-navy">{label(locale, "תור תזכורות בטווח", "Reminder queue in range")}</h4>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                              <div className="rounded-md bg-white p-2">
                                <p className="text-xs text-muted">{label(locale, "נוצרו", "Queued")}</p>
                                <p className="font-heading text-lg font-bold text-navy">{analyticsRangeTotals?.remindersQueued || 0}</p>
                              </div>
                              <div className="rounded-md bg-white p-2">
                                <p className="text-xs text-muted">{label(locale, "נשלחו", "Sent")}</p>
                                <p className="font-heading text-lg font-bold text-green-700">{analyticsRangeTotals?.remindersSent || 0}</p>
                              </div>
                              <div className="rounded-md bg-white p-2">
                                <p className="text-xs text-muted">{label(locale, "נכשלו", "Failed")}</p>
                                <p className="font-heading text-lg font-bold text-red-700">{analyticsRangeTotals?.remindersFailed || 0}</p>
                              </div>
                            </div>
                          </div>
                          {truncatedAnalyticsMetrics.length > 0 && (
                            <div className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-xs text-navy">
                              {label(locale, "חלק מהמדדים הגיעו למגבלת הקריאה ולכן מוצגים בזהירות:", "Some metrics hit the read limit and should be read cautiously:")} {truncatedAnalyticsMetrics.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-cream/40 p-4 text-center text-sm text-muted">
                      {label(locale, "עדיין לא נטענו מגמות לפי תאריך.", "Date-range trends have not loaded yet.")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    [label(locale, "אחוז שנלקח", "Taken rate"), `${analyticsRates.taken}%`, `${analyticsTotals.claimedPortions.toLocaleString()}/${analyticsTotals.totalPortions.toLocaleString()}`],
                    [label(locale, "אחוז שנלמד", "Learned rate"), `${analyticsRates.learned}%`, analyticsTotals.completedPortions.toLocaleString()],
                    [label(locale, "משתתפים ממוצע", "Avg participants"), analyticsRates.averageParticipants.toLocaleString(), analyticsTotals.participants.toLocaleString()],
                    [label(locale, "עם סיסמה", "Protected"), `${analyticsRates.protected}%`, analyticsTotals.passwordProtected.toLocaleString()],
                  ].map(([name, value, detail]) => (
                    <div key={String(name)} className="rounded-lg border border-navy/10 bg-white p-3">
                      <p className="text-xs text-muted">{name}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{value}</p>
                      <p className="mt-1 text-xs text-muted">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "מסלולים בפרויקטים", "Track coverage")}</h3>
                    <div className="space-y-2">
                      {trackAnalytics.map(([track, count]) => {
                        const trackConfig = TRACK_CONFIGS[track as keyof typeof TRACK_CONFIGS];
                        const pct = projectSummaries.length ? Math.round((count / projectSummaries.length) * 100) : 0;
                        return (
                          <div key={track} className="rounded-md bg-cream/40 px-2 py-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-navy">{trackConfig ? (locale === "he" ? trackConfig.label.he : trackConfig.label.en) : track}</span>
                              <span className="text-muted">{count} · {pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy/10">
                              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "התקדמות מובילה", "Top progress")}</h3>
                    <div className="space-y-2">
                      {topProgressProjects.map((project) => (
                        <button key={project.id} type="button" onClick={() => inspectProject(project.id)} className="block w-full rounded-md bg-cream/40 px-2 py-2 text-start transition hover:bg-gold/10">
                          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <span className="min-w-0 whitespace-normal break-words font-medium text-navy sm:truncate" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</span>
                            <span className="shrink-0 text-muted">{Math.round(project.completedProgressPct || 0)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy/10">
                            <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.min(100, Math.round(project.completedProgressPct || 0))}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "השתתפות מובילה", "Top participation")}</h3>
                    <div className="space-y-2">
                      {topParticipantProjects.map((project) => (
                        <button key={project.id} type="button" onClick={() => inspectProject(project.id)} className="flex w-full flex-col gap-1 rounded-md bg-cream/40 px-2 py-2 text-start transition hover:bg-gold/10 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <span className="min-w-0 whitespace-normal break-words text-sm font-medium text-navy sm:truncate" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</span>
                          <span className="shrink-0 text-xs text-muted">{project.participantCount} {label(locale, "משתתפים", "participants")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-sm text-navy">
                  <p className="font-medium">{label(locale, "תובנות תפעול", "Operational insight")}</p>
                  <p className="mt-1 text-xs text-muted">
                    {label(locale, `${analyticsTotals.bonusProjects} פרויקטים כבר הגיעו למחזור נוסף. זה עוזר לזהות אילו דפי הנצחה מצליחים להמשיך לעורר לימוד אחרי הסיום הראשון.`, `${analyticsTotals.bonusProjects} projects have reached an additional cycle. This helps identify memorial pages that keep inspiring learning after the first completion.`)}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="exports">
              <div className="space-y-4">
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
                  <div className="flex items-start gap-3">
                    <Download className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "ייצוא נתוני מנהל", "Admin data exports")}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {label(locale, "הקבצים נוצרים רק מהנתונים שכבר נטענו בפורטל. אין כאן כתיבה למסד הנתונים ואין גישה מחוץ לאוספי לזכר.", "Files are generated only from data already loaded in this portal. This does not write to the database and stays within Lzecher-scoped data.")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      key: "analytics",
                      title: label(locale, "מגמות לפי תאריך", "Date-range analytics"),
                      detail: label(locale, `${analyticsDaily.length} ימים מהטווח הנבחר, כולל פרויקטים, בחירות לימוד, השלמות, תמיכה ותזכורות.`, `${analyticsDaily.length} days from the selected range, including projects, claims, completions, support, and reminders.`),
                      action: exportAnalyticsCsv,
                    },
                    {
                      key: "access",
                      title: label(locale, "גישת פרויקטים", "Project access"),
                      detail: label(locale, `${filteredAccessRows.length} פרויקטים מהחיפוש הנוכחי עם מצב קישור, סיסמה, נעילה והופעה בספרייה.`, `${filteredAccessRows.length} projects from the current search with link, password, lock, and directory state.`),
                      action: exportAccessCsv,
                    },
                    {
                      key: "projects",
                      title: label(locale, "פרויקטים", "Projects"),
                      detail: label(locale, `${projectSummaries.length} פרויקטים עם סטטוס, סיסמה, מסלולים, התקדמות ובעיות תקינות.`, `${projectSummaries.length} projects with status, password state, tracks, progress, and diagnostics.`),
                      action: exportProjectsCsv,
                    },
                    {
                      key: "users",
                      title: label(locale, "משתמשים ומנהלים", "Users and admins"),
                      detail: label(locale, `${userSummaries.length} משתמשים עם תפקידים, הרשאות, פרויקטים ופעילות לימוד.`, `${userSummaries.length} users with roles, permissions, projects, and learning activity.`),
                      action: exportUsersCsv,
                    },
                    {
                      key: "support",
                      title: label(locale, "תור תמיכה", "Support queue"),
                      detail: label(locale, `${filteredFeedbackItems.length + filteredReportItems.length + filteredContactItems.length} פריטי משוב, דיווחים והודעות מהתצוגה הנוכחית.`, `${filteredFeedbackItems.length + filteredReportItems.length + filteredContactItems.length} feedback, report, and contact items from the current view.`),
                      action: exportSupportCsv,
                    },
                    {
                      key: "reminders",
                      title: label(locale, "תזכורות אימייל", "Reminder emails"),
                      detail: label(locale, `${filteredScheduledEmails.length} תזכורות מהתצוגה הנוכחית, כולל סטטוס, ניסיון שליחה ושגיאה אחרונה.`, `${filteredScheduledEmails.length} reminders from the current view, including status, attempt count, and last error.`),
                      action: exportScheduledEmailsCsv,
                    },
                    {
                      key: "audit",
                      title: label(locale, "יומן ביקורת", "Audit log"),
                      detail: label(locale, `${auditEntries.length} פעולות אחרונות עם מזהי מנהל, פרויקט ופרטים.`, `${auditEntries.length} recent actions with admin, project, and detail fields.`),
                      action: exportAuditCsv,
                    },
                  ].map((item) => (
                    <div key={item.key} className="rounded-lg border border-navy/10 bg-white p-4">
                      <h4 className="font-heading font-bold text-navy">{item.title}</h4>
                      <p className="mt-1 min-h-[3rem] text-xs text-muted">{item.detail}</p>
                      <Button className="mt-4 w-full" variant="outline" onClick={item.action}>
                        <Download className="h-4 w-4" />
                        {label(locale, "הורד CSV", "Download CSV")}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-navy/10 bg-cream/40 p-3 text-xs text-muted">
                  {label(locale, "לייצוא מלא יותר בעתיד אפשר להוסיף דוחות לפי טווח תאריכים, אך בכוונה אין כאן מחיקה, שינוי הרשאות או תיקון גורף.", "For deeper exports later we can add date-range reports, but this intentionally does not delete, change permissions, or bulk-repair anything.")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access">
              <div className="space-y-4">
                <div className="rounded-lg border border-navy/10 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-5 w-5 text-gold" />
                      <div>
                        <h3 className="font-heading font-bold text-navy">{label(locale, "בדיקת גישה ושיתוף", "Access and Sharing Audit")}</h3>
                        <p className="text-xs text-muted">
                          {label(locale, "תצוגה לקריאה בלבד: האם פרויקט פתוח, דורש סיסמה, מוסתר מהספרייה או נעול לבחירות חדשות.", "Read-only view: whether each project is open, password-protected, hidden from the directory, or locked for new claims.")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={exportAccessCsv} disabled={!filteredAccessRows.length}>
                        <Download className="h-4 w-4" />
                        CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAccessSearch("")} disabled={!accessSearch.trim()}>
                        {label(locale, "נקה חיפוש", "Clear search")}
                      </Button>
                    </div>
                  </div>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={accessSearch}
                      onChange={(event) => setAccessSearch(event.target.value)}
                      placeholder={label(locale, "חיפוש לפי שם, קישור, יוצר או מצב גישה", "Search by name, slug, creator, or access state")}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {[
                    [label(locale, "פרויקטים", "Projects"), projectSummaries.length],
                    [label(locale, "עם סיסמה", "Protected"), accessStats.protected],
                    [label(locale, "פתוחים", "Open"), accessStats.open],
                    [label(locale, "מוסתרים מהספרייה", "Directory hidden"), accessStats.directoryHidden],
                    [label(locale, "נעולים", "Locked"), accessStats.locked],
                    [label(locale, "לבדיקה", "Review"), accessStats.review],
                  ].map(([name, value]) => (
                    <div key={String(name)} className="rounded-lg border border-navy/10 bg-white p-3">
                      <p className="text-xs text-muted">{name}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-heading font-bold text-navy">{label(locale, "מצב פרויקטים", "Project access states")}</h4>
                      <Badge variant="secondary">{filteredAccessRows.length} {label(locale, "בתצוגה", "shown")}</Badge>
                    </div>
                    <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                      {filteredAccessRows.map(({ project, notes }) => (
                        <div key={project.id} className="rounded-lg border border-navy/10 bg-cream/30 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="whitespace-normal break-words font-medium text-navy sm:truncate" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</p>
                              <p className="text-xs text-muted">{project.slug || project.id}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1">
                              {project.slug && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openProjectForSafetyReview(project)}
                                  disabled={openingProjectId === project.id}
                                >
                                  {openingProjectId === project.id ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  {project.isPasswordProtected ? label(locale, "פתח מוגן", "Open protected") : label(locale, "פתח", "Open")}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => inspectProject(project.id)}>
                                <Shield className="h-4 w-4" />
                                {label(locale, "בדוק", "Inspect")}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{projectStatusLabel(locale, project.status)}</Badge>
                            <Badge variant={project.isPublic === false ? "outline" : "secondary"}>
                              {project.isPublic === false ? label(locale, "לא בספרייה", "Directory hidden") : label(locale, "בספרייה", "Directory visible")}
                            </Badge>
                            <Badge variant={project.isPasswordProtected ? "default" : "outline"}>
                              {project.isPasswordProtected ? label(locale, "סיסמה", "Password") : label(locale, "ללא סיסמה", "No password")}
                            </Badge>
                            {project.locked && <Badge variant="destructive">{label(locale, "נעול", "Locked")}</Badge>}
                            {project.showLeaderboard === false && <Badge variant="outline">{label(locale, "יישר כח מוסתר", "Yasher Koach hidden")}</Badge>}
                          </div>
                          {notes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {notes.map((note) => (
                                <Badge key={`${project.id}-${note.text}`} variant={note.severity === "warn" ? "destructive" : "secondary"}>
                                  {note.text}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {!filteredAccessRows.length && (
                        <p className="py-8 text-center text-sm text-muted">{label(locale, "אין פרויקטים שמתאימים לחיפוש", "No projects match this search")}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-navy/10 bg-white p-3">
                      <h4 className="font-heading font-bold text-navy">{label(locale, "סיכום פתיחות", "Openness summary")}</h4>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-2">
                          <span className="text-navy">{label(locale, "קישור פתוח ללא סיסמה", "Open links without password")}</span>
                          <Badge variant="secondary">{accessStats.open}</Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-2">
                          <span className="text-navy">{label(locale, "דורש סיסמה", "Password protected")}</span>
                          <Badge variant="secondary">{accessStats.protected}</Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-2">
                          <span className="text-navy">{label(locale, "מוסתר מהספרייה", "Hidden from directory")}</span>
                          <Badge variant="secondary">{accessStats.directoryHidden}</Badge>
                        </div>
                        <div className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-2">
                          <span className="text-navy">{label(locale, "דורש בדיקה", "Needs review")}</span>
                          <Badge variant={accessStats.review ? "destructive" : "secondary"}>{accessStats.review}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-sm text-navy">
                      <p className="font-medium">{label(locale, "מה נחשב לבדיקה", "What gets flagged")}</p>
                      <p className="mt-1 text-xs text-muted">
                        {label(locale, "המערכת מסמנת בעיקר פרויקט פעיל שלא מופיע בספרייה או פרויקט שחסר לו קישור. מצבים כמו סיסמה, נעילה או הסתרת יישר כח מוצגים כמידע ולא כשגיאה.", "The audit mainly flags active projects hidden from the directory or projects missing a public slug. Passwords, locks, and hidden Yasher Koach sections are shown as information, not errors.")}
                      </p>
                    </div>

                    <div className="rounded-lg border border-navy/10 bg-cream/40 p-3 text-xs text-muted">
                      {label(locale, "כדי לשנות גישה של פרויקט, פתחו אותו בלשונית פרויקטים. שינוי כזה נשמר לפרויקט אחד בלבד ונרשם ביומן ביקורת.", "To change a project's access, inspect it from the Projects tab. Changes are saved to one project only and written to the audit log.")}
                    </div>
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
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0 whitespace-normal break-words font-medium text-navy sm:truncate" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</p>
                          {project.issues.length ? <Badge className="self-start sm:self-auto" variant="destructive">{project.issues.length}</Badge> : <Badge className="self-start sm:self-auto" variant="secondary">{label(locale, "תקין", "OK")}</Badge>}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openProjectForSafetyReview(selectedProject)}
                              disabled={openingProjectId === selectedProject.id}
                            >
                              {openingProjectId === selectedProject.id ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              {selectedProject.isPasswordProtected ? label(locale, "פתח מוגן", "Open protected") : label(locale, "פתח", "Open")}
                            </Button>
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
                                <span className="font-medium">{claim.userName || label(locale, "אנונימי", "Anonymous")}</span> · {learningLabel(locale, claim.reference, claim.trackType)} · {formatTimestamp(claim.claimedAt, locale)}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-navy/10 p-3">
                          <h4 className="mb-2 font-medium text-navy">{label(locale, "דיווחים והודעות", "Reports and messages")}</h4>
                          <div className="space-y-2 text-xs">
                            {(projectDetail?.reports || []).slice(0, 4).map((report) => (
                              <div key={report.id} className="rounded-md bg-red-50 px-2 py-1.5 text-red-800">
                                <p className="font-medium">{reportReasonLabel(locale, report.reason)}</p>
                                {report.details && <p className="mt-1" dir={locale === "he" ? "rtl" : "ltr"}>{supportText(locale, report.details)}</p>}
                                {renderSupportMeta("report", report)}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "reviewing")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "בטיפול", "Review")}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "resolved")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "טופל", "Resolve")}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "סגור", "Dismiss")}</Button>
                                </div>
                                {renderSupportControls("report", report)}
                              </div>
                            ))}
                            {(projectDetail?.contactMessages || []).slice(0, 4).map((message) => (
                              <div key={message.id} className="rounded-md bg-cream/40 px-2 py-1.5 text-navy">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>{message.senderEmail || label(locale, "ללא אימייל", "No email")}</span>
                                  <Badge variant={message.delivered ? "secondary" : "destructive"}>{message.delivered ? label(locale, "נשלח", "Sent") : label(locale, "לא נשלח", "Not sent")}</Badge>
                                </div>
                                <p className="mt-1 line-clamp-3">{message.message}</p>
                                {renderSupportMeta("contact", message)}
                                {renderSupportControls("contact", message)}
                              </div>
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

            <TabsContent value="users">
              <div className="mb-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder={label(locale, "חיפוש לפי אימייל, שם, UID או פרויקט", "Search by email, name, UID, or project")}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="ghost" onClick={() => setUserSearch("")} disabled={!userSearch.trim()}>
                    {label(locale, "נקה", "Clear")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [label(locale, "חשבונות", "Accounts"), userSummaries.length],
                    [label(locale, "יוצרים", "Creators"), creatorCount],
                    [label(locale, "מנהלים", "Admins"), userAdminCount],
                    [label(locale, "בתוצאות", "Shown"), filteredUserSummaries.length],
                  ].map(([name, value]) => (
                    <div key={String(name)} className="rounded-lg border border-navy/10 bg-white p-3">
                      <p className="text-xs text-muted">{name}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {filteredUserSummaries.map((user) => (
                  <div key={user.uid} className="rounded-lg border border-navy/10 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-medium text-navy">{user.email || user.displayName || user.uid}</p>
                          {user.isSuperAdmin && <Badge variant="default">{label(locale, "מנהל ראשי", "Super")}</Badge>}
                          {!user.isSuperAdmin && user.isAdmin && <Badge variant="secondary">{label(locale, "מנהל", "Admin")}</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">{user.displayName || user.uid}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTarget(user.email || user.uid);
                          setTargetIsAdmin(user.isAdmin || user.isSuperAdmin);
                          setTargetIsSuper(user.isSuperAdmin);
                          setTargetPermissions(user.permissions.length ? user.permissions : ["projects", "feedback", "reports", "stats"]);
                          setSuperTab("admins");
                        }}
                      >
                        <Shield className="h-4 w-4" />
                        {label(locale, "הרשאות", "Permissions")}
                      </Button>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-cream/40 p-2">
                        <p className="text-xs text-muted">{label(locale, "פרויקטים", "Projects")}</p>
                        <p className="font-heading font-bold text-navy">{user.projectCount}</p>
                      </div>
                      <div className="rounded-md bg-cream/40 p-2">
                        <p className="text-xs text-muted">{label(locale, "בחירות", "Claims")}</p>
                        <p className="font-heading font-bold text-navy">{user.claimCount}</p>
                      </div>
                      <div className="rounded-md bg-cream/40 p-2">
                        <p className="text-xs text-muted">{label(locale, "הושלמו", "Completed")}</p>
                        <p className="font-heading font-bold text-navy">{user.completedClaimCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{label(locale, "פעילות אחרונה", "Last activity")}: {user.lastActivityAt ? formatTimestamp(user.lastActivityAt, locale) : label(locale, "לא ידוע", "Unknown")}</span>
                      <span>{label(locale, "פרויקטים פעילים", "Active projects")}: {user.activeProjectCount}</span>
                    </div>

                    {user.projects.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {user.projects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => inspectProject(project.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-md bg-gold/5 px-2 py-1.5 text-start text-xs transition hover:bg-gold/10"
                          >
                            <span className="min-w-0 truncate text-navy" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</span>
                            <span className="shrink-0 text-muted">{projectStatusLabel(locale, project.status)} · {Math.round(project.progressPct || 0)}%</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!filteredUserSummaries.length && (
                  <p className="py-8 text-center text-sm text-muted xl:col-span-2">{label(locale, "לא נמצאו משתמשים", "No users found")}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="support">
              <div className="mb-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={supportSearch}
                      onChange={(event) => setSupportSearch(event.target.value)}
                      placeholder={label(locale, "חיפוש במשוב, דיווחים והודעות", "Search feedback, reports, and messages")}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="ghost" onClick={() => setSupportSearch("")} disabled={!supportSearch.trim()}>
                    {label(locale, "נקה", "Clear")}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "משוב חדש", "New feedback")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{stats.newFeedback || 0}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "דיווחים פתוחים", "Open reports")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{stats.openReports || 0}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "הודעות פתוחות", "Open messages")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{stats.openContactMessages ?? stats.undeliveredContacts ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><Inbox className="mr-1 inline h-4 w-4" /> {label(locale, "משוב", "Feedback")}</h3>
                  {filteredFeedbackItems.length ? filteredFeedbackItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-navy/10 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === "new" ? "default" : "secondary"}>{feedbackStatusLabel(locale, item.status)}</Badge>
                          <span className="text-xs text-muted">{feedbackTypeLabel(locale, item.type)} · {formatTimestamp(item.submittedAt, locale)}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "read")} disabled={savingSupportItem === supportKey("feedback", item.id)}>{label(locale, "נקרא", "Read")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "open")} disabled={savingSupportItem === supportKey("feedback", item.id)}>{label(locale, "לטיפול", "Open")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateFeedbackStatus(item.id, "archived")} disabled={savingSupportItem === supportKey("feedback", item.id)}>{label(locale, "ארכיון", "Archive")}</Button>
                        </div>
                      </div>
                      <p className="text-sm text-navy" dir={item.locale === "he" || locale === "he" ? "rtl" : "ltr"}>{supportText(locale, item.message)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{item.email || label(locale, "ללא אימייל", "No email")}</span>
                        {item.currentPath && (
                          <a className="text-gold-deep underline-offset-2 hover:underline" href={item.currentPath} target="_blank" rel="noopener">
                            {item.currentPath}
                          </a>
                        )}
                      </div>
                      {renderSupportMeta("feedback", item)}
                      {renderSupportControls("feedback", item)}
                    </div>
                )) : (
                  <p className="py-6 text-center text-sm text-muted">{label(locale, "אין משוב עדיין", "No feedback yet")}</p>
                )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><AlertTriangle className="mr-1 inline h-4 w-4" /> {label(locale, "דיווחים", "Reports")}</h3>
                  {filteredReportItems.length ? filteredReportItems.map((report) => (
                    <div key={report.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant={report.status === "open" ? "destructive" : "secondary"}>{reportStatusLabel(locale, report.status)}</Badge>
                        <span className="text-xs text-muted">{formatTimestamp(report.reportedAt, locale)}</span>
                      </div>
                      <p className="font-medium text-navy">{reportReasonLabel(locale, report.reason)}</p>
                      <p className="text-xs text-muted">{report.projectSlug || report.projectId}</p>
                      {report.details && <p className="mt-2 text-navy" dir={locale === "he" ? "rtl" : "ltr"}>{supportText(locale, report.details)}</p>}
                      {renderSupportMeta("report", report)}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "reviewing")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "בטיפול", "Review")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "resolved")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "טופל", "Resolve")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")} disabled={savingSupportItem === supportKey("report", report.id)}>{label(locale, "סגור", "Dismiss")}</Button>
                      </div>
                      {renderSupportControls("report", report)}
                    </div>
                  )) : <p className="py-6 text-center text-sm text-muted">{label(locale, "אין דיווחים", "No reports")}</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="font-heading font-bold text-navy"><Mail className="mr-1 inline h-4 w-4" /> {label(locale, "הודעות למשפחות", "Family messages")}</h3>
                  {filteredContactItems.length ? filteredContactItems.map((message) => (
                    <div key={message.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant={message.delivered ? "secondary" : "destructive"}>{message.delivered ? label(locale, "נשלח", "Sent") : label(locale, "לא נשלח", "Not sent")}</Badge>
                        <span className="text-xs text-muted">{formatTimestamp(message.sentAt, locale)}</span>
                      </div>
                      <p className="text-xs text-muted">{message.senderEmail || label(locale, "ללא אימייל", "No email")} · {message.slug || message.projectId}</p>
                      <p className="mt-2 line-clamp-4 text-navy">{message.message}</p>
                      {renderSupportMeta("contact", message)}
                      {renderSupportControls("contact", message)}
                    </div>
                  )) : <p className="py-6 text-center text-sm text-muted">{label(locale, "אין הודעות", "No messages")}</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communications">
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={communicationsSearch}
                      onChange={(event) => setCommunicationsSearch(event.target.value)}
                      placeholder={label(locale, "חיפוש לפי אימייל, פרויקט, סוג תזכורת או שגיאה", "Search by email, project, reminder type, or error")}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="ghost" onClick={() => setCommunicationsSearch("")} disabled={!communicationsSearch.trim()}>
                    {label(locale, "נקה", "Clear")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    [label(locale, "ממתינות", "Pending"), stats.pendingReminderEmails],
                    [label(locale, "נכשלו", "Failed"), stats.failedReminderEmails],
                    [label(locale, "נשלחו", "Sent"), stats.sentReminderEmails],
                    [label(locale, "בתצוגה", "Loaded"), scheduledEmails.length],
                    [label(locale, "מסוננות", "Filtered"), filteredScheduledEmails.length],
                  ].map(([name, value]) => (
                    <div key={String(name)} className="rounded-lg border border-navy/10 bg-white p-3">
                      <p className="text-xs text-muted">{name}</p>
                      <p className="font-heading text-2xl font-bold text-navy">{Number(value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-navy/10 bg-white p-3">
                      <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "סטטוס התור", "Queue status")}</h3>
                      <div className="space-y-2">
                        {Object.entries(reminderStatusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-1.5 text-sm">
                            <span>{reminderStatusLabel(locale, status)}</span>
                            <span className="font-medium text-navy">{count}</span>
                          </div>
                        ))}
                        {!Object.keys(reminderStatusCounts).length && (
                          <p className="py-4 text-center text-sm text-muted">{label(locale, "אין תזכורות להצגה", "No reminders to show")}</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-navy/10 bg-white p-3">
                      <h3 className="mb-2 font-heading font-bold text-navy">{label(locale, "סוגי תזכורות", "Reminder types")}</h3>
                      <div className="space-y-2">
                        {Object.entries(reminderTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between rounded-md bg-cream/40 px-2 py-1.5 text-sm">
                            <span>{reminderTypeLabel(locale, type)}</span>
                            <span className="font-medium text-navy">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-heading font-bold text-navy">{label(locale, "תזכורות אחרונות", "Recent reminders")}</h3>
                        <p className="text-xs text-muted">
                          {label(locale, "תצוגה לקריאה בלבד מתוך lzecher_scheduled_emails.", "Read-only view from lzecher_scheduled_emails.")}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={exportScheduledEmailsCsv}>
                        <Download className="h-4 w-4" />
                        {label(locale, "ייצוא", "Export")}
                      </Button>
                    </div>
                    <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                      {filteredScheduledEmails.map((email) => (
                        <div key={email.id} className="rounded-lg border border-navy/10 bg-cream/30 p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={email.status === "failed" ? "destructive" : email.status === "sent" ? "secondary" : "default"}>
                                  {reminderStatusLabel(locale, email.status)}
                                </Badge>
                                <span className="font-medium text-navy">{reminderTypeLabel(locale, email.reminderType)}</span>
                              </div>
                              <p className="mt-1 truncate text-xs text-muted">{email.toEmail || label(locale, "ללא אימייל", "No email")}</p>
                            </div>
                            <div className="text-end text-xs text-muted">
                              <p>{label(locale, "שליחה", "Send")}: {email.sendAt ? formatTimestamp(email.sendAt, locale) : label(locale, "לא ידוע", "Unknown")}</p>
                              <p>{label(locale, "ניסיונות", "Attempts")}: {email.attempts}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                            {email.projectId && <span>{label(locale, "פרויקט", "Project")}: {email.projectId}</span>}
                            {email.projectSlug && <span>{label(locale, "קישור", "Slug")}: {email.projectSlug}</span>}
                            {email.claimId && <span>{label(locale, "בחירה", "Claim")}: {email.claimId}</span>}
                            <span>{label(locale, "שפה", "Locale")}: {email.locale}</span>
                          </div>
                          {email.lastError && (
                            <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700" dir={locale === "he" ? "rtl" : "ltr"}>
                              {friendlyEmailError(locale, email.lastError)}
                            </p>
                          )}
                        </div>
                      ))}
                      {!filteredScheduledEmails.length && (
                        <p className="py-8 text-center text-sm text-muted">{label(locale, "אין תזכורות שמתאימות לחיפוש", "No reminders match this search")}</p>
                      )}
                    </div>
                  </div>
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
                              <p className="whitespace-normal break-words font-medium text-navy sm:truncate" dir="rtl">{project.nameHebrew} {project.familyNameHebrew}</p>
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

            <TabsContent value="language">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-navy/10 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-2">
                    <Languages className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <h3 className="font-heading font-bold text-navy">{label(locale, "בדיקת שפה ותרגום", "Language QA")}</h3>
                      <p className="text-xs text-muted">
                        {label(locale, "בדיקה לקריאת קטלוגי התרגום בלבד: חסרים, שדות ריקים, מילים אסורות ואנגלית חשודה בעברית.", "Read-only scan of translation catalogs: missing keys, empty values, forbidden wording, and suspicious English inside Hebrew copy.")}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadTranslationAudit}>
                    <RotateCw className="h-4 w-4" />
                    {label(locale, "רענן", "Refresh")}
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {[
                    {
                      title: label(locale, "ניסוח שמתאים לעולם התורה", "Frum tone"),
                      detail: label(locale, "העדפה ללשון מכבדת, חמה ופשוטה: לעילוי נשמת, תזכו למצוות, יישר כח, בלי לשון תחרותית מדי.", "Prefer respectful, warm, simple language: l'iluy nishmas, tizku l'mitzvos, Yasher Koach, without overly competitive phrasing."),
                    },
                    {
                      title: label(locale, "מילים שצריך להימנע מהן", "Avoid list"),
                      detail: label(locale, "לא להשתמש בלשון משפטית או קרה, בכותרות משוב לא מתאימות, או בכותרות שמרגישות כמו דירוג תחרותי.", "Avoid cold or legal wording, awkward feedback labels, and headings that feel like competitive ranking."),
                    },
                    {
                      title: label(locale, "בדיקת RTL", "RTL review"),
                      detail: label(locale, "בכל שינוי בעברית בודקים שהכפתורים, הבועות, הטבלאות והמספרים לא מכסים טקסט ולא נראים הפוכים.", "Every Hebrew change should check buttons, bubbles, tables, and numbers for overlap and proper RTL alignment."),
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-lg border border-gold/20 bg-gold/5 p-3">
                      <p className="font-heading font-bold text-navy">{item.title}</p>
                      <p className="mt-1 text-xs text-muted">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "מפתחות", "Keys")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{translationAudit?.totalKeys || 0}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "חסרים", "Missing")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{translationMissingTotal}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "ריקים", "Empty")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{translationEmptyTotal}</p>
                  </div>
                  <div className={cn("rounded-lg border p-3", translationForbiddenTotal ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50")}>
                    <p className={cn("text-xs", translationForbiddenTotal ? "text-red-700" : "text-green-700")}>{label(locale, "מילים אסורות", "Forbidden")}</p>
                    <p className={cn("font-heading text-2xl font-bold", translationForbiddenTotal ? "text-red-800" : "text-green-800")}>{translationForbiddenTotal}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <h4 className="mb-2 font-medium text-navy">{label(locale, "מצב לפי שפה", "Locale status")}</h4>
                    <div className="space-y-2">
                      {(translationAudit?.locales || []).map((item) => (
                        <div key={item.locale} className="rounded-lg bg-cream/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium uppercase text-navy">{item.locale}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary">{item.totalKeys} {label(locale, "מפתחות", "keys")}</Badge>
                              <Badge variant={item.missingKeys.length ? "destructive" : "secondary"}>{item.missingKeys.length} {label(locale, "חסרים", "missing")}</Badge>
                              <Badge variant={item.emptyKeys.length ? "destructive" : "secondary"}>{item.emptyKeys.length} {label(locale, "ריקים", "empty")}</Badge>
                            </div>
                          </div>
                          {(item.missingKeys.length > 0 || item.emptyKeys.length > 0 || item.forbiddenHits.length > 0) && (
                            <div className="mt-2 space-y-1 text-xs text-muted">
                              {item.missingKeys.slice(0, 5).map((key) => <p key={`missing-${item.locale}-${key}`}>{label(locale, "חסר", "Missing")}: {key}</p>)}
                              {item.emptyKeys.slice(0, 5).map((key) => <p key={`empty-${item.locale}-${key}`}>{label(locale, "ריק", "Empty")}: {key}</p>)}
                              {item.forbiddenHits.slice(0, 5).map((hit) => <p key={`forbidden-${item.locale}-${hit.key}-${hit.phrase}`}>{label(locale, "אסור", "Forbidden")}: {hit.phrase} · {hit.key}</p>)}
                            </div>
                          )}
                        </div>
                      ))}
                      {!translationAudit && (
                        <p className="py-6 text-center text-sm text-muted">{label(locale, "בדיקת השפה נטענת...", "Language QA is loading...")}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-navy/10 bg-white p-3">
                      <h4 className="mb-2 font-medium text-navy">{label(locale, "אנגלית חשודה בעברית", "English in Hebrew copy")}</h4>
                      <div className="space-y-1.5">
                        {(translationAudit?.hebrewEnglishSamples || []).slice(0, 12).map((sample) => (
                          <div key={`${sample.key}-${sample.word}`} className="rounded-md bg-cream/40 px-2 py-1.5 text-xs">
                            <p className="font-medium text-navy">{sample.word} · {sample.key}</p>
                            <p className="mt-0.5 text-muted" dir="rtl">{sample.text}</p>
                          </div>
                        ))}
                        {translationAudit && translationAudit.hebrewEnglishSamples.length === 0 && (
                          <p className="py-4 text-center text-sm text-muted">{label(locale, "לא נמצאה אנגלית חשודה בעברית.", "No suspicious English found in Hebrew copy.")}</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-sm text-navy">
                      <p className="font-medium">{label(locale, "שומרי ניסוח", "Wording guards")}</p>
                      <p className="mt-1 text-xs text-muted">
                        {label(locale, "הבדיקה עוקבת במיוחד אחרי ניסוחים שכבר נפסלו: לשון משפטית מדי, כותרות תחרותיות מדי, וקטגוריות משוב שלא מתאימות לאופי האתר.", "The scan watches wording that was already rejected: overly legal phrasing, overly competitive headings, and feedback categories that do not fit the tone of the site.")}
                      </p>
                    </div>
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
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                      placeholder={label(locale, "חיפוש ביומן לפי פעולה, פרויקט או מנהל", "Search audit by action, project, or admin")}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="ghost" onClick={() => setAuditSearch("")} disabled={!auditSearch.trim()}>
                    {label(locale, "נקה", "Clear")}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "רשומות נטענו", "Loaded entries")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{auditEntries.length}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "סוגי פעולות", "Action types")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{auditActions.length}</p>
                  </div>
                  <div className="rounded-lg border border-navy/10 bg-white p-3">
                    <p className="text-xs text-muted">{label(locale, "בתצוגה", "Shown")}</p>
                    <p className="font-heading text-2xl font-bold text-navy">{filteredAuditEntries.length}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {auditActions.slice(0, 12).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setAuditSearch(action)}
                      className="rounded-full border border-navy/10 bg-white px-2.5 py-1 text-xs text-navy transition hover:border-gold/40 hover:bg-gold/10"
                    >
                      {action}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredAuditEntries.length ? filteredAuditEntries.map((entry) => {
                    const expanded = expandedAuditId === entry.id;
                    return (
                      <div key={entry.id} className="rounded-lg border border-navy/10 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button type="button" onClick={() => setExpandedAuditId(expanded ? null : entry.id)} className="text-start font-medium text-navy">
                            {entry.action}
                          </button>
                          <span className="text-xs text-muted">{formatTimestamp(entry.at, locale)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>{entry.adminUid || label(locale, "ללא מנהל", "No admin")}</span>
                          {entry.projectId && (
                            <button type="button" onClick={() => inspectProject(entry.projectId!)} className="rounded-full bg-cream px-2 py-0.5 text-navy">
                              {entry.projectId}
                            </button>
                          )}
                          {entry.targetUid && <span>· {entry.targetUid}</span>}
                          {entry.feedbackId && <span>· {entry.feedbackId}</span>}
                        </div>
                        {expanded && (
                          <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-navy p-3 text-xs text-cream" dir="ltr">
                            {JSON.stringify(entry.details || {}, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="py-6 text-center text-sm text-muted">{label(locale, "אין רשומות שמתאימות לחיפוש", "No audit entries match this search")}</p>
                  )}
                </div>
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
                      {label(locale, "עודכן לאחרונה", "Last updated")}: {formatTimestamp(siteSettings.updatedAt, locale)}
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
