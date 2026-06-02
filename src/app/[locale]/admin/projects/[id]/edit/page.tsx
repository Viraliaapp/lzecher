"use client";

import { useEffect, useState, use } from "react";
import { useTranslations, useLocale } from "next-intl";
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

const ALL_TRACKS: TrackType[] = ["mishnayos", "tehillim", "shnayim_mikra", "kabalos"];

export default function AdminEditProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin");
  const tc = useTranslations("create");
  const router = useRouter();
  const locale = useLocale();
  const { profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);

  const [nameHebrew, setNameHebrew] = useState("");
  const [familyNameHebrew, setFamilyNameHebrew] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [familyNameEnglish, setFamilyNameEnglish] = useState("");
  const [fatherNameHebrew, setFatherNameHebrew] = useState("");
  const [motherNameHebrew, setMotherNameHebrew] = useState("");
  const [honorific, setHonorific] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [biography, setBiography] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [memorialWallConsent, setMemorialWallConsent] = useState<boolean | null>(null);

  const [originalTracks, setOriginalTracks] = useState<TrackType[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<TrackType[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.isAdmin && !profile?.isSuperAdmin) {
      router.push("/" as const);
      return;
    }
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) {
          toast.error(locale === "he" ? "פג תוקף ההתחברות" : "Sign in expired");
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/projects/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) {
          toast.error(locale === "he" ? "ההנצחה לא נמצאה" : "Project not found");
          router.push("/admin" as const);
          return;
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
        setShowLeaderboard(data.showLeaderboard !== false);
        setMemorialWallConsent(typeof data.memorialWallConsent === "boolean" ? data.memorialWallConsent : null);
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        setOriginalTracks(tracks);
        setSelectedTracks(tracks);
      } catch (err) {
        console.error("[admin/edit] load failed", err);
        toast.error(locale === "he" ? "לא ניתן לטעון את ההנצחה" : "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, profile, id, router, locale]);

  function toggleTrack(track: TrackType) {
    setSelectedTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    );
  }

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error(locale === "he" ? "פג תוקף ההתחברות" : "Sign in expired");
        return;
      }

      const updates: Record<string, unknown> = {
        nameHebrew,
        familyNameHebrew,
        nameEnglish: nameEnglish || null,
        familyNameEnglish: familyNameEnglish || null,
        fatherNameHebrew: fatherNameHebrew || null,
        motherNameHebrew: motherNameHebrew || null,
        honorific,
        gender,
        biography: biography || null,
        familyMessage: familyMessage || null,
        shareMessage: shareMessage.trim() || null,
        isPublic,
        showLeaderboard,
        ...(memorialWallConsent !== null ? { memorialWallConsent } : {}),
      };
      const trackChanges: { add?: TrackType[]; remove?: TrackType[]; confirmDestructive?: string } = {};
      const added = selectedTracks.filter((t) => !originalTracks.includes(t));
      const removed = originalTracks.filter((t) => !selectedTracks.includes(t));
      if (added.length > 0) trackChanges.add = added;
      if (removed.length > 0) trackChanges.remove = removed;

      // First attempt — server returns 409 if a removal would be destructive
      let res = await fetch(`/api/admin/projects/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, trackChanges, idToken }),
      });
      let data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.hasClaims) {
        const yes = window.confirm(
          `${t("editProject.destructiveWarning") || "DESTRUCTIVE: this removes a track with"} ${data.activeCount} active participant entries + ${data.completedCount} learned portions.\n\n` +
            `${t("editProject.typeProjectIdToConfirm") || "Type the project ID to confirm"}: ${id}`
        );
        if (!yes) {
          setSaving(false);
          return;
        }
        const typed = window.prompt(
          locale === "he"
            ? `הקלד "${id}" כדי לאשר הסרת מסלול עם נתוני משתתפים:`
            : `Type "${id}" to confirm destructive track removal:`
        );
        if (typed !== id) {
          toast.error(t("editProject.confirmationMismatch") || "Confirmation did not match");
          setSaving(false);
          return;
        }
        trackChanges.confirmDestructive = id;
        res = await fetch(`/api/admin/projects/${id}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates, trackChanges, idToken }),
        });
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        toast.error(locale === "he" ? "לא ניתן לשמור את השינויים" : (data.error || "Save failed"));
        return;
      }
      toast.success(t("editProject.saved") || "Saved");
      router.push("/admin" as const);
    } catch (err) {
      console.error("[admin/edit] save failed", err);
      toast.error(locale === "he" ? "לא ניתן לשמור את השינויים" : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  }
  if (!project) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("editProject.title") || "Edit project"}</CardTitle>
          <CardDescription>
            {t("editProject.slug") || "Slug"}: <code className="text-xs">{(project.slug as string) || id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("nameHebrew")}</label>
              <Input dir="rtl" value={nameHebrew} onChange={(e) => setNameHebrew(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("familyNameHebrew")}</label>
              <Input dir="rtl" value={familyNameHebrew} onChange={(e) => setFamilyNameHebrew(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("nameEnglish")}</label>
              <Input value={nameEnglish} onChange={(e) => setNameEnglish(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("familyNameEnglish")}</label>
              <Input value={familyNameEnglish} onChange={(e) => setFamilyNameEnglish(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("fatherName")}</label>
              <Input dir="rtl" value={fatherNameHebrew} onChange={(e) => setFatherNameHebrew(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{tc("motherName")}</label>
              <Input dir="rtl" value={motherNameHebrew} onChange={(e) => setMotherNameHebrew(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-navy mb-1 block">{tc("honorific")}</label>
            <Input dir="rtl" value={honorific} onChange={(e) => setHonorific(e.target.value)} className="max-w-[200px]" />
          </div>

          <div>
            <label className="text-sm font-medium text-navy mb-2 block">{tc("gender")}</label>
            <div className="flex gap-3">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={
                    "flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all " +
                    (gender === g
                      ? "border-gold bg-gold/5 text-navy"
                      : "border-navy/10 text-muted hover:border-navy/20")
                  }
                >
                  {tc(g)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-navy mb-1 block">{tc("biography") || "Biography"}</label>
            <Textarea value={biography} onChange={(e) => setBiography(e.target.value)} rows={4} dir={locale === "he" ? "rtl" : "ltr"} />
          </div>

          <div>
            <label className="text-sm font-medium text-navy mb-1 block">{tc("familyMessage") || "Family message"}</label>
            <Textarea value={familyMessage} onChange={(e) => setFamilyMessage(e.target.value)} rows={2} dir={locale === "he" ? "rtl" : "ltr"} />
          </div>
          <div>
            <label className="text-sm font-medium text-navy mb-1 block">{locale === "he" ? "נוסח שיתוף" : "Share text"}</label>
            <Textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value.slice(0, 2000))}
              rows={4}
              dir={locale === "he" ? "rtl" : "ltr"}
              placeholder={locale === "he" ? "הנוסח שכפתור השיתוף הציבורי ישתמש בו. אפשר להשאיר {link} במקום הקישור." : "Text used by the public share button. Use {link} where the link should appear."}
            />
            <p className="text-xs text-muted mt-1" dir={locale === "he" ? "rtl" : "ltr"}>
              {locale === "he" ? "אם לא מופיע {link}, הקישור יתווסף בסוף." : "If {link} is not included, the link is appended at the end."}
            </p>
          </div>

          <div className="rounded-xl border border-gold/25 bg-cream/50 p-4" dir={locale === "he" ? "rtl" : "ltr"}>
            <p className="font-medium text-navy">
              {locale === "he" ? "הצגת הנפטר/ת בקיר ההנצחה הכללי" : "Central memorial wall consent"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {locale === "he"
                ? "האם המשפחה הסכימה ששם הנפטר/ת ותאריך הפטירה יופיעו בעתיד בלוח הזיכרון המרכזי של האתר?"
                : "Whether the family agreed that the honoree name and petirah date may appear in a future central memorial wall."}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { value: true, label: locale === "he" ? "כן, אפשר להציג בעתיד" : "Yes, may show later" },
                { value: false, label: locale === "he" ? "לא, להשאיר רק בדף זה" : "No, keep only on this page" },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setMemorialWallConsent(option.value)}
                  className={
                    "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all " +
                    (memorialWallConsent === option.value
                      ? "border-gold bg-gold/10 text-navy"
                      : "border-navy/10 text-muted hover:border-navy/20")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-navy mb-2 block">{t("editProject.tracks") || "Tracks"}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TRACKS.map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => toggleTrack(track)}
                  className={
                    "px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all " +
                    (selectedTracks.includes(track)
                      ? "border-gold bg-gold/5 text-navy"
                      : "border-navy/10 text-muted hover:border-navy/20")
                  }
                >
                  {tc(`track_${track}` as never)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              {t("editProject.tracksHint") || "Removing a track with active participant records requires destructive confirmation."}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-navy/5 pt-4">
            <span className="text-sm font-medium text-navy">{t("editProject.isPublic") || "Public"}</span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-navy">{locale === "he" ? "הצג יישר כח בעמוד" : "Show Yasher Koach on the page"}</span>
              <p className="text-xs text-muted" dir={locale === "he" ? "rtl" : "ltr"}>
                {locale === "he"
                  ? "מומלץ להשאיר פעיל כדי לעודד משתתפים לקחת עוד לימוד."
                  : "Recommended: keep it on to encourage people to take more learning."}
              </p>
            </div>
            <Switch checked={showLeaderboard} onCheckedChange={setShowLeaderboard} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-navy/5">
            <Button variant="ghost" onClick={() => router.push("/admin" as const)} disabled={saving}>
              {tc("cancel") || "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : t("editProject.save") || "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
