"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Music,
  ScrollText,
  Heart,
  Share2,
  Check,
  Clock,
  Flag,
} from "lucide-react";
import { ReportModal } from "./ReportModal";
import { toast } from "sonner";
import { doc, updateDoc, addDoc, collection, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { MemorialProject, Portion, TrackType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_ICONS: Record<TrackType, typeof BookOpen> = {
  mishnayos: BookOpen,
  tehillim: Music,
  shnayim_mikra: ScrollText,
  mussar: BookOpen,
  mitzvot: Heart,
};

const SEDER_BADGE: Record<string, string> = {
  Zeraim: "zeraim",
  Moed: "moed",
  Nashim: "nashim",
  Nezikin: "nezikin",
  Kodashim: "kodashim",
  Tahorot: "tahorot",
};

interface Props {
  project: MemorialProject;
  portions: Portion[];
}

export function MemorialPageClient({ project, portions: initialPortions }: Props) {
  const t = useTranslations("memorial");
  const locale = useLocale();
  const { user } = useAuth();
  const [portions, setPortions] = useState(initialPortions);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState<Portion | null>(null);
  const [claimerName, setClaimerName] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const totalPortions = portions.length;
  const claimed = portions.filter((p) => p.status !== "available").length;
  const completed = portions.filter((p) => p.status === "completed").length;
  const pct = totalPortions > 0 ? Math.round((completed / totalPortions) * 100) : 0;

  const trackGroups = useMemo(() => {
    const groups: Record<string, Portion[]> = {};
    for (const p of portions) {
      const key = p.trackType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [portions]);

  function handleClaimClick(portion: Portion) {
    setSelectedPortion(portion);
    setClaimerName(user?.displayName || user?.email?.split("@")[0] || "");
    setConfirmDialogOpen(true);
  }

  async function confirmClaim() {
    if (!selectedPortion || !claimerName.trim()) return;
    setClaimingId(selectedPortion.id);

    try {
      // Update portion
      await updateDoc(doc(db, "lzecher_portions", selectedPortion.id), {
        status: "claimed",
        claimedBy: user?.uid || "anonymous",
        claimedByName: claimerName.trim(),
        claimedAt: Date.now(),
      });

      // Create claim record
      await addDoc(collection(db, "lzecher_claims"), {
        projectId: project.id,
        portionId: selectedPortion.id,
        trackType: selectedPortion.trackType,
        reference: selectedPortion.reference,
        userId: user?.uid || "anonymous",
        userName: claimerName.trim(),
        userEmail: user?.email || null,
        claimedAt: Date.now(),
        status: "active",
      });

      // Update project stats
      await updateDoc(doc(db, "lzecher_projects", project.id), {
        claimedPortions: increment(1),
        participantCount: increment(1),
      });

      // Update local state
      setPortions((prev) =>
        prev.map((p) =>
          p.id === selectedPortion.id
            ? { ...p, status: "claimed" as const, claimedByName: claimerName.trim(), claimedAt: Date.now() }
            : p
        )
      );

      toast.success(t("claimSuccess"));
    } catch {
      toast.error(t("claimError"));
    } finally {
      setClaimingId(null);
      setConfirmDialogOpen(false);
      setSelectedPortion(null);
    }
  }

  async function handleComplete(portion: Portion) {
    setCompleting(true);
    try {
      await updateDoc(doc(db, "lzecher_portions", portion.id), {
        status: "completed",
        completedAt: Date.now(),
      });

      await updateDoc(doc(db, "lzecher_projects", project.id), {
        completedPortions: increment(1),
      });

      setPortions((prev) =>
        prev.map((p) =>
          p.id === portion.id ? { ...p, status: "completed" as const, completedAt: Date.now() } : p
        )
      );

      toast.success(t("completedSuccess"));
    } catch {
      toast.error(t("completeError"));
    } finally {
      setCompleting(false);
    }
  }

  function shareLink() {
    const url = `${window.location.origin}/${locale}/memorial/${project.slug}`;
    navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
  }

  const fullName = project.fatherNameHebrew
    ? `${project.nameHebrew} ${project.gender === "male" ? "בן" : "בת"} ${project.fatherNameHebrew}`
    : project.nameHebrew;

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <div className="bg-navy text-cream">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <p className="text-gold text-sm font-medium mb-2 tracking-wider uppercase">
              {t("lIluyNishmas")}
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-3" dir="rtl">
              {fullName}
            </h1>
            {project.nameEnglish && (
              <p className="text-cream/70 text-lg">{project.nameEnglish}</p>
            )}
            {project.dateOfPassing && (
              <p className="text-cream/50 text-sm mt-2">{project.dateOfPassing}</p>
            )}

            {/* Stats bar */}
            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md mx-auto">
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{claimed}</p>
                <p className="text-xs text-cream/50">{t("claimed")}</p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{completed}</p>
                <p className="text-xs text-cream/50">{t("completed")}</p>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-gold">{pct}%</p>
                <p className="text-xs text-cream/50">{t("progress")}</p>
              </div>
            </div>

            <div className="mt-6 max-w-md mx-auto">
              <Progress value={pct} className="h-2 bg-cream/10" indicatorClassName="bg-gold" />
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" className="border-cream/20 text-cream hover:bg-cream/10" onClick={shareLink}>
                <Share2 className="h-4 w-4" />
                {t("share")}
              </Button>
              <button
                onClick={() => setReportOpen(true)}
                className="text-xs text-cream/30 hover:text-cream/60 transition-colors"
              >
                <Flag className="h-3 w-3 inline mr-1" />
                {t("report")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Biography */}
      {project.biography && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted leading-relaxed font-serif italic">{project.biography}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Family message */}
      {project.familyMessage && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-4">
          <Card className="border-gold/20 bg-cream-glow">
            <CardContent className="p-6">
              <p className="text-sm text-navy leading-relaxed">{project.familyMessage}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Track tabs */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <Tabs defaultValue={project.tracks[0]} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            {project.tracks.map((track) => {
              const Icon = TRACK_ICONS[track];
              const trackPortions = trackGroups[track] || [];
              const trackCompleted = trackPortions.filter((p) => p.status === "completed").length;
              return (
                <TabsTrigger key={track} value={track} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {t(`track_${track}`)}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {trackCompleted}/{trackPortions.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {project.tracks.map((track) => {
            const trackPortions = trackGroups[track] || [];
            return (
              <TabsContent key={track} value={track}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {trackPortions.map((portion) => (
                    <Card
                      key={portion.id}
                      className={cn(
                        "transition-all",
                        portion.status === "completed" && "opacity-60",
                        portion.status === "available" && "hover:shadow-md hover:-translate-y-0.5"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-navy text-sm">{portion.displayName}</p>
                            <p className="text-xs text-muted" dir="rtl">
                              {portion.displayNameHebrew}
                            </p>
                          </div>
                          {portion.seder && (
                            <Badge variant={(SEDER_BADGE[portion.seder] || "default") as "zeraim"}>
                              {portion.seder}
                            </Badge>
                          )}
                        </div>

                        {portion.status === "available" && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleClaimClick(portion)}
                            disabled={claimingId === portion.id}
                          >
                            {claimingId === portion.id ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <>
                                <BookOpen className="h-3 w-3" />
                                {t("claimPortion")}
                              </>
                            )}
                          </Button>
                        )}

                        {portion.status === "claimed" && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <Clock className="h-3 w-3" />
                              {t("claimedBy", { name: portion.claimedByName || t("someone") })}
                            </div>
                            {user && portion.claimedBy === user.uid && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full"
                                onClick={() => handleComplete(portion)}
                                disabled={completing}
                              >
                                <Check className="h-3 w-3" />
                                {t("markComplete")}
                              </Button>
                            )}
                          </div>
                        )}

                        {portion.status === "completed" && (
                          <div className="flex items-center gap-2 text-xs text-emerald-600 mt-2">
                            <Check className="h-3 w-3" />
                            {t("completedBy", { name: portion.claimedByName || t("someone") })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Claim confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmClaim")}</DialogTitle>
            <DialogDescription>
              {t("confirmClaimDesc", { reference: selectedPortion?.displayName || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">{t("yourName")}</label>
              <Input
                value={claimerName}
                onChange={(e) => setClaimerName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={confirmClaim} disabled={!claimerName.trim()}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report modal */}
      <ReportModal slug={project.slug} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
