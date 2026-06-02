"use client";

import { useEffect, useState, use } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos"];
const TRACK_LABELS: Record<TrackType, string> = {
  mishnayos: "משניות",
  tehillim: "תהילים",
  shnayim_mikra: "שניים מקרא ואחד תרגום",
  kabalos: "קבלות",
  daf_yomi: "דף יומי",
};

export default function CreatorEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = use(params);
  const locale = useLocale();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);

  // Editable fields
  const [nameHebrew, setNameHebrew] = useState("");
  const [familyNameHebrew, setFamilyNameHebrew] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [familyNameEnglish, setFamilyNameEnglish] = useState("");
  const [fatherNameHebrew, setFatherNameHebrew] = useState("");
  const [motherNameHebrew, setMotherNameHebrew] = useState("");
  const [honorific, setHonorific] = useState("ז״ל");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [biography, setBiography] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [repeatingSetEnabled, setRepeatingSetEnabled] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  // Protection + attribution + admin display
  const [passwordCurrentlySet, setPasswordCurrentlySet] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [startedByText, setStartedByText] = useState("");
  const [startedByVisible, setStartedByVisible] = useState(false);
  const [memorialWallConsent, setMemorialWallConsent] = useState<boolean | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [customDedication, setCustomDedication] = useState("");
  const [locked, setLocked] = useState(false);
  const [originalTracks, setOriginalTracks] = useState<TrackType[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<TrackType[]>([]);

  // Danger zone
  const [resetConfirm, setResetConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showResetSection, setShowResetSection] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login" as const); return; }
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) { toast.error(locale === "he" ? "פג תוקף ההתחברות" : "Sign-in expired"); setLoading(false); return; }
        const res = await fetch(`/api/projects/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403) { toast.error(locale === "he" ? "אין לך הרשאה לערוך הנצחה זו" : "Not authorized"); router.push("/dashboard" as const); return; }
          if (res.status === 404) { toast.error(locale === "he" ? "ההנצחה לא נמצאה" : "Project not found"); router.push("/dashboard" as const); return; }
          throw new Error(errData.error || "Load failed");
        }
        const data = await res.json();
        setProject(data);
        setNameHebrew(data.nameHebrew || "");
        setFamilyNameHebrew(data.familyNameHebrew || "");
        setNameEnglish(data.nameEnglish || "");
        setFamilyNameEnglish(data.familyNameEnglish || "");
        setFatherNameHebrew(data.fatherNameHebrew || "");
        setMotherNameHebrew(data.motherNameHebrew || "");
        setHonorific(data.honorific || "ז״ל");
        setGender(data.gender || "male");
        setBiography(data.biography || "");
        setFamilyMessage(data.familyMessage || "");
        setShareMessage(data.shareMessage || "");
        setIsPublic(data.isPublic !== false);
        setRepeatingSetEnabled(data.repeatingSetEnabled !== false);
        setShowLeaderboard(data.showLeaderboard !== false);
        setPasswordCurrentlySet(Boolean(data.isPasswordProtected));
        setStartedByText(data.startedByText || "");
        setStartedByVisible(Boolean(data.startedByVisible));
        setMemorialWallConsent(typeof data.memorialWallConsent === "boolean" ? data.memorialWallConsent : null);
        setAnnouncement(data.announcement || "");
        setCustomDedication(data.customDedication || "");
        setLocked(Boolean(data.locked));
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        setOriginalTracks(tracks);
        setSelectedTracks(tracks);
      } catch (err) {
        console.error("[edit] load failed", err);
        toast.error(locale === "he" ? "לא ניתן לטעון את ההנצחה" : "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, profile, id, router, locale]);

  function toggleTrack(track: TrackType) {
    setSelectedTracks(prev => prev.includes(track) ? prev.filter(t => t !== track) : [...prev, track]);
  }

  async function handleSave() {
    if (!project || !nameHebrew.trim() || !familyNameHebrew.trim()) {
      toast.error("שם הנפטר הוא שדה חובה");
      return;
    }
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) { toast.error(locale === "he" ? "פג תוקף ההתחברות" : "Sign-in expired"); return; }

      const updates: Record<string, unknown> = {
        nameHebrew, familyNameHebrew,
        nameEnglish: nameEnglish || null,
        familyNameEnglish: familyNameEnglish || null,
        fatherNameHebrew: fatherNameHebrew || null,
        motherNameHebrew: motherNameHebrew || null,
        honorific, gender,
        biography: biography || null,
        familyMessage: familyMessage || null,
        shareMessage: shareMessage.trim() || null,
        isPublic, repeatingSetEnabled, showLeaderboard,
        ...(memorialWallConsent !== null ? { memorialWallConsent } : {}),
        startedByText: startedByText.trim() || null,
        startedByVisible,
        announcement: announcement.trim() || null,
        customDedication: customDedication.trim() || null,
        locked,
      };

      // Password: only send when changing (set new or remove). Omit to keep unchanged.
      let passwordArg: string | undefined;
      if (removePassword) passwordArg = "";
      else if (newPassword.trim()) passwordArg = newPassword.trim();

      const trackChanges: { add?: TrackType[]; remove?: TrackType[]; confirmDestructive?: string } = {};
      const added = selectedTracks.filter(t => !originalTracks.includes(t));
      const removed = originalTracks.filter(t => !selectedTracks.includes(t));
      if (added.length > 0) trackChanges.add = added;
      if (removed.length > 0) trackChanges.remove = removed;

      let res = await fetch(`/api/projects/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, trackChanges, idToken, password: passwordArg }),
      });
      let data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.hasClaims) {
        const confirmText = locale === "he"
          ? `מסלול לימוד זה כולל ${data.activeCount} חלקים בלימוד ו-${data.completedCount} חלקים שנלמדו. הסרה תמחק אותם.\n\nהזן את מזהה הפרויקט לאישור: ${id}`
          : `This learning track has ${data.activeCount} active participant entries + ${data.completedCount} learned portions. Removing it will delete them.\n\nType the project ID to confirm: ${id}`;
        const typed = window.prompt(confirmText);
        if (typed !== id) { toast.error(locale === "he" ? "האישור לא תאם" : "Confirmation mismatch"); setSaving(false); return; }
        trackChanges.confirmDestructive = id;
        res = await fetch(`/api/projects/${id}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates, trackChanges, idToken, password: passwordArg }),
        });
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        toast.error(locale === "he" ? "לא ניתן לשמור את השינויים" : (data.error || "Save failed"));
        return;
      }
      toast.success(locale === "he" ? "השינויים נשמרו" : "Changes saved");
      setOriginalTracks(selectedTracks);
      if (passwordArg !== undefined) {
        setPasswordCurrentlySet(passwordArg !== "");
        setNewPassword("");
        setRemovePassword(false);
      }
    } catch (err) {
      console.error("[edit] save failed", err);
      toast.error(locale === "he" ? "לא ניתן לשמור את השינויים" : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetClaims() {
    if (resetConfirm !== "אפס" && resetConfirm !== "reset") {
      toast.error(locale === "he" ? 'הזן "אפס" לאישור' : 'Type "reset" to confirm');
      return;
    }
    setResetting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/projects/${id}/reset-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmation: resetConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(locale === "he" ? "לא ניתן לאפס את חלוקת הלימוד" : (data.error || "Reset failed"));
        return;
      }
      toast.success(locale === "he" ? "כל חלוקת הלימוד אופסה" : "All learning assignments reset");
      setResetConfirm("");
      setShowResetSection(false);
    } catch (err) {
      console.error("[edit] reset failed", err);
      toast.error(locale === "he" ? "לא ניתן לאפס את חלוקת הלימוד" : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    const expectedName = (project?.nameHebrew as string || "").trim();
    if (deleteConfirm.trim() !== expectedName) {
      toast.error(locale === "he" ? `הזן "${expectedName}" לאישור` : `Type "${expectedName}" to confirm`);
      return;
    }
    setDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/projects/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, confirmation: deleteConfirm.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(locale === "he" ? "לא ניתן למחוק את ההנצחה" : (data.error || "Delete failed"));
        return;
      }
      toast.success(locale === "he" ? "ההנצחה נמחקה" : "Memorial deleted");
      router.push("/dashboard" as const);
    } catch (err) {
      console.error("[edit] delete failed", err);
      toast.error(locale === "he" ? "לא ניתן למחוק את ההנצחה" : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  if (!project) return null;

  const honoree = `${project.nameHebrew} ${project.familyNameHebrew || ""}`.trim();
  const claimedCount = (project.claimedPortions as number) || 0;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      {/* Main edit card */}
      <Card>
        <CardHeader>
          <CardTitle dir="rtl">ערוך הנצחה</CardTitle>
          <CardDescription dir="rtl">
            הנצחת {honoree} · <code className="text-xs">{(project.slug as string) || id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם פרטי בעברית *</label>
              <Input dir="rtl" value={nameHebrew} onChange={e => setNameHebrew(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם משפחה בעברית *</label>
              <Input dir="rtl" value={familyNameHebrew} onChange={e => setFamilyNameHebrew(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם פרטי באנגלית</label>
              <Input value={nameEnglish} onChange={e => setNameEnglish(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם משפחה באנגלית</label>
              <Input value={familyNameEnglish} onChange={e => setFamilyNameEnglish(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם האב</label>
              <Input dir="rtl" value={fatherNameHebrew} onChange={e => setFatherNameHebrew(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">שם האם</label>
              <Input dir="rtl" value={motherNameHebrew} onChange={e => setMotherNameHebrew(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">תואר לאחר השם</label>
              <Input dir="rtl" value={honorific} onChange={e => setHonorific(e.target.value)} className="max-w-[120px]" placeholder="ז״ל" />
            </div>
            <div className="flex gap-2">
              {(["male", "female"] as const).map(g => (
                <button key={g} onClick={() => { setGender(g); setHonorific(g === "female" ? "ע״ה" : "ז״ל"); }}
                  className={cn("px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    gender === g ? "border-gold bg-gold/5 text-navy" : "border-navy/10 text-muted hover:border-navy/20")}>
                  {g === "male" ? "זכר" : "נקבה"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-navy mb-1 block">דברי זיכרון / תיאור</label>
            <Textarea value={biography} onChange={e => setBiography(e.target.value.slice(0, 2000))} rows={4} dir={locale === "he" ? "rtl" : "ltr"} />
            <p className="text-xs text-muted mt-1">{biography.length}/2000</p>
          </div>
          <div>
            <label className="text-sm font-medium text-navy mb-1 block">הודעה לבני המשפחה</label>
            <Textarea value={familyMessage} onChange={e => setFamilyMessage(e.target.value)} rows={2} dir={locale === "he" ? "rtl" : "ltr"} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy mb-1 block">נוסח שיתוף</label>
            <Textarea
              value={shareMessage}
              onChange={e => setShareMessage(e.target.value.slice(0, 2000))}
              rows={4}
              dir={locale === "he" ? "rtl" : "ltr"}
              placeholder="הנוסח שכפתור השיתוף הציבורי ישתמש בו. אפשר להשאיר {link} במקום שבו הקישור אמור להופיע."
            />
            <p className="text-xs text-muted mt-1">כפתור השיתוף בדף ההנצחה ישתמש בנוסח הזה. אם לא תכתבו {"{link}"}, הקישור יתווסף בסוף.</p>
          </div>

          <div className="rounded-xl border border-gold/25 bg-cream/50 p-4" dir="rtl">
            <p className="font-medium text-navy">הצגת הנפטר/ת בקיר ההנצחה הכללי</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              האם תרצו ששם הנפטר/ת ותאריך הפטירה יופיעו בעתיד בלוח הזיכרון המרכזי של האתר, כך שגולשים אחרים יוכלו להיכנס וללמוד לעילוי נשמתם?
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { value: true, label: "כן, אפשר להציג בעתיד" },
                { value: false, label: "לא, להשאיר רק בדף שלי" },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setMemorialWallConsent(option.value)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all",
                    memorialWallConsent === option.value
                      ? "border-gold bg-gold/10 text-navy"
                      : "border-navy/10 text-muted hover:border-navy/20"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              הבחירה נשמרת עם פרטי היוצר לצורך תיעוד הסכמה בלבד. אין עדיין פרסום חדש בלוח מרכזי.
            </p>
          </div>

          {/* Tracks */}
          <div>
            <label className="text-sm font-medium text-navy mb-2 block">מסלולי לימוד</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TRACKS.map(track => (
                <button key={track} onClick={() => toggleTrack(track)}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all",
                    selectedTracks.includes(track) ? "border-gold bg-gold/5 text-navy" : "border-navy/10 text-muted hover:border-navy/20")}>
                  {TRACK_LABELS[track]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1">הסרת מסלול עם חלקים שכבר נבחרו תדרוש אישור</p>
          </div>

          {/* Toggles */}
          <div className="space-y-3 border-t border-navy/5 pt-4">
            {[
              { label: "הנצחה ציבורית", value: isPublic, onChange: setIsPublic },
              { label: "אפשר מחזורים חוזרים (משניות / תהילים)", value: repeatingSetEnabled, onChange: setRepeatingSetEnabled },
              { label: "הצג יישר כח בעמוד", value: showLeaderboard, onChange: setShowLeaderboard },
            ].map(({ label, value, onChange }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-navy">{label}</span>
                  {label.includes("מחזורים") && (
                    <p className="text-xs text-muted">כשהמחזור מתמלא, ייפתח מחזור חדש אוטומטית</p>
                  )}
                  {label.includes("יישר כח") && (
                    <p className="text-xs text-muted">מומלץ להשאיר פעיל כדי לעודד משתתפים לקחת עוד לימוד.</p>
                  )}
                </div>
                <Switch checked={value} onCheckedChange={onChange} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => router.push("/dashboard" as const)} disabled={saving}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "שמור שינויים"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protection, attribution & page controls */}
      <Card>
        <CardHeader>
          <CardTitle dir="rtl" className="text-base">הגנה, ייחוס וכלי עמוד</CardTitle>
          <CardDescription dir="rtl">סיסמה, &quot;הוקם על ידי&quot;, הודעה והקפאת הצטרפות</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Password */}
          <div>
            <label className="text-sm font-medium text-navy mb-1 block" dir="rtl">
              סיסמה {passwordCurrentlySet ? "· (מוגדרת כעת)" : "· (אין סיסמה — פתוח לכולם)"}
            </label>
            <Input
              type="text"
              dir="rtl"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); if (e.target.value) setRemovePassword(false); }}
              placeholder={passwordCurrentlySet ? "הזן סיסמה חדשה לשינוי" : "הגדר סיסמה (מילה או ביטוי)"}
              autoComplete="off"
              disabled={removePassword}
            />
            {passwordCurrentlySet && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer" dir="rtl">
                <Switch checked={removePassword} onCheckedChange={(v) => { setRemovePassword(v); if (v) setNewPassword(""); }} />
                <span className="text-xs text-muted">הסר סיסמה (הפוך לפתוח לכולם)</span>
              </label>
            )}
          </div>

          {/* Started by */}
          <div>
            <label className="text-sm font-medium text-navy mb-1 block" dir="rtl">הוקם על ידי</label>
            <Input dir="rtl" value={startedByText} onChange={e => setStartedByText(e.target.value)} placeholder="לדוגמה: משפחת כהן" />
            <label className="flex items-center gap-2 mt-2 cursor-pointer" dir="rtl">
              <Switch checked={startedByVisible} onCheckedChange={setStartedByVisible} />
              <span className="text-xs text-muted">הצג בעמוד ההנצחה</span>
            </label>
          </div>

          {/* Announcement */}
          <div>
            <label className="text-sm font-medium text-navy mb-1 block" dir="rtl">הודעה מוצמדת</label>
            <Textarea dir="rtl" value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={2} placeholder="לדוגמה: סיימנו 80% — תודה לכולם!" />
          </div>

          {/* Custom dedication */}
          <div>
            <label className="text-sm font-medium text-navy mb-1 block" dir="rtl">הקדשה בראש העמוד</label>
            <Textarea dir="rtl" value={customDedication} onChange={e => setCustomDedication(e.target.value)} rows={2} />
          </div>

          {/* Lock */}
          <div className="flex items-center justify-between border-t border-navy/5 pt-4">
            <div>
              <span className="text-sm font-medium text-navy" dir="rtl">נעל את ההנצחה (עצור הצטרפות חדשה)</span>
              <p className="text-xs text-muted" dir="rtl">ההנצחה נשארת לצפייה; לא ניתן לבחור חלקים חדשים</p>
            </div>
            <Switch checked={locked} onCheckedChange={setLocked} />
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "שמור שינויים"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Claims */}
      <Card className="border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-amber-700">אפס את כל חלוקת הלימוד</CardTitle>
              <CardDescription>מחק את כל השיוכים ואפס לנקודת ההתחלה</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowResetSection(!showResetSection)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
              {showResetSection ? "הסתר" : "אפס"}
            </Button>
          </div>
        </CardHeader>
        {showResetSection && (
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 leading-relaxed" dir="rtl">
              <strong>⚠️ אזהרה:</strong> פעולה זו תמחק את כל {claimedCount} החלקים שנבחרו ללימוד ותתחיל מחדש. לא ניתן לבטל.
            </div>
            <div>
              <label className="text-sm text-navy mb-1 block" dir="rtl">להמשיך, הזן <strong>&quot;אפס&quot;</strong> (או &quot;reset&quot;)</label>
              <Input dir="rtl" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder='אפס' className="max-w-[200px]" />
            </div>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={handleResetClaims}
              disabled={resetting || (resetConfirm !== "אפס" && resetConfirm !== "reset")}
            >
              {resetting ? <Spinner className="h-4 w-4" /> : "אפס את כל חלוקת הלימוד"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Delete Project */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-red-700">מחק הנצחה</CardTitle>
              <CardDescription>מחק לצמיתות את ההנצחה ואת כל הנתונים</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteSection(!showDeleteSection)} className="border-red-300 text-red-600 hover:bg-red-50">
              {showDeleteSection ? "הסתר" : "מחק"}
            </Button>
          </div>
        </CardHeader>
        {showDeleteSection && (
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 leading-relaxed" dir="rtl">
              <strong>⛔ פעולה בלתי הפיכה:</strong> פעולה זו תמחק לצמיתות את ההנצחה של <strong>{honoree}</strong> ואת כל {claimedCount} רשומות ההשתתפות. לא ניתן לשחזר.
            </div>
            <div>
              <label className="text-sm text-navy mb-1 block" dir="rtl">להמשיך, הזן את שם הנפטר: <strong dir="rtl">{project.nameHebrew as string}</strong></label>
              <Input dir="rtl" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={(project.nameHebrew as string) || ""} />
            </div>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm.trim() !== (project.nameHebrew as string || "").trim()}
            >
              {deleting ? <Spinner className="h-4 w-4" /> : "מחק לצמיתות"}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
