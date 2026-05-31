"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "question",
          message: message.trim(),
          email: email.trim(),
          allowAsTestimonial: false,
          locale,
          currentPath: pathname,
        }),
      });

      if (!res.ok) {
        throw new Error("contact submission failed");
      }

      toast.success(t("sent"));
      setEmail("");
      setMessage("");
    } catch {
      toast.error(t("error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="bg-cream flex-1">
        <div className="mx-auto max-w-lg px-4 sm:px-6 py-12 sm:py-16">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 mb-4">
                <Mail className="h-6 w-6 text-gold-deep" />
              </div>
              <CardTitle className="text-2xl">{t("title")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t("emailLabel")}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t("messageLabel")}
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  <Send className="h-4 w-4" />
                  {t("send")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
