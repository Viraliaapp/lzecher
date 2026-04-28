"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, ScrollText, Music, Heart, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_OPTIONS: { key: TrackType; icon: typeof BookOpen; color: string }[] = [
  { key: "mishnayos", icon: BookOpen, color: "bg-moed/10 text-moed border-moed/20" },
  { key: "tehillim", icon: Music, color: "bg-kodashim/10 text-kodashim border-kodashim/20" },
  { key: "shnayim_mikra", icon: ScrollText, color: "bg-zeraim/10 text-zeraim border-zeraim/20" },
  { key: "mitzvot", icon: Heart, color: "bg-nashim/10 text-nashim border-nashim/20" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) + "-" + Math.random().toString(36).slice(2, 8);
}

export default function CreateMemorialPage() {
  const t = useTranslations("create");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [nameHebrew, setNameHebrew] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [fatherNameHebrew, setFatherNameHebrew] = useState("");
  const [motherNameHebrew, setMotherNameHebrew] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [dateOfPassing, setDateOfPassing] = useState("");
  const [biography, setBiography] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [selectedTracks, setSelectedTracks] = useState<TrackType[]>(["mishnayos"]);

  function toggleTrack(track: TrackType) {
    setSelectedTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    );
  }

  async function handleSubmit() {
    if (!user || !nameHebrew.trim() || !nameEnglish.trim() || selectedTracks.length === 0) {
      toast.error(t("fillRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const slug = slugify(nameEnglish);
      const projectData = {
        slug,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nameHebrew: nameHebrew.trim(),
        nameEnglish: nameEnglish.trim(),
        fatherNameHebrew: fatherNameHebrew.trim() || null,
        motherNameHebrew: motherNameHebrew.trim() || null,
        gender,
        dateOfPassing: dateOfPassing || null,
        photoURL: null,
        biography: biography.trim() || null,
        familyMessage: familyMessage.trim() || null,
        isPublic,
        allowAnonymous,
        status: "pending_moderation",
        tracks: selectedTracks,
        totalPortions: 0,
        claimedPortions: 0,
        completedPortions: 0,
        participantCount: 0,
      };

      const docRef = await addDoc(collection(db, "lzecher_projects"), projectData);

      // Set the id field in the document
      await setDoc(doc(db, "lzecher_projects", docRef.id), { id: docRef.id }, { merge: true });

      // Create moderation queue item
      await addDoc(collection(db, "lzecher_moderation"), {
        id: docRef.id,
        projectId: docRef.id,
        projectName: nameEnglish,
        createdBy: user.uid,
        createdByEmail: user.email,
        submittedAt: Date.now(),
        status: "pending",
      });

      toast.success(t("projectCreated"));
      router.push("/dashboard");
    } catch (err) {
      console.error("Error creating project:", err);
      toast.error(t("errorCreating"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-2 rounded-full transition-all",
              s === step ? "w-8 bg-gold" : s < step ? "w-8 bg-gold/40" : "w-8 bg-navy/10"
            )}
          />
        ))}
      </div>

      {/* Step 1: Niftar Details */}
      {step === 1 && (
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
                  placeholder="שם העברי"
                  value={nameHebrew}
                  onChange={(e) => setNameHebrew(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("nameEnglish")} *
                </label>
                <Input
                  placeholder="English name"
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
                  placeholder="בן/בת"
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
                  placeholder="אם"
                  value={motherNameHebrew}
                  onChange={(e) => setMotherNameHebrew(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("gender")} *
                </label>
                <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("male")}</SelectItem>
                    <SelectItem value="female">{t("female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t("dateOfPassing")}
                </label>
                <Input
                  type="date"
                  value={dateOfPassing}
                  onChange={(e) => setDateOfPassing(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-navy mb-1 block">
                {t("biography")}
              </label>
              <Textarea
                placeholder={t("biographyPlaceholder")}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!nameHebrew.trim() || !nameEnglish.trim()}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Track Selection */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step2Title")}</CardTitle>
            <CardDescription>{t("step2Subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRACK_OPTIONS.map(({ key, icon: Icon, color }) => {
                const selected = selectedTracks.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTrack(key)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-start",
                      selected
                        ? "border-gold bg-gold/5 shadow-sm"
                        : "border-navy/10 hover:border-navy/20"
                    )}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-navy">{t(`track_${key}`)}</p>
                      <p className="text-xs text-muted">{t(`track_${key}_desc`)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

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

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button onClick={() => setStep(3)} disabled={selectedTracks.length === 0}>
                {t("next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Settings & Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step3Title")}</CardTitle>
            <CardDescription>{t("step3Subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{t("publicProject")}</p>
                <p className="text-xs text-muted">{t("publicProjectDesc")}</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{t("allowAnonymous")}</p>
                <p className="text-xs text-muted">{t("allowAnonymousDesc")}</p>
              </div>
              <Switch checked={allowAnonymous} onCheckedChange={setAllowAnonymous} />
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-cream p-4 space-y-2">
              <h4 className="font-heading font-semibold text-navy">{t("summary")}</h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted">{t("name")}:</span>{" "}
                  <span className="font-medium">{nameHebrew} / {nameEnglish}</span>
                </p>
                <p>
                  <span className="text-muted">{t("tracks")}:</span>{" "}
                  <span className="font-medium">{selectedTracks.map((t2) => t(`track_${t2}`)).join(", ")}</span>
                </p>
                <p>
                  <span className="text-muted">{t("visibility")}:</span>{" "}
                  <span className="font-medium">{isPublic ? t("public") : t("private")}</span>
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("back")}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : t("createMemorial")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
