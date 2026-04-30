"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Flag, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REASONS = [
  "inappropriate",
  "wrong_info",
  "hateful",
  "spam",
  "photo",
  "other",
] as const;

interface Props {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportModal({ slug, open, onOpenChange }: Props) {
  const t = useTranslations("report");
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!reason) return;
    setSending(true);
    try {
      const res = await fetch(`/api/memorials/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details, email: email || null }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-4">
            <Check className="h-12 w-12 text-gold mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-navy mb-2">
              {t("thankYou")}
            </h3>
            <p className="text-sm text-muted">{t("thankYouDesc")}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-muted" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn(
                  "p-2 rounded-lg border text-xs font-medium transition-all text-start",
                  reason === r
                    ? "border-gold bg-gold/10 text-navy"
                    : "border-navy/10 text-muted hover:border-navy/20"
                )}
              >
                {t(`reason_${r}`)}
              </button>
            ))}
          </div>
          <Textarea
            placeholder={t("detailsPlaceholder")}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            rows={3}
          />
          <Input
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!reason || sending}
          >
            {sending ? <Spinner className="h-4 w-4" /> : t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
