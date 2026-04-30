"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { HebrewDatePicker } from "@/components/create/HebrewDatePicker";
import {
  BookOpen,
  ScrollText,
  Music,
  Heart,
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Lock,
  Users,
  Calendar,
  FileText,
  Share2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase/config";
import type { TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_OPTIONS: {
  key: TrackType;
  icon: typeof BookOpen;
  color: string;
}[] = [
  { key: "mishnayos", icon: BookOpen, color: "bg-moed/10 text-moed" },
  { key: "tehillim", icon: Music, color: "bg-kodashim/10 text-kodashim" },
  {
    key: "shnayim_mikra",
    icon: ScrollText,
    color: "bg-zeraim/10 text-zeraim",
  },
  { key: "mitzvot", icon: Heart, color: "bg-nashim/10 text-nashim" },
];

const PROJECT_TYPES = [
  { key: "shloshim", icon: "30" },
  { key: "yahrzeit", icon: "📅" },
  { key: "year", icon: "12" },
  { key: "permanent", icon: "∞" },
] as const;

const STEPS = [
  { key: "honoree", icon: Users },
  { key: "dates", icon: Calendar },
  { key: "tribute", icon: FileText },
  { key: "tracks", icon: BookOpen },
  { key: "sharing", icon: Share2 },
  { key: "review", icon: Eye },
] as const;

export default function CreateMemorialPage() {
  const t = useTranslations("create");
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  // Step 1: Honoree
  const [nameHebrew, setNameHebrew] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [fatherNameHebrew, setFatherNameHebrew] = useState("");
  const [motherNameHebrew, setMotherNameHebrew] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [honorific, setHonorific] = useState("ז״ל");

  // Step 2: Dates
  const [dateOfPassing, setDateOfPassing] = useState("");
  const [dateOfPassingHebrew, setDateOfPassingHebrew] = useState("");
  const [datePreference, setDatePreference] = useState<
    "hebrew" | "gregorian" | "both"
  >("both");

  // Step 3: Tribute
  const [biography, setBiography] = useState("");

  // Step 4: Tracks
  const [projectType, setProjectType] = useState<string>("permanent");
  const [selectedTracks, setSelectedTracks] = useState<TrackType[]>([
    "mishnayos",
  ]);

  // Step 5: Sharing
  const [isPublic, setIsPublic] = useState(true);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [familyMessage, setFamilyMessage] = useState("");

  function toggleTrack(track: TrackType) {
    setSelectedTracks((prev) =>
      prev.includes(track)
        ? prev.filter((t2) => t2 !== track)
        : [...prev, track]
    );
  }

  async function handleSubmit() {
    if (
      !user ||
      !nameHebrew.trim() ||
      selectedTracks.length === 0
    ) {
      toast.error(t("fillRequired"));
      return;
    }

    setSubmitting(true);
    try {
      // Force-refresh the ID token to avoid expiry issues
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error(t("errorCreating"));
        router.push("/login");
        return;
      }

      const payload = {
        idToken,
        nameHebrew: nameHebrew.trim(),
        nameEnglish: nameEnglish.trim() || null,
        fatherNameHebrew: fatherNameHebrew.trim() || null,
        motherNameHebrew: motherNameHebrew.trim() || null,
        gender,
        honorific,
        dateOfPassing: dateOfPassing || null,
        dateOfPassingHebrew: dateOfPassingHebrew || null,
        datePreference,
        biography: biography.trim() || null,
        familyMessage: familyMessage.trim() || null,
        isPublic,
        allowAnonymous,
        tracks: selectedTracks,
        projectType,
      };

      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Create failed:", res.status, data);
        toast.error(data.error || t("errorCreating"));
        return;
      }

      setCreatedSlug(data.slug);
      toast.success(t("projectCreated"));
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(
        err instanceof Error ? err.message : t("errorCreating")
      );
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!nameHebrew.trim();
      case 1:
        return true; // dates optional
      case 2:
        return true; // tribute optional
      case 3:
        return selectedTracks.length > 0;
      case 4:
        return true; // sharing defaults are fine
      default:
        return true;
    }
  }

  // Success screen after creation
  if (createdSlug) {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 mb-6">
          <Check className="h-8 w-8 text-gold" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-navy mb-3">
          {t("successTitle")}
        </h1>
        <p className="text-muted mb-8 leading-relaxed">
          {t("successDesc")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={`/memorial/${createdSlug}` as "/memorial/[slug]"}>
            <Button size="lg">
              <Eye className="h-5 w-5" />
              {t("viewMemorial")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const url = `${window.location.origin}/memorial/${createdSlug}`;
              navigator.clipboard.writeText(url);
              toast.success(t("linkCopied"));
            }}
          >
            <Share2 className="h-5 w-5" />
            {t("shareLink")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i < step && setStep(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === step
                ? "w-10 bg-gold"
                : i < step
                ? "w-6 bg-gold/40 cursor-pointer hover:bg-gold/60"
                : "w-6 bg-navy/10"
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted mb-6">
        {t("stepOf", { current: step + 1, total: STEPS.length })}
      </p>

      {/* ── Step 1: Honoree Details ── */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step1Title")}</CardTitle>
            <CardDescription>{t("step1Subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("nameHebrew")} *
                </label>
                <Input
                  dir="rtl"
                  placeholder={t("nameHebrewPlaceholder")}
                  value={nameHebrew}
                  onChange={(e) => setNameHebrew(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("nameEnglish")}
                  <span className="text-muted font-normal ml-1">({t("optional")})</span>
                </label>
                <Input
                  placeholder={t("nameEnglishPlaceholder")}
                  value={nameEnglish}
                  onChange={(e) => setNameEnglish(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("fatherName")}
                </label>
                <Input
                  dir="rtl"
                  placeholder={t("fatherNamePlaceholder")}
                  value={fatherNameHebrew}
                  onChange={(e) => setFatherNameHebrew(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("motherName")}
                </label>
                <Input
                  dir="rtl"
                  placeholder={t("motherNamePlaceholder")}
                  value={motherNameHebrew}
                  onChange={(e) => setMotherNameHebrew(e.target.value)}
                />
              </div>
            </div>

            {/* Gender radio */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 block">
                {t("gender")} *
              </label>
              <div className="flex gap-3">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setGender(g);
                      setHonorific(g === "female" ? "ע״ה" : "ז״ל");
                    }}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                      gender === g
                        ? "border-gold bg-gold/5 text-navy"
                        : "border-navy/10 text-muted hover:border-navy/20"
                    )}
                  >
                    {t(g)}
                  </button>
                ))}
              </div>
            </div>

            {/* Honorific */}
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">
                {t("honorific")}
              </label>
              <Input
                dir="rtl"
                value={honorific}
                onChange={(e) => setHonorific(e.target.value)}
                placeholder="ז״ל"
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted mt-1">{t("honorificHint")}</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!canProceed()}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Dates ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("datesTitle")}</CardTitle>
            <CardDescription>{t("datesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <HebrewDatePicker
              label={t("dateOfPassing")}
              gregorianValue={dateOfPassing}
              hebrewValue={dateOfPassingHebrew}
              onGregorianChange={setDateOfPassing}
              onHebrewChange={setDateOfPassingHebrew}
              maxToday
            />

            {/* Display preference */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 block">
                {t("dateDisplayPref")}
              </label>
              <div className="flex gap-2">
                {(["hebrew", "gregorian", "both"] as const).map((pref) => (
                  <button
                    key={pref}
                    onClick={() => setDatePreference(pref)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all",
                      datePreference === pref
                        ? "border-gold bg-gold/10 text-gold-deep"
                        : "border-navy/10 text-muted hover:border-navy/20"
                    )}
                  >
                    {t(`datePref_${pref}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Date preview */}
            {(dateOfPassing || dateOfPassingHebrew) && (
              <div className="rounded-lg bg-cream p-4 text-center">
                <p className="text-xs text-muted mb-1">{t("datePreview")}</p>
                <p className="font-heading text-navy">
                  {(datePreference === "hebrew" || datePreference === "both") &&
                    dateOfPassingHebrew && (
                      <span dir="rtl">{dateOfPassingHebrew}</span>
                    )}
                  {datePreference === "both" &&
                    dateOfPassing &&
                    dateOfPassingHebrew && <span className="mx-2">·</span>}
                  {(datePreference === "gregorian" ||
                    datePreference === "both") &&
                    dateOfPassing && <span>{dateOfPassing}</span>}
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button onClick={() => setStep(2)}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Tribute ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("tributeTitle")}</CardTitle>
            <CardDescription>{t("tributeSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-navy">
                  {t("tribute")}
                </label>
                <span className="text-xs text-muted">
                  {biography.length}/2000
                </span>
              </div>
              <Textarea
                placeholder={t("tributePlaceholder")}
                value={biography}
                onChange={(e) =>
                  setBiography(e.target.value.slice(0, 2000))
                }
                rows={8}
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted mt-1">{t("tributeHint")}</p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button onClick={() => setStep(3)}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Project Type & Tracks ── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("tracksTitle")}</CardTitle>
            <CardDescription>{t("tracksSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project type */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 block">
                {t("projectType")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROJECT_TYPES.map(({ key, icon }) => (
                  <button
                    key={key}
                    onClick={() => setProjectType(key)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-start transition-all",
                      projectType === key
                        ? "border-gold bg-gold/5"
                        : "border-navy/10 hover:border-navy/20"
                    )}
                  >
                    <span className="text-lg">{icon}</span>
                    <p className="text-sm font-medium text-navy mt-1">
                      {t(`type_${key}`)}
                    </p>
                    <p className="text-xs text-muted">
                      {t(`type_${key}_desc`)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tracks */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 block">
                {t("activityTracks")}
              </label>
              <div className="space-y-2">
                {TRACK_OPTIONS.map(({ key, icon: Icon, color }) => {
                  const selected = selectedTracks.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTrack(key)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-start",
                        selected
                          ? "border-gold bg-gold/5"
                          : "border-navy/10 hover:border-navy/20"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                          color
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-navy">
                          {t(`track_${key}`)}
                        </p>
                        <p className="text-xs text-muted">
                          {t(`track_${key}_desc`)}
                        </p>
                      </div>
                      {selected && (
                        <Check className="h-5 w-5 text-gold shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={selectedTracks.length === 0}
              >
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Sharing & Privacy ── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sharingTitle")}</CardTitle>
            <CardDescription>{t("sharingSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Public/Private */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {isPublic ? (
                  <Globe className="h-5 w-5 text-gold mt-0.5 shrink-0" />
                ) : (
                  <Lock className="h-5 w-5 text-muted mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-navy">{t("publicProject")}</p>
                  <p className="text-xs text-muted">
                    {t("publicProjectDesc")}
                  </p>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            {/* Anonymous */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-navy">
                    {t("allowAnonymous")}
                  </p>
                  <p className="text-xs text-muted">
                    {t("allowAnonymousDesc")}
                  </p>
                </div>
              </div>
              <Switch
                checked={allowAnonymous}
                onCheckedChange={setAllowAnonymous}
              />
            </div>

            {/* Family message */}
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">
                {t("familyMessage")}
              </label>
              <Textarea
                placeholder={t("familyMessagePlaceholder")}
                value={familyMessage}
                onChange={(e) => setFamilyMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Creator email */}
            <div className="rounded-lg bg-cream/50 p-3">
              <p className="text-xs text-muted">{t("creatorEmail")}</p>
              <p className="text-sm font-medium text-navy">
                {user?.email || "—"}
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button onClick={() => setStep(5)}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 6: Review & Create ── */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewTitle")}</CardTitle>
            <CardDescription>{t("reviewSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Honoree summary */}
            <ReviewSection
              title={t("honoreeSection")}
              onEdit={() => setStep(0)}
              editLabel={t("edit")}
            >
              <p className="font-heading text-navy" dir="rtl">
                {nameHebrew} {honorific}
              </p>
              {nameEnglish && <p className="text-sm text-muted">{nameEnglish}</p>}
              {fatherNameHebrew && (
                <p className="text-xs text-muted" dir="rtl">
                  {gender === "male" ? "בן" : "בת"} {fatherNameHebrew}
                </p>
              )}
            </ReviewSection>

            {/* Dates */}
            <ReviewSection
              title={t("datesSection")}
              onEdit={() => setStep(1)}
              editLabel={t("edit")}
            >
              {dateOfPassingHebrew && (
                <p className="text-sm" dir="rtl">
                  {dateOfPassingHebrew}
                </p>
              )}
              {dateOfPassing && (
                <p className="text-sm text-muted">{dateOfPassing}</p>
              )}
              {!dateOfPassing && !dateOfPassingHebrew && (
                <p className="text-sm text-muted italic">{t("notProvided")}</p>
              )}
            </ReviewSection>

            {/* Tribute */}
            {biography && (
              <ReviewSection
                title={t("tributeSection")}
                onEdit={() => setStep(2)}
                editLabel={t("edit")}
              >
                <p className="text-sm text-muted line-clamp-3">{biography}</p>
              </ReviewSection>
            )}

            {/* Tracks */}
            <ReviewSection
              title={t("tracksSection")}
              onEdit={() => setStep(3)}
              editLabel={t("edit")}
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{t(`type_${projectType}`)}</Badge>
                {selectedTracks.map((track) => (
                  <Badge key={track}>{t(`track_${track}`)}</Badge>
                ))}
              </div>
            </ReviewSection>

            {/* Sharing */}
            <ReviewSection
              title={t("sharingSection")}
              onEdit={() => setStep(4)}
              editLabel={t("edit")}
            >
              <div className="flex gap-2">
                <Badge variant={isPublic ? "success" : "secondary"}>
                  {isPublic ? t("public") : t("private")}
                </Badge>
                {allowAnonymous && (
                  <Badge variant="default">{t("anonymousAllowed")}</Badge>
                )}
              </div>
            </ReviewSection>

            {/* Submit */}
            <div className="pt-4 space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  t("createMemorial")
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep(4)}
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-cream/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-navy">{title}</h4>
        <button
          onClick={onEdit}
          className="text-xs text-gold hover:text-gold-deep font-medium"
        >
          {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
