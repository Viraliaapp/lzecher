"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { ModerationItem } from "@/lib/types";

export default function AdminPage() {
  const t = useTranslations("admin");
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function loadQueue() {
    try {
      const q = query(
        collection(db, "lzecher_moderation"),
        where("status", "==", "pending"),
        orderBy("submittedAt", "desc")
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ModerationItem)));
    } catch (err) {
      console.error("Error loading moderation queue:", err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!authLoading && (!user || !profile?.isAdmin)) {
      router.push("/dashboard");
      return;
    }
    if (user && profile?.isAdmin) loadQueue();
  }, [user, profile, authLoading]);

  async function handleApprove(item: ModerationItem) {
    setProcessingId(item.id);
    try {
      await updateDoc(doc(db, "lzecher_moderation", item.id), {
        status: "approved",
        reviewedBy: user!.uid,
        reviewedAt: Date.now(),
      });
      await updateDoc(doc(db, "lzecher_projects", item.projectId), {
        status: "active",
      });

      // Generate portions for the project
      const response = await fetch("/api/seed/portions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: item.projectId }),
      });

      if (!response.ok) throw new Error("Failed to generate portions");

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(t("approved"));
    } catch (err) {
      console.error("Approve error:", err);
      toast.error(t("approveError"));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(item: ModerationItem) {
    if (!rejectionReason.trim()) {
      toast.error(t("provideReason"));
      return;
    }
    setProcessingId(item.id);
    try {
      await updateDoc(doc(db, "lzecher_moderation", item.id), {
        status: "rejected",
        reviewedBy: user!.uid,
        reviewedAt: Date.now(),
        rejectionReason: rejectionReason.trim(),
      });
      await updateDoc(doc(db, "lzecher_projects", item.projectId), {
        status: "archived",
      });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setRejectionReason("");
      toast.success(t("rejected"));
    } catch {
      toast.error(t("rejectError"));
    } finally {
      setProcessingId(null);
    }
  }

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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
            <Shield className="h-5 w-5 text-gold-deep" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>
            <p className="text-sm text-muted">{t("subtitle")}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Check className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                {t("allClear")}
              </h3>
              <p className="text-sm text-muted">{t("noItems")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{item.projectName}</CardTitle>
                    <Badge>
                      <Clock className="h-3 w-3 mr-1" />
                      {t("pending")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {t("by")} {item.createdByEmail} &middot;{" "}
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder={t("rejectionReasonPlaceholder")}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApprove(item)}
                      disabled={processingId === item.id}
                      className="flex-1"
                    >
                      {processingId === item.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          {t("approve")}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(item)}
                      disabled={processingId === item.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4" />
                      {t("reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
