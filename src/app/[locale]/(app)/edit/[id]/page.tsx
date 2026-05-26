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

const ALL_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos", "daf_yomi"];
const TRACK_LABELS: Record<TrackType, string> = {
  mishnayos: "משניות",
  tehillim: "תהילים",
  shnayim_mikra: "שניים מקרא",
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
  const [isPublic, setIsPublic] = useState(true);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [repeatingSetEnabled, setRepeatingSetEnabled] = useState(true);
  const [originalTracks, setOriginalTracks] = useState<TrackType[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<TrackType[]>([]);

  // Danger zone
  const [resetConfirm, setResetConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showResetSection, setShowResetSection] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login" as "/login"); return; }
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) { toast.error("Session expired"); setLoading(false); return; }
        const res = await fetch(`/api/projects/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403) { toast.error("Not authorized"); router.push("/dashboard" as "/dashboard"); return; }
          if (res.status === 404) { toast.error("Project not found"); router.push("/dashboard" as "/dashboard"); return; }
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
        setIsPublic(data.isPublic !== false);
        setAllowAnonymous(data.allowAnonymous !== false);
        setRepeatingSetEnabled(data.repeatingSetEnabled !== false);
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        setOriginalTracks(tracks);
        setSelectedTracks(tracks);
      } catch (err) {
        console.error("[edit] load failed", err);
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, profile, id, router]);

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
      if (!idToken) { toast.error("Session expired"); return; }

      const updates: Record<string, unknown> = {
        nameHebrew, familyNameHebrew,
        nameEnglish: nameEnglish || null,
        familyNameEnglish: familyNameEnglish || null,
        fatherNameHebrew: fatherNameHebrew || null,
        motherNameHebrew: motherNameHebrew || null,
        honorific, gender,
        biography: biography || null,
        familyMessage: familyMessage || null,
        isPublic, allowAnonymous, repeatingSetEnabled,
      };

      const trackChanges: { add?: TrackType[]; remove?: TrackType[]; confirmDestructive?: string } = {};
      const added = selectedTracks.filter(t => !originalTracks.includes(t));
      const removed = originalTracks.filter(t => !selectedTracks.includes(t));
      if (added.length > 0) trackChanges.add = added;
      if (removed.length > 0) trackChanges.remove = removed;

      let res = await fetch(`/api/projects/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, trackChanges, idToken }),
      });
      let data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.hasClaims) {
        const confirmText = locale === "he"
          ? `טראק זה כולל ${data.activeCount} קבלות פעילות ו-${data.completedCount} הושלמו. הסרה תמחק אותם.\n\nהזן את מזהה הפרויקט לאישור: ${id}`
          : `This track has ${data.activeCount} active + ${data.completedCount} completed claims. Removing will delete them.\n\nType the project ID to confirm: ${id}`;
        const typed = window.prompt(confirmText);
        if (typed !== id) { toast.error("Confirmation mismatch"); setSaving(false); return; }
        trackChanges.confirmDestructive = id;
        res = await fetch(`/api/projects/${id}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates, trackChanges, idToken }),
        });
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) { toast.error(data.error || "Save failed"); return; }
      toast.success(locale === "he" ? "השינויים נשמרו" : "Changes saved");
      setOriginalTracks(selectedTracks);
    } catch (err) {
      console.error("[edit] save failed", err);
      toast.error("Save failed");
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
      if (!res.ok) { toast.error(data.error || "Reset failed"); return; }
      toast.success(locale === "he" ? "כל החלוקה אופסה" : "All claims reset");
      setResetConfirm("");
      setShowResetSection(false);
    } catch (err) {
      console.error("[edit] reset failed", err);
      toast.error("Reset failed");
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
      if (!res.ok) { toast.error(data.error || "Delete failed"); return; }
      toast.success(locale === "he" ? "ההנצחה נמחקה" : "Memorial deleted");
      router.push("/dashboard" as "/dashboard");
    } catch (err) {
      console.error("[edit] delete failed", err);
      toast.error("Delete failed");
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
              <label className="text-sm font-medium text-navy mb-1 block">הספד / כינוי</label>
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
            <label className="text-sm font-medium text-navy mb-1 block">הספד / תיאור</label>
            <Textarea value={biography} onChange={e => setBiography(e.target.value.slice(0, 2000))} rows={4} dir={locale === "he" ? "rtl" : "ltr"} />
            <p className="text-xs text-muted mt-1">{biography.length}/2000</p>
          </div>
          <div>
            <label className="text-sm font-medium text-navy mb-1 block">הודעה לבני המשפחה</label>
            <Textarea value={familyMessage} onChange={e => setFamilyMessage(e.target.value)} rows={2} dir={locale === "he" ? "rtl" : "ltr"} />
          </div>

          {/* Tracks */}
          <div>
            <label className="text-sm font-medium text-navy mb-2 block">טראקים</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TRACKS.map(track => (
                <button key={track} onClick={() => toggleTrack(track)}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all",
                    selectedTracks.includes(track) ? "border-gold bg-gold/5 text-navy" : "border-navy/10 text-muted hover:border-navy/20")}>
                  {TRACK_LABELS[track]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1">הסרת טראק עם קבלות תדרוש אישור</p>
          </div>

          {/* Toggles */}
          <div className="space-y-3 border-t border-navy/5 pt-4">
            {[
              { label: "הנצחה ציבורית", value: isPublic, onChange: setIsPublic },
              { label: "אפשר קבלות ללא חשבון", value: allowAnonymous, onChange: setAllowAnonymous },
              { label: "אפשר סטים חוזרים (משניות / תהילים)", value: repeatingSetEnabled, onChange: setRepeatingSetEnabled },
            ].map(({ label, value, onChange }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-navy">{label}</span>
                  {label.includes("סטים") && (
                    <p className="text-xs text-muted">כשהסט מתמלא, ייפתח סט חדש אוטומטית</p>
                  )}
                </div>
                <Switch checked={value} onCheckedChange={onChange} />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => router.push("/dashboard" as "/dashboard")} disabled={saving}>ביטול</Button>
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
              <CardTitle className="text-base text-amber-700">אפס את כל החלוקה</CardTitle>
              <CardDescription>מחק את כל הקבלות ואפס לנקודת ההתחלה</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowResetSection(!showResetSection)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
              {showResetSection ? "הסתר" : "אפס"}
            </Button>
          </div>
        </CardHeader>
        {showResetSection && (
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 leading-relaxed" dir="rtl">
              <strong>⚠️ אזהרה:</strong> פעולה זו תמחק את כל {claimedCount} החלקים שנלקחו ותתחיל מחדש. לא ניתן לבטל.
            </div>
            <div>
              <label className="text-sm text-navy mb-1 block" dir="rtl">להמשיך, הזן <strong>"אפס"</strong> (או "reset")</label>
              <Input dir="rtl" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder='אפס' className="max-w-[200px]" />
            </div>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={handleResetClaims}
              disabled={resetting || (resetConfirm !== "אפס" && resetConfirm !== "reset")}
            >
              {resetting ? <Spinner className="h-4 w-4" /> : "אפס את כל החלוקה"}
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
              <strong>⛔ פעולה בלתי הפיכה:</strong> פעולה זו תמחק לצמיתות את ההנצחה של <strong>{honoree}</strong> ואת כל {claimedCount} הקבלות. לא ניתן לשחזר.
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
