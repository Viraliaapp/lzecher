"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
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
import { MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = ["suggestion", "bug", "question", "praise", "other"] as const;

export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [allowTestimonial, setAllowTestimonial] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Hide on create wizard and admin pages
  if (pathname.includes("/create") || pathname.includes("/admin")) {
    return null;
  }

  async function handleSubmit() {
    if (!type || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          email: email || null,
          allowAsTestimonial: allowTestimonial,
          locale,
          currentPath: pathname,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        toast.error(t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 flex h-11 w-11 items-center justify-center rounded-full",
          "bg-gold text-navy shadow-lg hover:shadow-xl hover:-translate-y-0.5",
          "transition-all duration-200",
          "bottom-6 end-6"
        )}
        aria-label={t("title")}
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSent(false); }}>
        <DialogContent>
          {sent ? (
            <div className="text-center py-4">
              <Check className="h-12 w-12 text-gold mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                {t("thankYou")}
              </h3>
              <p className="text-sm text-muted">{t("thankYouDesc")}</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>{t("subtitle")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setType(tp)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        type === tp
                          ? "border-gold bg-gold/10 text-navy"
                          : "border-navy/10 text-muted hover:border-navy/20"
                      )}
                    >
                      {t(`type_${tp}`)}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-navy">
                      {t("messageLabel")}
                    </label>
                    <span className="text-xs text-muted">{message.length}/2000</span>
                  </div>
                  <Textarea
                    placeholder={t("messagePlaceholder")}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                    rows={4}
                  />
                </div>
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowTestimonial}
                    onChange={(e) => setAllowTestimonial(e.target.checked)}
                    className="rounded border-navy/20"
                  />
                  {t("testimonialConsent")}
                </label>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!type || !message.trim() || sending}
                >
                  {sending ? <Spinner className="h-4 w-4" /> : t("submit")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
