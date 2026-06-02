"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Lock } from "lucide-react";

interface PasswordGateProps {
  slug: string;
  hebrewName: string;
  englishName?: string;
  hebrewDate?: string;
}

export function PasswordGate({ slug, hebrewName, englishName, hebrewDate }: PasswordGateProps) {
  const t = useTranslations("passwordGate");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/memorials/${slug}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 429 ? t("tooMany") : t("wrong"));
        setSubmitting(false);
        return;
      }
      // Cookie is set server-side; reload so SSR renders the full memorial.
      window.location.reload();
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-navy flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <YahrzeitCandle size="md" />
        </div>
        <p className="font-serif italic text-gold/80 text-xs tracking-widest mb-1">
          — לעילוי נשמת —
        </p>
        <h1 className="font-heading font-black text-2xl text-cream" dir="rtl">
          {hebrewName}
        </h1>
        {locale === "en" && englishName && (
          <p className="font-serif italic text-gold/50 text-sm mt-1">{englishName}</p>
        )}
        {hebrewDate && (
          <p className="text-cream/40 text-sm mt-1" dir="rtl">{hebrewDate}</p>
        )}

        <div className="mt-8 rounded-2xl bg-cream/[0.04] border border-gold/15 p-6">
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-gold/10">
              <Lock className="h-5 w-5 text-gold" />
            </span>
          </div>
          <p className="text-cream/80 text-sm mb-1 font-medium">{t("title")}</p>
          <p className="text-cream/50 text-xs mb-5">{t("subtitle")}</p>

          <form onSubmit={submit} className="space-y-3">
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder={t("placeholder")}
              dir={locale === "he" ? "rtl" : "ltr"}
              className="text-center bg-cream/5 border-gold/20 text-cream placeholder:text-cream/30"
            />
            {error && <p className="text-red-300 text-xs">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting || !password.trim()}>
              {submitting ? t("checking") : t("submit")}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
